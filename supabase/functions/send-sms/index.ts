import { serve } from 'https://deno.land/std@0.200.0/http/server.ts'

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
const TWILIO_FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER')
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const rateLimit = new Map<string, { count: number; resetAt: number }>()

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    const forwardedFor = req.headers.get('x-forwarded-for') || ''
    const clientIp = forwardedFor.split(',')[0]?.trim() || 'unknown'
    const now = Date.now()
    const currentRate = rateLimit.get(clientIp)

    if (!currentRate || now > currentRate.resetAt) {
      rateLimit.set(clientIp, { count: 1, resetAt: now + 60_000 })
    } else {
      currentRate.count += 1
      if (currentRate.count > 20) {
        return jsonResponse({ error: 'Too many requests, try again later' }, 429)
      }
    }

    const { to, message } = await req.json()

    if (!to || !message) {
      return jsonResponse({ error: 'Missing required fields: to, message' }, 400)
    }

    if (typeof to !== 'string' || !to.startsWith('+')) {
      return jsonResponse({ error: 'Invalid phone number format' }, 400)
    }

    if (typeof message !== 'string' || message.length > 600) {
      return jsonResponse({ error: 'Invalid message body' }, 400)
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_FROM_NUMBER)) {
      return jsonResponse({ error: 'Twilio environment variables are not configured' }, 503)
    }

    const payload = new URLSearchParams()
    payload.set('To', to)
    payload.set('Body', message)

    if (TWILIO_MESSAGING_SERVICE_SID) {
      payload.set('MessagingServiceSid', TWILIO_MESSAGING_SERVICE_SID)
    } else if (TWILIO_FROM_NUMBER) {
      payload.set('From', TWILIO_FROM_NUMBER)
    }

    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
      }
    )

    const result = await response.json()
    if (!response.ok) {
      return jsonResponse({ error: result?.message || 'Failed to send SMS' }, response.status)
    }

    return jsonResponse({ success: true, sid: result.sid }, 200)
  } catch (error) {
    return jsonResponse({ error: error?.message || 'Failed to send SMS' }, 500)
  }
})