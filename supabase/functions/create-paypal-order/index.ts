import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireRole } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { voidPayPalOrder } from '../_shared/paypalCheckout.ts'

const PAYPAL_CLIENT_ID = Deno.env.get('VITE_PAYPAL_CLIENT_ID')
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET')
const PAYPAL_MERCHANT_EMAIL = (Deno.env.get('PAYPAL_MERCHANT_EMAIL') || '').trim()
const PAYPAL_API_BASE = Deno.env.get('PAYPAL_API_BASE') || (Deno.env.get('VITE_PAYMENT_MODE') === 'production' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com')
const PAYPAL_SETTLEMENT_CURRENCY = (Deno.env.get('PAYPAL_SETTLEMENT_CURRENCY') || Deno.env.get('VITE_PAYPAL_SETTLEMENT_CURRENCY') || 'EUR').toUpperCase()
const PAYPAL_MAD_EXCHANGE_RATE = Number(Deno.env.get('PAYPAL_MAD_EXCHANGE_RATE') || '0.092')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const FRONTEND_APP_URL = (Deno.env.get('VITE_APP_URL') || Deno.env.get('FRONTEND_APP_URL') || '').trim().replace(/\/+$/g, '')

const buildAdminClient = () => createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

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

const jsonResponse = (body: unknown, status = 200, requestOrigin: string | null = null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(requestOrigin),
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
  const requestOrigin = req.headers.get('Origin')
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: getCorsHeaders(requestOrigin) })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, requestOrigin)
    }

    // API-002: Verify authenticated user role before proceeding
    // Allow buyers (for order payments) and vendors (for subscription upgrades)
    const { orderId, amount, currency = 'MAD', customer: _customer, metadata, returnUrl, cancelUrl } = await req.json()

    const isSubscription = metadata?.type === 'subscription'
    const allowedRoles = isSubscription ? ['buyer', 'vendor'] : ['buyer']

    let authResult: { userId: string; role: string } | null = null
    try {
      authResult = await requireRole(req, allowedRoles)
    } catch (error) {
      if (error instanceof Response) {
        const status = error.status
        const message = status === 401 ? 'Authentication required' : `Access restricted to ${allowedRoles.join(' or ')} only`
        return jsonResponse({ error: message }, status, requestOrigin)
      }
      return jsonResponse({ error: 'Authentication required' }, 401, requestOrigin)
    }

    if (!orderId || !amount) {
      return jsonResponse({ error: 'Missing required fields: orderId, amount' }, 400, requestOrigin)
    }

    // Prefer explicit frontend URLs; fall back to the configured frontend app URL.
    // Never use the Edge Function origin (Supabase URL) because PayPal would
    // redirect the buyer back to an invalid backend endpoint.
    const explicitReturnUrl = typeof returnUrl === 'string' && returnUrl.trim() ? returnUrl.trim() : null
    const explicitCancelUrl = typeof cancelUrl === 'string' && cancelUrl.trim() ? cancelUrl.trim() : null
    const safeReturnUrl = explicitReturnUrl || (FRONTEND_APP_URL ? `${FRONTEND_APP_URL}/order-confirmation/${orderId}?paypal=success` : null)
    const safeCancelUrl = explicitCancelUrl || (FRONTEND_APP_URL ? `${FRONTEND_APP_URL}/order-confirmation/${orderId}?paypal=cancel` : null)

    if (!safeReturnUrl || !safeCancelUrl) {
      return jsonResponse({ error: 'Missing PayPal return/cancel URL configuration. Provide returnUrl/cancelUrl or set VITE_APP_URL/FRONTEND_APP_URL secret.' }, 400, requestOrigin)
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
          return_url: safeReturnUrl,
          cancel_url: safeCancelUrl,
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
      // FG-004: Do not forward raw PayPal details to the buyer.
      console.error('PayPal create order error:', paypalOrder)
      return jsonResponse(
        { error: 'Failed to create PayPal order' },
        500,
        requestOrigin
      )
    }

    const approvalUrl = paypalOrder?.links?.find((link: { rel?: string; href?: string }) => link?.rel === 'approve')?.href || null

    // For subscription payments, skip storing in payments table (order_id is UUID, not string)
    // The webhook will handle subscription activation via the custom_id field
    if (!isSubscription && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && orderId) {
      try {
        const adminClient = buildAdminClient()
        const { data: paymentRecord } = await adminClient
          .from('payments')
          .select('id, transaction_id')
          .eq('order_id', orderId)
          .eq('payment_method', 'paypal')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        // FG-010: Best-effort void of the previous PayPal order before replacing it.
        const previousPayPalOrderId = paymentRecord?.transaction_id
        if (previousPayPalOrderId && previousPayPalOrderId !== paypalOrder?.id) {
          try {
            await voidPayPalOrder(token, previousPayPalOrderId)
          } catch (voidError) {
            console.error('create-paypal-order: failed to void previous PayPal order:', voidError)
          }
        }

        if (paymentRecord?.id) {
          await adminClient
            .from('payments')
            .update({
              transaction_id: paypalOrder?.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', paymentRecord.id)
        }
      } catch (dbError) {
        console.error('create-paypal-order: failed to persist transaction_id:', dbError)
      }
    }

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
      200,
      requestOrigin
    )
  } catch (error) {
    // FG-004: Log full error server-side, return generic message to the client.
    console.error('create-paypal-order error:', error)
    return jsonResponse({ error: 'Could not create PayPal order' }, 500, requestOrigin)
  }
})
