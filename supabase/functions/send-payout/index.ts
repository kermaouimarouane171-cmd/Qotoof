import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const PAYPAL_CLIENT_ID = Deno.env.get('VITE_PAYPAL_CLIENT_ID') || ''
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET') || ''
const PAYPAL_API_BASE = Deno.env.get('PAYPAL_API_BASE')
  || (Deno.env.get('VITE_PAYMENT_MODE') === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com')
const PAYOUT_DISPATCH_SECRET = Deno.env.get('PAYOUT_DISPATCH_SECRET') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })

const getAccessToken = async () => {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials are not configured')
  }

  const credentials = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const data = await response.json()
  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || 'Unable to get PayPal access token')
  }

  return data.access_token as string
}

const createBatchId = () => `qotoof-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method not allowed' }, 405)
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ success: false, error: 'Supabase configuration missing' }, 500)
    }

    const authHeader = req.headers.get('authorization') || ''
    if (!PAYOUT_DISPATCH_SECRET || authHeader !== `Bearer ${PAYOUT_DISPATCH_SECRET}`) {
      return jsonResponse({ success: false, error: 'Unauthorized payout dispatch' }, 401)
    }

    const { user_id: userId, amount, currency = 'EUR', source = 'manual' } = await req.json()

    if (!userId || !amount) {
      return jsonResponse({ success: false, error: 'Missing required fields: user_id, amount' }, 400)
    }

    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return jsonResponse({ success: false, error: 'Invalid amount' }, 400)
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role, paypal_email, paypal_verified, payout_method')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) throw profileError
    if (!profile) {
      return jsonResponse({ success: false, error: 'Recipient profile not found' }, 404)
    }

    if (!['vendor', 'driver'].includes(profile.role)) {
      return jsonResponse({ success: false, error: 'Payout recipient must be vendor or driver' }, 400)
    }

    if (!profile.paypal_email || profile.paypal_verified !== true) {
      return jsonResponse({ success: false, error: 'Recipient PayPal account is not verified' }, 400)
    }

    if ((profile.payout_method || 'paypal') !== 'paypal') {
      return jsonResponse({ success: false, error: 'Only PayPal payout_method is currently supported' }, 400)
    }

    const accessToken = await getAccessToken()
    const senderBatchId = createBatchId()

    const paypalResponse = await fetch(`${PAYPAL_API_BASE}/v1/payments/payouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender_batch_header: {
          sender_batch_id: senderBatchId,
          email_subject: 'You have a payout from Qotoof',
          email_message: 'Qotoof marketplace payout is now available in your PayPal account.',
        },
        items: [
          {
            recipient_type: 'EMAIL',
            amount: {
              value: numericAmount.toFixed(2),
              currency: String(currency).toUpperCase(),
            },
            receiver: profile.paypal_email,
            note: `Qotoof payout (${source})`,
            sender_item_id: `${userId}-${Date.now()}`,
          },
        ],
      }),
    })

    const payoutResult = await paypalResponse.json()

    const status = paypalResponse.ok ? 'processed' : 'failed'
    const transactionId = payoutResult?.batch_header?.payout_batch_id || payoutResult?.batch_header?.sender_batch_id || null

    const { data: payoutRow, error: payoutInsertError } = await adminClient
      .from('payouts')
      .insert({
        vendor_id: userId,
        amount: numericAmount,
        currency: String(currency).toUpperCase(),
        payout_method: 'paypal',
        status,
        transaction_id: transactionId,
        notes: source,
        gateway_response: payoutResult,
        processed_at: new Date().toISOString(),
      })
      .select('id, status, transaction_id')
      .single()

    if (payoutInsertError) throw payoutInsertError

    if (!paypalResponse.ok) {
      return jsonResponse({
        success: false,
        error: payoutResult?.message || 'PayPal payout failed',
        payout: payoutRow,
      }, 502)
    }

    return jsonResponse({
      success: true,
      payout: payoutRow,
      paypal_batch_id: payoutResult?.batch_header?.payout_batch_id || null,
    })
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown send-payout error',
    }, 500)
  }
})
