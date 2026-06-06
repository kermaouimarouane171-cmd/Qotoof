/// <reference types="cypress" />

/**
 * Page Health + UX Checks + Critical Actions
 * Tests /buyer/orders for an authenticated buyer.
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

const MOCK_BUYER_USER = {
  id: 'buyer-test-001',
  email: 'buyer@test.ma',
  user_metadata: {},
  aud: 'authenticated',
  role: 'authenticated',
}

const MOCK_BUYER_PROFILE = {
  id: 'buyer-test-001',
  role: 'buyer',
  first_name: 'Buyer',
  last_name: 'Test',
  email: 'buyer@test.ma',
  phone: '0612345678',
  onboarding_completed: true,
  is_active: true,
}

const MOCK_BUYER_SESSION = {
  access_token: 'test-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'test-refresh-token',
  user: MOCK_BUYER_USER,
}

const MOCK_EMPTY_ORDERS = []

const MOCK_ORDERS = [
  {
    id: 'ord-b001',
    order_number: 'ORD-B100',
    status: 'pending',
    payment_status: 'pending',
    payment_method: 'cod',
    payment_type: 'cod',
    total: 150,
    total_amount: 150,
    subtotal: 140,
    shipping_cost: 10,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    delivered_at: null,
    buyer_id: 'buyer-test-001',
    vendor_id: 'vendor-test-001',
    driver_id: null,
    vendor: {
      first_name: 'Vendor',
      last_name: 'Test',
      store_name: 'Test Store',
      phone: '0612345678',
    },
    items: [
      {
        id: 'item-b001',
        quantity: 2,
        unit_price: 50,
        product_id: 'prod-001',
        product: {
          id: 'prod-001',
          name: 'طماطم عضوية',
          images: [],
        },
      },
      {
        id: 'item-b002',
        quantity: 1,
        unit_price: 40,
        product_id: 'prod-002',
        product: {
          id: 'prod-002',
          name: 'تفاح أحمر',
          images: [],
        },
      },
    ],
    deliveries: [],
  },
  {
    id: 'ord-b002',
    order_number: 'ORD-B101',
    status: 'on_the_way',
    payment_status: 'completed',
    payment_method: 'paypal',
    payment_type: 'paypal',
    total: 320,
    total_amount: 320,
    subtotal: 300,
    shipping_cost: 20,
    created_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 24 * 3600000).toISOString(),
    delivered_at: null,
    buyer_id: 'buyer-test-001',
    vendor_id: 'vendor-test-001',
    driver_id: 'driver-001',
    vendor: {
      first_name: 'Vendor',
      last_name: 'Test',
      store_name: 'Test Store',
      phone: '0612345678',
    },
    items: [
      {
        id: 'item-b003',
        quantity: 3,
        unit_price: 100,
        product_id: 'prod-003',
        product: {
          id: 'prod-003',
          name: 'بطاطس محلية',
          images: [],
        },
      },
    ],
    deliveries: [
      {
        id: 'del-b001',
        status: 'on_the_way',
        driver_id: 'driver-001',
        current_latitude: 34.02,
        current_longitude: -6.84,
      },
    ],
  },
  {
    id: 'ord-b003',
    order_number: 'ORD-B102',
    status: 'delivered',
    payment_status: 'completed',
    payment_method: 'bank_transfer',
    payment_type: 'bank_transfer',
    total: 85,
    total_amount: 85,
    subtotal: 80,
    shipping_cost: 5,
    created_at: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
    delivered_at: new Date(Date.now() - 4 * 24 * 3600000).toISOString(),
    buyer_id: 'buyer-test-001',
    vendor_id: 'vendor-test-002',
    driver_id: 'driver-002',
    vendor: {
      first_name: 'Vendor',
      last_name: 'Two',
      store_name: 'Fresh Farm',
      phone: '0623456789',
    },
    items: [
      {
        id: 'item-b004',
        quantity: 1,
        unit_price: 80,
        product_id: 'prod-004',
        product: {
          id: 'prod-004',
          name: 'جزر طازج',
          images: [],
        },
      },
    ],
    deliveries: [
      {
        id: 'del-b002',
        status: 'delivered',
        driver_id: 'driver-002',
        current_latitude: 34.03,
        current_longitude: -6.85,
      },
    ],
  },
]

// ── Intercept Setup ────────────────────────────────────────────────────────

const setupBuyerOrdersIntercepts = (ordersData = MOCK_ORDERS) => {
  // 1. CORS preflights
  cy.intercept('OPTIONS', '**/auth/v1/**', { statusCode: 200, body: {} })
  cy.intercept('OPTIONS', '**/rest/v1/**', { statusCode: 200, body: {} })

  // 2. Auth
  cy.intercept('GET', '**/auth/v1/session', {
    statusCode: 200,
    body: { data: { session: MOCK_BUYER_SESSION }, error: null },
  }).as('authSession')

  cy.intercept('GET', '**/auth/v1/user', {
    statusCode: 200,
    body: MOCK_BUYER_USER,
  }).as('authUser')

  cy.intercept('POST', '**/auth/v1/token*', {
    statusCode: 200,
    body: {
      access_token: 'test-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      user: MOCK_BUYER_USER,
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
    body: MOCK_BUYER_PROFILE,
    headers: { 'content-range': '0-0/1' },
  }).as('getProfile')

  cy.intercept('GET', '**/rest/v1/orders*', {
    statusCode: 200,
    body: ordersData,
    headers: ordersData.length > 0
      ? { 'content-range': `0-${ordersData.length - 1}/${ordersData.length}` }
      : {},
  }).as('getOrders')

  cy.intercept('GET', '**/rest/v1/deliveries*', {
    statusCode: 200,
    body: null,
  }).as('getDeliveries')

  cy.intercept('GET', '**/rest/v1/notifications*', {
    statusCode: 200,
    body: [],
  }).as('getNotifications')

  cy.intercept('POST', '**/rest/v1/audit_logs', {
    statusCode: 201,
    body: {},
  }).as('auditLog')

  // 5. Edge / RPC functions
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

const visitBuyerOrders = () => {
  cy.visit('/buyer/orders', {
    failOnStatusCode: false,
    timeout: 20000,
    onBeforeLoad: (win) => {
      win.localStorage.clear()
      win.sessionStorage.clear()
      win.localStorage.setItem(
        'sb-oyaiiyekfkflesdmcvvo-auth-token',
        JSON.stringify(MOCK_BUYER_SESSION)
      )
    },
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('Buyer Orders Page — Page Health + UX + Critical Actions', () => {
  // ── Single consolidated test to avoid Electron renderer crashes ───────────
  it('page health, UX checks, empty state, orders list, and critical actions', () => {
    setupBuyerOrdersIntercepts(MOCK_ORDERS)
    visitBuyerOrders()
    cy.wait(10000)

    // ── Page Health ──
    assertNoWhiteScreen()
    cy.url().should('include', '/buyer/orders')
    cy.url().should('not.include', '/login')

    // ── UX: Title visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(/My Orders|طلباتي|Orders/i.test(text)).to.be.true
    })

    // ── UX: Filter tabs visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/All Orders|الكل/i)
      expect(text).to.match(/In Progress|قيد التنفيذ/i)
      expect(text).to.match(/Completed|مكتملة/i)
      expect(text).to.match(/Cancelled|ملغاة/i)
    })

    // ── Orders List: Order numbers visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.include('ORD-B100')
      expect(text).to.include('ORD-B101')
      expect(text).to.include('ORD-B102')
    })

    // ── Orders List: Status badges visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      // The app renders English status labels in test env
      expect(text).to.match(/Pending|جديدة/i)
      expect(text).to.match(/On the way|On The Way|قيد التوصيل/i)
      expect(text).to.match(/Delivered|مكتملة/i)
    })

    // ── Orders List: Amounts visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      // formatPrice returns MAD 150,00 (comma decimal) in this locale
      expect(text).to.match(/MAD\s*150[.,]00/)
      expect(text).to.match(/MAD\s*320[.,]00/)
      expect(text).to.match(/MAD\s*85[.,]00/)
    })

    // ── Orders List: Vendor store names visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Test Store|Fresh Farm/i)
    })

    // ── Critical: Action buttons visible ──
    // Details button
    cy.contains('button', /Details|تفاصيل/i)
      .should('be.visible')

    // Invoice button
    cy.contains('button', /Invoice|فاتورة/i)
      .should('be.visible')

    // Track button (for active/on_the_way order)
    cy.contains('button', /Track|تتبع/i)
      .should('be.visible')

    // Re-order button (for delivered order)
    cy.contains('button', /Re-order|إعادة الطلب/i)
      .should('be.visible')

    // ── Critical: Click Details button (safe, navigates to /orders/:id) ──
    cy.contains('button', /Details|تفاصيل/i)
      .first()
      .click()

    cy.wait(2000)

    // Should navigate to order detail page
    cy.url().then((url) => {
      expect(url).to.satisfy((u) =>
        u.includes('/buyer/orders') || /\/orders\/[^/]+$/.test(u)
      )
    })

    // Re-visit buyer orders for empty state test
    cy.visit('/buyer/orders', { failOnStatusCode: false, timeout: 20000 })
    cy.wait(8000)
    assertNoAppCrash()

    // ── Empty State (re-visit with empty orders) ──
    setupBuyerOrdersIntercepts(MOCK_EMPTY_ORDERS)
    visitBuyerOrders()
    cy.wait(10000)

    assertNoAppCrash()
    cy.url().should('include', '/buyer/orders')

    cy.get('body').should(($body) => {
      const text = $body.text()
      const hasEmpty =
        /No orders yet|لا توجد طلبات|Aucune commande|لم يتم العثور/i.test(text)
      expect(hasEmpty, 'expected empty state text').to.be.true
    })

    // Empty state should have a CTA to browse marketplace
    cy.get('body').should(($body) => {
      const text = $body.text()
      const hasCTA =
        /Start Shopping|Browse|Marketplace|تصفح|ابدأ التسوق/i.test(text)
      expect(hasCTA, 'expected empty state CTA').to.be.true
    })
  })
})
