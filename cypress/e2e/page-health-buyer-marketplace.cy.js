/// <reference types="cypress" />

/**
 * Page Health + UX Checks + Search + Filters + Product Cards
 * Tests the buyer marketplace page at /marketplace
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

// IMPORTANT: vendor names must NOT contain experimental marker words
// (test, demo, sample, dummy, etc.) because filterPublicVendors removes them
const MOCK_VENDORS = [
  {
    id: 'vendor-test-001',
    first_name: 'Ahmed',
    last_name: 'Farmer',
    store_name: 'Green Farm',
    store_description: 'Organic farm produce',
    city: 'Rabat',
    email: 'green@farm.ma',
  },
  {
    id: 'vendor-test-002',
    first_name: 'Fatima',
    last_name: 'Seller',
    store_name: 'Atlas Fruits',
    store_description: 'Fresh fruits daily',
    city: 'Casablanca',
    email: 'atlas@fruits.ma',
  },
]

const MOCK_PRODUCTS = [
  {
    id: 'prod-test-001',
    name: 'Organic Tomatoes',
    description: 'Fresh organic tomatoes grown locally.',
    category: 'vegetables',
    subcategory: 'tomatoes',
    price_per_unit: 25,
    unit_type: 'kg',
    stock_quantity: 85,
    available_quantity: 85,
    min_order_quantity: 1,
    vendor_id: 'vendor-test-001',
    is_available: true,
    approval_status: 'approved',
    created_at: new Date(Date.now() - 7 * 24 * 3600000).toISOString(),
    product_images: [
      { id: 'img-1', url: 'https://example.com/tomato.jpg', is_primary: true },
    ],
  },
  {
    id: 'prod-test-002',
    name: 'Fresh Apples',
    description: 'Sweet and crunchy apples from the Atlas mountains.',
    category: 'fruits',
    subcategory: 'apples',
    price_per_unit: 18,
    unit_type: 'kg',
    stock_quantity: 50,
    available_quantity: 50,
    min_order_quantity: 2,
    vendor_id: 'vendor-test-002',
    is_available: true,
    approval_status: 'approved',
    created_at: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
    product_images: [
      { id: 'img-2', url: 'https://example.com/apple.jpg', is_primary: true },
    ],
  },
]

// ── Intercept Setup ────────────────────────────────────────────────────────

const setupMarketplaceIntercepts = (products = MOCK_PRODUCTS) => {
  // CORS preflights
  cy.intercept('OPTIONS', '**/auth/v1/**', { statusCode: 200, body: {} })
  cy.intercept('OPTIONS', '**/rest/v1/**', { statusCode: 200, body: {} })

  // Auth
  cy.intercept('GET', '**/auth/v1/session', {
    statusCode: 200,
    body: { data: { session: MOCK_BUYER_SESSION }, error: null },
  })
  cy.intercept('GET', '**/auth/v1/user', { statusCode: 200, body: MOCK_BUYER_USER })
  cy.intercept('POST', '**/auth/v1/token*', {
    statusCode: 200,
    body: { access_token: 'test-access-token', token_type: 'bearer', expires_in: 3600, user: MOCK_BUYER_USER },
  })

  // Catch-all REST FIRST
  cy.intercept('GET', '**/rest/v1/**', { statusCode: 200, body: [] }).as('fallbackGet')
  cy.intercept('POST', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackPost')
  cy.intercept('PATCH', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackPatch')

  // Profiles (public vendors query)
  cy.intercept('GET', '**/rest/v1/profiles**', {
    statusCode: 200,
    body: MOCK_VENDORS,
    headers: { 'content-type': 'application/json' },
  }).as('getProfiles')

  // Products (main marketplace query with count header)
  cy.intercept('GET', '**/rest/v1/products**', {
    statusCode: 200,
    body: products,
    headers: {
      'content-type': 'application/json',
      'content-range': `0-${Math.max(0, products.length - 1)}/${products.length}`,
    },
  }).as('getProducts')

  // Notifications
  cy.intercept('GET', '**/rest/v1/notifications*', { statusCode: 200, body: [] }).as('getNotifications')

  // Audit logs
  cy.intercept('POST', '**/rest/v1/audit_logs', { statusCode: 201, body: {} }).as('auditLog')

  // Public config
  cy.intercept('POST', '**/functions/v1/get-public-config', {
    statusCode: 200,
    body: { app: { name: 'Qotoof', version: '1.0.0' } },
  }).as('publicConfig')

  // Realtime
  cy.intercept('POST', '**/realtime/v1/websocket', { statusCode: 200, body: {} }).as('realtimeWs')
}

const visitMarketplace = () => {
  cy.visit('/marketplace', {
    failOnStatusCode: false,
    timeout: 20000,
    onBeforeLoad: (win) => {
      win.localStorage.clear()
      win.sessionStorage.clear()
      win.localStorage.setItem('sb-oyaiiyekfkflesdmcvvo-auth-token', JSON.stringify(MOCK_BUYER_SESSION))
    },
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('Buyer Marketplace Page — Page Health + UX + Search + Filters + Product Cards', () => {
  it('page health, product cards, and empty state', () => {
    // ── Part 1: Marketplace with products ──
    setupMarketplaceIntercepts(MOCK_PRODUCTS)
    visitMarketplace()
    cy.wait(10000)

    // Page Health
    cy.get('body').should('not.be.empty')
    assertNoAppCrash()
    cy.url().should('include', '/marketplace')
    cy.url().should('not.include', '/login')

    // UX: Page title visible
    cy.get('body').should(($body) => {
      expect($body.text()).to.match(/Marketplace|السوق|Products|المنتجات/i)
    })

    // UX: Product names visible
    cy.get('body').should(($body) => {
      expect($body.text()).to.include('Organic Tomatoes')
      expect($body.text()).to.include('Fresh Apples')
    })

    // UX: Prices visible
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/25/)
      expect(text).to.match(/18/)
    })

    // UX: Categories visible
    cy.get('body').should(($body) => {
      expect($body.text()).to.match(/vegetables|fruits|Vegetables|Fruits/i)
    })

    // UX: Search input visible
    cy.get('body').should(($body) => {
      expect($body.text()).to.match(/Search|بحث/i)
    })

    // UX: Product cards rendered
    cy.get('[data-testid="product-card"]').should('have.length.at.least', 1)

    // ── Part 2: Empty state ──
    setupMarketplaceIntercepts([])
    visitMarketplace()
    cy.wait(8000)

    assertNoAppCrash()
    cy.url().should('include', '/marketplace')

    cy.get('body').should(($body) => {
      const text = $body.text()
      const hasEmptyState = /لا توجد منتجات|No matching products|Aucun produit|empty|لم نتمكن/i.test(text)
      expect(hasEmptyState).to.be.true
    })
  })
})
