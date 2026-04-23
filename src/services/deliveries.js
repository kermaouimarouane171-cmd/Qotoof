import { supabase } from './supabase'
import { notificationsApi } from '@/services/notifications'
import { hasStageCapture } from '@/services/legalCameraService'
import { withRetry } from '@/utils/withRetry'

// Deliveries API
export const deliveriesApi = {
  // Get deliveries for driver - Optimized: pagination + minimal joins
  getDriverDeliveries: withRetry(async (driverId, status = null, filters = {}) => {
    // Pagination: default 50, max 200
    const limit = Math.min(filters.limit || 50, 200)
    const offset = filters.offset || 0

    let query = supabase
      .from('deliveries')
      .select(`
        id, order_id, driver_id, status, created_at, assigned_at,
        current_latitude, current_longitude, last_location_update,
        order:orders(
          order_number, total, shipping_city,
          buyer:profiles!buyer_id(first_name, phone),
          vendor:profiles!vendor_id(first_name, store_name)
        )
      `, { count: 'exact' })
      .eq('driver_id', driverId)

    if (status) {
      query = query.eq('status', status)
    }

    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    const { data, error, count } = await query
    if (error) throw error
    return { data, total: count }
  }, { maxRetries: 3, baseDelay: 1000 }),

  // Get available deliveries for vendor to assign - Optimized
  getUnassignedDeliveries: withRetry(async (vendorId, filters = {}) => {
    // Pagination: default 50, max 200
    const limit = Math.min(filters.limit || 50, 200)
    const offset = filters.offset || 0

    const { data, error, count } = await supabase
      .from('deliveries')
      .select(`
        id, order_id, status, created_at,
        order:orders(
          order_number, total, shipping_address, shipping_city,
          buyer:profiles!buyer_id(first_name, phone)
        )
      `, { count: 'exact' })
      .eq('status', 'unassigned')
      .eq('order.vendor_id', vendorId)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    if (error) throw error
    return { data, total: count }
  }, { maxRetries: 3, baseDelay: 1000 }),
  
  // Get available drivers near location
  getAvailableDrivers: withRetry(async (latitude, longitude, radiusKm = 20) => {
    const { data, error } = await supabase
      .rpc('find_nearby_drivers', {
        p_latitude: latitude,
        p_longitude: longitude,
        p_radius_km: radiusKm
      })

    if (error) throw error
    return data
  }, { maxRetries: 3, baseDelay: 1000 }),
  
  // Assign driver to delivery (only if unassigned or driver_assigned)
  assignDriver: withRetry(async (deliveryId, driverId) => {
    const { data, error } = await supabase
      .from('deliveries')
      .update({
        driver_id: driverId,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
      })
      .eq('id', deliveryId)
      .in('status', ['unassigned', 'driver_assigned'])
      .select()
      .single()

    if (error) {
      // If no rows matched (status changed), throw a specific error
      if (!data) {
        throw new Error('This delivery has already been assigned or accepted')
      }
      throw error
    }
    return data
  }, { maxRetries: 2, baseDelay: 1000 }),

  // Driver accept delivery (with race condition protection)
  acceptDelivery: withRetry(async (deliveryId, driverId = null) => {
    const acceptedAt = new Date().toISOString()
    const deliveryUpdatePayload = {
      status: 'accepted',
      accepted_at: acceptedAt,
    }

    if (driverId) {
      deliveryUpdatePayload.driver_id = driverId
      deliveryUpdatePayload.assigned_at = acceptedAt
    }

    let deliveryQuery = supabase
      .from('deliveries')
      .update(deliveryUpdatePayload)
      .eq('id', deliveryId)

    if (driverId) {
      deliveryQuery = deliveryQuery.or(`and(status.eq.unassigned,driver_id.is.null),and(status.eq.assigned,driver_id.eq.${driverId})`)
    } else {
      deliveryQuery = deliveryQuery.eq('status', 'assigned')
    }

    const { data, error } = await deliveryQuery
      .select('id, order_id, driver_id')
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST116' || error.message?.includes('null value')) {
        throw new Error('This delivery has already been accepted by another driver')
      }
      throw error
    }

    if (!data) {
      throw new Error('This delivery has already been accepted by another driver')
    }

    const orderUpdatePayload = {
      status: 'driver_accepted',
    }

    if (driverId) {
      orderUpdatePayload.driver_id = driverId
      orderUpdatePayload.driver_assigned_at = acceptedAt
    }

    const { error: orderError } = await supabase
      .from('orders')
      .update(orderUpdatePayload)
      .eq('id', data.order_id)

    if (orderError) {
      console.error('Failed to update order status after delivery acceptance:', orderError)
    }

    const { data: orderInfo } = await supabase
      .from('orders')
      .select('order_number, buyer_id, vendor_id')
      .eq('id', data.order_id)
      .maybeSingle()

    if (orderInfo) {
      await Promise.allSettled([
        notificationsApi.create({
          user_id: orderInfo.buyer_id,
          title: 'تم قبول التوصيل',
          message: `تم قبول توصيل الطلب ${orderInfo.order_number || data.order_id} من طرف السائق وسيبدأ الاستلام قريباً.`,
          type: 'delivery',
          category: 'delivery',
          data: { order_id: data.order_id, delivery_id: data.id },
        }),
        notificationsApi.create({
          user_id: orderInfo.vendor_id,
          title: 'السائق قبل مهمة التوصيل',
          message: `السائق قبل مهمة توصيل الطلب ${orderInfo.order_number || data.order_id}.`,
          type: 'delivery',
          category: 'delivery',
          data: { order_id: data.order_id, delivery_id: data.id },
        }),
      ])
    }

    return data
  }, { maxRetries: 2, baseDelay: 1000 }),
  
  // Driver reject delivery
  rejectDelivery: withRetry(async (deliveryId, reason = '') => {
    const { data, error } = await supabase
      .from('deliveries')
      .update({
        driver_id: null,
        status: 'unassigned',
        driver_notes: reason,
      })
      .eq('id', deliveryId)
      .select('order_id')
      .single()

    if (error) throw error

    // Update order status back - with error handling
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'vendor_accepted' })
      .eq('id', data.order_id)

    if (orderError) {
      console.error('Failed to update order status after delivery rejection:', orderError)
    }

    return data
  }, { maxRetries: 2, baseDelay: 1000 }),

  // Driver mark as picked up (only if accepted)
  markPickedUp: withRetry(async (deliveryId) => {
    const { data: pickupDelivery, error: pickupDeliveryError } = await supabase
      .from('deliveries')
      .select('id, order_id, status')
      .eq('id', deliveryId)
      .single()

    if (pickupDeliveryError) throw pickupDeliveryError

    const hasDriverLoadingCapture = await hasStageCapture({
      orderId: pickupDelivery.order_id,
      deliveryId,
      captureStage: 'driver_loading',
    })

    if (!hasDriverLoadingCapture) {
      throw new Error('يجب توثيق مرحلة تحميل السائق بالصورة القانونية قبل تأكيد الاستلام.')
    }

    const { data, error } = await supabase
      .from('deliveries')
      .update({
        status: 'picked_up',
        picked_up_at: new Date().toISOString(),
      })
      .eq('id', deliveryId)
      .eq('status', 'accepted') // STATE GUARD
      .select('order_id')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('This delivery is not in a state to be picked up')
      }
      throw error
    }

    // Update order status - with error handling
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'driver_picked_up' })
      .eq('id', data.order_id)

    if (orderError) {
      console.error('Failed to update order status after pickup:', orderError)
    }

    return data
  }, { maxRetries: 2, baseDelay: 1000 }),

  // Driver mark as on the way (only if picked_up)
  markOnTheWay: withRetry(async (deliveryId) => {
    const { data, error } = await supabase
      .from('deliveries')
      .update({
        status: 'on_the_way',
      })
      .eq('id', deliveryId)
      .eq('status', 'picked_up') // STATE GUARD
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error('This delivery has not been picked up yet')
      }
      throw error
    }

    // Update order status - with error handling
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'on_the_way' })
      .eq('id', data.order_id)

    if (orderError) {
      console.error('Failed to update order status:', orderError)
    }

    return data
  }, { maxRetries: 2, baseDelay: 1000 }),

  // Driver mark as delivered (only if on_the_way)
  markDelivered: withRetry(async (deliveryId, proofUrl = null, signatureUrl = null) => {
    const { data: deliverySnapshot, error: deliverySnapshotError } = await supabase
      .from('deliveries')
      .select('id, order_id')
      .eq('id', deliveryId)
      .single()

    if (deliverySnapshotError) throw deliverySnapshotError

    const hasDriverDropoffCapture = await hasStageCapture({
      orderId: deliverySnapshot.order_id,
      deliveryId,
      captureStage: 'driver_dropoff',
    })

    if (!hasDriverDropoffCapture) {
      throw new Error('يجب توثيق مرحلة ما قبل التسليم بالصورة القانونية قبل إتمام التوصيل.')
    }

    const { data, error } = await supabase
      .from('deliveries')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
        delivery_proof_url: proofUrl,
        signature_url: signatureUrl,
      })
      .eq('id', deliveryId)
      .select('order_id')
      .single()

    if (error) throw error

    // Update order status - with error handling
    const { error: orderError } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString(),
      })
      .eq('id', data.order_id)

    if (orderError) {
      console.error('Failed to update order status after delivery:', orderError)
    }

    return data
  }, { maxRetries: 2, baseDelay: 1000 }),
  
  // Update driver location
  updateLocation: withRetry(async (deliveryId, latitude, longitude) => {
    const { error } = await supabase
      .from('deliveries')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        last_location_update: new Date().toISOString(),
      })
      .eq('id', deliveryId)

    if (error) throw error
  }, { maxRetries: 2, baseDelay: 1000 }),
  
  // Subscribe to delivery updates (real-time)
  subscribeToDelivery: (deliveryId, callback) => {
    const channel = supabase
      .channel(`delivery:${deliveryId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: `id=eq.${deliveryId}`,
        },
        (payload) => {
          callback(payload.new)
        }
      )
      .subscribe()
    
    return channel
  },
  
  // Subscribe to driver's deliveries (real-time)
  subscribeToDriverDeliveries: (driverId, callback) => {
    const channel = supabase
      .channel(`driver-deliveries:${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          callback(payload)
        }
      )
      .subscribe()
    
    return channel
  },
  
  // Subscribe to vendor's unassigned deliveries (real-time)
  subscribeToUnassignedDeliveries: (vendorId, callback) => {
    const channel = supabase
      .channel(`vendor-unassigned:${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `order.vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          callback(payload)
        }
      )
      .subscribe()
    
    return channel
  },
  
  // Get delivery by ID - Optimized: select only needed fields
  getById: withRetry(async (deliveryId) => {
    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        id, order_id, driver_id, status, created_at, assigned_at, accepted_at,
        picked_up_at, delivered_at, driver_notes, delivery_proof_url, signature_url,
        delivery_number, pickup_address, pickup_latitude, pickup_longitude,
        delivery_address, delivery_latitude, delivery_longitude, cargo_size,
        delivery_distance_km, legal_pickup_verified_at, legal_dropoff_verified_at,
        current_latitude, current_longitude, last_location_update,
        order:orders(
          id, order_number, total, status, shipping_address, shipping_city,
          shipping_latitude, shipping_longitude, driver_delivery_payment_method,
          delivery_fee_total, vendor_product_total, legal_capture_required,
          legal_capture_completed,
          buyer:profiles!buyer_id(id, first_name, last_name, phone, email, city),
          vendor:profiles!vendor_id(id, first_name, last_name, phone, store_name, city)
        ),
        driver:profiles!driver_id(id, first_name, last_name, phone, avatar_url, vehicle_type, vehicle_plate)
      `)
      .eq('id', deliveryId)
      .single()

    if (error) throw error
    return data
  }, { maxRetries: 3, baseDelay: 1000 }),
  
  // Get buyer's active delivery tracking
  getBuyerActiveDelivery: withRetry(async (buyerId) => {
    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        *,
        driver:profiles!driver_id(first_name, last_name, phone, avatar_url, vehicle_type, vehicle_plate),
        order:orders(order_number, total)
      `)
      .eq('order.buyer_id', buyerId)
      .in('status', ['accepted', 'picked_up', 'on_the_way'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') throw error // PGRST116 = not found
    return data
  }, { maxRetries: 3, baseDelay: 1000 })
}

const buildDeliveryNumber = (orderNumber, orderId) => {
  const orderToken = String(orderNumber || orderId || 'ORDER')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-8)
    .toUpperCase()

  return `DLV-${orderToken}-${Date.now().toString().slice(-6)}`
}

const ensureDeliveryForOrder = async (order) => {
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

// Orders API (extended)
export const ordersApi = {
  // ... existing methods ...
  
  // Vendor accept order
  acceptOrder: withRetry(async (orderId) => {
    const acceptedAt = new Date().toISOString()
    const { data: currentOrder, error: currentOrderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (currentOrderError) throw currentOrderError

    const snapshotDeliveryOption = currentOrder.delivery_option || 'self'
    const snapshotAssignedDriverId = currentOrder.preferred_driver_id || currentOrder.driver_id || null

    if (snapshotDeliveryOption === 'own_driver' && !snapshotAssignedDriverId) {
      throw new Error('لا يمكن قبول هذا الطلب لأن خيار السائق المرتبط يتطلب سائقاً مرتبطاً ومقبول الشراكة.')
    }

    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'vendor_accepted',
        accepted_at: acceptedAt,
      })
      .eq('id', orderId)
      .select('*, buyer_id, order_number')
      .single()

    if (error) throw error

    const delivery = await ensureDeliveryForOrder(data)
    const assignedDriverId = data.preferred_driver_id || data.driver_id || null

    if (snapshotDeliveryOption !== 'self' && assignedDriverId) {
      const preferredAssignmentPayload = {
        status: 'driver_assigned',
        driver_id: assignedDriverId,
        driver_assigned_at: acceptedAt,
        preferred_driver_assigned_at: data.preferred_driver_id ? acceptedAt : data.preferred_driver_assigned_at || acceptedAt,
        preferred_driver_status: data.preferred_driver_id ? 'assigned' : data.preferred_driver_status,
      }

      let { error: orderUpdateError } = await supabase
        .from('orders')
        .update(preferredAssignmentPayload)
        .eq('id', orderId)

      if (orderUpdateError && orderUpdateError.message?.includes('preferred_driver')) {
        const fallbackAssignmentPayload = {
          status: 'driver_assigned',
          driver_id: assignedDriverId,
          driver_assigned_at: acceptedAt,
        }

        const fallbackResult = await supabase
          .from('orders')
          .update(fallbackAssignmentPayload)
          .eq('id', orderId)

        orderUpdateError = fallbackResult.error
      }

      if (orderUpdateError) throw orderUpdateError
    }

    // ✅ Create notification for buyer
    await supabase.from('notifications').insert({
      user_id: data.buyer_id,
      type: 'order_update',
      title: 'تم قبول الطلب',
      message: snapshotDeliveryOption === 'self'
        ? `تم قبول طلبك ${data.order_number} وسيتم توصيله ذاتياً من طرف المتجر.`
        : assignedDriverId
          ? `تم قبول طلبك ${data.order_number} وتعيين سائق للتوصيل.`
          : `تم قبول طلبك ${data.order_number} من طرف البائع وجارٍ تجهيز التوصيل والبحث عن سائق مناسب.`,
      order_id: orderId,
      is_read: false,
      created_at: acceptedAt,
    })

    return {
      ...data,
      delivery_id: delivery?.id || null,
      status: snapshotDeliveryOption !== 'self' && assignedDriverId ? 'driver_assigned' : data.status,
    }
  }, { maxRetries: 2, baseDelay: 1000 }),

  // Vendor reject order
  rejectOrder: withRetry(async (orderId, reason = '') => {
    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'vendor_rejected',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason,
      })
      .eq('id', orderId)
      .select('*, buyer_id, order_number')
      .single()

    if (error) throw error

    // ✅ Create notification for buyer
    await supabase.from('notifications').insert({
      user_id: data.buyer_id,
      type: 'order_update',
      title: 'تم رفض الطلب',
      message: `تم رفض طلبك ${data.order_number} من طرف البائع. السبب: ${reason || 'غير محدد'}`,
      order_id: orderId,
      is_read: false,
      created_at: new Date().toISOString(),
    })

    return data
  }, { maxRetries: 2, baseDelay: 1000 }),

  // Subscribe to order updates (real-time)
  subscribeToOrder: (orderId, callback) => {
    const channel = supabase
      .channel(`order:${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          callback(payload.new)
        }
      )
      .subscribe()
    
    return channel
  },
  
  // Subscribe to buyer's orders (real-time)
  subscribeToBuyerOrders: (buyerId, callback) => {
    const channel = supabase
      .channel(`buyer-orders:${buyerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `buyer_id=eq.${buyerId}`,
        },
        (payload) => {
          callback(payload)
        }
      )
      .subscribe()
    
    return channel
  },
  
  // Subscribe to vendor's orders (real-time)
  subscribeToVendorOrders: (vendorId, callback) => {
    const channel = supabase
      .channel(`vendor-orders:${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          callback(payload)
        }
      )
      .subscribe()
    
    return channel
  }
}
