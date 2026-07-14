import { supabase } from '@/services/supabase'
import { notificationsApi } from '@/modules/notifications'
import { logger } from '@/utils/logger'

const getAdminUsers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  if (error) {
    logger.error('Failed to load admin users for fraud notifications:', error)
    throw error
  }

  return data || []
}

const createNotification = async (payload) => {
  try {
    await notificationsApi.create(payload)
  } catch (error) {
    logger.warn('Fraud notification fallback failed:', error)
  }
}

export const notifyFraudReportCreated = async ({ report, orderNumber = null }) => {
  if (!report?.id) return

  const adminUsers = await getAdminUsers()
  const reportLabel = orderNumber || report.order_id || report.id.slice(0, 8)

  await Promise.allSettled([
    ...adminUsers.map((admin) => createNotification({
      user_id: admin.id,
      title: 'بلاغ احتيال جديد',
      message: `تم تسجيل بلاغ احتيال جديد مرتبط بالطلب ${reportLabel}.`,
      type: 'fraud_report',
      category: 'security',
      priority: report.priority === 'urgent' ? 'high' : 'medium',
      action_url: '/admin/fraud-reports',
      action_label: 'فتح البلاغات',
      data: {
        fraud_report_id: report.id,
        order_id: report.order_id,
        delivery_id: report.delivery_id,
      },
    })),
    createNotification({
      user_id: report.reporter_id,
      title: 'تم استلام بلاغ الاحتيال',
      message: `تم تسجيل بلاغك بخصوص الطلب ${reportLabel} وسيتم مراجعته من الإدارة.`,
      type: 'fraud_report_confirmation',
      category: 'security',
      priority: 'medium',
      action_url: `/orders/${report.order_id}`,
      action_label: 'عرض الطلب',
      data: {
        fraud_report_id: report.id,
        order_id: report.order_id,
      },
    }),
    report.reported_user_id ? createNotification({
      user_id: report.reported_user_id,
      title: 'تنبيه مراجعة احتيال',
      message: `تم فتح بلاغ مرتبط بالطلب ${reportLabel} وسيُراجع من الإدارة وفق الإجراءات القانونية.`,
      type: 'fraud_report_warning',
      category: 'security',
      priority: 'medium',
      action_url: `/orders/${report.order_id}`,
      action_label: 'عرض الطلب',
      data: {
        fraud_report_id: report.id,
        order_id: report.order_id,
      },
    }) : Promise.resolve(),
  ])
}

export const notifyFraudReportUpdated = async ({ report, orderNumber = null }) => {
  if (!report?.id) return

  const reportLabel = orderNumber || report.order_id || report.id.slice(0, 8)
  const statusLabel = {
    pending: 'قيد الانتظار',
    reviewing: 'قيد المراجعة',
    action_required: 'يتطلب إجراء',
    resolved: 'تمت المعالجة',
    dismissed: 'تم الحفظ دون إجراء',
  }[report.status] || report.status

  await Promise.allSettled([
    createNotification({
      user_id: report.reporter_id,
      title: 'تحديث على بلاغ الاحتيال',
      message: `تم تحديث حالة البلاغ المرتبط بالطلب ${reportLabel} إلى: ${statusLabel}.`,
      type: 'fraud_report_update',
      category: 'security',
      priority: report.priority === 'urgent' ? 'high' : 'medium',
      action_url: `/orders/${report.order_id}`,
      action_label: 'عرض الطلب',
      data: {
        fraud_report_id: report.id,
        order_id: report.order_id,
      },
    }),
    report.reported_user_id ? createNotification({
      user_id: report.reported_user_id,
      title: 'تحديث على مراجعة الاحتيال',
      message: `تم تحديث المراجعة المرتبطة بالطلب ${reportLabel} إلى: ${statusLabel}.`,
      type: 'fraud_report_update',
      category: 'security',
      priority: report.priority === 'urgent' ? 'high' : 'medium',
      action_url: `/orders/${report.order_id}`,
      action_label: 'عرض الطلب',
      data: {
        fraud_report_id: report.id,
        order_id: report.order_id,
      },
    }) : Promise.resolve(),
  ])
}

const fraudAwarenessService = {
  notifyFraudReportCreated,
  notifyFraudReportUpdated,
}

export default fraudAwarenessService
