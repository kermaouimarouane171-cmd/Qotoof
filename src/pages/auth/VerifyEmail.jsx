import { useEffect, useMemo, useState, useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { useAuthStore } from '@/store/authStore'
import { passwordResetSchema } from '@/utils/validationSchemas'
import { logger } from '@/utils/logger'
import { EnvelopeIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import AuthCard from '@/components/auth/AuthCard'
import AuthHeader from '@/components/auth/AuthHeader'

const CODE_LENGTH = 6
const RESEND_COOLDOWN_SECONDS = 60

const VerifyEmailPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const initialize = useAuthStore((s) => s.initialize)

  const [code, setCode] = useState('')
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [error, setError] = useState('')
  const [resendError, setResendError] = useState('')

  const email = useMemo(() => {
    const fromState = location.state?.email
    const fromSession = sessionStorage.getItem('pendingVerificationEmail')
    return fromState || fromSession || ''
  }, [location.state])

  const redirectPath = useMemo(() => {
    const fromState = location.state?.redirectPath
    const fromSession =
      sessionStorage.getItem('redirect_after_verification') ||
      sessionStorage.getItem('pending_auth_redirect')
    return fromState || fromSession || null
  }, [location.state])

  useEffect(() => {
    if (email) {
      sessionStorage.setItem('pendingVerificationEmail', email)
    }
  }, [email])

  useEffect(() => {
    if (redirectPath) {
      sessionStorage.setItem('redirect_after_verification', redirectPath)
    }
  }, [redirectPath])

  useEffect(() => {
    if (!countdown) return undefined
    const timer = setInterval(() => setCountdown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleCodeChange = useCallback((e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH)
    setCode(value)
    if (error) setError('')
  }, [error])

  const handleVerify = useCallback(async (e) => {
    e.preventDefault()
    if (!email || code.length !== CODE_LENGTH) return

    setVerifyLoading(true)
    setError('')

    // Set isSigningIn so the SIGNED_IN event from verifyOtp is skipped by the
    // auth listener (it checks isSigningIn and breaks). We handle everything
    // via initialize() below, avoiding duplicate profile fetches.
    useAuthStore.setState({ isSigningIn: true })

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'signup',
    })

    if (verifyError) {
      setVerifyLoading(false)
      useAuthStore.setState({ isSigningIn: false })
      logger.error('Signup email verification failed', { email })
      setError(
        verifyError.message ||
          t('auth.verifyEmail.invalidCode', 'رمز التحقق غير صحيح أو منتهٍ الصلاحية')
      )
      toast.error(
        verifyError.message ||
          t('auth.verifyEmail.invalidCode', 'رمز التحقق غير صحيح أو منتهٍ الصلاحية')
      )
      return
    }

    // Force re-initialization: initialize() returns early if already initialized,
    // but after OTP verification the session is new and profile must be fetched.
    useAuthStore.setState({ initialized: false, loading: true })
    await initialize()
    useAuthStore.setState({ isSigningIn: false })
    setVerifyLoading(false)
    toast.success(t('auth.verifyEmail.verifiedSuccess', 'تم التحقق من البريد بنجاح'))

    const targetPath =
      redirectPath ||
      useAuthStore.getState().getRedirectPath(useAuthStore.getState().profile?.role)

    if (targetPath) {
      sessionStorage.removeItem('redirect_after_verification')
      sessionStorage.removeItem('pending_auth_redirect')
    }

    navigate(targetPath || '/marketplace', { replace: true })
  }, [code, email, redirectPath, initialize, navigate, t])

  const handleResend = useCallback(async () => {
    if (!email || countdown > 0) return

    const parsed = passwordResetSchema.safeParse({ email })
    if (!parsed.success) {
      toast.error(t('auth.verifyEmail.invalidEmail', 'البريد الإلكتروني غير صالح'))
      return
    }

    setResendLoading(true)
    setResendError('')
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: parsed.data.email,
    })
    setResendLoading(false)

    if (error) {
      logger.error('Resend signup verification code error:', error)
      setResendError(
        error.message || t('auth.verifyEmail.resendFailed', 'تعذر إعادة إرسال رمز التحقق')
      )
      toast.error(
        error.message || t('auth.verifyEmail.resendFailed', 'تعذر إعادة إرسال رمز التحقق')
      )
      return
    }

    setCountdown(RESEND_COOLDOWN_SECONDS)
    toast.success(t('auth.verifyEmail.resendSuccess', 'تم إعادة إرسال رمز التحقق'))
  }, [email, countdown, t])

  if (!email) {
    return (
      <AuthCard>
        <div className="text-center" dir="rtl" data-cy="verify-email-page" data-testid="verify-email-page">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-5">
            <ExclamationCircleIcon className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {t('auth.verifyEmail.noPendingVerification', 'لا يوجد تحقق معلق من البريد الإلكتروني')}
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            {t('auth.verifyEmail.noPendingVerificationHelp', 'يرجى إنشاء حساب جديد أو تسجيل الدخول.')}
          </p>
          <div className="flex flex-col gap-3 text-sm">
            <Link to="/register" className="font-semibold text-green-600 hover:text-green-700 hover:underline transition-colors" data-cy="verify-email-register-link" data-testid="verify-email-register-link">
              {t('auth.verifyEmail.goToRegister', 'إنشاء حساب جديد')}
            </Link>
            <Link to="/login" className="text-gray-500 hover:text-gray-700 transition-colors" data-cy="verify-email-login-link" data-testid="verify-email-login-link">
              {t('auth.verifyEmail.backToLogin', 'تسجيل الدخول')}
            </Link>
          </div>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard>
      <div dir="rtl" data-cy="verify-email-page" data-testid="verify-email-page">
        <AuthHeader
          icon={<EnvelopeIcon className="w-8 h-8 text-green-600" />}
          title={t('auth.verifyEmail.title', 'تحقق من بريدك الإلكتروني')}
          subtitle={t('auth.verifyEmail.subtitle', 'أدخل رمز التحقق المؤلف من 6 أرقام الذي وصل إلى بريدك الإلكتروني.')}
          email={email}
        />

        <form onSubmit={handleVerify} className="space-y-5 mb-5">
          <div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={handleCodeChange}
              placeholder={t('auth.verifyEmail.codePlaceholder', '123456')}
              className="w-full text-center text-2xl tracking-[0.5em] font-bold py-4 px-4 border border-gray-200 rounded-2xl bg-gray-50/50 transition-all duration-200 outline-none focus:ring-4 focus:ring-green-500/10 focus:border-green-500 focus:bg-white hover:border-gray-300"
              disabled={verifyLoading}
              data-cy="verify-email-otp-input"
              data-testid="verify-email-otp-input"
              aria-label={t('auth.verifyEmail.codeLabel', 'رمز التحقق')}
            />
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700 text-center" role="alert" data-testid="verify-email-error">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            isLoading={verifyLoading}
            disabled={code.length !== CODE_LENGTH || verifyLoading}
            data-cy="verify-email-verify-button"
            data-testid="verify-email-verify-button"
          >
            {t('auth.verifyEmail.verifyButton', 'تحقق وتفعيل الحساب')}
          </Button>
        </form>

        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-800 mb-5">
          <p className="font-semibold mb-2">{t('auth.verifyEmail.helpTitle', 'لم تستلم الرمز؟')}</p>
          <ul className="list-disc list-inside space-y-1 text-blue-700">
            <li>{t('auth.verifyEmail.helpSpam', 'تحقق من مجلد الرسائل غير المرغوبة (Spam/Junk).')}</li>
            <li>{t('auth.verifyEmail.helpCorrectEmail', 'تأكد من كتابة عنوان بريدك بشكل صحيح.')}</li>
            <li>{t('auth.verifyEmail.helpWait', 'انتظر بضع دقائق قبل إعادة الإرسال.')}</li>
          </ul>
        </div>

        {resendError && (
          <p className="mb-4 text-sm text-red-600 text-center" role="alert" data-testid="verify-email-resend-error">{resendError}</p>
        )}

        <Button
          type="button"
          variant="secondary"
          className="w-full mb-5"
          onClick={handleResend}
          isLoading={resendLoading}
          disabled={!email || countdown > 0 || resendLoading}
          data-cy="verify-email-resend-button"
          data-testid="verify-email-resend-button"
        >
          {countdown > 0
            ? t('auth.verifyEmail.resendIn', 'إعادة الإرسال خلال {{seconds}} ثانية', { seconds: countdown })
            : t('auth.verifyEmail.resendButton', 'إعادة إرسال الرمز')}
        </Button>

        <div className="flex flex-col gap-2 text-sm text-center">
          <Link to="/register" className="text-gray-500 hover:text-gray-700 transition-colors" data-cy="verify-email-register-link" data-testid="verify-email-register-link">
            {t('auth.verifyEmail.wrongEmail', 'أخطأت في كتابة البريد؟ أنشئ حساباً جديداً')}
          </Link>
          <Link to="/login" className="text-gray-500 hover:text-gray-700 transition-colors" data-cy="verify-email-login-link" data-testid="verify-email-login-link">
            {t('auth.verifyEmail.backToLogin', 'العودة لتسجيل الدخول')}
          </Link>
        </div>
      </div>
    </AuthCard>
  )
}

export default VerifyEmailPage
