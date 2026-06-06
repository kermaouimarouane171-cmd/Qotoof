/// <reference types="cypress" />

/**
 * Page Health + UX Checks + Critical Actions
 * Tests /driver/available for an activated driver.
 * All Supabase calls are mocked. No real backend is touched.
 * No real delivery is accepted, updated, or completed.
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

// Profile must include DRIVER_SELECT fields for getMatchingDeliveriesForDriver
const MOCK_DRIVER_PROFILE = {
  id: 'driver-test-001',
  role: 'driver',
  first_name: 'Ahmed',
  last_name: 'Driver',
  phone: '0612345678',
  email: 'driver@test.ma',
  vehicle_type: 'motorcycle',
  city: 'Tangier',
  latitude: 35.7595,
  longitude: -5.8340,
  rating: 4.8,
  is_available_for_delivery: true,
  min_delivery_distance_km: 0,
  max_delivery_distance_km: 50,
  accepted_cargo_sizes: ['small', 'medium', 'large'],
  driver_delivery_payment_cash: true,
  driver_delivery_payment_transfer: false,
  driver_delivery_payment_notes: '',
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

// Raw deliveries data as returned by Supabase REST (before client-side enrichment)
const MOCK_AVAILABLE_DELIVERIES = [
  {
    id: 'del-av-001',
    order_id: 'ord-av-001',
    driver_id: null,
    status: 'unassigned',
    created_at: '2024-01-15T10:00:00Z',
    pickup_address: 'Fresh Market, Tangier',
    pickup_latitude: 35.7595,
    pickup_longitude: -5.8340,
    delivery_address: 'Buyer Home, Tangier',
    delivery_latitude: 35.7700,
    delivery_longitude: -5.8500,
    cargo_size: 'medium',
    delivery_distance_km: 5.2,
    order: {
      id: 'ord-av-001',
      order_number: 'ORD-AV-001',
      total: 250,
      shipping_cost: 25,
      shipping_city: 'Tangier',
      shipping_address: 'Buyer Home, Tangier',
      shipping_latitude: 35.7700,
      shipping_longitude: -5.8500,
      cargo_size: 'medium',
      delivery_distance_km: 5.2,
      driver_delivery_payment_method: 'cash',
      delivery_fee_total: 25,
      vendor_product_total: 225,
      buyer: { id: 'buyer-001', first_name: 'Ali', last_name: 'Buyer', phone: '0611111111' },
      vendor: { id: 'vendor-001', store_name: 'Fresh Market', phone: '0622222222', city: 'Tangier', latitude: 35.7595, longitude: -5.8340 },
    },
  },
  {
    id: 'del-av-002',
    order_id: 'ord-av-002',
    driver_id: 'driver-test-001',
    status: 'assigned',
    created_at: '2024-01-15T12:00:00Z',
    pickup_address: 'Organic Farm, Tangier',
    pickup_latitude: 35.7650,
    pickup_longitude: -5.8400,
    delivery_address: 'City Center, Tangier',
    delivery_latitude: 35.7750,
    delivery_longitude: -5.8600,
    cargo_size: 'small',
    delivery_distance_km: 3.0,
    order: {
      id: 'ord-av-002',
      order_number: 'ORD-AV-002',
      total: 180,
      shipping_cost: 30,
      shipping_city: 'Tangier',
      shipping_address: 'City Center, Tangier',
      shipping_latitude: 35.7750,
      shipping_longitude: -5.8600,
      cargo_size: 'small',
      delivery_distance_km: 3.0,
      driver_delivery_payment_method: 'cash',
      delivery_fee_total: 30,
      vendor_product_total: 150,
      buyer: { id: 'buyer-002', first_name: 'Fatima', last_name: 'Buyer', phone: '0633333333' },
      vendor: { id: 'vendor-002', store_name: 'Organic Farm', phone: '0644444444', city: 'Tangier', latitude: 35.7650, longitude: -5.8400 },
    },
  },
]

const MOCK_EMPTY_DELIVERIES = []

// ── Intercept Setup ────────────────────────────────────────────────────────

const setupAvailableOrdersIntercepts = (deliveriesData = MOCK_AVAILABLE_DELIVERIES) => {
  // 1. CORS preflights
  cy.intercept('OPTIONS', '**/auth/v1/**', { statusCode: 200, body: {} })
  cy.intercept('OPTIONS', '**/rest/v1/**', { statusCode: 200, body: {} })
  cy.intercept('OPTIONS', '**/functions/v1/**', { statusCode: 200, body: {} })

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

  // 5. Edge functions
  cy.intercept('POST', '**/functions/v1/accept-delivery', {
    statusCode: 200,
    body: { success: true, delivery: { id: 'del-av-001', status: 'accepted' } },
  }).as('acceptDelivery')

  cy.intercept('POST', '**/functions/v1/get-public-config', {
    statusCode: 200,
    body: {
      supabase: { url: 'https://test-project.supabase.co', anonKey: 'test-anon-key' },
    },
  }).as('getPublicConfig')
}

// ── Test Suite ─────────────────────────────────────────────────────────────

describe('Driver Available Orders Page — Page Health + UX + Critical Actions', () => {
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

  it('should load /driver/available without white screen or crash', () => {
    setupAvailableOrdersIntercepts()

    cy.visit('/driver/available', { timeout: 15000 })

    assertNoWhiteScreen()
    cy.url().should('include', '/driver/available')
    cy.url().should('not.include', '/login')
    cy.url().should('not.include', '/onboarding')
    cy.url().should('not.include', '/unauthorized')
  })

  it('should not redirect unauthenticated user to the available orders page', () => {
    cy.window().then((win) => {
      win.localStorage.removeItem('sb-oyaiiyekfkflesdmcvvo-auth-token')
    })

    setupAvailableOrdersIntercepts()

    cy.visit('/driver/available', { timeout: 15000 })

    cy.url({ timeout: 10000 }).should('not.include', '/driver/available')
    cy.url().should('match', /\/login/)
  })

  // ════════════════════════════════════════════════════════════════════════
  // 2. EMPTY STATE
  // ════════════════════════════════════════════════════════════════════════

  it('should show a clear empty state when no available orders exist', () => {
    setupAvailableOrdersIntercepts(MOCK_EMPTY_DELIVERIES)

    cy.visit('/driver/available', { timeout: 15000 })

    assertNoWhiteScreen()
    cy.url().should('include', '/driver/available')

    // Title
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Available Deliveries|Available Orders|الطلبات المتاحة|توصيلات متاحة/i)
    })

    // Empty state message
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/لا توجد طلبات مطابقة|No available|No matching|لا توجد توصيلات/i)
    })

    // Refresh button
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/تحديث|Refresh|refresh/i)
    })

    // Settings button
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/إعدادات|Settings|تفضيلات|Preferences/i)
    })
  })

  // ════════════════════════════════════════════════════════════════════════
  // 3. AVAILABLE ORDERS LIST (UX)
  // ════════════════════════════════════════════════════════════════════════

  it('should display available delivery cards with key info', () => {
    setupAvailableOrdersIntercepts(MOCK_AVAILABLE_DELIVERIES)

    cy.visit('/driver/available', { timeout: 15000 })

    assertNoWhiteScreen()
    cy.url().should('include', '/driver/available')

    // Title with count
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Available Deliveries|Available Orders/i)
      expect(text).to.match(/2|مهمة مطابقة/i)
    })

    // Stats cards
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/مطابقة الآن|Matching|available/i)
      expect(text).to.match(/أقصى مسافة|Max distance|distance/i)
      expect(text).to.match(/الأحجام المقبولة|Accepted sizes|cargo|sizes/i)
      expect(text).to.match(/تحصيل|Payment|collection/i)
    })

    // Order numbers
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.include('ORD-AV-001')
      expect(text).to.include('ORD-AV-002')
    })

    // Vendor and buyer names
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Fresh Market/i)
      expect(text).to.match(/Organic Farm/i)
      expect(text).to.match(/Ali|Fatima/i)
    })

    // Addresses
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/عنوان الاستلام|Pickup address|Pickup/i)
      expect(text).to.match(/عنوان التسليم|Delivery address|Delivery/i)
    })

    // Distance info
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/مسافة|distance|كم|km/i)
    })

    // Price info
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/قيمة|رسم|fee|price|total/i)
    })

    // Status badges
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/متاحة لك|Available|مُسندة إليك|Assigned/i)
    })

    // Cargo size badge
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/حمولة صغيرة|حمولة متوسطة|حمولة كبيرة|small|medium|large/i)
    })

    // Payment method badge
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/نقداً|cash|تحويل|transfer/i)
    })
  })

  // ════════════════════════════════════════════════════════════════════════
  // 4. CRITICAL ACTION — Accept Delivery (Mocked)
  // ════════════════════════════════════════════════════════════════════════

  it('should show Accept and View Details buttons for each delivery card', () => {
    setupAvailableOrdersIntercepts(MOCK_AVAILABLE_DELIVERIES)

    cy.visit('/driver/available', { timeout: 15000 })

    assertNoWhiteScreen()

    // Accept buttons visible
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/قبول المهمة|Accept|accept delivery/i)
    })

    // View Details buttons visible
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/تفاصيل الطلب|Details|View Details/i)
    })

    // Verify at least one Accept button is clickable (not disabled)
    cy.get('button').each(($btn) => {
      const text = $btn.text()
      if (/قبول المهمة|Accept/.test(text)) {
        expect($btn).to.not.be.disabled
      }
    })
  })

  it('should safely trigger Accept delivery with mocked edge function', () => {
    setupAvailableOrdersIntercepts(MOCK_AVAILABLE_DELIVERIES)

    cy.visit('/driver/available', { timeout: 15000 })

    assertNoWhiteScreen()

    // Find and click the first Accept button
    cy.contains('button', /قبول المهمة|Accept/).first().as('acceptBtn')
    cy.get('@acceptBtn').click()

    // Verify the edge function was called
    cy.wait('@acceptDelivery').then((interception) => {
      expect(interception.request.method).to.eq('POST')
      expect(interception.request.body).to.have.property('deliveryId')
    })

    // Verify button enters loading state
    cy.get('button').contains(/جاري القبول|Accepting|loading/i).should('exist')
  })
})
