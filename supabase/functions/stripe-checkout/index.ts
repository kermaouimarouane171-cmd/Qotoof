// ============================================
// Supabase Edge Function: stripe-checkout
// Creates Stripe Checkout Sessions for subscriptions
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import Stripe from 'https://esm.sh/stripe@14.7.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    // Get auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return jsonResponse({ error: 'Invalid token' }, 401)
    }

    // Get request body
    const { planId, billingCycle, successUrl, cancelUrl } = await req.json()

    if (!planId || !successUrl || !cancelUrl) {
      return jsonResponse({ error: 'Missing required fields: planId, successUrl, cancelUrl' }, 400)
    }

    // Get vendor profile
    const { data: vendor, error: vendorError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (vendorError || !vendor) {
      return jsonResponse({ error: 'Vendor not found' }, 404)
    }

    // Get Stripe price ID for the plan
    const priceId = billingCycle === 'yearly'
      ? Deno.env.get(`STRIPE_PRICE_${planId.toUpperCase()}_YEARLY`)
      : Deno.env.get(`STRIPE_PRICE_${planId.toUpperCase()}_MONTHLY`)

    if (!priceId) {
      return jsonResponse({ error: `Price not found for plan: ${planId}` }, 400)
    }

    // Create or retrieve Stripe customer
    let customerId = vendor.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: vendor.email,
        name: `${vendor.first_name} ${vendor.last_name}`,
        metadata: {
          vendor_id: user.id,
        },
      })
      customerId = customer.id

      // Save customer ID
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        vendor_id: user.id,
        plan_id: planId,
        billing_cycle: billingCycle,
      },
      subscription_data: {
        metadata: {
          vendor_id: user.id,
          plan_id: planId,
        },
      },
    })

    return jsonResponse({ url: session.url, sessionId: session.id }, 200)
  } catch (error) {
    console.error('Checkout error:', error)
    return jsonResponse({ error: error.message || 'Checkout failed' }, 500)
  }
})
