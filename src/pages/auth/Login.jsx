
import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { LoadingSpinner, MoroccoNotice } from '@/components/ui'
import FormInput from '@/components/ui/FormInput'
import FormSubmitButton from '@/components/ui/FormSubmitButton'
import Recaptcha, { isRecaptchaSiteKeyConfigured } from '@/components/ui/Recaptcha'
import { DEFAULT_AUTH_REDIRECT, resolveSafeAuthRedirect } from '@/utils/authRedirects'
import { loginSchema } from '@/lib/validationSchemas'
import { useFormValidation } from '@/hooks/useFormValidation'
import { formatSupabaseError } from '@/utils/errorFormatter'
import { EyeIcon, EyeSlashIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import AuthCard from '@/components/auth/AuthCard'
import AuthHeader from '@/components/auth/AuthHeader'
import AuthFooter from '@/components/auth/AuthFooter'

const LoginPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, loading, user, profile } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const recaptchaRef = useRef(null)
  const form = useFormValidation(loginSchema, {
    defaultValues: {
      email: '',
      password: '',
    },
  })
  const {
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors },
  } = form
  const recaptchaSiteKey = typeof import.meta.env.VITE_RECAPTCHA_SITE_KEY === 'string'
    ? import.meta.env.VITE_RECAPTCHA_SITE_KEY.trim()
    : ''
  const captchaRequired = isRecaptchaSiteKeyConfigured(recaptchaSiteKey)

  useEffect(() => {
    const emailInput = document.querySelector('[data-testid="login-email-input"]')
    if (emailInput) emailInput.focus()
  }, [])

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

  const resetCaptcha = () => {
    setCaptchaToken(null)
    recaptchaRef.current?.reset?.()
  }

  const onSubmit = async (values) => {
    clearErrors('root')
    if (captchaRequired && !captchaToken) {
      setError('root', {
        type: 'manual',
        message: t('auth.errors.captchaRequired', 'Please complete the security verification before continuing.'),
      })
      return
    }

    const result = await signIn(values.email, values.password, captchaToken, from)

    if (result.success) {
      // Use the redirect_to parameter, fallback to role dashboard
      navigate(result.redirect || from || DEFAULT_AUTH_REDIRECT)
    } else if (result.error?.includes('Email not confirmed') || result.error?.includes('not confirmed')) {
      if (captchaRequired) {
        resetCaptcha()
      }

      // User hasn't verified email yet
      sessionStorage.setItem('pendingVerificationEmail', values.email)

      if (from) {
        sessionStorage.setItem('redirect_after_verification', from)
      }

      navigate('/verify-email')
    } else {
      if (captchaRequired) {
        resetCaptcha()
      }

      setError('root', {
        type: 'server',
        message: formatSupabaseError(result.error, t('auth.errors.invalidCredentials', 'Invalid email or password. Please try again.')),
      })
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
    <AuthCard>
      <AuthHeader
        icon={
          <LockClosedIcon className="w-8 h-8 text-green-600" />
        }
        title={t('auth.login.welcomeBack', 'Welcome back')}
        subtitle={t('auth.login.subtitle', 'Sign in to your Qotoof account to continue')}
      />

      {/* Morocco Availability Notice */}
      <div className="mb-6">
        <MoroccoNotice variant="compact" />
      </div>

      {errors.root?.message && (
        <div
          className="mb-6 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700"
          data-cy="login-error"
          role="alert"
          aria-live="assertive"
        >
          {errors.root.message}
        </div>
      )}

      {/* Email Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" data-testid="login-form">
        <FormInput
          form={form}
          name="email"
          label={t('auth.login.emailAddress', 'Email address')}
          type="email"
          placeholder={t('auth.login.emailPlaceholder', 'Enter your email address')}
          autoComplete="email"
          data-cy="email-input"
          data-testid="login-email-input"
        />

        <div>
          <FormInput
            form={form}
            name="password"
            label={t('auth.login.password', 'Password')}
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            data-cy="password-input"
            data-testid="login-password-input"
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
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
            <Link
              to="/forgot-password"
              className="text-sm text-green-600 font-medium hover:text-green-700 hover:underline transition-colors"
              data-testid="forgot-password-link"
            >
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

        <FormSubmitButton
          form={form}
          variant="primary"
          className="w-full py-3"
          isLoading={loading}
          data-cy="login-button"
          data-testid="login-submit-button"
        >
          {t('auth.login.signIn', 'Sign In')}
        </FormSubmitButton>
      </form>

      <AuthFooter
        question={t('auth.login.signUpLink', "Don't have an account?")}
        linkTo="/register"
        linkText={t('auth.login.signUp', 'Sign up')}
      />
    </AuthCard>
  )
}

export default LoginPage
