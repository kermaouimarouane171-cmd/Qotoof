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

    if (!deliveryId) {
      return json({ success: false, error: 'Delivery ID is required' }, 400)
    }

    const { data: pickupDelivery, error: pickupDeliveryError } = await adminClient
      .from('deliveries')
      .select('id, order_id, status')
      .eq('id', deliveryId)
      .eq('driver_id', user.id)
      .maybeSingle()

    if (pickupDeliveryError) throw pickupDeliveryError
    if (!pickupDelivery) {
      return json({ success: false, error: 'Delivery not found' }, 404)
    }

    const { count, error: captureError } = await adminClient
      .from('product_condition_photos')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', pickupDelivery.order_id)
      .eq('delivery_id', deliveryId)
      .eq('capture_stage', 'driver_loading')

    if (captureError) {
      throw captureError
    }

    if (Number(count || 0) <= 0) {
      return json(
        {
          success: false,
          error: 'يجب توثيق مرحلة تحميل السائق بالصورة القانونية قبل تأكيد الاستلام.',
        },
        400,
      )
    }

    const pickedUpAt = new Date().toISOString()
    const { data: delivery, error: updateError } = await adminClient
      .from('deliveries')
      .update({
        status: 'picked_up',
        picked_up_at: pickedUpAt,
      })
      .eq('id', deliveryId)
      .eq('driver_id', user.id)
      .eq('status', 'accepted')
      .select('order_id')
      .single()

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return json({ success: false, error: 'This delivery is not in a state to be picked up' }, 409)
      }

      throw updateError
    }

    const { error: orderError } = await adminClient
      .from('orders')
      .update({ status: 'driver_picked_up' })
      .eq('id', delivery.order_id)

    if (orderError) {
      console.error('Failed to update order status after pickup:', orderError)
    }

    return json({
      success: true,
      delivery,
    })
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark delivery as picked up',
    }, 500)
  }
})