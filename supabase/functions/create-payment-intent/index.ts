// Supabase Edge Function: create-payment-intent
// Creates Stripe payment intents for the subscription/billing surface, not marketplace checkout.
// Deploy: supabase functions deploy create-payment-intent

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    if (!STRIPE_SECRET_KEY) {
      return new Response(
        JSON.stringify({ error: 'Stripe not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const { orderId, amount, currency, customer, metadata } = await req.json()

    if (!orderId || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: orderId, amount' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create Stripe payment intent
    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        amount: amount.toString(),
        currency: currency || 'mad',
        metadata: JSON.stringify({
          orderId,
          platform: 'qotoof',
          ...metadata,
        }),
        ...(customer?.email ? { receipt_email: customer.email } : {}),
        automatic_payment_methods: JSON.stringify({ enabled: true }),
      }),
    })

    const paymentIntent = await response.json()

    if (!response.ok) {
      throw new Error(paymentIntent.error?.message || 'Failed to create payment intent')
    }

    // Update payment record in Supabase
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      
      await supabase
        .from('payments')
        .update({
          payment_intent_id: paymentIntent.id,
          gateway_response: paymentIntent,
        })
        .eq('order_id', orderId)
    }

    return new Response(
      JSON.stringify({
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
