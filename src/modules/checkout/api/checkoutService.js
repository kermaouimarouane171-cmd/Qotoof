import { supabase } from '@/services/supabase'
import { useCartStore } from '@/modules/cart'
import { useAuthStore } from '@/store/authStore'

const DEFAULT_SHIPPING_FEE = 30

const toNumber = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

const normalizeCheckoutItems = (items = []) => items.map((item) => ({
  productId: item.id,
  quantity: item.quantity,
  ...(item.is_negotiated && item.locked_price != null ? {
    lockedPrice: Number(item.locked_price),
    negotiationId: item.negotiation_id || null,
  } : {}),
}))

const resolveCouponDiscount = ({ subtotal, coupon }) => {
  if (!coupon) return 0

  const discountType = String(coupon.discount_type || '').toLowerCase()
  const discountValue = toNumber(coupon.discount_value)

  if (discountType === 'percentage') {
    return Math.min((subtotal * discountValue) / 100, subtotal)
  }

  if (discountType === 'fixed') {
    return Math.min(discountValue, subtotal)
  }

  return 0
}

const buildCheckoutPayload = ({
  items,
  shippingInfo,
  deliveryLocation,
  paymentType,
  selectedPaymentMethod,
  selectedDriverId,
  requestedDeliveryDate,
  selectedDeliverySlotId,
  appliedCouponCode,
  cargoSize,
  driverDeliveryPaymentMethod,
  idempotencyKey,
}) => ({
  items: normalizeCheckoutItems(items),
  shippingInfo,
  deliveryLocation,
  paymentType,
  selectedPaymentMethod,
  selectedDriverId,
  requestedDeliveryDate,
  selectedDeliverySlotId,
  appliedCouponCode,
  cargoSize,
  driverDeliveryPaymentMethod,
  idempotencyKey,
})

export const calculateOrderTotals = ({
  cartItems = [],
  coupon = null,
  shippingFee = DEFAULT_SHIPPING_FEE,
} = {}) => {
  const subtotal = cartItems.reduce(
    (sum, item) => {
      const price = item.is_negotiated && item.locked_price != null
        ? toNumber(item.locked_price)
        : toNumber(item.price_per_unit ?? item.price)
      return sum + (price * toNumber(item.quantity))
    },
    0,
  )

  const couponDiscount = resolveCouponDiscount({ subtotal, coupon })
  const normalizedShippingFee = Math.max(toNumber(shippingFee), 0)
  const total = Math.max(subtotal - couponDiscount + normalizedShippingFee, 0)

  return {
    subtotal,
    shippingFee: normalizedShippingFee,
    couponDiscount,
    total,
  }
}

export const calculateCheckoutPricing = async (params) => {
  const { data, error } = await supabase.functions.invoke('calculate-checkout-pricing', {
    body: buildCheckoutPayload(params),
  })

  if (error) {
    throw error
  }

  if (!data?.success || !data?.pricing) {
    throw new Error(data?.error || 'Failed to calculate checkout pricing')
  }

  return data
}

export const createCheckoutOrder = async (params = {}) => {
  const edgeFlowRequested = params?.shippingInfo || params?.deliveryLocation || params?.selectedPaymentMethod

  if (edgeFlowRequested) {
    const { data, error } = await supabase.functions.invoke('create-checkout-order', {
      body: buildCheckoutPayload(params),
    })

    if (error) {
      throw error
    }

    if (!data?.success || !Array.isArray(data?.orders)) {
      throw new Error(data?.error || 'Failed to create checkout order')
    }

    return data
  }

  const cartState = useCartStore.getState?.() || {}
  const authState = useAuthStore.getState?.() || {}
  const cartItems = Array.isArray(params.cartItems) ? params.cartItems : (cartState.items || [])

  if (cartItems.length === 0) {
    return { data: null, error: new Error('Cart items are required') }
  }

  const minimumOrderAmount = toNumber(params.minimumOrderAmount)
  const totals = calculateOrderTotals({
    cartItems,
    coupon: params.coupon || null,
    shippingFee: params.shippingFee,
  })

  if (minimumOrderAmount > 0 && totals.subtotal < minimumOrderAmount) {
    return {
      data: null,
      error: new Error(`Minimum order amount is ${minimumOrderAmount}`),
    }
  }

  const activeUser = params.user || authState.user
  if (!activeUser?.id) {
    return { data: null, error: new Error('Authenticated user is required') }
  }

  const { data: insertedOrder, error } = await supabase.functions.invoke('create-checkout-order', {
    body: buildCheckoutPayload({
      items: cartItems,
      shippingInfo: params.shippingInfo || {},
      deliveryLocation: params.deliveryLocation || {},
      paymentType: params.paymentType || 'full',
      selectedPaymentMethod: params.selectedPaymentMethod || params.paymentMethod || 'cod',
      selectedDriverId: params.selectedDriverId || null,
      requestedDeliveryDate: params.requestedDeliveryDate || null,
      selectedDeliverySlotId: params.selectedDeliverySlotId || null,
      appliedCouponCode: params.appliedCouponCode || params.coupon?.code || null,
      cargoSize: params.cargoSize || 'medium',
      driverDeliveryPaymentMethod: params.driverDeliveryPaymentMethod || 'cash',
      idempotencyKey: params.idempotencyKey || null,
    }),
  })

  if (error) {
    return { data: null, error }
  }

  if (!insertedOrder?.success || !Array.isArray(insertedOrder?.orders)) {
    return { data: null, error: new Error(insertedOrder?.error || 'Failed to create checkout order') }
  }

  const primaryOrder = insertedOrder.orders[0] || null
  if (!primaryOrder) {
    return { data: null, error: new Error('Failed to create checkout order') }
  }

  return { data: primaryOrder, error: null, orders: insertedOrder.orders, pricing: insertedOrder.pricing }
}
