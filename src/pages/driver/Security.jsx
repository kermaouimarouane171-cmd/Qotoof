import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { useAuditLogs } from '@/services/auditLogger'
import MFASetup from '@/components/auth/MFASetup'
import SessionManager from '@/components/auth/SessionManager'
import { useSecurityData, useSecurityActions } from '@/hooks/useSecurity'
import {
  KeyIcon,
  DevicePhoneMobileIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  MapPinIcon,
  TruckIcon
} from '@heroicons/react/24/outline'
import { maskData } from '@/utils/encryption'
import toast from 'react-hot-toast'

const DriverSecurityPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { mfaSettings, sessions, loading, reload: loadSecurityData } = useSecurityData()
  const sessionCount = sessions.length
  const { disableMFA, revokeAllSessions, isPending: disablingMFA } = useSecurityActions()
  const [showMFASetup, setShowMFASetup] = useState(false)
  const [showSessionManager, setShowSessionManager] = useState(false)
  const [showLocationInfo, setShowLocationInfo] = useState(false)

  const { logs, loading: logsLoading, refresh: refreshLogs } = useAuditLogs({ limit: 10 })

  const handleDisableMFA = async () => {
    if (!confirm(t('driver.security.disableMFAConfirm', 'Are you sure you want to disable two-factor authentication?'))) {
      return
    }

    try {
      await disableMFA()
      toast.success(t('driver.security.mfaDisabled', 'Two-factor authentication disabled'))
      await loadSecurityData()
    } catch {
      toast.error(t('driver.security.mfaDisableFailed', 'Failed to disable two-factor authentication'))
    }
  }

  const handleRevokeAllSessions = async () => {
    if (!confirm(t('driver.security.revokeConfirm', 'Sign out from all other devices?'))) {
      return
    }

    try {
      await revokeAllSessions()
      toast.success(t('driver.security.revokeSuccess', 'Signed out from all devices'))
      await loadSecurityData()
    } catch {
      toast.error(t('driver.security.revokeFailed', 'Failed to sign out'))
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('driver.security.title', 'Security Settings')}</h1>
        <p className="text-gray-600">{t('driver.security.subtitle', 'Manage your account security and privacy as a driver')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Driver Info */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TruckIcon className="w-6 h-6 text-blue-600" />
              {t('driver.security.driverInfo', 'Driver Information')}
            </h2>
          </div>

          {profile && (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">{t('driver.security.name', 'Name')}</div>
                <div className="font-medium">{profile.first_name || ''} {profile.last_name || ''}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">{t('driver.security.email', 'Email')}</div>
                <div className="font-medium">{maskData.email(profile.email)}</div>
              </div>
              {profile.phone && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">{t('driver.security.phone', 'Phone Number')}</div>
                  <div className="font-medium">{maskData.phone(profile.phone)}</div>
                </div>
              )}
              {profile.vehicle_type && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">{t('driver.security.vehicleType', 'Vehicle Type')}</div>
                  <div className="font-medium">{profile.vehicle_type}</div>
                </div>
              )}
              {profile.vehicle_plate && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-xs text-gray-500 mb-1">{t('driver.security.licensePlate', 'License Plate')}</div>
                  <div className="font-medium">{maskData.generic(profile.vehicle_plate, 2, 2)}</div>
                </div>
              )}

              {/* Location Tracking Status */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPinIcon className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-900">{t('driver.security.locationTracking', 'Location Tracking')}</span>
                </div>
                <p className="text-sm text-blue-700">
                  {t('driver.security.locationDesc', 'Your location is only shared during active deliveries')}
                </p>
                <button
                  onClick={() => setShowLocationInfo(!showLocationInfo)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-2"
                >
                  {showLocationInfo ? t('driver.security.hideDetails', 'Hide Details') : t('driver.security.showDetails', 'Show Details')}
                </button>
                {showLocationInfo && profile.latitude && profile.longitude && (
                  <div className="mt-2 text-xs text-blue-600">
                    <div>{t('driver.security.latitude', 'Latitude')}: {profile.latitude}</div>
                    <div>{t('driver.security.longitude', 'Longitude')}: {profile.longitude}</div>
                    {profile.last_seen_at && (
                      <div>{t('driver.security.lastUpdate', 'Last Updated')}: {new Date(profile.last_seen_at).toLocaleString('ar-MA')}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Two-Factor Authentication */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <KeyIcon className="w-6 h-6 text-green-600" />
              {t('driver.security.twoFactorAuth', 'Two-Factor Authentication')}
            </h2>
            {mfaSettings?.is_enabled ? (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                {t('driver.security.enabled', 'Enabled')}
              </span>
            ) : (
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                {t('driver.security.disabled', 'Disabled')}
              </span>
            )}
          </div>

          <div className="space-y-4">
            {mfaSettings?.is_enabled ? (
              <>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900">{t('driver.security.accountProtected', 'Your account is protected')}</span>
                  </div>
                  <p className="text-sm text-green-700">
                    {t('driver.security.using', 'Using')} {mfaSettings.method === 'email' ? t('driver.security.emailMethod', 'Email') : t('driver.security.authenticatorApp', 'Authenticator App')}
                  </p>
                </div>

                <button
                  onClick={handleDisableMFA}
                  disabled={disablingMFA}
                  className="btn-secondary w-full disabled:opacity-50"
                >
                  {disablingMFA ? t('driver.security.disabling', 'Disabling...') : t('driver.security.disableMFA', 'Disable Two-Factor Authentication')}
                </button>
              </>
            ) : (
              <>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-900">{t('driver.security.enableMFA', 'Enable Two-Factor Authentication')}</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        {t('driver.security.enableMFADesc', 'Protecting your account is important, especially since you handle customer orders')}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowMFASetup(true)}
                  className="btn-primary w-full"
                >
                  {t('driver.security.enableMFA', 'Enable Two-Factor Authentication')}
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
              {t('driver.security.activeSessions', 'Active Sessions')}
            </h2>
            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
              {sessionCount}
            </span>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">{t('driver.security.manageSessions', 'Manage your active sessions')}</span>
                <button
                  onClick={() => setShowSessionManager(true)}
                  className="text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  {t('driver.security.viewAll', 'View All')}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {t('driver.security.sessionCount', 'You have {{count}} active session(s)', { count: sessionCount })}
              </p>
            </div>

            {sessionCount > 1 && (
              <button
                onClick={handleRevokeAllSessions}
                className="btn-secondary w-full text-sm"
              >
                {t('driver.security.revokeOther', 'Sign out from other devices')}
              </button>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ClockIcon className="w-6 h-6 text-orange-600" />
              {t('driver.security.recentActivity', 'Recent Activity')}
            </h2>
            <button
              onClick={refreshLogs}
              className="text-green-600 hover:text-green-700"
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
          </div>

          {logsLoading ? (
            <div className="text-center py-8 text-gray-500">{t('driver.security.loading', 'Loading...')}</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">{t('driver.security.noActivity', 'No activity')}</div>
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
    </div>
  )
}

export default DriverSecurityPage
