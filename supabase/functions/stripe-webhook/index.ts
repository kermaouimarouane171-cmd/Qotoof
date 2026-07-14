// ============================================
// Supabase Edge Function: stripe-webhook
// Handles Stripe webhook events for:
//   1. Subscription management (vendor plans)
//   2. Marketplace order payments (buyer checkout → payout records created)
//   3. Refund processing
// Note: Morocco is not supported by Stripe Connect, so vendor/driver
// payouts are recorded as pending and processed via Global Payouts
// (see process-stripe-payouts Edge Function).
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

      // ============================================
      // Marketplace: Checkout session completed (buyer paid)
      // ============================================
      case 'checkout.session.completed': {
        const session = event.data.object

        // Only process marketplace payments (not subscriptions)
        const orderId = session.metadata?.order_id
        if (!orderId) {
          console.log('checkout.session.completed: no order_id in metadata, skipping (likely subscription)')
          break
        }

        const orderNumber = session.metadata?.order_number || ''
        const vendorId = session.metadata?.vendor_id || ''
        const driverId = session.metadata?.driver_id || ''
        const vendorAmount = Number(session.metadata?.vendor_amount || 0)
        const driverAmount = Number(session.metadata?.driver_amount || 0)

        const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || ''

        console.log(`Marketplace payment completed: order=${orderNumber}, vendor=${vendorId}, driver=${driverId}`)

        // 1. Update order status to paid
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({
            payment_status: 'paid',
            stripe_payment_intent_id: paymentIntentId,
            stripe_charge_id: session.payment_intent?.latest_charge || null,
            status: 'paid',
          })
          .eq('id', orderId)

        if (orderUpdateError) {
          console.error('Failed to update order payment_status:', orderUpdateError.message)
        }

        // 2. Update payment record
        await supabase
          .from('payments')
          .update({
            status: 'paid',
            stripe_payment_intent_id: paymentIntentId,
            paid_at: new Date().toISOString(),
          })
          .eq('order_id', orderId)
          .maybeSingle()

        // 3. Create pending payout records for vendor and driver.
        // These will be processed by the process-stripe-payouts function
        // via Stripe Global Payouts to Moroccan bank accounts.
        try {
          const { data: existingPayout } = await supabase
            .from('payout_records')
            .select('id')
            .eq('order_id', orderId)
            .maybeSingle()

          if (!existingPayout) {
            const payoutInserts: Array<Record<string, unknown>> = []

            if (vendorId && vendorAmount > 0) {
              payoutInserts.push({
                order_id: orderId,
                recipient_id: vendorId,
                recipient_type: 'vendor',
                amount: vendorAmount,
                currency: 'MAD',
                status: 'pending',
                payment_method: 'bank_transfer',
                stripe_payment_intent_id: paymentIntentId,
              })
            }

            if (driverId && driverAmount > 0) {
              payoutInserts.push({
                order_id: orderId,
                recipient_id: driverId,
                recipient_type: 'driver',
                amount: driverAmount,
                currency: 'MAD',
                status: 'pending',
                payment_method: 'bank_transfer',
                stripe_payment_intent_id: paymentIntentId,
              })
            }

            if (payoutInserts.length > 0) {
              await supabase.from('payout_records').insert(payoutInserts)
              console.log(`Created ${payoutInserts.length} pending payout records for order ${orderNumber}`)
            }
          }
        } catch (payoutError) {
          console.error('Failed to create payout records:', (payoutError as Error).message)
        }

        // 4. Record platform commission
        try {
          const { data: existingCommission } = await supabase
            .from('platform_commissions')
            .select('id')
            .eq('order_id', orderId)
            .maybeSingle()

          if (!existingCommission) {
            const totalAmount = Number(session.amount_total || 0) / 100
            const platformCommission = totalAmount - vendorAmount - driverAmount

            await supabase.from('platform_commissions').insert({
              order_id: orderId,
              buyer_id: session.metadata?.buyer_id || null,
              vendor_id: vendorId || null,
              driver_id: driverId || null,
              subtotal: totalAmount,
              vendor_amount: vendorAmount,
              driver_amount: driverAmount,
              platform_commission: platformCommission,
              status: 'collected',
              collected_at: new Date().toISOString(),
            })
          }
        } catch (commissionError) {
          console.error('Failed to record platform commission:', (commissionError as Error).message)
        }

        console.log(`Marketplace order ${orderNumber} marked as paid`)
        break
      }

      // ============================================
      // Marketplace: Payment failed
      // ============================================
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object
        const orderId = session.metadata?.order_id
        if (!orderId) break

        await supabase
          .from('orders')
          .update({ payment_status: 'failed' })
          .eq('id', orderId)

        console.log(`Marketplace order payment failed: ${orderId}`)
        break
      }

      // ============================================
      // Refund processed
      // ============================================
      case 'charge.refunded': {
        const charge = event.data.object
        const paymentIntentId = charge.payment_intent as string
        if (!paymentIntentId) break

        // Find order by payment intent ID
        const { data: order } = await supabase
          .from('orders')
          .select('id, order_number, payment_status')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle()

        if (!order) break

        const isFullRefund = charge.amount_refunded >= charge.amount
        await supabase
          .from('orders')
          .update({
            payment_status: isFullRefund ? 'refunded' : 'partial_refund',
            status: isFullRefund ? 'cancelled' : order.status === 'paid' ? 'paid' : order.status,
          })
          .eq('id', order.id)

        console.log(`Order ${order.order_number} refund processed: ${isFullRefund ? 'full' : 'partial'}`)
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
