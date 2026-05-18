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
    const deliveryId = typeof body?.deliveryId === 'string' ? body.deliveryId.trim() : ''
    const requestedDriverId = typeof body?.driverId === 'string' ? body.driverId.trim() : ''
    const acceptedAt = new Date().toISOString()

    if (!deliveryId) {
      return json({ success: false, error: 'Delivery ID is required' }, 400)
    }

    if (requestedDriverId && requestedDriverId !== user.id) {
      return json({ success: false, error: 'You do not have access to this driver context' }, 403)
    }

    const { data: delivery, error: deliveryError } = await adminClient
      .from('deliveries')
      .update({
        status: 'accepted',
        accepted_at: acceptedAt,
        driver_id: user.id,
        assigned_at: acceptedAt,
      })
      .eq('id', deliveryId)
      .or(`and(status.eq.unassigned,driver_id.is.null),and(status.eq.assigned,driver_id.eq.${user.id})`)
      .select('id, order_id, driver_id')
      .maybeSingle()

    if (deliveryError) {
      if (deliveryError.code === 'PGRST116' || deliveryError.message?.includes('null value')) {
        return json({ success: false, error: 'This delivery has already been accepted by another driver' }, 409)
      }

      throw deliveryError
    }

    if (!delivery) {
      return json({ success: false, error: 'This delivery has already been accepted by another driver' }, 409)
    }

    const { error: orderError } = await adminClient
      .from('orders')
      .update({
        status: 'driver_accepted',
        driver_id: user.id,
        driver_assigned_at: acceptedAt,
      })
      .eq('id', delivery.order_id)

    if (orderError) {
      console.error('Failed to update order status after delivery acceptance:', orderError)
    }

    const { data: orderInfo } = await adminClient
      .from('orders')
      .select('order_number, buyer_id, vendor_id')
      .eq('id', delivery.order_id)
      .maybeSingle()

    if (orderInfo) {
      await Promise.allSettled([
        adminClient.from('notifications').insert({
          user_id: orderInfo.buyer_id,
          title: 'تم قبول التوصيل',
          message: `تم قبول توصيل الطلب ${orderInfo.order_number || delivery.order_id} من طرف السائق وسيبدأ الاستلام قريباً.`,
          type: 'delivery',
          category: 'delivery',
          data: { order_id: delivery.order_id, delivery_id: delivery.id },
          is_read: false,
          created_at: acceptedAt,
        }),
        adminClient.from('notifications').insert({
          user_id: orderInfo.vendor_id,
          title: 'السائق قبل مهمة التوصيل',
          message: `السائق قبل مهمة توصيل الطلب ${orderInfo.order_number || delivery.order_id}.`,
          type: 'delivery',
          category: 'delivery',
          data: { order_id: delivery.order_id, delivery_id: delivery.id },
          is_read: false,
          created_at: acceptedAt,
        }),
      ])
    }

    return json({
      success: true,
      delivery,
    })
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept delivery',
    }, 500)
  }
})