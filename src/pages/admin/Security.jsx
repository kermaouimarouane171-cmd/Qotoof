import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { sessionService } from '@/modules/auth'
import { supabase } from '@/services/supabase'
import { useAuditLogs } from '@/services/auditLogger'
import {
  getSecurityAlerts,
  getSecurityAlertsStats,
  getBlockedIPs,
  blockIP,
  unblockIP,
  resolveSecurityAlert,
  subscribeToSecurityAlerts,
  subscribeToBlockedIPs,
} from '@/services/ipBlocking'
import MFASetup from '@/components/auth/MFASetup'
import SessionManager from '@/components/auth/SessionManager'
import { Card, Badge, Button, LoadingSpinner, Modal, Input } from '@/components/ui'
import {
  ShieldCheckIcon,
  KeyIcon,
  DevicePhoneMobileIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  UsersIcon,
  LockClosedIcon,
  EyeIcon,
  BellAlertIcon,
  NoSymbolIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline'
import { maskData } from '@/utils/encryption'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const severityConfig = {
  critical: { color: 'bg-red-100 text-red-800 border-red-200', icon: '🚨', label: 'Critical' },
  high: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: '⚠️', label: 'High' },
  medium: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: '⚡', label: 'Medium' },
  low: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: 'ℹ️', label: 'Low' },
}

const alertTypeLabels = {
  brute_force_login: 'Brute Force Login',
  suspicious_login: 'Suspicious Login',
  unauthorized_access: 'Unauthorized Access',
  rate_limit_exceeded: 'Rate Limit Exceeded',
  sql_injection_attempt: 'SQL Injection Attempt',
  xss_attempt: 'XSS Attempt',
  csrf_violation: 'CSRF Violation',
  account_takeover_attempt: 'Account Takeover Attempt',
  mfa_bypass_attempt: 'MFA Bypass Attempt',
  privilege_escalation: 'Privilege Escalation',
  data_exfiltration: 'Data Exfiltration',
  ip_blocked: 'IP Blocked',
  ip_unblocked: 'IP Unblocked',
  user_suspended: 'User Suspended',
  user_unsuspended: 'User Unsuspended',
  custom: 'Custom Alert',
}

const AdminSecurityPage = () => {
  const { t } = useTranslation()
  const { user, profile } = useAuthStore()
  const [mfaSettings, setMfaSettings] = useState(null)
  const [sessionCount, setSessionCount] = useState(0)
  const [showMFASetup, setShowMFASetup] = useState(false)
  const [showSessionManager, setShowSessionManager] = useState(false)
  const [loading, setLoading] = useState(true)
  const [disablingMFA, setDisablingMFA] = useState(false)

  // System-wide stats
  const [systemStats, setSystemStats] = useState({
    totalUsers: 0,
    activeSessions: 0,
    mfaEnabledUsers: 0,
    blockedUsers: 0
  })

  // Security alerts
  const [securityAlerts, setSecurityAlerts] = useState([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [alertsStats, setAlertsStats] = useState({
    totalAlerts: 0,
    unresolvedAlerts: 0,
    criticalAlerts: 0,
    highAlerts: 0,
    blockedIPsCount: 0,
  })
  const [alertFilter, setAlertFilter] = useState('all')

  // Blocked IPs
  const [blockedIPs, setBlockedIPs] = useState([])
  const [blockedIPsLoading, setBlockedIPsLoading] = useState(true)
  const [showBlockIPModal, setShowBlockIPModal] = useState(false)
  const [newBlockIP, setNewBlockIP] = useState({ ip: '', reason: '', blockType: 'manual', expiresAt: '' })
  const [blockingIP, setBlockingIP] = useState(false)

  // Resolve alert modal
  const [showResolveModal, setShowResolveModal] = useState(false)
  const [resolvingAlertId, setResolvingAlertId] = useState(null)
  const [resolveNotes, setResolveNotes] = useState('')
  const [resolving, setResolving] = useState(false)

  const { logs, loading: logsLoading, refresh: refreshLogs } = useAuditLogs({ limit: 20 })

  // Refs for unsubscribe and in-flight request guards
  const alertsUnsubRef = useRef(null)
  const blockedIPsUnsubRef = useRef(null)
  const isLoadingSecurityData = useRef(false)

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    loadSecurityData()
    loadSystemStats()
    loadSecurityAlerts()
    loadBlockedIPs()
    loadAlertsStats()
  }, [])
  /* eslint-enable react-hooks/exhaustive-deps */

  // Setup real-time listeners
  useEffect(() => {
    // Listen for new security alerts
    alertsUnsubRef.current = subscribeToSecurityAlerts((newAlert) => {
      setSecurityAlerts(prev => [newAlert, ...prev])
      loadAlertsStats()
      
      // Show toast for critical/high alerts
      if (newAlert.severity === 'critical' || newAlert.severity === 'high') {
        toast.error(
          `${severityConfig[newAlert.severity].icon} ${newAlert.title}`,
          { duration: 8000 }
        )
      }
    })

    // Listen for blocked IP changes
    blockedIPsUnsubRef.current = subscribeToBlockedIPs(() => {
      loadBlockedIPs()
      loadAlertsStats()
    })

    return () => {
      if (alertsUnsubRef.current) alertsUnsubRef.current()
      if (blockedIPsUnsubRef.current) blockedIPsUnsubRef.current()
    }
  }, [])

  const loadSecurityData = async () => {
    if (isLoadingSecurityData.current) return
    isLoadingSecurityData.current = true
    try {
      setLoading(true)
      const { data: factorsData } = await supabase.auth.mfa.listFactors()
      const totpFactors = factorsData?.totp || []
      const mfa = totpFactors.length > 0 ? { is_enabled: true, method: 'totp', factors: totpFactors } : null
      setMfaSettings(mfa)

      const sessions = await sessionService.getActiveSessions()
      setSessionCount(sessions.length)
    } catch (error) {
      logger.error('Load security data error:', JSON.stringify(error, null, 2))
    } finally {
      setLoading(false)
      isLoadingSecurityData.current = false
    }
  }

  const loadSystemStats = async () => {
    try {
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      const { count: mfaEnabledUsers } = await supabase
        .from('mfa_settings')
        .select('*', { count: 'exact', head: true })
        .eq('is_enabled', true)

      const { count: activeSessions } = await supabase
        .from('active_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      const { count: blockedUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_suspended', true)

      setSystemStats({
        totalUsers: totalUsers || 0,
        activeSessions: activeSessions || 0,
        mfaEnabledUsers: mfaEnabledUsers || 0,
        blockedUsers: blockedUsers || 0
      })
    } catch (error) {
      logger.error('Load system stats error:', JSON.stringify(error, null, 2))
    }
  }

  const loadSecurityAlerts = async () => {
    try {
      setAlertsLoading(true)
      const options = {
        limit: 50,
        unresolvedOnly: alertFilter === 'unresolved',
        severity: alertFilter !== 'all' && alertFilter !== 'unresolved' ? alertFilter : null,
      }
      const { success, data } = await getSecurityAlerts(options)
      if (success) setSecurityAlerts(data)
    } catch (error) {
      logger.error('Load security alerts error:', JSON.stringify(error, null, 2))
    } finally {
      setAlertsLoading(false)
    }
  }

  const loadBlockedIPs = async () => {
    try {
      setBlockedIPsLoading(true)
      const { success, data } = await getBlockedIPs()
      if (success) setBlockedIPs(data)
    } catch (error) {
      logger.error('Load blocked IPs error:', JSON.stringify(error, null, 2))
    } finally {
      setBlockedIPsLoading(false)
    }
  }

  const loadAlertsStats = async () => {
    try {
      const { success, data } = await getSecurityAlertsStats()
      if (success && data) setAlertsStats(data)
    } catch (error) {
      logger.error('Load alerts stats error:', JSON.stringify(error, null, 2))
    }
  }

  const handleDisableMFA = async () => {
    if (!confirm(t('admin.security.disableMFAConfirm', 'Are you sure you want to disable two-factor authentication?'))) {
      return
    }

    try {
      setDisablingMFA(true)
      const { data: factorsData } = await supabase.auth.mfa.listFactors()
      const totpFactors = factorsData?.totp || []
      for (const factor of totpFactors) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: factor.id })
        if (unenrollError) throw unenrollError
      }

      toast.success(t('admin.security.mfaDisabled', 'Two-factor authentication disabled'))
      await loadSecurityData()
    } catch (_error) {
      toast.error(t('admin.security.mfaDisableFailed', 'Failed to disable MFA'))
    } finally {
      setDisablingMFA(false)
    }
  }

  const handleRevokeAllSessions = async () => {
    if (!confirm(t('admin.security.revokeSessionsConfirm', 'Sign out from all other devices?'))) {
      return
    }

    try {
      const result = await sessionService.revokeAllOtherSessions()
      if (result.success) {
        toast.success(t('admin.security.sessionsRevoked', 'Signed out from all devices'))
        await loadSecurityData()
      } else {
        toast.error(result.error || t('admin.security.revokeFailed', 'Failed to sign out'))
      }
    } catch (_error) {
      toast.error(t('admin.security.revokeFailed', 'Failed to sign out'))
    }
  }

  const handleBlockIP = async () => {
    if (!newBlockIP.ip.trim()) {
      toast.error(t('admin.security.ipRequired', 'IP address is required'))
      return
    }
    if (!newBlockIP.reason.trim()) {
      toast.error(t('admin.security.reasonRequired', 'Reason is required'))
      return
    }

    setBlockingIP(true)

    try {
      const result = await blockIP({
        ip: newBlockIP.ip,
        reason: newBlockIP.reason,
        blockType: newBlockIP.blockType,
        expiresAt: newBlockIP.expiresAt || null,
        blockedBy: user.id,
      })

      if (result.success) {
        toast.success(t('admin.security.ipBlocked', 'IP blocked successfully'))
        setShowBlockIPModal(false)
        setNewBlockIP({ ip: '', reason: '', blockType: 'manual', expiresAt: '' })
        await loadBlockedIPs()
        await loadAlertsStats()
      } else {
        toast.error(result.error || t('admin.security.blockFailed', 'Failed to block IP'))
      }
    } catch (_error) {
      toast.error(t('admin.security.blockFailed', 'Failed to block IP'))
    } finally {
      setBlockingIP(false)
    }
  }

  const handleUnblockIP = async (ipBlockId) => {
    try {
      const result = await unblockIP(ipBlockId, user.id)
      if (result.success) {
        toast.success(t('admin.security.ipUnblocked', 'IP unblocked successfully'))
        await loadBlockedIPs()
        await loadAlertsStats()
      } else {
        toast.error(result.error || t('admin.security.unblockFailed', 'Failed to unblock IP'))
      }
    } catch (_error) {
      toast.error(t('admin.security.unblockFailed', 'Failed to unblock IP'))
    }
  }

  const openResolveModal = (alertId) => {
    setResolvingAlertId(alertId)
    setResolveNotes('')
    setShowResolveModal(true)
  }

  const handleResolveAlert = async () => {
    setResolving(true)

    try {
      const result = await resolveSecurityAlert(resolvingAlertId, user.id, resolveNotes)
      if (result.success) {
        toast.success(t('admin.security.alertResolved', 'Alert resolved'))
        setShowResolveModal(false)
        await loadSecurityAlerts()
        await loadAlertsStats()
      } else {
        toast.error(result.error || t('admin.security.resolveFailed', 'Failed to resolve alert'))
      }
    } catch (_error) {
      toast.error(t('admin.security.resolveFailed', 'Failed to resolve alert'))
    } finally {
      setResolving(false)
    }
  }

  const mfaPercentage = systemStats.totalUsers > 0
    ? Math.round((systemStats.mfaEnabledUsers / systemStats.totalUsers) * 100)
    : 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('admin.security.title', 'Security Center')}</h1>
        <p className="text-gray-600">{t('admin.security.subtitle', 'Monitor and manage platform security')}</p>
      </div>

      {/* System-wide Security Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <UsersIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{systemStats.totalUsers}</div>
              <div className="text-xs text-gray-500">{t('admin.security.totalUsers', 'Total Users')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <ShieldCheckIcon className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{mfaPercentage}%</div>
              <div className="text-xs text-gray-500">{t('admin.security.mfaEnabled', 'MFA Enabled')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <DevicePhoneMobileIcon className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{systemStats.activeSessions}</div>
              <div className="text-xs text-gray-500">{t('admin.security.activeSessions', 'Active Sessions')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <LockClosedIcon className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{systemStats.blockedUsers}</div>
              <div className="text-xs text-gray-500">{t('admin.security.blockedUsers', 'Suspended Users')}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Security Alerts Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4 border-l-4 border-red-500">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🚨</div>
            <div>
              <div className="text-2xl font-bold text-red-600">{alertsStats.criticalAlerts}</div>
              <div className="text-xs text-gray-500">{t('admin.security.criticalAlerts', 'Critical Alerts')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-orange-500">
          <div className="flex items-center gap-3">
            <div className="text-3xl">⚠️</div>
            <div>
              <div className="text-2xl font-bold text-orange-600">{alertsStats.highAlerts}</div>
              <div className="text-xs text-gray-500">{t('admin.security.highAlerts', 'High Priority')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-yellow-500">
          <div className="flex items-center gap-3">
            <div className="text-3xl">⚡</div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{alertsStats.unresolvedAlerts}</div>
              <div className="text-xs text-gray-500">{t('admin.security.unresolvedAlerts', 'Unresolved')}</div>
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-gray-500">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🚫</div>
            <div>
              <div className="text-2xl font-bold">{alertsStats.blockedIPsCount}</div>
              <div className="text-xs text-gray-500">{t('admin.security.blockedIPs', 'Blocked IPs')}</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Admin Account */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <EyeIcon className="w-6 h-6 text-blue-600" />
              {t('admin.security.adminAccount', 'Admin Account')}
            </h2>
          </div>

          {profile && (
            <div className="space-y-3">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">{t('admin.security.name', 'Name')}</div>
                <div className="font-medium">{profile.first_name || ''} {profile.last_name || ''}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">{t('admin.security.email', 'Email')}</div>
                <div className="font-medium">{maskData.email(profile.email)}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">{t('admin.security.role', 'Role')}</div>
                <div className="font-medium">
                  <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                    {profile.role}
                  </span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Two-Factor Authentication */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <KeyIcon className="w-6 h-6 text-green-600" />
              {t('admin.security.mfa', 'Two-Factor Authentication')}
            </h2>
            {mfaSettings?.is_enabled ? (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                {t('admin.security.enabled', 'Enabled')}
              </span>
            ) : (
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                {t('admin.security.disabled', 'Disabled')}
              </span>
            )}
          </div>

          <div className="space-y-4">
            {mfaSettings?.is_enabled ? (
              <>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900">{t('admin.security.accountProtected', 'Account Protected')}</span>
                  </div>
                  <p className="text-sm text-green-700">
                    {t('admin.security.mfaMethod', 'Using {{method}}', { method: t('admin.security.authenticatorApp', 'Authenticator App') })}
                  </p>
                </div>

                <button
                  onClick={handleDisableMFA}
                  disabled={disablingMFA}
                  className="btn-secondary w-full disabled:opacity-50"
                >
                  {disablingMFA ? t('admin.security.disabling', 'Disabling...') : t('admin.security.disableMFA', 'Disable MFA')}
                </button>
              </>
            ) : (
              <>
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-900">{t('admin.security.unprotectedWarning', '⚠️ Admin account without protection!')}</p>
                      <p className="text-sm text-red-700 mt-1">
                        {t('admin.security.adminMFARequired', 'Admin accounts must be protected with two-factor authentication')}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowMFASetup(true)}
                  className="btn-primary w-full"
                >
                  {t('admin.security.enableMFA', 'Enable MFA Now')}
                </button>
              </>
            )}
          </div>
        </Card>

        {/* Active Sessions */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <DevicePhoneMobileIcon className="w-6 h-6 text-purple-600" />
              {t('admin.security.activeSessionsTitle', 'Active Sessions')}
            </h2>
            <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
              {sessionCount}
            </span>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">{t('admin.security.manageSessions', 'Manage your active sessions')}</span>
                <button
                  onClick={() => setShowSessionManager(true)}
                  className="text-green-600 hover:text-green-700 text-sm font-medium"
                >
                  {t('admin.security.viewAll', 'View All')}
                </button>
              </div>
              <p className="text-xs text-gray-500">
                {t('admin.security.sessionCount', 'You have {{count}} active session(s)', { count: sessionCount })}
              </p>
            </div>

            {sessionCount > 1 && (
              <button
                onClick={handleRevokeAllSessions}
                className="btn-secondary w-full text-sm"
              >
                {t('admin.security.revokeOther', 'Sign out from other devices')}
              </button>
            )}
          </div>
        </Card>

        {/* System Audit Log */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ClockIcon className="w-6 h-6 text-orange-600" />
              {t('admin.security.auditLog', 'System Audit Log')}
            </h2>
            <button
              onClick={refreshLogs}
              className="text-green-600 hover:text-green-700"
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
          </div>

          {logsLoading ? (
            <div className="text-center py-8 text-gray-500"><LoadingSpinner size="sm" /></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">{t('admin.security.noActivity', 'No activity')}</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.slice(0, 10).map(log => (
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
            </div>
          )}
        </Card>
      </div>

      {/* Real-Time Security Alerts Section */}
      <div className="mt-8">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BellAlertIcon className="w-6 h-6 text-red-600" />
              {t('admin.security.securityAlerts', 'Real-Time Security Alerts')}
              {alertsStats.unresolvedAlerts > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium animate-pulse">
                  {alertsStats.unresolvedAlerts} {t('admin.security.unresolved', 'Unresolved')}
                </span>
              )}
            </h2>
            <div className="flex gap-2">
              {['all', 'unresolved', 'critical', 'high', 'medium', 'low'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => { setAlertFilter(filter); setTimeout(() => loadSecurityAlerts(), 0) }}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize ${
                    alertFilter === filter
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {alertsLoading ? (
            <div className="text-center py-8"><LoadingSpinner size="md" /></div>
          ) : securityAlerts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShieldCheckIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p>{t('admin.security.noAlerts', 'No security alerts')}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {securityAlerts.map(alert => {
                const config = severityConfig[alert.severity] || severityConfig.medium
                return (
                  <div key={alert.id} className={`p-4 border rounded-lg ${config.color} border`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{config.icon}</span>
                          <span className="font-bold">{alert.title}</span>
                          <Badge variant={alert.is_resolved ? 'primary' : 'danger'}>
                            {alert.is_resolved ? t('admin.security.resolved', 'Resolved') : t('admin.security.active', 'Active')}
                          </Badge>
                        </div>
                        {alert.description && (
                          <p className="text-sm mb-2">{alert.description}</p>
                        )}
                        <div className="flex flex-wrap gap-4 text-xs opacity-75">
                          <span><strong>{t('admin.security.type', 'Type')}:</strong> {alertTypeLabels[alert.alert_type] || alert.alert_type}</span>
                          {alert.source_ip && <span><strong>IP:</strong> {alert.source_ip}</span>}
                          <span><strong>{t('admin.security.time', 'Time')}:</strong> {new Date(alert.created_at).toLocaleString()}</span>
                          {alert.resolution_notes && (
                            <span><strong>{t('admin.security.resolution', 'Resolution')}:</strong> {alert.resolution_notes}</span>
                          )}
                        </div>
                      </div>
                      {!alert.is_resolved && (
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<CheckCircleIcon className="w-4 h-4" />}
                          onClick={() => openResolveModal(alert.id)}
                        >
                          {t('admin.security.resolve', 'Resolve')}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Blocked IPs Section */}
      <div className="mt-8">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <NoSymbolIcon className="w-6 h-6 text-gray-600" />
              {t('admin.security.blockedIPsTitle', 'Blocked IP Addresses')}
            </h2>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<NoSymbolIcon className="w-4 h-4" />}
              onClick={() => setShowBlockIPModal(true)}
            >
              {t('admin.security.blockIP', 'Block IP')}
            </Button>
          </div>

          {blockedIPsLoading ? (
            <div className="text-center py-8"><LoadingSpinner size="md" /></div>
          ) : blockedIPs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <LockClosedIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p>{t('admin.security.noBlockedIPs', 'No blocked IPs')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.security.ipAddress', 'IP Address')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.security.reason', 'Reason')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.security.blockType', 'Block Type')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.security.expires', 'Expires')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('admin.security.actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {blockedIPs.map(blocked => (
                    <tr key={blocked.id} className={!blocked.is_active ? 'opacity-50' : ''}>
                      <td className="px-4 py-3 text-sm font-mono">{blocked.ip_address}</td>
                      <td className="px-4 py-3 text-sm">{blocked.reason}</td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant={blocked.block_type === 'manual' ? 'danger' : 'warning'}>
                          {blocked.block_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {blocked.expires_at ? new Date(blocked.expires_at).toLocaleDateString() : t('admin.security.indefinite', 'Indefinite')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {blocked.is_active && (
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<EyeSlashIcon className="w-4 h-4" />}
                            onClick={() => handleUnblockIP(blocked.id)}
                          >
                            {t('admin.security.unblock', 'Unblock')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
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

      {/* Block IP Modal */}
      <Modal
        isOpen={showBlockIPModal}
        onClose={() => setShowBlockIPModal(false)}
        title={t('admin.security.blockIPModal.title', 'Block IP Address')}
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              {t('admin.security.blockIPModal.warning', 'Blocking an IP will prevent all requests from that address. Use with caution.')}
            </p>
          </div>

          <Input
            label={t('admin.security.blockIPModal.ipLabel', 'IP Address')}
            value={newBlockIP.ip}
            onChange={(e) => setNewBlockIP(prev => ({ ...prev, ip: e.target.value }))}
            placeholder="192.168.1.1"
            required
          />

          <div>
            <label className="input-label">{t('admin.security.blockIPModal.reasonLabel', 'Reason')}</label>
            <textarea
              value={newBlockIP.reason}
              onChange={(e) => setNewBlockIP(prev => ({ ...prev, reason: e.target.value }))}
              className="input min-h-[80px]"
              placeholder={t('admin.security.blockIPModal.reasonPlaceholder', 'Describe the reason...')}
              required
            />
          </div>

          <div>
            <label className="input-label">{t('admin.security.blockIPModal.typeLabel', 'Block Type')}</label>
            <select
              value={newBlockIP.blockType}
              onChange={(e) => setNewBlockIP(prev => ({ ...prev, blockType: e.target.value }))}
              className="input"
            >
              <option value="manual">{t('admin.security.blockIPModal.types.manual', 'Manual')}</option>
              <option value="auto_brute_force">{t('admin.security.blockIPModal.types.bruteForce', 'Auto - Brute Force')}</option>
              <option value="auto_rate_limit">{t('admin.security.blockIPModal.types.rateLimit', 'Auto - Rate Limit')}</option>
              <option value="auto_suspicious">{t('admin.security.blockIPModal.types.suspicious', 'Auto - Suspicious Activity')}</option>
            </select>
          </div>

          <div>
            <label className="input-label">{t('admin.security.blockIPModal.expiresLabel', 'Expiry Date (optional)')}</label>
            <input
              type="datetime-local"
              value={newBlockIP.expiresAt}
              onChange={(e) => setNewBlockIP(prev => ({ ...prev, expiresAt: e.target.value }))}
              className="input"
              min={new Date().toISOString().slice(0, 16)}
            />
            <p className="text-xs text-gray-500 mt-1">
              {t('admin.security.blockIPModal.expiresHint', 'Leave empty for permanent block')}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
              onClick={handleBlockIP}
              disabled={blockingIP || !newBlockIP.ip.trim() || !newBlockIP.reason.trim()}
              className="flex-1"
            >
              {blockingIP ? (
                <>
                  <LoadingSpinner size="sm" />
                  {t('admin.security.blockIPModal.blocking', 'Blocking...')}
                </>
              ) : (
                t('admin.security.blockIPModal.confirmBlock', 'Block IP')
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowBlockIPModal(false)}
              disabled={blockingIP}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Resolve Alert Modal */}
      <Modal
        isOpen={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        title={t('admin.security.resolveModal.title', 'Resolve Security Alert')}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="input-label">{t('admin.security.resolveModal.notesLabel', 'Resolution Notes (optional)')}</label>
            <textarea
              value={resolveNotes}
              onChange={(e) => setResolveNotes(e.target.value)}
              className="input min-h-[80px]"
              placeholder={t('admin.security.resolveModal.notesPlaceholder', 'Describe how this was resolved...')}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
              onClick={handleResolveAlert}
              disabled={resolving}
              className="flex-1"
            >
              {resolving ? (
                <>
                  <LoadingSpinner size="sm" />
                  {t('admin.security.resolveModal.resolving', 'Resolving...')}
                </>
              ) : (
                t('admin.security.resolveModal.confirmResolve', 'Mark as Resolved')
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowResolveModal(false)}
              disabled={resolving}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default AdminSecurityPage
