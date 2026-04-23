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

import {
  DEFAULT_VENDOR_CANCELLATION_POLICY,
  getCancellationPreview,
  normalizeCancellationPolicy,
} from '@/services/cancellationService'

describe('cancellationService helpers', () => {
  it('normalizes missing values using defaults', () => {
    expect(normalizeCancellationPolicy({ refund_percentage: 120 })).toEqual({
      ...DEFAULT_VENDOR_CANCELLATION_POLICY,
      refund_percentage: 100,
    })
  })

  it('returns a free cancellation preview inside the free window', () => {
    const preview = getCancellationPreview({
      order: {
        id: 'order-1',
        status: 'pending',
        created_at: '2026-04-22T09:00:00.000Z',
        grand_total: 500,
      },
      policy: DEFAULT_VENDOR_CANCELLATION_POLICY,
      now: '2026-04-22T09:30:00.000Z',
    })

    expect(preview.allowed).toBe(true)
    expect(preview.withinFreeWindow).toBe(true)
    expect(preview.cancellationFee).toBe(0)
    expect(preview.netRefundAmount).toBe(500)
  })

  it('applies fixed fee and refund percentage after the free window', () => {
    const preview = getCancellationPreview({
      order: {
        id: 'order-2',
        status: 'confirmed',
        created_at: '2026-04-22T08:00:00.000Z',
        grand_total: 1000,
      },
      policy: {
        ...DEFAULT_VENDOR_CANCELLATION_POLICY,
        free_cancellation_window_minutes: 15,
        cutoff_status: 'preparing',
        cancellation_fee_type: 'fixed',
        cancellation_fee_value: 25,
        refund_percentage: 80,
      },
      now: '2026-04-22T10:00:00.000Z',
    })

    expect(preview.allowed).toBe(true)
    expect(preview.withinFreeWindow).toBe(false)
    expect(preview.cancellationFee).toBe(25)
    expect(preview.grossRefundAmount).toBe(800)
    expect(preview.netRefundAmount).toBe(775)
  })

  it('blocks cancellation once the cutoff status has been reached', () => {
    const preview = getCancellationPreview({
      order: {
        id: 'order-3',
        status: 'preparing',
        created_at: '2026-04-22T08:00:00.000Z',
        grand_total: 350,
      },
      policy: {
        ...DEFAULT_VENDOR_CANCELLATION_POLICY,
        cutoff_status: 'preparing',
      },
      now: '2026-04-22T08:30:00.000Z',
    })

    expect(preview.allowed).toBe(false)
    expect(preview.blockingReason).toContain('تجاوز الطلب المرحلة')
  })
})