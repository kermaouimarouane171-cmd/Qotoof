import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/services/supabase'
import { auditLogger } from '@/services/auditLogger'
import { Card, LoadingSpinner } from '@/components/ui'
import {
  FlagIcon,
  CheckCircleIcon,
  XCircleIcon,
  EyeIcon,
  ClockIcon,
  ShieldExclamationIcon,
  BoltIcon} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const AdminModerationPage = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const channelRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState([])
  const [stats, setStats] = useState({ pending: 0, reviewing: 0, resolved: 0, dismissed: 0 })
  const [filter, setFilter] = useState('pending')
  const [selectedReport, setSelectedReport] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionNotes, setActionNotes] = useState('')
  const [suspensionHours, setSuspensionHours] = useState(24)

  // Load reports for the current filter
  useEffect(() => {
    loadReports()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  // Load overall stats (all statuses) on mount
  useEffect(() => {
    loadStats()
  }, [])

  // Set up real-time subscription for new reports
  useEffect(() => {
    const channel = supabase
      .channel('moderation-reports-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_reports' },
        (payload) => {
          // If the new report matches our current filter, prepend it
          if (filter === 'pending' || payload.new.status === filter) {
            setReports(prev => [payload.new, ...prev])
          }
          // Always update stats
          loadStats()
          toast(t('admin.moderation.newReport', 'New {{type}} report', { type: payload.new.report_type.replace('_', ' ') }), { icon: '🚩' })
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_reports' },
        (payload) => {
          // Update the report in the list or remove it if status changed
          setReports(prev => {
            if (payload.new.status !== filter) {
              return prev.filter(r => r.id !== payload.new.id)
            }
            return prev.map(r => r.id === payload.new.id ? payload.new : r)
          })
          loadStats()
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('user_reports')
        .select('status')

      if (error) throw error

      const counts = { pending: 0, reviewing: 0, resolved: 0, dismissed: 0 }
      data?.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1 })
      setStats(counts)
    } catch (error) {
      logger.error('Load stats error:', error)
    }
  }

  const loadReports = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('user_reports')
        .select(`
          *,
          reporter:profiles!reporter_id(first_name, last_name, email),
          reported_user:profiles!reported_user_id(first_name, last_name, email, role, is_suspended)
        `)
        .eq('status', filter)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setReports(data || [])
    } catch (error) {
      logger.error('Load reports error:', error)
      toast.error(t('admin.moderation.loadReportsFailed', 'Failed to load reports'))
    } finally {
      setLoading(false)
    }
  }

  // ✅ FIX: Send notification to user when moderation action is taken
  const notifyUser = async (userId, title, message, type = 'moderation', data = {}) => {
    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: userId,
        title,
        message,
        type,
        data: JSON.stringify(data),
        is_read: false,
        created_at: new Date().toISOString()})
      if (error) {
        logger.error('Failed to notify user:', error)
      }
    } catch (error) {
      logger.error('Notify user error:', error)
    }
  }

  const handleResolve = async (reportId, action, notes = null) => {
    try {
      setActionLoading(true)

      // Get report details BEFORE updating
      const report = reports.find(r => r.id === reportId)
      if (!report) {
        toast.error(t('admin.moderation.reportNotFound', 'Report not found'))
        return
      }

      // Update report
      const { error: reportError } = await supabase
        .from('user_reports')
        .update({
          status: 'resolved',
          resolution_notes: notes || actionNotes || `Action: ${action}`,
          resolved_by: user.id,
          resolved_at: new Date().toISOString()})
        .eq('id', reportId)

      if (reportError) throw reportError

      // ✅ FIX: Log to audit trail
      await auditLogger.log({
        action: 'MODERATION_RESOLVED',
        entityType: 'moderation',
        entityId: reportId,
        oldValues: { status: report.status, resolution_notes: null },
        newValues: { status: 'resolved', resolution_notes: notes || actionNotes, action },
        userId: user?.id,
        metadata: {
          reportType: report.report_type,
          priority: report.priority,
          reportedUserId: report.reported_user_id,
          reporterId: report.reporter_id,
          suspensionHours: action === 'suspension' ? suspensionHours : null,
          resolvedBy: user?.email || 'admin'}
      })

      // If action requires user suspension
      if (action === 'suspension' && report.reported_user_id) {
        const { error: suspendError } = await supabase.rpc('suspend_user', {
          p_user_id: report.reported_user_id,
          p_reason: notes || actionNotes,
          p_duration_hours: suspensionHours,
          p_admin_id: user.id})

        if (suspendError) throw suspendError

        // ✅ FIX: Notify the suspended user
        await notifyUser(
          report.reported_user_id,
          t('admin.moderation.accountSuspended', 'Account Suspended'),
          t('admin.moderation.accountSuspendedMsg', 'Your account has been suspended for {{hours}} hours. Reason: {{reason}}. Please contact support if you believe this is an error.', { hours: suspensionHours, reason: notes || actionNotes || t('admin.moderation.violationGuidelines', 'Violation of community guidelines') }),
          'moderation',
          { action: 'suspension', duration: suspensionHours, reportId, reportType: report.report_type }
        )
      }

      // If action requires ban
      if (action === 'ban' && report.reported_user_id) {
        const { error: banError } = await supabase.rpc('ban_user_permanently', {
          p_user_id: report.reported_user_id,
          p_reason: notes || actionNotes,
          p_admin_id: user.id})

        if (banError) throw banError

        // ✅ FIX: Notify the banned user
        await notifyUser(
          report.reported_user_id,
          t('admin.moderation.accountBanned', 'Account Permanently Banned'),
          t('admin.moderation.accountBannedMsg', 'Your account has been permanently banned. Reason: {{reason}}. This action cannot be undone.', { reason: notes || actionNotes || t('admin.moderation.severeViolation', 'Severe violation of community guidelines') }),
          'moderation',
          { action: 'ban', reportId, reportType: report.report_type }
        )
      }

      // If action is a warning
      if (action === 'warning' && report.reported_user_id) {
        // ✅ FIX: Notify the warned user
        await notifyUser(
          report.reported_user_id,
          t('admin.moderation.warningIssued', 'Warning Issued'),
          t('admin.moderation.warningIssuedMsg', 'You have received a warning regarding your {{reportType}}. {{notes}}', { reportType: report.report_type.replace('_', ' '), notes: notes || actionNotes ? t('admin.moderation.note', 'Note') + ': ' + (notes || actionNotes) : t('admin.moderation.reviewGuidelines', 'Please review and follow our community guidelines.') }),
          'moderation',
          { action: 'warning', reportId, reportType: report.report_type }
        )
      }

      // If action is content_removed
      if (action === 'content_removed' && report.reported_user_id) {
        await notifyUser(
          report.reported_user_id,
          t('admin.moderation.contentRemoved', 'Content Removed'),
          t('admin.moderation.contentRemovedMsg', 'Your content has been removed due to a {{reportType}} report. {{reason}}', { reportType: report.report_type.replace('_', ' '), reason: notes || actionNotes ? t('admin.moderation.reason', 'Reason') + ': ' + (notes || actionNotes) : t('admin.moderation.reviewGuidelines2', 'Please review our community guidelines.') }),
          'moderation',
          { action: 'content_removed', reportId, reportType: report.report_type }
        )
      }

      toast.success(t('admin.moderation.reportResolved', 'Report resolved successfully'))
      setSelectedReport(null)
      setActionNotes('')
      await loadReports()
      await loadStats()
    } catch (error) {
      logger.error('Resolve report error:', error)
      toast.error(t('admin.moderation.resolveFailed', 'Failed to resolve report'))
    } finally {
      setActionLoading(false)
    }
  }

  const handleDismiss = async (reportId) => {
    try {
      const report = reports.find(r => r.id === reportId)
      if (!report) {
        toast.error(t('admin.moderation.reportNotFound', 'Report not found'))
        return
      }

      const { error } = await supabase
        .from('user_reports')
        .update({
          status: 'dismissed',
          resolution_notes: actionNotes || 'No violation found',
          resolved_by: user.id,
          resolved_at: new Date().toISOString()})
        .eq('id', reportId)

      if (error) throw error

      // ✅ FIX: Log dismissal to audit trail
      await auditLogger.log({
        action: 'MODERATION_DISMISSED',
        entityType: 'moderation',
        entityId: reportId,
        oldValues: { status: report.status },
        newValues: { status: 'dismissed', notes: actionNotes || t('admin.moderation.noViolation', 'No violation found') },
        userId: user?.id,
        metadata: {
          reportType: report.report_type,
          priority: report.priority,
          reportedUserId: report.reported_user_id,
          dismissedBy: user?.email || 'admin'}
      })

      // ✅ FIX: Optionally notify the reported user that they were cleared
      if (report.reported_user_id) {
        await notifyUser(
          report.reported_user_id,
          t('admin.moderation.reportDismissed', 'Report Dismissed'),
          t('admin.moderation.reportDismissedMsg', 'A report against you ({{reportType}}) has been reviewed and dismissed. No action was taken.', { reportType: report.report_type.replace('_', ' ') }),
          'moderation',
          { action: 'dismissed', reportId, reportType: report.report_type }
        )
      }

      toast.success(t('admin.moderation.reportDismissed', 'Report dismissed'))
      setSelectedReport(null)
      setActionNotes('')
      await loadReports()
      await loadStats()
    } catch (error) {
      logger.error('Dismiss report error:', error)
      toast.error(t('admin.moderation.dismissFailed', 'Failed to dismiss report'))
    }
  }

  const handleStartReview = async (reportId) => {
    try {
      const { error } = await supabase
        .from('user_reports')
        .update({ status: 'reviewing' })
        .eq('id', reportId)

      if (error) throw error

      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'reviewing' } : r))
      setStats(prev => ({
        ...prev,
        pending: prev.pending - 1,
        reviewing: prev.reviewing + 1}))
      toast.success(t('admin.moderation.reportMarkedReviewing', 'Report marked as reviewing'))
    } catch (error) {
      logger.error('Start review error:', error)
      toast.error(t('admin.moderation.startReviewFailed', 'Failed to start review'))
    }
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeIcon = (type) => {
    switch (type) {
      case 'illegal_activity': return '🚫'
      case 'false_info': return '⚠️'
      case 'fee_circumvention': return '💰'
      case 'harassment': return '👥'
      case 'security_violation': return '🔒'
      case 'spam': return '📧'
      default: return '🚩'
    }
  }

  if (loading && reports.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('admin.moderation.title', 'Content Moderation')}</h1>
          <p className="text-gray-600">{t('admin.moderation.subtitle', 'Review and handle user reports')}</p>
        </div>
        {stats.pending > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
            <BoltIcon className="w-5 h-5 text-red-600 animate-pulse" />
            <span className="text-sm font-medium text-red-700">
              {stats.pending} {t('admin.moderation.pendingReports', 'pending report', { count: stats.pending })}{stats.pending > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <FlagIcon className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-gray-500">{t('admin.moderation.pending', 'Pending')}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <ClockIcon className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.reviewing}</p>
              <p className="text-xs text-gray-500">{t('admin.moderation.reviewing', 'Reviewing')}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.resolved}</p>
              <p className="text-xs text-gray-500">{t('admin.moderation.resolved', 'Resolved')}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <XCircleIcon className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.dismissed}</p>
              <p className="text-xs text-gray-500">{t('admin.moderation.dismissed', 'Dismissed')}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {['pending', 'reviewing', 'resolved', 'dismissed'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              filter === status
                ? 'bg-green-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t(`admin.moderation.${status}`, status.charAt(0).toUpperCase() + status.slice(1))}
            {stats[status] > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-white bg-opacity-30 rounded-full text-xs">
                {stats[status]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports List */}
        <div className="lg:col-span-2 space-y-4">
          {reports.length === 0 ? (
            <Card className="p-12 text-center">
              <FlagIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{t('admin.moderation.noReports', 'No reports found')}</p>
            </Card>
          ) : (
            reports.map((report) => (
              <Card
                key={report.id}
                className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                  selectedReport?.id === report.id ? 'ring-2 ring-green-500' : ''
                }`}
                onClick={() => setSelectedReport(report)}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{getTypeIcon(report.report_type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 truncate">
                        {report.report_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </span>
                      {report.priority && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(report.priority)}`}>
                          {report.priority}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                      {report.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{t('admin.moderation.reporter', 'Reporter')}: {report.reporter?.first_name}</span>
                      <span>{t('admin.moderation.reported', 'Reported')}: {report.reported_user?.first_name}</span>
                      <span>{new Date(report.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Report Details */}
        <div className="lg:col-span-1">
          {selectedReport ? (
            <Card className="p-6 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <ShieldExclamationIcon className="w-5 h-5 text-red-600" />
                {t('admin.moderation.reportDetails', 'Report Details')}
              </h3>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">{t('admin.moderation.type', 'Type')}</p>
                  <p className="font-medium">{selectedReport.report_type.replace('_', ' ')}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">{t('admin.moderation.priority', 'Priority')}</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(selectedReport.priority)}`}>
                    {selectedReport.priority}
                  </span>
                </div>

                <div>
                  <p className="text-sm text-gray-500">{t('admin.moderation.status', 'Status')}</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium capitalize ${
                    selectedReport.status === 'pending' ? 'bg-red-100 text-red-800' :
                    selectedReport.status === 'reviewing' ? 'bg-orange-100 text-orange-800' :
                    selectedReport.status === 'resolved' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedReport.status}
                  </span>
                </div>

                <div>
                  <p className="text-sm text-gray-500">{t('admin.moderation.description', 'Description')}</p>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedReport.description}</p>
                </div>

                {selectedReport.evidence_urls && selectedReport.evidence_urls.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500">{t('admin.moderation.evidence', 'Evidence')}</p>
                    <div className="space-y-1">
                      {selectedReport.evidence_urls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline block truncate"
                        >
                          {url}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm text-gray-500">{t('admin.moderation.reportedUser', 'Reported User')}</p>
                  <p className="font-medium">
                    {selectedReport.reported_user?.first_name} {selectedReport.reported_user?.last_name}
                  </p>
                  <p className="text-xs text-gray-500">{selectedReport.reported_user?.email}</p>
                  {selectedReport.reported_user?.is_suspended && (
                    <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                      {t('admin.moderation.currentlySuspended', 'Currently Suspended')}
                    </span>
                  )}
                </div>

                {selectedReport.resolution_notes && (
                  <div>
                    <p className="text-sm text-gray-500">{t('admin.moderation.adminNotes', 'Admin Notes')}</p>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedReport.resolution_notes}</p>
                  </div>
                )}

                {/* Actions */}
                {selectedReport.status === 'pending' && (
                  <div className="space-y-3 pt-4 border-t">
                    <button
                      onClick={() => handleStartReview(selectedReport.id)}
                      className="btn-outline w-full text-sm text-blue-600 border-blue-200"
                    >
                      {t('admin.moderation.startReview', 'Start Review')}
                    </button>

                    <div>
                      <label className="input-label">{t('admin.moderation.adminNotesLabel', 'Admin Notes')}</label>
                      <textarea
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        className="input h-20 resize-none"
                        placeholder={t('admin.moderation.notesPlaceholder', 'Add your review notes...')}
                      />
                    </div>

                    <div>
                      <label className="input-label">{t('admin.moderation.suspensionDuration', 'Suspension Duration (hours)')}</label>
                      <select
                        value={suspensionHours}
                        onChange={(e) => setSuspensionHours(parseInt(e.target.value))}
                        className="input"
                      >
                        <option value={24}>{t('admin.moderation.hours24', '24 hours')}</option>
                        <option value={72}>{t('admin.moderation.days3', '3 days')}</option>
                        <option value={168}>{t('admin.moderation.week1', '1 week')}</option>
                        <option value={720}>{t('admin.moderation.month1', '1 month')}</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={() => handleResolve(selectedReport.id, 'warning')}
                        disabled={actionLoading}
                        className="btn-outline w-full text-sm"
                      >
                        {t('admin.moderation.issueWarning', 'Issue Warning')}
                      </button>
                      <button
                        onClick={() => handleResolve(selectedReport.id, 'content_removed')}
                        disabled={actionLoading}
                        className="btn-outline w-full text-sm text-orange-600 border-orange-200"
                      >
                        {t('admin.moderation.removeContent', 'Remove Content')}
                      </button>
                      <button
                        onClick={() => handleResolve(selectedReport.id, 'suspension')}
                        disabled={actionLoading}
                        className="btn-outline w-full text-sm text-orange-600 border-orange-200"
                      >
                        {t('admin.moderation.suspendUser', 'Suspend User ({{hours}}h)', { hours: suspensionHours })}
                      </button>
                      <button
                        onClick={() => handleResolve(selectedReport.id, 'ban')}
                        disabled={actionLoading}
                        className="btn-outline w-full text-sm text-red-600 border-red-200"
                      >
                        {t('admin.moderation.permanentBan', 'Permanent Ban')}
                      </button>
                      <button
                        onClick={() => handleDismiss(selectedReport.id)}
                        disabled={actionLoading}
                        className="btn-outline w-full text-sm text-gray-600"
                      >
                        {t('admin.moderation.dismissReport', 'Dismiss Report')}
                      </button>
                    </div>
                  </div>
                )}

                {selectedReport.status === 'reviewing' && (
                  <div className="space-y-3 pt-4 border-t">
                    <div>
                      <label className="input-label">{t('admin.moderation.adminNotesLabel', 'Admin Notes')}</label>
                      <textarea
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        className="input h-20 resize-none"
                        placeholder={t('admin.moderation.notesPlaceholder', 'Add your review notes...')}
                      />
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={() => handleResolve(selectedReport.id, 'warning')}
                        disabled={actionLoading}
                        className="btn-outline w-full text-sm"
                      >
                        {t('admin.moderation.issueWarning', 'Issue Warning')}
                      </button>
                      <button
                        onClick={() => handleResolve(selectedReport.id, 'content_removed')}
                        disabled={actionLoading}
                        className="btn-outline w-full text-sm text-orange-600 border-orange-200"
                      >
                        {t('admin.moderation.removeContent', 'Remove Content')}
                      </button>
                      <button
                        onClick={() => handleResolve(selectedReport.id, 'suspension')}
                        disabled={actionLoading}
                        className="btn-outline w-full text-sm text-orange-600 border-orange-200"
                      >
                        {t('admin.moderation.suspendUser', 'Suspend User ({{hours}}h)', { hours: suspensionHours })}
                      </button>
                      <button
                        onClick={() => handleResolve(selectedReport.id, 'ban')}
                        disabled={actionLoading}
                        className="btn-outline w-full text-sm text-red-600 border-red-200"
                      >
                        {t('admin.moderation.permanentBan', 'Permanent Ban')}
                      </button>
                      <button
                        onClick={() => handleDismiss(selectedReport.id)}
                        disabled={actionLoading}
                        className="btn-outline w-full text-sm text-gray-600"
                      >
                        {t('admin.moderation.dismissReport', 'Dismiss Report')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-12 text-center sticky top-24">
              <EyeIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">{t('admin.moderation.selectReport', 'Select a report to review')}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdminModerationPage
