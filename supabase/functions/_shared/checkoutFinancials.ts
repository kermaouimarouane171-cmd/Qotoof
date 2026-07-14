export const STORE_TYPE_RULES = [
  {
    storeType: 'small',
    minProducts: 0,
    maxProducts: 10,
    defaultDeliveryOption: 'self',
  },
  {
    storeType: 'medium',
    minProducts: 11,
    maxProducts: 50,
    defaultDeliveryOption: 'self',
  },
  {
    storeType: 'enterprise',
    minProducts: 51,
    maxProducts: null,
    defaultDeliveryOption: 'find_driver',
  },
] as const

const DEFAULT_BASE_PRICE = 12.0
const DEFAULT_PRICE_PER_KM = 1.6
const DEFAULT_MIN_PRICE = 10.0
const DEFAULT_MAX_PRICE = 60.0
const DEFAULT_MAX_DISTANCE_KM = 35.0
const INCLUDED_DISTANCE_KM = 3.0

export const toAmount = (value: unknown) => Number(Number(value || 0).toFixed(2))

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const normalizeBasePrice = (basePrice: unknown, pricingSource: string) => {
  const numericBasePrice = Number(basePrice || DEFAULT_BASE_PRICE)
  const maxBasePrice = pricingSource === 'driver' ? 18 : 14
  return toAmount(clamp(numericBasePrice, 8, maxBasePrice))
}

const normalizePricePerKm = (pricePerKm: unknown, pricingSource: string) => {
  const numericPricePerKm = Number(pricePerKm || DEFAULT_PRICE_PER_KM)
  const maxPricePerKm = pricingSource === 'driver' ? 2.5 : 2.0
  return toAmount(clamp(numericPricePerKm, 0.8, maxPricePerKm))
}

const getDistanceBandCap = (distanceKm: number | null, maxDistanceKm: number) => {
  if (distanceKm === null || distanceKm === undefined) return DEFAULT_MAX_PRICE
  if (distanceKm <= 5) return 18
  if (distanceKm <= 10) return 25
  if (distanceKm <= 20) return 35
  if (distanceKm <= 30) return 45
  if (distanceKm <= Math.min(maxDistanceKm || 50, 50)) return 60
  return 75
}

const calculateTieredDistanceFee = (distanceKm: number | null, pricePerKm: number) => {
  if (!distanceKm || distanceKm <= 0) return 0

  const billableDistanceKm = Math.max(distanceKm - INCLUDED_DISTANCE_KM, 0)
  const firstTierKm = Math.min(billableDistanceKm, 7)
  const secondTierKm = Math.min(Math.max(billableDistanceKm - 7, 0), 10)
  const thirdTierKm = Math.max(billableDistanceKm - 17, 0)

  return toAmount(
    (firstTierKm * pricePerKm * 0.85) +
    (secondTierKm * pricePerKm * 0.55) +
    (thirdTierKm * pricePerKm * 0.35)
  )
}

export const buildShippingQuote = ({
  distanceKm = null,
  basePrice = DEFAULT_BASE_PRICE,
  pricePerKm = DEFAULT_PRICE_PER_KM,
  minPrice = DEFAULT_MIN_PRICE,
  maxPrice = DEFAULT_MAX_PRICE,
  maxDistanceKm = DEFAULT_MAX_DISTANCE_KM,
  pricingSource = 'default',
  timeMultiplier = 1.0,
}: {
  distanceKm?: number | null
  basePrice?: unknown
  pricePerKm?: unknown
  minPrice?: unknown
  maxPrice?: unknown
  maxDistanceKm?: unknown
  pricingSource?: string
  timeMultiplier?: number
}) => {
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
  const normalizedMinPrice = toAmount(clamp(Number(minPrice || DEFAULT_MIN_PRICE), 8, 18))
  const effectiveMaxPrice = toAmount(
    Math.max(
      normalizedMinPrice,
      Math.min(Number(maxPrice || DEFAULT_MAX_PRICE), getDistanceBandCap(distanceKm, normalizedMaxDistanceKm))
    )
  )
  const distanceFee = calculateTieredDistanceFee(distanceKm, normalizedPricePerKm)

  let shippingCost = (normalizedBasePrice + distanceFee) * Number(timeMultiplier || 1)
  shippingCost = toAmount(Math.max(normalizedMinPrice, Math.min(effectiveMaxPrice, shippingCost)))

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

export const calculateDistance = (lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) {
    return null
  }

  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return Number((R * c).toFixed(2))
}

export const getTimeMultiplier = (date = new Date()) => {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const currentTime = hours * 60 + minutes

  if (currentTime >= 12 * 60 && currentTime <= 14 * 60) {
    return 1.1
  }

  if (currentTime >= 20 * 60 || currentTime <= 6 * 60) {
    return 1.05
  }

  return 1.0
}

export const getEstimatedDeliveryTime = (distanceKm: number | null) => {
  if (!distanceKm || distanceKm <= 5) return '30-45 min'
  if (distanceKm <= 15) return '45-60 min'
  if (distanceKm <= 30) return '1-1.5 hours'
  return '1.5-2 hours'
}

export const normalizeCoupon = (coupon: Record<string, unknown> = {}) => ({
  ...coupon,
  applies_to: coupon.applies_to || 'order',
  minimum_quantity: Number(coupon.minimum_quantity || 0),
  min_order_amount: Number(coupon.min_order_amount || 0),
  max_uses_per_user: coupon.max_uses_per_user == null ? null : Number(coupon.max_uses_per_user),
  starts_at: coupon.starts_at || coupon.created_at || null,
  metadata: coupon.metadata || {},
})

export const isCouponCurrentlyActive = (coupon: Record<string, unknown>, now = new Date()) => {
  const normalized = normalizeCoupon(coupon)
  const currentDate = new Date(now)

  if (normalized.is_active === false) return false
  if (normalized.starts_at && new Date(String(normalized.starts_at)) > currentDate) return false
  if (normalized.expires_at && new Date(String(normalized.expires_at)) < currentDate) return false

  return true
}

export const calculateCouponDiscountAmount = ({
  coupon,
  subtotal,
}: {
  coupon: Record<string, unknown>
  subtotal: number
}) => {
  const normalized = normalizeCoupon(coupon)
  const orderSubtotal = Number(subtotal || 0)

  if (!normalized || orderSubtotal <= 0) return 0
  if (!isCouponCurrentlyActive(normalized)) return 0
  if (Number(normalized.min_order_amount || 0) && orderSubtotal < Number(normalized.min_order_amount || 0)) return 0

  if (normalized.discount_type === 'percentage') {
    return toAmount(orderSubtotal * (Number(normalized.discount_value || 0) / 100))
  }

  return toAmount(Math.min(Number(normalized.discount_value || 0), orderSubtotal))
}

export const calculateBulkDiscountBreakdown = ({
  coupons = [],
  items = [],
  now = new Date(),
}: {
  coupons?: Array<Record<string, unknown>>
  items?: Array<Record<string, unknown>>
  now?: Date
}) => {
  const vendorBuckets = items.reduce<Record<string, { subtotal: number; quantity: number }>>((accumulator, item) => {
    const vendorId = String(item.vendor_id || '')
    if (!vendorId) return accumulator

    if (!accumulator[vendorId]) {
      accumulator[vendorId] = {
        subtotal: 0,
        quantity: 0,
      }
    }

    accumulator[vendorId].subtotal += Number(item.price_per_unit || item.price || 0) * Number(item.quantity || 0)
    accumulator[vendorId].quantity += Number(item.quantity || 0)
    return accumulator
  }, {})

  const offersByVendor: Record<string, { coupon: Record<string, unknown>; discountAmount: number; subtotal: number; quantity: number }> = {}
  let totalDiscount = 0

  Object.entries(vendorBuckets).forEach(([vendorId, bucket]) => {
    const eligibleOffers = coupons
      .map(normalizeCoupon)
      .filter((coupon) => String(coupon.vendor_id || '') === vendorId)
      .filter((coupon) => coupon.applies_to === 'bulk')
      .filter((coupon) => isCouponCurrentlyActive(coupon, now))
      .filter((coupon) => !Number(coupon.minimum_quantity || 0) || bucket.quantity >= Number(coupon.minimum_quantity || 0))
      .filter((coupon) => !Number(coupon.min_order_amount || 0) || bucket.subtotal >= Number(coupon.min_order_amount || 0))
      .map((coupon) => ({
        coupon,
        discountAmount: calculateCouponDiscountAmount({
          coupon,
          subtotal: bucket.subtotal,
        }),
      }))
      .filter((entry) => entry.discountAmount > 0)
      .sort((left, right) => right.discountAmount - left.discountAmount)

    const bestOffer = eligibleOffers[0]
    if (!bestOffer) return

    offersByVendor[vendorId] = {
      coupon: bestOffer.coupon,
      discountAmount: bestOffer.discountAmount,
      subtotal: toAmount(bucket.subtotal),
      quantity: bucket.quantity,
    }
    totalDiscount += bestOffer.discountAmount
  })

  return {
    totalDiscount: toAmount(totalDiscount),
    offersByVendor,
  }
}

export const buildVendorCartBuckets = (items: Array<Record<string, unknown>> = []) => {
  const buckets = new Map<string, {
    vendorId: string
    vendorName: string
    subtotal: number
    itemCount: number
    items: Array<Record<string, unknown>>
  }>()

  items.forEach((item) => {
    const vendorId = String(item.vendor_id || 'unknown')
    const existing = buckets.get(vendorId) || {
      vendorId,
      vendorName: String(item.vendor_name || item.store_name || 'Vendor'),
      subtotal: 0,
      itemCount: 0,
      items: [],
    }

    existing.subtotal += Number(item.price_per_unit || item.price || 0) * Number(item.quantity || 0)
    existing.itemCount += 1
    existing.items.push(item)
    buckets.set(vendorId, existing)
  })

  return Array.from(buckets.values())
}

export const evaluateVendorMinimumOrders = ({
  items = [],
  vendorProfiles = [],
}: {
  items?: Array<Record<string, unknown>>
  vendorProfiles?: Array<Record<string, unknown>>
}) => {
  const profileMap = new Map(vendorProfiles.map((profile) => [String(profile.id), profile]))
  const vendors = buildVendorCartBuckets(items).map((bucket) => {
    const profile = profileMap.get(bucket.vendorId)
    const minOrderAmount = Number(profile?.min_order_amount || 0)
    const shortfall = Math.max(minOrderAmount - bucket.subtotal, 0)

    return {
      ...bucket,
      vendorName: String(profile?.store_name || bucket.vendorName),
      minOrderAmount,
      shortfall,
      meetsMinimum: minOrderAmount <= 0 || shortfall === 0,
    }
  })

  const violations = vendors.filter((vendor) => !vendor.meetsMinimum)

  return {
    vendors,
    violations,
    hasViolations: violations.length > 0,
    firstViolation: violations[0] || null,
  }
}

export const getStoreTypeRule = (storeType: string | null, activeProductsCount = 0) => {
  if (storeType) {
    const explicitRule = STORE_TYPE_RULES.find((rule) => rule.storeType === storeType)
    if (explicitRule) return explicitRule
  }

  return STORE_TYPE_RULES.find((rule) => {
    const matchesMin = activeProductsCount >= rule.minProducts
    const matchesMax = rule.maxProducts === null || activeProductsCount <= rule.maxProducts
    return matchesMin && matchesMax
  }) || STORE_TYPE_RULES[0]
}

export const decorateStoreProfile = (profile: Record<string, unknown> | null) => {
  if (!profile) return null

  const activeProductsCount = Number(profile.active_products_count || 0)
  const rule = getStoreTypeRule(String(profile.store_type || ''), activeProductsCount)
  const currentDeliveryOption = String(profile.delivery_option || '') || rule.defaultDeliveryOption
  const hasLinkedOwnDriver = Boolean(profile.preferred_driver_id && profile.partnership_status === 'accepted')

  return {
    ...profile,
    storeType: rule.storeType,
    deliveryOption: currentDeliveryOption,
    activeProductsCount,
    hasLinkedOwnDriver,
  }
}

export const resolveOrderDeliveryStrategy = (rawProfile: Record<string, unknown> | null, selectedDriverId: string | null = null) => {
  const profile = decorateStoreProfile(rawProfile)
  const hasLinkedOwnDriver = Boolean(profile?.hasLinkedOwnDriver)

  if (!profile) {
    return {
      deliveryOption: 'self',
      assignedDriverId: null,
      preferredDriverId: null,
      initialOrderStatus: 'pending',
      createDeliveryOnAcceptance: false,
      blocked: false,
      blockedMessage: null,
    }
  }

  if (profile.deliveryOption === 'self') {
    return {
      deliveryOption: 'self',
      assignedDriverId: null,
      preferredDriverId: null,
      initialOrderStatus: 'pending',
      createDeliveryOnAcceptance: false,
      blocked: false,
      blockedMessage: null,
    }
  }

  if (profile.deliveryOption === 'find_driver') {
    return {
      deliveryOption: 'find_driver',
      assignedDriverId: selectedDriverId || null,
      preferredDriverId: null,
      initialOrderStatus: selectedDriverId ? 'pending' : 'awaiting_driver',
      createDeliveryOnAcceptance: true,
      blocked: false,
      blockedMessage: null,
    }
  }

  return {
    deliveryOption: 'own_driver',
    assignedDriverId: hasLinkedOwnDriver ? String(profile.preferred_driver_id || '') : null,
    preferredDriverId: hasLinkedOwnDriver ? String(profile.preferred_driver_id || '') : null,
    initialOrderStatus: 'pending',
    createDeliveryOnAcceptance: true,
    blocked: !hasLinkedOwnDriver,
    blockedMessage: !hasLinkedOwnDriver
      ? 'هذا الخيار يتطلب سائقاً مرتبطاً ومقبول الشراكة قبل قبول الطلبات.'
      : null,
  }
}

export const resolveAvailablePaymentTypes = ({
  vendorPolicies = [],
  codEligibility,
}: {
  vendorPolicies?: Array<Record<string, unknown>>
  codEligibility?: { eligible?: boolean } | null
}) => {
  if (!vendorPolicies.length) {
    return {
      full: true,
      split: true,
      cod: Boolean(codEligibility?.eligible),
      vendorCodSupported: true,
      codBlockedByTrust: !codEligibility?.eligible,
      hasAny: true,
    }
  }

  const full = vendorPolicies.every((vendor) => Boolean(vendor.full))
  const split = vendorPolicies.every((vendor) => Boolean(vendor.split))
  const vendorCodSupported = vendorPolicies.every((vendor) => Boolean(vendor.cod))
  const cod = vendorCodSupported && Boolean(codEligibility?.eligible)

  return {
    full,
    split,
    cod,
    vendorCodSupported,
    codBlockedByTrust: vendorCodSupported && !codEligibility?.eligible,
    hasAny: full || split || cod,
  }
}

export const buildPaymentPlan = ({
  paymentType,
  payableAmount,
  paymentMethod = 'bank',
}: {
  paymentType: string
  payableAmount: number
  paymentMethod?: string
}) => {
  const totalAmount = toAmount(payableAmount)
  const validMethods = ['paypal', 'bank', 'stripe']
  const selectedMethod = validMethods.includes(paymentMethod) ? paymentMethod : 'bank'

  if (paymentType === 'split') {
    const firstPaymentAmount = toAmount(totalAmount / 2)
    return {
      paymentType: 'split',
      paymentMethod: selectedMethod,
      firstPaymentAmount,
      firstPaymentStatus: 'pending',
      secondPaymentAmount: toAmount(totalAmount - firstPaymentAmount),
      secondPaymentStatus: 'pending',
      secondPaymentDueAt: null,
    }
  }

  if (paymentType === 'cod') {
    return {
      paymentType: 'cod',
      paymentMethod: 'cod',
      firstPaymentAmount: 0,
      firstPaymentStatus: 'verified',
      secondPaymentAmount: totalAmount,
      secondPaymentStatus: 'pending',
      secondPaymentDueAt: null,
    }
  }

  return {
    paymentType: 'full',
    paymentMethod: selectedMethod,
    firstPaymentAmount: totalAmount,
    firstPaymentStatus: 'pending',
    secondPaymentAmount: 0,
    secondPaymentStatus: 'verified',
    secondPaymentDueAt: null,
  }
}