import { supabase } from '@/services/supabase'

const normalizeCheckoutItems = (items = []) => items.map((item) => ({
  productId: item.id,
  quantity: item.quantity,
}))

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

export const createCheckoutOrder = async (params) => {
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