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

    const { data: delivery, error: updateError } = await adminClient
      .from('deliveries')
      .update({
        status: 'on_the_way',
      })
      .eq('id', deliveryId)
      .eq('driver_id', user.id)
      .eq('status', 'picked_up')
      .select('id, order_id, status')
      .single()

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return json({ success: false, error: 'This delivery has not been picked up yet' }, 409)
      }

      throw updateError
    }

    const { error: orderError } = await adminClient
      .from('orders')
      .update({ status: 'on_the_way' })
      .eq('id', delivery.order_id)

    if (orderError) {
      console.error('Failed to update order status:', orderError)
    }

    return json({
      success: true,
      delivery,
    })
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark delivery as on the way',
    }, 500)
  }
})