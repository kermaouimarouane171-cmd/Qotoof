import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  createAdminClient,
  paypalCorsHeaders,
  paypalJsonResponse,
  reconcilePayPalOrder,
} from '../_shared/paypalCheckout.ts'

const RECONCILIATION_SECRET = Deno.env.get('PAYPAL_RECONCILIATION_SECRET') || Deno.env.get('PAYPAL_CRON_SECRET') || ''
const DEFAULT_BATCH_LIMIT = 20
const MAX_BATCH_LIMIT = 100
const DEFAULT_MIN_AGE_MINUTES = 5

type PendingPaymentRow = {
  id: string
  order_id: string | null
  transaction_id: string | null
  status: string | null
  created_at?: string | null
  updated_at?: string | null
}

const isSecretAuthorized = (req: Request) => {
  // FAIL-CLOSED: if no secret is configured, deny batch/cron access.
  // Individual order reconciliation still works via JWT auth path below.
  // This prevents batch operations from being openly accessible if the
  // secret is accidentally unset or deleted.
  if (!RECONCILIATION_SECRET) {
    return false
  }

  const authHeader = req.headers.get('authorization') || ''
  return authHeader === `Bearer ${RECONCILIATION_SECRET}`
}

const parseBody = async (req: Request) => {
  try {
    return await req.json()
  } catch {
    return {}
  }
}

const extractBearerToken = (req: Request) => {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) {
    return ''
  }
  return authHeader.slice(7).trim()
}

const loadAuthorizedOrder = async (
  adminClient: NonNullable<ReturnType<typeof createAdminClient>>,
  orderId: string,
  userId: string,
) => {
  const { data, error } = await adminClient
    .from('orders')
    .select('id, payment_method')
    .eq('id', orderId)
    .or(`buyer_id.eq.${userId},vendor_id.eq.${userId},driver_id.eq.${userId}`)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    throw new Error('Order not found or access denied')
  }

  return data
}

const reconcileSingleOrder = async (
  adminClient: NonNullable<ReturnType<typeof createAdminClient>>,
  orderId: string,
) => {
  const { data: paymentRecord, error } = await adminClient
    .from('payments')
    .select('id, order_id, transaction_id, status')
    .eq('order_id', orderId)
    .eq('payment_method', 'paypal')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!paymentRecord?.transaction_id) {
    throw new Error('No PayPal transaction found for this order')
  }

  const result = await reconcilePayPalOrder({
    paypalOrderId: paymentRecord.transaction_id,
    adminClient,
  })

  return {
    orderId,
    paymentId: paymentRecord.id,
    paypalOrderId: paymentRecord.transaction_id,
    statusBefore: paymentRecord.status,
    ...result,
  }
}

const isOlderThanThreshold = (payment: PendingPaymentRow, minimumAgeMs: number) => {
  const comparisonTime = payment.updated_at || payment.created_at
  if (!comparisonTime) {
    return true
  }

  const age = Date.now() - new Date(comparisonTime).getTime()
  return age >= minimumAgeMs
}

serve(async (req) => {
  const requestOrigin = req.headers.get('Origin')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: paypalCorsHeaders(requestOrigin) })
  }

  if (req.method !== 'POST') {
    return paypalJsonResponse({ error: 'Method not allowed' }, 405, requestOrigin)
  }

  try {
    const adminClient = createAdminClient({ required: true })
    const secretAuthorized = isSecretAuthorized(req)
    const body = await parseBody(req)
    const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : ''
    const requestedLimit = Number(body.limit)
    const requestedMinAge = Number(body.olderThanMinutes)
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.trunc(requestedLimit), 1), MAX_BATCH_LIMIT)
      : DEFAULT_BATCH_LIMIT
    const olderThanMinutes = Number.isFinite(requestedMinAge)
      ? Math.max(Math.trunc(requestedMinAge), 0)
      : DEFAULT_MIN_AGE_MINUTES

    if (!secretAuthorized) {
      const callerJwt = extractBearerToken(req)

      if (!callerJwt) {
        return paypalJsonResponse({ error: 'Unauthorized' }, 401, requestOrigin)
      }

      if (!orderId) {
        return paypalJsonResponse({ error: 'orderId is required for authenticated reconciliation' }, 400, requestOrigin)
      }

      const { data: { user }, error: authError } = await adminClient.auth.getUser(callerJwt)

      if (authError || !user) {
        return paypalJsonResponse({ error: 'Unauthorized' }, 401, requestOrigin)
      }

      const order = await loadAuthorizedOrder(adminClient, orderId, user.id)

      if (order.payment_method !== 'paypal') {
        return paypalJsonResponse({ error: 'This order does not use PayPal' }, 400, requestOrigin)
      }

      const result = await reconcileSingleOrder(adminClient, orderId)

      return paypalJsonResponse({
        success: true,
        scope: 'order',
        result,
      }, 200, requestOrigin)
    }

    if (orderId) {
      const result = await reconcileSingleOrder(adminClient, orderId)
      return paypalJsonResponse({ success: true, scope: 'order', result }, 200, requestOrigin)
    }

    const { data: pendingPayments, error: pendingError } = await adminClient
      .from('payments')
      .select('id, order_id, transaction_id, status, created_at, updated_at')
      .eq('payment_method', 'paypal')
      .in('status', ['pending', 'processing'])
      .not('transaction_id', 'is', null)
      .order('updated_at', { ascending: true, nullsFirst: true })
      .limit(limit)

    if (pendingError) {
      throw pendingError
    }

    const minimumAgeMs = olderThanMinutes * 60 * 1000
    const summary = {
      processed: 0,
      captured: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      skipped: 0,
      errors: 0,
    }
    const results = []

    for (const payment of (pendingPayments || []) as PendingPaymentRow[]) {
      if (!payment.transaction_id || !isOlderThanThreshold(payment, minimumAgeMs)) {
        summary.skipped += 1
        continue
      }

      try {
        const result = await reconcilePayPalOrder({
          paypalOrderId: payment.transaction_id,
          adminClient,
        })

        summary.processed += 1
        if (result.action === 'captured') {
          summary.captured += 1
        }

        switch (result.persistedState.paymentStatus) {
          case 'completed':
            summary.completed += 1
            break
          case 'failed':
            summary.failed += 1
            break
          default:
            summary.pending += 1
            break
        }

        results.push({
          orderId: payment.order_id,
          paymentId: payment.id,
          paypalOrderId: payment.transaction_id,
          ...result,
        })
      } catch (error) {
        summary.errors += 1
        results.push({
          orderId: payment.order_id,
          paymentId: payment.id,
          paypalOrderId: payment.transaction_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return paypalJsonResponse({
      success: true,
      scope: 'batch',
      limit,
      olderThanMinutes,
      summary,
      results,
      ran_at: new Date().toISOString(),
    }, 200, requestOrigin)
  } catch (error) {
    return paypalJsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500, requestOrigin)
  }
})