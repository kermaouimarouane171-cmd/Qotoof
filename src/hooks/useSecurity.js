/**
 * useSecurity — shared security page data hook
 *
 * Encapsulates the state and data-loading logic common to all three security
 * pages (buyer, driver, vendor).  Each page keeps its own handlers for
 * actions whose toast messages / side-effects differ by role.
 *
 * Returns:
 *   mfaSettings    — current MFA configuration (or null while loading)
 *   sessionCount   — number of active sessions
 *   loading        — true while the initial data fetch is in progress
 *   disablingMFA   — true while a disable-MFA request is in flight
 *   setDisablingMFA — setter so pages can toggle the flag from their own handlers
 *   loadSecurityData — async function to refresh all security data
 */

import { useState, useCallback, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { logger } from '@/utils/logger'

export const useSecurity = () => {
  const { getMFASettings, getActiveSessions } = useAuthStore()

  const [mfaSettings, setMfaSettings] = useState(null)
  const [sessionCount, setSessionCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [disablingMFA, setDisablingMFA] = useState(false)

  const loadSecurityData = useCallback(async () => {
    try {
      setLoading(true)
      const mfa = await getMFASettings()
      setMfaSettings(mfa)

      const sessions = await getActiveSessions()
      setSessionCount(sessions.length)
    } catch (error) {
      logger.error('Load security data error:', error)
    } finally {
      setLoading(false)
    }
  }, [getMFASettings, getActiveSessions])

  useEffect(() => {
    loadSecurityData()
  }, [loadSecurityData])

  return { mfaSettings, sessionCount, loading, disablingMFA, setDisablingMFA, loadSecurityData }
}

// ─────────────────────────────────────────────────────────────────────────────
// Password strength validation — role-agnostic, caller supplies i18n t()
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a password and returns { valid, errors[], strength }.
 *
 * @param {string} password - The password string to validate
 * @param {Function} t - i18next translate function from the calling component
 * @param {string} ns - Namespace prefix for error messages, e.g. 'buyerSecurity.errors'
 */
export const validatePasswordStrength = (password, t, ns = 'security.errors') => {
  const errors = []
  const key = (suffix, fallback) => t(`${ns}.${suffix}`, fallback)

  if (password.length < 8)
    errors.push(key('passwordTooShort', 'Password must be at least 8 characters'))
  if (password.length > 128)
    errors.push(key('passwordTooLong', 'Password must be less than 128 characters'))
  if (!/[A-Z]/.test(password))
    errors.push(key('passwordNeedsUppercase', 'Password must contain at least one uppercase letter'))
  if (!/[a-z]/.test(password))
    errors.push(key('passwordNeedsLowercase', 'Password must contain at least one lowercase letter'))
  if (!/[0-9]/.test(password))
    errors.push(key('passwordNeedsNumber', 'Password must contain at least one number'))
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password))
    errors.push(key('passwordNeedsSpecial', 'Password must contain at least one special character'))

  const COMMON_PASSWORDS = ['password', '12345678', 'qwerty123', 'admin123']
  if (COMMON_PASSWORDS.includes(password.toLowerCase()))
    errors.push(key('passwordTooCommon', 'Password is too common'))

  return {
    valid: errors.length === 0,
    errors,
    strength: errors.length === 0 ? 'strong' : errors.length <= 2 ? 'medium' : 'weak',
  }
}
