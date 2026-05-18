import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  buildPaymentPlan,
  buildShippingQuote,
  calculateBulkDiscountBreakdown,
  calculateCouponDiscountAmount,
  calculateDistance,
  decorateStoreProfile,
  evaluateVendorMinimumOrders,
  getEstimatedDeliveryTime,
  getTimeMultiplier,
  isCouponCurrentlyActive,
  normalizeCoupon,
  resolveAvailablePaymentTypes,
  resolveOrderDeliveryStrategy,
  toAmount,
} from './checkoutFinancials.ts'

type SupabaseClient = ReturnType<typeof createClient>

const DEFAULT_COMMISSION_RATE = 2.0

const buildDeliveryScheduleSnapshot = ({ requestedDate, slot }: { requestedDate: string | null; slot: Record<string, unknown> | null }) => {
  if (!slot || !requestedDate) return {}

  return {
    requested_date: requestedDate,
    slot_id: slot.id,
    slot_label: slot.slot_label,
    day_of_week: Number(slot.day_of_week),
    start_time: slot.start_time,
    end_time: slot.end_time,
    cutoff_hours: Number(slot.cutoff_hours || 0),
    max_orders: slot.max_orders == null ? null : Number(slot.max_orders),
  }
}

const getBuyerCodEligibility = async (supabase: SupabaseClient, userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('trust_score, completed_orders_count, failed_payments_count, cod_eligible, cod_restricted_until')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error

  const trustScore = Number(data?.trust_score ?? 100)
  const completedOrdersCount = Number(data?.completed_orders_count ?? 0)
  const restrictedUntilDate = data?.cod_restricted_until ? new Date(data.cod_restricted_until) : null
  const isRestricted = Boolean(restrictedUntilDate && restrictedUntilDate > new Date())
  const meetsCompletionRequirement = completedOrdersCount >= 3
  const meetsScoreRequirement = trustScore >= 70
  const eligibleByRules = meetsCompletionRequirement && meetsScoreRequirement && !isRestricted
  const eligible = eligibleByRules && (Boolean(data?.cod_eligible) || eligibleByRules)

  let reason = ''
  if (!meetsCompletionRequirement) {
    reason = 'الدفع عند الاستلام يتطلب 3 طلبات مكتملة على الأقل.'
  } else if (!meetsScoreRequirement) {
    reason = 'درجة الثقة الحالية أقل من الحد الأدنى المطلوب للدفع عند الاستلام.'
  } else if (isRestricted && restrictedUntilDate) {
    reason = `تم تقييد الدفع عند الاستلام حتى ${restrictedUntilDate.toLocaleDateString('ar-MA')}.`
  }

  return { eligible, reason }
}

const normalizeRequestedItems = (items: Array<Record<string, unknown>> = []) => {
  return items
    .map((item) => ({
      productId: String(item.productId || item.product_id || item.id || '').trim(),
      quantity: Number(item.quantity || 0),
    }))
    .filter((item) => item.productId && Number.isFinite(item.quantity) && item.quantity > 0)
}

const loadManualCoupon = async ({
  supabase,
  userId,
  couponCode,
  orderAmount,
  strict,
}: {
  supabase: SupabaseClient
  userId: string
  couponCode: string | null
  orderAmount: number
  strict: boolean
}) => {
  if (!couponCode) {
    return { coupon: null, couponError: null }
  }

  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('id, code, discount_type, discount_value, min_order_amount, minimum_quantity, applies_to, max_uses, max_uses_per_user, expires_at, starts_at, is_active, vendor_id, metadata')
    .eq('code', couponCode.toUpperCase())
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  if (!coupon) {
    if (strict) throw new Error('الكوبون غير موجود أو غير صالح')
    return { coupon: null, couponError: 'الكوبون غير موجود أو غير صالح' }
  }

  const normalizedCoupon = normalizeCoupon(coupon)
  const assignedUserId = normalizedCoupon.metadata?.assigned_user_id || null
  if (assignedUserId && assignedUserId !== userId) {
    if (strict) throw new Error('هذا الكوبون مرتبط بحساب آخر')
    return { coupon: null, couponError: 'هذا الكوبون مرتبط بحساب آخر' }
  }

  if (normalizedCoupon.applies_to === 'bulk') {
    if (strict) throw new Error('هذا العرض يطبق تلقائياً على الكميات ولا يحتاج إلى إدخال يدوي.')
    return { coupon: null, couponError: 'هذا العرض يطبق تلقائياً على الكميات ولا يحتاج إلى إدخال يدوي.' }
  }

  if (!isCouponCurrentlyActive(normalizedCoupon)) {
    if (strict) throw new Error('انتهت صلاحية هذا الكوبون')
    return { coupon: null, couponError: 'انتهت صلاحية هذا الكوبون' }
  }

  const [totalResult, userResult] = await Promise.all([
    supabase
      .from('coupon_redemptions')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_id', normalizedCoupon.id),
    supabase
      .from('coupon_redemptions')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_id', normalizedCoupon.id)
      .eq('user_id', userId),
  ])

  const totalCount = totalResult.count || 0
  const userUsage = userResult.count || 0

  if (normalizedCoupon.max_uses && totalCount >= Number(normalizedCoupon.max_uses)) {
    if (strict) throw new Error('تم استنفاد هذا الكوبون')
    return { coupon: null, couponError: 'تم استنفاد هذا الكوبون' }
  }

  if (normalizedCoupon.max_uses_per_user && userUsage >= Number(normalizedCoupon.max_uses_per_user)) {
    if (strict) throw new Error('تم الوصول إلى الحد الأقصى لاستخدام هذا الكوبون')
    return { coupon: null, couponError: 'تم الوصول إلى الحد الأقصى لاستخدام هذا الكوبون' }
  }

  if (normalizedCoupon.min_order_amount && orderAmount < Number(normalizedCoupon.min_order_amount)) {
    const message = `الحد الأدنى للطلب هو ${Number(normalizedCoupon.min_order_amount || 0).toFixed(2)} درهم`
    if (strict) throw new Error(message)
    return { coupon: null, couponError: message }
  }

  return { coupon: normalizedCoupon, couponError: null }
}

const loadSelectedSlot = async ({
  supabase,
  vendorId,
  selectedDeliverySlotId,
}: {
  supabase: SupabaseClient
  vendorId: string
  selectedDeliverySlotId: string | null
}) => {
  if (!selectedDeliverySlotId) return null

  const { data, error } = await supabase
    .from('vendor_delivery_slots')
    .select('*')
    .eq('id', selectedDeliverySlotId)
    .eq('vendor_id', vendorId)
    .maybeSingle()

  if (error) throw error
  return data || null
}

const loadShippingContext = async ({
  supabase,
  vendorProfile,
  buyerCity,
  buyerLat,
  buyerLon,
  driverId,
}: {
  supabase: SupabaseClient
  vendorProfile: Record<string, unknown>
  buyerCity: string
  buyerLat: number | null
  buyerLon: number | null
  driverId: string | null
}) => {
  let basePrice = 12.0
  let pricePerKm = 1.6
  let minPrice = 10.0
  let maxPrice = 60.0
  let maxDistanceKm = 35.0
  let pricingSource = 'default'

  const { data: zone, error: zoneError } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('city', buyerCity)
    .eq('is_active', true)
    .maybeSingle()

  if (zoneError) throw zoneError

  if (zone) {
    basePrice = Number(zone.base_price || basePrice)
    pricePerKm = Number(zone.price_per_km || pricePerKm)
    maxDistanceKm = Number(zone.max_distance_km || maxDistanceKm)
    pricingSource = 'zone'
  }

  if (driverId) {
    const { data: driverPricing, error: driverPricingError } = await supabase
      .from('driver_pricing')
      .select('*')
      .eq('driver_id', driverId)
      .maybeSingle()

    if (driverPricingError) throw driverPricingError

    if (driverPricing?.is_custom_pricing) {
      basePrice = Number(driverPricing.base_price || basePrice)
      pricePerKm = Number(driverPricing.price_per_km || pricePerKm)
      minPrice = Number(driverPricing.min_price || minPrice)
      maxPrice = Number(driverPricing.max_price || maxPrice)
      maxDistanceKm = Number(driverPricing.max_distance_km || maxDistanceKm)
      pricingSource = 'driver'
    }
  }

  const distance = calculateDistance(
    Number(vendorProfile.latitude || 0) || null,
    Number(vendorProfile.longitude || 0) || null,
    buyerLat,
    buyerLon,
  )
  const timeMultiplier = getTimeMultiplier()
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
    shippingCost: quote.cost,
    shippingInfoData: {
      cost: quote.cost,
      distance,
      basePrice: quote.basePrice,
      pricePerKm: quote.pricePerKm,
      available: quote.available,
      maxDistanceKm,
      blockingReason: quote.blockingReason || null,
      timeMultiplier,
      pricingSource,
      zone: zone ? { name: zone.zone_name, code: zone.zone_code } : null,
      breakdown: quote.breakdown,
    },
    estimatedDeliveryTime: quote.available === false ? null : getEstimatedDeliveryTime(distance),
  }
}

export const buildAuthoritativeCheckout = async ({
  supabase,
  userId,
  payload,
  strictCouponValidation = false,
  strictPaymentValidation = false,
}: {
  supabase: SupabaseClient
  userId: string
  payload: Record<string, unknown>
  strictCouponValidation?: boolean
  strictPaymentValidation?: boolean
}) => {
  const cartItems = normalizeRequestedItems((payload.items as Array<Record<string, unknown>>) || [])
  if (!cartItems.length) {
    throw new Error('السلة فارغة أو غير صالحة')
  }

  const productIds = cartItems.map((item) => item.productId)
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, vendor_id, name, price_per_unit, is_available, available_quantity, min_order_quantity')
    .in('id', productIds)

  if (productsError) throw productsError

  const productMap = new Map((products || []).map((product) => [String(product.id), product]))
  const freshItems = cartItems.map((requestedItem) => {
    const product = productMap.get(requestedItem.productId)
    if (!product) {
      throw new Error('بعض المنتجات لم تعد متاحة')
    }

    if (product.is_available === false) {
      throw new Error(`${product.name} لم يعد متاحاً`)
    }

    if (product.available_quantity != null && requestedItem.quantity > Number(product.available_quantity)) {
      throw new Error(`${product.name}: الكمية المتاحة أقل من المطلوب`)
    }

    if (product.min_order_quantity && requestedItem.quantity < Number(product.min_order_quantity)) {
      throw new Error(`${product.name}: الحد الأدنى للطلب غير مستوفى`)
    }

    return {
      id: product.id,
      vendor_id: product.vendor_id,
      name: product.name,
      price_per_unit: Number(product.price_per_unit || 0),
      quantity: requestedItem.quantity,
    }
  })

  const vendorIds = Array.from(new Set(freshItems.map((item) => String(item.vendor_id || '')).filter(Boolean)))
  if (vendorIds.length !== 1) {
    throw new Error('يمكن إتمام الطلب حالياً من متجر واحد فقط. افصل السلة حسب البائع ثم أعد المحاولة.')
  }

  const { data: vendorProfiles, error: vendorProfilesError } = await supabase
    .from('profiles')
    .select('id, store_name, store_type, delivery_option, active_products_count, preferred_driver_id, partnership_status, min_order_amount, latitude, longitude, city, payment_policy_full, payment_policy_split, payment_policy_cod')
    .in('id', vendorIds)

  if (vendorProfilesError) throw vendorProfilesError

  const vendorProfile = vendorProfiles?.[0]
  if (!vendorProfile) {
    throw new Error('تعذر تحميل إعدادات المتجر لهذا الطلب')
  }

  const minimumOrderStatus = evaluateVendorMinimumOrders({
    items: freshItems,
    vendorProfiles: vendorProfiles || [],
  })
  if (minimumOrderStatus.hasViolations) {
    throw new Error(`الحد الأدنى للطلب لدى ${minimumOrderStatus.firstViolation.vendorName} هو ${minimumOrderStatus.firstViolation.minOrderAmount.toFixed(2)} درهم. المتبقي ${minimumOrderStatus.firstViolation.shortfall.toFixed(2)} درهم.`)
  }

  const buyerCity = String((payload.shippingInfo as Record<string, unknown> | undefined)?.city || '').trim()
  if (!buyerCity) {
    throw new Error('مدينة التوصيل مطلوبة')
  }

  const buyerLat = Number((payload.deliveryLocation as Record<string, unknown> | undefined)?.lat || 0) || null
  const buyerLon = Number((payload.deliveryLocation as Record<string, unknown> | undefined)?.lng || 0) || null
  if (!buyerLat || !buyerLon) {
    throw new Error('موقع التوصيل مطلوب')
  }

  const selectedDriverId = typeof payload.selectedDriverId === 'string' && payload.selectedDriverId.trim()
    ? payload.selectedDriverId.trim()
    : null
  const selectedSlotId = typeof payload.selectedDeliverySlotId === 'string' && payload.selectedDeliverySlotId.trim()
    ? payload.selectedDeliverySlotId.trim()
    : null
  const requestedDeliveryDate = typeof payload.requestedDeliveryDate === 'string' && payload.requestedDeliveryDate.trim()
    ? payload.requestedDeliveryDate.trim()
    : null
  const paymentType = typeof payload.paymentType === 'string' ? payload.paymentType : 'full'
  const selectedPaymentMethod = typeof payload.selectedPaymentMethod === 'string' ? payload.selectedPaymentMethod : 'bank'
  const driverDeliveryPaymentMethod = typeof payload.driverDeliveryPaymentMethod === 'string'
    ? payload.driverDeliveryPaymentMethod
    : 'cash'
  const cargoSize = typeof payload.cargoSize === 'string' ? payload.cargoSize : 'medium'

  const deliveryStrategy = resolveOrderDeliveryStrategy(vendorProfile, selectedDriverId)
  if (deliveryStrategy.blocked) {
    throw new Error(deliveryStrategy.blockedMessage || 'خيارات التوصيل الحالية غير صالحة')
  }

  const [settingsResult, bulkCouponsResult, codEligibility, selectedSlot] = await Promise.all([
    supabase.from('platform_settings').select('commission_rate').maybeSingle(),
    supabase
      .from('coupons')
      .select('id, code, title, description, vendor_id, discount_type, discount_value, min_order_amount, minimum_quantity, applies_to, starts_at, expires_at, is_active, metadata')
      .in('vendor_id', vendorIds)
      .eq('applies_to', 'bulk')
      .eq('is_active', true),
    getBuyerCodEligibility(supabase, userId),
    loadSelectedSlot({ supabase, vendorId: vendorIds[0], selectedDeliverySlotId: selectedSlotId }),
  ])

  if (settingsResult.error) throw settingsResult.error
  if (bulkCouponsResult.error) throw bulkCouponsResult.error

  const platformCommissionRate = Number(settingsResult.data?.commission_rate ?? DEFAULT_COMMISSION_RATE)
  const vendorPolicies = (vendorProfiles || []).map((vendor) => ({
    id: vendor.id,
    storeName: vendor.store_name || 'Vendor',
    full: vendor.payment_policy_full ?? true,
    split: vendor.payment_policy_split ?? true,
    cod: vendor.payment_policy_cod ?? false,
  }))
  const availablePaymentTypes = resolveAvailablePaymentTypes({ vendorPolicies, codEligibility })

  if (strictPaymentValidation) {
    if (!availablePaymentTypes.hasAny) {
      throw new Error('لا توجد طريقة دفع مشتركة متاحة لهذه السلة حالياً.')
    }
    if (!(paymentType in availablePaymentTypes) || !Boolean((availablePaymentTypes as Record<string, unknown>)[paymentType])) {
      throw new Error('نوع الدفع المحدد غير متاح لهذه السلة.')
    }
    if (paymentType !== 'cod' && !['paypal', 'bank'].includes(selectedPaymentMethod)) {
      throw new Error('وسيلة الدفع المحددة غير صالحة.')
    }
  }

  const bulkDiscountBreakdown = calculateBulkDiscountBreakdown({
    coupons: bulkCouponsResult.data || [],
    items: freshItems,
  })
  const subtotal = toAmount(freshItems.reduce((sum, item) => sum + (Number(item.price_per_unit || 0) * Number(item.quantity || 0)), 0))
  const bulkDiscount = toAmount(bulkDiscountBreakdown.totalDiscount)
  const discountedSubtotal = Math.max(toAmount(subtotal - bulkDiscount), 0)

  const couponCode = typeof payload.appliedCouponCode === 'string' && payload.appliedCouponCode.trim()
    ? payload.appliedCouponCode.trim()
    : null
  const { coupon: appliedCoupon, couponError } = await loadManualCoupon({
    supabase,
    userId,
    couponCode,
    orderAmount: discountedSubtotal,
    strict: strictCouponValidation,
  })
  const couponDiscount = appliedCoupon
    ? calculateCouponDiscountAmount({ coupon: appliedCoupon, subtotal: discountedSubtotal })
    : 0
  const netSubtotal = Math.max(toAmount(subtotal - bulkDiscount - couponDiscount), 0)

  const shippingContext = await loadShippingContext({
    supabase,
    vendorProfile,
    buyerCity,
    buyerLat,
    buyerLon,
    driverId: deliveryStrategy.deliveryOption === 'find_driver' ? selectedDriverId : deliveryStrategy.assignedDriverId,
  })
  if (shippingContext.shippingInfoData.available === false) {
    throw new Error(String(shippingContext.shippingInfoData.blockingReason || 'هذا العنوان خارج نطاق التوصيل الحالي.'))
  }

  let driverProfile: Record<string, unknown> | null = null
  if (deliveryStrategy.assignedDriverId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, driver_delivery_payment_notes')
      .eq('id', deliveryStrategy.assignedDriverId)
      .maybeSingle()

    if (error) throw error
    driverProfile = data || null
  }

  const vendorSubtotal = subtotal
  const vendorBulkDiscount = toAmount(bulkDiscountBreakdown.offersByVendor?.[vendorIds[0]]?.discountAmount || 0)
  const vendorSubtotalAfterBulk = Math.max(toAmount(vendorSubtotal - vendorBulkDiscount), 0)
  const orderCouponDiscount = appliedCoupon
    ? toAmount(Math.min(couponDiscount, vendorSubtotalAfterBulk))
    : 0
  const orderDiscountTotal = toAmount(vendorBulkDiscount + orderCouponDiscount)
  const discountedVendorSubtotal = Math.max(toAmount(vendorSubtotal - orderDiscountTotal), 0)
  const buyerCommission = toAmount(discountedVendorSubtotal * (platformCommissionRate / 100))
  const vendorCommission = toAmount(discountedVendorSubtotal * (platformCommissionRate / 100))
  const productPayableTotal = toAmount(discountedVendorSubtotal + buyerCommission)
  const buyerTotal = toAmount(productPayableTotal + shippingContext.shippingCost)
  const driverCommission = deliveryStrategy.createDeliveryOnAcceptance
    ? toAmount(shippingContext.shippingCost * (platformCommissionRate / 100))
    : 0
  const driverAmount = deliveryStrategy.createDeliveryOnAcceptance
    ? toAmount(shippingContext.shippingCost - driverCommission)
    : 0
  const vendorAmount = toAmount(
    discountedVendorSubtotal -
    vendorCommission +
    (deliveryStrategy.deliveryOption === 'self' ? shippingContext.shippingCost : 0)
  )

  const paymentPlan = buildPaymentPlan({
    paymentType,
    payableAmount: productPayableTotal,
    paymentMethod: paymentType === 'cod' ? 'cod' : selectedPaymentMethod,
  })

  const decoratedVendorProfile = decorateStoreProfile(vendorProfile)
  const baseOrderPayload = {
    buyer_id: userId,
    vendor_id: vendorIds[0],
    driver_id: deliveryStrategy.assignedDriverId,
    subtotal: vendorSubtotal,
    shipping_cost: shippingContext.shippingCost,
    tax: 0,
    total: buyerTotal,
    buyer_commission: buyerCommission,
    buyer_total: buyerTotal,
    vendor_amount: vendorAmount,
    discount_total: orderDiscountTotal,
    coupon_discount_total: orderCouponDiscount,
    bulk_discount_total: vendorBulkDiscount,
    applied_coupon_id: appliedCoupon?.id || null,
    driver_commission: driverCommission,
    driver_amount: driverAmount,
    payment_type: paymentPlan.paymentType,
    first_payment_amount: paymentPlan.firstPaymentAmount,
    first_payment_status: paymentPlan.firstPaymentStatus,
    second_payment_amount: paymentPlan.secondPaymentAmount,
    second_payment_status: paymentPlan.secondPaymentStatus,
    second_payment_due_at: paymentPlan.secondPaymentDueAt,
    delivery_distance_km: shippingContext.shippingInfoData.distance || null,
    delivery_base_fee: shippingContext.shippingInfoData.breakdown?.base || 0,
    delivery_distance_fee: shippingContext.shippingInfoData.breakdown?.distance || 0,
    delivery_time_multiplier: shippingContext.shippingInfoData.timeMultiplier || 1,
    delivery_fee_breakdown: {
      ...(shippingContext.shippingInfoData.breakdown || {}),
      pricingSource: shippingContext.shippingInfoData.pricingSource || 'default',
      estimatedDeliveryTime: shippingContext.estimatedDeliveryTime,
    },
    cargo_size: cargoSize,
    driver_delivery_payment_method: deliveryStrategy.createDeliveryOnAcceptance ? driverDeliveryPaymentMethod : null,
    driver_delivery_payment_status: deliveryStrategy.createDeliveryOnAcceptance ? 'pending' : 'waived',
    driver_delivery_payment_notes: driverProfile?.driver_delivery_payment_notes || null,
    product_tva_exempt: true,
    platform_commission_rate_snapshot: Number((platformCommissionRate / 100).toFixed(4)),
    vendor_product_total: discountedVendorSubtotal,
    delivery_fee_total: shippingContext.shippingCost,
    status: deliveryStrategy.initialOrderStatus,
    vendor_store_type: decoratedVendorProfile?.storeType || vendorProfile.store_type,
    delivery_option: deliveryStrategy.deliveryOption,
    shipping_address: String((payload.shippingInfo as Record<string, unknown> | undefined)?.address || ''),
    shipping_city: buyerCity,
    shipping_country: 'Morocco',
    shipping_latitude: buyerLat,
    shipping_longitude: buyerLon,
    buyer_notes: String((payload.shippingInfo as Record<string, unknown> | undefined)?.notes || ''),
    requested_delivery_date: selectedSlot ? requestedDeliveryDate : null,
    requested_delivery_slot_id: selectedSlot?.id || null,
    requested_delivery_slot_label: selectedSlot?.slot_label || null,
    minimum_order_amount_snapshot: Number(vendorProfile.min_order_amount || 0),
    minimum_order_shortfall: Math.max(Number(vendorProfile.min_order_amount || 0) - vendorSubtotal, 0),
    delivery_schedule_snapshot: buildDeliveryScheduleSnapshot({ requestedDate: requestedDeliveryDate, slot: selectedSlot }),
  }

  return {
    cartItems,
    freshItems,
    appliedCoupon,
    couponCode,
    couponError,
    availablePaymentTypes,
    codEligibility,
    pricing: {
      subtotal,
      bulkDiscount,
      couponDiscount: toAmount(couponDiscount),
      netSubtotal,
      discountedSubtotal,
      platformFee: toAmount(netSubtotal * (platformCommissionRate / 100)),
      productPaymentTotal: productPayableTotal,
      shippingCost: shippingContext.shippingCost,
      total: buyerTotal,
      estimatedDeliveryTime: shippingContext.estimatedDeliveryTime,
      shippingInfoData: shippingContext.shippingInfoData,
      platformCommissionRate,
      paymentType,
      selectedPaymentMethod,
    },
    vendorOrders: [
      {
        vendorId: vendorIds[0],
        items: freshItems,
        paymentPlan,
        orderPayload: baseOrderPayload,
        preferredOrderPayload: {
          ...baseOrderPayload,
          preferred_driver_id: deliveryStrategy.preferredDriverId,
          preferred_driver_status: deliveryStrategy.preferredDriverId
            ? deliveryStrategy.assignedDriverId
              ? 'linked'
              : 'unassigned'
            : null,
          preferred_driver_source: selectedDriverId
            ? 'manual_selection'
            : deliveryStrategy.preferredDriverId
              ? 'vendor_preferred'
              : null,
          preferred_driver_assigned_at: deliveryStrategy.preferredDriverId ? new Date().toISOString() : null,
        },
        financials: {
          buyerCommission,
          vendorCommission,
          productPayableTotal,
          buyerTotal,
          vendorAmount,
          driverCommission,
          driverAmount,
          orderDiscountTotal,
          orderCouponDiscount,
          vendorBulkDiscount,
          discountedVendorSubtotal,
        },
      },
    ],
  }
}