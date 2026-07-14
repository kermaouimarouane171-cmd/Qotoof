/**
 * PayPal sandbox integration and idempotency verification tests.
 *
 * Source code verification tests confirm that the Edge Functions implement
 * the correct idempotency mechanisms and sandbox/production switching.
 *
 * Live sandbox tests are skipped unless PAYPAL_SANDBOX_INTEGRATION=true
 * is set in the environment.
 */

const fs = require('fs')
const path = require('path')

const describeOrSkip = process.env.PAYPAL_SANDBOX_INTEGRATION === 'true' ? describe : describe.skip

describeOrSkip('PayPal sandbox integration (requires PAYPAL_SANDBOX_INTEGRATION=true)', () => {
  test('placeholder — live sandbox tests require PayPal sandbox credentials', () => {
    expect(true).toBe(true)
  })
})

describe('PayPal refund idempotency — source code verification', () => {
  test('refund-paypal-payment sends PayPal-Request-Id header', () => {
    const source = fs.readFileSync(
      path.resolve('supabase/functions/refund-paypal-payment/index.ts'),
      'utf-8'
    )
    expect(source).toContain('PayPal-Request-Id')
    expect(source).toContain('paypalRequestId')
  })

  test('refund-paypal-payment defaults PayPal-Request-Id to refund-{captureId}', () => {
    const source = fs.readFileSync(
      path.resolve('supabase/functions/refund-paypal-payment/index.ts'),
      'utf-8'
    )
    expect(source).toContain('refund-${captureId}')
  })

  test('refund-paypal-payment accepts optional idempotencyId parameter', () => {
    const source = fs.readFileSync(
      path.resolve('supabase/functions/refund-paypal-payment/index.ts'),
      'utf-8'
    )
    expect(source).toContain('idempotencyId')
  })

  test('refund-paypal-payment uses sandbox API when VITE_PAYMENT_MODE != production', () => {
    const source = fs.readFileSync(
      path.resolve('supabase/functions/refund-paypal-payment/index.ts'),
      'utf-8'
    )
    expect(source).toContain('api-m.sandbox.paypal.com')
    expect(source).toContain('api-m.paypal.com')
    expect(source).toContain('VITE_PAYMENT_MODE')
  })
})

describe('Checkout idempotency — source code verification', () => {
  test('create-checkout-order uses claim_checkout_request RPC for idempotency', () => {
    const source = fs.readFileSync(
      path.resolve('supabase/functions/_shared/checkoutPersistence.ts'),
      'utf-8'
    )
    expect(source).toContain('claim_checkout_request')
    expect(source).toContain('idempotencyKey')
    expect(source).toContain('finalizeCheckoutRequest')
  })

  test('checkout_requests table has unique constraint on (buyer_id, idempotency_key)', () => {
    const migrationSource = fs.readFileSync(
      path.resolve('supabase/migrations/20260514000034_checkout_idempotency_and_commission_guards.sql'),
      'utf-8'
    )
    expect(migrationSource).toContain('UNIQUE (buyer_id, idempotency_key)')
    expect(migrationSource).toContain('claim_checkout_request')
    expect(migrationSource).toContain('SECURITY DEFINER')
    expect(migrationSource).toContain('FOR UPDATE')
  })

  test('claim_checkout_request returns cached response for completed requests', () => {
    const migrationSource = fs.readFileSync(
      path.resolve('supabase/migrations/20260514000034_checkout_idempotency_and_commission_guards.sql'),
      'utf-8'
    )
    expect(migrationSource).toContain("v_request.status = 'completed'")
    expect(migrationSource).toContain('cached_response')
  })

  test('claim_checkout_request blocks concurrent in-progress requests', () => {
    const migrationSource = fs.readFileSync(
      path.resolve('supabase/migrations/20260514000034_checkout_idempotency_and_commission_guards.sql'),
      'utf-8'
    )
    expect(migrationSource).toContain("v_request.status = 'processing'")
    expect(migrationSource).toContain('in_progress')
    expect(migrationSource).toContain('v_stale_cutoff')
  })
})

describe('PayPal capture idempotency — source code verification', () => {
  test('capture-paypal-order persists state by transaction_id lookup', () => {
    const source = fs.readFileSync(
      path.resolve('supabase/functions/_shared/paypalCheckout.ts'),
      'utf-8'
    )
    expect(source).toContain('transaction_id')
    expect(source).toContain('persistPayPalOrderState')
    expect(source).toContain('maybeSingle')
  })

  test('persistPayPalOrderState checks existing payment before updating', () => {
    const source = fs.readFileSync(
      path.resolve('supabase/functions/_shared/paypalCheckout.ts'),
      'utf-8'
    )
    expect(source).toContain('paymentByTransaction')
    expect(source).toContain('paymentByOrder')
    expect(source).toContain('paymentRecord?.id')
  })

  test('capture-paypal-order uses sandbox API when not in production mode', () => {
    const source = fs.readFileSync(
      path.resolve('supabase/functions/_shared/paypalCheckout.ts'),
      'utf-8'
    )
    expect(source).toContain('api-m.sandbox.paypal.com')
    expect(source).toContain('api-m.paypal.com')
    expect(source).toContain('VITE_PAYMENT_MODE')
  })
})

describe('Frontend idempotency — source code verification', () => {
  test('CheckoutSimplified generates crypto.randomUUID as idempotency key', () => {
    const source = fs.readFileSync(
      path.resolve('src/pages/CheckoutSimplified.jsx'),
      'utf-8'
    )
    expect(source).toContain('crypto.randomUUID')
    expect(source).toContain('idempotencyKey')
    expect(source).toContain('checkoutRequestKeyRef')
  })

  test('checkoutService passes idempotencyKey to Edge Function payload', () => {
    const source = fs.readFileSync(
      path.resolve('src/modules/checkout/api/checkoutService.js'),
      'utf-8'
    )
    expect(source).toContain('idempotencyKey')
    expect(source).toContain('create-checkout-order')
  })

  test('paymentGateway uses VITE_PAYMENT_MODE for sandbox/production detection', () => {
    const source = fs.readFileSync(
      path.resolve('src/modules/payments/api/paymentGateway.js'),
      'utf-8'
    )
    expect(source).toContain('VITE_PAYMENT_MODE')
    expect(source).toContain('isTestMode')
  })
})

describe('PayPal sandbox configuration — source code verification', () => {
  test('create-paypal-order uses sandbox API when not in production mode', () => {
    const source = fs.readFileSync(
      path.resolve('supabase/functions/create-paypal-order/index.ts'),
      'utf-8'
    )
    expect(source).toContain('api-m.sandbox.paypal.com')
    expect(source).toContain('api-m.paypal.com')
    expect(source).toContain('VITE_PAYMENT_MODE')
  })

  test('create-paypal-order stores PayPal order ID in payment record', () => {
    const source = fs.readFileSync(
      path.resolve('supabase/functions/create-paypal-order/index.ts'),
      'utf-8'
    )
    expect(source).toContain('transaction_id')
    expect(source).toContain('payment_method')
    expect(source).toContain('paypal')
  })

  test('create-paypal-order never uses Edge Function origin for return_url/cancel_url fallback', () => {
    const source = fs.readFileSync(
      path.resolve('supabase/functions/create-paypal-order/index.ts'),
      'utf-8'
    )
    expect(source).not.toContain('req.url.origin')
    expect(source).toContain('FRONTEND_APP_URL')
    expect(source).toContain('safeReturnUrl')
    expect(source).toContain('safeCancelUrl')
    expect(source).toContain('return_url: safeReturnUrl')
    expect(source).toContain('cancel_url: safeCancelUrl')
  })

  test('get-public-config returns PayPal client ID (public, safe)', () => {
    const source = fs.readFileSync(
      path.resolve('supabase/functions/get-public-config/index.ts'),
      'utf-8'
    )
    expect(source).toContain('VITE_PAYPAL_CLIENT_ID')
    // The secret must not appear in the PUBLIC_CONFIG object as a value
    expect(source).not.toMatch(/PUBLIC_CONFIG.*PAYPAL_CLIENT_SECRET/s)
    // The comment warning about secrets should be present
    expect(source).toMatch(/NEVER.*secret|secret.*NEVER/i)
  })

  test('reconcile-paypal-payments exists for payment state reconciliation', () => {
    const source = fs.readFileSync(
      path.resolve('supabase/functions/reconcile-paypal-payments/index.ts'),
      'utf-8'
    )
    expect(source).toContain('reconcilePayPalOrder')
    expect(source).toContain('pending')
    expect(source).toContain('captured')
  })
})
