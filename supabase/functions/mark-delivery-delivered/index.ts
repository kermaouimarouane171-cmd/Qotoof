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
    const proofUrl = typeof body?.proofUrl === 'string' && body.proofUrl.trim() ? body.proofUrl.trim() : null
    const signatureUrl = typeof body?.signatureUrl === 'string' && body.signatureUrl.trim() ? body.signatureUrl.trim() : null

    if (!deliveryId) {
      return json({ success: false, error: 'Delivery ID is required' }, 400)
    }

    const { data: deliverySnapshot, error: deliverySnapshotError } = await adminClient
      .from('deliveries')
      .select('id, order_id, status')
      .eq('id', deliveryId)
      .eq('driver_id', user.id)
      .maybeSingle()

    if (deliverySnapshotError) throw deliverySnapshotError
    if (!deliverySnapshot) {
      return json({ success: false, error: 'Delivery not found' }, 404)
    }

    const { count, error: captureError } = await adminClient
      .from('product_condition_photos')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', deliverySnapshot.order_id)
      .eq('delivery_id', deliveryId)
      .eq('capture_stage', 'driver_dropoff')

    if (captureError) {
      throw captureError
    }

    if (Number(count || 0) <= 0) {
      return json(
        {
          success: false,
          error: 'يجب توثيق مرحلة ما قبل التسليم بالصورة القانونية قبل إتمام التوصيل.',
        },
        400,
      )
    }

    const deliveredAt = new Date().toISOString()
    const { data: delivery, error: updateError } = await adminClient
      .from('deliveries')
      .update({
        status: 'delivered',
        delivered_at: deliveredAt,
        delivery_proof_url: proofUrl,
        signature_url: signatureUrl,
      })
      .eq('id', deliveryId)
      .eq('driver_id', user.id)
      .eq('status', 'on_the_way')
      .select('id, order_id, delivered_at, delivery_proof_url, signature_url, status')
      .single()

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return json({ success: false, error: 'This delivery is not on the way yet' }, 409)
      }

      throw updateError
    }

    const { error: orderError } = await adminClient
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: deliveredAt,
      })
      .eq('id', delivery.order_id)

    if (orderError) {
      console.error('Failed to update order status after delivery:', orderError)
    }

    // Outbox: async SMS to buyer confirming delivery — non-blocking
    try {
      await adminClient.from('domain_events_outbox').insert({
        event_type: 'delivery.completed',
        payload: {
          delivery_id: deliveryId,
          order_id: delivery.order_id,
          delivered_at: deliveredAt,
        },
        source_function: 'mark-delivery-delivered',
      })
    } catch (outboxError) {
      console.warn('[outbox] insert failed; continuing without blocking main operation', outboxError)
    }

    return json({
      success: true,
      delivery,
    })
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark delivery as delivered',
    }, 500)
  }
})