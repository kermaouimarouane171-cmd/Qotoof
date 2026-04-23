import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

const normalizeLocation = (row) => {
  if (!row) return null

  return {
    driverId: row.driver_id,
    deliveryId: row.delivery_id || null,
    orderId: row.order_id || null,
    vendorId: row.vendor_id || null,
    buyerId: row.buyer_id || null,
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    speedKmh: row.speed_kmh ? Number(row.speed_kmh) : null,
    heading: row.heading ? Number(row.heading) : null,
    accuracyMeters: row.accuracy_meters ?? null,
    isOnline: typeof row.is_online === 'boolean' ? row.is_online : true,
    isAvailable: typeof row.is_available === 'boolean' ? row.is_available : true,
    broadcastStatus: row.broadcast_status || 'idle',
    lastUpdated: row.last_updated || row.last_active_at || row.last_broadcast_at || null,
  }
}

class DriverLocationService {
  constructor() {
    this.browserTrackingSessions = new Map()
  }

  getTrackingKey({ driverId = null, deliveryId = null, orderId = null }) {
    return [driverId || 'driver', deliveryId || 'delivery', orderId || 'order'].join(':')
  }

  async getCurrentTrackedLocation({ driverId = null, deliveryId = null, orderId = null }) {
    if (!driverId && !deliveryId && !orderId) return null

    let query = supabase.from('driver_locations').select('*')

    if (orderId) {
      query = query.eq('order_id', orderId)
    } else if (deliveryId) {
      query = query.eq('delivery_id', deliveryId)
    } else {
      query = query.eq('driver_id', driverId)
    }

    const { data, error } = await query
      .order('last_updated', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return normalizeLocation(data)
  }

  async getCurrentDriverLocation(driverId) {
    return this.getCurrentTrackedLocation({ driverId })
  }

  subscribeToTrackedLocation({ driverId = null, deliveryId = null, orderId = null }, callback) {
    if (!driverId && !deliveryId && !orderId) return () => {}

    const filter = orderId
      ? `order_id=eq.${orderId}`
      : deliveryId
      ? `delivery_id=eq.${deliveryId}`
      : `driver_id=eq.${driverId}`

    const channelName = orderId
      ? `driver-location-live:order:${orderId}`
      : deliveryId
      ? `driver-location-live:delivery:${deliveryId}`
      : `driver-location-live:${driverId}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations',
          filter,
        },
        (payload) => {
          const nextLocation = normalizeLocation(payload.new || payload.old)
          callback(nextLocation, payload)
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }

  subscribeToDriverLocation(driverId, callback) {
    return this.subscribeToTrackedLocation({ driverId }, callback)
  }

  async startBrowserTracking({
    driverId,
    deliveryId = null,
    orderId = null,
    vendorId = null,
    buyerId = null,
    broadcastStatus = 'active',
    metadata = {},
    intervalMs = 10000,
    highAccuracy = true,
    onLocation = null,
    onError = null,
  }) {
    if (!driverId) {
      throw new Error('معرّف السائق أو الحساب المتتبع مطلوب')
    }

    if (!navigator.geolocation) {
      throw new Error('المتصفح لا يدعم تحديد الموقع الجغرافي')
    }

    const trackingKey = this.getTrackingKey({ driverId, deliveryId, orderId })
    this.stopBrowserTracking({ driverId, deliveryId, orderId, suppressStateChange: true })

    const session = {
      watchId: null,
      intervalId: null,
      retryTimeoutId: null,
      lastLocation: null,
      metadata,
    }

    const sendLocation = async (location, retryCount = 0) => {
      try {
        const speedKmh = location.speed ? Number((location.speed * 3.6).toFixed(1)) : null
        const accuracyMeters = location.accuracy ? Math.round(location.accuracy) : null

        await this.broadcastDriverLocation({
          driverId,
          deliveryId,
          orderId,
          vendorId,
          buyerId,
          latitude: location.latitude,
          longitude: location.longitude,
          speedKmh,
          accuracyMeters,
          heading: location.heading ?? null,
          broadcastStatus,
          metadata,
        })

        onLocation?.({
          latitude: location.latitude,
          longitude: location.longitude,
          speed: location.speed ?? null,
          accuracy: location.accuracy ?? null,
          heading: location.heading ?? null,
        })
      } catch (error) {
        logger.error('Failed to broadcast browser tracking location:', error)

        if (retryCount < 2) {
          session.retryTimeoutId = setTimeout(() => {
            sendLocation(location, retryCount + 1)
          }, 1500 * (retryCount + 1))
          return
        }

        onError?.(error)
      }
    }

    session.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
          heading: position.coords.heading,
        }

        session.lastLocation = nextLocation
        sendLocation(nextLocation)
      },
      (error) => {
        logger.error('Browser tracking geolocation error:', error)
        onError?.(error)
      },
      {
        enableHighAccuracy: highAccuracy,
        maximumAge: 0,
        timeout: 10000,
      }
    )

    session.intervalId = setInterval(() => {
      if (session.lastLocation) {
        sendLocation(session.lastLocation)
        return
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed,
            heading: position.coords.heading,
          }

          session.lastLocation = nextLocation
          sendLocation(nextLocation)
        },
        (error) => {
          logger.warn('Fallback browser tracking location error:', error)
          onError?.(error)
        },
        {
          enableHighAccuracy: highAccuracy,
          maximumAge: 5000,
          timeout: 8000,
        }
      )
    }, intervalMs)

    this.browserTrackingSessions.set(trackingKey, session)

    this.setBroadcastState({
      driverId,
      deliveryId,
      orderId,
      vendorId,
      buyerId,
      eventType: 'started',
      metadata,
    }).catch((error) => {
      logger.warn('Failed to mark browser tracking as started:', error)
    })

    return {
      success: true,
      stop: (eventType = 'stopped') => this.stopBrowserTracking({
        driverId,
        deliveryId,
        orderId,
        vendorId,
        buyerId,
        eventType,
      }),
    }
  }

  stopBrowserTracking({
    driverId,
    deliveryId = null,
    orderId = null,
    vendorId = null,
    buyerId = null,
    eventType = 'stopped',
    suppressStateChange = false,
  }) {
    const trackingKey = this.getTrackingKey({ driverId, deliveryId, orderId })
    const session = this.browserTrackingSessions.get(trackingKey)

    if (session?.watchId !== null) {
      navigator.geolocation.clearWatch(session.watchId)
    }

    if (session?.intervalId !== null) {
      clearInterval(session.intervalId)
    }

    if (session?.retryTimeoutId !== null) {
      clearTimeout(session.retryTimeoutId)
    }

    this.browserTrackingSessions.delete(trackingKey)

    if (!suppressStateChange && driverId) {
      this.setBroadcastState({
        driverId,
        deliveryId,
        orderId,
        vendorId,
        buyerId,
        eventType,
        latitude: session?.lastLocation?.latitude || null,
        longitude: session?.lastLocation?.longitude || null,
        metadata: session?.metadata || {},
      }).catch((error) => {
        logger.warn('Failed to mark browser tracking as stopped:', error)
      })
    }

    return { success: true }
  }

  async broadcastDriverLocation({
    driverId,
    deliveryId = null,
    orderId = null,
    vendorId = null,
    buyerId = null,
    latitude,
    longitude,
    speedKmh = null,
    heading = null,
    accuracyMeters = null,
    isAvailable = true,
    broadcastStatus = 'active',
    metadata = {},
  }) {
    if (!driverId) {
      throw new Error('معرّف السائق مطلوب لبث الموقع')
    }

    if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
      throw new Error('إحداثيات الموقع مطلوبة')
    }

    const timestamp = new Date().toISOString()
    const payload = {
      driver_id: driverId,
      delivery_id: deliveryId,
      order_id: orderId,
      vendor_id: vendorId,
      buyer_id: buyerId,
      latitude,
      longitude,
      speed_kmh: speedKmh,
      heading,
      accuracy_meters: accuracyMeters,
      is_online: true,
      is_available: isAvailable,
      last_active_at: timestamp,
      last_updated: timestamp,
      broadcast_status: broadcastStatus,
      last_broadcast_at: timestamp,
      metadata,
    }

    const { error: locationError } = await supabase
      .from('driver_locations')
      .upsert(payload, { onConflict: 'driver_id' })

    if (locationError) {
      const fallbackPayload = {
        driver_id: driverId,
        latitude,
        longitude,
        speed_kmh: speedKmh,
        heading,
        accuracy_meters: accuracyMeters,
        is_online: true,
        last_active_at: timestamp,
      }

      const { error: fallbackError } = await supabase
        .from('driver_locations')
        .upsert(fallbackPayload, { onConflict: 'driver_id' })

      if (fallbackError) {
        throw fallbackError
      }
    }

    const historyPayload = {
      driver_id: driverId,
      delivery_id: deliveryId,
      latitude,
      longitude,
      speed_kmh: speedKmh,
      heading,
      accuracy_meters: accuracyMeters,
      recorded_at: timestamp,
    }

    const { error: historyError } = await supabase
      .from('driver_location_history')
      .insert(historyPayload)

    if (historyError) {
      logger.warn('Failed to write driver location history:', historyError)
    }

    if (deliveryId) {
      const { error: deliveryError } = await supabase
        .from('deliveries')
        .update({
          current_latitude: latitude,
          current_longitude: longitude,
          last_location_update: timestamp,
          last_broadcast_at: timestamp,
          broadcast_status: broadcastStatus,
        })
        .eq('id', deliveryId)

      if (deliveryError) {
        const { error: fallbackDeliveryError } = await supabase
          .from('deliveries')
          .update({
            current_latitude: latitude,
            current_longitude: longitude,
            last_location_update: timestamp,
          })
          .eq('id', deliveryId)

        if (fallbackDeliveryError) {
          logger.warn('Failed to sync delivery live location:', fallbackDeliveryError)
        }
      }
    }

    const { error: eventError } = await supabase
      .from('driver_broadcast_events')
      .insert({
        driver_id: driverId,
        delivery_id: deliveryId,
        order_id: orderId,
        vendor_id: vendorId,
        buyer_id: buyerId,
        event_type: 'heartbeat',
        latitude,
        longitude,
        accuracy_meters: accuracyMeters,
        speed_kmh: speedKmh,
        payload: metadata,
      })

    if (eventError) {
      logger.warn('Failed to write driver broadcast event:', eventError)
    }

    return { success: true, timestamp }
  }

  async setBroadcastState({
    driverId,
    deliveryId = null,
    orderId = null,
    vendorId = null,
    buyerId = null,
    eventType = 'started',
    latitude = null,
    longitude = null,
    metadata = {},
  }) {
    if (!driverId) return { success: false }

    const timestamp = new Date().toISOString()
    const broadcastStatus =
      eventType === 'started' || eventType === 'heartbeat'
        ? 'active'
        : eventType === 'paused'
        ? 'paused'
        : eventType === 'completed'
        ? 'completed'
        : 'idle'

    const locationUpdates = {
      broadcast_status: broadcastStatus,
      last_broadcast_at: timestamp,
      is_online: eventType !== 'stopped' && eventType !== 'completed',
      is_available: eventType !== 'started' && eventType !== 'heartbeat' ? true : false,
    }

    if (eventType === 'started') {
      locationUpdates.broadcast_started_at = timestamp
    }

    const { error: locationError } = await supabase
      .from('driver_locations')
      .update(locationUpdates)
      .eq('driver_id', driverId)

    if (locationError) {
      const { error: fallbackLocationError } = await supabase
        .from('driver_locations')
        .update({
          is_online: eventType !== 'stopped' && eventType !== 'completed',
          last_active_at: timestamp,
        })
        .eq('driver_id', driverId)

      if (fallbackLocationError) {
        logger.warn('Failed to update broadcast state on driver_locations:', fallbackLocationError)
      }
    }

    if (deliveryId) {
      const { error: deliveryError } = await supabase
        .from('deliveries')
        .update({
          broadcast_status: broadcastStatus,
          last_broadcast_at: timestamp,
          ...(eventType === 'started' ? { broadcast_started_at: timestamp } : {}),
          ...(eventType === 'completed' || eventType === 'stopped' ? { broadcast_ended_at: timestamp } : {}),
        })
        .eq('id', deliveryId)

      if (deliveryError) {
        logger.warn('Failed to update broadcast state on deliveries:', deliveryError)
      }
    }

    const { error: eventError } = await supabase
      .from('driver_broadcast_events')
      .insert({
        driver_id: driverId,
        delivery_id: deliveryId,
        order_id: orderId,
        vendor_id: vendorId,
        buyer_id: buyerId,
        event_type: eventType,
        latitude,
        longitude,
        payload: metadata,
      })

    if (eventError) {
      logger.warn('Failed to insert broadcast state event:', eventError)
    }

    return { success: true, timestamp }
  }
}

export const driverLocationService = new DriverLocationService()

export default driverLocationService