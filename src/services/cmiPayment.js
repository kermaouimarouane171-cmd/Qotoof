import { supabase } from '@/services/supabase'
import { getLatestPaymentRecordForOrder } from '@/services/paymentRecords'
export const initCMIPayment = async (order) => {
  if (!order?.id) {
    throw new Error('بيانات الطلب غير كافية لتهيئة CMI')
  }

  throw new Error('CMI لم يعد مسار دفع نشطاً في checkout الحالي. استخدم PayPal أو التحويل البنكي.')
}

/**
 * دالة verifyCMICallback(data, secretKey)
 * تتحقق من hash القادم من callback.
 */
export const verifyCMICallback = async () => {
  throw new Error('يجب تنفيذ التحقق من CMI callback داخل السيرفر فقط.')
}

/**
 * دالة getCMIStatus(orderId)
 * تستعلم حالة الدفع من endpoint خارجي إن توفر، أو من جدول payments كـ fallback.
 */
export const getCMIStatus = async (orderId) => {
  if (!orderId) {
    throw new Error('orderId مطلوب لاستعلام حالة CMI')
  }

  // fallback: قراءة آخر حالة دفع من Supabase
  const { data, error } = await getLatestPaymentRecordForOrder({
    orderId,
    paymentMethod: 'cmi',
    select: 'id, order_id, status, payment_method, method, transaction_id, updated_at',
    allowMissing: true,
  })

  if (error) {
    throw new Error(`فشل استعلام حالة الدفع من قاعدة البيانات: ${error.message}`)
  }

  return data || {
    order_id: orderId,
    status: 'unknown',
    message: 'لا توجد معاملة CMI مسجلة لهذا الطلب بعد',
  }
}
