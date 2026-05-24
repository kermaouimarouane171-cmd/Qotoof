import { useEffect, useState } from 'react'

type CartItem = {
  price_per_unit?: number | string | null
  price?: number | string | null
  quantity?: number | string | null
}

type DeliveryOption = 'pickup' | 'self_pickup' | 'own_driver' | 'find_driver' | string

type ShippingInfoData = {
  available: boolean
  cost: number
  blockingReason: string | null
}

export type CheckoutPricing = {
  subtotal: number
  shipping: number
  bulkDiscount: number
  discountedSubtotal: number
  couponDiscount: number
  netSubtotal: number
  taxFees: number
  productPaymentTotal: number
  finalTotal: number
  shippingCost: number
  platformFee: number
  total: number
  shippingInfoData: ShippingInfoData
}

type UseCheckoutPricingResult = {
  pricing: CheckoutPricing | null
  loading: boolean
}

const toAmount = (value: number | string | null | undefined): number => Number(Number(value || 0).toFixed(2))

const resolveCouponDiscount = (subtotal: number, couponCode?: string | null): number => {
  if (!couponCode || !String(couponCode).trim()) return 0

  const normalized = String(couponCode).trim().toUpperCase()
  const percentageMatch = normalized.match(/(\d{1,2})P(CT)?$/)
  if (percentageMatch) {
    const pct = Math.min(Number(percentageMatch[1]), 90)
    return toAmount((subtotal * pct) / 100)
  }

  const fixedMatch = normalized.match(/(\d{1,4})$/)
  if (fixedMatch) {
    return Math.min(toAmount(Number(fixedMatch[1])), subtotal)
  }

  return 0
}

const resolveShipping = (deliveryOption?: DeliveryOption): number => {
  switch (deliveryOption) {
    case 'pickup':
    case 'self_pickup':
      return 0
    case 'own_driver':
      return 12
    case 'find_driver':
      return 18
    default:
      return 15
  }
}

export async function calculatePricing(
  cartItems: CartItem[] | null | undefined,
  couponCode?: string | null,
  deliveryOption?: DeliveryOption,
): Promise<CheckoutPricing> {
  const subtotal = toAmount(
    (cartItems || []).reduce(
      (sum, item) => sum + (Number(item.price_per_unit || item.price || 0) * Number(item.quantity || 0)),
      0,
    ),
  )

  const shipping = toAmount(resolveShipping(deliveryOption))
  const bulkDiscount = 0
  const discountedSubtotal = Math.max(toAmount(subtotal - bulkDiscount), 0)
  const couponDiscount = Math.min(resolveCouponDiscount(discountedSubtotal, couponCode), discountedSubtotal)
  const netSubtotal = Math.max(toAmount(discountedSubtotal - couponDiscount), 0)
  const taxFees = toAmount(netSubtotal * 0.02)
  const productPaymentTotal = toAmount(netSubtotal + taxFees)
  const finalTotal = toAmount(productPaymentTotal + shipping)

  return {
    subtotal,
    shipping,
    bulkDiscount,
    discountedSubtotal,
    couponDiscount,
    netSubtotal,
    taxFees,
    productPaymentTotal,
    finalTotal,
    // Keep compatibility with existing checkout consumers.
    shippingCost: shipping,
    platformFee: taxFees,
    total: finalTotal,
    shippingInfoData: {
      available: true,
      cost: shipping,
      blockingReason: null,
    },
  }
}

export function useCheckoutPricing(
  cartItems: CartItem[] | null | undefined,
  couponCode?: string | null,
  deliveryOption?: DeliveryOption,
): UseCheckoutPricingResult {
  const [pricing, setPricing] = useState<CheckoutPricing | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!cartItems?.length) {
        setPricing(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const result = await calculatePricing(cartItems, couponCode, deliveryOption)
        setPricing(result)
      } finally {
        setLoading(false)
      }
    }, 600)

    return () => clearTimeout(timer)
  }, [cartItems, couponCode, deliveryOption])

  return { pricing, loading }
}
