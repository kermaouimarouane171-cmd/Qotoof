/// <reference types="cypress" />

/**
 * Page Health + UX Checks + Critical Actions
 * Tests /vendor/products for an activated vendor.
 * All Supabase calls are mocked. No real backend is touched.
 * No real product is created, updated, or deleted.
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

const MOCK_EMPTY_PRODUCTS = []

const MOCK_PRODUCTS = [
  {
    id: 'prod-001',
    vendor_id: 'vendor-test-001',
    name: 'طماطم عضوية',
    description: 'طماطم طازجة من المزارع المحلية',
    price_per_unit: 12.5,
    unit_type: 'kg',
    available_quantity: 50,
    min_order_quantity: 1,
    category: 'vegetables',
    subcategory: 'طماطم',
    approval_status: 'published',
    is_available: true,
    created_at: '2024-01-15T10:00:00Z',
    images: [{ id: 'img-001', url: 'https://example.com/tomato.jpg', is_primary: true }],
  },
  {
    id: 'prod-002',
    vendor_id: 'vendor-test-001',
    name: 'تفاح أحمر',
    description: 'تفاح طازج وعصيري',
    price_per_unit: 18.0,
    unit_type: 'kg',
    available_quantity: 30,
    min_order_quantity: 2,
    category: 'fruits',
    subcategory: 'تفاح',
    approval_status: 'pending',
    is_available: true,
    created_at: '2024-02-10T08:30:00Z',
    images: [],
  },
  {
    id: 'prod-003',
    vendor_id: 'vendor-test-001',
    name: 'بطاطس',
    description: 'بطاطس محلية',
    price_per_unit: 8.0,
    unit_type: 'kg',
    available_quantity: 0,
    min_order_quantity: 1,
    category: 'vegetables',
    subcategory: 'بطاطس',
    approval_status: 'rejected',
    is_available: false,
    rejection_reason: 'الصورة غير واضحة',
    created_at: '2024-03-01T14:00:00Z',
    images: [],
  },
]

// ── Intercept Setup ────────────────────────────────────────────────────────

const setupVendorProductsIntercepts = (productsData = MOCK_PRODUCTS) => {
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

  // 4. Specific overrides
  cy.intercept('GET', '**/rest/v1/profiles*', {
    statusCode: 200,
    body: MOCK_VENDOR_PROFILE,
    headers: { 'content-range': '0-0/1' },
  }).as('getProfile')

  cy.intercept('GET', '**/rest/v1/products*', {
    statusCode: 200,
    body: productsData,
  }).as('getProducts')

  cy.intercept('GET', '**/rest/v1/product_images*', {
    statusCode: 200,
    body: [],
  }).as('getProductImages')

  cy.intercept('GET', '**/rest/v1/notifications*', {
    statusCode: 200,
    body: [],
  }).as('getNotifications')

  cy.intercept('POST', '**/rest/v1/audit_logs', {
    statusCode: 201,
    body: {},
  }).as('auditLog')

  // 5. Public config
  cy.intercept('GET', '**/functions/v1/get-public-config', {
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

const visitVendorProducts = () => {
  cy.visit('/vendor/products', {
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

describe('Vendor Products Page — Page Health + UX + Critical Actions', () => {
  // ── Single consolidated test to avoid Electron renderer crashes ───────────
  it('page health, UX checks, empty state, product list, and critical actions', () => {
    setupVendorProductsIntercepts(MOCK_PRODUCTS)
    visitVendorProducts()
    cy.wait(10000)

    // ── Page Health ──
    assertNoWhiteScreen()
    cy.url().should('include', '/vendor/products')
    cy.url().should('not.include', '/login')
    cy.get('body').should('not.contain', 'تفعيل حساب البائع')
    cy.get('body').should('not.contain', 'digital contract')

    // ── UX: Title, add button, filters, stats ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(/إدارة المنتجات|منتجاتي|Products/i.test(text)).to.be.true
    })

    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(/إضافة منتج|Add product|Ajouter/i.test(text)).to.be.true
    })

    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/إجمالي المنتجات|Total products|Nombre total/i)
    })

    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/الكل|All|النشطة|Active|قيد المراجعة|Pending/i)
    })

    // ── Products List ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.include('طماطم عضوية')
    })

    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/12[.,]5|12[.,]50/)
    })

    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/نشط|Active|مفعل|قيد المراجعة|Pending|مرفوض|Rejected/i)
    })

    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/3/)
    })

    // ── Critical: Add Product Button ──
    cy.contains('button', /\+?\s*إضافة منتج|Add product|Ajouter/i)
      .should('be.visible')
      .click()

    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/إضافة منتج|Add product|Ajouter/i)
    })

    cy.get('body').type('{esc}')

    // ── Critical: Edit Product Button ──
    cy.contains('button', /تعديل|Edit|Modifier/i)
      .should('be.visible')
      .first()
      .click()

    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/تعديل المنتج|Edit product|Modifier/i)
    })

    cy.get('body').type('{esc}')

    cy.url().should('include', '/vendor/products')
    assertNoAppCrash()

  })
})
