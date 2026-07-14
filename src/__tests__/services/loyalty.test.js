jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

jest.mock('@/utils/withRetry', () => ({
  withRetry: (fn) => fn,
}))

import {
  calculateLoyaltyPointsForOrder,
  calculateRewardDiscountAmount,
  loyaltyApi,
} from '@/modules/loyalty'
import { supabase } from '@/services/supabase'

describe('loyalty service helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

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

  it('falls back to metadata.transaction_reason when loyalty_transactions.reason is missing', async () => {
    const balanceSpy = jest.spyOn(loyaltyApi, 'getPointsBalance').mockResolvedValue({
      points: 10,
      lifetime_points: 30,
      tier: 'Bronze',
      referral_bonus_earned: 0,
    })

    const transactionPayloads = []

    supabase.from.mockImplementation((table) => {
      if (table === 'loyalty_points') {
        return {
          upsert: jest.fn().mockResolvedValue({ error: null }),
        }
      }

      if (table === 'loyalty_transactions') {
        return {
          insert: jest.fn((payload) => {
            transactionPayloads.push(payload)
            return {
              select: jest.fn(() => ({
                single: jest.fn().mockResolvedValue(
                  transactionPayloads.length === 1
                    ? {
                        data: null,
                        error: {
                          code: '42703',
                          message: 'column loyalty_transactions.reason does not exist',
                        },
                      }
                    : {
                        data: { id: 'tx-1', metadata: payload.metadata },
                        error: null,
                      }
                ),
              })),
            }
          }),
        }
      }

      throw new Error(`Unexpected table ${table}`)
    })

    const result = await loyaltyApi.awardPoints('user-1', 15, 'order_completed', 'order-1', { source: 'sync' })

    expect(transactionPayloads).toHaveLength(2)
    expect(transactionPayloads[0].reason).toBe('order_completed')
    expect(transactionPayloads[1].reason).toBeUndefined()
    expect(transactionPayloads[1].metadata).toEqual({
      source: 'sync',
      transaction_reason: 'order_completed',
    })
    expect(result.newBalance).toBe(25)

    balanceSpy.mockRestore()
  })

  it('syncs delivered orders when reason column filtering is unavailable', async () => {
    const balanceSpy = jest.spyOn(loyaltyApi, 'getPointsBalance').mockResolvedValue({
      points: 0,
      lifetime_points: 0,
      tier: 'Bronze',
    })
    const awardSpy = jest.spyOn(loyaltyApi, 'awardPoints').mockResolvedValue({
      newBalance: 10,
      lifetimePoints: 10,
      tier: 'Bronze',
    })

    supabase.from.mockImplementation((table) => {
      if (table === 'profiles') {
        const builder = {
          select: jest.fn(() => builder),
          eq: jest.fn(() => builder),
          single: jest.fn().mockResolvedValue({
            data: { referred_by: null, referral_completed_at: null },
            error: null,
          }),
        }
        return builder
      }

      if (table === 'orders') {
        const builder = {
          select: jest.fn(() => builder),
          eq: jest.fn(() => builder),
          order: jest.fn().mockResolvedValue({
            data: [{
              id: 'order-2',
              subtotal: 120,
              discount_total: 0,
              total: 120,
              delivered_at: '2026-05-01T10:00:00.000Z',
              created_at: '2026-04-30T10:00:00.000Z',
              status: 'delivered',
            }],
            error: null,
          }),
        }
        return builder
      }

      if (table === 'loyalty_transactions') {
        const builder = {
          select: jest.fn(() => builder),
          eq: jest.fn((column) => {
            if (column === 'reason') {
              return Promise.resolve({
                data: null,
                error: {
                  code: '42703',
                  message: 'column loyalty_transactions.reason does not exist',
                },
              })
            }
            return builder
          }),
          not: jest.fn().mockResolvedValue({ data: [], error: null }),
        }
        return builder
      }

      throw new Error(`Unexpected table ${table}`)
    })

    const result = await loyaltyApi.syncDeliveredOrderBenefits('user-1')

    expect(awardSpy).toHaveBeenCalledWith(
      'user-1',
      expect.any(Number),
      'order_completed',
      'order-2',
      expect.objectContaining({ qualifying_total: 120 })
    )
    expect(result.ordersProcessed).toBe(1)

    balanceSpy.mockRestore()
    awardSpy.mockRestore()
  })
})