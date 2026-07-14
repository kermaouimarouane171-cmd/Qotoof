/**
 * خدمة منطق العمولات الشهرية في Qotoof.
 * تحتوي على دورة البيع الشهرية: تسجيل البيع، إغلاق الشهر، المتأخرات، الدفع.
 *
 * نسبة العمولة تُقرأ من subscription_plans حسب خطة البائع (مصدر الحقيقة الوحيد).
 * القيمة الافتراضية 3% (من APP_CONFIG.commissionRate).
 */

import { supabase } from '@/services/supabase'
import { notificationsApi } from '@/modules/notifications'
import { commissionNotifications } from './commissionNotifications'
import { logger } from '@/utils/logger'
import { getSettings } from '@/services/platformSettings'
import { APP_CONFIG } from '@/config/appConfig'
import { sanitizeText } from '@/utils/sanitization'
import { enforceRateLimit, checkCommissionPaymentNoticeRate } from '@/utils/rateLimiter'
import { requireAdmin } from '@/utils/authHelpers'

const DEFAULT_COMMISSION_RATE = APP_CONFIG.commissionRate // 0.03 (3%)
const PAYMENT_DEADLINE_DAYS = 7
const MANUAL_UNFREEZE_GRACE_DAYS = 3

/**
 * Get the commission rate for a specific vendor based on their subscription plan.
 * This is the single source of truth for commission rates.
 *
 * Priority:
 * 1. subscription_plans.commission_rate for the vendor's current plan
 * 2. platformSettings.commission_rate (global fallback)
 * 3. APP_CONFIG.commissionRate (0.03 = 3%)
 *
 * @param {string} vendorId - The vendor's user ID
 * @returns {Promise<number>} Commission rate as decimal (e.g., 0.05 for 5%)
 */
const getCommissionRate = async (vendorId) => {
  // 1. Try to read from subscription_plans based on vendor's current plan
  if (vendorId) {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_plan')
        .eq('id', vendorId)
        .single()

      if (!profileError && profile?.subscription_plan) {
        const { data: plan, error: planError } = await supabase
          .from('subscription_plans')
          .select('commission_rate')
          .eq('id', profile.subscription_plan)
          .eq('is_active', true)
          .single()

        if (!planError && plan?.commission_rate != null) {
          // subscription_plans stores commission_rate as a percentage (e.g., 5 for 5%)
          return Number(plan.commission_rate) / 100
        }
      }
    } catch (error) {
      logger.warn('Failed to load commission rate from subscription_plans, trying platformSettings', { error: error?.message })
    }
  }

  // 2. Fallback to platformSettings (global rate)
  try {
    const settings = await getSettings()
    const ratePercent = settings?.commission_rate
    if (ratePercent != null && !Number.isNaN(Number(ratePercent))) {
      return Number(ratePercent) / 100
    }
  } catch (error) {
    logger.warn('Failed to load commission rate from platformSettings, using default', { error: error?.message })
  }

  // 3. Final fallback
  return DEFAULT_COMMISSION_RATE
}

const getMonthYear = (date = new Date()) => ({
  month: date.getMonth() + 1,
  year: date.getFullYear(),
})

const getMonthNameAr = (month, year) => {
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('ar-MA', { month: 'long', year: 'numeric' })
}

const buildMonthLabel = (month, year) => getMonthNameAr(month, year)

const daysRemaining = (dueDate) => {
  if (!dueDate) return null
  const diffMs = new Date(dueDate).getTime() - Date.now()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

const ensureMonthlySale = async (vendorId, month, year) => {
  let { data: monthlySale, error: monthlyError } = await supabase
    .from('vendor_monthly_sales')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (monthlyError) throw monthlyError

  if (!monthlySale) {
    const currentRate = await getCommissionRate(vendorId)
    const { data: createdSale, error: createMonthlyError } = await supabase
      .from('vendor_monthly_sales')
      .insert({
        vendor_id: vendorId,
        month,
        year,
        total_sales: 0,
        commission_rate: currentRate,
        commission_due: 0,
        commission_paid: 0,
        status: 'active',
      })
      .select('*')
      .single()

    if (createMonthlyError) throw createMonthlyError
    monthlySale = createdSale
  }

  return monthlySale
}

const insertCommissionNotificationIfMissing = async ({ vendorId, monthlySaleId, type }) => {
  const { data: existingNotification, error: existingError } = await supabase
    .from('commission_notifications')
    .select('id')
    .eq('vendor_id', vendorId)
    .eq('monthly_sale_id', monthlySaleId)
    .eq('type', type)
    .limit(1)
    .maybeSingle()

  if (existingError) throw existingError
  if (existingNotification?.id) return false

  const { error: insertError } = await supabase
    .from('commission_notifications')
    .insert({
      vendor_id: vendorId,
      monthly_sale_id: monthlySaleId,
      type,
    })

  if (insertError) throw insertError
  return true
}

const getAdminUsers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')

  if (error) throw error
  return data || []
}

export const commissionService = {
  // 1) confirmSaleAndCalculate
  async confirmSaleAndCalculate(orderId, vendorId, saleAmount) {
    const parsedAmount = Number(saleAmount)
    if (!orderId || !vendorId || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return { success: false, error: 'بيانات البيع غير صالحة' }
    }

    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, buyer_id, status, payment_received_at')
        .eq('id', orderId)
        .eq('vendor_id', vendorId)
        .maybeSingle()

      if (orderError) throw orderError
      if (!order?.id) {
        return { success: false, error: 'تعذر العثور على الطلب المرتبط بعملية البيع' }
      }

      const { data: existingTransaction, error: existingTransactionError } = await supabase
        .from('confirmed_transactions')
        .select('id, commission_amount, monthly_sale_id')
        .eq('order_id', orderId)
        .limit(1)
        .maybeSingle()

      if (existingTransactionError) throw existingTransactionError

      if (existingTransaction?.id) {
        const { data: existingMonthlySale, error: existingMonthlySaleError } = await supabase
          .from('vendor_monthly_sales')
          .select('*')
          .eq('id', existingTransaction.monthly_sale_id)
          .maybeSingle()

        if (existingMonthlySaleError) throw existingMonthlySaleError

        return {
          success: true,
          already_recorded: true,
          commission_added: Number(existingTransaction.commission_amount || 0),
          total_this_month: Number(existingMonthlySale?.commission_due || existingTransaction.commission_amount || 0),
          commission_so_far: Number(existingMonthlySale?.commission_due || existingTransaction.commission_amount || 0),
          total_sales: Number(existingMonthlySale?.total_sales || 0),
          monthly_sale_id: existingTransaction.monthly_sale_id,
        }
      }

      // تحقق من وجود عقد رقمي نشط للبائع.
      const { data: contract, error: contractError } = await supabase
        .from('vendor_contracts')
        .select('id, is_active')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('signed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (contractError) throw contractError
      if (!contract?.id) {
        return { success: false, error: 'لا يمكن تأكيد البيع قبل توقيع العقد الرقمي' }
      }

      const { month, year } = getMonthYear()
      const currentRate = await getCommissionRate(vendorId)

      // Use transactional RPC for the critical insert + update (atomic).
      // Validation (order, contract, idempotency) is done in JS above.
      // The RPC also handles idempotency internally.
      const { data: rpcResult, error: rpcError } = await supabase
        .rpc('confirm_sale_and_calculate_commission', {
          p_order_id: orderId,
          p_vendor_id: vendorId,
          p_sale_amount: parsedAmount,
          p_month: month,
          p_year: year,
          p_buyer_id: order.buyer_id || null,
          p_commission_rate: currentRate,
        })

      if (rpcError) throw rpcError
      if (!rpcResult?.success) {
        throw new Error(rpcResult?.error || 'RPC failed')
      }

      const commissionAmount = Number(rpcResult.commission_amount || 0)
      const updatedCommissionDue = Number(rpcResult.commission_due || 0)
      const updatedTotalSales = Number(rpcResult.total_sales || 0)
      const monthlySaleId = rpcResult.monthly_sale_id

      // If already recorded, return idempotent response
      if (rpcResult.already_recorded) {
        return {
          success: true,
          already_recorded: true,
          commission_added: commissionAmount,
          total_this_month: updatedCommissionDue,
          commission_so_far: updatedCommissionDue,
          total_sales: updatedTotalSales,
          monthly_sale_id: monthlySaleId,
        }
      }

      await commissionNotifications.afterConfirmedSale({
        vendorId,
        saleAmount: parsedAmount,
        commissionSoFar: updatedCommissionDue,
        orderId,
      })

      return {
        success: true,
        commission_added: commissionAmount,
        total_this_month: updatedCommissionDue,
        commission_so_far: updatedCommissionDue,
        total_sales: updatedTotalSales,
        month,
        year,
        monthly_sale_id: monthlySaleId,
      }
    } catch (error) {
      logger.error('confirmSaleAndCalculate error:', error)
      return { success: false, error: error.message || 'فشل تسجيل عملية البيع' }
    }
  },

  // 2) closeMonthAndNotify
  async closeMonthAndNotify() {
    try {
      const now = new Date()
      const endedMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endedMonth = endedMonthDate.getMonth() + 1
      const endedYear = endedMonthDate.getFullYear()

      const dueDate = new Date(now.getFullYear(), now.getMonth(), 1)
      dueDate.setDate(dueDate.getDate() + PAYMENT_DEADLINE_DAYS)

      const { data: monthlySales, error } = await supabase
        .from('vendor_monthly_sales')
        .select('*')
        .eq('month', endedMonth)
        .eq('year', endedYear)
        .gt('total_sales', 0)

      if (error) throw error

      const rows = monthlySales || []

      for (const row of rows) {
        const currentRate = await getCommissionRate(row.vendor_id)
        const commissionDue = Number((Number(row.total_sales || 0) * currentRate).toFixed(2))
        const isPaid = Number(row.commission_paid || 0) >= commissionDue

        const nextStatus = isPaid ? 'paid' : 'pending'

        const { error: updateError } = await supabase
          .from('vendor_monthly_sales')
          .update({
            commission_due: commissionDue,
            status: nextStatus,
            due_date: isPaid ? row.due_date : dueDate.toISOString(),
          })
          .eq('id', row.id)

        if (updateError) throw updateError

        const createdNotification = !isPaid
          ? await insertCommissionNotificationIfMissing({
              vendorId: row.vendor_id,
              monthlySaleId: row.id,
              type: 'month_end',
            })
          : false

        if (!isPaid && createdNotification) {
          await commissionNotifications.monthEndSummary({
            vendorId: row.vendor_id,
            monthName: getMonthNameAr(endedMonth, endedYear),
            totalSales: row.total_sales,
            commissionDue,
            dueDate: dueDate.toISOString(),
            monthlySaleId: row.id,
          })
        }

        // أنشئ سجل الشهر الجديد بقيم صفر إذا غير موجود.
        const current = getMonthYear(now)
        await ensureMonthlySale(row.vendor_id, current.month, current.year)
      }

      return { success: true, processed: rows.length }
    } catch (error) {
      logger.error('closeMonthAndNotify error:', error)
      return { success: false, error: error.message || 'فشل إغلاق الشهر' }
    }
  },

  // 3) checkOverdueCommissions
  async checkOverdueCommissions() {
    try {
      const { data: overdueRows, error } = await supabase
        .from('vendor_monthly_sales')
        .select('*')
        .eq('status', 'pending')
        .not('due_date', 'is', null)

      if (error) throw error

      const rows = overdueRows || []
      let remindersSent = 0
      let dueTodaySent = 0
      let frozenAccounts = 0
      const notificationsSkipped = []

      for (const row of rows) {
        const remainingDays = daysRemaining(row.due_date)

        if (remainingDays === 3) {
          const createdReminder = await insertCommissionNotificationIfMissing({
            vendorId: row.vendor_id,
            monthlySaleId: row.id,
            type: 'reminder_3days',
          })

          if (createdReminder) {
            remindersSent += 1
            await commissionNotifications.reminder3Days({
              vendorId: row.vendor_id,
              amountDue: row.commission_due,
              dueDate: row.due_date,
              monthlySaleId: row.id,
            })
          }
          continue
        }

        if (remainingDays === 0) {
          const createdDueTodayNotification = await insertCommissionNotificationIfMissing({
            vendorId: row.vendor_id,
            monthlySaleId: row.id,
            type: 'due_today',
          })

          if (createdDueTodayNotification) {
            dueTodaySent += 1
            await commissionNotifications.dueToday({
              vendorId: row.vendor_id,
              amountDue: row.commission_due,
              monthlySaleId: row.id,
            })
          }
          continue
        }

        if (remainingDays !== null && remainingDays < 0) {
          await supabase
            .from('vendor_monthly_sales')
            .update({ status: 'overdue' })
            .eq('id', row.id)

          const createdFrozenNotification = await insertCommissionNotificationIfMissing({
            vendorId: row.vendor_id,
            monthlySaleId: row.id,
            type: 'account_frozen',
          })

          if (createdFrozenNotification) {
            await commissionNotifications.accountFrozen({
              vendorId: row.vendor_id,
              amountDue: row.commission_due,
              monthlySaleId: row.id,
            })
          } else {
            logger.warn('Account frozen but accountFrozen notification skipped due to dedup', {
              vendor_id: row.vendor_id,
              notification_type: 'account_frozen',
              reason: 'dedup',
              monthly_sale_id: row.id,
            })
            notificationsSkipped.push({
              vendor_id: row.vendor_id,
              notification_type: 'account_frozen',
              reason: 'dedup',
              monthly_sale_id: row.id,
            })

            const admins = await getAdminUsers()
            await Promise.allSettled(
              admins.map((admin) =>
                notificationsApi.create({
                  user_id: admin.id,
                  title: 'تجميد حساب بائع دون إشعار',
                  message: `تم تجميد حساب البائع ${row.vendor_id} ولكن إشعار التجميد لم يُرسل بسبب dedup. معرف العملية الشهرية: ${row.id}.`,
                  type: 'commission',
                  data: {
                    event: 'account_frozen_skipped',
                    vendor_id: row.vendor_id,
                    monthly_sale_id: row.id,
                    notification_type: 'account_frozen',
                    reason: 'dedup',
                  },
                  is_read: false,
                })
              )
            )
          }

          frozenAccounts += 1
        }
      }

      return {
        success: true,
        frozen_accounts: frozenAccounts,
        reminders_sent: remindersSent,
        due_today_sent: dueTodaySent,
        notifications_skipped: notificationsSkipped,
      }
    } catch (error) {
      logger.error('checkOverdueCommissions error:', error)
      return { success: false, error: error.message || 'فشل فحص العمولات المتأخرة' }
    }
  },

  async submitPaymentNotice(vendorId, monthlySaleId, paymentMethod, paymentReference, note = '') {
    try {
      // Rate limit: 5 payment notices per hour per vendor
      enforceRateLimit(checkCommissionPaymentNoticeRate, vendorId)

      const reference = sanitizeText(paymentReference, { maxLength: 200 })
      const method = sanitizeText(paymentMethod, { maxLength: 50 })
      const adminNote = sanitizeText(note, { maxLength: 1000, allowNewlines: true })

      if (!vendorId || !monthlySaleId || !method || !reference) {
        return { success: false, error: 'طريقة الدفع ومرجع العملية مطلوبان' }
      }

      const { data: monthlySale, error: monthlySaleError } = await supabase
        .from('vendor_monthly_sales')
        .select('id, month, year, commission_due')
        .eq('id', monthlySaleId)
        .eq('vendor_id', vendorId)
        .maybeSingle()

      if (monthlySaleError) throw monthlySaleError
      if (!monthlySale?.id) {
        return { success: false, error: 'تعذر العثور على ملف العمولة المطلوب' }
      }

      const { error: updateError } = await supabase
        .from('vendor_monthly_sales')
        .update({
          payment_method: method,
          payment_reference: reference,
        })
        .eq('id', monthlySaleId)
        .eq('vendor_id', vendorId)

      if (updateError) throw updateError

      await insertCommissionNotificationIfMissing({
        vendorId,
        monthlySaleId,
        type: 'vendor_payment_notice',
      })

      const admins = await getAdminUsers()
      const monthLabel = buildMonthLabel(monthlySale.month, monthlySale.year)

      await Promise.allSettled(
        admins.map((admin) =>
          notificationsApi.create({
            user_id: admin.id,
            title: 'إشعار دفع عمولة جديد',
            message: `أبلغ بائع عن دفع عمولة ${monthLabel} بقيمة ${Number(monthlySale.commission_due || 0).toFixed(2)} درهم.`,
            type: 'commission',
            data: {
              vendor_id: vendorId,
              monthly_sale_id: monthlySaleId,
              month: monthlySale.month,
              year: monthlySale.year,
              payment_method: method,
              payment_reference: reference,
              note: adminNote,
            },
            is_read: false,
          })
        )
      )

      return {
        success: true,
        month_label: monthLabel,
      }
    } catch (error) {
      logger.error('submitPaymentNotice error:', error)
      return { success: false, error: error.message || 'فشل إرسال إشعار الدفع للإدارة' }
    }
  },

  // 4) confirmCommissionPayment
  async confirmCommissionPayment(vendorId, month, year, paymentMethod, paymentReference) {
    try {
      // Verify admin role (defense-in-depth, complements RLS)
      const adminCheck = await requireAdmin()
      if (!adminCheck.isAdmin) {
        return { success: false, error: adminCheck.error }
      }

      const { data: row, error: fetchError } = await supabase
        .from('vendor_monthly_sales')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('month', month)
        .eq('year', year)
        .single()

      if (fetchError) throw fetchError

      const paidAmount = Number(row.commission_due || 0)
      const sanitizedMethod = sanitizeText(paymentMethod, { maxLength: 50 })
      const sanitizedReference = sanitizeText(paymentReference, { maxLength: 200 })
      const nextPaymentMethod = sanitizedMethod || row.payment_method || 'bank_transfer'
      const nextPaymentReference = sanitizedReference || row.payment_reference || null

      if (Number(row.commission_paid || 0) >= paidAmount && row.status === 'paid') {
        return { success: true, paid_amount: paidAmount, already_paid: true }
      }

      const { error: updateError } = await supabase
        .from('vendor_monthly_sales')
        .update({
          commission_paid: paidAmount,
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: nextPaymentMethod,
          payment_reference: nextPaymentReference,
        })
        .eq('id', row.id)

      if (updateError) throw updateError

      await insertCommissionNotificationIfMissing({
        vendorId,
        monthlySaleId: row.id,
        type: 'paid_confirmed',
      })

      await commissionNotifications.paymentConfirmed({
        vendorId,
        paidAmount,
        monthlySaleId: row.id,
      })

      return { success: true, paid_amount: paidAmount }
    } catch (error) {
      logger.error('confirmCommissionPayment error:', error)
      return { success: false, error: error.message || 'فشل تأكيد دفع العمولة' }
    }
  },

  // 5) getCurrentMonthSummary
  async getCurrentMonthSummary(vendorId) {
    try {
      const { month, year } = getMonthYear()
      const monthly = await ensureMonthlySale(vendorId, month, year)

      const { data: transactions, error: txError } = await supabase
        .from('confirmed_transactions')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('month', month)
        .eq('year', year)
        .order('confirmed_at', { ascending: false })

      if (txError) throw txError

      return {
        success: true,
        id: monthly.id,
        month: monthly.month,
        year: monthly.year,
        month_label: buildMonthLabel(monthly.month, monthly.year),
        total_sales: Number(monthly.total_sales || 0),
        commission_due: Number(monthly.commission_due || 0),
        commission_paid: Number(monthly.commission_paid || 0),
        balance_remaining: Number(Math.max(Number(monthly.commission_due || 0) - Number(monthly.commission_paid || 0), 0).toFixed(2)),
        status: monthly.status,
        due_date: monthly.due_date,
        days_remaining: daysRemaining(monthly.due_date),
        paid_at: monthly.paid_at,
        payment_method: monthly.payment_method,
        payment_reference: monthly.payment_reference,
        account_active: monthly.status !== 'overdue',
        transactions: transactions || [],
      }
    } catch (error) {
      logger.error('getCurrentMonthSummary error:', error)
      return { success: false, error: error.message || 'فشل جلب ملخص الشهر الحالي' }
    }
  },

  // 6) getVendorCommissionHistory
  async getVendorCommissionHistory(vendorId) {
    try {
      const { data, error } = await supabase
        .from('vendor_monthly_sales')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('year', { ascending: false })
        .order('month', { ascending: false })

      if (error) throw error

      return {
        success: true,
        history: (data || []).map((row) => ({
          ...row,
          month_label: buildMonthLabel(row.month, row.year),
          balance_remaining: Number(Math.max(Number(row.commission_due || 0) - Number(row.commission_paid || 0), 0).toFixed(2)),
        })),
      }
    } catch (error) {
      logger.error('getVendorCommissionHistory error:', error)
      return { success: false, error: error.message || 'فشل جلب سجل العمولات' }
    }
  },

  async manuallyUnfreezeVendor(vendorId, monthlySaleId, note, graceDays = MANUAL_UNFREEZE_GRACE_DAYS) {
    try {
      // Verify admin role (defense-in-depth, complements RLS)
      const adminCheck = await requireAdmin()
      if (!adminCheck.isAdmin) {
        return { success: false, error: adminCheck.error }
      }

      const adminNote = note?.trim()
      if (!vendorId || !monthlySaleId || !adminNote) {
        return { success: false, error: 'الملاحظة مطلوبة قبل رفع التجميد يدوياً' }
      }

      const nextDueDate = new Date()
      nextDueDate.setDate(nextDueDate.getDate() + graceDays)

      const { data: monthlySale, error: monthlySaleError } = await supabase
        .from('vendor_monthly_sales')
        .select('id, month, year')
        .eq('id', monthlySaleId)
        .eq('vendor_id', vendorId)
        .maybeSingle()

      if (monthlySaleError) throw monthlySaleError
      if (!monthlySale?.id) {
        return { success: false, error: 'تعذر العثور على ملف العمولة المطلوب' }
      }

      const { error: updateSaleError } = await supabase
        .from('vendor_monthly_sales')
        .update({
          status: 'pending',
          due_date: nextDueDate.toISOString(),
        })
        .eq('id', monthlySaleId)
        .eq('vendor_id', vendorId)

      if (updateSaleError) throw updateSaleError

      await insertCommissionNotificationIfMissing({
        vendorId,
        monthlySaleId,
        type: 'manual_unfreeze',
      })

      await notificationsApi.create({
        user_id: vendorId,
        title: 'تم رفع تجميد الحساب مؤقتاً',
        message: `تم رفع تجميد حسابك مؤقتاً حتى ${nextDueDate.toLocaleDateString('ar-MA')}. ملاحظة الإدارة: ${adminNote}`,
        type: 'commission',
        data: {
          monthly_sale_id: monthlySaleId,
          note: adminNote,
          due_date: nextDueDate.toISOString(),
        },
        is_read: false,
      })

      return {
        success: true,
        due_date: nextDueDate.toISOString(),
        month_label: buildMonthLabel(monthlySale.month, monthlySale.year),
      }
    } catch (error) {
      logger.error('manuallyUnfreezeVendor error:', error)
      return { success: false, error: error.message || 'فشل رفع التجميد يدوياً' }
    }
  },
}

export const confirmSaleAndCalculate = (...args) => commissionService.confirmSaleAndCalculate(...args)
export const closeMonthAndNotify = (...args) => commissionService.closeMonthAndNotify(...args)
export const checkOverdueCommissions = (...args) => commissionService.checkOverdueCommissions(...args)
export const submitPaymentNotice = (...args) => commissionService.submitPaymentNotice(...args)
export const confirmCommissionPayment = (...args) => commissionService.confirmCommissionPayment(...args)
export const getCurrentMonthSummary = (...args) => commissionService.getCurrentMonthSummary(...args)
export const getVendorCommissionHistory = (...args) => commissionService.getVendorCommissionHistory(...args)
export const manuallyUnfreezeVendor = (...args) => commissionService.manuallyUnfreezeVendor(...args)

export default commissionService
