/// <reference types="cypress" />

/**
 * Page Health + UX Checks + Critical Actions
 * Tests /driver/dashboard for an activated driver.
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
  current_latitude: 33.5731,
  current_longitude: -7.5898,
}

const MOCK_DRIVER_SESSION = {
  access_token: 'test-driver-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'test-driver-refresh',
  user: MOCK_DRIVER_USER,
}

// Mock deliveries with various statuses
const MOCK_DELIVERIES = [
  {
    id: 'del-001',
    order_id: 'ord-001',
    driver_id: 'driver-test-001',
    status: 'delivered',
    created_at: '2024-01-15T10:00:00Z',
    assigned_at: '2024-01-15T10:05:00Z',
    delivered_at: new Date().toISOString(), // today
    is_late: false,
    delivery_price: 25,
    pickup_address: '123 Vendor St, Casablanca',
    delivery_address: '456 Customer Ave, Casablanca',
    pickup_latitude: 33.5731,
    pickup_longitude: -7.5898,
    delivery_latitude: 33.58,
    delivery_longitude: -7.60,
    current_latitude: 33.575,
    current_longitude: -7.595,
    estimated_delivery_time: '2024-01-15T12:00:00Z',
    actual_delivery_time: '2024-01-15T11:45:00Z',
    order: {
      order_number: 'ORD-001',
      total: 250,
      shipping_city: 'Casablanca',
      buyer: { first_name: 'Ali', phone: '0611111111' },
      vendor: { first_name: 'Hassan', store_name: 'Fresh Market' },
    },
  },
  {
    id: 'del-002',
    order_id: 'ord-002',
    driver_id: 'driver-test-001',
    status: 'assigned',
    created_at: '2024-01-15T14:00:00Z',
    assigned_at: '2024-01-15T14:05:00Z',
    is_late: false,
    delivery_price: 30,
    pickup_address: '789 Market Rd, Rabat',
    delivery_address: '321 Home St, Rabat',
    pickup_latitude: 34.02,
    pickup_longitude: -6.84,
    delivery_latitude: 34.03,
    delivery_longitude: -6.85,
    order: {
      order_number: 'ORD-002',
      total: 180,
      shipping_city: 'Rabat',
      buyer: { first_name: 'Fatima', phone: '0622222222' },
      vendor: { first_name: 'Khadija', store_name: 'Organic Farm' },
    },
  },
  {
    id: 'del-003',
    order_id: 'ord-003',
    driver_id: 'driver-test-001',
    status: 'accepted',
    created_at: '2024-01-15T16:00:00Z',
    assigned_at: '2024-01-15T16:05:00Z',
    is_late: false,
    delivery_price: 20,
    pickup_address: '555 Store Ln, Marrakech',
    delivery_address: '777 Residence Dr, Marrakech',
    pickup_latitude: 31.63,
    pickup_longitude: -8.01,
    delivery_latitude: 31.64,
    delivery_longitude: -8.02,
    current_latitude: 31.635,
    current_longitude: -8.015,
    estimated_delivery_time: '2024-01-15T18:00:00Z',
    order: {
      order_number: 'ORD-003',
      total: 320,
      shipping_city: 'Marrakech',
      buyer: { first_name: 'Youssef', phone: '0633333333' },
      vendor: { first_name: 'Omar', store_name: 'Green Valley' },
    },
  },
]

const MOCK_EMPTY_DELIVERIES = []

// ── Intercept Setup ────────────────────────────────────────────────────────

const setupDriverDashboardIntercepts = (deliveriesData = MOCK_DELIVERIES) => {
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

  cy.intercept('GET', '**/rest/v1/deliveries*', {
    statusCode: 200,
    body: deliveriesData,
    headers: deliveriesData.length > 0
      ? { 'content-range': `0-${deliveriesData.length - 1}/${deliveriesData.length}` }
      : {},
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

const visitDriverDashboard = () => {
  cy.visit('/driver/dashboard', {
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

describe('Driver Dashboard — Page Health + UX + Critical Actions', () => {
  // ── Single consolidated test to avoid Electron renderer crashes ───────────
  it('page health, UX checks, empty state, deliveries, and critical actions', () => {
    setupDriverDashboardIntercepts(MOCK_DELIVERIES)
    visitDriverDashboard()
    cy.wait(12000)

    // ── Page Health ──
    assertNoWhiteScreen()
    cy.url().should('include', '/driver/dashboard')
    cy.url().should('not.include', '/login')
    cy.url().should('not.include', '/onboarding')
    cy.url().should('not.include', '/vendor')

    // ── UX: Title visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(/Driver Dashboard|Dashboard|لوحة التحكم|السائق/i.test(text)).to.be.true
    })

    // ── UX: Driver name and vehicle visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.include('Ahmed')
      expect(text).to.include('Driver')
      expect(text).to.match(/motorcycle|car|van|vehicle/i)
    })

    // ── UX: Stats cards visible ──
    cy.get('[data-testid="stats-cards"]').should('exist')
    cy.get('body').should(($body) => {
      const text = $body.text()
      // Total Deliveries
      expect(text).to.match(/Total Deliveries|Deliveries|توصيلات/i)
      // Pending
      expect(text).to.match(/Pending|قيد الانتظار/i)
      // Completed Today
      expect(text).to.match(/Completed Today|Today|اليوم/i)
      // Earnings
      expect(text).to.match(/Earnings|Revenus|الأرباح/i)
    })

    // ── UX: Stats values visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      // total_deliveries = 42
      expect(text).to.include('42')
      // driver_rating = 4.8
      expect(text).to.include('4.8')
    })

    // ── UX: Performance Metrics ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Performance|Performance Metrics|أداء/i)
      expect(text).to.match(/On-Time Rate|On Time|في الوقت/i)
      expect(text).to.match(/Late Deliveries|Late|متأخر/i)
      expect(text).to.match(/Rating|تقييم/i)
    })

    // ── Pending Delivery Requests ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      // del-002 is 'assigned' status
      expect(text).to.match(/Pending Delivery|New Assignment|طلبات|توصيل/i)
      // DeliveryRequestCard renders Order # + order_id (first 8 chars)
      expect(text).to.match(/Order #ord-002|ord-002/i)
      // Card shows vendor_name fallback 'Vendor Location' since mock lacks flat vendor_name
      expect(text).to.include('Vendor Location')
      // Card shows buyer_name fallback 'Customer' since mock lacks flat buyer_name
      expect(text).to.include('Customer')
    })

    // ── Active Delivery ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      // del-003 is 'accepted' status
      expect(text).to.match(/Active Delivery|Active|توصيل حالي/i)
      expect(text).to.include('Green Valley')
      expect(text).to.include('Youssef')
    })

    // ── UX: Pickup / Delivery addresses ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Pickup|من/i)
      expect(text).to.match(/Deliver to|إلى/i)
    })

    // ── UX: Call Buyer button ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Call Buyer|Call|اتصال/i)
    })

    // ── UX: Delivery History ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Delivery History|History|سجل/i)
      // del-001 is delivered — shows vendor → buyer, not order number
      expect(text).to.include('Fresh Market')
      expect(text).to.include('Ali')
    })

    // ── UX: Status badges ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Accepted|Accepted|مقبول/i)
    })

    // ── Critical: Action buttons for active delivery ──
    cy.contains('button', /Mark as Picked Up|Picked Up|التقاط/i)
      .should('be.visible')

    // ── Critical: Click "Mark as Picked Up" (safe, navigates to pickup route) ──
    cy.contains('button', /Mark as Picked Up|Picked Up|التقاط/i)
      .first()
      .click()

    cy.wait(2000)
    assertNoAppCrash()

    // ── Empty State (re-visit with empty deliveries) ──
    setupDriverDashboardIntercepts(MOCK_EMPTY_DELIVERIES)
    visitDriverDashboard()
    cy.wait(12000)

    assertNoAppCrash()
    cy.url().should('include', '/driver/dashboard')

    cy.get('body').should(($body) => {
      const text = $body.text()
      const hasEmpty =
        /No completed deliveries|No deliveries|لا توجد|Aucune livraison/i.test(text)
      expect(hasEmpty, 'expected empty state text').to.be.true
    })

    // Stats should still show zeros
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.include('0')
    })
  })
})
