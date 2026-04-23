// Auto-dispatch service for driver assignment
// Assignment logic runs server-side via the 'auto-assign-driver' Edge Function.
// This prevents race conditions (concurrent browser tabs) and removes the
// ability for any client to manipulate driver selection.

import { supabase } from '../services/supabase'
import { logger } from '../utils/logger.js'

/**
 * Auto-assign a driver to a single delivery.
 * Delegates to the 'auto-assign-driver' Edge Function which uses
 * an optimistic lock (WHERE status = 'unassigned') to prevent
 * double-assignment under concurrent requests.
 *
 * @param {string} deliveryId - Delivery UUID
 * @param {string} orderId    - Order UUID
 * @returns {Promise<{success: boolean, driver?: object, reason?: string, error?: string}>}
 */
export const autoAssignDriver = async (deliveryId, orderId) => {
  try {
    const { data, error } = await supabase.functions.invoke('auto-assign-driver', {
      body: { deliveryId, orderId },
    })

    if (error) throw error

    if (data?.success) {
      logger.log(`✅ Driver ${data.driver?.driver_id} auto-assigned to delivery ${deliveryId}`)
    } else {
      logger.warn(`⚠️ Auto-assign did not complete: ${data?.reason ?? data?.error}`)
    }

    return data
  } catch (error) {
    logger.error('❌ Auto-assign error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Auto-assign drivers to all currently unassigned deliveries.
 * Admin-only: the Edge Function enforces the role check server-side.
 *
 * @returns {Promise<{success: boolean, total: number, assigned: number, failed: number, results: Array}>}
 */
export const autoAssignAllPendingDeliveries = async () => {
  try {
    const { data, error } = await supabase.functions.invoke('auto-assign-driver', {
      body: { assignAll: true },
    })

    if (error) throw error

    logger.log(`✅ Bulk auto-assign: ${data?.assigned}/${data?.total} deliveries assigned`)
    return data
  } catch (error) {
    logger.error('❌ Auto-assign all error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Check if a driver is available for assignment
 * Verifies availability status and current workload
 */
export const isDriverAvailable = async (driverId) => {
  try {
    const { data: driver, error } = await supabase
      .from('profiles')
      .select('is_available_for_delivery, current_active_deliveries, max_concurrent_deliveries')
      .eq('id', driverId)
      .single()

    if (error) throw error

    return {
      available: driver.is_available_for_delivery && 
                 driver.current_active_deliveries < driver.max_concurrent_deliveries,
      current_load: driver.current_active_deliveries,
      max_load: driver.max_concurrent_deliveries
    }
  } catch (error) {
    logger.error('❌ Driver availability check error:', error)
    return { available: false, error: error.message }
  }
}

/**
 * Get optimal driver for a delivery
 * Returns ranked list of available drivers
 */
export const getOptimalDrivers = async (pickupLat, pickupLng, radiusKm = 20) => {
  try {
    const { data: drivers, error } = await supabase
      .rpc('find_available_drivers_with_capacity', {
        p_search_latitude: pickupLat,
        p_search_longitude: pickupLng,
        p_radius_km: radiusKm,
        p_vehicle_type: null
      })

    if (error) throw error

    return drivers || []
  } catch (error) {
    logger.error('❌ Get optimal drivers error:', error)
    return []
  }
}

/**
 * Fallback: Notify vendor when no drivers are available
 */
export const notifyVendorNoDrivers = async (orderId, vendorId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: vendorId,
        title: 'No Drivers Available',
        message: `Order #${orderId} needs delivery but no drivers are currently available. Please assign manually or try again later.`,
        type: 'warning',
        data: JSON.stringify({ order_id: orderId, type: 'no_drivers' })
      })

    if (error) throw error

    return { success: true }
  } catch (error) {
    logger.error('❌ Notify vendor error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Setup real-time listener for unassigned deliveries
 * Automatically triggers auto-assign when new unassigned delivery is created
 */
export const setupAutoDispatchListener = () => {
  const subscription = supabase
    .channel('auto_dispatch')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'deliveries',
        filter: 'status=eq.unassigned'
      },
      async (payload) => {
        logger.log('🚚 New unassigned delivery detected:', payload.new)
        const { id: deliveryId, order_id: orderId } = payload.new

        // Auto-assign driver
        const result = await autoAssignDriver(deliveryId, orderId)

        if (!result.success) {
          logger.warn('⚠️ Auto-assign failed:', result.reason)
          
          // Get order to find vendor
          const { data: order } = await supabase
            .from('orders')
            .select('vendor_id')
            .eq('id', orderId)
            .single()
          
          if (order) {
            await notifyVendorNoDrivers(orderId, order.vendor_id)
          }
        }
      }
    )
    .subscribe()

  return subscription
}

export default {
  autoAssignDriver,
  autoAssignAllPendingDeliveries,
  isDriverAvailable,
  getOptimalDrivers,
  notifyVendorNoDrivers,
  setupAutoDispatchListener
}
