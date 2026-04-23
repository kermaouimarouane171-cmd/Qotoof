import smsService from '@/services/sms/smsService'
import { supabase } from '@/services/supabase'

export const PHONE_VERIFICATION_EVENT = 'qotoof:phone-verification-updated'

const STORAGE_KEY = 'qotoof.pendingPhoneVerification'
const RESEND_WINDOW_MS = 10 * 60 * 1000
const RESEND_LIMIT = 3
const OTP_EXPIRY_SECONDS = 5 * 60
const MAX_VERIFY_ATTEMPTS = 5

const emitPhoneVerificationUpdate = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PHONE_VERIFICATION_EVENT))
  }
}

const normalizePhone = (phone) => {
  const formattedPhone = smsService.formatPhoneNumber(phone)

  if (!formattedPhone) {
    throw new Error('رقم الهاتف غير صالح')
  }

  return formattedPhone
}

const generateOtpCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

const hashOtpCode = async (otpCode) => {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return otpCode
  }

  const encoded = new TextEncoder().encode(otpCode)
  const digest = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const maskPhoneNumber = (phone) => {
  if (!phone) {
    return 'غير متوفر'
  }

  const digits = phone.replace(/\D/g, '')

  if (digits.length < 4) {
    return phone
  }

  const lastFourDigits = digits.slice(-4)
  return `+212 ••• ••• ${lastFourDigits}`
}

export const setPendingPhoneVerification = (context) => {
  if (typeof window === 'undefined') {
    return
  }

  sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...context,
      createdAt: new Date().toISOString(),
    })
  )

  emitPhoneVerificationUpdate()
}

export const getPendingPhoneVerification = () => {
  if (typeof window === 'undefined') {
    return null
  }

  const rawValue = sessionStorage.getItem(STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue)
  } catch {
    sessionStorage.removeItem(STORAGE_KEY)
    emitPhoneVerificationUpdate()
    return null
  }
}

export const clearPendingPhoneVerification = () => {
  if (typeof window === 'undefined') {
    return
  }

  sessionStorage.removeItem(STORAGE_KEY)
  emitPhoneVerificationUpdate()
}

export const sendPhoneOTP = async (userId, phone, purpose) => {
  const normalizedPhone = normalizePhone(phone)

  const { data: existingRequests, error: existingError } = await supabase
    .from('phone_otp')
    .select('id')
    .eq('user_id', userId)
    .eq('purpose', purpose)
    .eq('used', false)
    .gte('created_at', new Date(Date.now() - RESEND_WINDOW_MS).toISOString())

  if (existingError) {
    throw existingError
  }

  if ((existingRequests || []).length >= RESEND_LIMIT) {
    throw new Error('تجاوزت الحد المسموح. انتظر 10 دقائق ثم أعد المحاولة.')
  }

  const otpCode = generateOtpCode()
  const hashedOtpCode = await hashOtpCode(otpCode)
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000).toISOString()

  const { error: insertError } = await supabase
    .from('phone_otp')
    .insert({
      user_id: userId,
      phone: normalizedPhone,
      otp_code: hashedOtpCode,
      purpose,
      expires_at: expiresAt,
    })

  if (insertError) {
    throw insertError
  }

  const smsResult = await smsService.sendSMS({
    to: normalizedPhone,
    message: `Qotoof: رمز التحقق الخاص بك صالح لمدة 5 دقائق. لا تشاركه مع أحد. الرمز: ${otpCode}`,
  })

  if (!smsResult?.success) {
    throw new Error(smsResult?.error || 'تعذر إرسال رمز التحقق حالياً')
  }

  return {
    success: true,
    expires_in: OTP_EXPIRY_SECONDS,
    phone: normalizedPhone,
  }
}

export const verifyPhoneOTP = async (userId, phone, otpCode, purpose) => {
  const normalizedPhone = normalizePhone(phone)

  const { data: otpRecord, error: otpError } = await supabase
    .from('phone_otp')
    .select('*')
    .eq('user_id', userId)
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
    throw new Error('رمز التحقق منتهي أو غير صالح')
  }

  if ((otpRecord.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
    throw new Error('تجاوزت محاولات التحقق. اطلب رمزاً جديداً.')
  }

  const nextAttempts = (otpRecord.attempts || 0) + 1
  const hashedProvidedCode = await hashOtpCode(otpCode)

  const { error: attemptsError } = await supabase
    .from('phone_otp')
    .update({ attempts: nextAttempts })
    .eq('id', otpRecord.id)

  if (attemptsError) {
    throw attemptsError
  }

  if (otpRecord.otp_code !== hashedProvidedCode) {
    if (nextAttempts >= MAX_VERIFY_ATTEMPTS) {
      throw new Error('تجاوزت محاولات التحقق. اطلب رمزاً جديداً.')
    }

    throw new Error(`رمز غير صحيح. المحاولات المتبقية: ${MAX_VERIFY_ATTEMPTS - nextAttempts}`)
  }

  const nowIso = new Date().toISOString()

  const { error: markUsedError } = await supabase
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
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        phone: normalizedPhone,
        phone_verified: true,
        phone_verified_at: nowIso,
      })
      .eq('id', userId)

    if (profileError) {
      throw profileError
    }
  }

  return {
    success: true,
    verified: true,
    phone: normalizedPhone,
  }
}