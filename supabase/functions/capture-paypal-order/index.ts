import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  capturePayPalOrder,
  extractPayPalCaptures,
  getPayPalAccessToken,
  paypalCorsHeaders,
  paypalJsonResponse,
  persistPayPalOrderState,
} from '../_shared/paypalCheckout.ts'
import { requireRole } from '../_shared/auth.ts'

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: paypalCorsHeaders(req.headers.get('Origin')) })
    }

    if (req.method !== 'POST') {
      return paypalJsonResponse({ error: 'Method not allowed' }, 405, req.headers.get('Origin'))
    }

    // API-002: Verify authenticated buyer role before proceeding
    try {
      await requireRole(req, ['buyer'])
    } catch (error) {
      if (error instanceof Response) {
        const status = error.status
        const message = status === 401 ? 'Authentication required' : 'Access restricted to buyers only'
        return paypalJsonResponse({ error: message }, status, req.headers.get('Origin'))
      }
      return paypalJsonResponse({ error: 'Authentication required' }, 401, req.headers.get('Origin'))
    }

    const { orderId } = await req.json()

    if (!orderId) {
      return paypalJsonResponse({ error: 'Missing required field: orderId' }, 400, req.headers.get('Origin'))
    }

    // ── Idempotency guard ──────────────────────────────────────────────
    // Check if this PayPal order was already captured and persisted.
    // If a completed payment record exists, return the cached result
    // instead of calling PayPal capture API again.
    // This prevents duplicate captures on double-click, page refresh,
    // repeated callback, or retry after success.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (supabaseUrl && serviceRoleKey) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey)

      // Check 1: payment record with transaction_id = orderId and status = completed
      const { data: existingPayment } = await adminClient
        .from('payments')
        .select('id, order_id, status, transaction_id')
        .eq('transaction_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingPayment?.status === 'completed') {
        return paypalJsonResponse(
          {
            id: orderId,
            status: 'COMPLETED',
            captures: [],
            paymentId: existingPayment.id,
            internalOrderId: existingPayment.order_id,
            paymentStatus: 'completed',
            orderPaymentStatus: 'paid',
            idempotent: true,
          },
          200,
          req.headers.get('Origin')
        )
      }

      // Check 2: order with payment_intent_id = orderId and payment_status = paid
      // Covers edge case where payment record transaction_id wasn't set
      // but order was already marked as paid by persistPayPalOrderState
      const { data: existingOrder } = await adminClient
        .from('orders')
        .select('id, payment_status, payment_intent_id')
        .eq('payment_intent_id', orderId)
        .eq('payment_status', 'paid')
        .limit(1)
        .maybeSingle()

      if (existingOrder?.id) {
        return paypalJsonResponse(
          {
            id: orderId,
            status: 'COMPLETED',
            captures: [],
            paymentId: existingPayment?.id || null,
            internalOrderId: existingOrder.id,
            paymentStatus: 'completed',
            orderPaymentStatus: 'paid',
            idempotent: true,
          },
          200,
          req.headers.get('Origin')
        )
      }
    }

    const token = await getPayPalAccessToken()
    const captureResult = await capturePayPalOrder(token, orderId)
    const captures = extractPayPalCaptures(captureResult)
    const persistedState = await persistPayPalOrderState({
      paypalOrderId: orderId,
      paypalOrderData: captureResult,
    })

    return paypalJsonResponse(
      {
        id: captureResult?.id,
        status: captureResult?.status,
        captures,
        paymentId: persistedState.paymentId,
        internalOrderId: persistedState.internalOrderId,
        paymentStatus: persistedState.paymentStatus,
        orderPaymentStatus: persistedState.orderPaymentStatus,
      },
      200,
      req.headers.get('Origin')
    )
  } catch (error) {
    // FG-004: Log full error server-side; return generic message to the buyer.
    console.error('capture-paypal-order error:', error)
    return paypalJsonResponse({ error: 'Could not capture PayPal payment' }, 500, req.headers.get('Origin'))
  }
})
