
import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { Button, Input, LoadingSpinner, MoroccoNotice, Recaptcha } from '@/components/ui'
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline'

const LoginPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, signInWithGoogle, loading, user, profile } = useAuthStore()
  const recaptchaRef = useRef(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [recaptchaToken, setRecaptchaToken] = useState(null)

  // Validate redirect target is a safe internal path (prevents Open Redirect attacks)
  const isSafeRedirect = (url) => {
    if (!url || typeof url !== 'string') return false
    // Must start with / but not // (protocol-relative URLs like //evil.com)
    return url.startsWith('/') && !url.startsWith('//')
  }
  const rawRedirect = new URLSearchParams(window.location.search).get('redirect_to')
  const from = location.state?.from || (isSafeRedirect(rawRedirect) ? rawRedirect : null) || '/marketplace'

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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // reCAPTCHA check in production
    const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY
    if (recaptchaSiteKey && import.meta.env.PROD) {
      const token = recaptchaRef.current?.getValue()
      if (!token) {
        setError(t('auth.errors.recaptchaRequired', 'Please complete the reCAPTCHA verification'))
        return
      }
      setRecaptchaToken(token)
    }

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
      setError(t('auth.errors.passwordTooShort', 'Password must be at least 8 characters'))
      return
    }

    const result = await signIn(email, password)

    if (result.success) {
      // Use the redirect_to parameter, fallback to role dashboard
      navigate(result.redirect || from)
    } else if (result.error?.includes('Email not confirmed') || result.error?.includes('not confirmed')) {
      // User hasn't verified email yet
      sessionStorage.setItem('pendingVerificationEmail', email)
      navigate('/verify-email')
    } else {
      // GENERIC ERROR - Never reveal if email exists or password is wrong
      setError(t('auth.errors.invalidCredentials', 'Invalid email or password. Please try again.'))
    }
  }

  const handleGoogleSignIn = async () => {
    await signInWithGoogle(from)
  }

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
        <div className="alert-error mb-6">
          {error}
        </div>
      )}
      
      {/* Social Login */}
      <Button
        variant="outline"
        className="w-full mb-6 py-3"
        onClick={handleGoogleSignIn}
      >
        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {t('auth.login.continueWithGoogle', 'Continue with Google')}
      </Button>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-400">{t('auth.login.orContinueWithEmail', 'or continue with email')}</span>
        </div>
      </div>
      
      {/* Email Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t('auth.login.emailAddress', 'Email address')}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.login.emailPlaceholder', 'Qotoof273@gmail.com')}
          autoComplete="email"
        />

        <div>
          <Input
            label={t('auth.login.password', 'Password')}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.login.passwordPlaceholder', 'Enter your password')}
            autoComplete="current-password"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600"
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
            <Link to="/forgot-password" className="text-sm text-green-600 font-medium hover:underline">
              {t('auth.login.forgotPassword', 'Forgot password?')}
            </Link>
          </div>
        </div>

        <Button type="submit" variant="primary" className="w-full py-3" isLoading={loading}>
          {t('auth.login.signIn', 'Sign In')}
        </Button>

        {/* reCAPTCHA */}
        <div className="flex justify-center">
          <Recaptcha
            ref={recaptchaRef}
            siteKey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
            onChange={(token) => setRecaptchaToken(token)}
          />
        </div>
      </form>
    </div>
  )
}

export default LoginPage
