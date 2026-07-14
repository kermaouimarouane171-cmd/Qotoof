import {
  buildOrderStatusUpdatePayload,
  isAllowedOrderStatusTransition,
} from '@/modules/orders'
import { describe, expect, it } from '@jest/globals'

describe('orderLogic', () => {
  describe('isAllowedOrderStatusTransition', () => {
    it('allows valid transitions', () => {
      expect(isAllowedOrderStatusTransition('pending', 'vendor_accepted')).toBe(true)
      expect(isAllowedOrderStatusTransition('on_the_way', 'delivered')).toBe(true)
    })

    it('rejects invalid transitions', () => {
      expect(isAllowedOrderStatusTransition('pending', 'delivered')).toBe(false)
      expect(isAllowedOrderStatusTransition('cancelled', 'pending')).toBe(false)
    })
  })

  describe('buildOrderStatusUpdatePayload', () => {
    it('sets delivered timestamp for delivered status', () => {
      const payload = buildOrderStatusUpdatePayload('delivered')
      expect(payload.status).toBe('delivered')
      expect(payload.delivered_at).toBeDefined()
    })

    it('sets cancelled timestamp for cancelled status', () => {
      const payload = buildOrderStatusUpdatePayload('cancelled')
      expect(payload.status).toBe('cancelled')
      expect(payload.cancelled_at).toBeDefined()
    })

    it('preserves passed metadata', () => {
      const payload = buildOrderStatusUpdatePayload('vendor_accepted', {
        cancelled_reason: 'n/a',
      })
      expect(payload.cancelled_reason).toBe('n/a')
      expect(payload.confirmed_at).toBeDefined()
    })
  })
})
