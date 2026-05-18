import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { json, jsonHeaders } from '../_shared/serverRateLimit.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const MAX_VERIFY_ATTEMPTS = 5

const normalizePhone = (phone: string) => {
  const digits = String(phone || '').replace(/\D/g, '')

  if (digits.startsWith('212') && digits.length === 12) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 10) return `+212${digits.slice(1)}`
  if (digits.length === 9) return `+212${digits}`
  if (phone.startsWith('+')) return phone

  throw new Error('رقم الهاتف غير صالح')
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
    const otpCode = typeof body?.otpCode === 'string' ? body.otpCode.trim() : ''

    if (requestedUserId && requestedUserId !== user.id) {
      return json({ success: false, error: 'You do not have access to this user context' }, 403)
    }

    if (!phone || !purpose || !otpCode) {
      return json({ success: false, error: 'Phone, purpose, and OTP code are required' }, 400)
    }

    const normalizedPhone = normalizePhone(phone)
    const { data: otpRecord, error: otpError } = await adminClient
      .from('phone_otp')
      .select('*')
      .eq('user_id', user.id)
      .eq('phone', normalizedPhone)
      .eq('purpose', purpose)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (otpError) {
      throw otpError
    }

    if (!otpRecord) {
      return json({ success: false, error: 'رمز التحقق منتهي أو غير صالح' }, 400)
    }

    if ((otpRecord.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
      return json({ success: false, error: 'تجاوزت محاولات التحقق. اطلب رمزاً جديداً.' }, 400)
    }

    const nextAttempts = (otpRecord.attempts || 0) + 1
    const hashedProvidedCode = await hashOtpCode(otpCode)

    const { error: attemptsError } = await adminClient
      .from('phone_otp')
      .update({
        attempts: nextAttempts,
      })
      .eq('id', otpRecord.id)

    if (attemptsError) {
      throw attemptsError
    }

    if (otpRecord.otp_code !== hashedProvidedCode) {
      if (nextAttempts >= MAX_VERIFY_ATTEMPTS) {
        return json({ success: false, error: 'تجاوزت محاولات التحقق. اطلب رمزاً جديداً.' }, 400)
      }

      return json({ success: false, error: `رمز غير صحيح. المحاولات المتبقية: ${MAX_VERIFY_ATTEMPTS - nextAttempts}` }, 400)
    }

    const nowIso = new Date().toISOString()
    const { error: markUsedError } = await adminClient
      .from('phone_otp')
      .update({
        used: true,
        used_at: nowIso,
        attempts: nextAttempts,
      })
      .eq('id', otpRecord.id)

    if (markUsedError) {
      throw markUsedError
    }

    if (purpose === 'registration' || purpose === 'change_phone') {
      const { error: profileError } = await adminClient
        .from('profiles')
        .update({
          phone: normalizedPhone,
          phone_verified: true,
          phone_verified_at: nowIso,
        })
        .eq('id', user.id)

      if (profileError) {
        throw profileError
      }
    }

    return json({
      success: true,
      verified: true,
      phone: normalizedPhone,
    })
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to verify phone OTP',
    }, 500)
  }
})