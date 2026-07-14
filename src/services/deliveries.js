import { supabase } from './supabase'
import { withRetry } from '@/utils/withRetry'

const requireAuthenticatedUserId = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) throw error
  if (!user?.id) throw new Error('Authentication required')

  return user.id
}

const toServiceResult = async (operation) => {
  try {
    const data = await operation()
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

const deliverySelect = `
  id,
  order_id,
  driver_id,
  status,
  created_at,
  assigned_at,
  accepted_at,
  picked_up_at,
  delivered_at,
  proof_photo_url,
  order:orders(
    id,
    order_number,
    total,
    buyer:profiles!buyer_id(id, first_name, last_name, phone, email),
    vendor:profiles!vendor_id(id, first_name, store_name)
  ),
  driver:profiles!driver_id(id, first_name, last_name, phone, avatar_url)
`

const statusTimestampField = {
  assigned: 'assigned_at',
  accepted: 'accepted_at',
  picked_up: 'picked_up_at',
  delivered: 'delivered_at',
}

export const createDelivery = async ({ orderId, vendorId = null, driverId = null, status = 'unassigned' }) => toServiceResult(async () => {
  const { data, error } = await supabase
    .from('deliveries')
    .insert({
      order_id: orderId,
      vendor_id: vendorId,
      driver_id: driverId,
      status,
    })
    .select(deliverySelect)
    .single()

  if (error) throw error
  return data
})

export const fetchDeliveryById = async (deliveryId) => toServiceResult(async () => {
  const { data, error } = await supabase
    .from('deliveries')
    .select(deliverySelect)
    .eq('id', deliveryId)
    .maybeSingle()

  if (error) throw error
  return data
})

export const updateDeliveryStatus = async (deliveryId, status, values = {}) => toServiceResult(async () => {
  const now = new Date().toISOString()
  const payload = {
    ...values,
    status,
    updated_at: now,
  }

  const timestampField = statusTimestampField[status]
  if (timestampField && !payload[timestampField]) {
    payload[timestampField] = now
  }

  const { data, error } = await supabase
    .from('deliveries')
    .update(payload)
    .eq('id', deliveryId)
    .select(deliverySelect)
    .single()

  if (error) throw error
  return data
})

export const assignDriver = async (deliveryId, driverId) => updateDeliveryStatus(deliveryId, 'assigned', {
  driver_id: driverId,
  assigned_at: new Date().toISOString(),
})

export const markDelivered = async (deliveryId, proofPhotoUrl = null) => updateDeliveryStatus(deliveryId, 'delivered', {
  proof_photo_url: proofPhotoUrl,
  delivered_at: new Date().toISOString(),
})

export const subscribeToDeliveryUpdates = (deliveryId, callback) => {
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

  return () => {
    if (typeof supabase.removeChannel === 'function') {
      supabase.removeChannel(channel)
      return
    }

    if (typeof channel.unsubscribe === 'function') {
      channel.unsubscribe()
    }
  }
}

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
    const { data, error } = await supabase.functions.invoke('assign-driver', {
      body: { deliveryId, driverId },
    })

    if (error) throw error
    if (!data?.success || !data?.delivery) {
      throw new Error(data?.error || 'Failed to assign driver')
    }

    return data.delivery
  }, { maxRetries: 2, baseDelay: 1000 }),

  // Driver accept delivery (with race condition protection)
  acceptDelivery: withRetry(async (deliveryId, driverId = null) => {
    const { data, error } = await supabase.functions.invoke('accept-delivery', {
      body: { deliveryId, driverId },
    })

    if (error) throw error
    if (!data?.success || !data?.delivery) {
      throw new Error(data?.error || 'Failed to accept delivery')
    }

    return data.delivery
  }, { maxRetries: 2, baseDelay: 1000 }),
  
  // Driver reject delivery
  rejectDelivery: withRetry(async (deliveryId, reason = '') => {
    const { data, error } = await supabase.functions.invoke('reject-delivery', {
      body: { deliveryId, reason },
    })

    if (error) throw error
    if (!data?.success || !data?.delivery) {
      throw new Error(data?.error || 'Failed to reject delivery')
    }

    return data.delivery
  }, { maxRetries: 2, baseDelay: 1000 }),

  // Driver mark as picked up (only if accepted)
  markPickedUp: withRetry(async (deliveryId) => {
    const { data, error } = await supabase.functions.invoke('mark-delivery-picked-up', {
      body: { deliveryId },
    })

    if (error) throw error
    if (!data?.success || !data?.delivery) {
      throw new Error(data?.error || 'Failed to mark delivery as picked up')
    }

    return data.delivery
  }, { maxRetries: 2, baseDelay: 1000 }),

  // Driver mark as on the way (only if picked_up)
  markOnTheWay: withRetry(async (deliveryId) => {
    const { data, error } = await supabase.functions.invoke('mark-delivery-on-the-way', {
      body: { deliveryId },
    })

    if (error) throw error
    if (!data?.success || !data?.delivery) {
      throw new Error(data?.error || 'Failed to mark delivery as on the way')
    }

    return data.delivery
  }, { maxRetries: 2, baseDelay: 1000 }),

  // Driver mark as delivered (only if on_the_way)
  markDelivered: withRetry(async (deliveryId, proofUrl = null, signatureUrl = null) => {
    const { data, error } = await supabase.functions.invoke('mark-delivery-delivered', {
      body: { deliveryId, proofUrl, signatureUrl },
    })

    if (error) throw error
    if (!data?.success || !data?.delivery) {
      throw new Error(data?.error || 'Failed to mark delivery as delivered')
    }

    return data.delivery
  }, { maxRetries: 2, baseDelay: 1000 }),
  
  // Update driver location
  updateLocation: withRetry(async (deliveryId, latitude, longitude) => {
    const driverId = await requireAuthenticatedUserId()

    const { data, error } = await supabase
      .from('deliveries')
      .update({
        current_latitude: latitude,
        current_longitude: longitude,
        last_location_update: new Date().toISOString(),
      })
      .eq('id', deliveryId)
      .eq('driver_id', driverId)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) {
      throw new Error('Delivery not found')
    }
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
    const driverId = await requireAuthenticatedUserId()

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
      .eq('driver_id', driverId)
      .maybeSingle()

    if (error) throw error
    if (!data) {
      throw new Error('Delivery not found')
    }

    return data
  }, { maxRetries: 3, baseDelay: 1000 }),
  
  // Get buyer's active delivery tracking
  getBuyerActiveDelivery: withRetry(async (buyerId) => {
    // Step 1: Get the buyer's active order IDs
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('buyer_id', buyerId)
      .in('status', ['pending', 'vendor_accepted', 'preparing', 'driver_assigned', 'driver_accepted', 'driver_picked_up', 'on_the_way'])

    if (ordersError) throw ordersError

    const orderIds = (orders || []).map((o) => o.id)
    if (orderIds.length === 0) return null

    // Step 2: Get active deliveries for those orders
    const { data, error } = await supabase
      .from('deliveries')
      .select(`
        id, order_id, driver_id, status,
        current_latitude, current_longitude,
        created_at, delivered_at,
        proof_photo_url,
        driver:profiles!driver_id(first_name, last_name, phone, avatar_url, vehicle_type, vehicle_plate),
        order:orders(order_number, total)
      `)
      .in('order_id', orderIds)
      .in('status', ['accepted', 'picked_up', 'on_the_way'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data
  }, { maxRetries: 3, baseDelay: 1000 })
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor Order Actions (legacy — misplaced in deliveries.js)
// These functions are order-related (vendor accept/reject + order subscriptions)
// but live in deliveries.js for historical reasons.
// They are exported here as vendorOrderActionsApi with a backward-compatible
// alias `ordersApi` for existing consumers.
// Migration target: move to ordersService.ts or a new vendorOrderService.ts
// in Phase 3. See src/modules/orders/README.md and src/modules/delivery/README.md.
// ─────────────────────────────────────────────────────────────────────────────

export const acceptOrder = withRetry(async (orderId) => {
  const { data, error } = await supabase.functions.invoke('accept-order', {
    body: { orderId },
  })

  if (error) throw error
  if (!data?.success || !data?.order) {
    throw new Error(data?.error || 'Failed to accept order')
  }

  return data.order
}, { maxRetries: 2, baseDelay: 1000 })

export const rejectOrder = withRetry(async (orderId, reason = '') => {
  const { data, error } = await supabase.functions.invoke('reject-order', {
    body: { orderId, reason },
  })

  if (error) throw error
  if (!data?.success || !data?.order) {
    throw new Error(data?.error || 'Failed to reject order')
  }

  return data.order
}, { maxRetries: 2, baseDelay: 1000 })

export const subscribeToOrder = (orderId, callback) => {
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
}

export const subscribeToBuyerOrders = (buyerId, callback) => {
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
}

export const subscribeToVendorOrders = (vendorId, callback) => {
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

// Grouped export — new canonical name
export const vendorOrderActionsApi = {
  acceptOrder,
  rejectOrder,
  subscribeToOrder,
  subscribeToBuyerOrders,
  subscribeToVendorOrders,
}

// Backward-compatible alias — existing imports of `ordersApi` from deliveries.js
// will continue to work. Consumers should migrate to `vendorOrderActionsApi`.
export { vendorOrderActionsApi as ordersApi }
