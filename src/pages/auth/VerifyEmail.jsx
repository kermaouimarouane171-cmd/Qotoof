import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { passwordResetSchema } from '@/utils/validationSchemas'
import { useAuthStore } from '@/store/authStore'
import { logger } from '@/utils/logger'

const VerifyEmailPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const initialize = useAuthStore((s) => s.initialize)
  const getRedirectPath = useAuthStore((s) => s.getRedirectPath)

  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [otpCode, setOtpCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')

  const email = useMemo(() => {
    const fromState = location.state?.email
    const fromSession = sessionStorage.getItem('pendingVerificationEmail')
    return fromState || fromSession || ''
  }, [location.state])

  useEffect(() => {
    if (email) {
      sessionStorage.setItem('pendingVerificationEmail', email)
    }
  }, [email])

  useEffect(() => {
    if (!countdown) return undefined
    const timer = setInterval(() => setCountdown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleVerify = async () => {
    if (!otpCode || otpCode.length !== 6 || !/^\d{6}$/.test(otpCode)) {
      setVerifyError(t('auth.verifyEmail.invalidOtp', 'أدخل رمز تحقق مكوّن من 6 أرقام'))
      return
    }

    if (!email) {
      setVerifyError(t('auth.verifyEmail.noEmail', 'البريد الإلكتروني غير متوفر'))
      return
    }

    setVerifying(true)
    setVerifyError('')

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode.trim(),
        type: 'signup',
      })

      if (error) throw error

      await initialize()
      const role = useAuthStore.getState().profile?.role
      const redirectPath = getRedirectPath(role)

      toast.success(t('auth.verifyEmail.verified', 'تم تأكيد البريد الإلكتروني بنجاح'))
      sessionStorage.removeItem('pendingVerificationEmail')
      navigate(redirectPath, { replace: true })
    } catch (error) {
      logger.error('OTP verification error:', error)
      setVerifyError(error.message || t('auth.verifyEmail.invalidOtp', 'رمز التحقق غير صحيح أو منتهي الصلاحية'))
    } finally {
      setVerifying(false)
    }
  }

  const handleResend = async () => {
    if (!email || countdown > 0) return

    const parsed = passwordResetSchema.safeParse({ email })
    if (!parsed.success) {
      toast.error(t('auth.verifyEmail.invalidEmail', 'البريد الإلكتروني غير صالح'))
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: parsed.data.email,
    })
    setLoading(false)

    if (error) {
      toast.error(error.message || t('auth.verifyEmail.resendFailed', 'تعذر إعادة إرسال رمز التحقق'))
      return
    }

    setCountdown(60)
    toast.success(t('auth.verifyEmail.resendSuccess', 'تم إرسال رمز التحقق مرة أخرى'))
  }

  return (
    <div className="max-w-md mx-auto text-center" dir="rtl" data-cy="verify-email-page" data-testid="verify-email-page">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {t('auth.verifyEmail.title', 'تحقق من بريدك الإلكتروني')}
      </h2>
      <p className="text-gray-600 mb-3">
        {t('auth.verifyEmail.subtitle', 'أرسلنا رمز تحقق مكوّن من 6 أرقام إلى بريدك الإلكتروني. أدخل الرمز أدناه لتأكيد حسابك.')}
      </p>

      {email && (
        <p className="mb-4 text-sm font-semibold text-green-700" data-cy="verify-email-address" data-testid="verify-email-address">{email}</p>
      )}

      <div className="mb-4">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          pattern="\d{6}"
          value={otpCode}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, '').slice(0, 6)
            setOtpCode(value)
            if (verifyError) setVerifyError('')
          }}
          placeholder="123456"
          className="w-full text-center text-2xl tracking-[0.5em] font-mono border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition"
          disabled={verifying}
          data-cy="verify-email-otp-input"
          data-testid="verify-email-otp-input"
        />
        {verifyError && (
          <p className="mt-2 text-sm text-red-600" role="alert" data-testid="verify-email-error">{verifyError}</p>
        )}
      </div>

      <Button
        type="button"
        variant="primary"
        className="w-full mb-3"
        onClick={handleVerify}
        isLoading={verifying}
        disabled={!email || otpCode.length !== 6}
        data-cy="verify-email-verify-button"
        data-testid="verify-email-verify-button"
      >
        {t('auth.verifyEmail.verifyButton', 'تحقق من الرمز')}
      </Button>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleResend}
        isLoading={loading}
        disabled={!email || countdown > 0}
        data-cy="verify-email-resend-button"
        data-testid="verify-email-resend-button"
      >
        {countdown > 0
          ? t('auth.verifyEmail.resendCountdown', 'إعادة الإرسال خلال {{seconds}} ثانية', { seconds: countdown })
          : t('auth.verifyEmail.resendButton', 'إعادة إرسال رمز التحقق')}
      </Button>

      <Link to="/login" className="inline-block mt-4 text-sm text-gray-600 hover:underline" data-cy="verify-email-login-link" data-testid="verify-email-login-link">
        {t('auth.verifyEmail.backToLogin', 'العودة لتسجيل الدخول')}
      </Link>
    </div>
  )
}

export default VerifyEmailPage
