// ============================================
// Supabase Edge Function: create-stripe-marketplace-checkout
// Creates a Stripe Checkout Session for marketplace orders.
// All funds go to the platform account (Morocco is not
// supported by Stripe Connect, so we cannot use transfer_data).
// Vendor and driver payouts to Moroccan bank accounts are
// processed separately via Global Payouts after payment succeeds.
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import Stripe from 'https://esm.sh/stripe@14.7.0?target=deno'
import { requireRole } from '../_shared/auth.ts'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const FRONTEND_APP_URL = (Deno.env.get('VITE_APP_URL') || Deno.env.get('FRONTEND_APP_URL') || '').trim().replace(/\/+$/g, '')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const json = (body: unknown, status = 200, req?: Request) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...(req ? getCorsHeaders(req.headers.get('Origin')) : {}), 'Content-Type': 'application/json' },
  })

// Convert MAD amount to cents (Stripe requires smallest currency unit)
const toCents = (amount: number) => Math.round(Number(amount) * 100)

serve(async (req) => {
  const optionsResponse = handleOptions(req)
  if (optionsResponse) return optionsResponse

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, req)
    }

    const auth = await requireRole(req, ['buyer'])
    const buyerId = auth.userId

    const body = await req.json()
    const { orderId, successUrl, cancelUrl } = body

    if (!orderId) {
      return json({ error: 'Missing required field: orderId' }, 400, req)
    }

    // 1. Fetch the order with all financial details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id, order_number, total, subtotal, shipping_cost, vendor_amount, driver_amount,
        buyer_commission, vendor_commission, driver_commission,
        vendor_id, driver_id, payment_type, payment_status, status,
        stripe_session_id, stripe_payment_intent_id
      `)
      .eq('id', orderId)
      .eq('buyer_id', buyerId)
      .single()

    if (orderError || !order) {
      return json({ error: 'Order not found or not owned by this buyer' }, 404, req)
    }

    // Check if already paid
    if (order.payment_status === 'paid') {
      return json({ error: 'Order is already paid' }, 400, req)
    }

    // Check if a Stripe session already exists and is still valid
    if (order.stripe_session_id) {
      try {
        const existingSession = await stripe.checkout.sessions.retrieve(order.stripe_session_id)
        if (existingSession.status === 'open') {
          return json({ url: existingSession.url, sessionId: existingSession.id }, 200, req)
        }
      } catch {
        // Session might be expired or invalid, proceed to create a new one
      }
    }

    // 2. Verify vendor exists (no Stripe Connect needed — payouts go to bank accounts)
    const { data: vendor, error: vendorError } = await supabase
      .from('profiles')
      .select('id, store_name')
      .eq('id', order.vendor_id)
      .single()

    if (vendorError || !vendor) {
      return json({ error: 'Vendor not found' }, 404, req)
    }

    // 3. Calculate amounts
    const totalAmount = Number(order.total) || 0
    const vendorAmount = Number(order.vendor_amount) || 0

    if (totalAmount <= 0) {
      return json({ error: 'Invalid order total' }, 400, req)
    }

    const totalCents = toCents(totalAmount)

    // 5. Build line items — single line representing the order total
    const lineItems = [
      {
        price_data: {
          currency: 'mad',
          product_data: {
            name: `طلب ${order.order_number}`,
            description: `منتجات + توصيل + عمولة المنصة`,
          },
          unit_amount: totalCents,
        },
        quantity: 1,
      },
    ]

    // 6. Create Stripe Checkout Session — all funds go to platform account.
    // Vendor/driver payouts to Moroccan bank accounts are processed via
    // Global Payouts after the order is confirmed (see process-stripe-payouts).
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      line_items: lineItems,
      success_url: successUrl || `${FRONTEND_APP_URL}/buyer/orders?stripe_success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${FRONTEND_APP_URL}/buyer/orders?stripe_cancel=1`,
      metadata: {
        order_id: String(order.id),
        order_number: order.order_number,
        buyer_id: buyerId,
        vendor_id: String(order.vendor_id),
        driver_id: order.driver_id ? String(order.driver_id) : '',
        vendor_amount: String(vendorAmount),
        driver_amount: String(order.driver_amount || 0),
      },
      payment_intent_data: {
        metadata: {
          order_id: String(order.id),
          order_number: order.order_number,
          buyer_id: buyerId,
          vendor_id: String(order.vendor_id),
          driver_id: order.driver_id ? String(order.driver_id) : '',
          vendor_amount: String(vendorAmount),
          driver_amount: String(order.driver_amount || 0),
        },
      },
      // Allow payment methods available in Morocco
      payment_method_types: ['card'],
      locale: 'ar',
      // Stripe Checkout page customization
      submit_type: 'pay',
      billing_address_collection: 'auto',
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    // 7. Save session ID to order
    await supabase
      .from('orders')
      .update({
        stripe_session_id: session.id,
      })
      .eq('id', order.id)

    // Also save to payments table if it exists
    await supabase
      .from('payments')
      .update({ stripe_session_id: session.id })
      .eq('order_id', order.id)
      .maybeSingle()

    return json({
      url: session.url,
      sessionId: session.id,
    }, 200, req)
  } catch (error) {
    console.error('create-stripe-marketplace-checkout error:', error)
    const status = (error as { status?: number }).status || 500
    return json(
      { error: (error as Error).message || 'Checkout creation failed' },
      status,
      req,
    )
  }
})
