import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { Input, Button } from '@/components/ui'
import { passwordResetSchema } from '@/utils/validationSchemas'

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
    <div className="max-w-md mx-auto" dir="rtl" data-cy="forgot-password-page" data-testid="forgot-password-page">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {t('auth.forgotPassword.title', 'نسيت كلمة المرور')}
      </h2>
      <p className="text-gray-600 mb-6">
        {t('auth.forgotPassword.subtitle', 'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين كلمة المرور')}
      </p>

      {success ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4" data-cy="forgot-password-success" data-testid="forgot-password-success">
          <p className="text-green-700 text-sm">
            {t('auth.forgotPassword.success', 'تم إرسال رابط إعادة التعيين إذا كان البريد الإلكتروني مسجلًا لدينا.')}
          </p>
          <Link to="/login" className="inline-block mt-3 text-green-700 font-semibold hover:underline" data-cy="forgot-password-back-login">
            {t('auth.forgotPassword.backToLogin', 'العودة لتسجيل الدخول')}
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" data-cy="forgot-password-form" data-testid="forgot-password-form">
          {error && (
            <div className="alert-error" data-cy="forgot-password-error" data-testid="forgot-password-error">{error}</div>
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

          <Button type="submit" variant="primary" className="w-full" isLoading={loading} data-cy="forgot-password-submit-button" data-testid="forgot-password-submit-button">
            {t('auth.forgotPassword.submit', 'إرسال رابط إعادة التعيين')}
          </Button>

          <p className="text-sm text-center text-gray-600">
            {t('auth.forgotPassword.haveAccount', 'تذكرت كلمة المرور؟')}{' '}
            <Link to="/login" className="text-green-600 hover:underline font-semibold" data-cy="forgot-password-login-link">
              {t('auth.forgotPassword.login', 'تسجيل الدخول')}
            </Link>
          </p>
        </form>
      )}
    </div>
  )
}

export default ForgotPasswordPage
