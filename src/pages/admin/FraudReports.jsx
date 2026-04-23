import { useEffect, useMemo, useState } from 'react'
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
  return new Date(value).toLocaleString('ar-MA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const FraudReports = () => {
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
      toast.error(error.message || 'تعذر تحميل بلاغات الاحتيال')
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
      toast.success('تم تحديث بلاغ الاحتيال بنجاح')
    } catch (error) {
      toast.error(error.message || 'تعذر تحديث البلاغ')
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
          <h1 className="text-3xl font-bold text-gray-900">بلاغات الاحتيال</h1>
          <p className="text-gray-600 mt-2">مراجعة البلاغات القانونية المرتبطة بالتسليم، الحالة، والدفع.</p>
        </div>
        <button type="button" onClick={loadReports} className="btn-outline inline-flex items-center gap-2">
          <ArrowPathIcon className="h-4 w-4" />
          تحديث القائمة
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="p-4"><p className="text-2xl font-bold text-gray-900">{summary.pending}</p><p className="text-xs text-gray-500 mt-1">قيد الانتظار</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold text-gray-900">{summary.reviewing}</p><p className="text-xs text-gray-500 mt-1">قيد المراجعة</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold text-gray-900">{summary.actionRequired}</p><p className="text-xs text-gray-500 mt-1">يتطلب إجراء</p></Card>
        <Card className="p-4"><p className="text-2xl font-bold text-gray-900">{summary.resolved}</p><p className="text-xs text-gray-500 mt-1">تمت المعالجة</p></Card>
      </div>

      <Card className="p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="input"
            placeholder="ابحث برقم الطلب، المبلّغ، أو وصف البلاغ"
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input">
            <option value="all">كل الحالات</option>
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
                <th className="px-4 py-3 text-right font-medium text-gray-500">الطلب</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">المبلّغ</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">المبلّغ ضده</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">النوع</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">الأولوية</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">الحالة</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">الإنشاء</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">إجراء</th>
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
                      عرض
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={Boolean(selectedReport)} onClose={() => setSelectedReport(null)} title="تفاصيل بلاغ الاحتيال" size="xl">
        {selectedReport ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="p-4"><p className="text-xs text-gray-500">الطلب</p><p className="font-semibold text-gray-900 mt-2">#{selectedReport.order?.order_number || selectedReport.order_id?.slice(0, 8)}</p></Card>
              <Card className="p-4"><p className="text-xs text-gray-500">المبلّغ</p><p className="font-semibold text-gray-900 mt-2">{actorName(selectedReport.reporter)}</p></Card>
              <Card className="p-4"><p className="text-xs text-gray-500">الطرف المعني</p><p className="font-semibold text-gray-900 mt-2">{actorName(selectedReport.reported_user)}</p></Card>
              <Card className="p-4"><p className="text-xs text-gray-500">الحالة الحالية</p><p className="font-semibold text-gray-900 mt-2">{statusLabel(selectedReport.status)}</p></Card>
            </div>

            <Card className="p-5">
              <div className="flex items-start gap-3">
                <ShieldExclamationIcon className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-gray-900">الوصف</p>
                  <p className="text-sm text-gray-700 mt-2 leading-7">{selectedReport.description}</p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="input-label">الحالة التالية</label>
                <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className="input">
                  {FRAUD_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">التوصية القانونية</label>
                <input value={legalRecommendation} onChange={(event) => setLegalRecommendation(event.target.value)} className="input" placeholder="مثال: مراجعة الصور القانونية وإيقاف التسوية" />
              </div>
            </div>

            <div>
              <label className="input-label">ملاحظات الإدارة</label>
              <textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} className="input min-h-24 resize-y" placeholder="دوّن ملخص الفحص والإجراءات المطلوبة." />
            </div>

            <div>
              <label className="input-label">قرار الإغلاق أو المعالجة</label>
              <textarea value={resolution} onChange={(event) => setResolution(event.target.value)} className="input min-h-24 resize-y" placeholder="يُفضّل تعبئتها عند الحسم أو الإغلاق." />
            </div>

            <div>
              <p className="font-semibold text-gray-900 mb-3">الأدلة المرفقة</p>
              {evidenceLinks.length === 0 ? (
                <p className="text-sm text-gray-500">لا توجد أدلة مرفقة بهذا البلاغ.</p>
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
              <button type="button" onClick={() => setSelectedReport(null)} className="btn-outline" disabled={saving}>إغلاق</button>
              <button type="button" onClick={handleSave} className="btn-primary inline-flex items-center gap-2" disabled={saving}>
                {saving ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <ExclamationTriangleIcon className="h-4 w-4" />}
                {saving ? 'جاري الحفظ...' : 'حفظ التحديث'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default FraudReports