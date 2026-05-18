import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enforceServerRateLimit, getClientIp, json, jsonHeaders } from '../_shared/serverRateLimit.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const OTP_EXPIRY_SECONDS = 5 * 60
const RESEND_WINDOW_SECONDS = 10 * 60
const RESEND_LIMIT = 3

const normalizePhone = (phone: string) => {
  const digits = String(phone || '').replace(/\D/g, '')

  if (digits.startsWith('212') && digits.length === 12) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 10) return `+212${digits.slice(1)}`
  if (digits.length === 9) return `+212${digits}`
  if (phone.startsWith('+')) return phone

  throw new Error('رقم الهاتف غير صالح')
}

const generateOtpCode = () => {
  const randomBuffer = new Uint32Array(1)
  crypto.getRandomValues(randomBuffer)
  return String((randomBuffer[0] % 900000) + 100000)
}

const hashOtpCode = async (otpCode: string) => {
  const encoded = new TextEncoder().encode(otpCode)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: jsonHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405)
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ success: false, error: 'Supabase configuration missing' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ success: false, error: 'Authentication required' }, 401)
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)

    if (authError || !user) {
      return json({ success: false, error: 'Invalid or expired token' }, 401)
    }

    const body = await req.json()
    const requestedUserId = typeof body?.userId === 'string' ? body.userId.trim() : ''
    const purpose = typeof body?.purpose === 'string' ? body.purpose.trim() : ''
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''

    if (requestedUserId && requestedUserId !== user.id) {
      return json({ success: false, error: 'You do not have access to this user context' }, 403)
    }

    if (!phone || !purpose) {
      return json({ success: false, error: 'Phone and purpose are required' }, 400)
    }

    const normalizedPhone = normalizePhone(phone)
    const clientIp = getClientIp(req)

    const rateLimitResult = await enforceServerRateLimit({
      supabase: adminClient,
      scope: 'request_phone_otp',
      identifierParts: ['request-phone-otp', user.id, normalizedPhone, purpose, clientIp],
      maxAttempts: RESEND_LIMIT,
      windowSeconds: RESEND_WINDOW_SECONDS,
      blockSeconds: RESEND_WINDOW_SECONDS,
    })

    if (!rateLimitResult.allowed) {
      return json(
        { success: false, error: 'تجاوزت الحد المسموح. انتظر 10 دقائق ثم أعد المحاولة.' },
        429,
        { 'Retry-After': String(rateLimitResult.retry_after_seconds || RESEND_WINDOW_SECONDS) },
      )
    }

    const { data: existingRequests, error: existingError } = await adminClient
      .from('phone_otp')
      .select('id')
      .eq('user_id', user.id)
      .eq('purpose', purpose)
      .eq('used', false)
      .gte('created_at', new Date(Date.now() - RESEND_WINDOW_SECONDS * 1000).toISOString())

    if (existingError) {
      throw existingError
    }

    if ((existingRequests || []).length >= RESEND_LIMIT) {
      return json({ success: false, error: 'تجاوزت الحد المسموح. انتظر 10 دقائق ثم أعد المحاولة.' }, 429)
    }

    const otpCode = generateOtpCode()
    const hashedOtpCode = await hashOtpCode(otpCode)
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000).toISOString()

    const { data: otpRecord, error: insertError } = await adminClient
      .from('phone_otp')
      .insert({
        user_id: user.id,
        phone: normalizedPhone,
        otp_code: hashedOtpCode,
        purpose,
        expires_at: expiresAt,
      })
      .select('id')
      .single()

    if (insertError || !otpRecord?.id) {
      throw insertError || new Error('Failed to create phone OTP')
    }

    const smsResponse = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: normalizedPhone,
        message: `Qotoof: رمز التحقق الخاص بك صالح لمدة 5 دقائق. لا تشاركه مع أحد. الرمز: ${otpCode}`,
      }),
    })

    const smsPayload = await smsResponse.json().catch(() => null)
    if (!smsResponse.ok || !smsPayload?.success) {
      await adminClient
        .from('phone_otp')
        .delete()
        .eq('id', otpRecord.id)

      throw new Error(smsPayload?.error || 'تعذر إرسال رمز التحقق حالياً')
    }

    return json({
      success: true,
      expires_in: OTP_EXPIRY_SECONDS,
      phone: normalizedPhone,
    })
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to request phone OTP',
    }, 500)
  }
})