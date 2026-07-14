import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useAuditLogs } from '@/services/auditLogger'
import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'
import { PhoneVerificationDialog } from '@/components/auth/PhoneVerification'
import MFASetup from '@/components/auth/MFASetup'
import SessionManager from '@/components/auth/SessionManager'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useSecurityData, usePasswordChange, usePasswordStrength, useSecurityActions } from '@/hooks/useSecurity'
import {
  KeyIcon,
  DevicePhoneMobileIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline'
import { maskData } from '@/utils/encryption'
import toast from 'react-hot-toast'

const BuyerSecurityPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile, user } = useAuthStore()
  const { mfaSettings, sessions, loading, reload: loadSecurityData } = useSecurityData()
  const sessionCount = sessions.length
  const { disableMFA, revokeAllSessions, isPending: disablingMFA } = useSecurityActions()
  const { changePassword, isPending: changingPassword } = usePasswordChange()
  const [showMFASetup, setShowMFASetup] = useState(false)
  const [showSessionManager, setShowSessionManager] = useState(false)
  const [showPersonalInfo, setShowPersonalInfo] = useState(false)

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [showPhoneVerification, setShowPhoneVerification] = useState(false)
  const [pendingNewPassword, setPendingNewPassword] = useState('')
  const strengthResult = usePasswordStrength(newPassword)

  const { logs, loading: logsLoading, refresh: refreshLogs } = useAuditLogs({ limit: 10 })

  // ============================================================
  // PASSWORD CHANGE HANDLER
  // ============================================================
  const handleChangePassword = (e) => {
    e.preventDefault()
    setPasswordError('')

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError(t('buyerSecurity.errors.allFieldsRequired', 'All fields are required'))
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t('buyerSecurity.errors.passwordsNotMatch', 'New passwords do not match'))
      return
    }

    if (newPassword === oldPassword) {
      setPasswordError(t('buyerSecurity.errors.passwordMustDiffer', 'New password must be different from old password'))
      return
    }

    if (strengthResult.score < 5) {
      const failedChecks = []
      if (!strengthResult.checks.minLength) failedChecks.push(t('buyerSecurity.errors.passwordNeedsLength', 'at least 8 characters'))
      if (!strengthResult.checks.uppercase) failedChecks.push(t('buyerSecurity.errors.passwordNeedsUppercase', 'an uppercase letter'))
      if (!strengthResult.checks.lowercase) failedChecks.push(t('buyerSecurity.errors.passwordNeedsLowercase', 'a lowercase letter'))
      if (!strengthResult.checks.number) failedChecks.push(t('buyerSecurity.errors.passwordNeedsNumber', 'a number'))
      if (!strengthResult.checks.special) failedChecks.push(t('buyerSecurity.errors.passwordNeedsSpecial', 'a special character'))
      setPasswordError(t('buyerSecurity.errors.passwordTooWeakDetail', 'Password does not meet strength requirements. Missing: {{missing}}', { missing: failedChecks.join(', ') }))
      return
    }

    if (!profile?.phone) {
      setPasswordError(t('buyerSecurity.errors.phoneRequired', 'Add a phone number to your account before changing password. Go to your Profile page to add one.'))
      return
    }

    setPendingNewPassword(newPassword)
    setShowPhoneVerification(true)
  }

  const handlePasswordVerified = async () => {
    const nextPassword = pendingNewPassword

    setShowPhoneVerification(false)
    setPendingNewPassword('')

    if (!nextPassword) return

    const result = await changePassword(oldPassword, nextPassword)

    if (result.success) {
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordChange(false)
      setPasswordError('')
    } else {
      setPasswordError(result.error || t('buyerSecurity.errors.passwordUpdateFailed', 'Failed to update password'))
    }
  }

  // ============================================================
  // SEND SECURITY CHANGE EMAIL NOTIFICATION
  // ============================================================
  const sendSecurityEmail = async (action, details = '') => {
    if (!user?.id) return

    try {
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'security_alert',
        title: t('buyerSecurity.email.title', 'Security Alert: {{action}}', { action }),
        message: t('buyerSecurity.email.message', 'A security change was made on your account: {{action}}. {{details}} If this wasn\'t you, please contact support immediately.', { action, details }),
        is_read: false,
        created_at: new Date().toISOString(),
      })

      logger.info(`Security email sent to ${user.email}: ${action}`)
    } catch (error) {
      logger.error('Failed to send security email:', error)
    }
  }

  const handleDisableMFA = async () => {
    if (!user?.email || !user?.id) {
      toast.error(t('buyerSecurity.errors.accountNotFound', 'Could not identify current account'))
      return
    }

    const password = prompt(t('buyerSecurity.enterPasswordDisableMFA', 'Please enter your password to disable two-factor authentication:'))
    if (!password) return

    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      })

      if (verifyError) {
        toast.error(t('buyerSecurity.errors.incorrectPassword', 'Incorrect password'))
        return
      }

      await disableMFA()

      await sendSecurityEmail('Two-Factor Authentication Disabled')

      toast.success(t('buyerSecurity.mfa.disabled', 'Two-factor authentication disabled'))
      await loadSecurityData()
    } catch (error) {
      logger.error('Disable MFA error:', error)
      toast.error(t('buyerSecurity.mfa.disableFailed', 'Failed to disable authentication'))
    }
  }

  const handleRevokeAllSessions = async () => {
    if (!confirm(t('buyerSecurity.sessions.confirmRevokeAll', 'Sign out from all other devices?'))) {
      return
    }

    try {
      await revokeAllSessions()
      toast.success(t('buyerSecurity.sessions.revokedAll', 'Signed out from all devices'))
      await loadSecurityData()
    } catch {
      toast.error(t('buyerSecurity.sessions.revokeFailed', 'Failed to sign out'))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => navigate('/marketplace')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={t('buyerSecurity.backToMarketplace', 'Back to marketplace')}
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{t('buyerSecurity.title', 'Security Settings')}</h1>
        </div>
        <p className="text-gray-600">{t('buyerSecurity.subtitle', 'Manage your account security and privacy')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <EyeIcon className="w-6 h-6 text-blue-600" />
              {t('buyerSecurity.personalInfo.title', 'Personal Information')}
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
                <div className="text-xs text-gray-500 mb-1">{t('buyerSecurity.personalInfo.name', 'Name')}</div>
                <div className="font-medium">
                  {showPersonalInfo 
                    ? `${profile.first_name || ''} ${profile.last_name || ''}`
                    : maskData.name(profile.first_name || '')
                  }
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">{t('buyerSecurity.personalInfo.email', 'Email')}</div>
                <div className="font-medium">
                  {showPersonalInfo 
                    ? profile.email 
                    : maskData.email(profile.email)
                  }
                </div>
              </div>
              {profile.phone && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">{t('buyerSecurity.personalInfo.phone', 'Phone')}</div>
                  <div className="font-medium">
                    {showPersonalInfo 
                      ? profile.phone 
                      : maskData.phone(profile.phone)
                    }
                  </div>
                </div>
              )}
              {profile.city && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">{t('buyerSecurity.personalInfo.city', 'City')}</div>
                  <div className="font-medium">{profile.city}</div>
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
              {t('buyerSecurity.changePassword', 'Change Password')}
            </h2>
          </div>

          {!showPasswordChange ? (
            <button
              onClick={() => setShowPasswordChange(true)}
              className="btn-primary w-full"
            >
              {t('buyerSecurity.changePassword', 'Change Password')}
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="input-label">{t('buyerSecurity.currentPassword', 'Current Password')} *</label>
                <div className="relative">
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="input pr-10"
                    placeholder={t('buyerSecurity.currentPasswordPlaceholder', 'Enter current password')}
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
                <label className="input-label">{t('buyerSecurity.newPassword', 'New Password')} *</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="input pr-10"
                    placeholder={t('buyerSecurity.newPasswordPlaceholder', 'At least 8 characters')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showNewPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  </button>
                </div>
                {newPassword.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            strengthResult.score <= 1 ? 'bg-red-500' :
                            strengthResult.score === 2 ? 'bg-orange-500' :
                            strengthResult.score === 3 ? 'bg-yellow-500' :
                            strengthResult.score === 4 ? 'bg-lime-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${(strengthResult.score / 5) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${strengthResult.color}`}>
                        {t(`buyerSecurity.strength.${strengthResult.label.replace(' ', '')}`, strengthResult.label)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <span className={`flex items-center gap-1 ${strengthResult.checks.minLength ? 'text-green-600' : 'text-gray-400'}`}>
                        {strengthResult.checks.minLength ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <ExclamationTriangleIcon className="w-3.5 h-3.5" />}
                        {t('buyerSecurity.strength.minLength', '8+ characters')}
                      </span>
                      <span className={`flex items-center gap-1 ${strengthResult.checks.uppercase ? 'text-green-600' : 'text-gray-400'}`}>
                        {strengthResult.checks.uppercase ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <ExclamationTriangleIcon className="w-3.5 h-3.5" />}
                        {t('buyerSecurity.strength.uppercase', 'Uppercase letter')}
                      </span>
                      <span className={`flex items-center gap-1 ${strengthResult.checks.lowercase ? 'text-green-600' : 'text-gray-400'}`}>
                        {strengthResult.checks.lowercase ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <ExclamationTriangleIcon className="w-3.5 h-3.5" />}
                        {t('buyerSecurity.strength.lowercase', 'Lowercase letter')}
                      </span>
                      <span className={`flex items-center gap-1 ${strengthResult.checks.number ? 'text-green-600' : 'text-gray-400'}`}>
                        {strengthResult.checks.number ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <ExclamationTriangleIcon className="w-3.5 h-3.5" />}
                        {t('buyerSecurity.strength.number', 'Number')}
                      </span>
                      <span className={`flex items-center gap-1 ${strengthResult.checks.special ? 'text-green-600' : 'text-gray-400'}`}>
                        {strengthResult.checks.special ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <ExclamationTriangleIcon className="w-3.5 h-3.5" />}
                        {t('buyerSecurity.strength.special', 'Special character')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="input-label">{t('buyerSecurity.confirmPassword', 'Confirm New Password')} *</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input pr-10"
                    placeholder={t('buyerSecurity.confirmPasswordPlaceholder', 'Re-enter new password')}
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
                  {passwordError.includes('phone number') && (
                    <button
                      type="button"
                      onClick={() => navigate('/buyer/profile')}
                      className="ml-2 underline font-medium text-red-800 hover:text-red-900"
                    >
                      {t('buyerSecurity.goToProfile', 'Go to Profile →')}
                    </button>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {changingPassword ? t('buyerSecurity.updating', 'Updating...') : t('buyerSecurity.updatePassword', 'Update Password')}
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

        {/* Two-Factor Authentication */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <KeyIcon className="w-6 h-6 text-green-600" />
              {t('buyerSecurity.mfa.title', 'Two-Factor Authentication')}
            </h2>
            {mfaSettings?.is_enabled ? (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                {t('buyerSecurity.mfa.enabled', 'Enabled')}
              </span>
            ) : (
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                {t('buyerSecurity.mfa.disabledBadge', 'Disabled')}
              </span>
            )}
          </div>

          <div className="space-y-4">
            {mfaSettings?.is_enabled ? (
              <>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900">{t('buyerSecurity.mfa.protected', 'Your account is protected')}</span>
                  </div>
                  <p className="text-sm text-green-700">
                    {t('buyerSecurity.mfa.using', 'Using')} {t('buyerSecurity.mfa.appMethod', 'authenticator app')}
                  </p>
                  {mfaSettings.factors && mfaSettings.factors.length > 1 && (
                    <p className="text-xs text-green-600 mt-2">
                      {mfaSettings.factors.length} factors enrolled
                    </p>
                  )}
                </div>

                <button
                  onClick={handleDisableMFA}
                  disabled={disablingMFA}
                  className="btn-secondary w-full disabled:opacity-50"
                >
                  {disablingMFA ? t('buyerSecurity.mfa.disabling', 'Disabling...') : t('buyerSecurity.mfa.disable', 'Disable Two-Factor Authentication')}
                </button>
              </>
            ) : (
              <>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-900">{t('buyerSecurity.mfa.enableTitle', 'Enable Two-Factor Authentication')}</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        {t('buyerSecurity.mfa.enableDesc', 'Add extra protection to your account against unauthorized access')}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowMFASetup(true)}
                  className="btn-primary w-full"
                >
                  {t('buyerSecurity.mfa.enable', 'Enable Two-Factor Authentication')}
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
              {t('buyerSecurity.sessions.title', 'Active Sessions')}
            </h2>
            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
              {sessionCount}
            </span>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">{t('buyerSecurity.sessions.manage', 'Manage your active sessions')}</span>
                <button
                  onClick={() => setShowSessionManager(true)}
                  className="text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  {t('buyerSecurity.sessions.viewAll', 'View All')}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {t('buyerSecurity.sessions.count', 'You have {{count}} active session(s)', { count: sessionCount })}
              </p>
            </div>

            {sessionCount > 1 && (
              <button
                onClick={handleRevokeAllSessions}
                className="btn-secondary w-full text-sm"
              >
                {t('buyerSecurity.sessions.signOutOthers', 'Sign out from other devices')}
              </button>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ClockIcon className="w-6 h-6 text-orange-600" />
              {t('buyerSecurity.activity.title', 'Recent Activity')}
            </h2>
            <button
              onClick={refreshLogs}
              className="text-green-600 hover:text-green-700"
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
          </div>

          {logsLoading ? (
            <div className="text-center py-8 text-gray-500">{t('common.loading', 'Loading...')}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">{t('buyerSecurity.activity.empty', 'No activity')}</div>
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
                    {log.entity_type}
                  </div>
                </div>
              ))}
              <button
                onClick={() => navigate('/activity-log')}
                className="w-full text-center text-sm text-green-600 hover:text-green-700 font-medium mt-3"
              >
                {t('buyerSecurity.activity.viewFullLog', 'View full activity log')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <MFASetup
        isOpen={showMFASetup}
        onClose={async () => {
          setShowMFASetup(false)
          await loadSecurityData()
          if (mfaSettings?.is_enabled) {
            await sendSecurityEmail('Two-Factor Authentication Enabled')
          }
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
        title={t('buyerSecurity.phoneVerify.title', 'Confirm Password Change')}
        description={t('buyerSecurity.phoneVerify.desc', 'Before applying the new password, enter the verification code sent to your registered phone.')}
        onVerified={handlePasswordVerified}
      />
    </div>
  )
}

// Wrap with Error Boundary
const BuyerSecurityWithErrorBoundary = () => (
  <ErrorBoundary componentName="BuyerSecurityPage">
    <BuyerSecurityPage />
  </ErrorBoundary>
)

export default BuyerSecurityWithErrorBoundary
