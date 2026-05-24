import { supabase } from '@/services/supabase'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import * as paymentService from '@/services/paymentService'
import emailService from '@/services/emailService'

const DEFAULT_SHIPPING_FEE = 30

const toNumber = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

const normalizeCheckoutItems = (items = []) => items.map((item) => ({
  productId: item.id,
  quantity: item.quantity,
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
    (sum, item) => sum + (toNumber(item.price_per_unit ?? item.price) * toNumber(item.quantity)),
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

  const orderPayload = {
    buyer_id: activeUser.id,
    status: 'pending',
    subtotal: totals.subtotal,
    shipping_cost: totals.shippingFee,
    coupon_discount_total: totals.couponDiscount,
    total: totals.total,
    items: cartItems,
  }

  const { data: insertedOrder, error } = await supabase
    .from('orders')
    .insert(orderPayload)
    .select('*')
    .single()

  if (error) {
    return { data: null, error }
  }

  try {
    if (typeof paymentService.createOrderPaymentRecord === 'function') {
      await paymentService.createOrderPaymentRecord({
        order_id: insertedOrder.id,
        payment_method: params.selectedPaymentMethod || params.paymentMethod || 'cod',
        amount: totals.total,
      })
    }

    if (emailService?.sendOrderConfirmation) {
      await emailService.sendOrderConfirmation(insertedOrder, {
        email: activeUser.email,
        name: activeUser.name || activeUser.full_name || 'Customer',
      })
    }
  } catch {
    // Side effects are intentionally best-effort and should not fail checkout creation.
  }

  return { data: insertedOrder, error: null }
}
