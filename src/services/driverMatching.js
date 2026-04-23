import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'

/**
 * Geographic Driver Matching Service
 * Finds nearest drivers using 3-tier search:
 * 1. Same city (0-30 km)
 * 2. Same region (30-150 km)
 * 3. Neighboring regions (150-300 km)
 */
class DriverMatchingService {
  constructor() {
    // Moroccan regions data (fallback if DB not available)
    this.regions = [
      { id: '1', name_ar: 'طنجة-تطوان-الحسيمة', center_lat: 35.7595, center_lng: -5.8340, radius_km: 120 },
      { id: '2', name_ar: 'الشرق', center_lat: 34.6814, center_lng: -1.9086, radius_km: 150 },
      { id: '3', name_ar: 'فاس-مكناس', center_lat: 34.0331, center_lng: -5.0003, radius_km: 130 },
      { id: '4', name_ar: 'الرباط-سلا-القنيطرة', center_lat: 34.0209, center_lng: -6.8416, radius_km: 100 },
      { id: '5', name_ar: 'بني ملال-خنيفرة', center_lat: 32.3373, center_lng: -6.3498, radius_km: 120 },
      { id: '6', name_ar: 'الدار البيضاء-سطات', center_lat: 33.5731, center_lng: -7.5898, radius_km: 100 },
      { id: '7', name_ar: 'مراكش-آسفي', center_lat: 31.6295, center_lng: -7.9811, radius_km: 130 },
      { id: '8', name_ar: 'درعة-تافيلالت', center_lat: 31.5085, center_lng: -5.1256, radius_km: 180 },
      { id: '9', name_ar: 'سوس-ماسة', center_lat: 30.4278, center_lng: -9.5981, radius_km: 140 },
      { id: '10', name_ar: 'كلميم-واد نون', center_lat: 28.9833, center_lng: -10.0567, radius_km: 160 },
      { id: '11', name_ar: 'العيون-الساقية الحمراء', center_lat: 27.1253, center_lng: -13.1625, radius_km: 200 },
      { id: '12', name_ar: 'الداخلة-وادي الذهب', center_lat: 23.7151, center_lng: -15.9520, radius_km: 250 },
    ]

    // Neighboring regions mapping
    this.neighboringRegions = {
      '1': ['2', '3', '4'],  // طنجة neighbors
      '2': ['1', '3'],        // الشرق neighbors
      '3': ['1', '2', '4', '5'], // فاس neighbors
      '4': ['1', '3', '6'],   // الرباط neighbors
      '5': ['3', '4', '6', '7'], // بني ملال neighbors
      '6': ['4', '5', '7'],   // الدار البيضاء neighbors
      '7': ['5', '6', '8', '9'], // مراكش neighbors
      '8': ['3', '7', '9'],   // درعة neighbors
      '9': ['7', '8', '10'],  // سوس neighbors
      '10': ['9'],            // كلميم neighbors
      '11': [],               // العيون (remote)
      '12': [],               // الداخلة (remote)
    }
  }

  /**
   * Calculate distance using Haversine formula
   * @param {number} lat1 - Latitude 1
   * @param {number} lng1 - Longitude 1
   * @param {number} lat2 - Latitude 2
   * @param {number} lng2 - Longitude 2
   * @returns {number} Distance in km
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371 // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  /**
   * Get region from coordinates
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Object} Region info
   */
  getRegionFromCoords(lat, lng) {
    let nearestRegion = null
    let minDistance = Infinity

    for (const region of this.regions) {
      const distance = this.calculateDistance(lat, lng, region.center_lat, region.center_lng)
      if (distance < region.radius_km && distance < minDistance) {
        minDistance = distance
        nearestRegion = { ...region, distance }
      }
    }

    return nearestRegion
  }

  /**
   * Check if two regions are neighbors
   * @param {string} regionId1 - Region 1 ID
   * @param {string} regionId2 - Region 2 ID
   * @returns {boolean}
   */
  areRegionsNeighbors(regionId1, regionId2) {
    const neighbors = this.neighboringRegions[regionId1] || []
    return neighbors.includes(regionId2)
  }

  /**
   * Find nearest drivers using 3-tier search
   * @param {Object} pickupLocation - { lat, lng, city, regionId }
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async findNearestDrivers(pickupLocation, options = {}) {
    const {
      maxDistance = 300,
      limit = 10,
      includeUnavailable = false,
    } = options

    try {
      // Try database function first
      const { data: drivers, error } = await supabase.rpc('find_nearest_drivers', {
        p_pickup_lat: pickupLocation.lat,
        p_pickup_lng: pickupLocation.lng,
        p_max_distance_km: maxDistance,
        p_limit: limit,
      })

      if (!error && drivers) {
        return {
          success: true,
          drivers: drivers.map(d => ({
            ...d,
            tier: d.is_in_same_region ? 1 : d.is_in_neighboring_region ? 2 : 3,
            tierName: d.is_in_same_region ? 'نفس الجهة' : d.is_in_neighboring_region ? 'جهة مجاورة' : 'جهة بعيدة',
          })),
          searchMethod: 'database',
        }
      }

      // Fallback to client-side calculation
      return await this.findDriversClientSide(pickupLocation, options)
    } catch (error) {
      logger.error('Find nearest drivers error:', error)
      return { success: false, error: error.message, drivers: [] }
    }
  }

  /**
   * Client-side driver search (fallback)
   */
  async findDriversClientSide(pickupLocation, options) {
    const { maxDistance = 300, limit = 10 } = options

    // Get all available drivers
    const { data: driverLocations, error } = await supabase
      .from('driver_locations')
      .select(`
        *,
        driver:profiles(id, first_name, last_name, phone, rating)
      `)
      .eq('is_available', true)

    if (error || !driverLocations) {
      return { success: false, error: error?.message, drivers: [] }
    }

    // Get pickup region
    const pickupRegion = this.getRegionFromCoords(pickupLocation.lat, pickupLocation.lng)

    // Calculate distances and sort
    const driversWithDistance = driverLocations
      .map(driver => {
        const distance = this.calculateDistance(
          pickupLocation.lat,
          pickupLocation.lng,
          driver.latitude,
          driver.longitude
        )

        const driverRegion = this.regions.find(r => r.id === driver.region_id)
        const isSameRegion = driver.region_id === pickupRegion?.id
        const isNeighboringRegion = this.areRegionsNeighbors(pickupRegion?.id, driver.region_id)

        return {
          driver_id: driver.driver_id,
          driver_name: `${driver.driver?.first_name} ${driver.driver?.last_name}`,
          city: driver.city,
          region_id: driver.region_id,
          region_name: driverRegion?.name_ar,
          distance_km: Math.round(distance * 100) / 100,
          estimated_hours: Math.round((distance / 60) * 100) / 100,
          service_radius_km: driver.service_radius_km,
          is_in_same_region: isSameRegion,
          is_in_neighboring_region: isNeighboringRegion,
          tier: isSameRegion ? 1 : isNeighboringRegion ? 2 : 3,
          tierName: isSameRegion ? 'نفس الجهة' : isNeighboringRegion ? 'جهة مجاورة' : 'جهة بعيدة',
          phone: driver.driver?.phone,
          rating: driver.driver?.rating,
        }
      })
      .filter(d => d.distance_km <= maxDistance)
      .sort((a, b) => {
        // Sort by tier first, then distance
        if (a.tier !== b.tier) return a.tier - b.tier
        return a.distance_km - b.distance_km
      })
      .slice(0, limit)

    return {
      success: true,
      drivers: driversWithDistance,
      searchMethod: 'client',
    }
  }

  /**
   * Check driver availability in a region
   * @param {string} regionId - Region ID
   * @returns {Promise<Object>} Availability info
   */
  async checkRegionAvailability(regionId) {
    try {
      // Try database function
      const { data, error } = await supabase.rpc('check_driver_availability_in_region', {
        p_region_id: regionId,
      })

      if (!error && data) {
        return {
          hasDrivers: data.has_drivers,
          availableCount: data.available_count,
          nearestCity: data.nearest_city,
          searchMethod: 'database',
        }
      }

      // Fallback
      const { data: drivers, error: driversError } = await supabase
        .from('driver_locations')
        .select('city')
        .eq('region_id', regionId)
        .eq('is_available', true)

      if (driversError) throw driversError

      return {
        hasDrivers: drivers?.length > 0,
        availableCount: drivers?.length || 0,
        nearestCity: drivers?.[0]?.city,
        searchMethod: 'client',
      }
    } catch (error) {
      logger.error('Check region availability error:', error)
      return { hasDrivers: false, availableCount: 0, error: error.message }
    }
  }

  /**
   * Create delivery request with automatic driver matching
   * @param {Object} deliveryInfo - Delivery information
   * @returns {Promise<Object>} Result with driver info
   */
  async createDeliveryRequest(deliveryInfo) {
    const {
      orderId,
      vendorId,
      buyerId,
      pickupCity,
      pickupLat,
      pickupLng,
      deliveryCity,
      deliveryLat,
      deliveryLng,
    } = deliveryInfo

    try {
      // Try database function
      const { data, error } = await supabase.rpc('create_delivery_request', {
        p_order_id: orderId,
        p_vendor_id: vendorId,
        p_buyer_id: buyerId,
        p_pickup_city: pickupCity,
        p_pickup_lat: pickupLat,
        p_pickup_lng: pickupLng,
        p_delivery_city: deliveryCity,
        p_delivery_lat: deliveryLat,
        p_delivery_lng: deliveryLng,
      })

      if (!error && data) {
        return {
          success: true,
          deliveryId: data.delivery_id,
          driverFound: data.driver_found,
          driver: data.driver,
          fee: data.fee,
          distanceKm: data.distance_km,
          estimatedHours: data.estimated_hours,
          searchMethod: 'database',
        }
      }

      // Fallback to client-side
      return await this.createDeliveryRequestClientSide(deliveryInfo)
    } catch (error) {
      logger.error('Create delivery request error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Client-side delivery request creation (fallback)
   */
  async createDeliveryRequestClientSide(deliveryInfo) {
    const {
      orderId,
      vendorId,
      buyerId,
      pickupCity,
      pickupLat,
      pickupLng,
      deliveryCity,
      deliveryLat,
      deliveryLng,
    } = deliveryInfo

    // Find nearest drivers
    const { drivers } = await this.findNearestDrivers(
      { lat: pickupLat, lng: pickupLng },
      { limit: 1 }
    )

    const nearestDriver = drivers?.[0]
    const distance = this.calculateDistance(pickupLat, pickupLng, deliveryLat, deliveryLng)
    const isSameRegion = nearestDriver?.is_in_same_region ?? false

    // Calculate fee
    const fee = this.calculateDeliveryFee(distance, isSameRegion)

    // Save to database
    const { data: delivery, error } = await supabase
      .from('delivery_requests')
      .insert({
        order_id: orderId,
        vendor_id: vendorId,
        buyer_id: buyerId,
        pickup_city: pickupCity,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        delivery_city: deliveryCity,
        delivery_lat: deliveryLat,
        delivery_lng: deliveryLng,
        distance_km: distance,
        estimated_hours: distance / 60,
        assigned_driver_id: nearestDriver?.driver_id,
        driver_region_id: nearestDriver?.region_id,
        driver_distance_from_pickup_km: nearestDriver?.distance_km,
        base_fee: fee.base_fee,
        distance_fee: fee.distance_fee,
        total_fee: fee.total_fee,
        no_driver_available: !nearestDriver,
        status: nearestDriver ? 'assigned' : 'pending',
      })
      .select()
      .single()

    if (error) throw error

    return {
      success: true,
      deliveryId: delivery.id,
      driverFound: !!nearestDriver,
      driver: nearestDriver ? {
        id: nearestDriver.driver_id,
        name: nearestDriver.driver_name,
        city: nearestDriver.city,
        region: nearestDriver.region_name,
        distance_km: nearestDriver.distance_km,
      } : null,
      fee,
      distanceKm: Math.round(distance * 100) / 100,
      estimatedHours: Math.round((distance / 60) * 100) / 100,
      searchMethod: 'client',
    }
  }

  /**
   * Calculate delivery fee based on distance
   * @param {number} distanceKm - Distance in km
   * @param {boolean} sameRegion - Same region flag
   * @returns {Object} Fee breakdown
   */
  calculateDeliveryFee(distanceKm, sameRegion = true) {
    let baseFee, perKm, tier

    if (sameRegion) {
      if (distanceKm <= 30) {
        baseFee = 20
        perKm = 1.0
        tier = 'local'
      } else if (distanceKm <= 100) {
        baseFee = 40
        perKm = 1.5
        tier = 'regional'
      } else {
        baseFee = 80
        perKm = 2.0
        tier = 'long_distance'
      }
    } else {
      if (distanceKm <= 100) {
        baseFee = 60
        perKm = 2.0
        tier = 'inter_region_short'
      } else if (distanceKm <= 300) {
        baseFee = 100
        perKm = 2.5
        tier = 'inter_region_medium'
      } else {
        baseFee = 150
        perKm = 3.0
        tier = 'inter_region_long'
      }
    }

    const distanceFee = distanceKm * perKm
    const totalFee = baseFee + distanceFee

    return {
      base_fee: Math.round(baseFee * 100) / 100,
      per_km: perKm,
      distance_km: Math.round(distanceKm * 100) / 100,
      distance_fee: Math.round(distanceFee * 100) / 100,
      total_fee: Math.round(totalFee * 100) / 100,
      tier,
      currency: 'MAD',
    }
  }

  /**
   * Get no-driver message for buyer
   * @param {Object} pickupLocation - Pickup location
   * @param {Object} nearestDriver - Nearest driver info
   * @returns {Object} Message object
   */
  getNoDriverMessage(pickupLocation, nearestDriver = null) {
    const region = this.getRegionFromCoords(pickupLocation.lat, pickupLocation.lng)

    if (nearestDriver) {
      return {
        status: 'driver_from_other_region',
        title: 'سائق من جهة أخرى',
        message: `لا يوجد سائق في ${region?.name_ar || 'جهتك'}، لكن وجدنا سائق في ${nearestDriver.city}`,
        driver: nearestDriver,
        extraFee: nearestDriver.distance_km * 2,
        suggestions: [
          'قبول السائق من الجهة الأخرى (رسوم إضافية)',
          'الانتظار حتى يتوفر سائق في جهتك',
          'استلام الطلب بنفسك',
        ],
      }
    }

    return {
      status: 'no_driver_available',
      title: 'لا يوجد سائق متاح',
      message: `عذراً، لا يوجد سائق متاح في ${region?.name_ar || 'جهتك'} حالياً`,
      region: region?.name_ar,
      suggestions: [
        'أعلمنا عند توفر سائق في جهتك',
        'اختر نقطة استلام في مدينة قريبة',
        'تواصل مع البائع لترتيب التوصيل',
      ],
    }
  }

  /**
   * Update driver location
   * @param {string} driverId - Driver ID
   * @param {Object} location - { lat, lng }
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
   * Set driver availability
   * @param {string} driverId - Driver ID
   * @param {boolean} available - Availability status
   * @returns {Promise<Object>} Result
   */
  async setDriverAvailability(driverId, available) {
    try {
      const { error } = await supabase
        .from('driver_locations')
        .update({ is_available: available })
        .eq('driver_id', driverId)

      if (error) throw error

      return { success: true }
    } catch (error) {
      logger.error('Set driver availability error:', error)
      return { success: false, error: error.message }
    }
  }
}

// Singleton instance
export const driverMatchingService = new DriverMatchingService()

// React hooks
import { useState, useCallback, useEffect } from 'react'

/**
 * Hook to find nearest drivers
 */
export const useNearestDrivers = (pickupLocation, options = {}) => {
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const search = useCallback(async () => {
    if (!pickupLocation?.lat || !pickupLocation?.lng) return

    setLoading(true)
    setError(null)

    try {
      const result = await driverMatchingService.findNearestDrivers(pickupLocation, options)
      if (result.success) {
        setDrivers(result.drivers)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [pickupLocation, options])

  useEffect(() => {
    search()
  }, [search])

  return { drivers, loading, error, refresh: search }
}

/**
 * Hook to check region availability
 */
export const useRegionAvailability = (regionId) => {
  const [availability, setAvailability] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!regionId) return

    const check = async () => {
      setLoading(true)
      const result = await driverMatchingService.checkRegionAvailability(regionId)
      setAvailability(result)
      setLoading(false)
    }

    check()
  }, [regionId])

  return { availability, loading }
}

export default driverMatchingService
