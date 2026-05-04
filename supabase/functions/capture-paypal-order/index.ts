import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const PAYPAL_CLIENT_ID = Deno.env.get('VITE_PAYPAL_CLIENT_ID')
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET')
const PAYPAL_API_BASE = Deno.env.get('PAYPAL_API_BASE') || (Deno.env.get('VITE_PAYMENT_MODE') === 'production' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com')

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

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    const { orderId } = await req.json()

    if (!orderId) {
      return jsonResponse({ error: 'Missing required field: orderId' }, 400)
    }

    const token = await getAccessToken()

    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: '{}',
    })

    const captureResult = await response.json()

    if (!response.ok) {
      return jsonResponse(
        { error: captureResult?.message || 'Failed to capture PayPal order', details: captureResult?.details || null },
        response.status
      )
    }

    const captures = captureResult?.purchase_units?.flatMap((unit: { payments?: { captures?: Array<{ id?: string; status?: string; amount?: { value?: string; currency_code?: string } }> } }) => unit?.payments?.captures || []) || []

    return jsonResponse(
      {
        id: captureResult?.id,
        status: captureResult?.status,
        captures,
      },
      200
    )
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
