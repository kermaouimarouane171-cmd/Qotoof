import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'
import fraudAwarenessService from '@/services/fraudAwarenessService'

export const FRAUD_REPORT_TYPES = [
  { value: 'missing_items', label: 'نقص في الحمولة أو عناصر مفقودة' },
  { value: 'wrong_condition', label: 'حالة المنتج لا تطابق المعاينة' },
  { value: 'fake_delivery', label: 'ادعاء تسليم أو توصيل صوري' },
  { value: 'payment_fraud', label: 'احتيال أو امتناع مالي' },
  { value: 'identity_fraud', label: 'انتحال هوية أو بيانات غير صحيحة' },
  { value: 'other', label: 'حالة أخرى تحتاج مراجعة' },
]

export const FRAUD_STATUS_OPTIONS = [
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'reviewing', label: 'قيد المراجعة' },
  { value: 'action_required', label: 'يتطلب إجراء' },
  { value: 'resolved', label: 'تمت المعالجة' },
  { value: 'dismissed', label: 'تم الحفظ دون إجراء' },
]

export const FRAUD_PRIORITY_OPTIONS = [
  { value: 'medium', label: 'متوسط' },
  { value: 'high', label: 'مرتفع' },
  { value: 'urgent', label: 'عاجل' },
]

const FRAUD_BUCKET = 'fraud-evidence'

const FRAUD_SELECT = `
  *,
  order:orders(id, order_number, status),
  reporter:profiles!fraud_reports_reporter_id_fkey(id, first_name, last_name, store_name, role, phone),
  reported_user:profiles!fraud_reports_reported_user_id_fkey(id, first_name, last_name, store_name, role, phone),
  reviewer:profiles!fraud_reports_reviewed_by_fkey(id, first_name, last_name)
`

const createSignedEvidenceUrl = async (storagePath) => {
  if (!storagePath) return ''

  if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
    return storagePath
  }

  const { data, error } = await supabase.storage
    .from(FRAUD_BUCKET)
    .createSignedUrl(storagePath, 60 * 60)

  if (error) {
    logger.warn('Failed to resolve signed fraud evidence URL:', error)
    return ''
  }

  return data?.signedUrl || ''
}

export const getFraudEvidenceLinks = async (evidencePaths = []) => {
  return Promise.all((evidencePaths || []).map(async (path) => ({
    path,
    signedUrl: await createSignedEvidenceUrl(path),
  })))
}

const uploadFraudEvidenceFiles = async ({ reporterId, reportId, files = [] }) => {
  if (!reporterId || !reportId || !files.length) return []

  const uploadedPaths = []

  for (const file of files) {
    const cleanName = `${Date.now()}_${file.name}`.replace(/\s+/g, '_')
    const storagePath = `${reporterId}/${reportId}/${cleanName}`

    const { error } = await supabase.storage
      .from(FRAUD_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) {
      logger.error('Failed to upload fraud evidence file:', error)
      throw error
    }

    uploadedPaths.push(storagePath)
  }

  return uploadedPaths
}

export const createFraudReport = async ({
  orderId,
  deliveryId = null,
  reporterId,
  reporterRole,
  reportedUserId = null,
  reportedUserRole = null,
  reportType,
  description,
  priority = 'high',
  legalRecommendation = '',
  evidencePaths = [],
  files = [],
}) => {
  const { data: createdReport, error: createError } = await supabase
    .from('fraud_reports')
    .insert({
      order_id: orderId,
      delivery_id: deliveryId,
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      reporter_role: reporterRole,
      reported_user_role: reportedUserRole,
      report_type: reportType,
      description,
      priority,
      legal_recommendation: legalRecommendation || null,
      evidence_paths: Array.isArray(evidencePaths) ? evidencePaths.filter(Boolean) : [],
    })
    .select(FRAUD_SELECT)
    .single()

  if (createError) {
    logger.error('Failed to create fraud report:', createError)
    throw createError
  }

  const uploadedPaths = await uploadFraudEvidenceFiles({
    reporterId,
    reportId: createdReport.id,
    files,
  })

  const mergedEvidencePaths = [...new Set([...(createdReport.evidence_paths || []), ...uploadedPaths])]

  let finalReport = createdReport
  if (uploadedPaths.length > 0) {
    const { data: updatedReport, error: updateError } = await supabase
      .from('fraud_reports')
      .update({ evidence_paths: mergedEvidencePaths })
      .eq('id', createdReport.id)
      .select(FRAUD_SELECT)
      .single()

    if (updateError) {
      logger.error('Failed to update fraud evidence paths:', updateError)
      throw updateError
    }

    finalReport = updatedReport
  }

  await fraudAwarenessService.notifyFraudReportCreated({
    report: finalReport,
    orderNumber: finalReport.order?.order_number,
  })

  await supabase
    .from('fraud_reports')
    .update({ awareness_notified_at: new Date().toISOString() })
    .eq('id', finalReport.id)

  return finalReport
}

export const listFraudReportsForAdmin = async () => {
  const { data, error } = await supabase
    .from('fraud_reports')
    .select(FRAUD_SELECT)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('Failed to load fraud reports for admin:', error)
    throw error
  }

  return data || []
}

export const getFraudReportById = async (reportId) => {
  const { data, error } = await supabase
    .from('fraud_reports')
    .select(FRAUD_SELECT)
    .eq('id', reportId)
    .single()

  if (error) {
    logger.error('Failed to load fraud report by id:', error)
    throw error
  }

  return data
}

export const updateFraudReport = async ({ reportId, adminId, updates }) => {
  const basePayload = {
    ...updates,
    reviewed_by: adminId,
    reviewed_at: new Date().toISOString(),
  }

  if (['resolved', 'dismissed'].includes(updates.status)) {
    basePayload.resolved_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('fraud_reports')
    .update(basePayload)
    .eq('id', reportId)

  if (error) {
    logger.error('Failed to update fraud report:', error)
    throw error
  }

  const freshReport = await getFraudReportById(reportId)
  await fraudAwarenessService.notifyFraudReportUpdated({
    report: freshReport,
    orderNumber: freshReport.order?.order_number,
  })

  return freshReport
}

const fraudReportService = {
  createFraudReport,
  getFraudEvidenceLinks,
  getFraudReportById,
  listFraudReportsForAdmin,
  updateFraudReport,
}

export default fraudReportService