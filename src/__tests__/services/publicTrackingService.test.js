const mockInvoke = jest.fn()

jest.mock('@/services/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args) => mockInvoke(...args),
    },
  },
}))

import { lookupPublicOrderTracking } from '@/services/publicTrackingService'

describe('publicTrackingService', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
  })

  it('returns the server-authoritative tracking result', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        found: true,
        order: { id: 'order-1', item_count: 3 },
      },
      error: null,
    })

    const result = await lookupPublicOrderTracking({
      orderNumber: 'ORD-1',
      phone: '+212600000000',
    })

    expect(mockInvoke).toHaveBeenCalledWith('public-order-tracking', {
      body: {
        orderNumber: 'ORD-1',
        phone: '+212600000000',
      },
    })
    expect(result.order.item_count).toBe(3)
  })

  it('throws when the edge function reports a failure', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('Too many tracking attempts'),
    })

    await expect(lookupPublicOrderTracking({
      orderNumber: 'ORD-1',
      phone: '+212600000000',
    })).rejects.toThrow('Too many tracking attempts')
  })
})