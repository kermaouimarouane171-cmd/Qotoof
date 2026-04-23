import { supabase } from './supabase'
import { logger } from '../utils/logger.js'

/**
 * Shipping cost calculation service
 * Calculates delivery cost based on:
 * - City and delivery zone
 * - Distance from vendor to buyer
 * - Time of day (rush hour, evening)
 * - Driver pricing preferences
 */

// Default pricing if no zone/driver found
const DEFAULT_BASE_PRICE = 15.0 // MAD
const DEFAULT_PRICE_PER_KM = 2.0 // MAD per km
const DEFAULT_MIN_PRICE = 10.0 // MAD
const DEFAULT_MAX_PRICE = 200.0 // MAD

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Vendor latitude
 * @param {number} lon1 - Vendor longitude
 * @param {number} lat2 - Buyer latitude
 * @param {number} lon2 - Buyer longitude
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) {
    return null
  }

  const R = 6371 // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distance = R * c

  return parseFloat(distance.toFixed(2))
}

/**
 * Convert degrees to radians
 */
function toRad(degrees) {
  return degrees * Math.PI / 180
}

/**
 * Get delivery zone for a city
 * @param {string} city - City name
 * @returns {Object|null} Zone data or null
 */
export async function getDeliveryZone(city) {
  if (!city) return null

  try {
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('city', city)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      logger.error('Error fetching delivery zone:', error)
      return null
    }

    return data
  } catch (error) {
    logger.error('Error fetching delivery zone:', error)
    return null
  }
}

/**
 * Get driver pricing preferences
 * @param {string} driverId - Driver ID
 * @returns {Object|null} Driver pricing or null
 */
export async function getDriverPricing(driverId) {
  if (!driverId) return null

  try {
    const { data, error } = await supabase
      .from('driver_pricing')
      .select('*')
      .eq('driver_id', driverId)
      .maybeSingle()

    if (error) {
      logger.error('Error fetching driver pricing:', error)
      return null
    }

    return data
  } catch (error) {
    logger.error('Error fetching driver pricing:', error)
    return null
  }
}

/**
 * Calculate time-based multiplier
 * @returns {number} Multiplier (1.0, 1.3, 1.5, etc.)
 */
export function getTimeMultiplier() {
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const currentTime = hours * 60 + minutes

  // Rush hour: 12:00 - 14:00 (1.5x)
  const rushStart = 12 * 60 // 720
  const rushEnd = 14 * 60 // 840

  // Evening: 20:00 - 06:00 (1.3x)
  const eveningStart = 20 * 60 // 1200
  const eveningEnd = 6 * 60 // 360 (next day)

  if (currentTime >= rushStart && currentTime <= rushEnd) {
    return 1.5
  }

  if (currentTime >= eveningStart || currentTime <= eveningEnd) {
    return 1.3
  }

  return 1.0
}

/**
 * Calculate shipping cost for an order
 * @param {Object} params - Calculation parameters
 * @param {string} params.vendorCity - Vendor's city
 * @param {number} params.vendorLat - Vendor latitude
 * @param {number} params.vendorLon - Vendor longitude
 * @param {string} params.buyerCity - Buyer's city
 * @param {number} params.buyerLat - Buyer latitude
 * @param {number} params.buyerLon - Buyer longitude
 * @param {string} params.driverId - Selected driver ID (optional)
 * @returns {Promise<Object>} Shipping cost breakdown
 */
export async function calculateShippingCost({
  vendorCity,
  vendorLat,
  vendorLon,
  buyerCity,
  buyerLat,
  buyerLon,
  driverId = null,
}) {
  let basePrice = DEFAULT_BASE_PRICE
  let pricePerKm = DEFAULT_PRICE_PER_KM
  let minPrice = DEFAULT_MIN_PRICE
  let maxPrice = DEFAULT_MAX_PRICE
  let timeMultiplier = 1.0
  let distance = null
  let zone = null
  let pricingSource = 'default' // 'default', 'zone', 'driver'

  // Step 1: Get delivery zone for buyer's city
  zone = await getDeliveryZone(buyerCity)

  if (zone) {
    basePrice = parseFloat(zone.base_price)
    pricePerKm = parseFloat(zone.price_per_km)
    maxPrice = parseFloat(zone.max_distance_km > 50 ? 200 : zone.max_distance_km * 4)
    pricingSource = 'zone'
  }

  // Step 2: If driver selected, use their pricing
  if (driverId) {
    const driverPricing = await getDriverPricing(driverId)
    if (driverPricing && driverPricing.is_custom_pricing) {
      basePrice = parseFloat(driverPricing.base_price)
      pricePerKm = parseFloat(driverPricing.price_per_km)
      minPrice = parseFloat(driverPricing.min_price)
      maxPrice = parseFloat(driverPricing.max_price)
      pricingSource = 'driver'
    }
  }

  // Step 3: Calculate distance if coordinates available
  if (vendorLat && vendorLon && buyerLat && buyerLon) {
    distance = calculateDistance(vendorLat, vendorLon, buyerLat, buyerLon)
  }

  // Step 4: Calculate time multiplier
  timeMultiplier = getTimeMultiplier()

  // Step 5: Calculate final cost
  let shippingCost = basePrice

  if (distance !== null) {
    shippingCost += distance * pricePerKm
  }

  // Apply time multiplier
  shippingCost *= timeMultiplier

  // Apply min/max constraints
  shippingCost = Math.max(minPrice, Math.min(maxPrice, shippingCost))

  // Round to 2 decimal places
  shippingCost = parseFloat(shippingCost.toFixed(2))

  return {
    cost: shippingCost,
    distance,
    basePrice,
    pricePerKm,
    timeMultiplier,
    pricingSource,
    zone: zone ? {
      name: zone.zone_name,
      code: zone.zone_code,
    } : null,
    breakdown: {
      base: basePrice,
      distance: distance !== null ? parseFloat((distance * pricePerKm).toFixed(2)) : 0,
      timeMultiplier: timeMultiplier > 1 ? timeMultiplier : null,
    }
  }
}

/**
 * Get estimated delivery time based on distance
 * @param {number} distanceKm - Distance in kilometers
 * @returns {string} Estimated time range (e.g., "30-45 min")
 */
export function getEstimatedDeliveryTime(distanceKm) {
  if (!distanceKm || distanceKm <= 0) {
    return '30-45 min'
  }

  if (distanceKm <= 5) {
    return '30-45 min'
  } else if (distanceKm <= 15) {
    return '45-60 min'
  } else if (distanceKm <= 30) {
    return '1-1.5 hours'
  } else {
    return '1.5-2 hours'
  }
}

/**
 * Get all available delivery zones
 * @returns {Promise<Array>} List of delivery zones
 */
export async function getDeliveryZones() {
  try {
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('is_active', true)
      .order('city')

    if (error) {
      logger.error('Error fetching delivery zones:', error)
      return []
    }

    return data || []
  } catch (error) {
    logger.error('Error fetching delivery zones:', error)
    return []
  }
}

/**
 * Check if delivery is available for a city
 * @param {string} city - City name
 * @returns {Promise<boolean>}
 */
export async function isDeliveryAvailable(city) {
  if (!city) return false

  const zone = await getDeliveryZone(city)
  return zone !== null
}
