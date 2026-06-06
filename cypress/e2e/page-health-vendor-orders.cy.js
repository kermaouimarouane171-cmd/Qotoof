/// <reference types="cypress" />

/**
 * Page Health + UX Checks + Critical Actions
 * Tests /vendor/orders for an activated vendor.
 * All Supabase calls are mocked. No real backend is touched.
 * No real order is created, updated, or deleted.
 */

// ── Helpers ────────────────────────────────────────────────────────────────

const assertBodyNotEmpty = () => {
  cy.get('body').should('not.be.empty')
}

const assertNoAppCrash = () => {
  cy.get('body').should('not.contain', 'Error Boundary')
  cy.get('body').should('not.contain', 'Something went wrong')
}

const assertNoWhiteScreen = () => {
  assertBodyNotEmpty()
  assertNoAppCrash()
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_VENDOR_USER = {
  id: 'vendor-test-001',
  email: 'vendor@test.ma',
  user_metadata: {},
  aud: 'authenticated',
  role: 'authenticated',
}

const MOCK_VENDOR_PROFILE = {
  id: 'vendor-test-001',
  role: 'vendor',
  first_name: 'Vendor',
  last_name: 'Test',
  store_name: 'Test Store',
  phone: '0612345678',
  email: 'vendor@test.ma',
  paypal_email: 'vendor-paypal@test.ma',
  paypal_verified: true,
  agreement_accepted: true,
  agreement_accepted_at: '2024-01-01T00:00:00Z',
  is_active: true,
  onboarding_completed: true,
  onboarding_step: 100,
  latitude: 34.0209,
  longitude: -6.8416,
  store_address: 'Casablanca, Morocco',
}

const MOCK_VENDOR_SESSION = {
  access_token: 'test-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'test-refresh-token',
  user: MOCK_VENDOR_USER,
}

const MOCK_EMPTY_ORDERS = []

const MOCK_ORDERS = [
  {
    id: 'ord-001',
    vendor_id: 'vendor-test-001',
    order_number: 'ORD-100',
    status: 'pending',
    total_amount: 250,
    payment_method: 'cod',
    payment_status: 'pending',
    items: [
      { id: 'item-001', quantity: 2, product: { name: 'طماطم' } },
      { id: 'item-002', quantity: 1, product: { name: 'تفاح' } },
    ],
    buyer: { first_name: 'أحمد', last_name: 'علي', phone: '0612345678' },
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'ord-002',
    vendor_id: 'vendor-test-001',
    order_number: 'ORD-101',
    status: 'vendor_accepted',
    total_amount: 180,
    payment_method: 'cash',
    payment_status: 'confirmed',
    items: [
      { id: 'item-003', quantity: 3, product: { name: 'بطاطس' } },
    ],
    buyer: { first_name: 'فاطمة', last_name: 'أمين', phone: '0623456789' },
    created_at: '2024-01-14T14:30:00Z',
    deliveries: [],
  },
  {
    id: 'ord-003',
    vendor_id: 'vendor-test-001',
    order_number: 'ORD-102',
    status: 'on_the_way',
    total_amount: 320,
    payment_method: 'paypal',
    payment_status: 'completed',
    items: [
      { id: 'item-004', quantity: 1, product: { name: 'جزر' } },
      { id: 'item-005', quantity: 2, product: { name: 'خيار' } },
    ],
    buyer: { first_name: 'يوسف', last_name: 'خالد', phone: '0634567890' },
    created_at: '2024-01-13T09:15:00Z',
    deliveries: [
      {
        id: 'del-001',
        driver_id: 'driver-001',
        status: 'on_the_way',
        current_latitude: 34.02,
        current_longitude: -6.84,
        delivery_latitude: 34.03,
        delivery_longitude: -6.85,
        driver: { first_name: 'سائق', last_name: 'التجربة', phone: '0645678901' },
      },
    ],
  },
]

// ── Intercept Setup ────────────────────────────────────────────────────────

const setupVendorOrdersIntercepts = (ordersData = MOCK_ORDERS) => {
  // 1. CORS preflights
  cy.intercept('OPTIONS', '**/auth/v1/**', { statusCode: 200, body: {} })
  cy.intercept('OPTIONS', '**/rest/v1/**', { statusCode: 200, body: {} })

  // 2. Auth — MUST use Supabase JS client response format
  cy.intercept('GET', '**/auth/v1/session', {
    statusCode: 200,
    body: {
      data: { session: MOCK_VENDOR_SESSION },
      error: null,
    },
  }).as('authSession')

  cy.intercept('GET', '**/auth/v1/user', {
    statusCode: 200,
    body: MOCK_VENDOR_USER,
  }).as('authUser')

  cy.intercept('POST', '**/auth/v1/token*', {
    statusCode: 200,
    body: {
      access_token: 'test-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      user: MOCK_VENDOR_USER,
    },
  }).as('authRefresh')

  cy.intercept('POST', '**/auth/v1/logout*', { statusCode: 204, body: {} }).as('authLogout')

  // 3. Catch-all REST BEFORE specific overrides
  cy.intercept('GET', '**/rest/v1/**', { statusCode: 200, body: [] }).as('fallbackGet')
  cy.intercept('POST', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackPost')
  cy.intercept('PATCH', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackPatch')

  // 4. Specific REST overrides
  cy.intercept('GET', '**/rest/v1/profiles*', {
    statusCode: 200,
    body: MOCK_VENDOR_PROFILE,
    headers: { 'content-range': '0-0/1' },
  }).as('getProfile')

  cy.intercept('GET', '**/rest/v1/orders*', {
    statusCode: 200,
    body: ordersData,
    headers: ordersData.length > 0 ? { 'content-range': `0-${ordersData.length - 1}/${ordersData.length}` } : {},
  }).as('getOrders')

  cy.intercept('GET', '**/rest/v1/order_items*', {
    statusCode: 200,
    body: [],
  }).as('getOrderItems')

  cy.intercept('GET', '**/rest/v1/notifications*', {
    statusCode: 200,
    body: [],
  }).as('getNotifications')

  cy.intercept('POST', '**/rest/v1/audit_logs', {
    statusCode: 201,
    body: {},
  }).as('auditLog')

  // 5. Edge functions
  cy.intercept('POST', '**/functions/v1/accept-order', {
    statusCode: 200,
    body: { success: true, order: { id: 'ord-001', status: 'vendor_accepted' } },
  }).as('acceptOrder')

  cy.intercept('POST', '**/functions/v1/reject-order', {
    statusCode: 200,
    body: { success: true, order: { id: 'ord-001', status: 'vendor_rejected' } },
  }).as('rejectOrder')

  cy.intercept('POST', '**/functions/v1/assign-driver', {
    statusCode: 200,
    body: { success: true, delivery: { id: 'del-001', status: 'assigned' } },
  }).as('assignDriver')

  cy.intercept('POST', '**/functions/v1/get-public-config', {
    statusCode: 200,
    body: {
      supabase: { url: 'https://test-project.supabase.co', anonKey: 'test-anon-key' },
      sentry: { dsn: null },
      recaptcha: { siteKey: null },
      features: { enableDriverTracking: false },
      app: { name: 'Qotoof', version: '1.0.0' },
    },
  }).as('publicConfig')

  // 6. Realtime websocket
  cy.intercept('POST', '**/realtime/v1/websocket', { statusCode: 200, body: {} }).as('realtimeWs')

  // 7. Storage
  cy.intercept('GET', '**/storage/v1/object/**', { statusCode: 200, body: {} }).as('storageGet')
}

const visitVendorOrders = () => {
  cy.visit('/vendor/orders', {
    failOnStatusCode: false,
    timeout: 20000,
    onBeforeLoad: (win) => {
      win.localStorage.clear()
      win.sessionStorage.clear()
      win.localStorage.setItem(
        'sb-oyaiiyekfkflesdmcvvo-auth-token',
        JSON.stringify(MOCK_VENDOR_SESSION)
      )
    },
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('Vendor Orders Page — Page Health + UX + Critical Actions', () => {
  // ── Single consolidated test to avoid Electron renderer crashes ───────────
  it('page health, UX checks, empty state, orders list, and critical actions', () => {
    setupVendorOrdersIntercepts(MOCK_ORDERS)
    visitVendorOrders()
    cy.wait(10000)

    // ── Page Health ──
    assertNoWhiteScreen()
    cy.url().should('include', '/vendor/orders')
    cy.url().should('not.include', '/login')
    cy.get('body').should('not.contain', 'تفعيل حساب البائع')
    cy.get('body').should('not.contain', 'digital contract')

    // ── UX: Title visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(/إدارة الطلبات|طلباتي|Orders/i.test(text)).to.be.true
    })

    // ── UX: Status filters visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/الكل|All/i)
      expect(text).to.match(/جديدة|Pending|New/i)
      expect(text).to.match(/قيد التحضير|Preparing/i)
      expect(text).to.match(/جاهزة للتوصيل|Ready/i)
      expect(text).to.match(/قيد التوصيل|On the way/i)
      expect(text).to.match(/مكتملة|Delivered|Completed/i)
      expect(text).to.match(/ملغاة|Cancelled/i)
    })

    // ── Orders List: Order numbers visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.include('ORD-100')
      expect(text).to.include('ORD-101')
      expect(text).to.include('ORD-102')
    })

    // ── Orders List: Status badges visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/جديدة|Pending/i)
      expect(text).to.match(/قيد التحضير|Accepted/i)
      expect(text).to.match(/قيد التوصيل|On the way/i)
    })

    // ── Orders List: Amounts visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      // formatPrice returns MAD 250.00 etc.
      expect(text).to.match(/MAD\s*250[.,]00/)
      expect(text).to.match(/MAD\s*180[.,]00/)
      expect(text).to.match(/MAD\s*320[.,]00/)
    })

    // ── Orders List: Item counts visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/2|عدد المنتجات/)
    })

    // ── Orders List: Payment method visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Cash|COD|PayPal|طريقة الدفع/i)
    })

    // ── Orders List: Payment status visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Pending|Confirmed|Completed|حالة الدفع/i)
    })

    // ── Critical: Action buttons for pending order ──
    cy.contains('button', /قبول|Accept/i)
      .should('be.visible')

    cy.contains('button', /رفض|Reject/i)
      .should('be.visible')

    // ── Critical: Action button for vendor_accepted order ──
    cy.contains('button', /تم التحضير|Prepared/i)
      .should('be.visible')

    // ── Critical: Action button for on_the_way order ──
    cy.contains('button', /متابعة التوصيل|Track/i)
      .should('be.visible')

    // ── Critical: Click accept on pending order (safe, intercepted) ──
    cy.contains('button', /قبول|Accept/i)
      .first()
      .click()

    // Wait for the accept-order function call and page reload
    cy.wait(3000)

    // Page should not crash after clicking accept
    assertNoAppCrash()
    cy.url().should('include', '/vendor/orders')

    // ── Empty State (re-visit with empty orders) ──
    setupVendorOrdersIntercepts(MOCK_EMPTY_ORDERS)
    visitVendorOrders()
    cy.wait(10000)

    assertNoAppCrash()
    cy.url().should('include', '/vendor/orders')

    cy.get('body').should(($body) => {
      const text = $body.text()
      const hasEmpty =
        /لا توجد طلبات|No orders|Aucune commande|لم يتم العثور/i.test(text)
      expect(hasEmpty, 'expected empty state text').to.be.true
    })
  })
})
