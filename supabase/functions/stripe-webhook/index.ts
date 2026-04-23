// ============================================
// Supabase Edge Function: stripe-webhook
// Handles Stripe webhook events for subscription management
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import Stripe from 'https://esm.sh/stripe@14.7.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

serve(async (req) => {
  try {
    // Only handle POST requests
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    // Get the signature
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response('Missing stripe signature', { status: 400 })
    }

    // Get the raw body
    const body = await req.text()

    // Verify webhook signature
    let event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message)
      return new Response(`Webhook Error: ${err.message}`, { status: 400 })
    }

    console.log('Processing Stripe webhook:', event.type, event.id)

    // Handle different event types
    switch (event.type) {
      // ============================================
      // Payment succeeded
      // ============================================
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        const subscriptionId = invoice.subscription
        const customerId = invoice.customer

        if (!subscriptionId || !customerId) break

        // Get subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const planId = getPlanIdFromPriceId(subscription.items.data[0]?.price?.id)

        if (!planId) {
          console.error('Unknown price ID:', subscription.items.data[0]?.price?.id)
          break
        }

        // Update vendor subscription
        const { data: vendor } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!vendor) {
          console.error('Vendor not found for customer:', customerId)
          break
        }

        const periodEnd = new Date(subscription.current_period_end * 1000)

        await supabase
          .from('profiles')
          .update({
            subscription_plan: planId,
            subscription_status: 'active',
            subscription_end: periodEnd.toISOString(),
            grace_period_ends: null,
          })
          .eq('id', vendor.id)

        // Log in subscription history
        await supabase.from('subscription_history').insert({
          vendor_id: vendor.id,
          old_plan: null, // Will be set by trigger
          new_plan: planId,
          change_type: 'upgrade',
          amount: invoice.amount_paid / 100,
          stripe_event_id: event.id,
          reason: 'Payment succeeded',
        })

        // Create invoice record
        await supabase.from('invoices').insert({
          vendor_id: vendor.id,
          stripe_invoice_id: invoice.id,
          subscription_plan: planId,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency.toUpperCase(),
          status: 'paid',
          period_start: new Date(invoice.period_start * 1000).toISOString(),
          period_end: new Date(invoice.period_end * 1000).toISOString(),
          paid_at: new Date(invoice.status_transitions?.paid_at * 1000).toISOString(),
        })

        console.log('Subscription activated for vendor:', vendor.id, 'Plan:', planId)
        break
      }

      // ============================================
      // Payment failed
      // ============================================
      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subscriptionId = invoice.subscription
        const customerId = invoice.customer

        if (!subscriptionId || !customerId) break

        // Get vendor
        const { data: vendor } = await supabase
          .from('profiles')
          .select('id, subscription_plan')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!vendor) break

        // Set to past_due (not canceled yet — Stripe retries)
        await supabase
          .from('profiles')
          .update({ subscription_status: 'past_due' })
          .eq('id', vendor.id)

        // Create failed invoice record
        await supabase.from('invoices').insert({
          vendor_id: vendor.id,
          stripe_invoice_id: invoice.id,
          subscription_plan: vendor.subscription_plan,
          amount: invoice.amount_due / 100,
          currency: invoice.currency.toUpperCase(),
          status: 'failed',
          period_start: new Date(invoice.period_start * 1000).toISOString(),
          period_end: new Date(invoice.period_end * 1000).toISOString(),
        })

        console.log('Payment failed for vendor:', vendor.id)
        break
      }

      // ============================================
      // Subscription canceled
      // ============================================
      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const customerId = subscription.customer

        if (!customerId) break

        const { data: vendor } = await supabase
          .from('profiles')
          .select('id, subscription_plan')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!vendor) break

        // Start grace period (7 days)
        const graceEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

        await supabase
          .from('profiles')
          .update({
            subscription_status: 'grace_period',
            grace_period_ends: graceEnds.toISOString(),
          })
          .eq('id', vendor.id)

        // Log cancellation
        await supabase.from('subscription_history').insert({
          vendor_id: vendor.id,
          old_plan: vendor.subscription_plan,
          new_plan: vendor.subscription_plan,
          change_type: 'grace_period_start',
          stripe_event_id: event.id,
          reason: 'Subscription canceled, entering 7-day grace period',
        })

        console.log('Grace period started for vendor:', vendor.id)
        break
      }

      // ============================================
      // Subscription updated (plan change)
      // ============================================
      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const customerId = subscription.customer

        if (!customerId) break

        const { data: vendor } = await supabase
          .from('profiles')
          .select('id, subscription_plan')
          .eq('stripe_customer_id', customerId)
          .single()

        if (!vendor) break

        const newPlanId = getPlanIdFromPriceId(subscription.items.data[0]?.price?.id)
        if (!newPlanId) break

        const periodEnd = new Date(subscription.current_period_end * 1000)

        // Determine change type
        const changeType = newPlanId !== vendor.subscription_plan
          ? (getPlanTier(newPlanId) > getPlanTier(vendor.subscription_plan) ? 'upgrade' : 'downgrade')
          : 'upgrade'

        await supabase
          .from('profiles')
          .update({
            subscription_plan: newPlanId,
            subscription_status: 'active',
            subscription_end: periodEnd.toISOString(),
            grace_period_ends: null,
          })
          .eq('id', vendor.id)

        // Log change
        await supabase.from('subscription_history').insert({
          vendor_id: vendor.id,
          old_plan: vendor.subscription_plan,
          new_plan: newPlanId,
          change_type: changeType,
          stripe_event_id: event.id,
          reason: `Plan changed from ${vendor.subscription_plan} to ${newPlanId}`,
        })

        console.log('Subscription updated for vendor:', vendor.id, 'New plan:', newPlanId)
        break
      }

      default:
        console.log('Unhandled event type:', event.type)
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================
// Helper Functions
// ============================================

/**
 * Map Stripe price IDs to plan IDs
 */
function getPlanIdFromPriceId(priceId) {
  // These should be environment variables in production
  const priceMap = {
    [Deno.env.get('STRIPE_PRICE_BASIC_MONTHLY')]: 'basic',
    [Deno.env.get('STRIPE_PRICE_BASIC_YEARLY')]: 'basic',
    [Deno.env.get('STRIPE_PRICE_PRO_MONTHLY')]: 'professional',
    [Deno.env.get('STRIPE_PRICE_PRO_YEARLY')]: 'professional',
    [Deno.env.get('STRIPE_PRICE_ENT_MONTHLY')]: 'enterprise',
    [Deno.env.get('STRIPE_PRICE_ENT_YEARLY')]: 'enterprise',
  }
  return priceMap[priceId] || null
}

/**
 * Get plan tier number for comparison
 */
function getPlanTier(planId) {
  const tiers = { free: 0, basic: 1, professional: 2, enterprise: 3 }
  return tiers[planId] || 0
}
