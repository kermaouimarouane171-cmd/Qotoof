jest.mock('@/services/supabase', () => ({
  supabase: {},
}))

import {
  isSlotPastCutoff,
  decorateDeliverySlot,
} from '@/modules/delivery'

describe('deliveryScheduleService helpers', () => {
  it('blocks same-day slots past their cutoff window', () => {
    expect(isSlotPastCutoff({
      slot: { start_time: '14:00', cutoff_hours: 2 },
      requestedDate: '2026-04-23',
      now: new Date('2026-04-23T12:30:00'),
    })).toBe(true)

    expect(isSlotPastCutoff({
      slot: { start_time: '14:00', cutoff_hours: 2 },
      requestedDate: '2026-04-23',
      now: new Date('2026-04-23T11:30:00'),
    })).toBe(false)
  })

  it('marks slots unavailable once capacity is exhausted', () => {
    const decorated = decorateDeliverySlot({
      slot: {
        id: 'slot-1',
        slot_label: 'Evening',
        start_time: '18:00',
        end_time: '20:00',
        cutoff_hours: 2,
        max_orders: 3,
        is_active: true,
      },
      requestedDate: '2026-04-24',
      bookedOrders: 3,
      now: new Date('2026-04-23T10:00:00'),
    })

    expect(decorated.isFull).toBe(true)
    expect(decorated.available).toBe(false)
    expect(decorated.remainingCapacity).toBe(0)
  })
})