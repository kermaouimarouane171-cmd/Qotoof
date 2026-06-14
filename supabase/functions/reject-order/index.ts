import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { json, jsonHeaders } from '../_shared/serverRateLimit.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: jsonHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405)
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ success: false, error: 'Supabase configuration missing' }, 500)
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ success: false, error: 'Authentication required' }, 401)
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)

    if (authError || !user) {
      return json({ success: false, error: 'Invalid or expired token' }, 401)
    }

    const body = await req.json().catch(() => null)
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : ''
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
    const cancelledAt = new Date().toISOString()

    if (!orderId) {
      return json({ success: false, error: 'Order ID is required' }, 400)
    }

    const { data: currentOrder, error: currentOrderError } = await adminClient
      .from('orders')
      .select('id, vendor_id')
      .eq('id', orderId)
      .maybeSingle()

    if (currentOrderError && currentOrderError.code !== 'PGRST116') {
      throw currentOrderError
    }

    if (!currentOrder) {
      return json({ success: false, error: 'Order not found' }, 404)
    }

    if (currentOrder.vendor_id !== user.id) {
      return json({ success: false, error: 'You do not have access to this order' }, 403)
    }

    const { data: rejectedOrder, error: rejectError } = await adminClient
      .from('orders')
      .update({
        status: 'vendor_rejected',
        cancelled_at: cancelledAt,
        cancellation_reason: reason,
      })
      .eq('id', orderId)
      .eq('vendor_id', user.id)
      .select('*, buyer_id, order_number')
      .single()

    if (rejectError) throw rejectError

    await adminClient
      .from('notifications')
      .insert({
        user_id: rejectedOrder.buyer_id,
        type: 'order_update',
        title: 'تم رفض الطلب',
        message: `تم رفض طلبك ${rejectedOrder.order_number} من طرف البائع. السبب: ${reason || 'غير محدد'}`,
        order_id: orderId,
        is_read: false,
        created_at: cancelledAt,
      })

    // Outbox: async email notification — non-blocking
    try {
      await adminClient.from('domain_events_outbox').insert({
        event_type: 'order.rejected',
        payload: {
          order_id: orderId,
          order_number: rejectedOrder.order_number,
          buyer_id: rejectedOrder.buyer_id,
          vendor_id: user.id,
          reason,
        },
        source_function: 'reject-order',
      })
    } catch (outboxError) {
      console.warn('[outbox] insert failed; continuing without blocking main operation', outboxError)
    }

    return json({
      success: true,
      order: rejectedOrder,
    })
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reject order',
    }, 500)
  }
})