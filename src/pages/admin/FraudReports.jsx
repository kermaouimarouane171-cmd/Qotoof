import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { Card, LoadingSpinner, Modal } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import fraudReportService, {
  FRAUD_PRIORITY_OPTIONS,
  FRAUD_REPORT_TYPES,
  FRAUD_STATUS_OPTIONS,
} from '@/services/fraudReportService'

const STATUS_META = {
  pending: 'bg-amber-100 text-amber-800',
  reviewing: 'bg-blue-100 text-blue-700',
  action_required: 'bg-red-100 text-red-700',
  resolved: 'bg-green-100 text-green-700',
  dismissed: 'bg-gray-100 text-gray-700',
}

const PRIORITY_META = {
  medium: 'bg-slate-100 text-slate-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

const typeLabel = (type) => FRAUD_REPORT_TYPES.find((option) => option.value === type)?.label || type
const statusLabel = (status) => FRAUD_STATUS_OPTIONS.find((option) => option.value === status)?.label || status
const priorityLabel = (priority) => FRAUD_PRIORITY_OPTIONS.find((option) => option.value === priority)?.label || priority

const actorName = (actor) => {
  if (!actor) return '-'
  return actor.store_name || `${actor.first_name || ''} ${actor.last_name || ''}`.trim() || '-'
}

const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const FraudReports = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [adminNotes, setAdminNotes] = useState('')
  const [legalRecommendation, setLegalRecommendation] = useState('')
  const [resolution, setResolution] = useState('')
  const [nextStatus, setNextStatus] = useState('reviewing')
  const [evidenceLinks, setEvidenceLinks] = useState([])

  const loadReports = async () => {
    setLoading(true)
    try {
      const data = await fraudReportService.listFraudReportsForAdmin()
      setReports(data)
    } catch (error) {
      toast.error(error.message || t('admin.fraudReports.loadFailed', 'Failed to load fraud reports'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReports()
  }, [])

  useEffect(() => {
    let active = true

    const resolveEvidence = async () => {
      if (!selectedReport?.evidence_paths?.length) {
        if (active) setEvidenceLinks([])
        return
      }

      const links = await fraudReportService.getFraudEvidenceLinks(selectedReport.evidence_paths)
      if (active) setEvidenceLinks(links)
    }

    resolveEvidence()

    return () => {
      active = false
    }
  }, [selectedReport])

  const filteredReports = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return reports.filter((report) => {
      const matchesStatus = statusFilter === 'all' || report.status === statusFilter
      const orderNumber = String(report.order?.order_number || report.order_id || '').toLowerCase()
      const reporter = actorName(report.reporter).toLowerCase()
      const reportedUser = actorName(report.reported_user).toLowerCase()
      const description = String(report.description || '').toLowerCase()
      const matchesSearch = !normalizedSearch || orderNumber.includes(normalizedSearch) || reporter.includes(normalizedSearch) || reportedUser.includes(normalizedSearch) || description.includes(normalizedSearch)
      return matchesStatus && matchesSearch
    })
  }, [reports, search, statusFilter])

  const summary = useMemo(() => ({
    pending: reports.filter((report) => report.status === 'pending').length,
    reviewing: reports.filter((report) => report.status === 'reviewing').length,
    actionRequired: reports.filter((report) => report.status === 'action_required').length,
    resolved: reports.filter((report) => report.status === 'resolved').length,
  }), [reports])

  const openReport = (report) => {
    setSelectedReport(report)
    setAdminNotes(report.admin_notes || '')
    setLegalRecommendation(report.legal_recommendation || '')
    setResolution(report.resolution || '')
    setNextStatus(report.status || 'reviewing')
  }

  const handleSave = async () => {
    if (!selectedReport || !user?.id) return

    setSaving(true)
    try {
      const updated = await fraudReportService.updateFraudReport({
        reportId: selectedReport.id,
        adminId: user.id,
        updates: {
          status: nextStatus,
          admin_notes: adminNotes.trim() || null,
          legal_recommendation: legalRecommendation.trim() || null,
          resolution: resolution.trim() || null,
        },
      })

      setSelectedReport(updated)
      setReports((currentReports) => currentReports.map((report) => report.id === updated.id ? updated : report))
      toast.success(t('admin.fraudReports.updateSuccess', 'Fraud report updated successfully'))
    } catch (error) {
      toast.error(error.message || t('admin.fraudReports.updateFailed', 'Failed to update report'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t('admin.fraudReports.title', 'Fraud Reports')}</h1>
          <p className="text-gray-600 mt-2">{t('admin.fraudReports.subtitle', 'Review legal reports related to delivery, condition, and payment.')}</p>
        </div>
        <button type="button" onClick={loadReports} className="btn-outline inline-flex items-center gap-2">
          <ArrowPathIcon className="h-4 w-4" />
          {t('common.refresh', 'Refresh')}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="p-4"><p className="text-2xl font-bold text-gray-900">{summary.pending}</p><p className="text-xs text-gray-500 mt-1">{t('admin.fraudReports.stat.pending', 'Pending')}</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold text-gray-900">{summary.reviewing}</p><p className="text-xs text-gray-500 mt-1">{t('admin.fraudReports.stat.reviewing', 'Reviewing')}</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold text-gray-900">{summary.actionRequired}</p><p className="text-xs text-gray-500 mt-1">{t('admin.fraudReports.stat.actionRequired', 'Action Required')}</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold text-gray-900">{summary.resolved}</p><p className="text-xs text-gray-500 mt-1">{t('admin.fraudReports.stat.resolved', 'Resolved')}</p></Card>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input"
            placeholder={t('admin.fraudReports.searchPlaceholder', 'Search by order #, reporter, or description')}
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input">
            <option value="all">{t('admin.fraudReports.filterAll', 'All Statuses')}</option>
            {FRAUD_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('admin.fraudReports.col.order', 'Order')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('admin.fraudReports.col.reporter', 'Reporter')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('admin.fraudReports.col.reported', 'Reported')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('admin.fraudReports.col.type', 'Type')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('admin.fraudReports.col.priority', 'Priority')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('admin.fraudReports.col.status', 'Status')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('admin.fraudReports.col.created', 'Created')}</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">{t('admin.fraudReports.col.actions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {filteredReports.map((report) => (
                <tr key={report.id}>
                  <td className="px-4 py-4 font-medium text-gray-900">#{report.order?.order_number || report.order_id?.slice(0, 8)}</td>
                  <td className="px-4 py-4 text-gray-600">{actorName(report.reporter)}</td>
                  <td className="px-4 py-4 text-gray-600">{actorName(report.reported_user)}</td>
                  <td className="px-4 py-4 text-gray-600">{typeLabel(report.report_type)}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_META[report.priority] || PRIORITY_META.medium}`}>{priorityLabel(report.priority)}</span></td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_META[report.status] || STATUS_META.pending}`}>{statusLabel(report.status)}</span></td>
                  <td className="px-4 py-4 text-gray-500">{formatDate(report.created_at)}</td>
                  <td className="px-4 py-4">
                    <button type="button" onClick={() => openReport(report)} className="inline-flex items-center gap-2 text-green-700 hover:text-green-800">
                      <EyeIcon className="h-4 w-4" />
                      {t('admin.fraudReports.view', 'View')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={Boolean(selectedReport)} onClose={() => setSelectedReport(null)} title={t('admin.fraudReports.modal.title', 'Fraud Report Details')} size="xl">
        {selectedReport ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="p-4"><p className="text-xs text-gray-500">{t('admin.fraudReports.col.order', 'Order')}</p><p className="font-semibold text-gray-900 mt-2">#{selectedReport.order?.order_number || selectedReport.order_id?.slice(0, 8)}</p></Card>
              <Card className="p-4"><p className="text-xs text-gray-500">{t('admin.fraudReports.col.reporter', 'Reporter')}</p><p className="font-semibold text-gray-900 mt-2">{actorName(selectedReport.reporter)}</p></Card>
              <Card className="p-4"><p className="text-xs text-gray-500">{t('admin.fraudReports.col.reported', 'Reported Party')}</p><p className="font-semibold text-gray-900 mt-2">{actorName(selectedReport.reported_user)}</p></Card>
              <Card className="p-4"><p className="text-xs text-gray-500">{t('admin.fraudReports.col.status', 'Status')}</p><p className="font-semibold text-gray-900 mt-2">{statusLabel(selectedReport.status)}</p></Card>
            </div>

            <Card className="p-5">
              <div className="flex items-start gap-3">
                <ShieldExclamationIcon className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">{t('admin.fraudReports.description', 'Description')}</p>
                  <p className="text-sm text-gray-700 mt-2 leading-7">{selectedReport.description}</p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label className="input-label">{t('admin.fraudReports.nextStatus', 'Next Status')}</label>
                <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="input">
                  {FRAUD_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label className="input-label">{t('admin.fraudReports.legalRecommendation', 'Legal Recommendation')}</label>
                <input value={legalRecommendation} onChange={(event) => setLegalRecommendation(event.target.value)} className="input" placeholder={t('admin.fraudReports.legalRecommendationPlaceholder', 'e.g. Review legal photos and suspend settlement')} />
              </div>
            </div>

            <div>
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label className="input-label">{t('admin.fraudReports.adminNotes', 'Admin Notes')}</label>
              <textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} className="input min-h-24 resize-y" placeholder={t('admin.fraudReports.adminNotesPlaceholder', 'Write inspection summary and required actions.')} />
            </div>

            <div>
              {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
              <label className="input-label">{t('admin.fraudReports.resolution', 'Resolution')}</label>
              <textarea value={resolution} onChange={(event) => setResolution(event.target.value)} className="input min-h-24 resize-y" placeholder={t('admin.fraudReports.resolutionPlaceholder', 'Preferably filled when resolving or closing.')} />
            </div>

            <div>
              <p className="font-semibold text-gray-900 mb-3">{t('admin.fraudReports.evidence', 'Evidence')}</p>
              {evidenceLinks.length === 0 ? (
                <p className="text-sm text-gray-500">{t('admin.fraudReports.noEvidence', 'No evidence attachments for this report.')}</p>
              ) : (
                <div className="space-y-3">
                  {evidenceLinks.map((evidence) => (
                    <a
                      key={evidence.path}
                      href={evidence.signedUrl || evidence.path}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 hover:border-green-300"
                    >
                      <CheckCircleIcon className="h-5 w-5 text-green-600" />
                      <span className="text-sm text-gray-700 break-all">{evidence.path}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setSelectedReport(null)} className="btn-outline" disabled={saving}>{t('common.close', 'Close')}</button>
              <button type="button" onClick={handleSave} className="btn-primary inline-flex items-center gap-2" disabled={saving}>
                {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <ExclamationTriangleIcon className="h-4 w-4" />}
                {saving ? t('common.saving', 'Saving...') : t('admin.fraudReports.saveUpdate', 'Save Update')}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default FraudReports