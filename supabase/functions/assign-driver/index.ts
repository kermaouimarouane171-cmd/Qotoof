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
    const driverId = typeof body?.driverId === 'string' ? body.driverId.trim() : ''

    if (!deliveryId || !driverId) {
      return json({ success: false, error: 'Delivery ID and driver ID are required' }, 400)
    }

    const { data: deliverySnapshot, error: deliverySnapshotError } = await adminClient
      .from('deliveries')
      .select('id, order_id, status')
      .eq('id', deliveryId)
      .maybeSingle()

    if (deliverySnapshotError) throw deliverySnapshotError
    if (!deliverySnapshot) {
      return json({ success: false, error: 'Delivery not found' }, 404)
    }

    const { data: orderSnapshot, error: orderSnapshotError } = await adminClient
      .from('orders')
      .select('id, vendor_id')
      .eq('id', deliverySnapshot.order_id)
      .maybeSingle()

    if (orderSnapshotError) throw orderSnapshotError
    if (!orderSnapshot || orderSnapshot.vendor_id !== user.id) {
      return json({ success: false, error: 'You do not have access to this delivery' }, 403)
    }

    const { data: delivery, error: updateError } = await adminClient
      .from('deliveries')
      .update({
        driver_id: driverId,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      })
      .eq('id', deliveryId)
      .in('status', ['unassigned', 'driver_assigned'])
      .select('*')
      .single()

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return json({ success: false, error: 'This delivery has already been assigned or accepted' }, 409)
      }

      throw updateError
    }

    // Outbox: async SMS notification to driver — non-blocking
    await adminClient.from('domain_events_outbox').insert({
      event_type: 'delivery.assigned',
      payload: {
        delivery_id: deliveryId,
        order_id: deliverySnapshot.order_id,
        driver_id: driverId,
      },
      source_function: 'assign-driver',
    })

    return json({
      success: true,
      delivery,
    })
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign driver',
    }, 500)
  }
})