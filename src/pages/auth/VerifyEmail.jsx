import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { passwordResetSchema } from '@/utils/validationSchemas'

const VerifyEmailPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(0)

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

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user?.email_confirmed_at) {
        toast.success(t('auth.verifyEmail.verified', 'تم تأكيد البريد الإلكتروني بنجاح'))
        sessionStorage.removeItem('pendingVerificationEmail')
        navigate('/login', { replace: true })
      }
    })

    return () => {
      subscription?.subscription?.unsubscribe()
    }
  }, [navigate, t])

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
      toast.error(error.message || t('auth.verifyEmail.resendFailed', 'تعذر إعادة إرسال رسالة التحقق'))
      return
    }

    setCountdown(60)
    toast.success(t('auth.verifyEmail.resendSuccess', 'تم إرسال رسالة التحقق مرة أخرى'))
  }

  return (
    <div className="max-w-md mx-auto text-center" dir="rtl" data-cy="verify-email-page">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {t('auth.verifyEmail.title', 'تحقق من بريدك الإلكتروني')}
      </h2>
      <p className="text-gray-600 mb-3">
        {t('auth.verifyEmail.subtitle', 'أرسلنا رابط تأكيد إلى بريدك الإلكتروني. افتح الرسالة واضغط على رابط التأكيد.')}
      </p>

      {email && (
        <p className="mb-6 text-sm font-semibold text-green-700" data-cy="verify-email-address">{email}</p>
      )}

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 mb-6 text-sm text-blue-800" data-cy="verify-email-info">
        {t('auth.verifyEmail.waitingMessage', 'سنبقي هذه الصفحة مفتوحة. عند اكتمال التحقق وتسجيل الدخول، سيتم تحويلك تلقائيًا.')}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleResend}
        isLoading={loading}
        disabled={!email || countdown > 0}
        data-cy="verify-email-resend-button"
      >
        {countdown > 0
          ? t('auth.verifyEmail.resendCountdown', 'إعادة الإرسال خلال {{seconds}} ثانية', { seconds: countdown })
          : t('auth.verifyEmail.resendButton', 'إعادة إرسال رسالة التحقق')}
      </Button>

      <Link to="/login" className="inline-block mt-4 text-sm text-gray-600 hover:underline" data-cy="verify-email-login-link">
        {t('auth.verifyEmail.backToLogin', 'العودة لتسجيل الدخول')}
      </Link>
    </div>
  )
}

export default VerifyEmailPage
