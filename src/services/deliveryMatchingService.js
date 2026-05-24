/*
 * MIGRATION PLAN: consolidate legacy driverMatching.js into deliveryMatchingService.js
 *
 * Scope note:
 * - `src/services/driverMatching.js` does not exist in the current branch workspace.
 * - Analysis below references the legacy file found in:
 *   `greenmarket.worktrees/origin-main-check/src/services/driverMatching.js`.
 *
 * 1) Exported functions inventory
 *
 * A. Legacy driverMatching.js exports
 * - named: `driverMatchingService` (singleton instance)
 * - named: `useNearestDrivers(pickupLocation, options)`
 * - named: `useRegionAvailability(regionId)`
 * - default: `driverMatchingService`
 *
 * Class methods exposed via `driverMatchingService` instance:
 * - `calculateDistance(lat1, lng1, lat2, lng2)`
 * - `getRegionFromCoords(lat, lng)`
 * - `areRegionsNeighbors(regionId1, regionId2)`
 * - `findNearestDrivers(pickupLocation, options)`
 * - `findDriversClientSide(pickupLocation, options)`
 * - `checkRegionAvailability(regionId)`
 * - `createDeliveryRequest(deliveryInfo)`
 * - `createDeliveryRequestClientSide(deliveryInfo)`
 * - `calculateDeliveryFee(distanceKm, sameRegion)` [tiered breakdown]
 * - `getNoDriverMessage(pickupLocation, nearestDriver)`
 * - `updateDriverLocation(driverId, location)`
 * - `setDriverAvailability(driverId, available)`
 *
 * B. Current deliveryMatchingService.js exports
 * - constants: `CARGO_SIZE_OPTIONS`, `DRIVER_DELIVERY_PAYMENT_OPTIONS`, `DRIVER_SELECT`
 * - matching/config helpers:
 *   `normalizeCargoSize`, `normalizeDriverDeliveryPaymentMethod`,
 *   `getCargoSizeLabel`, `getDriverDeliveryPaymentMethodLabel`,
 *   `normalizeDriverPreferences`, `driverSupportsPaymentMethod`,
 *   `getDriverSupportedPaymentMethods`, `doesDriverMatchDelivery`
 * - query/matching functions:
 *   `getAvailableDriversForCheckout`, `getMatchingDeliveriesForDriver`,
 *   `isDriverEligibleForOrder`
 * - geo/fee functions:
 *   `calculateDistance`, `calculateDeliveryFee` [env-based simple fee],
 *   `getRegionFromCoords`, `calculateTieredDeliveryFee`,
 *   `findNearestDrivers`, `createDeliveryRequest`
 * - default object: `deliveryMatchingService`
 *
 * 2) Caller mapping in codebase
 *
 * A. Current branch callers of deliveryMatchingService.js
 * - `src/pages/driver/Available.jsx`
 *   uses default `deliveryMatchingService.getMatchingDeliveriesForDriver`
 * - `src/pages/CheckoutSimplified.jsx`
 *   uses default `deliveryMatchingService.getAvailableDriversForCheckout`
 *   uses named `DRIVER_SELECT`, `getDriverSupportedPaymentMethods`
 * - `src/services/gpsTracking.js`
 *   uses named `calculateDistance`
 * - `src/components/ui/DriverSelection.jsx`
 *   uses named `getCargoSizeLabel`, `getDriverDeliveryPaymentMethodLabel`,
 *   `normalizeDriverPreferences`
 * - `src/components/ui/GeographicDeliveryNotification.jsx`
 *   uses named `findNearestDrivers`, `calculateDistance`,
 *   `calculateTieredDeliveryFee`, `createDeliveryRequest`, `getRegionFromCoords`
 * - `src/components/checkout/OrderSummary.jsx`
 *   uses named `getCargoSizeLabel`, `getDriverDeliveryPaymentMethodLabel`
 * - `src/components/driver/DeliveryPreferences.jsx`
 *   uses named `CARGO_SIZE_OPTIONS`, `getCargoSizeLabel`
 *
 * B. Legacy callers of driverMatching.js (origin-main-check)
 * - `src/services/gpsTracking.js`
 *   used `driverMatchingService.calculateDistance`
 * - `src/components/ui/GeographicDeliveryNotification.jsx`
 *   used `driverMatchingService.findNearestDrivers`, `calculateDistance`,
 *   `calculateDeliveryFee`, `createDeliveryRequest`, `getRegionFromCoords`
 *
 * 3) Unique logic in each file
 *
 * A. Legacy-only logic (not yet present as equivalent public API here)
 * - region availability API + fallback:
 *   `checkRegionAvailability(regionId)`
 * - no-driver UX message composer:
 *   `getNoDriverMessage(pickupLocation, nearestDriver)`
 * - driver location/availability mutators on `driver_locations`:
 *   `updateDriverLocation(driverId, location)`,
 *   `setDriverAvailability(driverId, available)`
 * - React hooks co-located in service file:
 *   `useNearestDrivers`, `useRegionAvailability`
 *
 * B. Current-only logic in deliveryMatchingService.js
 * - checkout/order compatibility checks based on cargo/payment/distance:
 *   `doesDriverMatchDelivery`, `isDriverEligibleForOrder`
 * - payment method + cargo normalization/labels:
 *   `normalize*`, `get*Label`, `driverSupportsPaymentMethod`,
 *   `getDriverSupportedPaymentMethods`
 * - checkout and driver-dashboard specific queries:
 *   `getAvailableDriversForCheckout`, `getMatchingDeliveriesForDriver`
 * - dual fee APIs:
 *   `calculateDeliveryFee` (env-based simple) and
 *   `calculateTieredDeliveryFee` (geo tier breakdown)
 *
 * 4) Migration execution plan (do not merge yet)
 *
 * Step 1: Keep deliveryMatchingService.js as the canonical module.
 * - No changes required for current callers already importing this file.
 * - Any reintroduced/legacy references to `@/services/driverMatching` should
 *   be redirected to this file.
 *
 * Step 2: Functions from driverMatching.js to migrate/alias here
 * - Add compatible exports (or wrappers) for:
 *   `checkRegionAvailability`, `getNoDriverMessage`,
 *   `updateDriverLocation`, `setDriverAvailability`.
 * - Optionally provide a compatibility named export:
 *   `export const driverMatchingService = deliveryMatchingService`
 *   for low-risk import-path migration.
 *
 * Step 3: Preserve 3-tier geographic fallback behavior
 * - Keep DB-first flow in `findNearestDrivers`:
 *   RPC `find_nearest_drivers` -> map tier from DB flags.
 * - Keep client fallback path over `driver_locations` with:
 *   tier assignment by region relation (same/neighbor/far),
 *   distance filter, then sort by `(tier ASC, distance_km ASC)`.
 * - Keep/create centralized region datasets (`MOROCCAN_REGIONS`,
 *   `NEIGHBORING_REGIONS`) and ensure both nearest-driver search and
 *   fee calculation consume the same region/tier semantics.
 *
 * Step 4: Caller updates required when removing legacy module
 * - Legacy-only import sites to change (if/when present):
 *   `src/services/gpsTracking.js`:
 *   `driverMatchingService.calculateDistance` -> `calculateDistance` import.
 *   `src/components/ui/GeographicDeliveryNotification.jsx`:
 *   instance calls -> named imports from this module.
 * - Current branch already uses new named imports in both files, so no
 *   immediate caller edits are required in this branch.
 *
 * Step 5: Safety checks before final merge
 * - Add tests around tier ordering and fallback behavior:
 *   RPC success path vs. fallback path should produce same tier ranking rules.
 * - Verify UI compatibility where old API returned `{ success, ... }` objects.
 * - Verify no remaining `@/services/driverMatching` imports.
 */

import { supabase } from '@/services/supabase'
import { calculateDistance as calculateGeoDistance } from '@/services/shippingCalculator'
import { logger } from '@/utils/logger'

export const CARGO_SIZE_OPTIONS = [
  { value: 'small', label: 'حمولة صغيرة' },
  { value: 'medium', label: 'حمولة متوسطة' },
  { value: 'large', label: 'حمولة كبيرة' },
]

export const DRIVER_DELIVERY_PAYMENT_OPTIONS = [
  { value: 'cash', label: 'نقداً عند التسليم' },
  { value: 'bank_transfer', label: 'تحويل بنكي للسائق' },
]

export const DRIVER_SELECT = `
  id,
  first_name,
  last_name,
  phone,
  city,
  latitude,
  longitude,
  vehicle_type,
  rating,
  is_available_for_delivery,
  min_delivery_distance_km,
  max_delivery_distance_km,
  accepted_cargo_sizes,
  driver_delivery_payment_cash,
  driver_delivery_payment_transfer,
  driver_delivery_payment_notes
`

const toNumber = (value, fallback = 0) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

const normalizeLocation = (location = {}) => ({
  lat: toNumber(location?.lat ?? location?.latitude, null),
  lng: toNumber(location?.lng ?? location?.longitude ?? location?.lon, null),
})

const hasCoordinates = (location = {}) => Number.isFinite(location.lat) && Number.isFinite(location.lng)

export const normalizeCargoSize = (cargoSize) => {
  const normalizedValue = String(cargoSize || 'medium').trim().toLowerCase()
  return CARGO_SIZE_OPTIONS.some((option) => option.value === normalizedValue) ? normalizedValue : 'medium'
}

export const normalizeDriverDeliveryPaymentMethod = (method) => {
  if (!method) return 'cash'
  const normalizedValue = String(method).trim().toLowerCase()
  if (normalizedValue === 'transfer') return 'bank_transfer'
  return DRIVER_DELIVERY_PAYMENT_OPTIONS.some((option) => option.value === normalizedValue)
    ? normalizedValue
    : 'cash'
}

export const getCargoSizeLabel = (cargoSize) => {
  const normalizedCargoSize = normalizeCargoSize(cargoSize)
  return CARGO_SIZE_OPTIONS.find((option) => option.value === normalizedCargoSize)?.label || 'حمولة متوسطة'
}

export const getDriverDeliveryPaymentMethodLabel = (method) => {
  const normalizedMethod = normalizeDriverDeliveryPaymentMethod(method)
  return DRIVER_DELIVERY_PAYMENT_OPTIONS.find((option) => option.value === normalizedMethod)?.label || 'نقداً عند التسليم'
}

export const normalizeDriverPreferences = (profile = {}) => ({
  minDeliveryDistanceKm: Math.max(toNumber(profile.min_delivery_distance_km, 0), 0),
  maxDeliveryDistanceKm: Math.max(toNumber(profile.max_delivery_distance_km, 50), 0),
  acceptedCargoSizes: Array.isArray(profile.accepted_cargo_sizes) && profile.accepted_cargo_sizes.length > 0
    ? profile.accepted_cargo_sizes.map((cargoSize) => normalizeCargoSize(cargoSize))
    : ['small', 'medium'],
  driverDeliveryPaymentCash: profile.driver_delivery_payment_cash !== false,
  driverDeliveryPaymentTransfer: Boolean(profile.driver_delivery_payment_transfer),
  driverDeliveryPaymentNotes: profile.driver_delivery_payment_notes || '',
})

export const driverSupportsPaymentMethod = (driver, method) => {
  const normalizedMethod = normalizeDriverDeliveryPaymentMethod(method)
  const preferences = normalizeDriverPreferences(driver)

  if (normalizedMethod === 'bank_transfer') {
    return preferences.driverDeliveryPaymentTransfer
  }

  return preferences.driverDeliveryPaymentCash
}

export const getDriverSupportedPaymentMethods = (driver) => {
  const preferences = normalizeDriverPreferences(driver)
  return DRIVER_DELIVERY_PAYMENT_OPTIONS
    .filter((option) => option.value === 'cash'
      ? preferences.driverDeliveryPaymentCash
      : preferences.driverDeliveryPaymentTransfer)
    .map((option) => option.value)
}

const calculateRouteDistance = ({ vendorLocation, deliveryLocation, deliveryDistanceKm = null }) => {
  const distanceSnapshot = toNumber(deliveryDistanceKm, null)
  if (Number.isFinite(distanceSnapshot) && distanceSnapshot >= 0) {
    return Number(distanceSnapshot.toFixed(2))
  }

  const normalizedVendorLocation = normalizeLocation(vendorLocation)
  const normalizedDeliveryLocation = normalizeLocation(deliveryLocation)

  if (!hasCoordinates(normalizedVendorLocation) || !hasCoordinates(normalizedDeliveryLocation)) {
    return null
  }

  const calculatedDistance = calculateGeoDistance(
    normalizedVendorLocation.lat,
    normalizedVendorLocation.lng,
    normalizedDeliveryLocation.lat,
    normalizedDeliveryLocation.lng
  )

  return Number.isFinite(calculatedDistance) ? Number(calculatedDistance.toFixed(2)) : null
}

const calculateDriverPickupDistance = ({ driver, vendorLocation }) => {
  const normalizedDriverLocation = normalizeLocation(driver)
  const normalizedVendorLocation = normalizeLocation(vendorLocation)

  if (!hasCoordinates(normalizedDriverLocation) || !hasCoordinates(normalizedVendorLocation)) {
    return null
  }

  const calculatedDistance = calculateGeoDistance(
    normalizedDriverLocation.lat,
    normalizedDriverLocation.lng,
    normalizedVendorLocation.lat,
    normalizedVendorLocation.lng
  )

  return Number.isFinite(calculatedDistance) ? Number(calculatedDistance.toFixed(2)) : null
}

export const doesDriverMatchDelivery = ({
  driver,
  cargoSize,
  deliveryPaymentMethod,
  vendorLocation,
  deliveryLocation,
  deliveryDistanceKm,
}) => {
  const preferences = normalizeDriverPreferences(driver)
  const normalizedCargoSize = normalizeCargoSize(cargoSize)
  const normalizedDeliveryPaymentMethod = normalizeDriverDeliveryPaymentMethod(deliveryPaymentMethod)
  const routeDistanceKm = calculateRouteDistance({
    vendorLocation,
    deliveryLocation,
    deliveryDistanceKm,
  })

  const reasons = []

  if (driver?.is_available_for_delivery === false) {
    reasons.push('السائق غير متاح حالياً')
  }

  if (!preferences.acceptedCargoSizes.includes(normalizedCargoSize)) {
    reasons.push(`السائق لا يقبل ${getCargoSizeLabel(normalizedCargoSize)}`)
  }

  if (!driverSupportsPaymentMethod(driver, normalizedDeliveryPaymentMethod)) {
    reasons.push(`السائق لا يقبل ${getDriverDeliveryPaymentMethodLabel(normalizedDeliveryPaymentMethod)}`)
  }

  if (routeDistanceKm !== null && routeDistanceKm < preferences.minDeliveryDistanceKm) {
    reasons.push(`المسافة أقل من الحد الأدنى ${preferences.minDeliveryDistanceKm} كم`)
  }

  if (routeDistanceKm !== null && routeDistanceKm > preferences.maxDeliveryDistanceKm) {
    reasons.push(`المسافة تتجاوز الحد الأقصى ${preferences.maxDeliveryDistanceKm} كم`)
  }

  return {
    matches: reasons.length === 0,
    routeDistanceKm,
    pickupDistanceKm: calculateDriverPickupDistance({ driver, vendorLocation }),
    preferences,
    reasons,
  }
}

const attachDriverMatchMeta = ({ driver, cargoSize, deliveryPaymentMethod, vendorLocation, deliveryLocation, deliveryDistanceKm }) => {
  const matchResult = doesDriverMatchDelivery({
    driver,
    cargoSize,
    deliveryPaymentMethod,
    vendorLocation,
    deliveryLocation,
    deliveryDistanceKm,
  })

  return {
    ...driver,
    route_distance_km: matchResult.routeDistanceKm,
    pickup_distance_km: matchResult.pickupDistanceKm,
    accepted_cargo_sizes: matchResult.preferences.acceptedCargoSizes,
    driver_delivery_payment_cash: matchResult.preferences.driverDeliveryPaymentCash,
    driver_delivery_payment_transfer: matchResult.preferences.driverDeliveryPaymentTransfer,
    driver_delivery_payment_notes: matchResult.preferences.driverDeliveryPaymentNotes,
    matching_reasons: matchResult.reasons,
    matches_delivery: matchResult.matches,
  }
}

export const getAvailableDriversForCheckout = async ({
  vendorLocation,
  deliveryLocation,
  cargoSize = 'medium',
  deliveryPaymentMethod = 'cash',
}) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(DRIVER_SELECT)
    .eq('role', 'driver')
    .eq('is_available_for_delivery', true)

  if (error) {
    logger.error('Failed to load drivers for checkout matching:', error)
    throw error
  }

  return (data || [])
    .map((driver) => attachDriverMatchMeta({
      driver,
      cargoSize,
      deliveryPaymentMethod,
      vendorLocation,
      deliveryLocation,
    }))
    .filter((driver) => driver.matches_delivery)
    .sort((leftDriver, rightDriver) => {
      const leftPickupDistance = toNumber(leftDriver.pickup_distance_km, Number.MAX_SAFE_INTEGER)
      const rightPickupDistance = toNumber(rightDriver.pickup_distance_km, Number.MAX_SAFE_INTEGER)
      if (leftPickupDistance !== rightPickupDistance) {
        return leftPickupDistance - rightPickupDistance
      }

      return toNumber(rightDriver.rating, 0) - toNumber(leftDriver.rating, 0)
    })
}

export const getMatchingDeliveriesForDriver = async (driverId) => {
  if (!driverId) return []

  const { data: driver, error: driverError } = await supabase
    .from('profiles')
    .select(DRIVER_SELECT)
    .eq('id', driverId)
    .maybeSingle()

  if (driverError) {
    logger.error('Failed to load driver preferences:', driverError)
    throw driverError
  }

  if (!driver) return []

  const { data: deliveries, error: deliveriesError } = await supabase
    .from('deliveries')
    .select(`
      id,
      order_id,
      driver_id,
      status,
      created_at,
      assigned_at,
      pickup_address,
      pickup_latitude,
      pickup_longitude,
      delivery_address,
      delivery_latitude,
      delivery_longitude,
      cargo_size,
      delivery_distance_km,
      order:orders(
        id,
        order_number,
        total,
        shipping_cost,
        shipping_city,
        shipping_address,
        shipping_latitude,
        shipping_longitude,
        cargo_size,
        delivery_distance_km,
        driver_delivery_payment_method,
        delivery_fee_total,
        vendor_product_total,
        buyer:profiles!buyer_id(id, first_name, last_name, phone),
        vendor:profiles!vendor_id(id, store_name, phone, city, latitude, longitude)
      )
    `)
    .in('status', ['unassigned', 'assigned'])
    .or(`driver_id.is.null,driver_id.eq.${driverId}`)
    .order('created_at', { ascending: false })

  if (deliveriesError) {
    logger.error('Failed to load deliveries for driver matching:', deliveriesError)
    throw deliveriesError
  }

  return (deliveries || [])
    .map((delivery) => {
      const vendor = delivery.order?.vendor || {}
      const deliveryLocation = {
        lat: delivery.delivery_latitude ?? delivery.order?.shipping_latitude,
        lng: delivery.delivery_longitude ?? delivery.order?.shipping_longitude,
      }
      const vendorLocation = {
        lat: delivery.pickup_latitude ?? vendor.latitude,
        lng: delivery.pickup_longitude ?? vendor.longitude,
      }
      const matchResult = doesDriverMatchDelivery({
        driver,
        cargoSize: delivery.cargo_size || delivery.order?.cargo_size,
        deliveryPaymentMethod: delivery.order?.driver_delivery_payment_method,
        vendorLocation,
        deliveryLocation,
        deliveryDistanceKm: delivery.delivery_distance_km ?? delivery.order?.delivery_distance_km,
      })
      const assignedToCurrentDriver = delivery.driver_id === driverId

      return {
        ...delivery,
        assigned_to_current_driver: assignedToCurrentDriver,
        route_distance_km: matchResult.routeDistanceKm,
        pickup_distance_km: matchResult.pickupDistanceKm,
        matching_reasons: matchResult.reasons,
        matches_delivery: assignedToCurrentDriver || matchResult.matches,
      }
    })
    .filter((delivery) => delivery.matches_delivery)
    .sort((leftDelivery, rightDelivery) => {
      if (leftDelivery.assigned_to_current_driver !== rightDelivery.assigned_to_current_driver) {
        return leftDelivery.assigned_to_current_driver ? -1 : 1
      }

      return toNumber(leftDelivery.route_distance_km, Number.MAX_SAFE_INTEGER) - toNumber(rightDelivery.route_distance_km, Number.MAX_SAFE_INTEGER)
    })
}

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  return calculateGeoDistance(lat1, lon1, lat2, lon2)
}

export const calculateDeliveryFee = (distanceKm) => {
  const BASE_FEE = parseFloat(import.meta.env.VITE_DELIVERY_BASE_FEE || '10')
  const PER_KM = parseFloat(import.meta.env.VITE_DELIVERY_PER_KM_FEE || '5')
  return parseFloat((BASE_FEE + (distanceKm * PER_KM)).toFixed(2))
}

export const isDriverEligibleForOrder = async (driverId, orderId) => {
  if (!driverId || !orderId) return false

  const { data: driver, error: driverError } = await supabase
    .from('profiles')
    .select(DRIVER_SELECT)
    .eq('id', driverId)
    .maybeSingle()

  if (driverError) throw driverError
  if (!driver) return false

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select(`
      id,
      cargo_size,
      delivery_distance_km,
      driver_delivery_payment_method,
      shipping_latitude,
      shipping_longitude,
      vendor:profiles!vendor_id(id, latitude, longitude)
    `)
    .eq('id', orderId)
    .maybeSingle()

  if (orderError) throw orderError
  if (!order) return false

  const match = doesDriverMatchDelivery({
    driver,
    cargoSize: order.cargo_size,
    deliveryPaymentMethod: order.driver_delivery_payment_method,
    vendorLocation: {
      lat: order.vendor?.latitude,
      lng: order.vendor?.longitude,
    },
    deliveryLocation: {
      lat: order.shipping_latitude,
      lng: order.shipping_longitude,
    },
    deliveryDistanceKm: order.delivery_distance_km,
  })

  return match.matches
}

// ─────────────────────────────────────────────────────────────────────────────
// Geographic driver search (migrated from driverMatching.js)
// ─────────────────────────────────────────────────────────────────────────────

const MOROCCAN_REGIONS = [
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

const NEIGHBORING_REGIONS = {
  '1': ['2', '3', '4'],
  '2': ['1', '3'],
  '3': ['1', '2', '4', '5'],
  '4': ['1', '3', '6'],
  '5': ['3', '4', '6', '7'],
  '6': ['4', '5', '7'],
  '7': ['5', '6', '8', '9'],
  '8': ['3', '7', '9'],
  '9': ['7', '8', '10'],
  '10': ['9'],
  '11': [],
  '12': [],
}

/**
 * Get Moroccan region from coordinates (fallback data).
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {{ id, name_ar, center_lat, center_lng, radius_km, distance } | null}
 */
export const getRegionFromCoords = (lat, lng) => {
  let nearestRegion = null
  let minDistance = Infinity

  for (const region of MOROCCAN_REGIONS) {
    const dist = calculateDistance(lat, lng, region.center_lat, region.center_lng)
    if (dist < region.radius_km && dist < minDistance) {
      minDistance = dist
      nearestRegion = { ...region, distance: dist }
    }
  }
  return nearestRegion
}

/**
 * Tiered delivery fee calculation based on region and distance.
 * Returns a detailed breakdown object (unlike the simple calculateDeliveryFee above).
 *
 * @param {number} distanceKm
 * @param {boolean} sameRegion
 * @returns {{ base_fee, per_km, distance_km, distance_fee, total_fee, tier, currency }}
 */
export const calculateTieredDeliveryFee = (distanceKm, sameRegion = true) => {
  let baseFee, perKm, tier

  if (sameRegion) {
    if (distanceKm <= 30) { baseFee = 20; perKm = 1.0; tier = 'local' }
    else if (distanceKm <= 100) { baseFee = 40; perKm = 1.5; tier = 'regional' }
    else { baseFee = 80; perKm = 2.0; tier = 'long_distance' }
  } else {
    if (distanceKm <= 100) { baseFee = 60; perKm = 2.0; tier = 'inter_region_short' }
    else if (distanceKm <= 300) { baseFee = 100; perKm = 2.5; tier = 'inter_region_medium' }
    else { baseFee = 150; perKm = 3.0; tier = 'inter_region_long' }
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

const getAvailableDriversWithFallback = async (pickupLocation, options = {}) => {
  const { maxDistance = 300, limit = 10 } = options

  const mapDriverWithTier = (driver) => ({
    ...driver,
    tier: driver.is_in_same_region ? 1 : driver.is_in_neighboring_region ? 2 : 3,
    tierName: driver.is_in_same_region ? 'نفس الجهة' : driver.is_in_neighboring_region ? 'جهة مجاورة' : 'جهة بعيدة',
  })

  const { data: rpcDrivers, error: rpcError } = await supabase.rpc('find_nearest_drivers', {
    p_pickup_lat: pickupLocation.lat,
    p_pickup_lng: pickupLocation.lng,
    p_max_distance_km: maxDistance,
    p_limit: limit,
  })

  if (!rpcError && Array.isArray(rpcDrivers) && rpcDrivers.length > 0) {
    return {
      drivers: rpcDrivers.map(mapDriverWithTier),
      searchMethod: 'database',
    }
  }

  const { data: driverLocations, error: locErr } = await supabase
    .from('driver_locations')
    .select('*, driver:profiles(id, first_name, last_name, phone, rating)')
    .eq('is_available', true)

  if (locErr) {
    throw locErr
  }

  const pickupRegion = getRegionFromCoords(pickupLocation.lat, pickupLocation.lng)

  const driversWithDistance = (driverLocations || [])
    .map(dl => {
      const dist = calculateDistance(pickupLocation.lat, pickupLocation.lng, dl.latitude, dl.longitude)
      const isSameRegion = !!pickupRegion && dl.region_id === pickupRegion.id
      const isNeighboringRegion = !isSameRegion &&
        (NEIGHBORING_REGIONS[pickupRegion?.id] ?? []).includes(dl.region_id)
      const driverRegion = MOROCCAN_REGIONS.find(r => r.id === dl.region_id)
      return {
        driver_id: dl.driver_id,
        driver_name: `${dl.driver?.first_name ?? ''} ${dl.driver?.last_name ?? ''}`.trim(),
        city: dl.city,
        region_id: dl.region_id,
        region_name: driverRegion?.name_ar,
        distance_km: Math.round(dist * 100) / 100,
        estimated_hours: Math.round((dist / 60) * 100) / 100,
        service_radius_km: dl.service_radius_km,
        is_in_same_region: isSameRegion,
        is_in_neighboring_region: isNeighboringRegion,
        tier: isSameRegion ? 1 : isNeighboringRegion ? 2 : 3,
        tierName: isSameRegion ? 'نفس الجهة' : isNeighboringRegion ? 'جهة مجاورة' : 'جهة بعيدة',
        phone: dl.driver?.phone,
        rating: dl.driver?.rating,
      }
    })
    .filter(d => d.distance_km <= maxDistance)
    .sort((a, b) => a.tier !== b.tier ? a.tier - b.tier : a.distance_km - b.distance_km)
    .slice(0, limit)

  return {
    drivers: driversWithDistance,
    searchMethod: 'client',
  }
}

/**
 * Find nearest available drivers using DB RPC with client-side fallback.
 * Migrated from driverMatching.js (DriverMatchingService.findNearestDrivers).
 *
 * @param {{ lat: number, lng: number }} pickupLocation
 * @param {{ maxDistance?: number, limit?: number }} options
 * @returns {Promise<{ success: boolean, drivers: Array, searchMethod: string }>}
 */
export const findNearestDrivers = async (pickupLocation, options = {}) => {
  try {
    const { drivers, searchMethod } = await getAvailableDriversWithFallback(pickupLocation, options)
    return { success: true, drivers, searchMethod }
  } catch (err) {
    return { success: false, error: err.message, drivers: [] }
  }
}

/**
 * Create a delivery request via DB RPC with client-side fallback.
 * Migrated from driverMatching.js (DriverMatchingService.createDeliveryRequest).
 *
 * @param {{ orderId, vendorId, buyerId, pickupCity, pickupLat, pickupLng, deliveryCity, deliveryLat, deliveryLng }} deliveryInfo
 */
export const createDeliveryRequest = async (deliveryInfo) => {
  const { orderId, vendorId, buyerId, pickupCity, pickupLat, pickupLng, deliveryCity, deliveryLat, deliveryLng } = deliveryInfo

  try {
    const { data, error } = await supabase.rpc('create_delivery_request', {
      p_order_id: orderId, p_vendor_id: vendorId, p_buyer_id: buyerId,
      p_pickup_city: pickupCity, p_pickup_lat: pickupLat, p_pickup_lng: pickupLng,
      p_delivery_city: deliveryCity, p_delivery_lat: deliveryLat, p_delivery_lng: deliveryLng,
    })

    if (!error && data) {
      return {
        success: true, deliveryId: data.delivery_id, driverFound: data.driver_found,
        driver: data.driver, fee: data.fee, distanceKm: data.distance_km,
        estimatedHours: data.estimated_hours, searchMethod: 'database',
      }
    }

    // Client-side fallback
    const { drivers } = await findNearestDrivers({ lat: pickupLat, lng: pickupLng }, { limit: 1 })
    const nearestDriver = drivers?.[0]
    const distance = calculateDistance(pickupLat, pickupLng, deliveryLat, deliveryLng)
    const fee = calculateTieredDeliveryFee(distance, nearestDriver?.is_in_same_region ?? false)

    const { data: delivery, error: insertError } = await supabase
      .from('delivery_requests')
      .insert({
        order_id: orderId, vendor_id: vendorId, buyer_id: buyerId,
        pickup_city: pickupCity, pickup_lat: pickupLat, pickup_lng: pickupLng,
        delivery_city: deliveryCity, delivery_lat: deliveryLat, delivery_lng: deliveryLng,
        distance_km: distance, estimated_hours: distance / 60,
        assigned_driver_id: nearestDriver?.driver_id,
        driver_region_id: nearestDriver?.region_id,
        driver_distance_from_pickup_km: nearestDriver?.distance_km,
        base_fee: fee.base_fee, distance_fee: fee.distance_fee, total_fee: fee.total_fee,
        no_driver_available: !nearestDriver,
        status: nearestDriver ? 'assigned' : 'pending',
      })
      .select()
      .single()

    if (insertError) throw insertError

    return {
      success: true, deliveryId: delivery.id, driverFound: !!nearestDriver,
      driver: nearestDriver ? {
        id: nearestDriver.driver_id, name: nearestDriver.driver_name,
        city: nearestDriver.city, region: nearestDriver.region_name,
        distance_km: nearestDriver.distance_km,
      } : null,
      fee, distanceKm: Math.round(distance * 100) / 100,
      searchMethod: 'client',
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

const deliveryMatchingService = {
  calculateDeliveryFee,
  calculateTieredDeliveryFee,
  calculateDistance,
  findNearestDrivers,
  doesDriverMatchDelivery,
  driverSupportsPaymentMethod,
  getDriverSupportedPaymentMethods,
  getAvailableDriversForCheckout,
  getCargoSizeLabel,
  getDriverDeliveryPaymentMethodLabel,
  isDriverEligibleForOrder,
  getMatchingDeliveriesForDriver,
  normalizeCargoSize,
  normalizeDriverDeliveryPaymentMethod,
  normalizeDriverPreferences,
}

export default deliveryMatchingService