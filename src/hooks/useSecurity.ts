/**
 * @fileoverview Shared role-agnostic security hooks.
 */

import { useState, useCallback, useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { auditLogger } from '@/services/auditLogger'
import { logger } from '@/utils/logger'

type TranslateFn = (key: string, fallback?: string) => string

type PasswordStrengthLabel = 'weak' | 'medium' | 'strong'

type SecuritySession = {
  [key: string]: unknown
}

type SecurityMFASettings = {
  [key: string]: unknown
} | null

type PasswordChecks = {
  minLength: boolean
  uppercase: boolean
  lowercase: boolean
  number: boolean
  special: boolean
}

type PasswordScore = 0 | 1 | 2 | 3 | 4 | 5

type PasswordStrengthResult = {
  score: PasswordScore
  checks: PasswordChecks
  label: 'weak' | 'fair' | 'good' | 'strong' | 'very strong'
  color: string
}

type SecurityDataResult = {
  mfaSettings: SecurityMFASettings
  sessions: SecuritySession[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

type SecurityActionResult = {
  success?: boolean
  error?: string
}

type SecurityActionsResult = {
  disableMFA: () => Promise<void>
  enableMFA: () => Promise<void>
  revokeAllSessions: () => Promise<void>
  isPending: boolean
  error: string | null
}

type PasswordChangeResult = {
  success: boolean
  error?: string
}

type PasswordChangeHookResult = {
  changePassword: (oldPassword: string, newPassword: string) => Promise<PasswordChangeResult>
  isPending: boolean
  error: string | null
  success: boolean
  reset: () => void
}

type SecurityHookResult = {
  mfaSettings: SecurityMFASettings
  sessionCount: number
  loading: boolean
  disablingMFA: boolean
  setDisablingMFA: React.Dispatch<React.SetStateAction<boolean>>
  loadSecurityData: () => Promise<void>
}

// Backward-compatible export retained for pages that still consume this shape.
export const useSecurity = (): SecurityHookResult => {
  const { mfaSettings, sessions, loading, reload } = useSecurityData()
  const [disablingMFA, setDisablingMFA] = useState(false)

  return {
    mfaSettings,
    sessionCount: sessions.length,
    loading,
    disablingMFA,
    setDisablingMFA,
    loadSecurityData: reload,
  }
}

/**
 * Validates a password and returns { valid, errors[], strength }.
 *
 * @param {string} password - The password string to validate
 * @param {Function} t - i18next translate function from the calling component
 * @param {string} ns - Namespace prefix for error messages, e.g. 'buyerSecurity.errors'
 */
export const validatePasswordStrength = (
  password: string,
  t: TranslateFn,
  ns: string = 'security.errors',
): { valid: boolean; errors: string[]; strength: PasswordStrengthLabel } => {
  const errors: string[] = []
  const key = (suffix, fallback) => t(`${ns}.${suffix}`, fallback)

  if (password.length < 8)
    errors.push(key('passwordTooShort', 'Password must be 8 characters minimum'))
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

  const shortPassword = password.length < 8

  return {
    valid: errors.length === 0,
    errors,
    strength: shortPassword ? 'weak' : errors.length === 0 ? 'strong' : errors.length <= 2 ? 'medium' : 'weak',
  }
}

/**
 * Loads MFA settings and active sessions from authStore.
 *
 * @returns {{
 *   mfaSettings: object|null,
 *   sessions: object[],
 *   loading: boolean,
 *   error: string|null,
 *   reload: () => Promise<void>
 * }}
 */
export const useSecurityData = (): SecurityDataResult => {
  const { getMFASettings, getActiveSessions } = useAuthStore()
  const [mfaSettings, setMfaSettings] = useState<SecurityMFASettings>(null)
  const [sessions, setSessions] = useState<SecuritySession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    setLoading(true)

    try {
      if (typeof getMFASettings !== 'function' || typeof getActiveSessions !== 'function') {
        throw new Error('Security methods are not available on authStore')
      }

      const [mfa, activeSessions] = await Promise.all([
        getMFASettings(),
        getActiveSessions(),
      ])

      setMfaSettings(mfa)
      setSessions((activeSessions ?? []) as SecuritySession[])
    } catch (err) {
      logger.error('useSecurityData: reload failed', err)
      const message = err instanceof Error ? err.message : 'Failed to load security data'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [getMFASettings, getActiveSessions])

  useEffect(() => {
    reload()
  }, [reload])

  return { mfaSettings, sessions, loading, error, reload }
}

/**
 * Evaluates password strength without side effects.
 *
 * @param {string} password
 * @returns {{
 *   score: 0|1|2|3|4|5,
 *   checks: {
 *     minLength: boolean,
 *     uppercase: boolean,
 *     lowercase: boolean,
 *     number: boolean,
 *     special: boolean
 *   },
 *   label: 'weak'|'fair'|'good'|'strong'|'very strong',
 *   color: string
 * }}
 */
export const usePasswordStrength = (password: string = ''): PasswordStrengthResult => {
  const normalizedPassword = typeof password === 'string' ? password : String(password ?? '')

  const checks = {
    minLength: normalizedPassword.length >= 8,
    uppercase: /[A-Z]/.test(normalizedPassword),
    lowercase: /[a-z]/.test(normalizedPassword),
    number: /[0-9]/.test(normalizedPassword),
    special: /[^A-Za-z0-9]/.test(normalizedPassword),
  }

  // Keep lowercase as an explicit check, but only award its score point
  // when uppercase is also present (mixed-case passwords are stronger).
  const score: PasswordScore = (
    Number(checks.minLength) +
    Number(checks.uppercase) +
    Number(checks.lowercase && checks.uppercase) +
    Number(checks.number) +
    Number(checks.special)
  ) as PasswordScore

  const labels = {
    0: 'weak',
    1: 'weak',
    2: 'fair',
    3: 'good',
    4: 'strong',
    5: 'very strong',
  }

  const colors = {
    0: 'text-red-600',
    1: 'text-red-600',
    2: 'text-orange-500',
    3: 'text-yellow-500',
    4: 'text-lime-600',
    5: 'text-green-600',
  }

  return {
    score,
    checks,
    label: labels[score],
    color: colors[score],
  }
}

/**
 * Exposes security actions through authStore and tracks pending/error state.
 *
 * @returns {{
 *   disableMFA: () => Promise<void>,
 *   enableMFA: () => Promise<void>,
 *   revokeAllSessions: () => Promise<void>,
 *   isPending: boolean,
 *   error: string|null
 * }}
 */
export const useSecurityActions = (): SecurityActionsResult => {
  const { disableMFA, enableMFA, revokeAllOtherSessions, user } = useAuthStore()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runAction = useCallback(async (action?: () => Promise<SecurityActionResult | void>) => {
    setError(null)
    setIsPending(true)

    try {
      if (typeof action !== 'function') {
        throw new Error('Security action is not available on authStore')
      }

      const result = await action()
      if (result && result.success === false) {
        throw new Error(result.error || 'Security action failed')
      }
    } catch (err) {
      const message = err?.message || 'Security action failed'
      setError(message)
      throw err
    } finally {
      setIsPending(false)
    }
  }, [])

  return {
    disableMFA: async () => {
      await runAction(disableMFA)
      if (user?.id) {
        await auditLogger.logMFAAction('MFA_DISABLED', user.id)
      }
    },
    enableMFA: async () => {
      await runAction(enableMFA)
      if (user?.id) {
        await auditLogger.logMFAAction('MFA_ENABLED', user.id)
      }
    },
    revokeAllSessions: async () => {
      await runAction(revokeAllOtherSessions)
      if (user?.id) {
        await auditLogger.logSessionAction('SESSIONS_REVOKED_ALL', user.id)
      }
    },
    isPending,
    error,
  }
}

// Backward-compatible export retained for existing page code.
export const usePasswordChange = (): PasswordChangeHookResult => {
  const { user, updatePassword } = useAuthStore()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const changePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<PasswordChangeResult> => {
    setError(null)
    setSuccess(false)

    if (!user?.email) {
      const msg = 'No authenticated user found'
      setError(msg)
      return { success: false, error: msg }
    }

    setIsPending(true)

    try {
      const { error: reAuthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      })

      if (reAuthError) {
        const msg = 'Current password is incorrect'
        setError(msg)
        return { success: false, error: msg }
      }

      const result = await updatePassword(newPassword)
      if (result.success) {
        if (user?.id) {
          await auditLogger.logSecurityAction('PASSWORD_CHANGED', user.id)
        }
        setSuccess(true)
      } else {
        setError(result.error ?? 'Failed to update password')
      }

      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setIsPending(false)
    }
  }, [user, updatePassword])

  const reset = useCallback(() => {
    setError(null)
    setSuccess(false)
  }, [])

  return { changePassword, isPending, error, success, reset }
}
