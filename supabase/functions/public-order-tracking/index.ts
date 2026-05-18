import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enforceServerRateLimit, getClientIp, json, jsonHeaders } from '../_shared/serverRateLimit.ts'

const PUBLIC_REQUEST_LIMIT = {
  maxAttempts: 60,
  windowSeconds: 60,
  blockSeconds: 60,
}

const ORDER_TRACKING_LIMIT = {
  maxAttempts: 10,
  windowSeconds: 60 * 60,
  blockSeconds: 30 * 60,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: jsonHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase configuration missing')
    }

    const body = await req.json()
    const orderNumber = String(body?.orderNumber || '').trim().toUpperCase()
    const phone = String(body?.phone || '').trim()

    if (!orderNumber || !phone) {
      return json({ success: false, error: 'Order number and phone are required' }, 400)
    }

    const clientIp = getClientIp(req)
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const publicRequestResult = await enforceServerRateLimit({
      supabase,
      scope: 'public_request',
      identifierParts: ['public-order-tracking', clientIp],
      maxAttempts: PUBLIC_REQUEST_LIMIT.maxAttempts,
      windowSeconds: PUBLIC_REQUEST_LIMIT.windowSeconds,
      blockSeconds: PUBLIC_REQUEST_LIMIT.blockSeconds,
    })

    if (!publicRequestResult.allowed) {
      return json(
        { success: false, error: 'Too many requests. Please try again later.' },
        429,
        { 'Retry-After': String(publicRequestResult.retry_after_seconds || PUBLIC_REQUEST_LIMIT.blockSeconds) },
      )
    }

    const trackingResult = await enforceServerRateLimit({
      supabase,
      scope: 'order_tracking',
      identifierParts: ['public-order-tracking', clientIp, orderNumber, phone],
      maxAttempts: ORDER_TRACKING_LIMIT.maxAttempts,
      windowSeconds: ORDER_TRACKING_LIMIT.windowSeconds,
      blockSeconds: ORDER_TRACKING_LIMIT.blockSeconds,
    })

    if (!trackingResult.allowed) {
      return json(
        { success: false, error: 'Too many tracking attempts. Please try again later.' },
        429,
        { 'Retry-After': String(trackingResult.retry_after_seconds || ORDER_TRACKING_LIMIT.blockSeconds) },
      )
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .maybeSingle()

    if (!profileData?.id) {
      return json({
        success: true,
        found: false,
        searchedOrder: orderNumber,
        searchedPhone: phone,
      })
    }

    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        buyer_total,
        created_at,
        shipping_city
      `, { count: 'exact' })
      .eq('order_number', orderNumber)
      .eq('buyer_id', profileData.id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (orderError) {
      throw orderError
    }

    if (!orders?.length) {
      return json({
        success: true,
        found: false,
        searchedOrder: orderNumber,
        searchedPhone: phone,
      })
    }

    const order = orders[0]
    const { count: itemCount, error: itemCountError } = await supabase
      .from('order_items')
      .select('*', { count: 'exact', head: true })
      .eq('order_id', order.id)

    if (itemCountError) {
      throw itemCountError
    }

    return json({
      success: true,
      found: true,
      order: {
        ...order,
        item_count: itemCount || 0,
      },
    })
  } catch (error) {
    console.error('public-order-tracking error:', error)
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search tracking',
    }, 500)
  }
})