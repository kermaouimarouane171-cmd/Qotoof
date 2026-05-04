import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { mfaService } from '@/services/authServices'
import { trustScoreService } from '@/services/vendorSecurity'
import { useAuditLogs } from '@/services/auditLogger'
import { PhoneVerificationDialog } from '@/components/auth/PhoneVerification'
import MFASetup from '@/components/auth/MFASetup'
import SessionManager from '@/components/auth/SessionManager'
import ErrorBoundary from '@/components/ErrorBoundary'
import {
  ShieldCheckIcon,
  KeyIcon,
  DevicePhoneMobileIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { auditLogger } from '@/services/auditLogger'

const VendorSecurityPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, getMFASettings, getActiveSessions, revokeAllOtherSessions, updatePassword } = useAuthStore()
  const [mfaSettings, setMfaSettings] = useState(null)
  const [trustScore, setTrustScore] = useState(null)
  const [sessionCount, setSessionCount] = useState(0)
  const [showMFASetup, setShowMFASetup] = useState(false)
  const [showSessionManager, setShowSessionManager] = useState(false)
  const [loading, setLoading] = useState(true)
  const [disablingMFA, setDisablingMFA] = useState(false)
  const [showPersonalInfo, setShowPersonalInfo] = useState(false)

  // Get MFA enforcement state from ProtectedRoute
  const [mfaEnforcementState] = useState(() => {
    return location.state || {}
  })

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [showPhoneVerification, setShowPhoneVerification] = useState(false)
  const [pendingNewPassword, setPendingNewPassword] = useState('')

  const { logs, loading: logsLoading, refresh: refreshLogs } = useAuditLogs({ limit: 10 })

  // Auto-show MFA setup if enforced
  useEffect(() => {
    if (mfaEnforcementState.forceMFA && !profile?.mfa_enabled) {
      setShowMFASetup(true)
    }
  }, [mfaEnforcementState, profile])

  const loadSecurityData = useCallback(async () => {
    if (!user?.id) {
      setMfaSettings(null)
      setTrustScore(null)
      setSessionCount(0)
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Load MFA settings
      const mfa = await getMFASettings()
      setMfaSettings(mfa)

      // Load trust score
      const trust = await trustScoreService.getTrustScore(user?.id)
      setTrustScore(trust)

      // Load session count
      const sessions = await getActiveSessions()
      setSessionCount(sessions.length)
    } catch (error) {
      logger.error('Load security data error:', error)
    } finally {
      setLoading(false)
    }
  }, [getActiveSessions, getMFASettings, user?.id])

  useEffect(() => {
    loadSecurityData()
  }, [loadSecurityData])

  // ============================================================
  // PASSWORD STRENGTH VALIDATION
  // ============================================================
  const validatePasswordStrength = (password) => {
    const errors = []

    if (password.length < 8) errors.push(t('vendor.security.errors.passwordTooShort', 'Password must be at least 8 characters'))
    if (password.length > 128) errors.push(t('vendor.security.errors.passwordTooLong', 'Password must be less than 128 characters'))
    if (!/[A-Z]/.test(password)) errors.push(t('vendor.security.errors.passwordNoUppercase', 'Password must contain at least one uppercase letter'))
    if (!/[a-z]/.test(password)) errors.push(t('vendor.security.errors.passwordNoLowercase', 'Password must contain at least one lowercase letter'))
    if (!/[0-9]/.test(password)) errors.push(t('vendor.security.errors.passwordNoNumber', 'Password must contain at least one number'))
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push(t('vendor.security.errors.passwordNoSpecial', 'Password must contain at least one special character'))

    const commonPasswords = ['password', '12345678', 'qwerty123', 'admin123']
    if (commonPasswords.includes(password.toLowerCase())) errors.push(t('vendor.security.errors.passwordCommon', 'Password is too common'))

    return {
      valid: errors.length === 0,
      errors,
      strength: errors.length === 0 ? 'strong' : errors.length <= 2 ? 'medium' : 'weak'
    }
  }

  // ============================================================
  // SEND SECURITY CHANGE EMAIL NOTIFICATION
  // ============================================================
  const sendSecurityEmail = async (action, details = '') => {
    if (!user?.id) return

    try {
      // Create notification in database (will trigger email via Edge Function)
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'security_alert',
        title: t('vendor.security.email.title', 'Security Alert: {{action}}', { action }),
        message: t('vendor.security.email.message', 'A security change was made on your account: {{action}}. {{details}} If this wasn\'t you, please contact support immediately.', { action, details }),
        is_read: false,
        created_at: new Date().toISOString(),
      })

      // Log the email notification
      logger.info(`Security email sent to ${user.email}: ${action}`)
    } catch (error) {
      logger.error('Failed to send security email:', error)
      // Don't throw - email failure shouldn't block the action
    }
  }

  // ============================================================
  // PASSWORD CHANGE HANDLER
  // ============================================================
  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordError('')

    if (!user?.email) {
      setPasswordError('تعذر تحديد الحساب الحالي')
      return
    }

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('vendor.security.errors.allFieldsRequired', 'All fields are required'))
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('vendor.security.errors.passwordsNotMatch', 'New passwords do not match'))
      return
    }

    if (newPassword === oldPassword) {
      setPasswordError(t('vendor.security.errors.passwordSame', 'New password must be different from old password'))
      return
    }

    const passwordValidation = validatePasswordStrength(newPassword)
    if (!passwordValidation.valid) {
      setPasswordError(passwordValidation.errors.join('. '))
      return
    }

    setChangingPassword(true)
    try {
      // SECURITY: Verify old password first
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      })

      if (verifyError) {
        setPasswordError(t('vendor.security.errors.incorrectPassword', 'Current password is incorrect'))
        return
      }

      if (!profile?.phone) {
        setPasswordError('أضف رقم هاتف إلى حسابك قبل تغيير كلمة المرور')
        return
      }

      setPendingNewPassword(newPassword)
      setShowPhoneVerification(true)
    } catch (error) {
      logger.error('Password change error:', error)
      setPasswordError(error.message || t('vendor.security.errors.passwordChangeFailed', 'Failed to update password'))
    } finally {
      setChangingPassword(false)
    }
  }

  const handlePasswordVerified = async () => {
    const nextPassword = pendingNewPassword

    setShowPhoneVerification(false)
    setPendingNewPassword('')

    if (!nextPassword) {
      return
    }

    const result = await updatePassword(nextPassword)

    if (!result.success) {
      setPasswordError(result.error || t('vendor.security.errors.passwordChangeFailed', 'Failed to update password'))
      return
    }

    await sendSecurityEmail('Password Changed')

    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowPasswordChange(false)
    setPasswordError('')
  }

  // ============================================================
  // DISABLE MFA WITH RE-AUTHENTICATION
  // ============================================================
  const handleDisableMFA = async () => {
    if (!user?.email || !user?.id) {
      toast.error('تعذر تحديد الحساب الحالي')
      return
    }

    // Require password confirmation before disabling MFA
    const password = prompt(t('vendor.security.enterPasswordDisableMFA', 'Please enter your password to disable two-factor authentication:'))
    if (!password) return

    try {
      setDisablingMFA(true)

      // Verify password first
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      })

      if (verifyError) {
        toast.error(t('vendor.security.errors.incorrectPassword', 'Incorrect password'))
        return
      }

      // Password verified - disable MFA
      const result = await mfaService.disable()

      if (result.success) {
        // ✅ Send security email notification
        await sendSecurityEmail('Two-Factor Authentication Disabled')

        // Log the MFA disable action
        await auditLogger.logMFAAction('MFA_DISABLED', user.id)

        toast.success(t('vendor.security.mfaDisabled', 'Two-factor authentication disabled'))
        await loadSecurityData()
      } else {
        toast.error(result.error || t('vendor.security.errors.mfaDisableFailed', 'Failed to disable MFA'))
      }
    } catch (error) {
      logger.error('Disable MFA error:', error)
      toast.error(t('vendor.security.errors.mfaDisableFailed', 'Failed to disable MFA'))
    } finally {
      setDisablingMFA(false)
    }
  }

  // ============================================================
  // REVOKE ALL SESSIONS WITH EMAIL NOTIFICATION
  // ============================================================
  const handleRevokeAllSessions = async () => {
    if (!user?.id) {
      toast.error('تعذر تحديد الحساب الحالي')
      return
    }

    if (!confirm(t('vendor.security.confirmRevokeSessions', 'Sign out all other devices?'))) {
      return
    }

    try {
      const result = await revokeAllOtherSessions()

      if (result.success) {
        // ✅ Send security email notification
        await sendSecurityEmail('All Other Sessions Revoked')

        // Log the session revocation
        await auditLogger.logSessionAction('SESSIONS_REVOKED_ALL', user.id)

        toast.success(t('vendor.security.sessionsRevoked', 'All other sessions revoked'))
        await loadSecurityData()
      } else {
        toast.error(result.error || t('vendor.security.errors.revokeFailed', 'Failed to revoke sessions'))
      }
    } catch (error) {
      logger.error('Revoke sessions error:', error)
      toast.error(t('vendor.security.errors.revokeFailed', 'Failed to revoke sessions'))
    }
  }

  const getTrustBadge = () => {
    if (!trustScore) return null

    const badges = {
      platinum: { label: 'Platinum', color: 'bg-purple-100 text-purple-800', icon: '💎' },
      gold: { label: 'Gold', color: 'bg-yellow-100 text-yellow-800', icon: '🥇' },
      silver: { label: 'Silver', color: 'bg-gray-100 text-gray-800', icon: '🥈' },
      bronze: { label: 'Bronze', color: 'bg-orange-100 text-orange-800', icon: '🥉' },
      new: { label: 'New', color: 'bg-blue-100 text-blue-800', icon: '🆕' }
    }

    return badges[trustScore.level] || badges.new
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t('vendor.security.loading', 'Loading security settings...')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('vendor.security.title', 'Security Settings')}
        </h1>
        <p className="text-gray-600">
          {t('vendor.security.subtitle', 'Manage your account security and privacy')}
        </p>
      </div>

      {/* MFA Enforcement Warning */}
      {!profile?.mfa_enabled && (
        <div className={`mb-6 p-4 rounded-lg border-l-4 flex items-start gap-4 ${
          mfaEnforcementState.isAfterDeadline
            ? 'bg-red-50 border-l-red-500'
            : 'bg-yellow-50 border-l-yellow-500'
        }`}>
          <ExclamationTriangleIcon className={`w-6 h-6 flex-shrink-0 ${
            mfaEnforcementState.isAfterDeadline
              ? 'text-red-600'
              : 'text-yellow-600'
          }`} />
          <div className="flex-1">
            <div className={`font-semibold ${
              mfaEnforcementState.isAfterDeadline
                ? 'text-red-900'
                : 'text-yellow-900'
            }`}>
              {mfaEnforcementState.isAfterDeadline
                ? t('vendor.security.mfaRequired.enforced', 'Two-Factor Authentication is Now Required')
                : t('vendor.security.mfaRequired.warning', 'Two-Factor Authentication Will Be Required Soon')}
            </div>
            <p className={`text-sm mt-1 ${
              mfaEnforcementState.isAfterDeadline
                ? 'text-red-800'
                : 'text-yellow-800'
            }`}>
              {mfaEnforcementState.isAfterDeadline
                ? t('vendor.security.mfaRequired.enforcedMessage', 
                    'You must enable two-factor authentication to continue accessing your vendor account. It protects your shop from unauthorized access.')
                : t('vendor.security.mfaRequired.gracePeriodMessage',
                    'Two-factor authentication will be mandatory for all vendors. You have {{days}} days to enable it.', 
                    { days: mfaEnforcementState.daysRemaining || 'several' })}
            </p>
            <button
              onClick={() => setShowMFASetup(true)}
              className={`mt-3 px-4 py-2 rounded-lg font-medium transition-colors ${
                mfaEnforcementState.isAfterDeadline
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-yellow-600 hover:bg-yellow-700 text-white'
              }`}
            >
              {t('vendor.security.mfaRequired.setupButton', 'Enable Two-Factor Authentication Now')}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <EyeIcon className="w-6 h-6 text-blue-600" />
              {t('vendor.security.personalInfo', 'Personal Information')}
            </h2>
            <button
              onClick={() => setShowPersonalInfo(!showPersonalInfo)}
              className="text-green-600 hover:text-green-700"
            >
              {showPersonalInfo ? (
                <EyeSlashIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          </div>

          {profile && (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">{t('vendor.security.name', 'Name')}</div>
                <div className="font-medium">
                  {showPersonalInfo
                    ? `${profile.first_name || ''} ${profile.last_name || ''}`
                    : `${(profile.first_name || '').charAt(0)}*** ${(profile.last_name || '').charAt(0)}***`
                  }
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">{t('vendor.security.email', 'Email')}</div>
                <div className="font-medium">
                  {showPersonalInfo
                    ? profile.email
                    : profile.email?.replace(/(.{2}).+(@.+)/, '$1***$2')
                  }
                </div>
              </div>
              {profile.phone && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">{t('vendor.security.phone', 'Phone')}</div>
                  <div className="font-medium">
                    {showPersonalInfo
                      ? profile.phone
                      : profile.phone?.replace(/(\d{2})\d+(\d{2})/, '$1***$2')
                    }
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Password Change */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <KeyIcon className="w-6 h-6 text-amber-600" />
              {t('vendor.security.changePassword', 'Change Password')}
            </h2>
          </div>

          {!showPasswordChange ? (
            <button
              onClick={() => setShowPasswordChange(true)}
              className="btn-primary w-full"
            >
              {t('vendor.security.changePassword', 'Change Password')}
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="input-label">{t('vendor.security.currentPassword', 'Current Password')} *</label>
                <div className="relative">
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="input pr-10"
                    placeholder={t('vendor.security.currentPasswordPlaceholder', 'Enter current password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showOldPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="input-label">{t('vendor.security.newPassword', 'New Password')} *</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input pr-10"
                    placeholder={t('vendor.security.newPasswordPlaceholder', 'At least 8 characters')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showNewPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="input-label">{t('vendor.security.confirmPassword', 'Confirm New Password')} *</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input pr-10"
                    placeholder={t('vendor.security.confirmPasswordPlaceholder', 'Re-enter new password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showConfirmPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {passwordError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">
                  {passwordError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {changingPassword ? t('vendor.security.updating', 'Updating...') : t('vendor.security.updatePassword', 'Update Password')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordChange(false)
                    setOldPassword('')
                    setNewPassword('')
                    setConfirmPassword('')
                    setPasswordError('')
                  }}
                  className="btn-outline flex-1"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Trust Score */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ShieldCheckIcon className="w-6 h-6 text-green-600" />
              {t('vendor.security.trustScore', 'Trust Score')}
            </h2>
            {trustScore && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTrustBadge().color}`}>
                {getTrustBadge().icon} {getTrustBadge().label}
              </span>
            )}
          </div>

          {trustScore ? (
            <div className="space-y-4">
              {/* Score */}
              <div className="text-center p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl">
                <div className="text-4xl font-bold text-green-600 mb-1">{trustScore.score}</div>
                <div className="text-sm text-gray-600">{t('vendor.security.outOf100', 'out of 100')}</div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-gray-600">{t('vendor.security.rating', 'Rating')}</div>
                  <div className="font-semibold">{trustScore.avg_rating}/5.0</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-gray-600">{t('vendor.security.reviews', 'Reviews')}</div>
                  <div className="font-semibold">{trustScore.total_reviews}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-gray-600">{t('vendor.security.orders', 'Orders')}</div>
                  <div className="font-semibold">{trustScore.completed_orders}/{trustScore.total_orders}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-gray-600">{t('vendor.security.member', 'Member')}</div>
                  <div className="font-semibold">{Math.floor(trustScore.member_days / 30)} {t('vendor.security.months', 'months')}</div>
                </div>
              </div>

              {/* Verification Status */}
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                {trustScore.is_verified ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-600" />
                ) : trustScore.is_approved ? (
                  <CheckCircleIcon className="w-5 h-5 text-yellow-600" />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-gray-400" />
                )}
                <span className="text-sm font-medium">
                  {trustScore.is_verified
                    ? t('vendor.security.verified', 'Verified')
                    : trustScore.is_approved
                    ? t('vendor.security.approved', 'Approved')
                    : t('vendor.security.notVerified', 'Not Verified')}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>{t('vendor.security.noTrustScore', 'No trust score available')}</p>
            </div>
          )}
        </div>

        {/* Two-Factor Authentication */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <KeyIcon className="w-6 h-6 text-blue-600" />
              {t('vendor.security.twoFactorAuth', 'Two-Factor Authentication')}
            </h2>
            {mfaSettings?.is_enabled ? (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                {t('vendor.security.enabled', 'Enabled')}
              </span>
            ) : (
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                {t('vendor.security.disabled', 'Disabled')}
              </span>
            )}
          </div>

          <div className="space-y-4">
            {mfaSettings?.is_enabled ? (
              <>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900">{t('vendor.security.accountProtected', 'Your account is protected')}</span>
                  </div>
                  <p className="text-sm text-green-700">
                    {t('vendor.security.usingMethod', 'Using {{method}} verification', {
                      method: mfaSettings.method === 'email'
                        ? t('vendor.security.email', 'Email')
                        : t('vendor.security.authenticatorApp', 'Authenticator App')
                    })}
                  </p>
                  {mfaSettings.last_used_at && (
                    <p className="text-xs text-green-600 mt-2">
                      {t('vendor.security.lastUsed', 'Last used')}: {new Date(mfaSettings.last_used_at).toLocaleString()}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleDisableMFA}
                  disabled={disablingMFA}
                  className="btn-secondary w-full disabled:opacity-50"
                >
                  {disablingMFA ? t('vendor.security.disabling', 'Disabling...') : t('vendor.security.disable2FA', 'Disable 2FA')}
                </button>
              </>
            ) : (
              <>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-900">{t('vendor.security.enable2FA', 'Enable 2FA for better security')}</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        {t('vendor.security.enable2FADesc', 'Protect your account with an additional verification step')}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowMFASetup(true)}
                  className="btn-primary w-full"
                >
                  {t('vendor.security.enableTwoFactor', 'Enable Two-Factor Authentication')}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Active Sessions */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <DevicePhoneMobileIcon className="w-6 h-6 text-purple-600" />
              {t('vendor.security.activeSessions', 'Active Sessions')}
            </h2>
            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
              {sessionCount}
            </span>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">{t('vendor.security.manageSessions', 'Manage your active sessions')}</span>
                <button
                  onClick={() => setShowSessionManager(true)}
                  className="text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  {t('vendor.security.viewAll', 'View All')}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {t('vendor.security.activeSessionsCount', 'You have {{count}} active session(s) across devices', { count: sessionCount })}
              </p>
            </div>

            {sessionCount > 1 && (
              <button
                onClick={handleRevokeAllSessions}
                className="btn-secondary w-full text-sm"
              >
                {t('vendor.security.signOutOtherDevices', 'Sign Out All Other Devices')}
              </button>
            )}
          </div>
        </div>

        {/* Audit Log */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ClockIcon className="w-6 h-6 text-orange-600" />
              {t('vendor.security.recentActivity', 'Recent Activity')}
            </h2>
            <button
              onClick={refreshLogs}
              className="text-green-600 hover:text-green-700"
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
          </div>

          {logsLoading ? (
            <div className="text-center py-8 text-gray-500">{t('vendor.security.loading', 'Loading...')}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">{t('vendor.security.noActivity', 'No activity found')}</div>
          ) : (
            <div className="space-y-2">
              {logs.slice(0, 5).map(log => (
                <div key={log.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{log.action}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-gray-600">
                    {log.entity_type} {log.entity_id ? `(${log.entity_id.substring(0, 8)})` : ''}
                  </div>
                </div>
              ))}
              <button
                onClick={() => navigate('/activity-log')}
                className="w-full text-center text-sm text-green-600 hover:text-green-700 font-medium mt-3"
              >
                {t('vendor.security.viewFullActivity', 'View Full Activity Log')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <MFASetup
        isOpen={showMFASetup}
        onClose={() => {
          setShowMFASetup(false)
          loadSecurityData()
        }}
      />

      <SessionManager
        isOpen={showSessionManager}
        onClose={() => setShowSessionManager(false)}
      />

      <PhoneVerificationDialog
        open={showPhoneVerification}
        onClose={() => {
          setShowPhoneVerification(false)
          setPendingNewPassword('')
        }}
        userId={user?.id}
        phone={profile?.phone}
        purpose="sensitive_action"
        title="📱 تأكيد تغيير كلمة مرور المتجر"
        description="قبل اعتماد كلمة المرور الجديدة، نرسل رمز تحقق إلى هاتف البائع المسجل."
        onVerified={handlePasswordVerified}
      />
    </div>
  )
}

// Wrap with Error Boundary
const VendorSecurityWithErrorBoundary = () => (
  <ErrorBoundary componentName="VendorSecurityPage">
    <VendorSecurityPage />
  </ErrorBoundary>
)

export default VendorSecurityWithErrorBoundary
