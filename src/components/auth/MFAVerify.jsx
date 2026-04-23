import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { mfaService } from '@/services/authServices'
import { supabase } from '@/services/supabase'
import { ShieldCheckIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

// Helper to mask email for privacy
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email
  const [name, domain] = email.split('@')
  if (name.length < 2) return `***@${domain}`
  const maskedName = name.charAt(0) + '***' + name.charAt(name.length - 1)
  return `${maskedName}@${domain}`
}

const MFAVerify = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { verifyMFA, user, signOut } = useAuthStore()
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checkingMFA, setCheckingMFA] = useState(true)
  const [mfaMethod, setMfaMethod] = useState('email')

  // SECURITY: Persist attempts in sessionStorage (survives page refresh)
  const [attempts, setAttempts] = useState(() => {
    const stored = sessionStorage.getItem('mfa_attempts')
    return stored ? parseInt(stored, 10) : 0
  })
  const [maxAttempts] = useState(5)

  // SECURITY: Track lockout state in sessionStorage
  const [isLocked, setIsLocked] = useState(() => {
    const stored = sessionStorage.getItem('mfa_locked_until')
    if (stored) {
      const unlockTime = parseInt(stored, 10)
      if (Date.now() < unlockTime) {
        return true
      } else {
        sessionStorage.removeItem('mfa_locked_until')
        sessionStorage.removeItem('mfa_attempts')
        return false
      }
    }
    return false
  })

  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setCanResend(true)
    }
  }, [countdown])

  // Check if user is authenticated and MFA is required
  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    // Check MFA method
    const checkMFAMethod = async () => {
      try {
        const settings = await mfaService.getSettings()
        if (settings?.method === 'totp') {
          setMfaMethod('totp')
        }
      } catch (error) {
        logger.error('Error checking MFA method:', error)
      } finally {
        setCheckingMFA(false)
      }
    }

    checkMFAMethod()
  }, [user, navigate])

  // Auto-focus first input
  useEffect(() => {
    document.getElementById('mfa-code-0')?.focus()
  }, [])

  const handleCodeChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value

    setCode(newCode)
    setError('')

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`mfa-code-${index + 1}`)
      if (nextInput) nextInput.focus()
    }
  }

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prevInput = document.getElementById(`mfa-code-${index - 1}`)
      if (prevInput) prevInput.focus()
    }

    // Handle paste
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      navigator.clipboard.readText().then(text => {
        const digits = text.replace(/\D/g, '').slice(0, 6)
        if (digits.length === 6) {
          const newCode = digits.split('')
          setCode(newCode)
          // Focus last input
          document.getElementById('mfa-code-5')?.focus()
        }
      })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const codeString = code.join('')
    if (codeString.length !== 6) {
      setError(t('auth.mfa.errors.incompleteCode', 'Please enter all 6 digits'))
      return
    }

    // SECURITY: Check if account is locked
    if (isLocked) {
      const unlockTime = parseInt(sessionStorage.getItem('mfa_locked_until'), 10)
      const remainingMs = unlockTime - Date.now()
      const remainingMin = Math.ceil(remainingMs / 60000)
      setError(t('auth.mfa.errors.accountLocked', 'Account locked. Please try again in {{minutes}} minute(s).', { minutes: remainingMin }))
      return
    }

    if (attempts >= maxAttempts) {
      // Lock account for 15 minutes
      const lockUntil = Date.now() + 15 * 60 * 1000
      sessionStorage.setItem('mfa_locked_until', lockUntil.toString())
      setIsLocked(true)
      setError(t('auth.mfa.errors.tooManyAttempts', 'Too many attempts. Your account has been locked for 15 minutes.'))

      // Redirect to login after 3 seconds
      setTimeout(async () => {
        await signOut()
        navigate('/login')
      }, 3000)
      return
    }

    try {
      setLoading(true)
      setError('')

      const result = await verifyMFA(codeString)

      if (result.success) {
        toast.success(t('auth.mfa.success', 'Authentication verified!'))
        // Clean up session storage
        sessionStorage.removeItem('mfa_attempts')
        sessionStorage.removeItem('mfa_locked_until')
        navigate(result.redirect || '/vendor/dashboard')
      } else {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        sessionStorage.setItem('mfa_attempts', newAttempts.toString())

        // SECURITY: Check if error indicates rate limit/lockout
        if (result.error?.includes('Too many attempts') || result.error?.includes('rate limit')) {
          // Server-side lockout - lock for 15 minutes
          const lockUntil = Date.now() + 15 * 60 * 1000
          sessionStorage.setItem('mfa_locked_until', lockUntil.toString())
          setIsLocked(true)
          setError(t('auth.mfa.errors.serverLocked', 'Too many attempts. Your account has been locked for 15 minutes. Please try again later.'))

          // Redirect to login after 3 seconds
          setTimeout(async () => {
            await signOut()
            navigate('/login')
          }, 3000)
        } else {
          setError(result.error || t('auth.mfa.errors.invalidCode', 'Invalid code'))
        }

        // Clear inputs
        setCode(['', '', '', '', '', ''])
        document.getElementById('mfa-code-0')?.focus()
      }
    } catch (error) {
      logger.error('MFA verification error:', error)
      setError(t('auth.mfa.errors.verificationFailed', 'Failed to verify code'))
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (!canResend || !user) return

    // Don't allow resend if locked
    if (isLocked) return

    setLoading(true)
    try {
      // Only resend for email-based MFA
      if (mfaMethod === 'email') {
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: user.email,
        })

        if (error) {
          if (error.message?.includes('rate limit') || error.status === 429) {
            toast.error(t('auth.mfa.errors.resendRateLimited', 'Too many resend attempts. Please wait a few minutes.'))
            setCountdown(300) // 5 minutes cooldown
          } else {
            throw error
          }
          return
        }
      }

      setCountdown(60)
      setCanResend(false)
      toast.success(t('auth.mfa.resendSuccess', 'New code sent to your email!'))
    } catch (error) {
      logger.error('Resend MFA code error:', error)
      toast.error(t('auth.mfa.errors.resendFailed', 'Failed to resend code. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    await signOut()
    navigate('/login')
  }

  // Show loading while checking MFA status
  if (checkingMFA) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-200 rounded-full animate-spin border-t-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('auth.mfa.checkingMFA', 'Checking MFA status...')}</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldCheckIcon className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {t('auth.mfa.title', 'Two-Factor Authentication')}
            </h1>
            <p className="text-gray-600">
              {mfaMethod === 'totp'
                ? t('auth.mfa.totpDescription', 'Enter the 6-digit code from your authenticator app')
                : t('auth.mfa.emailDescription', 'Enter the 6-digit code sent to {{email}}', { email: maskEmail(user?.email) })}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Code Inputs */}
            <div className="flex justify-center gap-2">
              {code.map((digit, index) => (
                <input
                  key={index}
                  id={`mfa-code-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all"
                  autoComplete="off"
                  aria-label={`Digit ${index + 1}`}
                />
              ))}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center" role="alert">
                <p className="text-sm text-red-600">{error}</p>
                {!isLocked && (
                  <p className="text-xs text-gray-600 mt-1">
                    {t('auth.mfa.attemptsRemaining', 'Attempts remaining: {{count}}', { count: maxAttempts - attempts })}
                  </p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || code.join('').length !== 6 || isLocked}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('auth.mfa.verifying', 'Verifying...')}
                </span>
              ) : (
                t('auth.mfa.verifyButton', 'Verify Code')
              )}
            </button>

            {/* Resend Code */}
            <div className="text-center">
              {canResend && !isLocked ? (
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading}
                  className="text-green-600 hover:text-green-700 font-medium text-sm disabled:opacity-50"
                >
                  {t('auth.mfa.resendCode', 'Resend Code')}
                </button>
              ) : isLocked ? (
                <p className="text-sm text-red-600 font-medium">
                  {t('auth.mfa.accountLocked', 'Account locked. Please try again later.')}
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  {t('auth.mfa.resendIn', 'Resend code in {{seconds}}s', { seconds: countdown })}
                </p>
              )}
            </div>

            {/* Cancel */}
            <button
              type="button"
              onClick={handleCancel}
              className="w-full text-gray-600 hover:text-gray-700 text-sm font-medium"
            >
              {t('auth.mfa.cancelAndSignOut', 'Cancel and Sign Out')}
            </button>
          </form>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {t('auth.mfa.helpText', 'Didn\'t receive the code? Check your spam folder')}
          </p>
        </div>

        {/* Back to Login Link */}
        <div className="mt-4 text-center">
          <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">
            ← {t('auth.mfa.backToLogin', 'Back to Login')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default MFAVerify
