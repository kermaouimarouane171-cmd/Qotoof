/// <reference types="cypress" />

/**
 * Page Health + UX Checks + Critical Actions
 * Tests /driver/active and /driver/history for an activated driver.
 * All Supabase calls are mocked. No real backend is touched.
 * No real delivery is created, updated, or completed.
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

const MOCK_DRIVER_USER = {
  id: 'driver-test-001',
  email: 'driver@test.ma',
  user_metadata: {},
  aud: 'authenticated',
  role: 'authenticated',
}

const MOCK_DRIVER_PROFILE = {
  id: 'driver-test-001',
  role: 'driver',
  first_name: 'Ahmed',
  last_name: 'Driver',
  phone: '0612345678',
  email: 'driver@test.ma',
  vehicle_type: 'motorcycle',
  total_deliveries: 42,
  driver_rating: 4.8,
  is_active: true,
  onboarding_completed: true,
  onboarding_step: 100,
  vendor_search_done: true,
  paypal_email: 'driver-paypal@test.ma',
  paypal_verified: true,
}

const MOCK_DRIVER_SESSION = {
  access_token: 'test-driver-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'test-driver-refresh',
  user: MOCK_DRIVER_USER,
}

// Mock deliveries for /driver/active (active statuses)
const MOCK_ACTIVE_DELIVERIES = [
  {
    id: 'del-active-001',
    order_id: 'ord-100',
    driver_id: 'driver-test-001',
    status: 'assigned',
    created_at: '2024-01-15T10:00:00Z',
    assigned_at: '2024-01-15T10:05:00Z',
    delivery_number: 'DEL-100',
    delivery_price: 25,
    delivery_address: '456 Customer Ave, Casablanca',
    estimated_delivery_time: '2024-01-15T12:00:00Z',
    order: {
      order_number: 'ORD-100',
      vendor: { store_name: 'Fresh Market' },
      buyer: { first_name: 'Ali', phone: '0611111111' },
    },
  },
  {
    id: 'del-active-002',
    order_id: 'ord-101',
    driver_id: 'driver-test-001',
    status: 'on_the_way',
    created_at: '2024-01-15T14:00:00Z',
    assigned_at: '2024-01-15T14:05:00Z',
    delivery_number: 'DEL-101',
    delivery_price: 30,
    delivery_address: '321 Home St, Rabat',
    estimated_delivery_time: '2024-01-15T16:00:00Z',
    order: {
      order_number: 'ORD-101',
      vendor: { store_name: 'Organic Farm' },
      buyer: { first_name: 'Fatima', phone: '0622222222' },
    },
  },
]

// Mock deliveries for /driver/history (delivered/cancelled)
const MOCK_HISTORY_DELIVERIES = [
  {
    id: 'del-hist-001',
    driver_id: 'driver-test-001',
    status: 'delivered',
    delivery_number: 'DEL-200',
    delivery_price: 20,
    distance_km: 5.2,
    delivery_address: '789 Residence St, Marrakech',
    is_late: false,
    created_at: '2024-01-10T09:00:00Z',
    delivered_at: '2024-01-10T10:30:00Z',
    completed_at: '2024-01-10T10:30:00Z',
    order: {
      order_number: 'ORD-200',
      vendor: { store_name: 'Green Valley' },
      buyer: { first_name: 'Youssef', last_name: 'Benali' },
    },
  },
  {
    id: 'del-hist-002',
    driver_id: 'driver-test-001',
    status: 'delivered',
    delivery_number: 'DEL-201',
    delivery_price: 35,
    distance_km: 12.5,
    delivery_address: '123 Palace Rd, Fez',
    is_late: true,
    created_at: '2024-01-12T11:00:00Z',
    delivered_at: '2024-01-12T13:15:00Z',
    completed_at: '2024-01-12T13:15:00Z',
    order: {
      order_number: 'ORD-201',
      vendor: { store_name: 'Mountain Farms' },
      buyer: { first_name: 'Sara', last_name: 'Khalid' },
    },
  },
  {
    id: 'del-hist-003',
    driver_id: 'driver-test-001',
    status: 'cancelled',
    delivery_number: 'DEL-202',
    delivery_price: 15,
    distance_km: 3.0,
    delivery_address: '555 Beach Ln, Agadir',
    is_late: false,
    created_at: '2024-01-13T08:00:00Z',
    delivered_at: null,
    completed_at: null,
    order: {
      order_number: 'ORD-202',
      vendor: { store_name: 'Coastal Produce' },
      buyer: { first_name: 'Karim', last_name: 'Hassan' },
    },
  },
]

const MOCK_EMPTY_DELIVERIES = []

// ── Intercept Setup ────────────────────────────────────────────────────────

const setupDriverDeliveriesIntercepts = (activeData = MOCK_ACTIVE_DELIVERIES, historyData = MOCK_HISTORY_DELIVERIES) => {
  // 1. CORS preflights
  cy.intercept('OPTIONS', '**/auth/v1/**', { statusCode: 200, body: {} })
  cy.intercept('OPTIONS', '**/rest/v1/**', { statusCode: 200, body: {} })

  // 2. Auth — Supabase JS client format
  cy.intercept('GET', '**/auth/v1/session', {
    statusCode: 200,
    body: { data: { session: MOCK_DRIVER_SESSION }, error: null },
  }).as('authSession')

  cy.intercept('GET', '**/auth/v1/user', {
    statusCode: 200,
    body: MOCK_DRIVER_USER,
  }).as('authUser')

  cy.intercept('POST', '**/auth/v1/token*', {
    statusCode: 200,
    body: {
      access_token: 'test-driver-token',
      token_type: 'bearer',
      expires_in: 3600,
      user: MOCK_DRIVER_USER,
    },
  }).as('authRefresh')

  cy.intercept('POST', '**/auth/v1/logout*', { statusCode: 204, body: {} }).as('authLogout')

  // 3. Catch-all REST BEFORE specific overrides
  cy.intercept('GET', '**/rest/v1/**', { statusCode: 200, body: [] }).as('fallbackGet')
  cy.intercept('POST', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackPost')
  cy.intercept('PATCH', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackPatch')

  // 4. Specific REST overrides — order matters (last added wins in Cypress)
  cy.intercept('GET', '**/rest/v1/profiles*', {
    statusCode: 200,
    body: MOCK_DRIVER_PROFILE,
    headers: { 'content-range': '0-0/1' },
  }).as('getProfile')

  // For /driver/active — deliveriesApi.getDriverDeliveries returns { data, total }
  // The actual URL may have driver_id=eq. filter
  cy.intercept('GET', '**/rest/v1/deliveries*', (req) => {
    // Check if it's the active page or history page based on referrer or query params
    const url = req.url
    if (url.includes('completed_at') || url.includes('delivered_at')) {
      // History query
      req.reply({
        statusCode: 200,
        body: historyData,
        headers: historyData.length > 0
          ? { 'content-range': `0-${historyData.length - 1}/${historyData.length}` }
          : {},
      })
    } else {
      // Active query (default)
      req.reply({
        statusCode: 200,
        body: activeData,
        headers: activeData.length > 0
          ? { 'content-range': `0-${activeData.length - 1}/${activeData.length}` }
          : {},
      })
    }
  }).as('getDeliveries')

  cy.intercept('GET', '**/rest/v1/orders*', {
    statusCode: 200,
    body: [],
  }).as('getOrders')

  cy.intercept('GET', '**/rest/v1/notifications*', {
    statusCode: 200,
    body: [],
  }).as('getNotifications')

  cy.intercept('POST', '**/rest/v1/audit_logs', {
    statusCode: 201,
    body: {},
  }).as('auditLog')

  // 5. Edge functions
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

const visitDriverActive = () => {
  cy.visit('/driver/active', {
    failOnStatusCode: false,
    timeout: 20000,
    onBeforeLoad: (win) => {
      win.localStorage.clear()
      win.sessionStorage.clear()
      win.localStorage.setItem(
        'sb-oyaiiyekfkflesdmcvvo-auth-token',
        JSON.stringify(MOCK_DRIVER_SESSION)
      )
    },
  })
}

const visitDriverHistory = () => {
  cy.visit('/driver/history', {
    failOnStatusCode: false,
    timeout: 20000,
    onBeforeLoad: (win) => {
      win.localStorage.clear()
      win.sessionStorage.clear()
      win.localStorage.setItem(
        'sb-oyaiiyekfkflesdmcvvo-auth-token',
        JSON.stringify(MOCK_DRIVER_SESSION)
      )
    },
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('Driver Deliveries — Page Health + UX + Critical Actions', () => {
  // ── Single consolidated test to avoid Electron renderer crashes ───────────
  it('page health, UX checks, empty state, deliveries list, and critical actions', () => {
    // ═══════════════════════════════════════════════════════════════════════
    // PART 1: /driver/active — Active Deliveries
    // ═══════════════════════════════════════════════════════════════════════
    setupDriverDeliveriesIntercepts(MOCK_ACTIVE_DELIVERIES, MOCK_HISTORY_DELIVERIES)
    visitDriverActive()
    cy.wait(10000)

    // ── Page Health ──
    assertNoWhiteScreen()
    cy.url().should('include', '/driver/active')
    cy.url().should('not.include', '/login')
    cy.url().should('not.include', '/onboarding')
    cy.url().should('not.include', '/vendor')

    // ── UX: Title visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(/Active Delivery|Active Deliveries|Active|توصيلات/i.test(text)).to.be.true
    })

    // ── UX: Deliveries list visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.include('DEL-100')
      expect(text).to.include('DEL-101')
      expect(text).to.include('Fresh Market')
      expect(text).to.include('Organic Farm')
      expect(text).to.include('Ali')
      expect(text).to.include('Fatima')
    })

    // ── UX: Status badges visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Assigned|Accepted|Picked Up|On the Way/i)
    })

    // ── UX: Delivery details visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/MAD\s*25[.,]00/)
      expect(text).to.match(/MAD\s*30[.,]00/)
      expect(text).to.match(/Casablanca|Rabat/)
    })

    // ── UX: Call button visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Call|اتصال/i)
    })

    // ── Critical: View Tracking button ──
    cy.contains('button', /View Tracking|Tracking/i)
      .should('be.visible')

    // ── Critical: Click View Tracking (safe, navigates to tracking route) ──
    cy.contains('button', /View Tracking|Tracking/i)
      .first()
      .click()

    cy.wait(2000)
    assertNoAppCrash()

    // ═══════════════════════════════════════════════════════════════════════
    // PART 2: /driver/active — Empty State
    // ═══════════════════════════════════════════════════════════════════════
    setupDriverDeliveriesIntercepts(MOCK_EMPTY_DELIVERIES, MOCK_HISTORY_DELIVERIES)
    visitDriverActive()
    cy.wait(10000)

    assertNoAppCrash()
    cy.url().should('include', '/driver/active')

    cy.get('body').should(($body) => {
      const text = $body.text()
      const hasEmpty =
        /No Active Delivery|No active|لا توجد|Aucune livraison/i.test(text)
      expect(hasEmpty, 'expected empty state text').to.be.true
    })

    // ── Empty state CTA button ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/View Available Deliveries|Available|توصيلات/i)
    })

    // ═══════════════════════════════════════════════════════════════════════
    // PART 3: /driver/history — Delivery History
    // ═══════════════════════════════════════════════════════════════════════
    setupDriverDeliveriesIntercepts(MOCK_ACTIVE_DELIVERIES, MOCK_HISTORY_DELIVERIES)
    visitDriverHistory()
    cy.wait(10000)

    // ── Page Health ──
    assertNoWhiteScreen()
    cy.url().should('include', '/driver/history')
    cy.url().should('not.include', '/login')
    cy.url().should('not.include', '/onboarding')

    // ── UX: Title visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(/Delivery History|History|سجل/i.test(text)).to.be.true
    })

    // ── UX: Metrics cards visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Total earnings| earnings/i)
      expect(text).to.match(/Completed|مكتمل/i)
      expect(text).to.match(/Cancelled|ملغاة/i)
      expect(text).to.match(/Average per delivery|Average/i)
    })

    // ── UX: Deliveries list visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.include('DEL-200')
      expect(text).to.include('DEL-201')
      expect(text).to.include('Green Valley')
      expect(text).to.include('Mountain Farms')
      expect(text).to.include('Youssef')
      expect(text).to.include('Sara')
    })

    // ── UX: Status badges visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Delivered|مسلّمة/i)
      expect(text).to.match(/Cancelled|ملغاة/i)
    })

    // ── UX: Delivery details visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/MAD\s*20[.,]00/)
      expect(text).to.match(/MAD\s*35[.,]00/)
      expect(text).to.match(/km/)
    })

    // ── UX: Late delivery warning ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Late|متأخر/i)
    })

    // ── UX: Filter buttons visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Filters|Filter|فلتر/i)
      expect(text).to.match(/Refresh|تحديث/i)
    })

    // ═══════════════════════════════════════════════════════════════════════
    // PART 4: /driver/history — Empty State
    // ═══════════════════════════════════════════════════════════════════════
    setupDriverDeliveriesIntercepts(MOCK_ACTIVE_DELIVERIES, MOCK_EMPTY_DELIVERIES)
    visitDriverHistory()
    cy.wait(10000)

    assertNoAppCrash()
    cy.url().should('include', '/driver/history')

    cy.get('body').should(($body) => {
      const text = $body.text()
      const hasEmpty =
        /No deliveries|No deliveries yet|لا توجد|Aucune livraison/i.test(text)
      expect(hasEmpty, 'expected empty state text').to.be.true
    })

    // Metrics should show zeros
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.include('0')
    })
  })
})
