import { supabase } from '@/services/supabase'
import { calculateDistance } from '@/services/shippingCalculator'
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

  const calculatedDistance = calculateDistance(
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

  const calculatedDistance = calculateDistance(
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

const deliveryMatchingService = {
  doesDriverMatchDelivery,
  driverSupportsPaymentMethod,
  getDriverSupportedPaymentMethods,
  getAvailableDriversForCheckout,
  getCargoSizeLabel,
  getDriverDeliveryPaymentMethodLabel,
  getMatchingDeliveriesForDriver,
  normalizeCargoSize,
  normalizeDriverDeliveryPaymentMethod,
  normalizeDriverPreferences,
}

export default deliveryMatchingService