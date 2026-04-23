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
import { checkMFARate } from '@/utils/rateLimiter'
import { logger } from '../utils/logger.js'
import { emailService } from '@/services/emailService'
import { withRetry } from '@/utils/withRetry'

// ============================================
// 1. MFA (Multi-Factor Authentication) SERVICE
// ============================================

export const mfaService = {
  getSettings: withRetry(async function getSettings() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null

      const publicFields = 'id, user_id, is_enabled, last_verified_at, created_at, updated_at'

      // Explicitly exclude totp_secret and backup_codes — secrets must not be sent to the browser
      const { data: existingRows, error } = await supabase
        .from('mfa_settings')
        .select(publicFields)
        .eq('user_id', user.id)
        .limit(1)

      if (error) throw error

      const existingSettings = existingRows?.[0] || null
      if (existingSettings) {
        return existingSettings
      }

      const { error: insertError } = await supabase
        .from('mfa_settings')
        .upsert({ user_id: user.id }, { onConflict: 'user_id' })

      if (insertError) throw insertError

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

  enableWithEmail: withRetry(async function enableWithEmail() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { success: false, error: 'No user logged in' }

      const { data: otp, error: otpError } = await supabase.rpc('generate_otp', {
        p_user_id: user.id,
        p_purpose: 'mfa_verify'
      })
      if (otpError) throw otpError
      if (!otp) throw new Error('Failed to generate OTP')

      const { error: updateError } = await supabase
        .from('mfa_settings')
        .upsert({
          user_id: user.id,
          is_enabled: true,
          method: 'email',
          enabled_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
      if (updateError) throw updateError

      const emailResult = await emailService.sendOTP(user, otp)
      if (!emailResult.success && !emailResult.skipped) {
        throw new Error('Failed to send OTP email')
      }

      await auditLogger.logMFAAction('MFA_ENABLED', user.id, { method: 'email' })
      return { success: true, message: 'OTP sent to your email' }
    } catch (error) {
      if (error.message === 'No user logged in') {
        return { success: false, error: 'No user logged in' }
      }
      logger.error('Enable MFA error:', error)
      return { success: false, error: error.message }
    }
  }, { maxRetries: 2, baseDelay: 1000 }),

  generateTOTPSecret: withRetry(async function generateTOTPSecret() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { success: false, error: 'No user logged in' }

      const secret = generateOTP(32)
      return {
        success: true,
        secret,
        qrCodeUrl: `otpauth://totp/Qotoof:${user.email}?secret=${secret}&issuer=Qotoof`
      }
    } catch (error) {
      if (error.message === 'No user logged in') {
        return { success: false, error: 'No user logged in' }
      }
      logger.error('Generate TOTP secret error:', error)
      return { success: false, error: error.message }
    }
  }, { maxRetries: 2, baseDelay: 500 }),

  enableWithTOTP: withRetry(async function enableWithTOTP() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { success: false, error: 'No user logged in' }

      const secret = generateOTP(32)

      const { error } = await supabase
        .from('mfa_settings')
        .upsert({
          user_id: user.id,
          is_enabled: true,
          method: 'totp',
          totp_secret: secret,
          enabled_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
      if (error) throw error

      const plainBackupCodes = Array.from({ length: 10 }, () => generateOTP(8))
      const hashedBackupCodes = await hashBackupCodes(plainBackupCodes)

      const { error: hashError } = await supabase
        .from('mfa_settings')
        .update({ totp_backup_codes: hashedBackupCodes })
        .eq('user_id', user.id)
      if (hashError) throw hashError

      await auditLogger.logMFAAction('MFA_ENABLED', user.id, { method: 'totp' })
      return { success: true, secret, backupCodes: plainBackupCodes, qrCodeUrl: `otpauth://totp/Qotoof:${user.email}?secret=${secret}&issuer=Qotoof` }
    } catch (error) {
      if (error.message === 'No user logged in') {
        return { success: false, error: 'No user logged in' }
      }
      logger.error('Enable TOTP error:', error)
      return { success: false, error: error.message }
    }
  }, { maxRetries: 2, baseDelay: 1000 }),

  verifyCode: withRetry(async function verifyCode(code) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { success: false, error: 'No user logged in' }

      const rateLimit = checkMFARate(user.id)
      if (!rateLimit.allowed) {
        throw new Error('Too many attempts. Please try again later.')
      }

      const { data: isValid, error } = await supabase.rpc('verify_otp', {
        p_user_id: user.id,
        p_code: code,
        p_purpose: 'mfa_verify'
      })
      if (error) throw error

      if (!isValid) {
        await auditLogger.logMFAAction('MFA_VERIFY_FAILED', user.id, { code })
        return { success: false, error: 'Invalid or expired code' }
      }

      await auditLogger.logMFAAction('MFA_VERIFIED', user.id)
      return { success: true }
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
      if (!user) return { success: false, error: 'No user logged in' }

      const { error } = await supabase
        .from('mfa_settings')
        .update({
          is_enabled: false,
          method: null,
          totp_secret: null,
          totp_backup_codes: null
        })
        .eq('user_id', user.id)
      if (error) throw error

      await auditLogger.logMFAAction('MFA_DISABLED', user.id)
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
      if (!user) return { success: false, error: 'No user logged in' }

      const plainBackupCodes = Array.from({ length: 10 }, () => generateOTP(8))
      const hashedBackupCodes = await hashBackupCodes(plainBackupCodes)

      const { error } = await supabase
        .from('mfa_settings')
        .update({ totp_backup_codes: hashedBackupCodes })
        .eq('user_id', user.id)
      if (error) throw error

      await auditLogger.logMFAAction('MFA_BACKUP_CODES_REGENERATED', user.id)
      return { success: true, backupCodes: plainBackupCodes }
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

      await supabase
        .from('active_sessions')
        .update({ is_current: false })
        .eq('user_id', user.id)
        .eq('is_current', true)

      const { error } = await supabase
        .from('active_sessions')
        .insert({
          user_id: user.id,
          session_id: session.access_token.substring(0, 100),
          session_token: session.access_token.substring(0, 100),
          device_fingerprint: deviceFingerprint,
          device_info: deviceInfo,
          user_agent: navigator.userAgent,
          is_current: true,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        })
      if (error) {
        logger.error('Register session error:', error)
        return
      }

      await auditLogger.logSessionAction('SESSION_CREATED', user.id, { deviceInfo, deviceFingerprint })
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
      return data || []
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
        .update({ is_active: false })
        .eq('id', sessionId)
        .eq('user_id', user.id)
      if (error) throw error

      await auditLogger.logSessionAction('SESSION_REVOKED', user.id, { sessionId })
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
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_current', false)
      if (error) throw error

      await auditLogger.logSessionAction('SESSIONS_REVOKED_ALL', user.id)
      return { success: true }
    } catch (error) {
      logger.error('Revoke all sessions error:', error)
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

  start(onWarning, onLogout) {
    this.stop()
    this.lastActivity = Date.now()

    this.warningTimer = setTimeout(() => {
      if (onWarning) onWarning(this.IDLE_TIMEOUT - this.warningTimeout)
    }, this.warningTimeout)

    this.timer = setTimeout(() => {
      this.performLogout(onLogout)
    }, this.IDLE_TIMEOUT)

    this.addActivityListeners()
  },

  stop() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    if (this.warningTimer) { clearTimeout(this.warningTimer); this.warningTimer = null }
    this.removeActivityListeners()
  },

  reset() {
    this.lastActivity = Date.now()
    this.start(() => {}, () => {})
  },

  async performLogout(onLogout) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await auditLogger.logAuthAction('AUTO_LOGOUT', user.id, {
          reason: 'idle_timeout',
          lastActivity: new Date(this.lastActivity).toISOString()
        })
      }
      secureStorage.clear()
      clearSupabaseLocalStorage()
      await supabase.auth.signOut()
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
