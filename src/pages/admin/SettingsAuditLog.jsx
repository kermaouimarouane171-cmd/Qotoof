import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { getSettingsAuditLog } from '@/services/platformSettings'
import { Card, LoadingSpinner } from '@/components/ui'
import {
  ClockIcon,
  UserIcon,
  ArrowTopRightOnSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import { logger } from '@/utils/logger'

const PAGE_SIZE = 20

const SettingsAuditLog = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [expandedLog, setExpandedLog] = useState(null)

  const loadLogs = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true)
      const offset = (pageNum - 1) * PAGE_SIZE
      const { data, count } = await getSettingsAuditLog(PAGE_SIZE, offset)
      setLogs(data || [])
      setTotalCount(count || 0)
      setPage(pageNum)
    } catch (error) {
      logger.error('Load audit log error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLogs(1)
  }, [loadLogs])

  // ============================================
  // Helpers
  // ============================================

  const formatSettingKey = (key) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .replace('Feature ', '')
  }

  const formatValue = (value) => {
    if (value === null || value === undefined) return t('admin.settingsAuditLog.notAvailable', '—')
    if (typeof value === 'boolean') return value ? t('admin.settingsAuditLog.enabled', '✅ Enabled') : t('admin.settingsAuditLog.disabled', '❌ Disabled')
    if (typeof value === 'number') return value.toString()
    return value
  }

  const getChangeColor = (key, oldValue, newValue) => {
    if (key.includes('feature') || key.includes('maintenance')) {
      return newValue ? 'text-green-600' : 'text-red-600'
    }
    return 'text-blue-600'
  }

  // ============================================
  // Loading State
  // ============================================

  if (loading && logs.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // ============================================
  // Main Render
  // ============================================

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('admin.settingsAuditLog.title', 'Settings Audit Log')}</h1>
          <p className="text-gray-600">{t('admin.settingsAuditLog.subtitle', 'Track all platform settings changes')}</p>
        </div>
        <button
          onClick={() => loadLogs(page)}
          className="btn-outline text-sm"
        >
          {t('admin.settingsAuditLog.refresh', 'Refresh')}
        </button>
      </div>

      {/* Stats */}
      <Card className="p-4 mb-6 bg-gray-50">
        <div className="flex items-center gap-3">
          <ClockIcon className="w-5 h-5 text-gray-600" />
          <span className="text-sm text-gray-600">
            {t('admin.settingsAuditLog.totalChanges', 'Total changes recorded')}: <strong>{totalCount}</strong>
          </span>
        </div>
      </Card>

      {/* Logs List */}
      {logs.length === 0 ? (
        <Card className="p-12 text-center">
          <FunnelIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">{t('admin.settingsAuditLog.noChanges', 'No settings changes found')}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card
              key={log.id}
              className={`overflow-hidden transition-all ${
                expandedLog === log.id ? 'ring-2 ring-green-500' : 'hover:shadow-md'
              }`}
            >
              {/* Log Header */}
              <div
                className="p-4 cursor-pointer flex items-center justify-between"
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              >
                <div className="flex items-center gap-4">
                  {/* Admin Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                    <UserIcon className="w-5 h-5 text-white" />
                  </div>

                  <div>
                    <p className="font-semibold text-gray-900">
                      {log.admin_name || t('admin.settingsAuditLog.unknownAdmin', 'Unknown Admin')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(log.changed_at).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full`}>
                    {log.changes?.length || 0} {t('admin.settingsAuditLog.changes', 'change', { count: log.changes?.length || 0 })}
                  </span>
                  {expandedLog === log.id ? (
                    <ChevronLeftIcon className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedLog === log.id && (
                <div className="border-t border-gray-200 bg-gray-50 p-4">
                  {/* Changes Table */}
                  <div className="space-y-3">
                    {log.changes?.map((change, index) => (
                      <div
                        key={index}
                        className="bg-white rounded-lg p-3 border border-gray-200"
                      >
                        <p className="text-sm font-medium text-gray-900 mb-2">
                          {formatSettingKey(change.setting_key)}
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">{t('admin.settingsAuditLog.previousValue', 'Previous Value')}</p>
                            <p className="text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-md font-mono">
                              {formatValue(change.old_value)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">{t('admin.settingsAuditLog.newValue', 'New Value')}</p>
                            <p className={`text-sm bg-green-50 px-3 py-1.5 rounded-md font-mono ${getChangeColor(change.setting_key, change.old_value, change.new_value)}`}>
                              {formatValue(change.new_value)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Meta Info */}
                  <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4 text-xs text-gray-500">
                    <div>
                      <span className="font-medium">{t('admin.settingsAuditLog.adminId', 'Admin ID')}:</span>
                      <p className="font-mono mt-1">{log.admin_id}</p>
                    </div>
                    <div>
                      <span className="font-medium">{t('admin.settingsAuditLog.ipAddress', 'IP Address')}:</span>
                      <p className="font-mono mt-1">{log.ip_address || t('admin.settingsAuditLog.notAvailable', 'N/A')}</p>
                    </div>
                    {log.user_agent && (
                      <div className="col-span-2">
                        <span className="font-medium">{t('admin.settingsAuditLog.userAgent', 'User Agent')}:</span>
                        <p className="font-mono mt-1 truncate">{log.user_agent}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-gray-600">
                {t('admin.settingsAuditLog.pageInfo', 'Page {{page}} of {{totalPages}}', { page, totalPages })}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => loadLogs(page - 1)}
                  disabled={page === 1}
                  className="btn-outline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('admin.settingsAuditLog.previous', 'Previous')}
                </button>
                <button
                  onClick={() => loadLogs(page + 1)}
                  disabled={page === totalPages}
                  className="btn-outline text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('admin.settingsAuditLog.next', 'Next')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SettingsAuditLog
