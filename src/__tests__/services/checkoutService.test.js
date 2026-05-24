jest.mock('@/services/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
    from: jest.fn(),
  },
}))

jest.mock('@/store/cartStore', () => ({
  useCartStore: {
    getState: jest.fn(),
  },
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: {
    getState: jest.fn(),
  },
}))

jest.mock('@/services/paymentService', () => ({
  createOrderPaymentRecord: jest.fn(),
}))

jest.mock('@/services/emailService', () => ({
  __esModule: true,
  default: {
    sendOrderConfirmation: jest.fn(),
  },
}))

import { supabase } from '@/services/supabase'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import * as paymentService from '@/services/paymentService'
import emailService from '@/services/emailService'
import {
  createCheckoutOrder,
  calculateCheckoutPricing,
  calculateOrderTotals,
} from '@/services/checkoutService'

const makeDbChain = ({ order = null, error = null } = {}) => {
  const single = jest.fn().mockResolvedValue({ data: order, error })
  const select = jest.fn().mockReturnValue({ single })
  const insert = jest.fn().mockReturnValue({ select })
  const from = jest.fn().mockReturnValue({ insert })

  supabase.from = from
  return { from, insert, select, single }
}

describe('checkoutService', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    useCartStore.getState.mockReturnValue({ items: [] })
    useAuthStore.getState.mockReturnValue({
      user: { id: 'buyer-1', email: 'buyer@example.com', name: 'Buyer' },
    })

    supabase.functions.invoke.mockResolvedValue({
      data: {
        success: true,
        orders: [{ id: 'edge-order-1' }],
      },
      error: null,
    })
  })

  it('createCheckoutOrder(): creates order with correct status pending', async () => {
    const cartItems = [{ id: 'p1', price_per_unit: 50, quantity: 2 }]
    const createdOrder = { id: 'order-1', status: 'pending' }
    const { insert } = makeDbChain({ order: createdOrder, error: null })

    const result = await createCheckoutOrder({
      cartItems,
      user: { id: 'buyer-1', email: 'buyer@example.com' },
      paymentMethod: 'cod',
    })

    expect(insert).toHaveBeenCalledTimes(1)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      status: 'pending',
      buyer_id: 'buyer-1',
      subtotal: 100,
    }))
    expect(result).toEqual({ data: createdOrder, error: null })
  })

  it('createCheckoutOrder(): fails if cartItems is empty', async () => {
    const result = await createCheckoutOrder({
      cartItems: [],
      user: { id: 'buyer-1' },
    })

    expect(result.data).toBeNull()
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error.message).toMatch(/Cart items are required/i)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('createCheckoutOrder(): applies coupon discount correctly', async () => {
    const cartItems = [{ id: 'p1', price_per_unit: 100, quantity: 2 }]
    const { insert } = makeDbChain({ order: { id: 'order-2', status: 'pending' } })

    await createCheckoutOrder({
      cartItems,
      coupon: { discount_type: 'percentage', discount_value: 10 },
      user: { id: 'buyer-1', email: 'buyer@example.com' },
    })

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      subtotal: 200,
      coupon_discount_total: 20,
      total: 210,
    }))
  })

  it('createCheckoutOrder(): enforces minimum order amount', async () => {
    const result = await createCheckoutOrder({
      cartItems: [{ id: 'p1', price_per_unit: 20, quantity: 2 }],
      minimumOrderAmount: 100,
      user: { id: 'buyer-1' },
    })

    expect(result.data).toBeNull()
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error.message).toMatch(/Minimum order amount is 100/i)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('createCheckoutOrder(): returns { data: order, error: null } on success', async () => {
    const createdOrder = { id: 'order-3', status: 'pending' }
    makeDbChain({ order: createdOrder, error: null })

    const result = await createCheckoutOrder({
      cartItems: [{ id: 'p1', price_per_unit: 40, quantity: 3 }],
      user: { id: 'buyer-1', email: 'buyer@example.com' },
    })

    expect(result).toEqual({ data: createdOrder, error: null })
    expect(paymentService.createOrderPaymentRecord).toHaveBeenCalledTimes(1)
    expect(emailService.sendOrderConfirmation).toHaveBeenCalledTimes(1)
  })

  it('createCheckoutOrder(): returns { data: null, error } on DB error', async () => {
    const dbError = new Error('DB insert failed')
    makeDbChain({ order: null, error: dbError })

    const result = await createCheckoutOrder({
      cartItems: [{ id: 'p1', price_per_unit: 40, quantity: 3 }],
      user: { id: 'buyer-1', email: 'buyer@example.com' },
    })

    expect(result).toEqual({ data: null, error: dbError })
  })

  it('calculateOrderTotals(): correct subtotal calculation', () => {
    const totals = calculateOrderTotals({
      cartItems: [
        { price_per_unit: 20, quantity: 2 },
        { price_per_unit: 15, quantity: 3 },
      ],
      shippingFee: 10,
    })

    expect(totals.subtotal).toBe(85)
    expect(totals.total).toBe(95)
  })

  it('calculateOrderTotals(): correct shipping fee', () => {
    const totals = calculateOrderTotals({
      cartItems: [{ price_per_unit: 50, quantity: 1 }],
      shippingFee: 25,
    })

    expect(totals.shippingFee).toBe(25)
    expect(totals.total).toBe(75)
  })

  it('calculateOrderTotals(): correct coupon application', () => {
    const totals = calculateOrderTotals({
      cartItems: [{ price_per_unit: 100, quantity: 2 }],
      shippingFee: 0,
      coupon: { discount_type: 'fixed', discount_value: 30 },
    })

    expect(totals.subtotal).toBe(200)
    expect(totals.couponDiscount).toBe(30)
    expect(totals.total).toBe(170)
  })

  it('calculateCheckoutPricing(): returns pricing payload on success', async () => {
    const pricingPayload = { success: true, pricing: { total: 120 } }
    supabase.functions.invoke.mockResolvedValueOnce({ data: pricingPayload, error: null })

    const result = await calculateCheckoutPricing({
      items: [{ id: 'p1', quantity: 2 }],
    })

    expect(result).toEqual(pricingPayload)
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'calculate-checkout-pricing',
      expect.objectContaining({
        body: expect.objectContaining({
          items: [{ productId: 'p1', quantity: 2 }],
        }),
      }),
    )
  })

  it('calculateCheckoutPricing(): throws when invoke fails', async () => {
    const invokeError = new Error('pricing edge failed')
    supabase.functions.invoke.mockResolvedValueOnce({ data: null, error: invokeError })

    await expect(calculateCheckoutPricing({ items: [] })).rejects.toThrow('pricing edge failed')
  })

  it('calculateCheckoutPricing(): throws when payload is invalid', async () => {
    supabase.functions.invoke.mockResolvedValueOnce({
      data: { success: false, error: 'invalid pricing response' },
      error: null,
    })

    await expect(calculateCheckoutPricing({ items: [] })).rejects.toThrow('invalid pricing response')
  })

  it('createCheckoutOrder(): uses edge flow when shipping data exists', async () => {
    const edgeResult = { success: true, orders: [{ id: 'edge-1' }] }
    supabase.functions.invoke.mockResolvedValueOnce({ data: edgeResult, error: null })

    const result = await createCheckoutOrder({
      items: [{ id: 'p1', quantity: 1 }],
      shippingInfo: { city: 'Rabat' },
    })

    expect(result).toEqual(edgeResult)
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'create-checkout-order',
      expect.objectContaining({
        body: expect.objectContaining({ shippingInfo: { city: 'Rabat' } }),
      }),
    )
  })

  it('createCheckoutOrder(): throws on edge flow error', async () => {
    const edgeError = new Error('edge order failed')
    supabase.functions.invoke.mockResolvedValueOnce({ data: null, error: edgeError })

    await expect(createCheckoutOrder({ shippingInfo: { city: 'Casablanca' } })).rejects.toThrow('edge order failed')
  })

  it('createCheckoutOrder(): throws on malformed edge response', async () => {
    supabase.functions.invoke.mockResolvedValueOnce({
      data: { success: false, error: 'edge malformed' },
      error: null,
    })

    await expect(createCheckoutOrder({ shippingInfo: { city: 'Tangier' } })).rejects.toThrow('edge malformed')
  })

  it('createCheckoutOrder(): fails if user is missing for local flow', async () => {
    useAuthStore.getState.mockReturnValueOnce({ user: null })

    const result = await createCheckoutOrder({
      cartItems: [{ id: 'p1', price_per_unit: 40, quantity: 1 }],
    })

    expect(result.data).toBeNull()
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error.message).toMatch(/Authenticated user is required/i)
  })

  it('createCheckoutOrder(): survives side-effect failures after DB success', async () => {
    const createdOrder = { id: 'order-5', status: 'pending' }
    makeDbChain({ order: createdOrder, error: null })
    paymentService.createOrderPaymentRecord.mockRejectedValueOnce(new Error('payment side-effect failed'))
    emailService.sendOrderConfirmation.mockRejectedValueOnce(new Error('email side-effect failed'))

    const result = await createCheckoutOrder({
      cartItems: [{ id: 'p1', price_per_unit: 10, quantity: 3 }],
      user: { id: 'buyer-1', email: 'buyer@example.com' },
    })

    expect(result).toEqual({ data: createdOrder, error: null })
  })

  it('calculateOrderTotals(): percentage coupon is capped at subtotal and shipping is non-negative', () => {
    const totals = calculateOrderTotals({
      cartItems: [{ price_per_unit: 50, quantity: 1 }],
      shippingFee: -10,
      coupon: { discount_type: 'percentage', discount_value: 200 },
    })

    expect(totals.subtotal).toBe(50)
    expect(totals.shippingFee).toBe(0)
    expect(totals.couponDiscount).toBe(50)
    expect(totals.total).toBe(0)
  })
})
