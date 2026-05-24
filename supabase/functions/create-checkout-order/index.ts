import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildAuthoritativeCheckout } from '../_shared/checkoutAuthority.ts'
import {
  buildInventoryReservationItems,
  claimCheckoutRequest,
  finalizeCheckoutRequest,
  insertCouponRedemption,
  insertOrderItems,
  insertOrderWithFallback,
  insertPaymentRecord,
  insertPaymentTermsAcceptance,
  InventoryReservationItem,
  releaseCheckoutInventory,
  reserveCheckoutInventory,
  rollbackCheckoutRecords,
  CheckoutWriteVendorOrder,
} from '../_shared/checkoutPersistence.ts'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'

// CORS headers are resolved dynamically per-request origin via getCorsHeaders(origin).
// See supabase/functions/_shared/cors.ts and the ALLOWED_ORIGINS Edge Function secret.

const json = (body: unknown, status = 200, req?: Request) => new Response(JSON.stringify(body), {
  status,
  headers: { ...(req ? getCorsHeaders(req.headers.get('Origin')) : {}), 'Content-Type': 'application/json' },
})

type SupabaseClient = ReturnType<typeof createClient>

type JsonRecord = Record<string, unknown>

class HttpError extends Error {
  status: number

  constructor(message: string, status = 500) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

const asObject = (value: unknown): JsonRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as JsonRecord
}

const asString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : ''
}

serve(async (req) => {
  const optionsResponse = handleOptions(req)
  if (optionsResponse) return optionsResponse

  const createdOrderIds: string[] = []
  const reservedInventoryItems: InventoryReservationItem[] = []
  let activeSupabase: SupabaseClient | null = null
  let authenticatedUserId = ''
  let idempotencyKey = ''

  try {
    if (req.method !== 'POST') {
      throw new HttpError('Method not allowed', 405)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new HttpError('Supabase configuration missing', 500)
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    activeSupabase = supabase

    let auth
    try {
      auth = await requireAuth(req)
    } catch (error) {
      if (error instanceof Response) {
        throw new HttpError(error.status === 401 ? 'Authentication required' : 'Forbidden', error.status)
      }
      throw new HttpError('Authentication required', 401)
    }

    const user = { id: auth.userId }
    authenticatedUserId = user.id

    const payload = asObject(await req.json())
    idempotencyKey = asString(payload.idempotencyKey)

    if (idempotencyKey) {
      const checkoutRequestClaim = await claimCheckoutRequest(supabase, user.id, idempotencyKey, payload)

      if (checkoutRequestClaim?.cached_response) {
        return json(checkoutRequestClaim.cached_response, 200, req)
      }

      if (checkoutRequestClaim?.in_progress && !checkoutRequestClaim?.can_proceed) {
        return json(
          {
            success: false,
            error: 'يجري تنفيذ نفس الطلب حالياً. انتظر قليلاً ثم أعد المحاولة إذا لزم الأمر.',
          },
          409,
          req,
        )
      }
    }

    const authoritativeCheckout = asObject(
      await buildAuthoritativeCheckout({
        supabase,
        userId: user.id,
        payload,
        strictCouponValidation: true,
        strictPaymentValidation: true,
      }),
    )

    const vendorOrders = (authoritativeCheckout.vendorOrders || []) as Array<Record<string, unknown>>
    const inventoryReservationItems = buildInventoryReservationItems(vendorOrders)
    await reserveCheckoutInventory(supabase, inventoryReservationItems)
    reservedInventoryItems.push(...inventoryReservationItems)

    const orders: Array<Record<string, unknown>> = []
    for (const rawVendorOrder of vendorOrders) {
      const vendorOrder = asObject(rawVendorOrder) as unknown as CheckoutWriteVendorOrder

      const order = await insertOrderWithFallback(supabase, vendorOrder)
      const orderId = String(order.id || '')
      if (!orderId) {
        throw new Error('order_id_missing_after_insert')
      }

      createdOrderIds.push(orderId)
      await insertPaymentRecord(supabase, orderId, vendorOrder)
      await insertPaymentTermsAcceptance(supabase, user.id, orderId, vendorOrder)
      await insertOrderItems(supabase, orderId, vendorOrder)
      orders.push(order)
    }

    if (orders.length === 0) {
      throw new Error('no_orders_created')
    }

    await insertCouponRedemption(supabase, String(orders[0].id || ''), user.id, authoritativeCheckout)

    const responsePayload: JsonRecord = {
      success: true,
      orders,
      pricing: authoritativeCheckout.pricing || null,
      coupon: authoritativeCheckout.appliedCoupon || null,
    }

    await finalizeCheckoutRequest(supabase, user.id, idempotencyKey, {
      status: 'completed',
      responsePayload,
      orderIds: createdOrderIds,
    })

    return json(responsePayload, 200, req)
  } catch (rawError) {
    const error = rawError instanceof Error ? rawError : new Error('Failed to create checkout order')
    const rollbackIssues: string[] = []

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (supabaseUrl && serviceRoleKey) {
      const rollbackClient = createClient(supabaseUrl, serviceRoleKey)

      if (createdOrderIds.length > 0) {
        try {
          await rollbackCheckoutRecords(rollbackClient, createdOrderIds)
        } catch (rollbackError) {
          const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : 'unknown_rollback_orders_failure'
          rollbackIssues.push(rollbackMessage)
        }
      }

      if (reservedInventoryItems.length > 0) {
        try {
          await releaseCheckoutInventory(rollbackClient, reservedInventoryItems)
        } catch (rollbackError) {
          const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : 'unknown_rollback_inventory_failure'
          rollbackIssues.push(rollbackMessage)
        }
      }
    }

    if (activeSupabase && authenticatedUserId && idempotencyKey) {
      try {
        await finalizeCheckoutRequest(activeSupabase, authenticatedUserId, idempotencyKey, {
          status: 'failed',
          orderIds: createdOrderIds,
          errorMessage: rollbackIssues.length
            ? `${error.message}; rollback: ${rollbackIssues.join(' | ')}`
            : error.message,
        })
      } catch (finalizationError) {
        const finalizationMessage = finalizationError instanceof Error ? finalizationError.message : 'unknown_idempotency_finalization_failure'
        console.error('create-checkout-order idempotency finalization failed:', finalizationMessage)
      }
    }

    if (rollbackIssues.length > 0) {
      console.error('create-checkout-order rollback issues:', rollbackIssues)
    }

    console.error('create-checkout-order error:', error.message)

    const status = rawError instanceof HttpError ? rawError.status : 500
    return json(
      {
        success: false,
        error: error.message,
      },
      status,
      req,
    )
  }
})
