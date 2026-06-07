/// <reference types="cypress" />

/**
 * Page Health + UX Checks + Critical Actions
 * Tests the buyer product details page at /product/:id
 * All Supabase calls are mocked. No real backend is touched.
 */

// ── Helpers ────────────────────────────────────────────────────────────────

const assertNoAppCrash = () => {
  cy.get('body').should('not.contain', 'Error Boundary')
  cy.get('body').should('not.contain', 'Something went wrong')
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_BUYER_USER = {
  id: 'buyer-test-001',
  email: 'buyer@test.ma',
  user_metadata: {},
  aud: 'authenticated',
  role: 'authenticated',
}

const MOCK_BUYER_SESSION = {
  access_token: 'test-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'test-refresh-token',
  user: MOCK_BUYER_USER,
}

const MOCK_PRODUCT = {
  id: 'prod-test-001',
  name: 'Organic Tomatoes',
  description: 'Fresh organic tomatoes grown locally without pesticides.',
  category: 'vegetables',
  subcategory: 'tomatoes',
  price_per_unit: 25,
  unit_type: 'kg',
  stock_quantity: 100,
  available_quantity: 85,
  min_order_quantity: 1,
  vendor_id: 'vendor-test-001',
  is_available: true,
  approval_status: 'published',
  is_organic: true,
  is_local: true,
  created_at: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
  updated_at: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
  vendor: {
    id: 'vendor-test-001',
    first_name: 'Ahmed',
    last_name: 'Test',
    store_name: 'Green Farm',
    store_description: 'Organic farm produce since 2010',
    avatar_url: null,
    city: 'Rabat',
    country: 'Morocco',
    latitude: 34.02,
    longitude: -6.84,
  },
  product_images: [
    { id: 'img-1', url: 'https://example.com/tomato.jpg', is_primary: true },
  ],
}

const MOCK_OUT_OF_STOCK_PRODUCT = {
  ...MOCK_PRODUCT,
  id: 'prod-test-002',
  name: 'Out of Stock Item',
  is_available: false,
  stock_quantity: 0,
  available_quantity: 0,
}

// ── Intercept Setup ────────────────────────────────────────────────────────

const setupProductDetailIntercepts = (product = MOCK_PRODUCT) => {
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

  // 3. Catch-all REST FIRST (specific overrides added after will win)
  cy.intercept('GET', '**/rest/v1/**', { statusCode: 200, body: [] }).as('fallbackGet')
  cy.intercept('POST', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackPost')
  cy.intercept('PATCH', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackPatch')

  // 4. Products — return OBJECT because .single() expects object+json response
  cy.intercept('GET', '**/rest/v1/products**', {
    statusCode: 200,
    body: product,
  }).as('getProduct')

  // 5. Reviews (no .single(), array is correct)
  cy.intercept('GET', '**/rest/v1/reviews**', {
    statusCode: 200,
    body: [],
  }).as('getReviews')

  // 6. Refund policies — .single() throws on empty array, component catches gracefully
  cy.intercept('GET', '**/rest/v1/refund_policies**', {
    statusCode: 200,
    body: [],
  }).as('getRefundPolicy')

  // 7. Waitlists — .single() throws on empty array, component catches gracefully
  cy.intercept('GET', '**/rest/v1/product_waitlists**', {
    statusCode: 200,
    body: [],
  }).as('getWaitlist')

  // 8. Notifications
  cy.intercept('GET', '**/rest/v1/notifications*', {
    statusCode: 200,
    body: [],
  }).as('getNotifications')

  // 9. Audit logs
  cy.intercept('POST', '**/rest/v1/audit_logs', {
    statusCode: 201,
    body: {},
  }).as('auditLog')

  // 10. Public config
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

  // 11. Realtime
  cy.intercept('POST', '**/realtime/v1/websocket', { statusCode: 200, body: {} }).as('realtimeWs')

}

const visitProductDetail = (productId = 'prod-test-001') => {
  cy.visit(`/product/${productId}`, {
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

describe('Buyer Product Details Page — Page Health + UX + Critical Actions', () => {
  // Single consolidated test to avoid Electron renderer crashes
  it('page health, UX checks, in-stock and out-of-stock states, and critical actions', () => {
    // ── Test 1: In-stock product ──
    setupProductDetailIntercepts(MOCK_PRODUCT)
    visitProductDetail('prod-test-001')
    cy.wait(12000)

    // Page Health
    cy.get('body').should('not.be.empty')
    assertNoAppCrash()
    cy.url().should('include', '/product/prod-test-001')
    cy.url().should('not.include', '/login')

    // UX: Product name
    cy.get('body').should(($body) => {
      expect($body.text()).to.include('Organic Tomatoes')
    })

    // UX: Price
    cy.get('body').should(($body) => {
      expect($body.text()).to.match(/MAD\s*25[.,]00/)
    })

    // UX: Description
    cy.get('body').should(($body) => {
      expect($body.text()).to.match(/Fresh organic tomatoes/i)
    })

    // UX: Category
    cy.get('body').should(($body) => {
      expect($body.text()).to.match(/vegetables|Vegetables/i)
    })

    // UX: Unit
    cy.get('body').should(($body) => {
      expect($body.text()).to.match(/kg|per kg/i)
    })

    // UX: Vendor info
    cy.get('body').should(($body) => {
      expect($body.text()).to.match(/Green Farm|Ahmed/i)
    })

    // UX: Availability
    cy.get('body').should(($body) => {
      expect($body.text()).to.match(/Available|Available:|متوفر|In Stock/i)
    })

    // UX: Quantity selector
    cy.get('body').should(($body) => {
      expect($body.text()).to.match(/Quantity|الكمية/i)
    })

    // UX: Min order
    cy.get('body').should(($body) => {
      expect($body.text()).to.match(/Min order|الحد الأدنى/i)
    })

    // UX: Breadcrumb
    cy.get('body').should(($body) => {
      expect($body.text()).to.match(/Home|Marketplace|الرئيسية|السوق/i)
    })

    // UX: Reviews
    cy.get('body').should(($body) => {
      expect($body.text()).to.match(/Reviews|تقييمات/i)
    })

    // UX: Delivery rules explanation visible
    cy.get('body').should(($body) => {
      expect($body.text()).to.match(/كيف يعمل التوصيل|توصيل|delivery/i)
    })

    // Critical: Add to Cart visible and clickable
    cy.contains('button', /Add to Cart|إضافة إلى السلة/i)
      .should('be.visible')
      .should('not.be.disabled')
      .click()

    cy.wait(2000)
    assertNoAppCrash()

    // ── Test 2: Out-of-stock product ──
    setupProductDetailIntercepts(MOCK_OUT_OF_STOCK_PRODUCT)
    visitProductDetail('prod-test-002')
    cy.wait(12000)

    assertNoAppCrash()
    cy.url().should('include', '/product/prod-test-002')

    cy.get('body').should(($body) => {
      expect($body.text()).to.include('Out of Stock Item')
    })

    cy.get('body').should(($body) => {
      expect($body.text()).to.match(/Out of Stock|Out Of Stock|غير متوفر/i)
    })

    cy.contains('button', /Add to Cart|إضافة إلى السلة/i)
      .should('be.visible')
      .should('be.disabled')
  })
})
