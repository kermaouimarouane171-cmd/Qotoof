/**
 * 🛡️ Rate Limiting Utility
 * Prevents abuse by limiting the number of requests/actions
 * within a specific time window
 */

// ============================================
// 1. CLIENT-SIDE RATE LIMITER
// ============================================

class RateLimiter {
  constructor() {
    this.limits = new Map()
  }

  /**
   * Check if action is rate limited
   * @param {string} key - Unique identifier (user ID, IP, email)
   * @param {string} action - Action name (login, signup, etc.)
   * @param {number} maxAttempts - Maximum attempts allowed
   * @param {number} windowMs - Time window in milliseconds
   * @returns {object} { allowed: boolean, remaining: number, resetAt: Date }
   */
  check(key, action, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    const limitKey = `${key}:${action}`
    const now = Date.now()
    
    // Get or create limit record
    let record = this.limits.get(limitKey)

    if (!record || (now > record.resetAt && (!record.blockedUntil || now > record.blockedUntil))) {
      // First attempt or window expired (and any prior block has cleared)
      record = {
        count: 1,
        windowStart: now,
        resetAt: now + windowMs,
        blockedUntil: null
      }
      this.limits.set(limitKey, record)

      return {
        allowed: true,
        remaining: maxAttempts - 1,
        resetAt: new Date(record.resetAt),
        blockedUntil: null
      }
    }

    // Check if blocked
    if (record.blockedUntil && now < record.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(record.resetAt),
        blockedUntil: new Date(record.blockedUntil),
        retryAfter: record.blockedUntil - now
      }
    }

    // Increment count
    record.count++
    
    // Check if max attempts reached
    if (record.count > maxAttempts) {
      // Block for 30 minutes
      record.blockedUntil = now + 30 * 60 * 1000
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(record.resetAt),
        blockedUntil: new Date(record.blockedUntil),
        retryAfter: record.blockedUntil - now
      }
    }
    
    return {
      allowed: true,
      remaining: maxAttempts - record.count,
      resetAt: new Date(record.resetAt),
      blockedUntil: null
    }
  }

  /**
   * Reset rate limit for a key
   */
  reset(key, action) {
    const limitKey = `${key}:${action}`
    this.limits.delete(limitKey)
  }

  /**
   * Reset all rate limits
   */
  resetAll() {
    this.limits.clear()
  }

  /**
   * Clean expired records
   */
  cleanup() {
    const now = Date.now()
    for (const [key, record] of this.limits.entries()) {
      if (now > record.resetAt && (!record.blockedUntil || now > record.blockedUntil)) {
        this.limits.delete(key)
      }
    }
  }
}

// Create singleton instance
export const rateLimiter = new RateLimiter()

// Auto cleanup every 5 minutes
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000)

// ============================================
// 2. PREDEFINED RATE LIMITS
// ============================================

export const RATE_LIMITS = {
  // Authentication
  LOGIN: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDuration: 30 * 60 * 1000 // 30 minutes
  },
  
  SIGNUP: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDuration: 60 * 60 * 1000 // 1 hour
  },
  
  PASSWORD_RESET: {
    maxAttempts: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDuration: 60 * 60 * 1000 // 1 hour
  },
  
  MFA_VERIFY: {
    maxAttempts: 5,
    windowMs: 10 * 60 * 1000, // 10 minutes
    blockDuration: 15 * 60 * 1000 // 15 minutes
  },

  // Financial data changes
  BANK_ACCOUNT: {
    maxAttempts: 2,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDuration: 60 * 60 * 1000 // 1 hour
  },

  // API Calls
  API_CALLS: {
    maxAttempts: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDuration: 15 * 60 * 1000 // 15 minutes
  },
  
  FILE_UPLOAD: {
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDuration: 30 * 60 * 1000 // 30 minutes
  },
  
  // Vendor-specific
  PRODUCT_CREATE: {
    maxAttempts: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDuration: 30 * 60 * 1000 // 30 minutes
  },
  
  ORDER_UPDATE: {
    maxAttempts: 50,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDuration: 15 * 60 * 1000 // 15 minutes
  },

  // Public order tracking
  ORDER_TRACKING: {
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDuration: 30 * 60 * 1000 // 30 minutes
  },

  // Reviews
  REVIEW_CREATE: {
    maxAttempts: 5,
    windowMs: 10 * 60 * 1000, // 10 minutes
    blockDuration: 15 * 60 * 1000 // 15 minutes
  },

  REVIEW_REPLY: {
    maxAttempts: 10,
    windowMs: 10 * 60 * 1000, // 10 minutes
    blockDuration: 15 * 60 * 1000 // 15 minutes
  },

  // Chat - message sending
  CHAT_MESSAGE_SEND: {
    maxAttempts: 30,
    windowMs: 10 * 60 * 1000, // 10 minutes
    blockDuration: 5 * 60 * 1000 // 5 minutes
  },

  // Chat - conversation creation
  CHAT_CONVERSATION_CREATE: {
    maxAttempts: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDuration: 30 * 60 * 1000 // 30 minutes
  },

  // Chat - file upload
  CHAT_FILE_UPLOAD: {
    maxAttempts: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDuration: 15 * 60 * 1000 // 15 minutes
  },

  // Commissions - payment notice submission (vendor → admin)
  COMMISSION_PAYMENT_NOTICE: {
    maxAttempts: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
    blockDuration: 30 * 60 * 1000 // 30 minutes
  }
}

// ============================================
// 3. RATE LIMIT CHECKERS
// ============================================

/**
 * Check login rate limit
 */
export const checkLoginRate = (identifier) => {
  return rateLimiter.check(
    identifier,
    'login',
    RATE_LIMITS.LOGIN.maxAttempts,
    RATE_LIMITS.LOGIN.windowMs
  )
}

/**
 * Check signup rate limit
 */
export const checkSignupRate = (identifier) => {
  return rateLimiter.check(
    identifier,
    'signup',
    RATE_LIMITS.SIGNUP.maxAttempts,
    RATE_LIMITS.SIGNUP.windowMs
  )
}

/**
 * Check password reset rate limit
 */
export const checkPasswordResetRate = (identifier) => {
  return rateLimiter.check(
    identifier,
    'password_reset',
    RATE_LIMITS.PASSWORD_RESET.maxAttempts,
    RATE_LIMITS.PASSWORD_RESET.windowMs
  )
}

/**
 * Check MFA verification rate limit
 */
export const checkMFARate = (identifier) => {
  return rateLimiter.check(
    identifier,
    'mfa_verify',
    RATE_LIMITS.MFA_VERIFY.maxAttempts,
    RATE_LIMITS.MFA_VERIFY.windowMs
  )
}

/**
 * Check bank account change rate limit (max 2 per hour)
 */
export const checkBankAccountRate = (identifier) => {
  return rateLimiter.check(
    identifier,
    'bank_account',
    RATE_LIMITS.BANK_ACCOUNT.maxAttempts,
    RATE_LIMITS.BANK_ACCOUNT.windowMs
  )
}

/**
 * Check API call rate limit
 */
export const checkAPIRate = (identifier) => {
  return rateLimiter.check(
    identifier,
    'api_call',
    RATE_LIMITS.API_CALLS.maxAttempts,
    RATE_LIMITS.API_CALLS.windowMs
  )
}

/**
 * Check product creation rate limit
 */
export const checkProductCreateRate = (userId) => {
  return rateLimiter.check(
    userId,
    'product_create',
    RATE_LIMITS.PRODUCT_CREATE.maxAttempts,
    RATE_LIMITS.PRODUCT_CREATE.windowMs
  )
}

/**
 * Check order tracking rate limit
 */
export const checkOrderTrackingRate = (identifier) => {
  return rateLimiter.check(
    identifier,
    'order_tracking',
    RATE_LIMITS.ORDER_TRACKING.maxAttempts,
    RATE_LIMITS.ORDER_TRACKING.windowMs
  )
}

/**
 * Check review creation rate limit (5 per 10 minutes)
 */
export const checkReviewCreateRate = (userId) => {
  return rateLimiter.check(
    userId,
    'review_create',
    RATE_LIMITS.REVIEW_CREATE.maxAttempts,
    RATE_LIMITS.REVIEW_CREATE.windowMs
  )
}

/**
 * Check review reply rate limit (10 per 10 minutes)
 */
export const checkReviewReplyRate = (vendorId) => {
  return rateLimiter.check(
    vendorId,
    'review_reply',
    RATE_LIMITS.REVIEW_REPLY.maxAttempts,
    RATE_LIMITS.REVIEW_REPLY.windowMs
  )
}

/**
 * Check chat message send rate limit (30 per 10 minutes)
 */
export const checkChatMessageSendRate = (userId) => {
  return rateLimiter.check(
    userId,
    'chat_message_send',
    RATE_LIMITS.CHAT_MESSAGE_SEND.maxAttempts,
    RATE_LIMITS.CHAT_MESSAGE_SEND.windowMs
  )
}

/**
 * Check chat conversation creation rate limit (10 per hour)
 */
export const checkChatConversationCreateRate = (userId) => {
  return rateLimiter.check(
    userId,
    'chat_conversation_create',
    RATE_LIMITS.CHAT_CONVERSATION_CREATE.maxAttempts,
    RATE_LIMITS.CHAT_CONVERSATION_CREATE.windowMs
  )
}

/**
 * Check chat file upload rate limit (20 per hour)
 */
export const checkChatFileUploadRate = (userId) => {
  return rateLimiter.check(
    userId,
    'chat_file_upload',
    RATE_LIMITS.CHAT_FILE_UPLOAD.maxAttempts,
    RATE_LIMITS.CHAT_FILE_UPLOAD.windowMs
  )
}

/**
 * Check commission payment notice rate limit (5 per hour per vendor)
 */
export const checkCommissionPaymentNoticeRate = (vendorId) => {
  return rateLimiter.check(
    vendorId,
    'commission_payment_notice',
    RATE_LIMITS.COMMISSION_PAYMENT_NOTICE.maxAttempts,
    RATE_LIMITS.COMMISSION_PAYMENT_NOTICE.windowMs
  )
}

// ============================================
// 4. RATE LIMIT ERROR
// ============================================

export class RateLimitError extends Error {
  constructor(message, retryAfter) {
    super(message)
    this.name = 'RateLimitError'
    this.retryAfter = retryAfter
    this.statusCode = 429
  }
}

/**
 * Throw rate limit error if not allowed
 */
export const enforceRateLimit = (checkFn, identifier) => {
  const result = checkFn(identifier)
  
  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil(result.retryAfter / 1000)
    throw new RateLimitError(
      `Too many attempts. Please try again in ${retryAfterSeconds} seconds.`,
      result.retryAfter
    )
  }
  
  return result
}

// ============================================
// 5. HIGHER-ORDER FUNCTION FOR RATE LIMITING
// ============================================

/**
 * Wrap a function with rate limiting
 * @param {Function} fn - Function to wrap
 * @param {Function} rateCheckFn - Rate limit check function
 * @param {Function} identifierFn - Function to get identifier from arguments
 */
export const withRateLimit = (fn, rateCheckFn, identifierFn) => {
  return async (...args) => {
    const identifier = identifierFn(...args)
    
    // Check rate limit
    const result = rateCheckFn(identifier)
    
    if (!result.allowed) {
      const retryAfterSeconds = Math.ceil(result.retryAfter / 1000)
      throw new RateLimitError(
        `Rate limit exceeded. Try again in ${retryAfterSeconds}s`,
        result.retryAfter
      )
    }
    
    // Execute function
    return await fn(...args)
  }
}

// ============================================
// 6. REACT HOOK FOR RATE LIMITING
// ============================================

import { useState, useCallback } from 'react'

/**
 * React hook for rate-limited actions
 * @param {Function} action - Action name
 * @param {object} options - Rate limit options
 */
export const useRateLimit = (action = 'default', options = {}) => {
  const [isLimited, setIsLimited] = useState(false)
  const [retryAfter, setRetryAfter] = useState(null)
  const [remaining, setRemaining] = useState(options.maxAttempts || 5)

  const check = useCallback((identifier) => {
    const result = rateLimiter.check(
      identifier,
      action,
      options.maxAttempts || 5,
      options.windowMs || 15 * 60 * 1000
    )
    
    setIsLimited(!result.allowed)
    setRetryAfter(result.blockedUntil ? result.retryAfter : null)
    setRemaining(result.remaining)
    
    return result
  }, [action, options])

  const reset = useCallback((identifier) => {
    rateLimiter.reset(identifier, action)
    setIsLimited(false)
    setRetryAfter(null)
    setRemaining(options.maxAttempts || 5)
  }, [action, options.maxAttempts])

  return {
    isLimited,
    retryAfter,
    remaining,
    check,
    reset
  }
}

// ============================================
// Default export
// ============================================
export default {
  rateLimiter,
  RATE_LIMITS,
  checkLoginRate,
  checkSignupRate,
  checkPasswordResetRate,
  checkMFARate,
  checkBankAccountRate,
  checkAPIRate,
  checkProductCreateRate,
  checkOrderTrackingRate,
  checkReviewCreateRate,
  checkReviewReplyRate,
  checkChatMessageSendRate,
  checkChatConversationCreateRate,
  checkChatFileUploadRate,
  checkCommissionPaymentNoticeRate,
  RateLimitError,
  enforceRateLimit,
  withRateLimit,
  useRateLimit
}
