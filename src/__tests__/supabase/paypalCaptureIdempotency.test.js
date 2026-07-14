import fs from 'fs'
import path from 'path'

describe('PayPal capture idempotency (API-001 / PAY-001)', () => {
  const capturePath = path.resolve(__dirname, '../../../supabase/functions/capture-paypal-order/index.ts')
  const source = fs.readFileSync(capturePath, 'utf-8')

  describe('Idempotency guard exists', () => {
    test('function checks existing payment by transaction_id before calling PayPal', () => {
      expect(source).toContain("from('payments')")
      expect(source).toContain('transaction_id')
      expect(source).toContain('maybeSingle')
    })

    test('function returns early when payment status is completed', () => {
      expect(source).toContain("existingPayment?.status === 'completed'")
      expect(source).toContain('idempotent: true')
    })

    test('function does not call getPayPalAccessToken before idempotency check', () => {
      const idempotencyCheckPos = source.indexOf('existingPayment')
      const tokenCallPos = source.indexOf('getPayPalAccessToken()')
      expect(idempotencyCheckPos).toBeGreaterThan(-1)
      expect(tokenCallPos).toBeGreaterThan(-1)
      expect(idempotencyCheckPos).toBeLessThan(tokenCallPos)
    })

    test('idempotent response includes original payment and order IDs', () => {
      expect(source).toContain('paymentId: existingPayment.id')
      expect(source).toContain('internalOrderId: existingPayment.order_id')
    })

    test('idempotent response has status COMPLETED and paymentStatus completed', () => {
      expect(source).toContain("status: 'COMPLETED'")
      expect(source).toContain("paymentStatus: 'completed'")
      expect(source).toContain("orderPaymentStatus: 'paid'")
    })
  })

  describe('Secondary idempotency check on orders table', () => {
    test('function also checks orders table by payment_intent_id', () => {
      expect(source).toContain("from('orders')")
      expect(source).toContain('payment_intent_id')
    })

    test('function returns early when order payment_status is paid', () => {
      expect(source).toContain("payment_status', 'paid'")
      expect(source).toContain('existingOrder?.id')
    })

    test('secondary check response includes idempotent: true', () => {
      const orderCheckSection = source.substring(
        source.indexOf('Check 2'),
        source.indexOf('const token')
      )
      expect(orderCheckSection).toContain('idempotent: true')
    })
  })

  describe('PayPal API is only called after idempotency checks pass', () => {
    test('capturePayPalOrder call comes after both idempotency checks', () => {
      const lastIdempotencyCheck = source.lastIndexOf('existingOrder')
      const captureCallPos = source.indexOf('capturePayPalOrder(token')
      expect(lastIdempotencyCheck).toBeGreaterThan(-1)
      expect(captureCallPos).toBeGreaterThan(-1)
      expect(lastIdempotencyCheck).toBeLessThan(captureCallPos)
    })

    test('persistPayPalOrderState is called after capture', () => {
      const captureCallPos = source.indexOf('capturePayPalOrder(token')
      const persistPos = source.indexOf('persistPayPalOrderState(')
      expect(captureCallPos).toBeGreaterThan(-1)
      expect(persistPos).toBeGreaterThan(-1)
      expect(captureCallPos).toBeLessThan(persistPos)
    })
  })

  describe('No PayPal secrets exposed in response', () => {
    test('response does not include access_token or bearer token', () => {
      expect(source).not.toContain('access_token')
      expect(source).not.toContain('Bearer ')
      expect(source).not.toContain('client_secret')
    })

    test('error response does not leak full PayPal debug data', () => {
      const errorSection = source.substring(source.indexOf('catch (error)'))
      expect(errorSection).not.toContain('JSON.stringify(data)')
    })
  })

  describe('Service role key used for admin client (not exposed to frontend)', () => {
    test('uses SUPABASE_SERVICE_ROLE_KEY from Deno env', () => {
      expect(source).toContain('SUPABASE_SERVICE_ROLE_KEY')
      expect(source).toContain('Deno.env.get')
    })

    test('service role key is not returned in any response', () => {
      expect(source).not.toMatch(/serviceRoleKey.*\}/)
      expect(source).not.toMatch(/service_role_key.*\}/)
    })
  })
})
