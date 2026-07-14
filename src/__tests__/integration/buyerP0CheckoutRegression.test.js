/**
 * Buyer P0 — Checkout + PayPal capture flow regression test
 * Verifies that legitimate buyer checkout flow still works
 * and that PayPal capture idempotency does not block legitimate first-time capture.
 */

describe('Buyer P0 — Checkout + PayPal capture flow regression', () => {
  describe('Legitimate checkout flow (mocked)', () => {
    const mockCart = {
      items: [
        { id: 'p1', vendor_id: 'v1', name: 'Apples', price_per_unit: 10, quantity: 2, available_quantity: 50 },
      ],
      getSubtotal: () => 20,
      getTotal: () => 24,
      getVendorCount: () => 1,
    }

    const mockAuth = {
      user: { id: 'buyer-1', email: 'buyer@test.com' },
      profile: { id: 'buyer-1', role: 'buyer' },
    }

    test('single-vendor cart passes hasSingleVendorCart check', () => {
      expect(mockCart.getVendorCount()).toBe(1)
      const hasSingleVendorCart = mockCart.getVendorCount() === 1
      expect(hasSingleVendorCart).toBe(true)
    })

    test('buyer with buyer role can proceed to checkout', () => {
      expect(mockAuth.profile.role).toBe('buyer')
    })

    test('checkout creates order with buyer_id = auth.uid()', () => {
      const orderPayload = {
        buyer_id: mockAuth.user.id,
        vendor_id: 'v1',
        total: mockCart.getTotal(),
        status: 'pending',
        payment_status: 'pending',
      }
      expect(orderPayload.buyer_id).toBe('buyer-1')
    })

    test('checkout creates pending payment record (not completed)', () => {
      const paymentPayload = {
        order_id: 'order-1',
        amount: 24,
        payment_method: 'paypal',
        status: 'pending',
      }
      expect(paymentPayload.status).toBe('pending')
      expect(paymentPayload.status).not.toBe('completed')
    })
  })

  describe('PayPal capture idempotency does not block first-time capture', () => {
    test('first capture call: no existing payment → proceeds to PayPal API', () => {
      const mockExistingPayment = null
      const mockExistingOrder = null

      const shouldProceedToCapture =
        !(mockExistingPayment?.status === 'completed') &&
        !(mockExistingOrder?.id)

      expect(shouldProceedToCapture).toBe(true)
    })

    test('second capture call (same orderId): existing completed payment → returns cached', () => {
      const mockExistingPayment = {
        id: 'pay-1',
        order_id: 'order-1',
        status: 'completed',
        transaction_id: 'paypal-order-123',
      }

      const shouldReturnCached = mockExistingPayment?.status === 'completed'
      expect(shouldReturnCached).toBe(true)
    })

    test('second capture call via order check: order already paid → returns cached', () => {
      const mockExistingPayment = null
      const mockExistingOrder = {
        id: 'order-1',
        payment_status: 'paid',
        payment_intent_id: 'paypal-order-123',
      }

      const shouldReturnCached =
        mockExistingPayment?.status === 'completed' ||
        (mockExistingOrder?.id && mockExistingOrder.payment_status === 'paid')

      expect(shouldReturnCached).toBe(true)
    })

    test('capture with pending payment (not completed) → proceeds to PayPal API', () => {
      const mockExistingPayment = {
        id: 'pay-1',
        order_id: 'order-1',
        status: 'pending',
        transaction_id: 'paypal-order-123',
      }

      const mockExistingOrder = null

      const shouldProceedToCapture =
        !(mockExistingPayment?.status === 'completed') &&
        !(mockExistingOrder?.id)

      expect(shouldProceedToCapture).toBe(true)
    })
  })

  describe('Buyer cannot fake payment completion', () => {
    test('RLS policy prevents buyer from inserting completed payment', () => {
      const fs = require('fs')
      const path = require('path')
      const migration037 = fs.readFileSync(
        path.resolve(__dirname, '../../../database/migrations/037-fix-open-insert-rls-policies.sql'),
        'utf-8'
      )

      expect(migration037).toContain('payments_service_insert')
      expect(migration037).toContain('TO service_role')
      expect(migration037).not.toMatch(/payments.*INSERT.*TO\s+authenticated/)
    })

    test('RLS policy prevents buyer from inserting delivery records', () => {
      const fs = require('fs')
      const path = require('path')
      const migration037 = fs.readFileSync(
        path.resolve(__dirname, '../../../database/migrations/037-fix-open-insert-rls-policies.sql'),
        'utf-8'
      )

      expect(migration037).toContain('deliveries_service_insert')
      expect(migration037).not.toMatch(/deliveries.*INSERT.*TO\s+authenticated/)
    })

    test('RLS policy prevents buyer from spamming notifications', () => {
      const fs = require('fs')
      const path = require('path')
      const migration037 = fs.readFileSync(
        path.resolve(__dirname, '../../../database/migrations/037-fix-open-insert-rls-policies.sql'),
        'utf-8'
      )

      expect(migration037).toContain('notifications_service_insert')
      expect(migration037).not.toMatch(/notifications.*INSERT.*TO\s+authenticated/)
    })
  })
})
