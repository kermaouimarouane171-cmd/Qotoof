import { serve } from 'https://deno.land/std@0.200.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enforceServerRateLimit, getClientIp, json, jsonHeaders } from '../_shared/serverRateLimit.ts'

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
const TWILIO_FROM_NUMBER = Deno.env.get('TWILIO_FROM_NUMBER')
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const SMS_REQUEST_LIMIT = {
  maxAttempts: 20,
  windowSeconds: 60,
  blockSeconds: 60,
}

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: jsonHeaders })
    }

    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405)
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: 'Supabase environment variables are not configured' }, 500)
    }

    const clientIp = getClientIp(req)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const rateLimitResult = await enforceServerRateLimit({
      supabase,
      scope: 'send_sms_request',
      identifierParts: ['send-sms', clientIp],
      maxAttempts: SMS_REQUEST_LIMIT.maxAttempts,
      windowSeconds: SMS_REQUEST_LIMIT.windowSeconds,
      blockSeconds: SMS_REQUEST_LIMIT.blockSeconds,
    })

    if (!rateLimitResult.allowed) {
      return json(
        { error: 'Too many requests, try again later' },
        429,
        { 'Retry-After': String(rateLimitResult.retry_after_seconds || SMS_REQUEST_LIMIT.blockSeconds) },
      )
    }

    const { to, message } = await req.json()

    if (!to || !message) {
      return json({ error: 'Missing required fields: to, message' }, 400)
    }

    if (typeof to !== 'string' || !to.startsWith('+')) {
      return json({ error: 'Invalid phone number format' }, 400)
    }

    if (typeof message !== 'string' || message.length > 600) {
      return json({ error: 'Invalid message body' }, 400)
    }

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_FROM_NUMBER)) {
      return json({ error: 'Twilio environment variables are not configured' }, 503)
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
      return json({ error: result?.message || 'Failed to send SMS' }, response.status)
    }

    return json({ success: true, sid: result.sid }, 200)
  } catch (error) {
    return json({ error: error?.message || 'Failed to send SMS' }, 500)
  }
})