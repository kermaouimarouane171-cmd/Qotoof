import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { mfaService } from '@/services/authServices'
import { useAuditLogs } from '@/services/auditLogger'
import { PhoneVerificationDialog } from '@/components/auth/PhoneVerification'
import MFASetup from '@/components/auth/MFASetup'
import SessionManager from '@/components/auth/SessionManager'
import ErrorBoundary from '@/components/ErrorBoundary'
import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'
import { useSecurity, validatePasswordStrength } from '@/hooks/useSecurity'
import {
  KeyIcon,
  DevicePhoneMobileIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon
} from '@heroicons/react/24/outline'
import { maskData } from '@/utils/encryption'
import toast from 'react-hot-toast'

const BuyerSecurityPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, revokeAllOtherSessions, updatePassword } = useAuthStore()
  const { mfaSettings, sessionCount, loading, disablingMFA, setDisablingMFA, loadSecurityData } = useSecurity()
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
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [showPhoneVerification, setShowPhoneVerification] = useState(false)
  const [pendingNewPassword, setPendingNewPassword] = useState('')

  const { logs, loading: logsLoading, refresh: refreshLogs } = useAuditLogs({ limit: 10 })

  // ============================================================
  // PASSWORD CHANGE HANDLER
  // ============================================================
  const handleChangePassword = async (e) => {
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

    const passwordValidation = validatePasswordStrength(newPassword, t, 'buyerSecurity.errors')
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
        setPasswordError(t('buyerSecurity.errors.incorrectPassword', 'Current password is incorrect'))
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
      setPasswordError(error.message || t('buyerSecurity.errors.passwordUpdateFailed', 'Failed to update password'))
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

  const handleDisableMFA = async () => {
    // Require password confirmation before disabling MFA
    const password = prompt(t('buyerSecurity.enterPasswordDisableMFA', 'Please enter your password to disable two-factor authentication:'))
    if (!password) return

    try {
      setDisablingMFA(true)

      // Verify password first
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      })

      if (verifyError) {
        toast.error(t('buyerSecurity.incorrectPassword', 'Incorrect password'))
        return
      }

      // Password verified - disable MFA
      const result = await mfaService.disable()

      if (result.success) {
        toast.success('تم تعطيل المصادقة الثنائية')
        await loadSecurityData()
      } else {
        toast.error(result.error || 'فشل تعطيل المصادقة')
      }
    } catch {
      toast.error('فشل تعطيل المصادقة')
    } finally {
      setDisablingMFA(false)
    }
  }

  const handleRevokeAllSessions = async () => {
    if (!confirm('تسجيل الخروج من جميع الأجهزة الأخرى؟')) {
      return
    }

    try {
      const result = await revokeAllOtherSessions()
      if (result.success) {
        toast.success('تم تسجيل الخروج من جميع الأجهزة')
        await loadSecurityData()
      } else {
        toast.error(result.error || 'فشل تسجيل الخروج')
      }
    } catch {
      toast.error('فشل تسجيل الخروج')
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">إعدادات الأمان</h1>
        <p className="text-gray-600">إدارة أمان حسابك وخصوصيتك</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <EyeIcon className="w-6 h-6 text-blue-600" />
              المعلومات الشخصية
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
                <div className="text-xs text-gray-500 mb-1">الاسم</div>
                <div className="font-medium">
                  {showPersonalInfo 
                    ? `${profile.first_name || ''} ${profile.last_name || ''}`
                    : maskData.name(profile.first_name || '')
                  }
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">البريد الإلكتروني</div>
                <div className="font-medium">
                  {showPersonalInfo 
                    ? profile.email 
                    : maskData.email(profile.email)
                  }
                </div>
              </div>
              {profile.phone && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">رقم الهاتف</div>
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
                  <div className="text-xs text-gray-500 mb-1">المدينة</div>
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
              المصادقة الثنائية
            </h2>
            {mfaSettings?.is_enabled ? (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                مفعّلة
              </span>
            ) : (
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                معطلة
              </span>
            )}
          </div>

          <div className="space-y-4">
            {mfaSettings?.is_enabled ? (
              <>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900">حسابك محمي</span>
                  </div>
                  <p className="text-sm text-green-700">
                    باستخدام {mfaSettings.method === 'email' ? 'البريد الإلكتروني' : 'تطبيق المصادقة'}
                  </p>
                  {mfaSettings.last_used_at && (
                    <p className="text-xs text-green-600 mt-2">
                      آخر استخدام: {new Date(mfaSettings.last_used_at).toLocaleString('ar-MA')}
                    </p>
                  )}
                </div>

                <button
                  onClick={handleDisableMFA}
                  disabled={disablingMFA}
                  className="btn-secondary w-full disabled:opacity-50"
                >
                  {disablingMFA ? 'جاري التعطيل...' : 'تعطيل المصادقة الثنائية'}
                </button>
              </>
            ) : (
              <>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-900">فعّل المصادقة الثنائية</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        حماية إضافية لحسابك من الدخول غير المصرح به
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowMFASetup(true)}
                  className="btn-primary w-full"
                >
                  تفعيل المصادقة الثنائية
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
              الجلسات النشطة
            </h2>
            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
              {sessionCount}
            </span>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">إدارة جلساتك النشطة</span>
                <button
                  onClick={() => setShowSessionManager(true)}
                  className="text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  عرض الكل
                </button>
              </div>
              <p className="text-xs text-gray-500">
                لديك {sessionCount} جلسة{sessionCount !== 1 ? 'ات' : ''} نشطة
              </p>
            </div>

            {sessionCount > 1 && (
              <button
                onClick={handleRevokeAllSessions}
                className="btn-secondary w-full text-sm"
              >
                تسجيل الخروج من الأجهزة الأخرى
              </button>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ClockIcon className="w-6 h-6 text-orange-600" />
              النشاط الأخير
            </h2>
            <button
              onClick={refreshLogs}
              className="text-green-600 hover:text-green-700"
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
          </div>

          {logsLoading ? (
            <div className="text-center py-8 text-gray-500">جاري التحميل...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">لا يوجد نشاط</div>
          ) : (
            <div className="space-y-2">
              {logs.slice(0, 5).map(log => (
                <div key={log.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{log.action}</span>
                    <span className="text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleString('ar-MA')}
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
                عرض سجل النشاط الكامل
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
        title="📱 تأكيد تغيير كلمة المرور"
        description="قبل اعتماد كلمة المرور الجديدة، أدخل رمز التحقق المرسل إلى هاتفك المسجل."
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
