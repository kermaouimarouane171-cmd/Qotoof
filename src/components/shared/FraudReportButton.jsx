import { useMemo, useState } from 'react'
import { ExclamationTriangleIcon, FlagIcon, PaperClipIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { Modal } from '@/components/ui'
import { useAuthStore } from '@/store/authStore'
import fraudReportService, {
  FRAUD_PRIORITY_OPTIONS,
  FRAUD_REPORT_TYPES,
} from '@/services/fraudReportService'
import { getOrderConditionPhotos } from '@/services/legalCameraService'

const ROLE_LABELS = {
  vendor: 'البائع',
  driver: 'السائق',
  buyer: 'المشتري',
  admin: 'الإدارة',
}

const resolveReporterRole = ({ order, userId, profileRole }) => {
  if (profileRole === 'admin') return 'admin'
  if (order?.vendor_id === userId) return 'vendor'
  if (order?.buyer_id === userId) return 'buyer'
  if (order?.driver_id === userId || order?.preferred_driver_id === userId) return 'driver'
  return profileRole || 'buyer'
}

const resolveReportedCandidates = ({ order, userId }) => {
  const candidates = [
    order?.vendor ? {
      id: order.vendor.id,
      role: 'vendor',
      label: order.vendor.store_name || `${order.vendor.first_name || ''} ${order.vendor.last_name || ''}`.trim() || 'البائع',
    } : null,
    order?.driver ? {
      id: order.driver.id,
      role: 'driver',
      label: `${order.driver.first_name || ''} ${order.driver.last_name || ''}`.trim() || 'السائق',
    } : null,
    order?.buyer ? {
      id: order.buyer.id,
      role: 'buyer',
      label: `${order.buyer.first_name || ''} ${order.buyer.last_name || ''}`.trim() || 'المشتري',
    } : null,
  ].filter(Boolean)

  return candidates.filter((candidate) => candidate.id !== userId)
}

const FraudReportButton = ({
  order,
  deliveryId = null,
  buttonLabel = 'الإبلاغ عن احتيال',
  className = 'btn-outline inline-flex items-center gap-2',
}) => {
  const { user, profile } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const [loadingEvidence, setLoadingEvidence] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reportType, setReportType] = useState('missing_items')
  const [priority, setPriority] = useState('high')
  const [description, setDescription] = useState('')
  const [legalRecommendation, setLegalRecommendation] = useState('')
  const [reportedUserId, setReportedUserId] = useState('')
  const [selectedEvidencePaths, setSelectedEvidencePaths] = useState([])
  const [selectedFiles, setSelectedFiles] = useState([])
  const [conditionPhotos, setConditionPhotos] = useState([])

  const reporterRole = useMemo(
    () => resolveReporterRole({ order, userId: user?.id, profileRole: profile?.role }),
    [order, profile?.role, user?.id]
  )

  const reportedCandidates = useMemo(
    () => resolveReportedCandidates({ order, userId: user?.id }),
    [order, user?.id]
  )

  const openModal = async () => {
    if (!order?.id) return

    setIsOpen(true)
    setLoadingEvidence(true)

    try {
      const photos = await getOrderConditionPhotos(order.id)
      setConditionPhotos(photos)
      setSelectedEvidencePaths(photos.slice(0, 2).map((photo) => photo.storage_path))
    } catch {
      setConditionPhotos([])
      setSelectedEvidencePaths([])
    } finally {
      setLoadingEvidence(false)
    }
  }

  const closeModal = () => {
    setIsOpen(false)
    setDescription('')
    setLegalRecommendation('')
    setSelectedFiles([])
    setSelectedEvidencePaths([])
    setReportedUserId('')
    setReportType('missing_items')
    setPriority('high')
  }

  const toggleEvidencePath = (path) => {
    setSelectedEvidencePaths((currentPaths) => {
      return currentPaths.includes(path)
        ? currentPaths.filter((currentPath) => currentPath !== path)
        : [...currentPaths, path]
    })
  }

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error('يرجى وصف الواقعة الاحتيالية بشكل واضح.')
      return
    }

    setSubmitting(true)
    try {
      const selectedCandidate = reportedCandidates.find((candidate) => candidate.id === reportedUserId)

      await fraudReportService.createFraudReport({
        orderId: order.id,
        deliveryId,
        reporterId: user.id,
        reporterRole,
        reportedUserId: selectedCandidate?.id || null,
        reportedUserRole: selectedCandidate?.role || null,
        reportType,
        description: description.trim(),
        priority,
        legalRecommendation: legalRecommendation.trim(),
        evidencePaths: selectedEvidencePaths,
        files: selectedFiles,
      })

      toast.success('تم تسجيل بلاغ الاحتيال وإحالة الملف للإدارة.')
      closeModal()
    } catch (error) {
      toast.error(error.message || 'تعذر إرسال بلاغ الاحتيال.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!order?.id || !user?.id) return null

  return (
    <>
      <button type="button" onClick={openModal} className={className}>
        <FlagIcon className="h-4 w-4" />
        {buttonLabel}
      </button>

      <Modal isOpen={isOpen} onClose={closeModal} title="بلاغ احتيال قانوني" size="xl">
        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 text-amber-700" />
              <div>
                <p className="font-semibold text-amber-900">تنبيه قانوني</p>
                <p className="mt-1 text-sm leading-6 text-amber-900">
                  هذا البلاغ يفتح مسار مراجعة رسمي داخل المنصة، وقد تُستخدم الصور القانونية والسجلات الجغرافية والإشعارات لإثبات المسؤولية عند الحاجة.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="fraud-report-type" className="input-label">نوع الاحتيال</label>
              <select id="fraud-report-type" value={reportType} onChange={(event) => setReportType(event.target.value)} className="input">
                {FRAUD_REPORT_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="fraud-priority" className="input-label">الأولوية</label>
              <select id="fraud-priority" value={priority} onChange={(event) => setPriority(event.target.value)} className="input">
                {FRAUD_PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="fraud-reported-user" className="input-label">الطرف المبلّغ ضده</label>
            <select id="fraud-reported-user" value={reportedUserId} onChange={(event) => setReportedUserId(event.target.value)} className="input">
              <option value="">بدون تحديد مباشر</option>
              {reportedCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.label} - {ROLE_LABELS[candidate.role] || candidate.role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="fraud-description" className="input-label">الوصف القانوني للواقعة</label>
            <textarea
              id="fraud-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="input min-h-32 resize-y"
              placeholder="اشرح ما حدث، متى وقع، وما الذي يدعم الاشتباه في الاحتيال."
            />
          </div>

          <div>
            <label htmlFor="fraud-recommendation" className="input-label">التوصية أو الطلب من الإدارة</label>
            <textarea
              id="fraud-recommendation"
              value={legalRecommendation}
              onChange={(event) => setLegalRecommendation(event.target.value)}
              className="input min-h-24 resize-y"
              placeholder="مثال: مراجعة الصور القانونية، تعليق السائق، أو التحقيق في الدفع."
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <PaperClipIcon className="h-4 w-4 text-slate-500" />
              <label htmlFor="fraud-evidence-files" className="font-medium text-slate-900">إرفاق أدلة إضافية</label>
            </div>
            <input
              id="fraud-evidence-files"
              type="file"
              multiple
              accept="image/*,application/pdf"
              onChange={(event) => setSelectedFiles(Array.from(event.target.files || []))}
              className="input"
            />
            {selectedFiles.length > 0 ? (
              <p className="mt-2 text-xs text-slate-500">تم اختيار {selectedFiles.length} ملف/ملفات إضافية.</p>
            ) : null}
          </div>

          <div>
            <p className="font-medium text-slate-900 mb-3">الصور القانونية المرتبطة بالطلب</p>
            {loadingEvidence ? (
              <p className="text-sm text-slate-500">جاري تحميل الصور القانونية...</p>
            ) : conditionPhotos.length === 0 ? (
              <p className="text-sm text-slate-500">لا توجد صور قانونية متاحة للإرفاق حالياً.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {conditionPhotos.map((photo) => (
                  // eslint-disable-next-line jsx-a11y/label-has-associated-control
                  <label key={photo.id} className="rounded-2xl border border-slate-200 p-3 cursor-pointer hover:border-slate-300">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedEvidencePaths.includes(photo.storage_path)}
                        onChange={() => toggleEvidencePath(photo.storage_path)}
                        className="mt-1 h-4 w-4"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{photo.capture_stage}</p>
                        <p className="text-xs text-slate-500 mt-1">{new Date(photo.captured_at).toLocaleString('ar-MA')}</p>
                        {photo.signed_url ? (
                          <a href={photo.signed_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs text-green-700 hover:underline">
                            فتح الصورة
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={closeModal} className="btn-outline" disabled={submitting}>إلغاء</button>
            <button type="button" onClick={handleSubmit} className="btn-primary" disabled={submitting}>
              {submitting ? 'جاري إرسال البلاغ...' : 'إرسال البلاغ'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

export default FraudReportButton
