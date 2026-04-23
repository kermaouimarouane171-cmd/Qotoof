import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { Button, Input, LoadingSpinner } from '@/components/ui'
import { EyeIcon, EyeSlashIcon, ShieldCheckIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { newPasswordSchema } from '@/utils/validationSchemas'
import { sanitizeText } from '@/utils/sanitization'
import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

const ResetPassword = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { updatePassword, loading } = useAuthStore()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [success, setSuccess] = useState(false)

  // Token validation state
  const [tokenValid, setTokenValid] = useState(null) // null = checking, true = valid, false = invalid
  const [tokenError, setTokenError] = useState('')

  // ============================================
  // Token Validation on Mount
  // ============================================

  useEffect(() => {
    validateRecoveryToken()
  }, [])

  const validateRecoveryToken = async () => {
    try {
      // Check if user has a valid recovery session from Supabase
      // When user clicks the reset link in email, Supabase creates a recovery session
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        // No valid recovery session — token is invalid, expired, or already used
        setTokenValid(false)
        setTokenError(
          userError?.message?.includes('expired')
            ? 'This password reset link has expired. Please request a new one.'
            : 'This password reset link is invalid or has already been used. Please request a new one.'
        )
        return
      }

      // Valid recovery session found — token is valid
      setTokenValid(true)
    } catch (err) {
      logger.error('Token validation error:', err)
      setTokenValid(false)
      setTokenError('Failed to validate reset link. Please try again.')
    }
  }

  // ============================================
  // Password Strength Checker
  // ============================================

  const getPasswordStrength = (pwd) => {
    const checks = {
      length: pwd.length >= 8,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[^A-Za-z0-9]/.test(pwd),
    }
    const score = Object.values(checks).filter(Boolean).length
    const labels = ['ضعيفة جداً', 'ضعيفة', 'متوسطة', 'قوية', 'قوية جداً']
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500']
    const idx = Math.min(score, 5)
    return { checks, score, label: labels[idx - 1] || '', color: colors[idx - 1] || 'bg-gray-200' }
  }

  const passwordStrength = getPasswordStrength(password)

  // ============================================
  // Form Submission
  // ============================================

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})

    // Validate with Zod schema (strong password requirements)
    const validationResult = newPasswordSchema.safeParse({
      password,
      confirmPassword,
    })

    if (!validationResult.success) {
      const fieldErrMap = {}
      const errors = validationResult.error.errors || []
      const firstError = errors[0]
      if (firstError && firstError.path && firstError.path.length > 0) {
        fieldErrMap[firstError.path[0]] = firstError.message
      }
      setFieldErrors(fieldErrMap)
      setError(firstError?.message || t('auth.resetPassword.errors.validation', 'Validation failed. Please check your input.'))
      return
    }

    // Sanitize password input
    const sanitizedPassword = sanitizeText(password, { maxLength: 128, trim: true, collapseWhitespace: false })

    if (!sanitizedPassword || sanitizedPassword.length < 8) {
      setError('Password is invalid')
      return
    }

    const result = await updatePassword(sanitizedPassword)

    if (result.success) {
      setSuccess(true)
      // Redirect to login after showing success message
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    }
  }

  // ============================================
  // Loading State — Validating Token
  // ============================================

  if (tokenValid === null) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <LoadingSpinner size="lg" />
        <p className="text-gray-500 mt-4">{t('auth.resetPassword.validatingToken', 'Validating reset link...')}</p>
      </div>
    )
  }

  // ============================================
  // Invalid Token State
  // ============================================

  if (tokenValid === false) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircleIcon className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.resetPassword.invalidResetLink', 'Invalid Reset Link')}</h2>
        <p className="text-gray-600 mb-6">{tokenError}</p>
        <Button onClick={() => navigate('/forgot-password')} variant="primary">
          {t('auth.resetPassword.requestNewLink', 'Request New Reset Link')}
        </Button>
      </div>
    )
  }

  // ============================================
  // Success State
  // ============================================

  if (success) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheckIcon className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.resetPassword.passwordUpdated', 'Password Updated!')}</h2>
        <p className="text-gray-600 mb-2">
          {t('auth.resetPassword.passwordUpdatedDesc', 'Your password has been updated successfully.')}
        </p>
        <p className="text-sm text-amber-600 mb-6">
          {t('auth.resetPassword.sessionWarning', '🔒 All other sessions have been signed out for your security.')}
        </p>
        <p className="text-gray-500 mb-6">
          {t('auth.resetPassword.redirecting', 'Redirecting to login...')}
        </p>
        <Button onClick={() => navigate('/login')} variant="primary">
          {t('auth.resetPassword.goToLogin', 'Go to Login')}
        </Button>
      </div>
    )
  }

  // ============================================
  // Reset Password Form
  // ============================================

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('auth.resetPassword.resetPasswordTitle', 'Reset Password')}</h2>
      <p className="text-gray-500 mb-6">
        {t('auth.resetPassword.resetPasswordDesc', 'Enter your new password below.')}
      </p>

      {error && (
        <div className="alert-error mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Input
            label={t('auth.resetPassword.newPassword', 'New Password')}
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: null })
            }}
            placeholder={t('auth.resetPassword.newPasswordPlaceholder', 'Enter new password')}
            autoComplete="new-password"
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
          {fieldErrors.password && <p className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>}

          {/* Password Strength Indicator */}
          {password && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">{t('auth.resetPassword.passwordStrength', 'Password Strength')}</span>
                <span className={`text-xs font-semibold ${
                  passwordStrength.score >= 4 ? 'text-green-600' :
                  passwordStrength.score >= 3 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {passwordStrength.label}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                <div
                  className={`h-1.5 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                  style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { key: 'length', label: '8+ chars' },
                  { key: 'uppercase', label: 'Uppercase' },
                  { key: 'lowercase', label: 'Lowercase' },
                  { key: 'number', label: 'Number' },
                  { key: 'special', label: 'Special char' },
                ].map(({ key, label }) => (
                  <div key={key} className={`flex items-center gap-1 text-xs ${
                    passwordStrength.checks[key] ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {passwordStrength.checks[key] ? (
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                    ) : (
                      <XCircleIcon className="w-3.5 h-3.5" />
                    )}
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <Input
            label={t('auth.resetPassword.confirmPassword', 'Confirm Password')}
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              if (fieldErrors.confirmPassword) setFieldErrors({ ...fieldErrors, confirmPassword: null })
            }}
            placeholder={t('auth.resetPassword.confirmPasswordPlaceholder', 'Confirm new password')}
            autoComplete="new-password"
          />
          {fieldErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{fieldErrors.confirmPassword}</p>}
        </div>

        <Button type="submit" variant="primary" className="w-full py-3" isLoading={loading}>
          {t('auth.resetPassword.updatePassword', 'Update Password')}
        </Button>
      </form>
    </div>
  )
}

export default ResetPassword
