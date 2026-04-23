/**
 * خدمة إشعارات نظام عمولات 3% للبائعين.
 * ترسل إشعار داخل التطبيق + بريد إلكتروني عبر Resend.
 */

import { notificationsApi } from '@/services/notifications'
import { emailService } from '@/services/emailService'
import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

const formatMad = (value) => `${Number(value || 0).toFixed(2)} درهم`

const sendInAppNotification = async (vendorId, title, message, data = {}) => {
  return notificationsApi.create({
    user_id: vendorId,
    title,
    message,
    type: 'commission',
    data,
    is_read: false,
  })
}

const sendEmailNotification = async (vendorId, subject, message, data = {}) => {
  const { data: vendor, error } = await supabase
    .from('profiles')
    .select('first_name, last_name, email')
    .eq('id', vendorId)
    .single()

  if (error || !vendor?.email) {
    logger.warn('تعذر إرسال بريد عمولة: البريد غير متوفر', { vendorId, error: error?.message })
    return { success: false, skipped: true }
  }

  return emailService.sendEmail({
    to: vendor.email,
    toName: `${vendor.first_name || ''} ${vendor.last_name || ''}`.trim(),
    subject,
    template: 'commission_notification',
    data: {
      message,
      ...data,
    },
  })
}

export const commissionNotifications = {
  async afterConfirmedSale({ vendorId, saleAmount, commissionSoFar, orderId }) {
    const title = '✅ تم تسجيل بيع جديد'
    const message = `✅ تم تسجيل بيع بقيمة ${formatMad(saleAmount)}. العمولة المتراكمة هذا الشهر: ${formatMad(commissionSoFar)}`

    await Promise.allSettled([
      sendInAppNotification(vendorId, title, message, { event: 'sale_confirmed', order_id: orderId }),
      sendEmailNotification(vendorId, title, message, { orderId, saleAmount, commissionSoFar }),
    ])
  },

  async monthEndSummary({ vendorId, monthName, totalSales, commissionDue, dueDate, monthlySaleId }) {
    const title = `📋 ملخص ${monthName}`
    const message = `📋 ملخص ${monthName}: إجمالي مبيعاتك ${formatMad(totalSales)}. العمولة المستحقة ${formatMad(commissionDue)}. آخر موعد للدفع: ${new Date(dueDate).toLocaleDateString('ar-MA')}`

    await Promise.allSettled([
      sendInAppNotification(vendorId, title, message, { event: 'month_end', monthly_sale_id: monthlySaleId }),
      sendEmailNotification(vendorId, title, message, { totalSales, commissionDue, dueDate }),
    ])
  },

  async reminder3Days({ vendorId, amountDue, dueDate, monthlySaleId }) {
    const title = '⚠️ تذكير قبل 3 أيام'
    const message = `⚠️ تذكير: عليك ${formatMad(amountDue)} عمولة. المتبقي: 3 أيام قبل تجميد الحساب. تاريخ الاستحقاق: ${new Date(dueDate).toLocaleDateString('ar-MA')}`

    await Promise.allSettled([
      sendInAppNotification(vendorId, title, message, { event: 'reminder_3days', monthly_sale_id: monthlySaleId }),
      sendEmailNotification(vendorId, title, message, { amountDue, dueDate }),
    ])
  },

  async dueToday({ vendorId, amountDue, monthlySaleId }) {
    const title = '🚨 آخر يوم للدفع'
    const message = `🚨 آخر يوم للدفع: ${formatMad(amountDue)}. ادفع الآن لتجنب تجميد الحساب.`

    await Promise.allSettled([
      sendInAppNotification(vendorId, title, message, { event: 'due_today', monthly_sale_id: monthlySaleId }),
      sendEmailNotification(vendorId, title, message, { amountDue }),
    ])
  },

  async accountFrozen({ vendorId, amountDue, monthlySaleId }) {
    const title = '🔴 تم تجميد الحساب'
    const message = `🔴 تم تجميد حسابك. السبب: عمولة متأخرة ${formatMad(amountDue)}. ادفع الآن لإعادة التفعيل فوراً.`

    await Promise.allSettled([
      sendInAppNotification(vendorId, title, message, { event: 'account_frozen', monthly_sale_id: monthlySaleId }),
      sendEmailNotification(vendorId, title, message, { amountDue }),
    ])
  },

  async paymentConfirmed({ vendorId, paidAmount, monthlySaleId }) {
    const title = '✅ تم استلام دفعتك'
    const message = `✅ تم استلام دفعتك ${formatMad(paidAmount)}. حسابك نشط الآن — شكراً!`

    await Promise.allSettled([
      sendInAppNotification(vendorId, title, message, { event: 'paid_confirmed', monthly_sale_id: monthlySaleId }),
      sendEmailNotification(vendorId, title, message, { paidAmount }),
    ])
  },
}

export default commissionNotifications
