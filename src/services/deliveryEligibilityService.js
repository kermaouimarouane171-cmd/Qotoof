import { calculateDistance } from './shippingCalculator'
import { logger } from '../utils/logger.js'

/**
 * Delivery Eligibility Service
 * Prevents illogical orders (e.g. 2kg tomatoes from a vendor in another city)
 * with a flat 15 MAD shipping fee.
 *
 * Rules (soft / safe defaults — no DB migration required):
 * - Local zone (0–10 km):  min order 50 MAD
 * - Medium zone (10–30 km): min order 150 MAD
 * - Far zone (30–60 km):   min order 500 MAD, only if vendor supports intercity
 * - Too far (>60 km):      blocked
 *
 * Missing coordinates → allowed (graceful degrade) with a warning reason.
 */

const DEFAULT_POLICY = {
  localRadiusKm: 10,
  mediumRadiusKm: 30,
  farRadiusKm: 60,
  localMinimumOrder: 50,
  mediumMinimumOrder: 150,
  farMinimumOrder: 500,
  supportsIntercityDelivery: false,
}

function toNumber(value, fallback = null) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function normalizeLocation(input = {}) {
  if (!input || typeof input !== 'object') return null

  const lat = toNumber(input.lat ?? input.latitude ?? input.center_lat ?? input.shipping_latitude, null)
  const lng = toNumber(input.lng ?? input.longitude ?? input.center_lng ?? input.shipping_longitude ?? input.lon, null)

  if (lat === null || lng === null) return null
  return { lat, lng }
}

function resolveVendorPolicy(vendor = {}) {
  const rawMaxDistance = Array.isArray(vendor.max_delivery_distance_km)
    ? vendor.max_delivery_distance_km[0]
    : vendor.max_delivery_distance_km

  const rawMinOrder = Array.isArray(vendor.min_order_amount)
    ? vendor.min_order_amount[0]
    : vendor.min_order_amount

  return {
    localRadiusKm: toNumber(vendor.local_radius_km, DEFAULT_POLICY.localRadiusKm),
    mediumRadiusKm: toNumber(vendor.medium_radius_km, DEFAULT_POLICY.mediumRadiusKm),
    farRadiusKm: toNumber(rawMaxDistance, DEFAULT_POLICY.farRadiusKm),
    localMinimumOrder: toNumber(vendor.local_min_order, DEFAULT_POLICY.localMinimumOrder),
    mediumMinimumOrder: toNumber(vendor.medium_min_order, DEFAULT_POLICY.mediumMinimumOrder),
    farMinimumOrder: toNumber(rawMinOrder, DEFAULT_POLICY.farMinimumOrder),
    supportsIntercityDelivery: Boolean(vendor.supports_intercity_delivery || vendor.has_intercity_delivery),
  }
}

function getZone(distanceKm, policy) {
  if (distanceKm === null || distanceKm === undefined) return { zone: 'unknown', maxDistanceKm: policy.farRadiusKm }
  if (distanceKm <= policy.localRadiusKm) return { zone: 'local', maxDistanceKm: policy.localRadiusKm }
  if (distanceKm <= policy.mediumRadiusKm) return { zone: 'medium', maxDistanceKm: policy.mediumRadiusKm }
  if (distanceKm <= policy.farRadiusKm) return { zone: 'far', maxDistanceKm: policy.farRadiusKm }
  return { zone: 'too_far', maxDistanceKm: policy.farRadiusKm }
}

function getZoneMinimumOrder(zone, policy) {
  switch (zone) {
    case 'local': return policy.localMinimumOrder
    case 'medium': return policy.mediumMinimumOrder
    case 'far': return policy.farMinimumOrder
    default: return null
  }
}

/**
 * Check whether adding a product to the cart is delivery-eligible.
 *
 * @param {Object} params
 * @param {Object} params.buyerLocation   — { lat, lng } or { latitude, longitude }
 * @param {Object} params.vendorLocation  — { lat, lng } or { latitude, longitude }
 * @param {number} params.orderAmount     — product price × quantity (MAD)
 * @param {number} [params.orderWeightKg] — optional weight hint
 * @param {Object} [params.vendorPolicy]  — overrides from vendor profile
 * @returns {Object}
 *   { allowed: boolean, distanceKm: number|null, zone: string, reason: string|null,
 *     message: string|null, requiredMinimumOrder: number|null, deliveryFeeEstimate: number|null }
 */
export function checkDeliveryEligibility({
  buyerLocation,
  vendorLocation,
  orderAmount = 0,
  _orderWeightKg = null,
  vendorPolicy = null,
}) {
  const normalizedBuyer = normalizeLocation(buyerLocation)
  const normalizedVendor = normalizeLocation(vendorLocation)

  // Graceful degrade: missing location → allow but warn
  if (!normalizedBuyer || !normalizedVendor) {
    return {
      allowed: true,
      distanceKm: null,
      zone: 'unknown',
      reason: 'LOCATION_MISSING',
      message: 'سيتم التحقق من التوصيل بعد تحديد موقعك.',
      requiredMinimumOrder: null,
      deliveryFeeEstimate: null,
    }
  }

  let distanceKm = null
  try {
    distanceKm = calculateDistance(
      normalizedVendor.lat,
      normalizedVendor.lng,
      normalizedBuyer.lat,
      normalizedBuyer.lng
    )
  } catch (err) {
    logger.warn('Distance calculation failed in eligibility check:', err)
    return {
      allowed: true,
      distanceKm: null,
      zone: 'unknown',
      reason: 'LOCATION_MISSING',
      message: 'سيتم التحقق من التوصيل بعد تحديد موقعك.',
      requiredMinimumOrder: null,
      deliveryFeeEstimate: null,
    }
  }

  if (distanceKm === null || !Number.isFinite(distanceKm)) {
    return {
      allowed: true,
      distanceKm: null,
      zone: 'unknown',
      reason: 'LOCATION_MISSING',
      message: 'سيتم التحقق من التوصيل بعد تحديد موقعك.',
      requiredMinimumOrder: null,
      deliveryFeeEstimate: null,
    }
  }

  const policy = vendorPolicy ? resolveVendorPolicy(vendorPolicy) : DEFAULT_POLICY
  const { zone, maxDistanceKm } = getZone(distanceKm, policy)

  // Too far → blocked
  if (zone === 'too_far') {
    return {
      allowed: false,
      distanceKm,
      zone,
      reason: 'TOO_FAR',
      message: 'هذا البائع خارج نطاق التوصيل المتاح لموقعك.',
      requiredMinimumOrder: null,
      deliveryFeeEstimate: null,
    }
  }

  // Far zone without intercity support → blocked
  if (zone === 'far' && !policy.supportsIntercityDelivery) {
    return {
      allowed: false,
      distanceKm,
      zone,
      reason: 'NO_INTERCITY_SUPPORT',
      message: 'هذا البائع لا يدعم التوصيل بين المدن لموقعك.',
      requiredMinimumOrder: policy.farMinimumOrder,
      deliveryFeeEstimate: null,
    }
  }

  const requiredMinimumOrder = getZoneMinimumOrder(zone, policy)
  const numericOrderAmount = toNumber(orderAmount, 0)

  if (requiredMinimumOrder !== null && numericOrderAmount < requiredMinimumOrder) {
    return {
      allowed: false,
      distanceKm,
      zone,
      reason: 'MIN_ORDER_DISTANCE',
      message: `هذا الطلب لا يحقق الحد الأدنى للتوصيل إلى موقعك. الحد الأدنى المطلوب هو ${requiredMinimumOrder} MAD.`,
      requiredMinimumOrder,
      deliveryFeeEstimate: null,
    }
  }

  // Simple fee estimate (flat + per-km) for transparency
  const baseFee = 12
  const perKm = 1.6
  const estimatedFee = Math.round((baseFee + distanceKm * perKm) * 100) / 100

  return {
    allowed: true,
    distanceKm,
    zone,
    reason: null,
    message: null,
    requiredMinimumOrder: null,
    deliveryFeeEstimate: estimatedFee,
    maxDistanceKm,
  }
}
