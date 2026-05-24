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
const DEFAULT_BASE_PRICE = 12.0 // MAD
const DEFAULT_PRICE_PER_KM = 1.6 // MAD per km
const DEFAULT_MIN_PRICE = 10.0 // MAD
const DEFAULT_MAX_PRICE = 60.0 // MAD
const DEFAULT_MAX_DISTANCE_KM = 35.0
const INCLUDED_DISTANCE_KM = 3.0

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function roundCurrency(value) {
  return parseFloat(Number(value || 0).toFixed(2))
}

function normalizeBasePrice(basePrice, pricingSource) {
  const numericBasePrice = Number(basePrice || DEFAULT_BASE_PRICE)
  const maxBasePrice = pricingSource === 'driver' ? 18 : 14
  return roundCurrency(clamp(numericBasePrice, 8, maxBasePrice))
}

function normalizePricePerKm(pricePerKm, pricingSource) {
  const numericPricePerKm = Number(pricePerKm || DEFAULT_PRICE_PER_KM)
  const maxPricePerKm = pricingSource === 'driver' ? 2.5 : 2.0
  return roundCurrency(clamp(numericPricePerKm, 0.8, maxPricePerKm))
}

function getDistanceBandCap(distanceKm, maxDistanceKm) {
  if (distanceKm === null || distanceKm === undefined) return DEFAULT_MAX_PRICE
  if (distanceKm <= 5) return 18
  if (distanceKm <= 10) return 25
  if (distanceKm <= 20) return 35
  if (distanceKm <= 30) return 45
  if (distanceKm <= Math.min(maxDistanceKm || 50, 50)) return 60
  return 75
}

function calculateTieredDistanceFee(distanceKm, pricePerKm) {
  if (!distanceKm || distanceKm <= 0) return 0

  const billableDistanceKm = Math.max(distanceKm - INCLUDED_DISTANCE_KM, 0)
  const firstTierKm = Math.min(billableDistanceKm, 7)
  const secondTierKm = Math.min(Math.max(billableDistanceKm - 7, 0), 10)
  const thirdTierKm = Math.max(billableDistanceKm - 17, 0)

  return roundCurrency(
    (firstTierKm * pricePerKm * 0.85) +
    (secondTierKm * pricePerKm * 0.55) +
    (thirdTierKm * pricePerKm * 0.35)
  )
}

export function buildShippingQuote({
  distanceKm = null,
  basePrice = DEFAULT_BASE_PRICE,
  pricePerKm = DEFAULT_PRICE_PER_KM,
  minPrice = DEFAULT_MIN_PRICE,
  maxPrice = DEFAULT_MAX_PRICE,
  maxDistanceKm = DEFAULT_MAX_DISTANCE_KM,
  pricingSource = 'default',
  timeMultiplier = 1.0,
}) {
  const normalizedMaxDistanceKm = Number(maxDistanceKm || DEFAULT_MAX_DISTANCE_KM)

  if (distanceKm !== null && normalizedMaxDistanceKm > 0 && distanceKm > normalizedMaxDistanceKm) {
    return {
      available: false,
      cost: 0,
      maxDistanceKm: normalizedMaxDistanceKm,
      blockingReason: `التوصيل غير متاح لهذه المسافة حالياً. الحد الأقصى لهذه المنطقة هو ${normalizedMaxDistanceKm.toFixed(0)} كم.`,
      breakdown: {
        base: 0,
        distance: 0,
        timeMultiplier: null,
        includedDistanceKm: INCLUDED_DISTANCE_KM,
        capApplied: null,
      },
    }
  }

  const normalizedBasePrice = normalizeBasePrice(basePrice, pricingSource)
  const normalizedPricePerKm = normalizePricePerKm(pricePerKm, pricingSource)
  const normalizedMinPrice = roundCurrency(clamp(Number(minPrice || DEFAULT_MIN_PRICE), 8, 18))
  const effectiveMaxPrice = roundCurrency(
    Math.max(
      normalizedMinPrice,
      Math.min(Number(maxPrice || DEFAULT_MAX_PRICE), getDistanceBandCap(distanceKm, normalizedMaxDistanceKm))
    )
  )
  const distanceFee = calculateTieredDistanceFee(distanceKm, normalizedPricePerKm)

  let shippingCost = (normalizedBasePrice + distanceFee) * Number(timeMultiplier || 1)
  shippingCost = roundCurrency(Math.max(normalizedMinPrice, Math.min(effectiveMaxPrice, shippingCost)))

  return {
    available: true,
    cost: shippingCost,
    basePrice: normalizedBasePrice,
    pricePerKm: normalizedPricePerKm,
    maxDistanceKm: normalizedMaxDistanceKm,
    breakdown: {
      base: normalizedBasePrice,
      distance: distanceFee,
      timeMultiplier: timeMultiplier > 1 ? Number(timeMultiplier.toFixed(2)) : null,
      includedDistanceKm: INCLUDED_DISTANCE_KM,
      capApplied: shippingCost === effectiveMaxPrice ? effectiveMaxPrice : null,
    },
  }
}

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
export function getTimeMultiplier(date = new Date()) {
  const now = date
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const currentTime = hours * 60 + minutes

  // Midday pressure: 12:00 - 14:00
  const rushStart = 12 * 60 // 720
  const rushEnd = 14 * 60 // 840

  // Late evening / early morning: 20:00 - 06:00
  const eveningStart = 20 * 60 // 1200
  const eveningEnd = 6 * 60 // 360 (next day)

  if (currentTime >= rushStart && currentTime <= rushEnd) {
    return 1.1
  }

  if (currentTime >= eveningStart || currentTime <= eveningEnd) {
    return 1.05
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
  vendorCity: _vendorCity,
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
  let maxDistanceKm = DEFAULT_MAX_DISTANCE_KM
  let timeMultiplier = 1.0
  let distance = null
  let zone = null
  let pricingSource = 'default' // 'default', 'zone', 'driver'

  // Step 1: Get delivery zone for buyer's city
  zone = await getDeliveryZone(buyerCity)

  if (zone) {
    basePrice = parseFloat(zone.base_price)
    pricePerKm = parseFloat(zone.price_per_km)
    maxDistanceKm = parseFloat(zone.max_distance_km || DEFAULT_MAX_DISTANCE_KM)
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
      maxDistanceKm = parseFloat(driverPricing.max_distance_km || maxDistanceKm)
      pricingSource = 'driver'
    }
  }

  // Step 3: Calculate distance if coordinates available
  if (vendorLat && vendorLon && buyerLat && buyerLon) {
    distance = calculateDistance(vendorLat, vendorLon, buyerLat, buyerLon)
  }

  // Step 4: Calculate time multiplier
  timeMultiplier = getTimeMultiplier()

  // Step 5: Calculate final cost using consumer-friendly distance tiers.
  const quote = buildShippingQuote({
    distanceKm: distance,
    basePrice,
    pricePerKm,
    minPrice,
    maxPrice,
    maxDistanceKm,
    pricingSource,
    timeMultiplier,
  })

  return {
    cost: quote.cost,
    distance,
    basePrice: quote.basePrice,
    pricePerKm: quote.pricePerKm,
    available: quote.available,
    maxDistanceKm,
    blockingReason: quote.blockingReason || null,
    timeMultiplier,
    pricingSource,
    zone: zone ? {
      name: zone.zone_name,
      code: zone.zone_code,
    } : null,
    breakdown: quote.breakdown,
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
