import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'
import { withRetry } from '@/utils/withRetry'

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
import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'))
const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

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
        await supabase.from('payments')
          .update({ status: 'succeeded', paid_at: new Date().toISOString() })
          .eq('stripe_payment_intent_id', pi.id)
        await supabase.from('orders')
          .update({ status: 'confirmed', payment_status: 'paid' })
          .eq('stripe_payment_intent_id', pi.id)
        await supabase.from('audit_logs').insert({ action: 'payment_succeeded', entity_type: 'payment', entity_id: pi.id, metadata: { amount: pi.amount } })
        break
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object
        await supabase.from('payments').update({ status: 'failed', failure_reason: pi.last_payment_error?.message }).eq('stripe_payment_intent_id', pi.id)
        await supabase.from('orders').update({ status: 'payment_failed', payment_status: 'failed' }).eq('stripe_payment_intent_id', pi.id)
        break
      }
      case 'charge.refunded': {
        const charge = event.data.object
        await supabase.from('payments').update({ status: 'refunded', refunded_at: new Date().toISOString() }).eq('stripe_charge_id', charge.id)
        await supabase.from('orders').update({ status: 'refunded' }).eq('stripe_charge_id', charge.id)
        break
      }
      case 'dispute.created': {
        const dispute = event.data.object
        await supabase.from('audit_logs').insert({ action: 'dispute_created', entity_type: 'payment', entity_id: dispute.charge, metadata: { reason: dispute.reason, amount: dispute.amount } })
        break
      }
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
`

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
