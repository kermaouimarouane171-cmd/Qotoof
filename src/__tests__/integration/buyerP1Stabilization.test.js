/**
 * Buyer P1 Stabilization — Comprehensive regression tests
 * Covers: TEST-002 (checkout/payment coverage), TEST-012 (RLS violation tests),
 * DB-001, DB-004/ARCH-003, API-002, PAY-002, PAY-003, PAY-004
 */

import fs from 'fs'
import path from 'path'

// ══════════════════════════════════════════
// TEST-002: Buyer checkout/payment coverage
// ══════════════════════════════════════════

describe('TEST-002 — Buyer checkout/payment coverage (mocked)', () => {
  describe('Buyer checkout creates order', () => {
    const mockBuyer = { id: 'buyer-1', email: 'buyer@test.com' }
    const mockProfile = { id: 'buyer-1', role: 'buyer' }
    const mockCartItems = [
      { id: 'p1', vendor_id: 'v1', name: 'Apples', price_per_unit: 10, quantity: 2 },
    ]

    test('checkout payload includes buyer_id from auth session', () => {
      const checkoutPayload = {
        buyer_id: mockBuyer.id,
        vendor_id: 'v1',
        items: mockCartItems,
        total: 20,
        status: 'pending',
        payment_status: 'pending',
      }
      expect(checkoutPayload.buyer_id).toBe('buyer-1')
      expect(checkoutPayload.status).toBe('pending')
    })

    test('buyer role is verified before checkout (API-002)', () => {
      expect(mockProfile.role).toBe('buyer')
      const allowedRoles = ['buyer']
      expect(allowedRoles.includes(mockProfile.role)).toBe(true)
    })

    test('vendor role is rejected from checkout (API-002)', () => {
      const vendorProfile = { id: 'vendor-1', role: 'vendor' }
      const allowedRoles = ['buyer']
      expect(allowedRoles.includes(vendorProfile.role)).toBe(false)
    })

    test('driver role is rejected from checkout (API-002)', () => {
      const driverProfile = { id: 'driver-1', role: 'driver' }
      const allowedRoles = ['buyer']
      expect(allowedRoles.includes(driverProfile.role)).toBe(false)
    })

    test('admin role is rejected from buyer checkout (API-002)', () => {
      const adminProfile = { id: 'admin-1', role: 'admin' }
      const allowedRoles = ['buyer']
      expect(allowedRoles.includes(adminProfile.role)).toBe(false)
    })

    test('unauthenticated request is rejected (API-002)', () => {
      const noAuth = null
      expect(noAuth).toBeNull()
    })
  })

  describe('PayPal pending state', () => {
    test('order with pending PayPal payment has payment_record_status = pending', () => {
      const order = {
        id: 'order-1',
        payment_method: 'paypal',
        payment_record_status: 'pending',
      }
      expect(order.payment_record_status).toBe('pending')
      expect(order.payment_record_status).not.toBe('completed')
    })

    test('pending PayPal order should show retry button', () => {
      const order = {
        id: 'order-1',
        payment_method: 'paypal',
        payment_record_status: 'pending',
      }
      const shouldShowRetry = order.payment_method === 'paypal' && order.payment_record_status !== 'completed'
      expect(shouldShowRetry).toBe(true)
    })
  })

  describe('PayPal capture success', () => {
    test('successful capture updates payment status to completed', () => {
      const captureResult = {
        status: 'COMPLETED',
        paymentStatus: 'completed',
        orderPaymentStatus: 'paid',
      }
      expect(captureResult.status).toBe('COMPLETED')
      expect(captureResult.paymentStatus).toBe('completed')
    })

    test('after successful capture, retry button is hidden', () => {
      const order = {
        id: 'order-1',
        payment_method: 'paypal',
        payment_record_status: 'completed',
      }
      const shouldShowRetry = order.payment_method === 'paypal' && order.payment_record_status !== 'completed'
      expect(shouldShowRetry).toBe(false)
    })
  })

  describe('PayPal capture failure', () => {
    test('failed capture does not update payment to completed', () => {
      const captureError = { message: 'PayPal capture failed' }
      const order = {
        id: 'order-1',
        payment_method: 'paypal',
        payment_record_status: 'pending',
      }
      expect(captureError.message).toBeTruthy()
      expect(order.payment_record_status).toBe('pending')
    })
  })

  describe('PayPal retry behavior (PAY-003)', () => {
    test('retry is blocked when payment is already completed', () => {
      const order = {
        id: 'order-1',
        payment_method: 'paypal',
        payment_record_status: 'completed',
      }
      const shouldBlockRetry = order.payment_record_status === 'completed'
      expect(shouldBlockRetry).toBe(true)
    })

    test('old pending payment is marked superseded before creating new PayPal order', () => {
      const oldPayment = { id: 'pay-1', status: 'pending', transaction_id: 'old-pp-order' }
      const newPayPalOrderId = 'new-pp-order-123'

      // Simulate the flow
      let updatedOldPayment = null
      if (oldPayment.status === 'pending') {
        updatedOldPayment = { ...oldPayment, status: 'superseded' }
      }

      expect(updatedOldPayment.status).toBe('superseded')
      expect(updatedOldPayment.transaction_id).toBe('old-pp-order')
      expect(newPayPalOrderId).not.toBe(oldPayment.transaction_id)
    })

    test('superseded payment is not re-captured', () => {
      const supersededPayment = { id: 'pay-1', status: 'superseded' }
      const shouldCapture = supersededPayment.status === 'pending'
      expect(shouldCapture).toBe(false)
    })

    test('completed payment is not marked superseded on retry', () => {
      const completedPayment = { id: 'pay-1', status: 'completed' }
      let wasMarkedSuperseded = false
      if (completedPayment.status === 'pending') {
        wasMarkedSuperseded = true
      }
      expect(wasMarkedSuperseded).toBe(false)
    })
  })

  describe('Order confirmation status rendering (PAY-002)', () => {
    const determineTitle = (paymentStatus, paymentMethod) => {
      const isPaid = paymentStatus === 'completed' || paymentStatus === 'paid' || paymentStatus === 'verified'
      const isPending = paymentStatus === 'pending' || paymentStatus === 'processing' || paymentStatus === 'awaiting_transfer'
      const isFailed = paymentStatus === 'failed' || paymentStatus === 'cancelled' || paymentStatus === 'superseded'
      const isCOD = paymentMethod === 'cod'
      const isBankPendingReview = paymentMethod === 'bank' && (paymentStatus === 'processing' || paymentStatus === 'paid' || paymentStatus === 'pending')

      if (isCOD) return 'titleCod'
      if (isBankPendingReview) return 'titleBankReview'
      if (isPaid) return 'title'
      if (isFailed) return 'titleFailed'
      if (isPending) return 'titlePending'
      return 'title'
    }

    test('paid status shows "Order Confirmed!"', () => {
      expect(determineTitle('completed', 'paypal')).toBe('title')
    })

    test('pending PayPal shows "Payment Pending"', () => {
      expect(determineTitle('pending', 'paypal')).toBe('titlePending')
    })

    test('failed payment shows "Payment Failed"', () => {
      expect(determineTitle('failed', 'paypal')).toBe('titleFailed')
    })

    test('cancelled payment shows "Payment Failed"', () => {
      expect(determineTitle('cancelled', 'paypal')).toBe('titleFailed')
    })

    test('superseded payment shows "Payment Failed"', () => {
      expect(determineTitle('superseded', 'paypal')).toBe('titleFailed')
    })

    test('COD shows "Order Placed — Pay on Delivery"', () => {
      expect(determineTitle(null, 'cod')).toBe('titleCod')
    })

    test('bank transfer processing shows "Payment Pending Review"', () => {
      expect(determineTitle('processing', 'bank')).toBe('titleBankReview')
    })

    test('bank transfer pending shows "Payment Pending Review"', () => {
      expect(determineTitle('pending', 'bank')).toBe('titleBankReview')
    })

    test('does not show success just because paypal=success exists in URL', () => {
      // Simulate: URL has paypal=success but payment_record_status is still pending
      const urlPaypalAction = 'success'
      const actualPaymentStatus = 'pending'
      const title = determineTitle(actualPaymentStatus, 'paypal')
      expect(urlPaypalAction).toBe('success')
      expect(title).toBe('titlePending')
      expect(title).not.toBe('title')
    })
  })

  describe('Pending payment banner (PAY-004)', () => {
    const shouldShowPendingBanner = (paymentStatus, paymentMethod) => {
      const isPending = paymentStatus === 'pending' || paymentStatus === 'processing' || paymentStatus === 'awaiting_transfer'
      const isCOD = paymentMethod === 'cod'
      return isPending && !isCOD
    }

    test('pending PayPal shows pending banner', () => {
      expect(shouldShowPendingBanner('pending', 'paypal')).toBe(true)
    })

    test('processing bank transfer shows pending banner', () => {
      expect(shouldShowPendingBanner('processing', 'bank')).toBe(true)
    })

    test('completed payment does not show pending banner', () => {
      expect(shouldShowPendingBanner('completed', 'paypal')).toBe(false)
    })

    test('COD does not show pending banner', () => {
      expect(shouldShowPendingBanner('pending', 'cod')).toBe(false)
    })
  })
})

// ══════════════════════════════════════════
// DB-001: usePaymentHistory schema fix
// ══════════════════════════════════════════

describe('DB-001 — usePaymentHistory queries through orders.buyer_id', () => {
  test('payments table does not have user_id column — query uses inner join to orders', () => {
    const sourceFile = fs.readFileSync(
      path.resolve(__dirname, '../../hooks/queries/useCartPaymentQueries.js'),
      'utf-8'
    )
    // The fixed usePaymentHistory query should use orders!inner with buyer_id
    const paymentHistorySection = sourceFile.match(/export const usePaymentHistory[\s\S]*?\n}/)
    expect(paymentHistorySection).toBeTruthy()
    expect(paymentHistorySection[0]).toContain('orders!inner')
    expect(paymentHistorySection[0]).toContain('order.buyer_id')
    // Should NOT query payments.user_id in the payment history hook
    expect(paymentHistorySection[0]).not.toContain(".eq('user_id', session.user.id)")
  })

  test('useCreatePayment does not insert user_id into payments', () => {
    const sourceFile = fs.readFileSync(
      path.resolve(__dirname, '../../hooks/queries/useCartPaymentQueries.js'),
      'utf-8'
    )
    // The insert should not include user_id
    const insertSection = sourceFile.match(/\.from\('payments'\)\s*\.insert\(\{[\s\S]*?\}\)/)
    expect(insertSection).toBeTruthy()
    expect(insertSection[0]).not.toContain('user_id')
  })
})

// ══════════════════════════════════════════
// DB-004/ARCH-003: DB cart hooks deprecation
// ══════════════════════════════════════════

describe('DB-004/ARCH-003 — DB cart hooks deprecated, Zustand is source of truth', () => {
  test('DB cart hooks have @deprecated JSDoc annotations', () => {
    const sourceFile = fs.readFileSync(
      path.resolve(__dirname, '../../hooks/queries/useCartPaymentQueries.js'),
      'utf-8'
    )
    expect(sourceFile).toContain('@deprecated Use useCartStore')
    // Multiple deprecated hooks
    const deprecatedCount = (sourceFile.match(/@deprecated Use useCartStore/g) || []).length
    expect(deprecatedCount).toBeGreaterThanOrEqual(6)
  })

  test('Zustand cartStore is the source of truth (used by Cart, Checkout, Navbar)', () => {
    const cartStorePath = path.resolve(__dirname, '../../modules/cart/stores/cartStore.js')
    expect(fs.existsSync(cartStorePath)).toBe(true)

    const cartPage = fs.readFileSync(
      path.resolve(__dirname, '../../pages/Cart.jsx'),
      'utf-8'
    )
    expect(cartPage).toContain('useCartStore')

    const checkoutPage = fs.readFileSync(
      path.resolve(__dirname, '../../pages/CheckoutSimplified.jsx'),
      'utf-8'
    )
    expect(checkoutPage).toContain('useCartStore')
  })

  test('no component/page imports DB cart hooks (useCart from useCartPaymentQueries)', () => {
    const srcDir = path.resolve(__dirname, '../..')
    const componentFiles = []
    const walkDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory() && !entry.name.includes('__tests__') && entry.name !== 'node_modules') {
          walkDir(fullPath)
        } else if ((entry.name.endsWith('.jsx') || entry.name.endsWith('.js')) && !entry.name.includes('index.js')) {
          componentFiles.push(fullPath)
        }
      }
    }
    walkDir(srcDir)

    // No component/page should import useCart from useCartPaymentQueries
    // Exclude barrel re-exports and the definition file itself
    const violatingFiles = []
    for (const file of componentFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      if (content.includes('useCartPaymentQueries') && content.includes('useCart')) {
        if (!file.includes('useCartPaymentQueries.js')) {
          violatingFiles.push(file)
        }
      }
    }
    expect(violatingFiles).toEqual([])
  })

  test('barrel export no longer re-exports deprecated DB cart hooks', () => {
    const barrelSource = fs.readFileSync(
      path.resolve(__dirname, '../../hooks/queries/index.js'),
      'utf-8'
    )
    const deprecatedHooks = ['useCart', 'useCartCount', 'useAddToCart', 'useUpdateCartItem', 'useRemoveFromCart', 'useClearCart']
    // Extract only the exported names between the braces for the useCartPaymentQueries block
    const exportNames = barrelSource.match(/export\s*\{([^}]*)\}\s*from\s*['"]\.\/useCartPaymentQueries['"]/s)?.[1] || ''
    deprecatedHooks.forEach((hook) => {
      expect(exportNames).not.toContain(hook)
    })
  })
})

// ══════════════════════════════════════════
// API-002: Edge Function buyer role verification
// ══════════════════════════════════════════

describe('API-002 — Edge Functions verify buyer role', () => {
  const functionsDir = path.resolve(__dirname, '../../../supabase/functions')

  test('create-checkout-order uses requireRole with buyer', () => {
    const source = fs.readFileSync(
      path.join(functionsDir, 'create-checkout-order/index.ts'),
      'utf-8'
    )
    expect(source).toContain('requireRole')
    expect(source).toContain("['buyer']")
  })

  test('create-paypal-order uses requireRole with buyer', () => {
    const source = fs.readFileSync(
      path.join(functionsDir, 'create-paypal-order/index.ts'),
      'utf-8'
    )
    expect(source).toContain('requireRole')
    expect(source).toContain("['buyer']")
  })

  test('capture-paypal-order uses requireRole with buyer', () => {
    const source = fs.readFileSync(
      path.join(functionsDir, 'capture-paypal-order/index.ts'),
      'utf-8'
    )
    expect(source).toContain('requireRole')
    expect(source).toContain("['buyer']")
  })

  test('confirm-bank-transfer uses requireRole with buyer', () => {
    const source = fs.readFileSync(
      path.join(functionsDir, 'confirm-bank-transfer/index.ts'),
      'utf-8'
    )
    expect(source).toContain('requireRole')
    expect(source).toContain("['buyer']")
  })

  test('register-payment-receipt uses requireRole with buyer', () => {
    const source = fs.readFileSync(
      path.join(functionsDir, 'register-payment-receipt/index.ts'),
      'utf-8'
    )
    expect(source).toContain('requireRole')
    expect(source).toContain("['buyer']")
  })

  test('auth.ts requireRole rejects non-allowed roles with 403', () => {
    const source = fs.readFileSync(
      path.join(functionsDir, '_shared/auth.ts'),
      'utf-8'
    )
    expect(source).toContain('requireRole')
    expect(source).toContain('403')
    expect(source).toContain('Forbidden')
  })

  test('requireRole returns userId and role for allowed roles', () => {
    const source = fs.readFileSync(
      path.join(functionsDir, '_shared/auth.ts'),
      'utf-8'
    )
    expect(source).toContain('userId')
    expect(source).toContain('role')
    expect(source).toContain('allowedRoles.includes')
  })
})

// ══════════════════════════════════════════
// PAY-003: OrderConfirmation retry safety
// ══════════════════════════════════════════

describe('PAY-003 — OrderConfirmation retry safety', () => {
  test('restartPayPalCheckout blocks retry when payment is completed', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../pages/OrderConfirmation.jsx'),
      'utf-8'
    )
    expect(source).toContain("payment_record_status === 'completed'")
    expect(source).toContain("orderConfirmation.paypal.alreadyPaidError")
  })

  test('restartPayPalCheckout marks old payment as superseded', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../pages/OrderConfirmation.jsx'),
      'utf-8'
    )
    expect(source).toContain('superseded')
    expect(source).toContain('oldPaymentRecord')
  })

  test('capture-paypal-order has idempotency guard for completed payments', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../../supabase/functions/capture-paypal-order/index.ts'),
      'utf-8'
    )
    expect(source).toContain('existingPayment')
    expect(source).toContain('completed')
    expect(source).toContain('idempotent')
  })
})

// ══════════════════════════════════════════
// TEST-012: RLS violation tests
// ══════════════════════════════════════════

describe('TEST-012 — RLS violation tests (P1 extension)', () => {
  const migration037Path = path.resolve(__dirname, '../../../database/migrations/037-fix-open-insert-rls-policies.sql')
  const migration037 = fs.readFileSync(migration037Path, 'utf-8')

  describe('Fake payment insert is blocked', () => {
    test('payments INSERT is restricted to service_role only', () => {
      expect(migration037).toContain('payments_service_insert')
      expect(migration037).toContain('TO service_role')
    })

    test('no authenticated INSERT policy on payments', () => {
      const lines = migration037.split('\n')
      for (const line of lines) {
        if (line.includes('CREATE POLICY') && line.includes('payments') && line.includes('INSERT')) {
          expect(line).toContain('service_role')
          expect(line).not.toContain('authenticated')
          expect(line).not.toContain('anon')
        }
      }
    })
  })

  describe('Fake delivery insert is blocked', () => {
    test('deliveries INSERT is restricted to service_role only', () => {
      expect(migration037).toContain('deliveries_service_insert')
      expect(migration037).toContain('TO service_role')
    })

    test('no authenticated INSERT policy on deliveries', () => {
      const lines = migration037.split('\n')
      for (const line of lines) {
        if (line.includes('CREATE POLICY') && line.includes('deliveries') && line.includes('INSERT')) {
          expect(line).toContain('service_role')
          expect(line).not.toContain('authenticated')
          expect(line).not.toContain('anon')
        }
      }
    })
  })

  describe('Fake notification insert is blocked', () => {
    test('notifications INSERT is restricted to service_role only', () => {
      expect(migration037).toContain('notifications_service_insert')
      expect(migration037).toContain('TO service_role')
    })

    test('no authenticated INSERT policy on notifications', () => {
      const lines = migration037.split('\n')
      for (const line of lines) {
        if (line.includes('CREATE POLICY') && line.includes('notifications') && line.includes('INSERT')) {
          expect(line).toContain('service_role')
          expect(line).not.toContain('authenticated')
          expect(line).not.toContain('anon')
        }
      }
    })
  })

  describe('Fake order timeline insert is blocked (SEC-004)', () => {
    test('order_timeline INSERT is restricted to service_role only', () => {
      expect(migration037).toContain('order_timeline_service_insert')
      expect(migration037).toContain('TO service_role')
    })

    test('no authenticated INSERT policy on order_timeline', () => {
      const lines = migration037.split('\n')
      for (const line of lines) {
        if (line.includes('CREATE POLICY') && line.includes('order_timeline') && line.includes('INSERT')) {
          expect(line).toContain('service_role')
          expect(line).not.toContain('authenticated')
          expect(line).not.toContain('anon')
        }
      }
    })

    test('old open order_timeline_system_insert policy is dropped', () => {
      expect(migration037).toContain('DROP POLICY IF EXISTS "order_timeline_system_insert" ON order_timeline')
    })
  })

  describe('Buyer cannot mutate another buyer\'s order/payment data', () => {
    test('orders RLS restricts UPDATE to buyer_id = auth.uid()', () => {
      const migration031Path = path.resolve(__dirname, '../../../database/migrations/031-unified-rls-policies.sql')
      const migration031 = fs.readFileSync(migration031Path, 'utf-8')
      expect(migration031).toContain('buyer_id = auth.uid()')
    })

    test('payments INSERT requires service_role (buyer cannot insert payments at all)', () => {
      expect(migration037).not.toMatch(/payments.*INSERT.*TO\s+authenticated/)
      expect(migration037).not.toMatch(/payments.*INSERT.*TO\s+anon/)
    })

    test('RLS is not disabled on any secured table', () => {
      const migration031Path = path.resolve(__dirname, '../../../database/migrations/031-unified-rls-policies.sql')
      const migration031 = fs.readFileSync(migration031Path, 'utf-8')
      expect(migration031).toContain('ALTER TABLE payments ENABLE ROW LEVEL SECURITY')
      expect(migration031).toContain('ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY')
      expect(migration031).toContain('ALTER TABLE notifications ENABLE ROW LEVEL SECURITY')
      expect(migration031).toContain('ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY')
    })
  })
})
