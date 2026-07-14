import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'
import { requireRole } from '../_shared/auth.ts'

// CORS headers are resolved dynamically per-request origin via getCorsHeaders(origin).
// See supabase/functions/_shared/cors.ts and the ALLOWED_ORIGINS Edge Function secret.

const DEFAULT_COMMISSION_RATE = 0.03
const DELIVERY_WORKFLOW_STATUSES = new Set([
  'shipped',
  'on_the_way',
  'driver_assigned',
  'driver_accepted',
  'driver_picked_up',
  'delivered',
])

/**
 * Get the commission rate for a vendor based on their subscription plan.
 * Falls back to DEFAULT_COMMISSION_RATE (3%) if the plan can't be determined.
 */
const getVendorCommissionRate = async (supabase: ReturnType<typeof createClient>, vendorId: string): Promise<number> => {
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
        return Number(plan.commission_rate) / 100
      }
    }
  } catch {
    // Fall through to default
  }
  return DEFAULT_COMMISSION_RATE
}

const json = (body: unknown, status = 200, req?: Request) => new Response(JSON.stringify(body), {
  status,
  headers: { ...(req ? getCorsHeaders(req.headers.get('Origin')) : {}), 'Content-Type': 'application/json' },
})

const _getMonthYear = (date = new Date()) => ({
  month: date.getMonth() + 1,
  year: date.getFullYear(),
})

const _ensureMonthlySale = async (supabase: ReturnType<typeof createClient>, vendorId: string, month: number, year: number) => {
  const { data: existingSale, error: existingSaleError } = await supabase
    .from('vendor_monthly_sales')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (existingSaleError) throw existingSaleError
  if (existingSale) return existingSale

  const vendorRate = await getVendorCommissionRate(supabase, vendorId)
  const { data: createdSale, error: createdSaleError } = await supabase
    .from('vendor_monthly_sales')
    .insert({
      vendor_id: vendorId,
      month,
      year,
      total_sales: 0,
      commission_rate: vendorRate,
      commission_due: 0,
      commission_paid: 0,
      status: 'active',
    })
    .select('*')
    .single()

  if (!createdSaleError && createdSale) return createdSale

  const { data: retriedSale, error: retriedSaleError } = await supabase
    .from('vendor_monthly_sales')
    .select('*')
    .eq('vendor_id', vendorId)
    .eq('month', month)
    .eq('year', year)
    .single()

  if (retriedSaleError) {
    throw createdSaleError || retriedSaleError
  }

  return retriedSale
}

const _buildCommissionSummary = async (supabase: ReturnType<typeof createClient>, orderId: string) => {
  const { data: existingTransaction, error: existingTransactionError } = await supabase
    .from('confirmed_transactions')
    .select('id, commission_amount, monthly_sale_id')
    .eq('order_id', orderId)
    .limit(1)
    .maybeSingle()

  if (existingTransactionError) throw existingTransactionError
  if (!existingTransaction?.id) return null

  const { data: existingMonthlySale, error: existingMonthlySaleError } = await supabase
    .from('vendor_monthly_sales')
    .select('*')
    .eq('id', existingTransaction.monthly_sale_id)
    .maybeSingle()

  if (existingMonthlySaleError) throw existingMonthlySaleError

  return {
    alreadyRecorded: true,
    commissionAdded: Number(existingTransaction.commission_amount || 0),
    totalThisMonth: Number(existingMonthlySale?.commission_due || existingTransaction.commission_amount || 0),
    commissionSoFar: Number(existingMonthlySale?.commission_due || existingTransaction.commission_amount || 0),
    totalSales: Number(existingMonthlySale?.total_sales || 0),
    monthlySaleId: existingTransaction.monthly_sale_id,
  }
}

const confirmSaleAndCalculate = async (supabase: ReturnType<typeof createClient>, order: Record<string, unknown>, saleAmount: number) => {
  const vendorId = String(order.vendor_id || '')

  const { data: contract, error: contractError } = await supabase
    .from('vendor_contracts')
    .select('id')
    .eq('vendor_id', vendorId)
    .eq('is_active', true)
    .order('signed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (contractError) throw contractError
  if (!contract?.id) {
    throw new Error('لا يمكن تأكيد البيع قبل توقيع العقد الرقمي')
  }

  const { data: vendorProfile, error: vendorProfileError } = await supabase
    .from('profiles')
    .select('is_active')
    .eq('id', vendorId)
    .single()

  if (vendorProfileError) throw vendorProfileError
  if (vendorProfile?.is_active === false) {
    throw new Error('الحساب مجمّد ولا يمكن تسجيل مبيعات جديدة')
  }

  const vendorRate = await getVendorCommissionRate(supabase, vendorId)
  const { data, error } = await supabase.rpc('record_confirmed_transaction', {
    p_order_id: String(order.id || ''),
    p_vendor_id: vendorId,
    p_buyer_id: order.buyer_id || null,
    p_sale_amount: saleAmount,
    p_commission_rate: vendorRate,
    p_confirmed_at: new Date().toISOString(),
  })

  if (error) throw error

  const summary = Array.isArray(data) ? data[0] : data
  if (!summary) {
    throw new Error('تعذر تسجيل العمولة لهذا الطلب')
  }

  return {
    alreadyRecorded: Boolean(summary.already_recorded),
    commissionAdded: Number(summary.commission_added || 0),
    totalThisMonth: Number(summary.total_this_month || 0),
    commissionSoFar: Number(summary.total_this_month || 0),
    totalSales: Number(summary.total_sales || 0),
    monthlySaleId: summary.monthly_sale_id || null,
  }
}

serve(async (req) => {
  const optionsResponse = handleOptions(req)
  if (optionsResponse) return optionsResponse

  try {
    if (req.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405, req)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Supabase configuration missing')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

    let auth
    try {
      auth = await requireRole(req, ['vendor', 'admin'])
    } catch (error) {
      if (error instanceof Response) {
        const payload = await error.text()
        return new Response(payload, {
          status: error.status,
          headers: {
            ...(req ? getCorsHeaders(req.headers.get('Origin')) : {}),
            'Content-Type': 'application/json',
          },
        })
      }
      return json({ success: false, error: 'Authentication failed' }, 401, req)
    }

    const user = { id: auth.userId }

    const body = await req.json()
    const orderId = typeof body?.orderId === 'string' && body.orderId.trim() ? body.orderId.trim() : ''

    if (!orderId) {
      return json({ success: false, error: 'Order ID is required' }, 400, req)
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        vendor_id,
        buyer_id,
        subtotal,
        total,
        buyer_total,
        status,
        payment_type,
        payment_received_at,
        payment_verified_by_vendor,
        first_payment_status,
        second_payment_status,
        first_payment_receipt_url,
        second_payment_receipt_url
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return json({ success: false, error: 'Order not found' }, 404, req)
    }

    if (order.vendor_id !== user.id) {
      return json({ success: false, error: 'You do not have access to this order' }, 403, req)
    }

    const saleAmount = Number(order.subtotal || order.total || order.buyer_total || 0)
    if (!saleAmount || Number.isNaN(saleAmount) || saleAmount <= 0) {
      return json({ success: false, error: 'قيمة البيع غير صالحة' }, 400, req)
    }

    const hasPendingFirstReceiptVerification = Boolean(order.first_payment_receipt_url) && order.first_payment_status === 'paid'
    const hasPendingSecondReceiptVerification = Boolean(order.second_payment_receipt_url) && order.second_payment_status === 'paid'
    const needsCommissionConfirmation = hasPendingFirstReceiptVerification || (order.payment_type === 'cod' && !order.payment_received_at)

    if (!hasPendingFirstReceiptVerification && !hasPendingSecondReceiptVerification && !needsCommissionConfirmation) {
      return json({ success: false, error: 'No pending payment confirmation action for this order' }, 400, req)
    }

    let commission = null
    if (needsCommissionConfirmation) {
      commission = await confirmSaleAndCalculate(supabase, order, saleAmount)
    }

    const nextOrderPayload: Record<string, unknown> = {}

    if (hasPendingFirstReceiptVerification) {
      nextOrderPayload.first_payment_status = 'verified'
      nextOrderPayload.payment_verified_by_vendor = true
    }

    if (hasPendingSecondReceiptVerification) {
      nextOrderPayload.second_payment_status = 'verified'
      nextOrderPayload.payment_verified_by_vendor = true
    }

    if (needsCommissionConfirmation) {
      nextOrderPayload.payment_received_at = new Date().toISOString()
    }

    if (needsCommissionConfirmation && !DELIVERY_WORKFLOW_STATUSES.has(String(order.status || ''))) {
      nextOrderPayload.status = 'payment_received'
    }

    const { data: updatedOrder, error: updatedOrderError } = await supabase
      .from('orders')
      .update(nextOrderPayload)
      .eq('id', orderId)
      .eq('vendor_id', user.id)
      .select('*')
      .single()

    if (updatedOrderError || !updatedOrder) {
      throw updatedOrderError || new Error('Failed to update order payment state')
    }

    return json({
      success: true,
      order: updatedOrder,
      commission,
      flags: {
        hasPendingFirstReceiptVerification,
        hasPendingSecondReceiptVerification,
        needsCommissionConfirmation,
      },
    }, 200, req)
  } catch (error) {
    console.error('Confirm order payment error:', error)
    return json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to confirm order payment' },
      500,
    )
  }
})