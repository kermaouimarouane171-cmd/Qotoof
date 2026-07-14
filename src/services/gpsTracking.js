import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/services/supabase'
import { calculateDistance } from '@/modules/delivery'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'

/**
 * GPS Location Tracking Service
 * Tracks driver location in real-time and updates database
 */
class GPSTrackingService {
  constructor() {
    this.watchId = null
    this.isTracking = false
    this.updateInterval = 30000 // 30 seconds
    this.lastUpdate = 0
    this.minDistance = 50 // 50 meters minimum movement
  }

  /**
   * Start tracking driver location
   * @param {string} driverId - Driver ID
   * @param {Object} options - Tracking options
   * @returns {Promise<void>}
   */
  async startTracking(driverId, options = {}) {
    if (this.isTracking) {
      logger.warn('Already tracking location')
      return
    }

    if (!navigator.geolocation) {
      logger.error('Geolocation not supported')
      toast.error('المتصفح لا يدعم تحديد الموقع')
      return
    }

    const {
      enableHighAccuracy = true,
      timeout = 10000,
      maximumAge = 0,
      onUpdate = null,
    } = options

    this.isTracking = true

    // Request permission
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' })
      if (permission.state === 'denied') {
        toast.error('يرجى تفعيل إذن الموقع من إعدادات المتصفح')
        this.isTracking = false
        return
      }
    } catch (_error) {
      // Permission API not supported, continue anyway
    }

    // Start watching position
    this.watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const { latitude, longitude, accuracy, speed } = position.coords
        const now = Date.now()

        // Check if we should update (minimum distance or time)
        const shouldUpdate =
          now - this.lastUpdate > this.updateInterval

        if (shouldUpdate) {
          try {
            await this.updateDriverLocation(driverId, {
              lat: latitude,
              lng: longitude,
              accuracy,
              speed,
            })

            this.lastUpdate = now
            onUpdate?.({ latitude, longitude, accuracy, speed })
          } catch (error) {
            logger.error('Update location error:', error)
          }
        }
      },
      (error) => {
        logger.error('Geolocation error:', error)
        toast.error('فشل في تحديد الموقع')
        this.isTracking = false
      },
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    )

    logger.info('Started GPS tracking')
  }

  /**
   * Stop tracking
   */
  stopTracking() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
      this.isTracking = false
      logger.info('Stopped GPS tracking')
    }
  }

  /**
   * Update driver location in database
   * @param {string} driverId - Driver ID
   * @param {Object} location - Location data
   * @returns {Promise<Object>} Result
   */
  async updateDriverLocation(driverId, location) {
    try {
      const { error } = await supabase
        .from('driver_locations')
        .upsert({
          driver_id: driverId,
          latitude: location.lat,
          longitude: location.lng,
          is_available: true,
          last_updated: new Date().toISOString(),
        })

      if (error) throw error

      return { success: true }
    } catch (error) {
      logger.error('Update driver location error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Get current position once
   * @returns {Promise<Object>} Position
   */
  getCurrentPosition() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          })
        },
        (error) => {
          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      )
    })
  }

  /**
   * Calculate distance from current position to target
   * @param {Object} target - { lat, lng }
   * @returns {Promise<number>} Distance in km
   */
  async getDistanceTo(target) {
    const position = await this.getCurrentPosition()
    return calculateDistance(
      position.latitude,
      position.longitude,
      target.lat,
      target.lng
    )
  }
}

// Singleton instance
export const gpsTrackingService = new GPSTrackingService()

/**
 * React Hook for GPS tracking
 * @param {string} driverId - Driver ID
 * @param {Object} options - Options
 * @returns {Object} Tracking state and controls
 */
export const useGPSTracking = (driverId, options = {}) => {
  const [isTracking, setIsTracking] = useState(false)
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const trackingRef = useRef(false)

  const startTracking = useCallback(async () => {
    if (!driverId || trackingRef.current) return

    try {
      await gpsTrackingService.startTracking(driverId, {
        ...options,
        onUpdate: (pos) => {
          setPosition(pos)
          options.onUpdate?.(pos)
        },
      })

      trackingRef.current = true
      setIsTracking(true)
      setError(null)
      toast.success('تم تفعيل تتبع الموقع')
    } catch (err) {
      setError(err.message)
      toast.error('فشل في تفعيل التتبع')
    }
  }, [driverId, options])

  const stopTracking = useCallback(() => {
    gpsTrackingService.stopTracking()
    trackingRef.current = false
    setIsTracking(false)
    toast.info('تم إيقاف التتبع')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (trackingRef.current) {
        gpsTrackingService.stopTracking()
      }
    }
  }, [])

  return {
    isTracking,
    position,
    error,
    startTracking,
    stopTracking,
  }
}

/**
 * React Hook to get current location
 * @returns {Object} Location state
 */
export const useCurrentLocation = (_options = {}) => {
  const [location, setLocation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const getLocation = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const position = await gpsTrackingService.getCurrentPosition()
      setLocation({
        lat: position.latitude,
        lng: position.longitude,
        accuracy: position.accuracy,
      })
    } catch (err) {
      setError(err.message)
      toast.error('فشل في تحديد الموقع')
    } finally {
      setLoading(false)
    }
  }, [])

  return { location, loading, error, getLocation }
}

export default gpsTrackingService
