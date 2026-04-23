/**
 * 🛡️ CSRF Protection Utilities
 * Prevents Cross-Site Request Forgery attacks
 */

import { secureStorage, generateSecureRandom } from '@/utils/encryption'
import { logger } from '@/utils/logger'

// ============================================
// 1. CSRF TOKEN MANAGEMENT
// ============================================

const CSRF_TOKEN_KEY = 'csrf_token'
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000 // 1 hour

/**
 * Generate a new CSRF token
 */
export const generateCSRFToken = () => {
  const token = generateSecureRandom(32)
  const timestamp = Date.now()

  const tokenData = {
    token,
    timestamp,
    expiresAt: timestamp + CSRF_TOKEN_EXPIRY,
  }

  // Store in secure session storage
  secureStorage.set(CSRF_TOKEN_KEY, tokenData, CSRF_TOKEN_EXPIRY)

  return token
}

/**
 * Get current CSRF token
 */
export const getCSRFToken = () => {
  const tokenData = secureStorage.get(CSRF_TOKEN_KEY)

  if (!tokenData) {
    return generateCSRFToken()
  }

  // Check if token is expired
  if (Date.now() > tokenData.expiresAt) {
    return generateCSRFToken()
  }

  return tokenData.token
}

/**
 * Validate CSRF token
 */
export const validateCSRFToken = (token) => {
  if (!token) return false

  const tokenData = secureStorage.get(CSRF_TOKEN_KEY)

  if (!tokenData) return false

  // Check if token is expired
  if (Date.now() > tokenData.expiresAt) {
    return false
  }

  // Compare tokens using constant-time comparison
  return constantTimeCompare(token, tokenData.token)
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export const constantTimeCompare = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false

  if (a.length !== b.length) return false

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

// ============================================
// 2. CSRF PROTECTION FOR FETCH REQUESTS
// ============================================

/**
 * Add CSRF token to fetch request
 */
export const withCSRFToken = async (url, options = {}) => {
  const token = getCSRFToken()

  const headers = {
    ...options.headers,
    'X-CSRF-Token': token,
    'X-Requested-With': 'XMLHttpRequest',
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'same-origin', // Include cookies
  })
}

/**
 * CSRF-protected POST request
 */
export const csrfPost = async (url, data = {}, options = {}) => {
  const token = getCSRFToken()

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token,
      'X-Requested-With': 'XMLHttpRequest',
      ...options.headers,
    },
    body: JSON.stringify(data),
    credentials: 'same-origin',
    ...options,
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// ============================================
// 3. CSRF PROTECTION FOR SUPABASE
// ============================================

/**
 * Add CSRF token to Supabase request headers
 */
export const getSupabaseHeaders = () => {
  const token = getCSRFToken()

  return {
    'X-CSRF-Token': token,
    'X-Requested-With': 'XMLHttpRequest',
  }
}

// ============================================
// 4. CSRF VALIDATION MIDDLEWARE (for server)
// ============================================

/**
 * Validate CSRF token from request
 * Note: This should be implemented server-side
 */
export const createCSRFValidator = (getTokenFromRequest) => {
  return (req, res, next) => {
    const token = getTokenFromRequest(req)

    if (!validateCSRFToken(token)) {
      return res.status(403).json({
        error: 'Invalid or expired CSRF token',
        code: 'CSRF_TOKEN_INVALID',
      })
    }

    next()
  }
}

// ============================================
// 5. CSRF TOKEN REFRESH
// ============================================

/**
 * Refresh CSRF token
 */
export const refreshCSRFToken = () => {
  return generateCSRFToken()
}

/**
 * Auto-refresh token before expiry
 */
export const startAutoRefresh = (interval = 50 * 60 * 1000) => {
  // Refresh every 50 minutes (before 1 hour expiry)
  const refreshInterval = setInterval(() => {
    generateCSRFToken()
    logger.log('CSRF token auto-refreshed')
  }, interval)

  return () => clearInterval(refreshInterval)
}

// ============================================
// 6. REACT HOOKS
// ============================================

import { useEffect, useCallback } from 'react'

/**
 * Hook to get CSRF token
 */
export const useCSRFToken = () => {
  return useCallback(() => getCSRFToken(), [])
}

/**
 * Hook to initialize CSRF protection
 */
export const useCSRFProtection = () => {
  useEffect(() => {
    // Generate initial token
    getCSRFToken()

    // Auto-refresh
    const cleanup = startAutoRefresh()
    return cleanup
  }, [])

  return {
    getCSRFToken,
    refreshCSRFToken,
  }
}

// ============================================
// 7. CSRF-PROTECTED FORM COMPONENT
// ============================================

import { useState } from 'react'

/**
 * CSRFProtectedForm - Form component with CSRF protection
 */
export const CSRFProtectedForm = ({
  action,
  method = 'POST',
  onSubmit,
  children,
  className = '',
  ...props
}) => {
  const [token] = useState(getCSRFToken())

  const handleSubmit = async (e) => {
    e.preventDefault()

    const formData = new FormData(e.target)
    const data = Object.fromEntries(formData.entries())

    try {
      const response = await csrfPost(action, {
        ...data,
        _csrf_token: token,
      })

      onSubmit?.(response)
    } catch (error) {
      logger.error('CSRF form submission error:', error)
      throw error
    }
  }

  return (
    <form
      action={action}
      method={method}
      onSubmit={handleSubmit}
      className={className}
      {...props}
    >
      {/* Hidden CSRF token field */}
      <input
        type="hidden"
        name="_csrf_token"
        value={token}
      />

      {children}
    </form>
  )
}

// ============================================
// Default export
// ============================================
export default {
  generateCSRFToken,
  getCSRFToken,
  validateCSRFToken,
  withCSRFToken,
  csrfPost,
  getSupabaseHeaders,
  createCSRFValidator,
  refreshCSRFToken,
  startAutoRefresh,
  useCSRFToken,
  useCSRFProtection,
  CSRFProtectedForm,
}
