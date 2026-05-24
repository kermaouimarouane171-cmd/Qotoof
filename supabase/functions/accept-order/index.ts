import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { json, jsonHeaders } from '../_shared/serverRateLimit.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const buildDeliveryNumber = (orderNumber: string | null, orderId: string | null) => {
  const orderToken = String(orderNumber || orderId || 'ORDER')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-8)
    .toUpperCase()

  return `DLV-${orderToken}-${Date.now().toString().slice(-6)}`
}

const ensureDeliveryForOrder = async (supabase: ReturnType<typeof createClient>, order: Record<string, any>) => {
  if (!order?.id) return null
  if (order.delivery_option === 'self') return null

  const assignedDriverId = order.preferred_driver_id || order.driver_id || null
  const timestamp = new Date().toISOString()

  const { data: existingDelivery, error: existingError } = await supabase
    .from('deliveries')
    .select('id, driver_id, status')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingError && existingError.code !== 'PGRST116') {
    throw existingError
  }

  if (existingDelivery) {
    if (assignedDriverId && !existingDelivery.driver_id) {
      const { error: deliveryUpdateError } = await supabase
        .from('deliveries')
        .update({
          driver_id: assignedDriverId,
          status: 'assigned',
          assigned_at: timestamp,
        })
        .eq('id', existingDelivery.id)

      if (deliveryUpdateError) throw deliveryUpdateError
    }

    return existingDelivery
  }

  const { data: vendorProfile, error: vendorError } = await supabase
    .from('profiles')
    .select('store_name, address, city, latitude, longitude')
    .eq('id', order.vendor_id)
    .maybeSingle()

  if (vendorError) {
    throw vendorError
  }

  const { data: createdDelivery, error: createError } = await supabase
    .from('deliveries')
    .insert({
      delivery_number: buildDeliveryNumber(order.order_number, order.id),
      order_id: order.id,
      driver_id: assignedDriverId,
      status: assignedDriverId ? 'assigned' : 'unassigned',
      pickup_address: vendorProfile?.address || vendorProfile?.store_name || vendorProfile?.city || 'Vendor pickup',
      pickup_latitude: vendorProfile?.latitude || null,
      pickup_longitude: vendorProfile?.longitude || null,
      delivery_address: order.shipping_address || null,
      delivery_latitude: order.shipping_latitude || null,
      delivery_longitude: order.shipping_longitude || null,
      assigned_at: assignedDriverId ? timestamp : null,
    })
    .select('id, driver_id, status')
    .single()

  if (createError) throw createError

  if (assignedDriverId) {
    await supabase
      .from('notifications')
      .insert({
        user_id: assignedDriverId,
        type: 'delivery_assignment',
        title: 'تم تعيين توصيل جديد',
        message: `تم تعيين الطلب ${order.order_number || order.id} لك كتوصيل جديد.`,
        data: {
          order_id: order.id,
          delivery_id: createdDelivery.id,
        },
        is_read: false,
        created_at: timestamp,
      })
  }

  return createdDelivery
}

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

    if (!orderId) {
      return json({ success: false, error: 'Order ID is required' }, 400)
    }

    const acceptedAt = new Date().toISOString()
    const { data: currentOrder, error: currentOrderError } = await adminClient
      .from('orders')
      .select('*')
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

    const snapshotDeliveryOption = currentOrder.delivery_option || 'self'
    const snapshotAssignedDriverId = currentOrder.preferred_driver_id || currentOrder.driver_id || null

    if (snapshotDeliveryOption === 'own_driver' && !snapshotAssignedDriverId) {
      return json(
        {
          success: false,
          error: 'لا يمكن قبول هذا الطلب لأن خيار السائق المرتبط يتطلب سائقاً مرتبطاً ومقبول الشراكة.',
        },
        400,
      )
    }

    const { data: acceptedOrder, error: acceptError } = await adminClient
      .from('orders')
      .update({
        status: 'vendor_accepted',
        accepted_at: acceptedAt,
      })
      .eq('id', orderId)
      .eq('vendor_id', user.id)
      .select('*, buyer_id, order_number')
      .single()

    if (acceptError) throw acceptError

    const delivery = await ensureDeliveryForOrder(adminClient, acceptedOrder)
    const assignedDriverId = acceptedOrder.preferred_driver_id || acceptedOrder.driver_id || null
    let finalOrder = acceptedOrder

    if (snapshotDeliveryOption !== 'self' && assignedDriverId) {
      const preferredAssignmentPayload = {
        status: 'driver_assigned',
        driver_id: assignedDriverId,
        driver_assigned_at: acceptedAt,
        preferred_driver_assigned_at: acceptedOrder.preferred_driver_id ? acceptedAt : acceptedOrder.preferred_driver_assigned_at || acceptedAt,
        preferred_driver_status: acceptedOrder.preferred_driver_id ? 'assigned' : acceptedOrder.preferred_driver_status,
      }

      let { data: assignmentOrder, error: orderUpdateError } = await adminClient
        .from('orders')
        .update(preferredAssignmentPayload)
        .eq('id', orderId)
        .select('*')
        .single()

      if (orderUpdateError && orderUpdateError.message?.includes('preferred_driver')) {
        const fallbackAssignmentPayload = {
          status: 'driver_assigned',
          driver_id: assignedDriverId,
          driver_assigned_at: acceptedAt,
        }

        const fallbackResult = await adminClient
          .from('orders')
          .update(fallbackAssignmentPayload)
          .eq('id', orderId)
          .select('*')
          .single()

        assignmentOrder = fallbackResult.data
        orderUpdateError = fallbackResult.error
      }

      if (orderUpdateError) throw orderUpdateError
      if (assignmentOrder) {
        finalOrder = assignmentOrder
      }
    }

    await adminClient.from('notifications').insert({
      user_id: acceptedOrder.buyer_id,
      type: 'order_update',
      title: 'تم قبول الطلب',
      message: snapshotDeliveryOption === 'self'
        ? `تم قبول طلبك ${acceptedOrder.order_number} وسيتم توصيله ذاتياً من طرف المتجر.`
        : assignedDriverId
          ? `تم قبول طلبك ${acceptedOrder.order_number} وتعيين سائق للتوصيل.`
          : `تم قبول طلبك ${acceptedOrder.order_number} من طرف البائع وجارٍ تجهيز التوصيل والبحث عن سائق مناسب.`,
      order_id: orderId,
      is_read: false,
      created_at: acceptedAt,
    })

    // Outbox: async email notification — non-blocking, failure logged internally
    await adminClient.from('domain_events_outbox').insert({
      event_type: 'order.accepted',
      payload: {
        order_id: orderId,
        order_number: acceptedOrder.order_number,
        buyer_id: acceptedOrder.buyer_id,
        vendor_id: user.id,
      },
      source_function: 'accept-order',
    })

    return json({
      success: true,
      order: {
        ...finalOrder,
        delivery_id: delivery?.id || null,
        status: snapshotDeliveryOption !== 'self' && assignedDriverId ? 'driver_assigned' : finalOrder.status,
      },
    })
  } catch (error) {
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept order',
    }, 500)
  }
})