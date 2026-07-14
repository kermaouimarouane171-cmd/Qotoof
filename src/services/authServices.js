/**
 * 🔐 Auth Services (MFA, Sessions, Auto Logout)
 * Extracted from vendorSecurity.js to fix circular dependency
 * 
 * Import chain (no cycles):
 *   authStore.js → authServices.js → supabase.js ✅
 *   vendorSecurity.js → authServices.js → supabase.js ✅
 */

import { supabase } from '@/services/supabase'
import { generateOTP, generateDeviceFingerprint, getDeviceInfo, secureStorage, hashBackupCodes, clearSupabaseLocalStorage } from '@/utils/encryption'
import { auditLogger } from '@/services/auditLogger'
import { logger } from '../utils/logger.js'
import { emailService } from '@/services/emailService'
import { withRetry } from '@/utils/withRetry'
import { unauthenticatedResponse } from '@/utils/authHelpers'

const getSessionTokenPrefix = (session) => {
  const accessToken = session?.access_token

  if (typeof accessToken !== 'string' || !accessToken) {
    return null
  }

  return accessToken.substring(0, 100)
}

const resolveSessionExpiry = (session) => {
  if (typeof session?.expires_at === 'number') {
    return new Date(session.expires_at * 1000).toISOString()
  }

  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
}

const normalizeSessionDeviceInfo = (sessionRecord) => {
  if (!sessionRecord) {
    return sessionRecord
  }

  if (typeof sessionRecord.device_info !== 'string') {
    return sessionRecord
  }

  try {
    return {
      ...sessionRecord,
      device_info: JSON.parse(sessionRecord.device_info),
    }
  } catch {
    return sessionRecord
  }
}

// ============================================
// 1. MFA (Multi-Factor Authentication) SERVICE
// ============================================

export const mfaService = {
  getSettings: withRetry(async function getSettings() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      // RLS allows authenticated users to SELECT their own mfa_settings
      const publicFields = 'id, user_id, is_enabled, method, failed_attempts, locked_until, last_verified_at, last_used_at, created_at, updated_at'

      const { data: existingRows, error } = await supabase
        .from('mfa_settings')
        .select(publicFields)
        .eq('user_id', user.id)
        .limit(1)

      if (error) throw error

      if (existingRows?.[0]) {
        // If method is not 'totp', treat as invalid configuration
        if (existingRows[0].method !== 'totp' && existingRows[0].is_enabled) {
          logger.warn(`Invalid MFA method '${existingRows[0].method}' for user ${user.id}, disabling MFA`)
          // Disable MFA for this user - they need to set up TOTP
          await supabase
            .from('mfa_settings')
            .update({ is_enabled: false, method: 'totp' })
            .eq('user_id', user.id)
          return { ...existingRows[0], is_enabled: false, method: 'totp' }
        }
        return existingRows[0]
      }

      // No row yet — create one via Edge Function (RLS blocks client INSERT)
      const { error: invokeError } = await supabase.functions.invoke('enable-mfa', {
        body: { action: 'ensure' },
      })
      if (invokeError) {
        logger.error('Failed to create MFA settings via Edge Function:', invokeError)
        return null
      }

      const { data: createdRows, error: createdError } = await supabase
          .from('mfa_settings')
          .select(publicFields)
          .eq('user_id', user.id)
          .limit(1)

      if (createdError) throw createdError

      return createdRows?.[0] || null
    } catch (error) {
      logger.error('Get MFA settings error:', error)
      return null
    }
  }, { maxRetries: 3, baseDelay: 1000 }),

  // Email MFA is disabled - TOTP only
  // initiateEmailMFA: withRetry(async function initiateEmailMFA() {
  //   try {
  //     const { data: { user } } = await supabase.auth.getUser()
  //     if (!user) return unauthenticatedResponse()

  //     const { data, error } = await supabase.functions.invoke('enable-mfa', {
  //       body: { action: 'initiate-email' },
  //     })

  //     if (error) throw error
  //     if (!data?.success) {
  //       return { success: false, error: data?.error || 'Failed to initiate email MFA' }
  //     }

  //     return { success: true, message: 'OTP sent to your email' }
  //   } catch (error) {
  //     if (error.message === 'No user logged in') {
  //       return { success: false, error: 'No user logged in' }
  //     }
  //     logger.error('Initiate email MFA error:', error)
  //     return { success: false, error: error.message }
  //   }
  // }, { maxRetries: 2, baseDelay: 1000 }),

  // Email MFA is disabled - TOTP only
  // verifyEmailMFA: withRetry(async function verifyEmailMFA(code) {
  //   try {
  //     const { data: { user } } = await supabase.auth.getUser()
  //     if (!user) return unauthenticatedResponse()

  //     if (!code) {
  //       return { success: false, error: 'Verification code is required' }
  //     }

  //     const { data, error } = await supabase.functions.invoke('enable-mfa', {
  //       body: { action: 'verify-email', code },
  //     })

  //     if (error) throw error
  //     if (!data?.success) {
  //         error: data?.error || 'Invalid or expired code',
  //       }
  //     }

  //     return {
  //       success: true,
  //       backupCodes: data.backupCodes,
  //     }
  //   } catch (error) {
  //     if (error.message === 'No user logged in') {
  //       return { success: false, error: 'No user logged in' }
  //     }
  //     logger.error('Verify email MFA error:', error)
  //     return { success: false, error: error.message }
  //   }
  // }, { maxRetries: 2, baseDelay: 1000 }),

  generateTOTPSecret: withRetry(async function generateTOTPSecret() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return unauthenticatedResponse()

      // SECURITY: Generate the TOTP secret on the server to prevent client-side tampering
      const { data, error } = await supabase.functions.invoke('enable-mfa', {
        body: { action: 'generate', method: 'totp' },
      })

      if (error) throw error
      if (!data?.success || !data?.secret) {
        throw new Error(data?.error || 'Failed to generate TOTP secret')
      }

      return {
        success: true,
        secret: data.secret,
        qrCodeUrl: data.qrCodeUrl || `otpauth://totp/Qotoof:${user.email}?secret=${data.secret}&issuer=Qotoof`
      }
    } catch (error) {
      if (error.message === 'No user logged in') {
        return { success: false, error: 'No user logged in' }
      }
      logger.error('Generate TOTP secret error:', error)
      return { success: false, error: error.message }
    }
  }, { maxRetries: 2, baseDelay: 500 }),

  enableWithTOTP: withRetry(async function enableWithTOTP(secret, code) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return unauthenticatedResponse()

      if (!secret || !code) {
        return { success: false, error: 'TOTP secret and verification code are required' }
      }

      const { data, error } = await supabase.functions.invoke('enable-mfa', {
        body: {
          method: 'totp',
          secret,
          code,
        },
      })

      if (error) throw error
      if (!data?.success) {
        return {
          success: false,
          locked: data?.locked,
          lockedUntil: data?.lockedUntil,
          retryAfter: data?.retryAfter,
          attemptsRemaining: data?.attemptsRemaining,
          error: data?.error || 'Failed to enable TOTP MFA',
        }
      }

      return {
        success: true,
        backupCodes: data.backupCodes,
        qrCodeUrl: `otpauth://totp/Qotoof:${user.email}?secret=${secret}&issuer=Qotoof`,
      }
    } catch (error) {
      if (error.message === 'No user logged in') {
        return { success: false, error: 'No user logged in' }
      }
      logger.error('Enable TOTP error:', error)
      return { success: false, error: error.message }
    }
  }, { maxRetries: 2, baseDelay: 1000 }),

  verifyCode: withRetry(async function verifyCode(code, method = 'email') {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return unauthenticatedResponse()

      if (method === 'totp') {
        const { data, error } = await supabase.functions.invoke('verify-mfa', {
          body: { method: 'totp', code },
        })
        if (error) throw error

        if (data?.success) return { success: true }
        return {
          success: false,
          locked: Boolean(data?.locked),
          lockedUntil: data?.lockedUntil,
          retryAfter: data?.retryAfter,
          attemptsRemaining: data?.attemptsRemaining,
          error: data?.error || 'Invalid or expired code',
        }
      }

      const { data: result, error } = await supabase.rpc('verify_otp', {
        p_user_id: user.id,
        p_code: code,
        p_purpose: 'mfa_verify'
      })
      if (error) throw error

      if (result) {
        return { success: true }
      }

      return {
        success: false,
        error: 'Invalid or expired code'
      }
    } catch (error) {
      if (error.message === 'No user logged in') {
        return { success: false, error: 'No user logged in' }
      }
      logger.error('Verify MFA error:', error)
      return { success: false, error: error.message }
    }
  }, { maxRetries: 2, baseDelay: 1000 }),

  disable: withRetry(async function disable() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return unauthenticatedResponse()

      // SECURITY: Use Edge Function for server-side audit logging
      const { data, error } = await supabase.functions.invoke('enable-mfa', {
        body: { action: 'disable' },
      })

      if (error) throw error
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to disable MFA')
      }

      return { success: true }
    } catch (error) {
      if (error.message === 'No user logged in') {
        return { success: false, error: 'No user logged in' }
      }
      logger.error('Disable MFA error:', error)
      return { success: false, error: error.message }
    }
  }, { maxRetries: 2, baseDelay: 1000 }),

  regenerateBackupCodes: withRetry(async function regenerateBackupCodes() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return unauthenticatedResponse()

      // SECURITY: Use Edge Function for server-side generation and audit logging
      const { data, error } = await supabase.functions.invoke('enable-mfa', {
        body: { action: 'regenerate-backup-codes' },
      })

      if (error) throw error
      if (!data?.success || !data?.backupCodes) {
        throw new Error(data?.error || 'Failed to regenerate backup codes')
      }

      return { success: true, backupCodes: data.backupCodes }
    } catch (error) {
      if (error.message === 'No user logged in') {
        return { success: false, error: 'No user logged in' }
      }
      logger.error('Regenerate backup codes error:', error)
      return { success: false, error: error.message }
    }
  }, { maxRetries: 2, baseDelay: 1000 })
}

// ============================================
// 2. SESSION MANAGEMENT SERVICE
// ============================================

export const sessionService = {
  registerSession: withRetry(async function registerSession() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const deviceFingerprint = await generateDeviceFingerprint()
      const deviceInfo = getDeviceInfo()
      const sessionToken = getSessionTokenPrefix(session)

      await supabase
        .from('active_sessions')
        .update({ is_current: false })
        .eq('user_id', user.id)
        .eq('is_current', true)

      const { error } = await supabase
        .from('active_sessions')
        .insert({
          user_id: user.id,
          session_id: sessionToken,
          session_token: sessionToken,
          device_fingerprint: deviceFingerprint,
          device_info: deviceInfo,
          user_agent: navigator.userAgent,
          last_active: new Date().toISOString(),
          is_active: true,
          is_current: true,
          expires_at: resolveSessionExpiry(session)
        })
      if (error) {
        logger.error('Register session error:', error)
        return
      }

      await auditLogger.logSessionAction('SESSION_CREATED', user.id, { deviceInfo, deviceFingerprint })
      // SECURITY: Also log server-side via Edge Function
      try {
        await supabase.functions.invoke('session-audit', {
          body: { user_id: user.id, action: 'SESSION_CREATED', metadata: { deviceInfo, deviceFingerprint } },
        })
      } catch (auditErr) {
        logger.debug('Server-side session audit failed:', auditErr)
      }
    } catch (error) {
      logger.error('Register session error:', error)
    }
  }, { maxRetries: 2, baseDelay: 1000 }),

  getActiveSessions: withRetry(async function getActiveSessions() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('last_active', { ascending: false })
      if (error) throw error
      return (data || []).map(normalizeSessionDeviceInfo)
    } catch (error) {
      logger.error('Get sessions error:', error)
      return []
    }
  }, { maxRetries: 3, baseDelay: 1000 }),

  async revokeSession(sessionId) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user logged in')

      const { error } = await supabase
        .from('active_sessions')
        .update({ is_active: false, is_current: false, last_active: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', user.id)
      if (error) throw error

      await auditLogger.logSessionAction('SESSION_REVOKED', user.id, { sessionId })
      try {
        await supabase.functions.invoke('session-audit', {
          body: { user_id: user.id, action: 'SESSION_REVOKED', metadata: { sessionId } },
        })
      } catch (auditErr) {
        logger.debug('Server-side session audit failed:', auditErr)
      }
      return { success: true }
    } catch (error) {
      logger.error('Revoke session error:', error)
      return { success: false, error: error.message }
    }
  },

  async revokeAllOtherSessions() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user logged in')

      const { error } = await supabase
        .from('active_sessions')
        .update({ is_active: false, is_current: false, last_active: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_current', false)
      if (error) throw error

      await auditLogger.logSessionAction('SESSIONS_REVOKED_ALL', user.id)
      try {
        await supabase.functions.invoke('session-audit', {
          body: { action: 'SESSIONS_REVOKED_ALL', metadata: {} },
        })
      } catch (auditErr) {
        logger.debug('Server-side session audit failed:', auditErr)
      }
      return { success: true }
    } catch (error) {
      logger.error('Revoke all sessions error:', error)
      return { success: false, error: error.message }
    }
  },

  async revokeCurrentSession() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user logged in')

      const { error } = await supabase
        .from('active_sessions')
        .update({
          is_active: false,
          is_current: false,
          last_active: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .eq('is_current', true)

      if (error) throw error

      await auditLogger.logSessionAction('SESSION_REVOKED_CURRENT', user.id)
      try {
        await supabase.functions.invoke('session-audit', {
          body: { user_id: user.id, action: 'SESSION_REVOKED_CURRENT', metadata: {} },
        })
      } catch (auditErr) {
        logger.debug('Server-side session audit failed:', auditErr)
      }
      return { success: true }
    } catch (error) {
      logger.error('Revoke current session error:', error)
      return { success: false, error: error.message }
    }
  },

  async updateSessionActivity() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase
        .from('active_sessions')
        .update({ last_active: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_current', true)
        .eq('is_active', true)
    } catch (error) {
      logger.error('Update session activity error:', error)
    }
  }
}

// ============================================
// 3. AUTO LOGOUT SERVICE
// ============================================

export const autoLogoutService = {
  IDLE_TIMEOUT: 30 * 60 * 1000,
  warningTimeout: 25 * 60 * 1000,
  timer: null,
  warningTimer: null,
  lastActivity: Date.now(),
  _broadcastChannel: null,
  _onWarning: null,
  _onLogout: null,

  _getBroadcastChannel() {
    if (this._broadcastChannel) return this._broadcastChannel
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      this._broadcastChannel = new BroadcastChannel('qotoof-auto-logout')
      this._broadcastChannel.onmessage = (event) => {
        if (event?.data?.type === 'activity') {
          this.lastActivity = Date.now()
          this._resetTimers()
        } else if (event?.data?.type === 'logout') {
          if (this._onLogout) this._onLogout()
        }
      }
    }
    return this._broadcastChannel
  },

  _postBroadcast(type) {
    try {
      this._getBroadcastChannel()?.postMessage({ type })
    } catch {
      // BroadcastChannel may be closed or unavailable
    }
  },

  _resetTimers() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    if (this.warningTimer) { clearTimeout(this.warningTimer); this.warningTimer = null }

    this.warningTimer = setTimeout(() => {
      if (this._onWarning) this._onWarning(this.IDLE_TIMEOUT - this.warningTimeout)
    }, this.warningTimeout)

    this.timer = setTimeout(() => {
      this.performLogout(this._onLogout)
    }, this.IDLE_TIMEOUT)
  },

  start(onWarning, onLogout) {
    this.stop()
    this.lastActivity = Date.now()
    this._onWarning = onWarning
    this._onLogout = onLogout

    this._resetTimers()
    this.addActivityListeners()
  },

  stop() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    if (this.warningTimer) { clearTimeout(this.warningTimer); this.warningTimer = null }
    this._onWarning = null
    this._onLogout = null
    this.removeActivityListeners()
  },

  reset() {
    this.lastActivity = Date.now()
    this._resetTimers()
    this._postBroadcast('activity')
  },

  async performLogout(onLogout) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await auditLogger.logAuthAction('AUTO_LOGOUT', user.id, {
          reason: 'idle_timeout',
          lastActivity: new Date(this.lastActivity).toISOString()
        })

        await sessionService.revokeCurrentSession()
      }
      secureStorage.clear()
      clearSupabaseLocalStorage()
      await supabase.auth.signOut()
      this._postBroadcast('logout')
      if (onLogout) onLogout()
    } catch (error) {
      logger.error('Auto logout error:', error)
    }
  },

  addActivityListeners() {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    this.handleActivity = () => {
      const now = Date.now()
      const idleTime = now - this.lastActivity
      if (idleTime > 5 * 60 * 1000) {
        this.reset()
      } else {
        this.lastActivity = now
      }
    }
    events.forEach(event => {
      window.addEventListener(event, this.handleActivity, { passive: true })
    })
  },

  removeActivityListeners() {
    if (this.handleActivity) {
      const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
      events.forEach(event => {
        window.removeEventListener(event, this.handleActivity)
      })
    }
  }
}

// ============================================
// Default export
// ============================================
export default {
  mfaService,
  sessionService,
  autoLogoutService
}
