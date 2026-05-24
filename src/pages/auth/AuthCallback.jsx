import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { LoadingSpinner } from '@/components/ui'
import { resolveSafeAuthRedirect } from '@/utils/authRedirects'
import { logger } from '@/utils/logger'

// ============================================
// Constants
// ============================================

const CALLBACK_TIMEOUT_MS = 15000 // 15 seconds
const EXPECTED_STATE_PREFIX = 'oauth_'
const OAUTH_STATE_STORAGE_KEY = 'oauth_state'

// ============================================
// Helpers
// ============================================

/**
 * Parse OAuth error parameters from URL hash or query string
 * OAuth providers return errors like:
 *   #error=access_denied&error_description=User+denied+consent
 *   ?error=provider_error&error_description=Internal+error
 */
const parseOAuthError = (search, hash) => {
  const params = new URLSearchParams(search)
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)

  const error = params.get('error') || hashParams.get('error')
  const errorDescription = params.get('error_description') || hashParams.get('error_description')
  const provider = params.get('provider') || hashParams.get('provider')

  if (!error) return null

  return { error, errorDescription, provider }
}

/**
 * Validate OAuth state parameter to prevent CSRF attacks
 * The state should match what was stored before redirecting to the provider
 */
const validateOAuthState = (search, hash) => {
  const params = new URLSearchParams(search)
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)

  const state = params.get('state') || hashParams.get('state')
  const storedState = sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY)

  if (!state) {
    sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY)
    // No state parameter — could be a direct navigation or CSRF attempt
    logger.warn('OAuth callback missing state parameter')
    return { valid: false, reason: 'missing_state' }
  }

  // Validate state format (should start with our prefix)
  if (!state.startsWith(EXPECTED_STATE_PREFIX)) {
    sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY)
    logger.warn('OAuth callback state parameter has unexpected format:', state.substring(0, 10))
    return { valid: false, reason: 'invalid_state_format' }
  }

  if (!storedState) {
    logger.error('OAuth callback state parameter was provided without a stored browser state')
    return { valid: false, reason: 'missing_stored_state' }
  }

  // Check against stored state saved before redirect
  if (storedState !== state) {
    sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY)
    logger.error('OAuth state mismatch! Expected:', storedState.substring(0, 10), 'Got:', state.substring(0, 10))
    return { valid: false, reason: 'state_mismatch' }
  }

  // Clean up stored state
  sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY)

  return { valid: true }
}

/**
 * Get user-friendly error message for OAuth errors
 */
const getOAuthErrorMessage = (error, errorDescription) => {
  switch (error) {
    case 'access_denied':
      return 'You denied the sign-in request. Please try again and grant the necessary permissions.'
    case 'provider_error':
      return `The authentication provider encountered an error. Please try again.${errorDescription ? ` (${errorDescription})` : ''}`
    case 'server_error':
      return 'The authentication server encountered an error. Please try again later.'
    case 'temporarily_unavailable':
      return 'The authentication service is temporarily unavailable. Please try again later.'
    case 'invalid_request':
      return 'The authentication request was invalid. Please try again.'
    case 'unauthorized_client':
      return 'This application is not authorized to use this authentication method.'
    case 'unsupported_response_type':
      return 'The authentication method is not supported. Please contact support.'
    case 'invalid_scope':
      return 'The requested permissions are invalid. Please contact support.'
    default:
      return errorDescription || 'An unexpected error occurred during authentication.'
  }
}

const AuthCallback = () => {
  const navigate = useNavigate()
  const _location = useLocation()
  const { initialize, profile, loading } = useAuthStore()
  const [error, setError] = useState(null)
  const [errorType, setErrorType] = useState('') // 'oauth' | 'session' | 'timeout' | 'profile'

  // ============================================
  // Main Callback Handler
  // ============================================

  const handleCallback = useCallback(async () => {
    const search = window.location.search
    const hash = window.location.hash

    // 1. Check for OAuth error parameters first
    const oauthError = parseOAuthError(search, hash)
    if (oauthError) {
      const message = getOAuthErrorMessage(oauthError.error, oauthError.errorDescription)
      setError(message)
      setErrorType('oauth')
      logger.error('OAuth callback error:', oauthError)
      return
    }

    // 2. Validate OAuth state parameter (CSRF prevention)
    const stateValidation = validateOAuthState(search, hash)
    if (!stateValidation.valid) {
      switch (stateValidation.reason) {
        case 'missing_state':
          // Could be an email verification link (no OAuth) — proceed normally
          break
        case 'missing_stored_state':
        case 'invalid_state_format':
        case 'state_mismatch':
          setError('Security check failed. The authentication request may have been tampered with. Please try signing in again.')
          setErrorType('oauth')
          logger.error('OAuth state validation failed:', stateValidation.reason)
          return
        default:
          break
      }
    }

    try {
      // 3. Check session with timeout
      const sessionPromise = supabase.auth.getSession()
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session check timed out')), CALLBACK_TIMEOUT_MS)
      )

      const { data: { session: _session }, error: sessionError } = await Promise.race([
        sessionPromise,
        timeoutPromise,
      ])

      if (sessionError) {
        if (sessionError.message?.includes('expired')) {
          setError('This verification link has expired. Please request a new one.')
          setErrorType('session')
        } else if (sessionError.message?.includes('invalid')) {
          setError('This verification link is invalid or has already been used.')
          setErrorType('session')
        } else {
          setError('Failed to complete authentication. Please try again.')
          setErrorType('session')
        }
        return
      }

      // 4. Initialize auth store with timeout
      const initPromise = initialize()
      const initTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth initialization timed out')), CALLBACK_TIMEOUT_MS)
      )

      await Promise.race([initPromise, initTimeoutPromise])
    } catch (err) {
      logger.error('Auth callback error:', err)

      if (err.message?.includes('timed out')) {
        setError('Authentication is taking longer than expected. Please check your connection and try again.')
        setErrorType('timeout')
      } else {
        setError('Failed to complete authentication. Please try again.')
        setErrorType('session')
      }
    }
  }, [initialize])

  useEffect(() => {
    handleCallback()
  }, [handleCallback])

  // ============================================
  // Redirect After Successful Auth
  // ============================================

  useEffect(() => {
    if (!loading && profile) {
      const params = new URLSearchParams(window.location.search)
      const redirectTo = params.get('redirect_to') || sessionStorage.getItem('redirect_after_verification')

      if (redirectTo) {
        sessionStorage.removeItem('redirect_after_verification')
      }

      const redirectPath = resolveSafeAuthRedirect(
        redirectTo,
        useAuthStore.getState().getRedirectPath(profile.role)
      )
      navigate(redirectPath, { replace: true })
    }
  }, [profile, loading, navigate])

  // ============================================
  // Error Display
  // ============================================

  if (error) {
    const isOAuthError = errorType === 'oauth'
    const isTimeoutError = errorType === 'timeout'

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
            isTimeoutError ? 'bg-amber-100' : 'bg-red-100'
          }`}>
            <svg className={`w-8 h-8 ${isTimeoutError ? 'text-amber-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            {isOAuthError
              ? 'Authentication Failed'
              : isTimeoutError
                ? 'Authentication Timeout'
                : 'Verification Failed'}
          </h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => navigate('/login')}
              className="btn-primary"
            >
              Back to Login
            </button>
            {isOAuthError && (
              <button
                onClick={() => navigate('/register')}
                className="btn-outline"
              >
                Try Different Method
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // Loading State
  // ============================================

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">
          Completing sign in...
        </p>
      </div>
    </div>
  )
}

export default AuthCallback
