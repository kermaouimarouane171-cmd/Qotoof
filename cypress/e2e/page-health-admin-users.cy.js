/// <reference types="cypress" />

/**
 * Page Health + UX Checks + Critical Admin Safety
 * Tests /admin/users for an admin user.
 * All Supabase calls are mocked. No real backend is touched.
 * No real user is suspended, deleted, or modified.
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
  phone: '+212600000001',
  city: 'Casablanca',
  is_active: true,
  onboarding_completed: true,
  is_suspended: false,
  created_at: '2025-01-01T00:00:00Z',
}

const MOCK_ADMIN_SESSION = {
  access_token: 'test-admin-token',
  refresh_token: 'test-admin-refresh',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: MOCK_ADMIN_USER,
}

const MOCK_USERS = [
  {
    id: 'user-admin-001',
    first_name: 'Test',
    last_name: 'Admin',
    email: 'admin@example.com',
    role: 'admin',
    created_at: '2025-01-01T00:00:00Z',
    is_suspended: false,
    avatar_url: null,
    phone: '+212600000001',
    city: 'Casablanca',
  },
  {
    id: 'user-buyer-001',
    first_name: 'Ali',
    last_name: 'Buyer',
    email: 'buyer@example.com',
    role: 'buyer',
    created_at: '2025-02-15T00:00:00Z',
    is_suspended: false,
    avatar_url: null,
    phone: '+212600000002',
    city: 'Rabat',
  },
  {
    id: 'user-vendor-001',
    first_name: 'Green',
    last_name: 'Farm',
    email: 'vendor@example.com',
    role: 'vendor',
    created_at: '2025-03-01T00:00:00Z',
    is_suspended: false,
    avatar_url: null,
    phone: '+212600000003',
    city: 'Tangier',
  },
  {
    id: 'user-driver-001',
    first_name: 'Ahmed',
    last_name: 'Driver',
    email: 'driver@example.com',
    role: 'driver',
    created_at: '2025-04-10T00:00:00Z',
    is_suspended: true,
    avatar_url: null,
    phone: '+212600000004',
    city: 'Marrakech',
  },
]

const setupAdminUsersIntercepts = (users = MOCK_USERS) => {
  // 1. OPTIONS preflights
  cy.intercept('OPTIONS', '**/auth/v1/**', { statusCode: 200, body: {} }).as('optionsAuth')
  cy.intercept('OPTIONS', '**/rest/v1/**', { statusCode: 200, body: {} }).as('optionsRest')
  cy.intercept('OPTIONS', '**/functions/v1/**', { statusCode: 200, body: {} }).as('optionsFunctions')

  // 2. Auth — return raw Supabase HTTP API responses
  cy.intercept('GET', '**/auth/v1/user', {
    statusCode: 200,
    body: MOCK_ADMIN_USER,
  }).as('authUser')

  cy.intercept('GET', '**/auth/v1/session', {
    statusCode: 200,
    body: { data: { session: MOCK_ADMIN_SESSION }, error: null },
  }).as('authSession')

  cy.intercept('POST', '**/auth/v1/token**', {
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

  // 4. Catch-all REST (before specific overrides)
  cy.intercept({ method: /GET|HEAD/, url: '**/rest/v1/**' }, { statusCode: 200, body: [] }).as('fallbackGet')
  cy.intercept('POST', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackPost')
  cy.intercept('PATCH', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackPatch')
  cy.intercept('DELETE', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackDelete')

  // 5. Profiles — must match GET and HEAD for count queries
  cy.intercept({ method: /GET|HEAD/, url: '**/rest/v1/profiles*' }, (req) => {
    // Count queries (HEAD)
    if (req.method === 'HEAD') {
      const total = users.length
      req.reply({
        statusCode: 200,
        body: [],
        headers: { 'content-range': `0-${Math.max(0, total - 1)}/${total}` },
      })
      return
    }

    // Auth store profile fetch — has id=eq. filter
    if (req.url.includes('id=eq.')) {
      req.reply({ statusCode: 200, body: MOCK_ADMIN_PROFILE, headers: { 'content-range': '0-0/1' } })
      return
    }

    // Admin users list query — no id filter, return array of users
    // Filter by role if present
    const roleMatch = req.url.match(/role=eq\.([^&]+)/)
    if (roleMatch && roleMatch[1] !== 'all') {
      const filtered = users.filter((u) => u.role === roleMatch[1])
      req.reply({ statusCode: 200, body: filtered })
      return
    }

    // Search filter
    const searchMatch = req.url.match(/ilike\.%25([^%]+)%25/)
    if (searchMatch) {
      const term = searchMatch[1].toLowerCase()
      const filtered = users.filter(
        (u) =>
          (u.first_name && u.first_name.toLowerCase().includes(term)) ||
          (u.last_name && u.last_name.toLowerCase().includes(term)) ||
          (u.email && u.email.toLowerCase().includes(term))
      )
      req.reply({ statusCode: 200, body: filtered })
      return
    }

    // Default profiles data query: return all users
    req.reply({ statusCode: 200, body: users })
  }).as('getProfiles')

  // 6. Admin action intercepts — CRITICAL: block all real admin mutations
  cy.intercept('PATCH', '**/rest/v1/profiles', {
    statusCode: 200,
    body: {},
  }).as('patchProfiles')

  cy.intercept('DELETE', '**/rest/v1/profiles', {
    statusCode: 200,
    body: {},
  }).as('deleteProfiles')

  // 7. Notifications
  cy.intercept('GET', '**/rest/v1/notifications*', { statusCode: 200, body: [] }).as('getNotifications')

  // 8. Analytics / admin stats
  cy.intercept('GET', '**/rest/v1/analytics*', { statusCode: 200, body: [] }).as('getAnalytics')

  // 9. Edge functions
  cy.intercept('POST', '**/functions/v1/**', { statusCode: 200, body: {} }).as('edgeFunction')
}

// ── Test Suite ───────────────────────────────────────────────────────────────

describe('Admin Users Page — Page Health + UX + Critical Admin Safety', () => {
  beforeEach(() => {
    cy.window().then((win) => {
      win.localStorage.setItem(
        'sb-oyaiiyekfkflesdmcvvo-auth-token',
        JSON.stringify(MOCK_ADMIN_SESSION)
      )
    })
    setupAdminUsersIntercepts(MOCK_USERS)
    cy.viewport(1280, 800)
  })

  afterEach(() => {
    cy.window().then((win) => {
      win.localStorage.clear()
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 1. Page Health
  // ══════════════════════════════════════════════════════════════════════════

  it('should load /admin/users without white screen or crash', () => {
    cy.visit('/admin/users')
    cy.wait(3000)

    assertNoWhiteScreen()
    cy.url().should('include', '/admin/users')
    cy.url().should('not.include', '/login')
    cy.url().should('not.include', '/unauthorized')
  })

  it('should show forbidden message for non-admin user', () => {
    // Override profile to be a buyer
    cy.intercept({ method: /GET|HEAD/, url: '**/rest/v1/profiles*' }, (req) => {
      if (req.method === 'HEAD') {
        req.reply({ statusCode: 200, body: [], headers: { 'content-range': '0-0/1' } })
        return
      }
      req.reply({
        statusCode: 200,
        body: {
          id: 'buyer-test-001',
          role: 'buyer',
          first_name: 'Ali',
          last_name: 'Buyer',
          email: 'buyer@example.com',
          is_active: true,
          onboarding_completed: true,
        },
      })
    }).as('getBuyerProfile')

    cy.visit('/admin/users')
    cy.wait(4000)

    // ProtectedRoute redirects non-admin to /unauthorized or /login
    cy.url().should('not.include', '/admin/users')
    cy.url().should('satisfy', (href) => href.includes('/unauthorized') || href.includes('/login'))
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 2. UX Checks — Main page with users
  // ══════════════════════════════════════════════════════════════════════════

  it('should display admin users page title and controls', () => {
    cy.visit('/admin/users')
    cy.wait(3000)

    // Title
    cy.get('[data-cy="admin-users-title"]').should('be.visible')
    cy.contains(/إدارة المستخدمين|User Management|Users/i)

    // Search input
    cy.get('[data-cy="admin-users-search-input"]').should('be.visible')

    // Role filter
    cy.get('[data-cy="admin-users-role-filter"]').should('be.visible')

    // Total count
    cy.get('[data-cy="admin-users-total-count"]').should('be.visible')
  })

  it('should display user table with mocked data', () => {
    cy.visit('/admin/users')
    cy.wait(3000)

    // Table visible
    cy.get('[data-cy="admin-users-table"]').should('be.visible')
    cy.get('[data-cy="admin-users-table-wrapper"]').should('be.visible')

    // Check for each mocked user
    MOCK_USERS.forEach((user) => {
      cy.get(`[data-cy="admin-users-row-${user.id}"]`).should('exist')
      cy.get(`[data-cy="admin-users-name-${user.id}"]`).should('contain', user.first_name)
      cy.get(`[data-cy="admin-users-email-${user.id}"]`).should('contain', user.email)
      // Role cell exists and has content (may be translated via i18n)
      cy.get(`[data-cy="admin-users-role-${user.id}"]`).should('not.be.empty')
    })

    // Check status badges — active user (buyer)
    cy.get('[data-cy="admin-users-status-user-buyer-001"]')
      .invoke('text')
      .should('match', /نشط|active/i)
    // Suspended user (driver)
    cy.get('[data-cy="admin-users-status-user-driver-001"]')
      .invoke('text')
      .should('match', /معلق|suspended/i)
  })

  it('should display admin action buttons for each user', () => {
    cy.visit('/admin/users')
    cy.wait(3000)

    MOCK_USERS.forEach((user) => {
      // View profile button
      cy.get(`[data-cy="admin-users-view-profile-${user.id}"]`).should('be.visible')

      // Toggle suspend button
      cy.get(`[data-cy="admin-users-toggle-suspend-${user.id}"]`).should('be.visible')

      // Delete button (disabled for current admin user)
      cy.get(`[data-cy="admin-users-delete-${user.id}"]`).should('be.visible')
    })
  })

  it('should work with search input without crashing', () => {
    cy.visit('/admin/users')
    cy.wait(3000)

    // Type search term (debounced 300ms)
    cy.get('[data-cy="admin-users-search-input"]')
      .type('Ali Buyer', { delay: 50 })

    // Wait for debounce
    cy.wait(500)

    // Page should not crash
    assertNoAppCrash()
    cy.get('[data-cy="admin-users-table"]').should('exist')
  })

  it('should work with role filter without crashing', () => {
    cy.visit('/admin/users')
    cy.wait(3000)

    // Change role filter to vendor
    cy.get('[data-cy="admin-users-role-filter"]').select('vendor')
    cy.wait(500)

    // Page should not crash
    assertNoAppCrash()
    cy.get('[data-cy="admin-users-table"]').should('exist')

    // Change to driver
    cy.get('[data-cy="admin-users-role-filter"]').select('driver')
    cy.wait(500)

    assertNoAppCrash()
    cy.get('[data-cy="admin-users-table"]').should('exist')

    // Change back to all
    cy.get('[data-cy="admin-users-role-filter"]').select('all')
    cy.wait(500)

    assertNoAppCrash()
    cy.get('[data-cy="admin-users-table"]').should('exist')
  })

  it('should display pagination controls', () => {
    cy.visit('/admin/users')
    cy.wait(3000)

    cy.get('[data-cy="admin-users-pagination"]').should('be.visible')
    cy.get('[data-cy="admin-users-page-indicator"]').should('be.visible')
    cy.get('[data-cy="admin-users-prev-page"]').should('be.visible')
    cy.get('[data-cy="admin-users-next-page"]').should('be.visible')
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 3. Empty State
  // ══════════════════════════════════════════════════════════════════════════

  it('should show clear empty state when no users match', () => {
    setupAdminUsersIntercepts([])
    cy.visit('/admin/users')
    cy.wait(3000)

    assertNoAppCrash()
    cy.get('[data-cy="admin-users-empty"]').should('be.visible')
    cy.contains(/لا توجد نتائج مطابقة|No results found/i)
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 4. Critical Admin Safety
  // ══════════════════════════════════════════════════════════════════════════

  it('should NOT trigger any real admin action buttons', () => {
    cy.visit('/admin/users')
    cy.wait(3000)

    // We only verify buttons exist but DO NOT click them
    // This test ensures we never accidentally trigger real mutations

    // View profile button exists but we don't click it
    cy.get('[data-cy="admin-users-view-profile-user-buyer-001"]').should('be.visible')

    // Toggle suspend button exists but we don't click it
    cy.get('[data-cy="admin-users-toggle-suspend-user-buyer-001"]').should('be.visible')

    // Delete button exists but we don't click it
    cy.get('[data-cy="admin-users-delete-user-vendor-001"]').should('be.visible')

    // Bulk suspend button (disabled when no selection)
    cy.get('[data-cy="admin-users-bulk-suspend-button"]').should('be.visible')

    // Verify no PATCH or DELETE was sent to real Supabase
    // The intercepts at setupAdminUsersIntercepts mock these to return 200
    cy.get('@patchProfiles.all').then((calls) => {
      // Should be 0 because we didn't click any action buttons
      expect(calls.length).to.eq(0)
    })
    cy.get('@deleteProfiles.all').then((calls) => {
      expect(calls.length).to.eq(0)
    })
  })
})
