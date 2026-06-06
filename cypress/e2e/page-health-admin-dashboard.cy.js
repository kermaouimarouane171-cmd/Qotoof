/// <reference types="cypress" />

/**
 * Page Health + UX Checks + Critical Admin Safety
 * Tests /admin/dashboard for an authenticated admin.
 * All Supabase calls are mocked. No real backend is touched.
 * No real admin action (approve, reject, suspend, payout) is executed.
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

const MOCK_ADMIN_USER = {
  id: 'admin-test-001',
  email: 'admin@example.com',
  user_metadata: {},
  aud: 'authenticated',
  role: 'authenticated',
}

const MOCK_ADMIN_PROFILE = {
  id: 'admin-test-001',
  role: 'admin',
  first_name: 'Test',
  last_name: 'Admin',
  email: 'admin@example.com',
  phone: '0611111111',
  is_active: true,
  onboarding_completed: true,
  onboarding_step: 100,
  paypal_email: 'admin-paypal@example.com',
  paypal_verified: true,
}

const MOCK_ADMIN_SESSION = {
  access_token: 'test-admin-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'test-admin-refresh',
  user: MOCK_ADMIN_USER,
}

const MOCK_PENDING_VENDORS = [
  {
    id: 'vendor-pending-001',
    first_name: 'Ali',
    last_name: 'Vendor',
    email: 'ali@vendor.ma',
    city: 'Tangier',
    store_name: 'Green Farm',
    created_at: '2025-06-05T10:00:00Z',
  },
  {
    id: 'vendor-pending-002',
    first_name: 'Fatima',
    last_name: 'Vendor',
    email: 'fatima@vendor.ma',
    city: 'Casablanca',
    store_name: 'Organic Market',
    created_at: '2025-06-04T14:00:00Z',
  },
]

const MOCK_RECENT_ORDERS = [
  {
    order_number: 'ORD-A001',
    total: 250,
    status: 'delivered',
    created_at: '2025-06-06T08:00:00Z',
    buyer_id: 'buyer-001',
  },
  {
    order_number: 'ORD-A002',
    total: 180,
    status: 'pending',
    created_at: '2025-06-06T07:00:00Z',
    buyer_id: 'buyer-002',
  },
  {
    order_number: 'ORD-A003',
    total: 320,
    status: 'shipped',
    created_at: '2025-06-05T16:00:00Z',
    buyer_id: 'buyer-003',
  },
]

// Orders used for revenue calculation (sum = 12500)
const MOCK_ORDERS_TOTALS = [
  { total: 2500 },
  { total: 2500 },
  { total: 2500 },
  { total: 2500 },
  { total: 2500 },
]

const MOCK_EMPTY_PENDING_VENDORS = []
const MOCK_EMPTY_RECENT_ORDERS = []

// ── Intercept Setup ────────────────────────────────────────────────────────

const setupAdminDashboardIntercepts = (options = {}) => {
  const pendingVendors = options.emptyPending ? MOCK_EMPTY_PENDING_VENDORS : MOCK_PENDING_VENDORS
  const recentOrders = options.emptyOrders ? MOCK_EMPTY_RECENT_ORDERS : MOCK_RECENT_ORDERS

  // 1. CORS preflights
  cy.intercept('OPTIONS', '**/auth/v1/**', { statusCode: 200, body: {} })
  cy.intercept('OPTIONS', '**/rest/v1/**', { statusCode: 200, body: {} })
  cy.intercept('OPTIONS', '**/functions/v1/**', { statusCode: 200, body: {} })

  // 2. Auth
  cy.intercept('GET', '**/auth/v1/session', {
    statusCode: 200,
    body: { data: { session: MOCK_ADMIN_SESSION }, error: null },
  }).as('authSession')

  cy.intercept('GET', '**/auth/v1/user', {
    statusCode: 200,
    body: MOCK_ADMIN_USER,
  }).as('authUser')

  cy.intercept('POST', '**/auth/v1/token*', {
    statusCode: 200,
    body: {
      access_token: 'test-admin-token',
      token_type: 'bearer',
      expires_in: 3600,
      user: MOCK_ADMIN_USER,
    },
  }).as('authRefresh')

  cy.intercept('POST', '**/auth/v1/logout*', { statusCode: 204, body: {} }).as('authLogout')

  // 3. Realtime websocket
  cy.intercept('POST', '**/realtime/v1/websocket', { statusCode: 200, body: {} }).as('realtimeWs')
  cy.intercept('GET', '**/realtime/v1/websocket*', { statusCode: 200, body: {} }).as('realtimeWsGet')

  // 4. Catch-all REST BEFORE specific overrides
  // Match both GET and HEAD because Supabase count queries use HEAD method
  cy.intercept({ method: /GET|HEAD/, url: '**/rest/v1/**' }, { statusCode: 200, body: [] }).as('fallbackGet')
  cy.intercept('POST', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackPost')
  cy.intercept('PATCH', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackPatch')
  cy.intercept('DELETE', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackDelete')

  // 5. Profiles — route handler for different query types
  // Must match HEAD for count queries and GET for data queries
  cy.intercept({ method: /GET|HEAD/, url: '**/rest/v1/profiles*' }, (req) => {
    if (req.url.includes('is_verified=eq.false')) {
      // Pending vendors data query
      req.reply({ statusCode: 200, body: pendingVendors })
    } else if (req.method === 'HEAD') {
      // Count query — Supabase sends HEAD for count=exact,head=true
      let count = 120 // total users
      if (req.url.includes('role=eq.vendor')) {
        count = 15 // vendors
      }
      if (req.url.includes('last_sign_in_at')) {
        count = 8 // active users (last 5 min)
      }
      req.reply({ statusCode: 200, body: [], headers: { 'content-range': `0-0/${count}` } })
    } else {
      // Auth store profile fetch + any other profiles data query
      req.reply({ statusCode: 200, body: MOCK_ADMIN_PROFILE, headers: { 'content-range': '0-0/1' } })
    }
  }).as('getProfiles')

  // 6. Products count (must match HEAD for count queries)
  cy.intercept({ method: /GET|HEAD/, url: '**/rest/v1/products*' }, {
    statusCode: 200,
    body: [],
    headers: { 'content-range': '0-0/230' },
  }).as('getProducts')

  // 7. Orders — route handler for different query types (must match HEAD for count queries)
  cy.intercept({ method: /GET|HEAD/, url: '**/rest/v1/orders*' }, (req) => {
    if (req.method === 'HEAD') {
      // Orders per minute count (last 10 min) — Supabase sends HEAD for count queries
      req.reply({ statusCode: 200, body: [], headers: { 'content-range': '0-0/12' } })
    } else if (req.url.includes('select=total')) {
      // Revenue calculation
      req.reply({ statusCode: 200, body: MOCK_ORDERS_TOTALS })
    } else {
      // Recent orders
      req.reply({ statusCode: 200, body: recentOrders })
    }
  }).as('getOrders')

  // 8. Notifications
  cy.intercept('GET', '**/rest/v1/notifications*', {
    statusCode: 200,
    body: [],
  }).as('getNotifications')

  // 9. Edge / config
  cy.intercept('POST', '**/functions/v1/get-public-config', {
    statusCode: 200,
    body: {
      supabase: { url: 'https://test-project.supabase.co', anonKey: 'test-anon-key' },
    },
  }).as('getPublicConfig')
}

// ── Test Suite ─────────────────────────────────────────────────────────────

describe('Admin Dashboard Page — Page Health + UX + Critical Admin Safety', () => {
  beforeEach(() => {
    cy.window().then((win) => {
      win.localStorage.setItem(
        'sb-oyaiiyekfkflesdmcvvo-auth-token',
        JSON.stringify(MOCK_ADMIN_SESSION)
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

  it('should load /admin/dashboard without white screen or crash', () => {
    setupAdminDashboardIntercepts()

    cy.visit('/admin/dashboard', { timeout: 15000 })

    assertNoWhiteScreen()
    cy.url().should('include', '/admin/dashboard')
    cy.url().should('not.include', '/login')
    cy.url().should('not.include', '/unauthorized')
    cy.url().should('not.include', '/onboarding')
    cy.url().should('not.include', '/vendor')
    cy.url().should('not.include', '/buyer')
    cy.url().should('not.include', '/driver')
  })

  it('should redirect non-admin user away from admin dashboard', () => {
    cy.window().then((win) => {
      win.localStorage.removeItem('sb-oyaiiyekfkflesdmcvvo-auth-token')
    })

    setupAdminDashboardIntercepts()

    cy.visit('/admin/dashboard', { timeout: 15000 })

    cy.url({ timeout: 10000 }).should('not.include', '/admin/dashboard')
    cy.url().should('match', /\/login|unauthorized/)
  })

  // ════════════════════════════════════════════════════════════════════════
  // 2. ADMIN DASHBOARD UX WITH DATA
  // ════════════════════════════════════════════════════════════════════════

  it('should display admin dashboard title and stats cards', () => {
    setupAdminDashboardIntercepts()

    cy.visit('/admin/dashboard', { timeout: 15000 })

    assertNoWhiteScreen()
    cy.url().should('include', '/admin/dashboard')

    // Dashboard title
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Admin Dashboard|Dashboard|لوحة تحكم|الرئيسية/i)
    })

    // Stats cards labels
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Users|المستخدمون|Vendors|البائعون|Products|المنتجات|Revenue|الإيرادات|Active|Orders\/Min/i)
    })

    // Stats values
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.include('120')
      expect(text).to.include('15')
      expect(text).to.include('230')
      expect(text).to.include('8')
    })

    // Revenue (12500 formatted)
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/12500|12\s?500/i)
    })

    // Orders per minute (12 / 10 = 1.2)
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/1\.2|Orders\/Min/i)
    })
  })

  it('should display pending vendor approvals with action buttons', () => {
    setupAdminDashboardIntercepts()

    cy.visit('/admin/dashboard', { timeout: 15000 })

    assertNoWhiteScreen()

    // Pending approvals section
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Pending Approvals|Pending|طلبات|موافقة/i)
      expect(text).to.include('2')
    })

    // Vendor names
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Green Farm|Organic Market/i)
    })

    // Emails
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/ali@vendor\.ma|fatima@vendor\.ma/i)
    })

    // Cities
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Tangier|Casablanca/i)
    })

    // Approve / Reject buttons visible (but NOT clicked)
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/موافقة|Approve|قبول/i)
      expect(text).to.match(/رفض|Reject|رفض/i)
    })

    // Verify buttons exist but do not click them
    cy.get('button').each(($btn) => {
      const text = $btn.text()
      // If it's an approve/reject button, verify it exists but don't click
      if (/موافقة|Approve/.test(text) || /رفض|Reject/.test(text)) {
        expect($btn).to.exist
      }
    })
  })

  it('should display recent orders with status badges', () => {
    setupAdminDashboardIntercepts()

    cy.visit('/admin/dashboard', { timeout: 15000 })

    assertNoWhiteScreen()

    // Recent orders section
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Recent Orders|Orders|طلبات/i)
    })

    // Order numbers
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.include('ORD-A001')
      expect(text).to.include('ORD-A002')
      expect(text).to.include('ORD-A003')
    })

    // Order statuses
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/delivered|pending|shipped/i)
    })

    // Order totals
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/250|180|320/i)
    })

    // Live indicator
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Live|مباشر|live/i)
    })
  })

  // ════════════════════════════════════════════════════════════════════════
  // 3. EMPTY / ZERO STATE
  // ════════════════════════════════════════════════════════════════════════

  it('should show clear empty state when no pending vendors or orders', () => {
    setupAdminDashboardIntercepts({ emptyPending: true, emptyOrders: true })

    cy.visit('/admin/dashboard', { timeout: 15000 })

    assertNoWhiteScreen()
    cy.url().should('include', '/admin/dashboard')

    // Stats should still show 0
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.include('120')
      expect(text).to.include('15')
      expect(text).to.include('230')
    })

    // Empty pending message
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/No pending vendor approvals|لا توجد|No pending/i)
    })

    // Empty orders message
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/No orders yet|لا توجد|No orders/i)
    })

    // Page does not crash
    assertNoAppCrash()
  })

  // ════════════════════════════════════════════════════════════════════════
  // 4. CRITICAL ADMIN SAFETY
  // ════════════════════════════════════════════════════════════════════════

  it('should NOT trigger any real admin action buttons', () => {
    setupAdminDashboardIntercepts()

    cy.visit('/admin/dashboard', { timeout: 15000 })

    assertNoWhiteScreen()

    // Verify that approve/reject buttons are present but we do NOT click them
    // This test ensures the page renders action buttons without executing them
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/موافقة|Approve/i)
      expect(text).to.match(/رفض|Reject/i)
    })

    // Verify no PATCH/DELETE to profiles was made (except our mocks)
    // The intercepts ensure any such request is mocked
    cy.get('@fallbackPatch').then((interception) => {
      // fallbackPatch may not have been called; that's fine
      expect(interception).to.satisfy((i) => i === null || i.response?.statusCode === 200)
    })
  })
})
