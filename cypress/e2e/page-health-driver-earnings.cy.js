/// <reference types="cypress" />

/**
 * Page Health + UX Checks + Earnings Data + Empty State
 * Tests /driver/earnings for an activated driver.
 * All Supabase calls are mocked. No real backend is touched.
 * No real payout, payment, or withdrawal is performed.
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
  current_latitude: 35.7595,
  current_longitude: -5.8340,
}

const MOCK_DRIVER_SESSION = {
  access_token: 'test-driver-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'test-driver-refresh',
  user: MOCK_DRIVER_USER,
}

// Helper to create ISO date strings relative to today
const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

// Deliveries with various completion dates to test filtering
const MOCK_EARNINGS_DELIVERIES = [
  {
    id: 'del-e001',
    status: 'delivered',
    delivery_price: 25,
    distance_km: 5.2,
    created_at: daysAgo(0),
    completed_at: daysAgo(0),
    order: {
      order_number: 'ORD-E001',
      buyer: { first_name: 'Ali', last_name: 'Buyer' },
      vendor: { store_name: 'Fresh Market' },
    },
  },
  {
    id: 'del-e002',
    status: 'delivered',
    delivery_price: 30,
    distance_km: 8.5,
    created_at: daysAgo(3),
    completed_at: daysAgo(3),
    order: {
      order_number: 'ORD-E002',
      buyer: { first_name: 'Fatima', last_name: 'Buyer' },
      vendor: { store_name: 'Organic Farm' },
    },
  },
  {
    id: 'del-e003',
    status: 'delivered',
    delivery_price: 20,
    distance_km: 3.1,
    created_at: daysAgo(15),
    completed_at: daysAgo(15),
    order: {
      order_number: 'ORD-E003',
      buyer: { first_name: 'Youssef', last_name: 'Buyer' },
      vendor: { store_name: 'Green Valley' },
    },
  },
  {
    id: 'del-e004',
    status: 'delivered',
    delivery_price: 35,
    distance_km: 12.0,
    created_at: daysAgo(45),
    completed_at: daysAgo(45),
    order: {
      order_number: 'ORD-E004',
      buyer: { first_name: 'Khadija', last_name: 'Buyer' },
      vendor: { store_name: 'City Market' },
    },
  },
]

const MOCK_EMPTY_DELIVERIES = []

// ── Intercept Setup ────────────────────────────────────────────────────────

const setupEarningsIntercepts = (deliveriesData = MOCK_EARNINGS_DELIVERIES) => {
  // 1. CORS preflights
  cy.intercept('OPTIONS', '**/auth/v1/**', { statusCode: 200, body: {} })
  cy.intercept('OPTIONS', '**/rest/v1/**', { statusCode: 200, body: {} })
  cy.intercept('OPTIONS', '**/functions/v1/**', { statusCode: 200, body: {} })

  // 2. Auth
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

  // 4. Specific REST overrides
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

  // 5. Edge / config
  cy.intercept('POST', '**/functions/v1/get-public-config', {
    statusCode: 200,
    body: {
      supabase: { url: 'https://test-project.supabase.co', anonKey: 'test-anon-key' },
    },
  }).as('getPublicConfig')
}

// ── Test Suite ─────────────────────────────────────────────────────────────

describe('Driver Earnings Page — Page Health + UX + Earnings Data + Empty State', () => {
  beforeEach(() => {
    cy.window().then((win) => {
      win.localStorage.setItem(
        'sb-oyaiiyekfkflesdmcvvo-auth-token',
        JSON.stringify(MOCK_DRIVER_SESSION)
      )
    })
  })

  afterEach(() => {
    cy.window().then((win) => {
      win.localStorage.clear()
    })
  })

  // ════════════════════════════════════════════════════════════════════════
  // 1. PAGE HEALTH
  // ════════════════════════════════════════════════════════════════════════

  it('should load /driver/earnings without white screen or crash', () => {
    setupEarningsIntercepts()

    cy.visit('/driver/earnings', { timeout: 15000 })

    assertNoWhiteScreen()
    cy.url().should('include', '/driver/earnings')
    cy.url().should('not.include', '/login')
    cy.url().should('not.include', '/onboarding')
    cy.url().should('not.include', '/unauthorized')
  })

  it('should redirect unauthenticated user away from earnings', () => {
    cy.window().then((win) => {
      win.localStorage.removeItem('sb-oyaiiyekfkflesdmcvvo-auth-token')
    })

    setupEarningsIntercepts()

    cy.visit('/driver/earnings', { timeout: 15000 })

    cy.url({ timeout: 10000 }).should('not.include', '/driver/earnings')
    cy.url().should('match', /\/login/)
  })

  // ════════════════════════════════════════════════════════════════════════
  // 2. EMPTY STATE
  // ════════════════════════════════════════════════════════════════════════

  it('should show clear empty state when no completed deliveries exist', () => {
    setupEarningsIntercepts(MOCK_EMPTY_DELIVERIES)

    cy.visit('/driver/earnings', { timeout: 15000 })

    assertNoWhiteScreen()
    cy.url().should('include', '/driver/earnings')

    // Title
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Earnings|أرباح/i)
    })

    // Empty state in chart section
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/No completed deliveries|لا توجد|Nothing to show/i)
    })

    // Empty state in recent deliveries section
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Complete deliveries|Nothing to show|لا توجد/i)
    })

    // Stats cards should show 0
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Total earnings|Today|This week|Avg\. per delivery|0/i)
    })
  })

  // ════════════════════════════════════════════════════════════════════════
  // 3. EARNINGS DATA DISPLAY
  // ════════════════════════════════════════════════════════════════════════

  it('should display earnings summary cards with correct totals', () => {
    setupEarningsIntercepts(MOCK_EARNINGS_DELIVERIES)

    cy.visit('/driver/earnings', { timeout: 15000 })

    assertNoWhiteScreen()
    cy.url().should('include', '/driver/earnings')

    // Title and subtitle
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Earnings|Track completed deliveries|أرباح/i)
    })

    // Stats cards labels
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Total earnings|today|week|average|Avg/i)
    })

    // Total earnings (default 30d range) = 25+30+20 = 75
    // The 4th delivery (45 days ago) is outside 30d range
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.include('75')
    })

    // Quick breakdown
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Completed deliveries/i)
      expect(text).to.include('3')
    })

    // This month includes only June deliveries (today + 3 days ago = 55)
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/This month|month/i)
      expect(text).to.include('55')
    })
  })

  it('should display recent completed deliveries with order details', () => {
    setupEarningsIntercepts(MOCK_EARNINGS_DELIVERIES)

    cy.visit('/driver/earnings', { timeout: 15000 })

    assertNoWhiteScreen()

    // Order numbers visible
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.include('ORD-E001')
      expect(text).to.include('ORD-E002')
      expect(text).to.include('ORD-E003')
    })

    // Vendor names
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Fresh Market|Organic Farm|Green Valley/i)
    })

    // Buyer names
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Ali|Fatima|Youssef/i)
    })

    // Delivery prices
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/25|30|20/i)
    })

    // Distance info
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/5\.2|8\.5|3\.1|km/i)
    })

    // Completed badge
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Completed|مكتمل/i)
    })
  })

  // ════════════════════════════════════════════════════════════════════════
  // 4. RANGE FILTERS
  // ════════════════════════════════════════════════════════════════════════

  it('should switch range filters without crashing', () => {
    setupEarningsIntercepts(MOCK_EARNINGS_DELIVERIES)

    cy.visit('/driver/earnings', { timeout: 15000 })

    assertNoWhiteScreen()

    // Default filter buttons should exist
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/7 days|30 days|90 days|All time|7 أيام|30 يوم|كل/i)
    })

    // Click "All time" to show all 4 deliveries
    cy.contains('button', /All time|كل/i).click()

    // Page should not crash
    assertNoWhiteScreen()
    cy.url().should('include', '/driver/earnings')

    // Now total should include all 4 deliveries = 110
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.include('110')
    })

    // All 4 order numbers should be visible
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.include('ORD-E004')
    })

    // Click "7 days" — should show only 2 deliveries (today + 3 days ago)
    cy.contains('button', /7 days|7 أيام/i).click()

    assertNoWhiteScreen()
    cy.url().should('include', '/driver/earnings')

    // Total = 55 (25 + 30)
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.include('55')
    })
  })

  // ════════════════════════════════════════════════════════════════════════
  // 5. CHART SECTION
  // ════════════════════════════════════════════════════════════════════════

  it('should show earnings chart or empty state depending on data', () => {
    setupEarningsIntercepts(MOCK_EARNINGS_DELIVERIES)

    cy.visit('/driver/earnings', { timeout: 15000 })

    assertNoWhiteScreen()

    // Chart title
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Earnings trend|trend|Daily earnings|chart/i)
    })

    // Refresh button
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Refresh|refresh|تحديث/i)
    })
  })
})
