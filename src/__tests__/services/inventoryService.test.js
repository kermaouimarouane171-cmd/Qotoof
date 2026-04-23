jest.mock('@/services/supabase', () => ({
  supabase: {},
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

import { buildInventorySummary, shouldNotifyWaitlist } from '@/services/inventoryService'

describe('inventoryService helpers', () => {
  it('builds an inventory summary from product rows', () => {
    const summary = buildInventorySummary([
      { id: '1', price_per_unit: 10, stock_quantity: 40, stock_alert_threshold: 10, waitlist_count: 0, is_available: true },
      { id: '2', price_per_unit: 12, stock_quantity: 5, stock_alert_threshold: 10, waitlist_count: 3, is_available: true },
      { id: '3', price_per_unit: 8, stock_quantity: 0, stock_alert_threshold: 10, waitlist_count: 2, is_available: false },
    ])

    expect(summary).toEqual({
      totalProducts: 3,
      inStock: 1,
      lowStock: 1,
      outOfStock: 1,
      activeWaitlists: 5,
      inventoryValue: 460,
    })
  })

  it('notifies waitlist users only when stock moves from empty to available', () => {
    expect(shouldNotifyWaitlist({ previousQuantity: 0, nextQuantity: 5, waitlistCount: 2 })).toBe(true)
    expect(shouldNotifyWaitlist({ previousQuantity: 2, nextQuantity: 5, waitlistCount: 2 })).toBe(false)
    expect(shouldNotifyWaitlist({ previousQuantity: 0, nextQuantity: 0, waitlistCount: 2 })).toBe(false)
    expect(shouldNotifyWaitlist({ previousQuantity: 0, nextQuantity: 5, waitlistCount: 0 })).toBe(false)
  })
})