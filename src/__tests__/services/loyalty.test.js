jest.mock('@/services/supabase', () => ({
  supabase: {},
}))

jest.mock('@/utils/withRetry', () => ({
  withRetry: (fn) => fn,
}))

import {
  calculateLoyaltyPointsForOrder,
  calculateRewardDiscountAmount,
} from '@/services/loyalty'

describe('loyalty service helpers', () => {
  it('calculates order points using tier multipliers', () => {
    expect(calculateLoyaltyPointsForOrder({ orderTotal: 250, tierName: 'Bronze' })).toBe(25)
    expect(calculateLoyaltyPointsForOrder({ orderTotal: 250, tierName: 'Gold' })).toBe(37)
    expect(calculateLoyaltyPointsForOrder({ orderTotal: 5, tierName: 'Bronze' })).toBe(1)
  })

  it('caps reward discount amounts at the order subtotal', () => {
    expect(calculateRewardDiscountAmount({
      reward: { reward_type: 'coupon', reward_value: 50 },
      subtotal: 120,
    })).toBe(50)

    expect(calculateRewardDiscountAmount({
      reward: { reward_type: 'points_discount', reward_value: 80 },
      subtotal: 45,
    })).toBe(45)

    expect(calculateRewardDiscountAmount({
      reward: { reward_type: 'free_shipping', reward_value: 80 },
      subtotal: 45,
    })).toBe(0)
  })
})