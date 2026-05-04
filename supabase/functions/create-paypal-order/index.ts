import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const PAYPAL_CLIENT_ID = Deno.env.get('VITE_PAYPAL_CLIENT_ID')
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET')
const PAYPAL_MERCHANT_EMAIL = (Deno.env.get('PAYPAL_MERCHANT_EMAIL') || '').trim()
const PAYPAL_API_BASE = Deno.env.get('PAYPAL_API_BASE') || (Deno.env.get('VITE_PAYMENT_MODE') === 'production' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com')
const PAYPAL_SETTLEMENT_CURRENCY = (Deno.env.get('PAYPAL_SETTLEMENT_CURRENCY') || Deno.env.get('VITE_PAYPAL_SETTLEMENT_CURRENCY') || 'EUR').toUpperCase()
const PAYPAL_MAD_EXCHANGE_RATE = Number(Deno.env.get('PAYPAL_MAD_EXCHANGE_RATE') || '0.092')

const PAYPAL_SUPPORTED_CURRENCIES = new Set([
  'AUD', 'BRL', 'CAD', 'CZK', 'DKK', 'EUR', 'HKD', 'HUF', 'ILS', 'JPY',
  'MXN', 'TWD', 'NZD', 'NOK', 'PHP', 'PLN', 'GBP', 'SGD', 'SEK', 'CHF',
  'THB', 'USD',
])

const resolveSettlementAmount = (amount: number, currency: string) => {
  const normalizedCurrency = String(currency || 'MAD').toUpperCase()
  const numericAmount = Number(amount || 0)

  if (!numericAmount || Number.isNaN(numericAmount)) {
    throw new Error('Invalid PayPal amount')
  }

  if (PAYPAL_SUPPORTED_CURRENCIES.has(normalizedCurrency)) {
    return {
      requestCurrency: normalizedCurrency,
      requestValue: numericAmount.toFixed(2),
      originalCurrency: normalizedCurrency,
      originalValue: numericAmount.toFixed(2),
    }
  }

  if (normalizedCurrency === 'MAD' && PAYPAL_SUPPORTED_CURRENCIES.has(PAYPAL_SETTLEMENT_CURRENCY)) {
    const convertedValue = Number((numericAmount * PAYPAL_MAD_EXCHANGE_RATE).toFixed(2))
    if (convertedValue <= 0) {
      throw new Error('Converted PayPal amount is invalid')
    }

    return {
      requestCurrency: PAYPAL_SETTLEMENT_CURRENCY,
      requestValue: convertedValue.toFixed(2),
      originalCurrency: normalizedCurrency,
      originalValue: numericAmount.toFixed(2),
    }
  }

  throw new Error(`PayPal does not support currency ${normalizedCurrency}`)
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

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    const { orderId, amount, currency = 'MAD', customer, metadata, returnUrl, cancelUrl } = await req.json()

    if (!orderId || !amount) {
      return jsonResponse({ error: 'Missing required fields: orderId, amount' }, 400)
    }

    const token = await getAccessToken()
    const settlement = resolveSettlementAmount(Number(amount), currency)

    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: orderId,
            custom_id: orderId,
            description: 'Qotoof marketplace order payment',
            amount: {
              currency_code: settlement.requestCurrency,
              value: settlement.requestValue,
            },
            payee: PAYPAL_MERCHANT_EMAIL ? { email_address: PAYPAL_MERCHANT_EMAIL } : undefined,
          },
        ],
        application_context: {
          user_action: 'PAY_NOW',
          return_url: returnUrl || `${new URL(req.url).origin}/payment/success`,
          cancel_url: cancelUrl || `${new URL(req.url).origin}/payment/failed`,
          brand_name: 'Qotoof',
        },
        metadata: {
          ...(metadata || {}),
          platform: 'qotoof',
          orderId,
        },
      }),
    })

    const paypalOrder = await response.json()

    if (!response.ok) {
      return jsonResponse(
        { error: paypalOrder?.message || 'Failed to create PayPal order', details: paypalOrder?.details || null },
        response.status
      )
    }

    const approvalUrl = paypalOrder?.links?.find((link: { rel?: string; href?: string }) => link?.rel === 'approve')?.href || null

    return jsonResponse(
      {
        orderId: paypalOrder?.id,
        status: paypalOrder?.status,
        approvalUrl,
        currency: settlement.requestCurrency,
        amount: settlement.requestValue,
        originalCurrency: settlement.originalCurrency,
        originalAmount: settlement.originalValue,
      },
      200
    )
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
