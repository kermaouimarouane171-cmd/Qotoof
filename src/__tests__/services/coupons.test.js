jest.mock('@/services/supabase', () => ({
  supabase: {},
}))

jest.mock('@/utils/withRetry', () => ({
  withRetry: (fn) => fn,
}))

import {
  calculateBulkDiscountBreakdown,
  calculateCouponDiscountAmount,
} from '@/services/coupons'

describe('coupons service helpers', () => {
  it('calculates percentage and fixed coupon discounts', () => {
    expect(calculateCouponDiscountAmount({
      coupon: {
        discount_type: 'percentage',
        discount_value: 10,
        is_active: true,
      },
      subtotal: 500,
    })).toBe(50)

    expect(calculateCouponDiscountAmount({
      coupon: {
        discount_type: 'fixed',
        discount_value: 80,
        is_active: true,
      },
      subtotal: 60,
    })).toBe(60)
  })

  it('picks the strongest eligible bulk discount per vendor', () => {
    const result = calculateBulkDiscountBreakdown({
      coupons: [
        {
          id: 'bulk-1',
          vendor_id: 'vendor-1',
          applies_to: 'bulk',
          discount_type: 'percentage',
          discount_value: 5,
          minimum_quantity: 10,
          is_active: true,
        },
        {
          id: 'bulk-2',
          vendor_id: 'vendor-1',
          applies_to: 'bulk',
          discount_type: 'fixed',
          discount_value: 40,
          minimum_quantity: 10,
          is_active: true,
        },
        {
          id: 'bulk-3',
          vendor_id: 'vendor-2',
          applies_to: 'bulk',
          discount_type: 'percentage',
          discount_value: 10,
          minimum_quantity: 5,
          is_active: true,
        },
      ],
      items: [
        { vendor_id: 'vendor-1', quantity: 12, price_per_unit: 10 },
        { vendor_id: 'vendor-2', quantity: 2, price_per_unit: 50 },
      ],
    })

    expect(result.totalDiscount).toBe(40)
    expect(result.offersByVendor['vendor-1'].coupon.id).toBe('bulk-2')
    expect(result.offersByVendor['vendor-1'].discountAmount).toBe(40)
    expect(result.offersByVendor['vendor-2']).toBeUndefined()
  })
})