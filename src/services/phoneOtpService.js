import smsService from '@/services/sms/smsService'
import { supabase } from '@/services/supabase'

export const PHONE_VERIFICATION_EVENT = 'qotoof:phone-verification-updated'

const STORAGE_KEY = 'qotoof.pendingPhoneVerification'
const OTP_EXPIRY_SECONDS = 5 * 60

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

  const { data, error } = await supabase.functions.invoke('request-phone-otp', {
    body: {
      userId,
      phone: normalizedPhone,
      purpose,
    },
  })

  if (error) {
    throw error
  }

  if (!data?.success) {
    throw new Error(data?.error || 'تعذر إرسال رمز التحقق حالياً')
  }

  return {
    success: true,
    expires_in: data?.expires_in || OTP_EXPIRY_SECONDS,
    phone: data?.phone || normalizedPhone,
  }
}

export const verifyPhoneOTP = async (userId, phone, otpCode, purpose) => {
  const normalizedPhone = normalizePhone(phone)

  const { data, error } = await supabase.functions.invoke('verify-phone-otp', {
    body: {
      userId,
      phone: normalizedPhone,
      otpCode,
      purpose,
    },
  })

  if (error) {
    throw error
  }

  if (!data?.success || !data?.verified) {
    throw new Error(data?.error || 'رمز التحقق منتهي أو غير صالح')
  }

  return {
    success: true,
    verified: true,
    phone: data?.phone || normalizedPhone,
  }
}