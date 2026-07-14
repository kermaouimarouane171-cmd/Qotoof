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

// Security: Restrict CORS to known frontend origins only
const ALLOWED_ORIGINS = [
  Deno.env.get('VITE_APP_URL') || '',
  Deno.env.get('FRONTEND_APP_URL') || '',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean)

// Security: Rate limiting — max 10 payouts per hour per user
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 10
const payoutTimestamps = new Map<string, number[]>()

// Security: Maximum payout amount (50,000 MAD equivalent in EUR ~ 4,600 EUR)
const MAX_PAYOUT_AMOUNT = 5000
const MIN_PAYOUT_AMOUNT = 1

const getCorsHeaders = (requestOrigin: string | null) => {
  const origin = requestOrigin || ''
  const isAllowed = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

const jsonResponse = (body: unknown, status = 200, requestOrigin: string | null = null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(requestOrigin),
    },
  })

// Security: Rate limit check
const checkRateLimit = (userId: string): boolean => {
  const now = Date.now()
  const timestamps = payoutTimestamps.get(userId) || []
  const recentTimestamps = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS)

  if (recentTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false // Rate limit exceeded
  }

  recentTimestamps.push(now)
  payoutTimestamps.set(userId, recentTimestamps)
  return true
}

// Security: Clean up old rate limit entries periodically
const cleanupRateLimit = () => {
  const now = Date.now()
  for (const [userId, timestamps] of payoutTimestamps.entries()) {
    const recent = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS)
    if (recent.length === 0) {
      payoutTimestamps.delete(userId)
    } else {
      payoutTimestamps.set(userId, recent)
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupRateLimit, 10 * 60 * 1000)

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

// Security: Validate PayPal email format
const isValidPayPalEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

serve(async (req) => {
  const requestOrigin = req.headers.get('origin')
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: getCorsHeaders(requestOrigin) })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method not allowed' }, 405, requestOrigin)
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ success: false, error: 'Supabase configuration missing' }, 500, requestOrigin)
    }

    // Security: Verify dispatch secret
    const authHeader = req.headers.get('authorization') || ''
    if (!PAYOUT_DISPATCH_SECRET || authHeader !== `Bearer ${PAYOUT_DISPATCH_SECRET}`) {
      return jsonResponse({ success: false, error: 'Unauthorized payout dispatch' }, 401, requestOrigin)
    }

    const { user_id: userId, amount, currency = 'EUR', source = 'manual' } = await req.json()

    if (!userId || !amount) {
      return jsonResponse({ success: false, error: 'Missing required fields: user_id, amount' }, 400, requestOrigin)
    }

    const numericAmount = Number(amount)

    // Security: Validate amount bounds
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return jsonResponse({ success: false, error: 'Invalid amount' }, 400, requestOrigin)
    }

    if (numericAmount < MIN_PAYOUT_AMOUNT) {
      return jsonResponse({
        success: false,
        error: `Minimum payout amount is ${MIN_PAYOUT_AMOUNT} ${currency}`,
      }, 400, requestOrigin)
    }

    if (numericAmount > MAX_PAYOUT_AMOUNT) {
      return jsonResponse({
        success: false,
        error: `Maximum payout amount is ${MAX_PAYOUT_AMOUNT} ${currency}. Contact admin for larger payouts.`,
      }, 400, requestOrigin)
    }

    // Security: Rate limiting
    if (!checkRateLimit(userId)) {
      return jsonResponse({
        success: false,
        error: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} payouts per hour.`,
      }, 429, requestOrigin)
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role, paypal_email, paypal_verified, payout_method, first_name, last_name')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) throw profileError
    if (!profile) {
      return jsonResponse({ success: false, error: 'Recipient profile not found' }, 404, requestOrigin)
    }

    if (!['vendor', 'driver'].includes(profile.role)) {
      return jsonResponse({ success: false, error: 'Payout recipient must be vendor or driver' }, 400, requestOrigin)
    }

    // Security: Validate PayPal email format
    if (!isValidPayPalEmail(profile.paypal_email)) {
      return jsonResponse({
        success: false,
        error: 'Recipient PayPal email is invalid or missing',
      }, 400, requestOrigin)
    }

    // Security: Require verified PayPal account
    if (profile.paypal_verified !== true) {
      return jsonResponse({
        success: false,
        error: 'Recipient PayPal account is not verified. Please complete PayPal verification first.',
      }, 400, requestOrigin)
    }

    if ((profile.payout_method || 'paypal') !== 'paypal') {
      return jsonResponse({ success: false, error: 'Only PayPal payout_method is currently supported' }, 400, requestOrigin)
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
      }, 502, requestOrigin)
    }

    return jsonResponse({
      success: true,
      payout: payoutRow,
      paypal_batch_id: payoutResult?.batch_header?.payout_batch_id || null,
    }, 200, requestOrigin)
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown send-payout error',
    }, 500, requestOrigin)
  }
})
