// Supabase Edge Function: process-manual-refund
// Secure manual refund for COD and bank transfer payments.
// Deploy: supabase functions deploy process-manual-refund

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================
// Environment Configuration
// ============================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// ============================================
// Helper Functions
// ============================================

const isManualRefundMethod = (paymentMethod: string | null | undefined) => {
  const normalized = String(paymentMethod || '').trim().toLowerCase()
  return (
    normalized === 'cod' ||
    normalized === 'cash_on_delivery' ||
    normalized === 'cash' ||
    normalized === 'bank' ||
    normalized === 'bank_transfer'
  )
}

const jsonResponse = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      ...extraHeaders,
    },
  })

// ============================================
// Main Handler
// ============================================

serve(async (req) => {
  try {
    // CORS
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: 'Server configuration error' }, 500)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. Authenticate request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Authentication required' }, 401)
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return jsonResponse({ error: 'Invalid or expired token' }, 401)
    }

    // 2. Parse body
    const body = await req.json()
    const { paymentId, amount, reason = '' } = body

    if (!paymentId) {
      return jsonResponse({ error: 'Missing paymentId' }, 400)
    }

    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0 || isNaN(numericAmount)) {
      return jsonResponse({ error: 'Amount must be a positive number' }, 400)
    }

    // 3. Fetch payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('id, order_id, amount, status, payment_method, method, buyer_id')
      .eq('id', paymentId)
      .single()

    if (paymentError || !payment) {
      return jsonResponse({ error: 'Payment not found' }, 404)
    }

    // 4. Verify payment method supports manual refund
    const method = payment.payment_method || payment.method || ''
    if (!isManualRefundMethod(method)) {
      return jsonResponse(
        {
          error: 'This payment method does not support manual refund via this endpoint',
          paymentMethod: method,
        },
        400
      )
    }

    // 5. Verify status allows refund
    const allowedStatuses = ['completed', 'paid', 'processing', 'verified']
    if (!allowedStatuses.includes(payment.status)) {
      return jsonResponse(
        {
          error: 'Invalid payment status for refund',
          currentStatus: payment.status,
        },
        409
      )
    }

    // 6. Check if already refunded
    if (payment.status === 'refunded') {
      return jsonResponse({ error: 'Payment already refunded' }, 409)
    }

    // 7. Verify amount does not exceed payment amount
    const paymentAmount = Number(payment.amount || 0)
    if (numericAmount > paymentAmount) {
      return jsonResponse(
        {
          error: 'Refund amount exceeds original payment amount',
          refundAmount: numericAmount,
          originalAmount: paymentAmount,
        },
        400
      )
    }

    // 8. Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, total, status, vendor_id, buyer_id, payment_status')
      .eq('id', payment.order_id)
      .single()

    if (orderError || !order) {
      return jsonResponse({ error: 'Order not found for this payment' }, 404)
    }

    // 9. Verify user role/ownership
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return jsonResponse({ error: 'Unable to verify user role' }, 403)
    }

    const isAdmin = profile.role === 'admin'
    const isVendor = profile.role === 'vendor'
    const isOrderVendor = order.vendor_id === user.id

    if (!isAdmin && !(isVendor && isOrderVendor)) {
      return jsonResponse(
        {
          error: 'Forbidden: only admin or the order vendor can process this refund',
        },
        403
      )
    }

    // 10. Update payment record
    const { error: paymentUpdateError } = await supabase
      .from('payments')
      .update({
        status: 'refunded',
        refund_amount: numericAmount,
        refund_reason: reason,
        refunded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)

    if (paymentUpdateError) {
      console.error('Failed to update payment record:', paymentUpdateError)
      throw new Error(`Failed to update payment: ${paymentUpdateError.message}`)
    }

    // 11. Update order status if full refund (>= 99%)
    const isFullRefund = numericAmount >= Number(order.total || paymentAmount) * 0.99
    if (isFullRefund) {
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          status: 'refunded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)

      if (orderUpdateError) {
        console.error('Failed to update order status:', orderUpdateError)
        // Don't fail the refund if order update fails
      }
    }

    // 12. Update return request if exists
    const { data: returnReq } = await supabase
      .from('return_requests')
      .select('id')
      .eq('order_id', order.id)
      .maybeSingle()

    if (returnReq) {
      const { error: returnUpdateError } = await supabase
        .from('return_requests')
        .update({
          status: 'refunded',
          refund_amount: numericAmount,
          admin_id: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', returnReq.id)

      if (returnUpdateError) {
        console.error('Failed to update return request:', returnUpdateError)
        // Don't fail the refund
      }
    }

    // 13. Write financial audit log
    const { error: auditError } = await supabase
      .from('financial_audit_log')
      .insert({
        entity_type: 'refund',
        entity_id: order.id,
        action: 'manual_refund_processed',
        previous_status: payment.status,
        new_status: 'refunded',
        amount: numericAmount,
        performed_by: user.id,
        performed_by_role: profile.role,
        details: {
          payment_id: paymentId,
          payment_method: method,
          reason,
          is_full_refund: isFullRefund,
          order_id: order.id,
        },
        reason: reason || 'Manual refund processed',
      })

    if (auditError) {
      console.error('Failed to create audit log:', auditError)
      // Don't fail the request, just log
    }

    // 14. Return success
    return jsonResponse({
      success: true,
      payment: {
        id: paymentId,
        status: 'refunded',
        refundAmount: numericAmount,
      },
      order: {
        id: order.id,
        status: isFullRefund ? 'refunded' : order.status,
      },
      isFullRefund,
      message: 'Refund processed successfully',
    })
  } catch (error) {
    console.error('Manual refund processing error:', error)
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : 'Failed to process manual refund',
        code: 'MANUAL_REFUND_ERROR',
      },
      500
    )
  }
})
