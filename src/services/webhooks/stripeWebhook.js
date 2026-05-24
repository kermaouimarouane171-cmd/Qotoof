import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

/**
 * Stripe Webhook Handler
 * Legacy reference module only. Active marketplace checkout does not use Stripe order payments.
 * NOTE: In a Vite SPA, webhooks must be processed server-side.
 * This module provides:
 *  1. A Supabase Edge Function payload format (deploy to supabase/functions/stripe-webhook/)
 *  2. A client-side service that queries DB for payment status updates
 *  3. Utility to simulate events in dev mode
 */

// ─────────────────────────────────────────────────────────────────
// SUPABASE EDGE FUNCTION CODE (deploy as supabase/functions/stripe-webhook/index.ts)
// ─────────────────────────────────────────────────────────────────
export const STRIPE_EDGE_FUNCTION = `
import Stripe from 'https://esm.sh/stripe@latest'
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'))

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  
  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object
        // Delegate state transition to payment-status-write edge function
        // provider: 'stripe', status: 'succeeded', referenceId: pi.id
        break
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object
        // Delegate state transition to payment-status-write edge function
        // provider: 'stripe', status: 'failed', referenceId: pi.id
        break
      }
      case 'charge.refunded': {
        const charge = event.data.object
        // Delegate state transition to payment-status-write edge function
        // provider: 'stripe', status: 'refunded', referenceId: charge.id
        break
      }
      case 'dispute.created':
        break
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
`

/**
 * Secure payment state write through Edge Function.
 * Requires authenticated user; authorization is enforced server-side.
 */
export async function writeStripePaymentStatus({
  status,
  referenceId,
  orderId,
  failureReason,
}) {
  const { data, error } = await supabase.functions.invoke('payment-status-write', {
    body: {
      provider: 'stripe',
      status,
      referenceId,
      orderId,
      failureReason,
    },
  })

  if (error) {
    logger.error('[StripeWebhook] payment-status-write invoke error:', error)
    return { success: false, error: error.message || 'Edge function invocation failed' }
  }

  return data
}

// ─────────────────────────────────────────────────────────────────
// CLIENT-SIDE: Poll payment/order status after checkout
// ─────────────────────────────────────────────────────────────────

/**
 * Poll order payment status until confirmed or failed
 */
export async function pollPaymentStatus(orderId, { maxAttempts = 20, intervalMs = 3000 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, status, payment_status')
      .eq('id', orderId)
      .single()

    if (error) {
      logger.error('[StripeWebhook] Poll error:', error)
      break
    }

    if (data?.payment_status === 'paid' || data?.status === 'confirmed') {
      return { success: true, order: data }
    }

    if (data?.payment_status === 'failed' || data?.status === 'payment_failed') {
      return { success: false, order: data, error: 'Payment failed' }
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  return { success: false, error: 'Payment confirmation timeout' }
}

/**
 * Subscribe to real-time order payment updates via Supabase Realtime
 */
export function subscribeToPaymentUpdates(orderId, callback) {
  const channel = supabase
    .channel(`order-payment:${orderId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${orderId}`,
    }, (payload) => {
      const order = payload.new
      if (order.payment_status === 'paid') callback({ success: true, order })
      else if (order.payment_status === 'failed') callback({ success: false, order })
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}
