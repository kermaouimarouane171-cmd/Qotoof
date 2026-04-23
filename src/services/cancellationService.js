import { supabase } from './supabase'
import { logger } from '@/utils/logger'

export const DEFAULT_VENDOR_CANCELLATION_POLICY = Object.freeze({
  allow_cancellation: true,
  free_cancellation_window_minutes: 120,
  cutoff_status: 'vendor_accepted',
  cancellation_fee_type: 'fixed',
  cancellation_fee_value: 0,
  refund_percentage: 100,
  auto_approve_before_preparing: true,
  policy_text_ar: '',
})

export const CANCELLATION_CUTOFF_OPTIONS = [
  { value: 'pending', label: 'قبل اعتماد الطلب' },
  { value: 'confirmed', label: 'حتى حالة مؤكد' },
  { value: 'vendor_accepted', label: 'حتى قبول البائع' },
  { value: 'payment_received', label: 'حتى تأكيد الدفع' },
  { value: 'preparing', label: 'حتى بدء التجهيز' },
]

const STATUS_ORDER = [
  'pending',
  'confirmed',
  'vendor_accepted',
  'payment_received',
  'preparing',
  'awaiting_driver',
  'driver_assigned',
  'driver_accepted',
  'driver_picked_up',
  'shipped',
  'on_the_way',
  'delivered',
]

const TERMINAL_STATUSES = new Set(['cancelled', 'vendor_rejected', 'delivered', 'refunded'])

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const formatMad = (value) => `${Number(value || 0).toFixed(2)} درهم`

const getStatusIndex = (status) => {
  const index = STATUS_ORDER.indexOf(status)
  return index === -1 ? STATUS_ORDER.length : index
}

export const normalizeCancellationPolicy = (policy = {}) => {
  const normalized = {
    ...DEFAULT_VENDOR_CANCELLATION_POLICY,
    ...(policy || {}),
  }

  normalized.free_cancellation_window_minutes = Math.max(0, Number(normalized.free_cancellation_window_minutes || 0))
  normalized.cancellation_fee_value = Math.max(0, Number(normalized.cancellation_fee_value || 0))
  normalized.refund_percentage = clamp(Number(normalized.refund_percentage ?? 100), 0, 100)
  normalized.allow_cancellation = normalized.allow_cancellation !== false
  normalized.auto_approve_before_preparing = normalized.auto_approve_before_preparing !== false
  normalized.policy_text_ar = normalized.policy_text_ar || ''

  if (!['none', 'fixed', 'percentage'].includes(normalized.cancellation_fee_type)) {
    normalized.cancellation_fee_type = DEFAULT_VENDOR_CANCELLATION_POLICY.cancellation_fee_type
  }

  if (!STATUS_ORDER.includes(normalized.cutoff_status)) {
    normalized.cutoff_status = DEFAULT_VENDOR_CANCELLATION_POLICY.cutoff_status
  }

  return normalized
}

const validateCancellationPolicy = (policy) => {
  const normalized = normalizeCancellationPolicy(policy)

  if (normalized.cancellation_fee_type === 'percentage' && normalized.cancellation_fee_value > 100) {
    throw new Error('رسوم الإلغاء بالنسبة المئوية يجب ألا تتجاوز 100%.')
  }

  if (normalized.refund_percentage < 0 || normalized.refund_percentage > 100) {
    throw new Error('نسبة الاسترداد يجب أن تكون بين 0% و100%.')
  }

  return normalized
}

export const getOrderCancellationBaseAmount = (order = {}) => {
  return Number(order.grand_total ?? order.buyer_total ?? order.total ?? order.subtotal ?? 0)
}

const calculateCancellationFee = ({ orderTotal, policy, withinFreeWindow }) => {
  if (withinFreeWindow || policy.cancellation_fee_type === 'none') {
    return 0
  }

  if (policy.cancellation_fee_type === 'percentage') {
    return Number(((orderTotal * policy.cancellation_fee_value) / 100).toFixed(2))
  }

  return Number(policy.cancellation_fee_value.toFixed(2))
}

export const getCancellationPreview = ({ order, policy, now = new Date() }) => {
  const normalizedPolicy = validateCancellationPolicy(policy)
  const orderTotal = Number(getOrderCancellationBaseAmount(order).toFixed(2))
  const createdAt = order?.created_at ? new Date(order.created_at) : new Date(now)
  const elapsedMinutes = Math.max(0, Math.floor((new Date(now).getTime() - createdAt.getTime()) / 60000))
  const withinFreeWindow = elapsedMinutes <= normalizedPolicy.free_cancellation_window_minutes
  const cutoffReached = getStatusIndex(order?.status) >= getStatusIndex(normalizedPolicy.cutoff_status)
  const isTerminal = TERMINAL_STATUSES.has(order?.status)

  let allowed = Boolean(normalizedPolicy.allow_cancellation) && !isTerminal && !cutoffReached
  let blockingReason = ''

  if (!normalizedPolicy.allow_cancellation) {
    allowed = false
    blockingReason = 'هذا المتجر عطّل إلغاء الطلبات بعد الإنشاء. تواصل مع البائع أو الدعم إذا لزم الأمر.'
  } else if (isTerminal) {
    allowed = false
    blockingReason = 'لا يمكن إلغاء هذا الطلب بعد اكتماله أو إلغائه مسبقاً.'
  } else if (cutoffReached) {
    allowed = false
    blockingReason = 'تجاوز الطلب المرحلة المسموح فيها بالإلغاء وفق سياسة المتجر.'
  }

  const cancellationFee = Number(calculateCancellationFee({
    orderTotal,
    policy: normalizedPolicy,
    withinFreeWindow,
  }).toFixed(2))
  const grossRefundAmount = Number((orderTotal * ((withinFreeWindow ? 100 : normalizedPolicy.refund_percentage) / 100)).toFixed(2))
  const netRefundAmount = Number(Math.max(grossRefundAmount - cancellationFee, 0).toFixed(2))

  return {
    allowed,
    blockingReason,
    withinFreeWindow,
    elapsedMinutes,
    orderTotal,
    cancellationFee,
    grossRefundAmount,
    netRefundAmount,
    refundPercentageApplied: withinFreeWindow ? 100 : normalizedPolicy.refund_percentage,
    cutoffReached,
    policy: normalizedPolicy,
    summaryLine: allowed
      ? withinFreeWindow
        ? `الإلغاء مجاني الآن. سيسترد المشتري ${formatMad(netRefundAmount)}.`
        : `رسوم الإلغاء ${formatMad(cancellationFee)} وصافي الاسترداد ${formatMad(netRefundAmount)}.`
      : blockingReason,
  }
}

const notifyVendorOrderCancelled = async ({ order, preview, reason }) => {
  if (!order?.vendor_id) return

  const orderNumber = order.order_number || order.id?.slice(0, 8) || 'غير معروف'
  const message = `ألغى المشتري الطلب ${orderNumber}. رسوم الإلغاء ${formatMad(preview.cancellationFee)} وصافي الاسترداد ${formatMad(preview.netRefundAmount)}. السبب: ${reason}`
  const payload = {
    p_user_id: order.vendor_id,
    p_title: 'تم إلغاء طلب من المشتري',
    p_message: message,
    p_type: 'order',
    p_category: 'order_updates',
    p_data: {
      order_id: order.id,
      cancellation_fee: preview.cancellationFee,
      refund_amount: preview.netRefundAmount,
      buyer_cancellation_reason: reason,
    },
    p_channel: 'in_app',
    p_priority: 'high',
    p_action_url: `/orders/${order.id}`,
    p_action_label: 'عرض الطلب',
  }

  const { error } = await supabase.rpc('create_user_notification', payload)
  if (!error) return

  const { error: fallbackError } = await supabase
    .from('notifications')
    .insert({
      user_id: order.vendor_id,
      title: 'تم إلغاء طلب من المشتري',
      message,
      type: 'order',
      category: 'order_updates',
      channel: 'in_app',
      priority: 'high',
      action_url: `/orders/${order.id}`,
      action_label: 'عرض الطلب',
      data: {
        order_id: order.id,
        cancellation_fee: preview.cancellationFee,
        refund_amount: preview.netRefundAmount,
        buyer_cancellation_reason: reason,
      },
      is_read: false,
    })

  if (fallbackError) {
    throw fallbackError
  }
}

const cancellationService = {
  async getVendorCancellationPolicy(vendorId) {
    if (!vendorId) {
      return { ...DEFAULT_VENDOR_CANCELLATION_POLICY }
    }

    const { data, error } = await supabase
      .from('vendor_cancellation_policies')
      .select('*')
      .eq('vendor_id', vendorId)
      .maybeSingle()

    if (error) throw error

    return normalizeCancellationPolicy({
      vendor_id: vendorId,
      ...data,
    })
  },

  async upsertVendorCancellationPolicy({ vendorId, policy }) {
    if (!vendorId) {
      throw new Error('معرّف البائع مطلوب لحفظ سياسة الإلغاء.')
    }

    const normalized = validateCancellationPolicy(policy)
    const payload = {
      vendor_id: vendorId,
      allow_cancellation: normalized.allow_cancellation,
      free_cancellation_window_minutes: normalized.free_cancellation_window_minutes,
      cutoff_status: normalized.cutoff_status,
      cancellation_fee_type: normalized.cancellation_fee_type,
      cancellation_fee_value: normalized.cancellation_fee_value,
      refund_percentage: normalized.refund_percentage,
      auto_approve_before_preparing: normalized.auto_approve_before_preparing,
      policy_text_ar: normalized.policy_text_ar || null,
    }

    const { data, error } = await supabase
      .from('vendor_cancellation_policies')
      .upsert(payload, { onConflict: 'vendor_id' })
      .select('*')
      .single()

    if (error) throw error
    return normalizeCancellationPolicy(data)
  },

  getCancellationPreview,

  async cancelOrderByBuyer({ order, buyerId, reason, policy }) {
    if (!order?.id || !buyerId) {
      throw new Error('بيانات الطلب أو المشتري غير مكتملة.')
    }

    if (order.buyer_id !== buyerId) {
      throw new Error('لا يمكنك إلغاء طلب لا يخصك.')
    }

    const trimmedReason = String(reason || '').trim()
    if (trimmedReason.length < 5) {
      throw new Error('يرجى كتابة سبب إلغاء واضح لا يقل عن 5 أحرف.')
    }

    const resolvedPolicy = policy
      ? validateCancellationPolicy(policy)
      : await this.getVendorCancellationPolicy(order.vendor_id)

    const preview = getCancellationPreview({ order, policy: resolvedPolicy })
    if (!preview.allowed) {
      throw new Error(preview.blockingReason || 'الإلغاء غير متاح لهذا الطلب حالياً.')
    }

    const now = new Date().toISOString()
    const snapshot = {
      ...resolvedPolicy,
      checked_at: now,
      order_total: preview.orderTotal,
      within_free_window: preview.withinFreeWindow,
      elapsed_minutes: preview.elapsedMinutes,
      cancellation_fee: preview.cancellationFee,
      gross_refund_amount: preview.grossRefundAmount,
      net_refund_amount: preview.netRefundAmount,
      refund_percentage_applied: preview.refundPercentageApplied,
      auto_approved: resolvedPolicy.auto_approve_before_preparing,
    }

    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'cancelled',
        cancelled_at: now,
        cancelled_by: buyerId,
        cancellation_requested_at: now,
        cancellation_requested_by: buyerId,
        buyer_cancellation_reason: trimmedReason,
        cancellation_reason: `إلغاء من المشتري: ${trimmedReason}`,
        cancellation_policy_snapshot: snapshot,
      })
      .eq('id', order.id)
      .eq('buyer_id', buyerId)
      .eq('status', order.status)
      .select('id, status, cancelled_at, cancelled_by, cancellation_reason, buyer_cancellation_reason, cancellation_policy_snapshot')
      .single()

    if (error) throw error

    try {
      await notifyVendorOrderCancelled({
        order,
        preview,
        reason: trimmedReason,
      })
    } catch (notificationError) {
      logger.warn('Failed to notify vendor after cancellation:', notificationError)
    }

    return {
      updatedOrder: data,
      preview,
      policy: resolvedPolicy,
    }
  },
}

export default cancellationService