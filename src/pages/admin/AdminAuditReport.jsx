import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Card, LoadingSpinner, Button, Input } from '@/components/ui'
import { auditReportService } from '@/services/reports/auditReportService'
import { logger } from '@/utils/logger'
import {
  FunnelIcon,
  DocumentArrowDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ChartBarIcon,
  UserIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'

const ACTION_CATEGORY_COLORS = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  login: 'bg-purple-100 text-purple-800',
  logout: 'bg-gray-100 text-gray-800',
  permission_change: 'bg-yellow-100 text-yellow-800',
  export: 'bg-indigo-100 text-indigo-800',
  approve: 'bg-emerald-100 text-emerald-800',
  reject: 'bg-rose-100 text-rose-800',
  suspend: 'bg-orange-100 text-orange-800',
  unsuspend: 'bg-teal-100 text-teal-800',
  refund: 'bg-pink-100 text-pink-800',
  payment: 'bg-cyan-100 text-cyan-800',
  mfa: 'bg-violet-100 text-violet-800',
  security: 'bg-red-100 text-red-800',
  other: 'bg-gray-100 text-gray-800'
}

const SEVERITY_COLORS = {
  low: 'bg-gray-100 text-gray-800',
  info: 'bg-blue-100 text-blue-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800'
}

const AdminAuditReport = () => {
  const { t } = useTranslation()
  const [filters, setFilters] = useState({
    actorId: '',
    actorRole: '',
    actionCategory: '',
    targetTable: '',
    targetId: '',
    startDate: '',
    endDate: '',
    severity: ''
  })
  const [pagination, setPagination] = useState({ page: 1, pageSize: 50 })
  const [selectedLog, setSelectedLog] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [exporting, setExporting] = useState(false)

  // Fetch filter options
  const { data: filterOptions, isLoading: loadingFilters } = useQuery({
    queryKey: ['auditFilterOptions'],
    queryFn: () => auditReportService.getFilterOptions(),
    staleTime: 5 * 60 * 1000 // 5 minutes
  })

  // Fetch audit logs
  const { data: logsData, isLoading: loadingLogs, refetch } = useQuery({
    queryKey: ['auditLogs', filters, pagination],
    queryFn: () => auditReportService.getAuditLogs(filters, pagination),
    keepPreviousData: true
  })

  // Fetch statistics
  const { data: stats } = useQuery({
    queryKey: ['auditStatistics'],
    queryFn: () => auditReportService.getAuditStatistics(),
    staleTime: 5 * 60 * 1000
  })

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, page: 1 })) // Reset to page 1
  }

  const clearFilters = () => {
    setFilters({
      actorId: '',
      actorRole: '',
      actionCategory: '',
      targetTable: '',
      targetId: '',
      startDate: '',
      endDate: '',
      severity: ''
    })
    setPagination({ page: 1, pageSize: 50 })
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const csv = await auditReportService.exportAuditLogsToCSV(filters)
      
      // Create download link
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `audit-logs-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success(t('admin.auditReport.exportSuccess', 'Audit logs exported successfully'))
    } catch (error) {
      logger.error('Export error:', error)
      toast.error(t('admin.auditReport.exportError', 'Failed to export audit logs'))
    } finally {
      setExporting(false)
    }
  }

  const handleViewDetails = async (logId) => {
    try {
      const log = await auditReportService.getAuditLogById(logId)
      if (log) {
        setSelectedLog(log)
        setShowDetailModal(true)
      }
    } catch (error) {
      logger.error('Fetch log details error:', error)
      toast.error(t('admin.auditReport.fetchError', 'Failed to fetch log details'))
    }
  }

  const formatJSON = (data) => {
    if (!data) return t('admin.auditReport.noData', 'No data')
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  const renderDiff = (oldData, newData) => {
    if (!oldData && !newData) return null
    
    const oldObj = oldData ? JSON.parse(JSON.stringify(oldData)) : {}
    const newObj = newData ? JSON.parse(JSON.stringify(newData)) : {}
    
    const changes = []
    
    // Check for added/modified keys
    Object.keys(newObj).forEach(key => {
      if (oldObj[key] !== newObj[key]) {
        changes.push({
          key,
          oldValue: oldObj[key],
          newValue: newObj[key],
          type: oldObj[key] === undefined ? 'added' : 'modified'
        })
      }
    })
    
    // Check for removed keys
    Object.keys(oldObj).forEach(key => {
      if (newObj[key] === undefined) {
        changes.push({
          key,
          oldValue: oldObj[key],
          newValue: undefined,
          type: 'removed'
        })
      }
    })
    
    if (changes.length === 0) {
      return <p className="text-gray-500 text-sm">{t('admin.auditReport.noChanges', 'No changes detected')}</p>
    }
    
    return (
      <div className="space-y-2">
        {changes.map((change, idx) => (
          <div key={idx} className="p-2 bg-gray-50 rounded text-sm">
            <div className="font-medium text-gray-900 mb-1">{change.key}</div>
            <div className="flex gap-4">
              <div className="flex-1">
                <span className="text-xs text-gray-500">{t('admin.auditReport.old', 'Old')}:</span>
                <div className={`font-mono text-xs ${change.type === 'added' ? 'text-gray-400 line-through' : 'text-red-600'}`}>
                  {change.oldValue !== undefined ? String(change.oldValue) : '—'}
                </div>
              </div>
              <div className="flex-1">
                <span className="text-xs text-gray-500">{t('admin.auditReport.new', 'New')}:</span>
                <div className={`font-mono text-xs ${change.type === 'removed' ? 'text-gray-400 line-through' : 'text-green-600'}`}>
                  {change.newValue !== undefined ? String(change.newValue) : '—'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('admin.auditReport.title', 'Admin Activity & Permissions Audit')}
          </h1>
          <p className="text-gray-600 mt-1">
            {t('admin.auditReport.subtitle', 'Track all admin actions and permission changes')}
          </p>
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting || loadingLogs}
          className="flex items-center gap-2"
        >
          <DocumentArrowDownIcon className="w-5 h-5" />
          {exporting 
            ? t('admin.auditReport.exporting', 'Exporting...') 
            : t('admin.auditReport.export', 'Export CSV')}
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">{t('admin.auditReport.byAction', 'By Action')}</div>
                <div className="text-2xl font-bold text-gray-900">
                  {Object.values(stats.byActionCategory).reduce((a, b) => a + b, 0)}
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <UserIcon className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">{t('admin.auditReport.byRole', 'By Role')}</div>
                <div className="text-2xl font-bold text-gray-900">
                  {Object.values(stats.byActorRole).reduce((a, b) => a + b, 0)}
                </div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <ExclamationTriangleIcon className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <div className="text-sm text-gray-500">{t('admin.auditReport.critical', 'Critical')}</div>
                <div className="text-2xl font-bold text-gray-900">
                  {stats.bySeverity.critical || 0}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-5 h-5 text-gray-500" />
            <h3 className="font-medium text-gray-900">
              {t('admin.auditReport.filters', 'Filters')}
            </h3>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-gray-500 hover:text-gray-700"
            >
              <XMarkIcon className="w-4 h-4 mr-1" />
              {t('admin.auditReport.clearFilters', 'Clear')}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Actor Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.auditReport.actorRole', 'Actor Role')}
            </label>
            <select
              value={filters.actorRole}
              onChange={(e) => handleFilterChange('actorRole', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{t('admin.auditReport.allRoles', 'All Roles')}</option>
              {filterOptions?.actorRoles?.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          {/* Action Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.auditReport.actionCategory', 'Action Category')}
            </label>
            <select
              value={filters.actionCategory}
              onChange={(e) => handleFilterChange('actionCategory', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{t('admin.auditReport.allCategories', 'All Categories')}</option>
              {filterOptions?.actionCategories?.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Target Table */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.auditReport.targetTable', 'Target Table')}
            </label>
            <select
              value={filters.targetTable}
              onChange={(e) => handleFilterChange('targetTable', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{t('admin.auditReport.allTables', 'All Tables')}</option>
              {filterOptions?.targetTables?.map(table => (
                <option key={table} value={table}>{table}</option>
              ))}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.auditReport.severity', 'Severity')}
            </label>
            <select
              value={filters.severity}
              onChange={(e) => handleFilterChange('severity', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">{t('admin.auditReport.allSeverities', 'All Severities')}</option>
              {filterOptions?.severities?.map(sev => (
                <option key={sev} value={sev}>{sev}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.auditReport.startDate', 'Start Date')}
            </label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.auditReport.endDate', 'End Date')}
            </label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>

          {/* Target ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.auditReport.targetId', 'Target ID')}
            </label>
            <Input
              type="text"
              value={filters.targetId}
              onChange={(e) => handleFilterChange('targetId', e.target.value)}
              placeholder={t('admin.auditReport.targetIdPlaceholder', 'Enter ID...')}
            />
          </div>

          {/* Actor ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.auditReport.actorId', 'Actor ID')}
            </label>
            <Input
              type="text"
              value={filters.actorId}
              onChange={(e) => handleFilterChange('actorId', e.target.value)}
              placeholder={t('admin.auditReport.actorIdPlaceholder', 'Enter ID...')}
            />
          </div>
        </div>
      </Card>

      {/* Results */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600">
            {t('admin.auditReport.totalResults', 'Total results')}: <strong>{logsData?.count || 0}</strong>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={loadingLogs}
          >
            <ClockIcon className="w-4 h-4 mr-1" />
            {t('admin.auditReport.refresh', 'Refresh')}
          </Button>
        </div>

        {loadingLogs ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : !logsData?.data || logsData.data.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MagnifyingGlassIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>{t('admin.auditReport.noResults', 'No audit logs found')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                      {t('admin.auditReport.timestamp', 'Timestamp')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                      {t('admin.auditReport.actor', 'Actor')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                      {t('admin.auditReport.action', 'Action')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                      {t('admin.auditReport.target', 'Target')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                      {t('admin.auditReport.severity', 'Severity')}
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">
                      {t('admin.auditReport.details', 'Details')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {logsData.data.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-gray-900">
                          {log.actor_name || t('admin.auditReport.unknown', 'Unknown')}
                        </div>
                        <div className="text-xs text-gray-500">{log.actor_email}</div>
                        <div className="text-xs text-gray-400">{log.actor_role}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-sm font-medium text-gray-900">{log.action}</div>
                        {log.action_category && (
                          <span className={`inline-block px-2 py-0.5 text-xs rounded mt-1 ${ACTION_CATEGORY_COLORS[log.action_category] || ACTION_CATEGORY_COLORS.other}`}>
                            {log.action_category}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {log.target_table && (
                          <div>
                            <span className="font-medium">{log.target_table}</span>
                            {log.target_id && <span className="text-gray-400">: {log.target_id}</span>}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {log.severity && (
                          <span className={`inline-block px-2 py-0.5 text-xs rounded ${SEVERITY_COLORS[log.severity]}`}>
                            {log.severity}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(log.id)}
                        >
                          {t('admin.auditReport.view', 'View')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {logsData.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  {t('admin.auditReport.showing', 'Showing')} {((pagination.page - 1) * pagination.pageSize) + 1}-
                  {Math.min(pagination.page * pagination.pageSize, logsData.count)} {t('admin.auditReport.of', 'of')} {logsData.count}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">
                    {pagination.page} / {logsData.totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === logsData.totalPages}
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {t('admin.auditReport.logDetails', 'Log Details')}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowDetailModal(false)
                  setSelectedLog(null)
                }}
              >
                <XMarkIcon className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.auditReport.timestamp', 'Timestamp')}
                  </label>
                  <div className="text-sm text-gray-900">
                    {new Date(selectedLog.created_at).toLocaleString()}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.auditReport.action', 'Action')}
                  </label>
                  <div className="text-sm text-gray-900">{selectedLog.action}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.auditReport.actor', 'Actor')}
                  </label>
                  <div className="text-sm text-gray-900">
                    {selectedLog.actor_name} ({selectedLog.actor_email})
                  </div>
                  <div className="text-xs text-gray-500">{selectedLog.actor_role}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.auditReport.target', 'Target')}
                  </label>
                  <div className="text-sm text-gray-900">
                    {selectedLog.target_table} {selectedLog.target_id && `(${selectedLog.target_id})`}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.auditReport.ipAddress', 'IP Address')}
                  </label>
                  <div className="text-sm text-gray-900">{selectedLog.ip_address || '—'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('admin.auditReport.userAgent', 'User Agent')}
                  </label>
                  <div className="text-sm text-gray-900 truncate" title={selectedLog.user_agent}>
                    {selectedLog.user_agent || '—'}
                  </div>
                </div>
              </div>

              {/* Changes Diff */}
              {(selectedLog.old_values || selectedLog.new_values) && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    {t('admin.auditReport.changes', 'Changes')}
                  </h4>
                  {renderDiff(selectedLog.old_values, selectedLog.new_values)}
                </div>
              )}

              {/* Raw Data */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  {t('admin.auditReport.rawData', 'Raw Data')}
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      {t('admin.auditReport.oldValues', 'Old Values')}
                    </label>
                    <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-40">
                      {formatJSON(selectedLog.old_values)}
                    </pre>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      {t('admin.auditReport.newValues', 'New Values')}
                    </label>
                    <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto max-h-40">
                      {formatJSON(selectedLog.new_values)}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminAuditReport
