import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { Input, Button } from '@/components/ui'
import { passwordResetSchema } from '@/utils/validationSchemas'
import { EnvelopeIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import AuthCard from '@/components/auth/AuthCard'
import AuthHeader from '@/components/auth/AuthHeader'
import AuthFooter from '@/components/auth/AuthFooter'

const ForgotPasswordPage = () => {
  const { t } = useTranslation()
  const resetPassword = useAuthStore((s) => s.resetPassword)

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    const parsed = passwordResetSchema.safeParse({ email })
    if (!parsed.success) {
      setError(parsed.error.issues?.[0]?.message || t('auth.forgotPassword.validation.email', 'يرجى إدخال بريد إلكتروني صحيح'))
      return
    }

    setLoading(true)
    const result = await resetPassword(parsed.data.email)
    setLoading(false)

    if (!result.success && result.rateLimited) {
      setError(result.message || t('auth.forgotPassword.validation.rateLimited', 'محاولات كثيرة، يرجى المحاولة لاحقًا'))
      return
    }

    // Intentionally show success in all non-rate-limit cases.
    setSuccess(true)
  }

  return (
    <AuthCard>
      <AuthHeader
        icon={<EnvelopeIcon className="w-8 h-8 text-green-600" />}
        title={t('auth.forgotPassword.title', 'نسيت كلمة المرور')}
        subtitle={t('auth.forgotPassword.subtitle', 'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين كلمة المرور')}
      />

      {success ? (
        <div className="auth-scale-in rounded-2xl border border-green-200 bg-green-50/80 p-6 text-center" data-cy="forgot-password-success" data-testid="forgot-password-success">
          <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircleIcon className="w-7 h-7 text-green-600" />
          </div>
          <p className="text-green-700 text-sm leading-relaxed mb-4">
            {t('auth.forgotPassword.success', 'تم إرسال رابط إعادة التعيين إذا كان البريد الإلكتروني مسجلًا لدينا.')}
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center h-11 px-6 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold text-sm hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg shadow-green-600/20"
            data-cy="forgot-password-back-login"
          >
            {t('auth.forgotPassword.backToLogin', 'العودة لتسجيل الدخول')}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" data-cy="forgot-password-form" data-testid="forgot-password-form">
          {error && (
            <div
              className="rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700"
              data-cy="forgot-password-error"
              data-testid="forgot-password-error"
            >
              {error}
            </div>
          )}

          <Input
            label={t('auth.forgotPassword.emailLabel', 'البريد الإلكتروني')}
            type="email"
            name="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError('')
            }}
            placeholder={t('auth.forgotPassword.emailPlaceholder', 'name@example.com')}
            data-cy="forgot-password-email-input"
            data-testid="forgot-password-email-input"
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            isLoading={loading}
            data-cy="forgot-password-submit-button"
            data-testid="forgot-password-submit-button"
          >
            {t('auth.forgotPassword.submit', 'إرسال رابط إعادة التعيين')}
          </Button>

          <AuthFooter
            question={t('auth.forgotPassword.haveAccount', 'تذكرت كلمة المرور؟')}
            linkTo="/login"
            linkText={t('auth.forgotPassword.login', 'تسجيل الدخول')}
          />
        </form>
      )}
    </AuthCard>
  )
}

export default ForgotPasswordPage
