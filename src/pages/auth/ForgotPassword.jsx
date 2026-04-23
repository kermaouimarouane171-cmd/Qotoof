import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { Button, Input, LoadingSpinner } from '@/components/ui'

// Helper to mask email for privacy
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email
  const [name, domain] = email.split('@')
  if (name.length < 2) return `***@${domain}`
  const maskedName = name.charAt(0) + '***' + name.charAt(name.length - 1)
  return `${maskedName}@${domain}`
}

const ForgotPasswordPage = () => {
  const { t } = useTranslation()
  const { resetPassword } = useAuthStore()

  const [email, setEmail] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const validateEmail = (email) => {
    // More robust email validation
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return re.test(email) && email.length <= 254
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email) {
      setError(t('auth.forgotPassword.errors.emailRequired', 'Please enter your email'))
      return
    }

    if (!validateEmail(email)) {
      setError(t('auth.forgotPassword.errors.invalidEmail', 'Please enter a valid email address'))
      return
    }

    setLoading(true)
    const result = await resetPassword(email)
    setLoading(false)

    // SECURITY: Always show success regardless of whether email exists
    // This prevents user enumeration attacks
    if (result.success) {
      setSuccess(true)
    } else if (result.rateLimited) {
      // Show specific rate limit message
      setError(result.message || t('auth.forgotPassword.errors.rateLimited', 'Too many attempts. Please wait before trying again.'))
    } else {
      // For any other error, still show success to prevent enumeration
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t('auth.forgotPassword.successTitle', 'Check your email')}
        </h2>
        <p className="text-gray-600 mb-6">
          {t('auth.forgotPassword.successMessage',
            'If an account exists with {{email}}, you will receive a password reset link shortly. Please check your inbox.',
            { email: maskEmail(email) })}
        </p>
        <Link to="/login" className="text-green-600 font-medium hover:underline">
          {t('auth.forgotPassword.backToLogin', 'Back to login')}
        </Link>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {t('auth.forgotPassword.title', 'Reset Password')}
      </h2>
      <p className="text-gray-500 mb-6">
        {t('auth.forgotPassword.subtitle', 'Enter your email and we\'ll send you a link to reset your password.')}
      </p>

      {error && (
        <div className="alert-error mb-6" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label={t('auth.forgotPassword.emailLabel', 'Email address')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.forgotPassword.emailPlaceholder', 'Qotoof273@gmail.com')}
          autoComplete="email"
          required
          aria-describedby={error ? 'forgot-password-error' : undefined}
          aria-invalid={!!error}
        />

        <Button type="submit" variant="primary" className="w-full py-3" isLoading={loading}>
          {loading
            ? t('auth.forgotPassword.sending', 'Sending...')
            : t('auth.forgotPassword.sendLink', 'Send Reset Link')}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        {t('auth.forgotPassword.rememberPassword', 'Remember your password?')}{' '}
        <Link to="/login" className="text-green-600 font-medium hover:underline">
          {t('auth.forgotPassword.signIn', 'Sign in')}
        </Link>
      </p>
    </div>
  )
}

export default ForgotPasswordPage
