import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/services/supabase'
import { Button, LoadingSpinner } from '@/components/ui'
import { EnvelopeIcon, ArrowLeftIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
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

const VerifyEmail = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [resendDisabled, setResendDisabled] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [verified, setVerified] = useState(false)

  // Get email from session storage and check verification status
  useEffect(() => {
    const storedEmail = sessionStorage.getItem('pendingVerificationEmail')

    if (!storedEmail) {
      // No pending verification - redirect to signup
      toast.error(t('auth.verifyEmail.noPendingVerification', 'No pending email verification found. Please sign up first.'))
      navigate('/register', { replace: true })
      return
    }

    setEmail(storedEmail)

    // Check if user is already verified
    const checkVerification = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.email_confirmed_at) {
          setVerified(true)
          sessionStorage.removeItem('pendingVerificationEmail') // Clean up
          setTimeout(() => {
            navigate('/login')
          }, 2000)
        }
      } catch (error) {
        logger.error('Error checking verification status:', error)
      } finally {
        setCheckingStatus(false)
      }
    }

    checkVerification()
  }, [navigate, t])

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else if (countdown === 0 && resendDisabled) {
      setResendDisabled(false)
    }
  }, [countdown, resendDisabled])

  const handleResendEmail = async () => {
    if (!email) return

    // Check client-side cooldown
    if (resendDisabled) {
      toast.error(t('auth.verifyEmail.resendCooldown', 'Please wait {{seconds}} seconds before resending.', { seconds: countdown }))
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      })

      if (error) {
        // Handle rate limit error from Supabase
        if (error.message?.includes('rate limit') || error.status === 429) {
          toast.error(t('auth.verifyEmail.rateLimited', 'Too many resend attempts. Please wait a few minutes before trying again.'))
          setResendDisabled(true)
          setCountdown(300) // 5 minutes cooldown on rate limit
        } else {
          throw error
        }
        return
      }

      toast.success(t('auth.verifyEmail.resendSuccess', 'Verification email resent! Check your inbox.'))
      setResendDisabled(true)
      setCountdown(60) // 60 seconds cooldown
    } catch (error) {
      logger.error('Resend verification email error:', error)
      toast.error(t('auth.verifyEmail.resendFailed', 'Failed to resend verification email. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const handleBackToLogin = () => {
    navigate('/login')
  }

  // Show loading while checking status
  if (checkingStatus) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (verified) {
    return (
      <div className="text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
          <CheckCircleIcon className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t('auth.verifyEmail.verifiedTitle', 'Email Verified!')}
        </h2>
        <p className="text-gray-600 mb-6">
          {t('auth.verifyEmail.verifiedDescription', 'Your email has been verified successfully. Redirecting to login...')}
        </p>
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    )
  }

  return (
    <div className="text-center">
      {/* Icon */}
      <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <EnvelopeIcon className="w-10 h-10 text-blue-600" />
      </div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        {t('auth.verifyEmail.title', 'Check your email')}
      </h2>

      {/* Description */}
      <p className="text-gray-600 mb-2">
        {t('auth.verifyEmail.description', 'We\'ve sent a verification link to')}
      </p>
      {email && (
        <p className="text-green-600 font-semibold mb-6">
          {maskEmail(email)}
        </p>
      )}
      <p className="text-gray-500 text-sm mb-8">
        {t('auth.verifyEmail.instructions', 'Click the link in the email to verify your account.')}
      </p>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-blue-900 mb-1">
              {t('auth.verifyEmail.helpTitle', 'Didn\'t receive the email?')}
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• {t('auth.verifyEmail.helpSpam', 'Check your spam or junk folder')}</li>
              <li>• {t('auth.verifyEmail.helpCorrectEmail', 'Make sure you entered the correct email')}</li>
              <li>• {t('auth.verifyEmail.helpWait', 'Wait a few minutes for delivery')}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Open Email App Link */}
      {email && (
        <a
          href={`mailto:${email}`}
          className="inline-flex items-center gap-2 text-sm text-green-600 hover:underline mb-4"
        >
          <EnvelopeIcon className="w-4 h-4" />
          {t('auth.verifyEmail.openEmailApp', 'Open email app')}
        </a>
      )}

      {/* Resend Button */}
      <Button
        variant="outline"
        className="w-full mb-3"
        onClick={handleResendEmail}
        isLoading={loading}
        disabled={resendDisabled}
      >
        {resendDisabled ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {t('auth.verifyEmail.resendIn', 'Resend in {{seconds}}s', { seconds: countdown })}
          </span>
        ) : (
          t('auth.verifyEmail.resendButton', 'Resend Verification Email')
        )}
      </Button>

      {/* Back to Login */}
      <button
        onClick={handleBackToLogin}
        className="flex items-center justify-center gap-2 w-full py-3 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        {t('auth.verifyEmail.backToLogin', 'Back to Login')}
      </button>
    </div>
  )
}

export default VerifyEmail
