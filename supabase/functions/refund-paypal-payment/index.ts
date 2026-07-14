import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const PAYPAL_CLIENT_ID = Deno.env.get('VITE_PAYPAL_CLIENT_ID')
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET')
const PAYPAL_API_BASE = Deno.env.get('PAYPAL_API_BASE') || (Deno.env.get('VITE_PAYMENT_MODE') === 'production' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com')
const PAYPAL_SETTLEMENT_CURRENCY = (Deno.env.get('PAYPAL_SETTLEMENT_CURRENCY') || Deno.env.get('VITE_PAYPAL_SETTLEMENT_CURRENCY') || 'EUR').toUpperCase()
const PAYPAL_MAD_EXCHANGE_RATE = Number(Deno.env.get('PAYPAL_MAD_EXCHANGE_RATE') || '0.092')

const PAYPAL_SUPPORTED_CURRENCIES = new Set([
  'AUD', 'BRL', 'CAD', 'CZK', 'DKK', 'EUR', 'HKD', 'HUF', 'ILS', 'JPY',
  'MXN', 'TWD', 'NZD', 'NOK', 'PHP', 'PLN', 'GBP', 'SGD', 'SEK', 'CHF',
  'THB', 'USD',
])

const resolveSettlementRefund = (amount?: number | null, currency = 'MAD') => {
  if (!amount) return undefined

  const normalizedCurrency = String(currency || 'MAD').toUpperCase()
  const numericAmount = Number(amount)
  if (!numericAmount || Number.isNaN(numericAmount)) return undefined

  if (PAYPAL_SUPPORTED_CURRENCIES.has(normalizedCurrency)) {
    return {
      currency_code: normalizedCurrency,
      value: numericAmount.toFixed(2),
    }
  }

  if (normalizedCurrency === 'MAD' && PAYPAL_SUPPORTED_CURRENCIES.has(PAYPAL_SETTLEMENT_CURRENCY)) {
    return {
      currency_code: PAYPAL_SETTLEMENT_CURRENCY,
      value: Number((numericAmount * PAYPAL_MAD_EXCHANGE_RATE).toFixed(2)).toFixed(2),
    }
  }

  return undefined
}

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

const resolveCaptureIdFromOrder = async (token: string, orderId: string) => {
  const orderResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  const orderData = await orderResponse.json()

  if (!orderResponse.ok) {
    throw new Error(orderData?.message || 'Failed to load PayPal order details')
  }

  const captureId = orderData?.purchase_units
    ?.flatMap((unit: { payments?: { captures?: Array<{ id?: string }> } }) => unit?.payments?.captures || [])
    ?.find((capture: { id?: string }) => Boolean(capture?.id))
    ?.id

  if (!captureId) {
    throw new Error('No capture id found for the provided PayPal order')
  }

  return captureId as string
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    const { orderId, captureId: payloadCaptureId, amount, reason = 'requested_by_customer', idempotencyId } = await req.json()

    if (!orderId && !payloadCaptureId) {
      return jsonResponse({ error: 'Missing required field: orderId or captureId' }, 400)
    }

    const token = await getAccessToken()
    const captureId = payloadCaptureId || await resolveCaptureIdFromOrder(token, orderId)

    // PayPal-Request-Id provides server-side idempotency for refund requests.
    // If the same ID is sent twice, PayPal returns the original refund instead of creating a duplicate.
    // Default to captureId so repeated calls for the same capture are naturally idempotent.
    const paypalRequestId = (typeof idempotencyId === 'string' && idempotencyId.trim())
      ? idempotencyId.trim()
      : `refund-${captureId}`

    const response = await fetch(`${PAYPAL_API_BASE}/v2/payments/captures/${captureId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        'PayPal-Request-Id': paypalRequestId,
      },
      body: JSON.stringify({
        amount: resolveSettlementRefund(amount, 'MAD'),
        note_to_payer: reason,
      }),
    })

    const refundResult = await response.json()

    if (!response.ok) {
      return jsonResponse(
        { error: refundResult?.message || 'Failed to refund PayPal capture', details: refundResult?.details || null },
        response.status
      )
    }

    return jsonResponse(
      {
        id: refundResult?.id,
        status: refundResult?.status,
        amount: refundResult?.amount || null,
      },
      200
    )
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
