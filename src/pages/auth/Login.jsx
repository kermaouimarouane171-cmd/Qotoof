
import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { Button, Input, LoadingSpinner, MoroccoNotice } from '@/components/ui'
import Recaptcha, { isRecaptchaSiteKeyConfigured } from '@/components/ui/Recaptcha'
import { DEFAULT_AUTH_REDIRECT, resolveSafeAuthRedirect } from '@/utils/authRedirects'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

const LoginPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, loading, user, profile } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [captchaToken, setCaptchaToken] = useState(null)
  const recaptchaRef = useRef(null)
  const recaptchaSiteKey = typeof import.meta.env.VITE_RECAPTCHA_SITE_KEY === 'string'
    ? import.meta.env.VITE_RECAPTCHA_SITE_KEY.trim()
    : ''
  const captchaRequired = isRecaptchaSiteKeyConfigured(recaptchaSiteKey)

  const rawRedirect = new URLSearchParams(window.location.search).get('redirect_to')
  const from = resolveSafeAuthRedirect(
    location.state?.from,
    resolveSafeAuthRedirect(rawRedirect, null)
  )

  // Redirect already logged-in users
  useEffect(() => {
    if (user && profile) {
      const redirectPath = from || useAuthStore.getState().getRedirectPath(profile.role)
      navigate(redirectPath, { replace: true })
    }
  }, [user, profile, navigate, from])

  const validateEmail = (email) => {
    // More robust email validation
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return re.test(email) && email.length <= 254
  }

  const resetCaptcha = () => {
    setCaptchaToken(null)
    recaptchaRef.current?.reset?.()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError(t('auth.errors.fillAllFields', 'Please fill in all fields'))
      return
    }

    if (!validateEmail(email)) {
      setError(t('auth.errors.invalidEmail', 'Please enter a valid email address'))
      return
    }

    // Check minimum password length
    if (password.length < 8) {
      setError(t('auth.errors.passwordTooShort', 'Password must be 8 characters minimum'))
      return
    }

    if (captchaRequired && !captchaToken) {
      setError(t('auth.errors.captchaRequired', 'Please complete the security verification before continuing.'))
      return
    }

    const result = await signIn(email, password, captchaToken, from)

    if (result.success) {
      // Use the redirect_to parameter, fallback to role dashboard
      navigate(result.redirect || from || DEFAULT_AUTH_REDIRECT)
    } else if (result.error?.includes('Email not confirmed') || result.error?.includes('not confirmed')) {
      if (captchaRequired) {
        resetCaptcha()
      }

      // User hasn't verified email yet
      sessionStorage.setItem('pendingVerificationEmail', email)

      if (from) {
        sessionStorage.setItem('redirect_after_verification', from)
      }

      navigate('/verify-email')
    } else {
      if (captchaRequired) {
        resetCaptcha()
      }

      // GENERIC ERROR - Never reveal if email exists or password is wrong
      setError(t('auth.errors.invalidCredentials', 'Invalid email or password. Please try again.'))
    }
  }

  // Show loading while checking auth state
    // Show loading while checking auth state
  if (!user && loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Don't render login form if already logged in
  if (user) {
    return null
  }

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('auth.login.welcomeBack', 'Welcome back')}</h2>
        <p className="text-gray-500">
          {t('auth.login.signUpLink', "Don't have an account?")}{' '}
          <Link to="/register" className="text-green-600 font-semibold hover:underline">
            {t('auth.login.signUp', 'Sign up')}
          </Link>
        </p>
      </div>

      {/* Morocco Availability Notice */}
      <div className="mb-6">
        <MoroccoNotice variant="compact" />
      </div>
      
      {error && (
        <div className="alert-error mb-6" data-cy="login-error" role="alert" aria-live="assertive">
          {error}
        </div>
      )}
      
      {/* Email Form */}
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
        <Input
          label={t('auth.login.emailAddress', 'Email address')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.login.emailPlaceholder', 'Enter your email address')}
          autoComplete="email"
          autoFocus
          data-cy="email-input"
          data-testid="login-email-input"
        />

        <div>
          <Input
            label={t('auth.login.password', 'Password')}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            data-cy="password-input"
            data-testid="login-password-input"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? t('auth.login.hidePassword', 'Hide password') : t('auth.login.showPassword', 'Show password')}
              >
                {showPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            }
          />
          <div className="flex justify-end mt-2">
            <Link to="/forgot-password" className="text-sm text-green-600 font-medium hover:underline" data-testid="forgot-password-link">
              {t('auth.login.forgotPassword', 'Forgot password?')}
            </Link>
          </div>
        </div>

        {captchaRequired && (
          <div className="flex justify-center pt-2">
            <Recaptcha
              ref={recaptchaRef}
              siteKey={recaptchaSiteKey}
              onChange={setCaptchaToken}
            />
          </div>
        )}

        <Button type="submit" variant="primary" className="w-full py-3" isLoading={loading} data-cy="login-button" data-testid="login-submit-button">
          {t('auth.login.signIn', 'Sign In')}
        </Button>
      </form>
    </div>
  )
}

export default LoginPage
