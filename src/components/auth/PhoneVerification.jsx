import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowPathIcon, XMarkIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { LoadingSpinner } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import {
  clearPendingPhoneVerification,
  getPendingPhoneVerification,
  maskPhoneNumber,
  sendPhoneOTP,
  verifyPhoneOTP,
} from '@/services/phoneOtpService'

const OTP_LENGTH = 6
const EXPIRY_SECONDS = 5 * 60
const RESEND_SECONDS = 60

const PhoneVerification = ({
  userId,
  phone,
  purpose = 'registration',
  title = '📱 تحقق من رقم هاتفك',
  description,
  successPath,
  onVerified,
  onCancel,
}) => {
  const navigate = useNavigate()
  const { user, profile, loading } = useAuthStore()
  const storedContext = useMemo(
    () => (!userId && !phone ? getPendingPhoneVerification() : null),
    [phone, userId]
  )
  const resolvedUserId = userId || storedContext?.userId || user?.id
  const resolvedPhone = phone || storedContext?.phone || profile?.phone
  const resolvedPurpose = storedContext?.purpose || purpose
  const resolvedSuccessPath = successPath || storedContext?.successPath || '/'
  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(''))
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [expiresIn, setExpiresIn] = useState(EXPIRY_SECONDS)
  const [resendIn, setResendIn] = useState(0)
  const inputsRef = useRef([])
  const hasAutoSentRef = useRef(false)

  useEffect(() => {
    if (!expiresIn) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setExpiresIn((currentValue) => Math.max(currentValue - 1, 0))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [expiresIn])

  useEffect(() => {
    if (!resendIn) {
      return undefined
    }

    const timer = window.setInterval(() => {
      setResendIn((currentValue) => Math.max(currentValue - 1, 0))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [resendIn])

  const handleSendCode = async () => {
    if (!resolvedUserId || !resolvedPhone) {
      setError('لا يوجد رقم هاتف صالح لإرسال الرمز')
      return
    }

    setSending(true)
    setError('')

    try {
      await sendPhoneOTP(resolvedUserId, resolvedPhone, resolvedPurpose)
      setOtpDigits(Array(OTP_LENGTH).fill(''))
      setExpiresIn(EXPIRY_SECONDS)
      setResendIn(RESEND_SECONDS)
      inputsRef.current[0]?.focus()
      toast.success('تم إرسال رمز التحقق إلى هاتفك')
    } catch (sendError) {
      setError(sendError.message || 'تعذر إرسال الرمز حالياً')
    } finally {
      setSending(false)
    }
  }

  useEffect(() => {
    if (loading || !resolvedUserId || !resolvedPhone || hasAutoSentRef.current) {
      return
    }

    hasAutoSentRef.current = true
    void handleSendCode()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, resolvedPhone, resolvedUserId])

  if (loading && !resolvedUserId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!resolvedUserId) {
    return <Navigate to="/login" replace />
  }

  const formattedTimer = `${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, '0')}`

  const handleDigitChange = (index, value) => {
    if (!/^\d?$/.test(value)) {
      return
    }

    const nextDigits = [...otpDigits]
    nextDigits[index] = value
    setOtpDigits(nextDigits)
    setError('')

    if (value && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  const handleVerify = async () => {
    const otpCode = otpDigits.join('')

    if (otpCode.length !== OTP_LENGTH) {
      setError('أدخل رمز التحقق كاملاً من 6 أرقام')
      return
    }

    setVerifying(true)
    setError('')

    try {
      const result = await verifyPhoneOTP(resolvedUserId, resolvedPhone, otpCode, resolvedPurpose)
      const nowIso = new Date().toISOString()

      if (resolvedPurpose === 'registration' || resolvedPurpose === 'change_phone') {
        useAuthStore.setState((state) => ({
          ...state,
          profile: state.profile
            ? {
                ...state.profile,
                phone: result.phone,
                phone_verified: true,
                phone_verified_at: nowIso,
              }
            : state.profile,
        }))
      }

      if (storedContext) {
        clearPendingPhoneVerification()
      }

      if (onVerified) {
        await onVerified(result)
      } else {
        navigate(resolvedSuccessPath, { replace: true })
      }

      toast.success('تم تأكيد رقم الهاتف بنجاح')
    } catch (verifyError) {
      setError(verifyError.message || 'تعذر التحقق من الرمز')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="w-full rounded-3xl border border-white/60 bg-white/80 backdrop-blur-xl p-6 shadow-[0_8px_40px_rgba(0,0,0,0.08)] sm:p-8 auth-fade-in">
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-emerald-50 text-4xl">
          <span aria-hidden="true">📱</span>
        </div>
        <h2 className="mt-5 text-2xl font-black text-slate-900">{title}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          {description || 'أرسلنا رمز تحقق إلى رقم هاتفك المسجل. أدخل الرمز المكوّن من 6 أرقام للمتابعة.'}
        </p>
        <p className="mt-2 text-base font-semibold text-slate-900">{maskPhoneNumber(resolvedPhone)}</p>
      </div>

      <div className="mt-8 flex justify-center gap-2 sm:gap-3" dir="ltr">
        {otpDigits.map((digit, index) => (
          <input
            key={`otp-${index}`}
            ref={(element) => {
              inputsRef.current[index] = element
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(event) => handleDigitChange(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            className="h-14 w-12 rounded-2xl border border-gray-200 bg-gray-50/50 text-center text-2xl font-bold text-gray-900 outline-none transition-all duration-200 focus:ring-4 focus:ring-green-500/10 focus:border-green-500 focus:bg-white hover:border-gray-300 sm:h-16 sm:w-14"
          />
        ))}
      </div>

      <div className="mt-6 space-y-2 text-center">
        <p className="text-sm text-slate-500">الرمز صالح لمدة 5 دقائق</p>
        <p className="text-sm font-semibold text-slate-700">⏱️ المتبقي: {formattedTimer}</p>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-6 text-center text-sm text-slate-500">
        <p>لم تستلم الرمز؟</p>
        <button
          type="button"
          onClick={handleSendCode}
          disabled={sending || resendIn > 0}
          className="mt-2 inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-slate-400"
        >
          <ArrowPathIcon className="h-4 w-4" />
          {sending ? 'جارٍ الإرسال...' : resendIn > 0 ? `إعادة الإرسال بعد ${resendIn} ثانية` : 'إعادة الإرسال'}
        </button>
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            إلغاء
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleVerify}
          disabled={verifying || sending}
          className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-green-600/20 transition-all duration-200 hover:from-green-700 hover:to-emerald-700 hover:shadow-xl hover:shadow-green-600/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {verifying ? 'جارٍ التحقق...' : 'تأكيد'}
        </button>
      </div>
    </div>
  )
}

export const PhoneVerificationDialog = ({ open, onClose, ...props }) => {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-20 rounded-full bg-white p-2 text-slate-500 shadow transition hover:text-slate-700"
            aria-label="Close verification"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        ) : null}
        <PhoneVerification {...props} onCancel={onClose} />
      </div>
    </div>
  )
}

export default PhoneVerification