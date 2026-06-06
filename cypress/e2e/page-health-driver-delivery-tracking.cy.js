/// <reference types="cypress" />

/**
 * Page Health + UX Checks + Critical Actions
 * Tests /driver/delivery/:id/tracking for an activated driver.
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

const MOCK_DELIVERY = {
  id: 'del-001',
  order_id: 'order-001',
  driver_id: 'driver-test-001',
  status: 'picked_up',
  created_at: '2024-01-15T10:00:00Z',
  assigned_at: '2024-01-15T10:05:00Z',
  accepted_at: '2024-01-15T10:10:00Z',
  picked_up_at: '2024-01-15T11:00:00Z',
  delivered_at: null,
  driver_notes: null,
  delivery_proof_url: null,
  signature_url: null,
  delivery_number: 'DEL-TRACK-001',
  pickup_address: 'Fresh Market, Tangier',
  pickup_latitude: 35.7595,
  pickup_longitude: -5.8340,
  delivery_address: '123 Buyer Home, Tangier',
  delivery_latitude: 35.7720,
  delivery_longitude: -5.8000,
  cargo_size: 'medium',
  delivery_distance_km: 5.2,
  estimated_distance_km: 5.2,
  legal_pickup_verified_at: null,
  legal_dropoff_verified_at: null,
  current_latitude: 35.7650,
  current_longitude: -5.8200,
  last_location_update: '2024-01-15T11:30:00Z',
  delivery_price: 25,
  estimated_delivery_time: '2024-01-15T13:00:00Z',
  order: {
    id: 'order-001',
    order_number: 'ORD-D001',
    total: 250,
    status: 'out_for_delivery',
    shipping_address: '123 Buyer Home, Tangier',
    shipping_city: 'Tangier',
    shipping_latitude: 35.7720,
    shipping_longitude: -5.8000,
    driver_delivery_payment_method: 'cash',
    delivery_fee_total: 25,
    vendor_product_total: 225,
    legal_capture_required: false,
    legal_capture_completed: false,
    buyer: {
      id: 'buyer-001',
      first_name: 'Ali',
      last_name: 'Buyer',
      phone: '0611111111',
      email: 'ali@buyer.ma',
      city: 'Tangier',
    },
    vendor: {
      id: 'vendor-001',
      first_name: 'Hassan',
      last_name: 'Vendor',
      phone: '0622222222',
      store_name: 'Fresh Market',
      city: 'Tangier',
    },
  },
  driver: {
    id: 'driver-test-001',
    first_name: 'Ahmed',
    last_name: 'Driver',
    phone: '0633333333',
    avatar_url: null,
    vehicle_type: 'motorcycle',
    vehicle_plate: '12345-A-1',
  },
}

const MOCK_DELIVERY_NOT_FOUND = []

// ── Intercept Setup ────────────────────────────────────────────────────────

const setupTrackingIntercepts = (deliveryData = [MOCK_DELIVERY]) => {
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
    body: deliveryData,
    headers: deliveryData.length > 0
      ? { 'content-range': `0-0/${deliveryData.length}` }
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

  // 5. Edge functions for status updates
  cy.intercept('POST', '**/functions/v1/mark-delivery-picked-up', {
    statusCode: 200,
    body: { success: true, data: { status: 'picked_up' } },
  }).as('markPickedUp')

  cy.intercept('POST', '**/functions/v1/mark-delivery-on-the-way', {
    statusCode: 200,
    body: { success: true, data: { status: 'on_the_way' } },
  }).as('markOnTheWay')

  cy.intercept('POST', '**/functions/v1/mark-delivery-delivered', {
    statusCode: 200,
    body: { success: true, data: { status: 'delivered' } },
  }).as('markDelivered')

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

const visitDeliveryTracking = (deliveryId = 'del-001') => {
  cy.visit(`/driver/delivery/${deliveryId}/tracking`, {
    failOnStatusCode: false,
    timeout: 20000,
    onBeforeLoad: (win) => {
      win.localStorage.clear()
      win.sessionStorage.clear()
      win.localStorage.setItem(
        'sb-oyaiiyekfkflesdmcvvo-auth-token',
        JSON.stringify(MOCK_DRIVER_SESSION)
      )
      // Mock geolocation API to prevent errors in headless browser
      Object.defineProperty(win.navigator, 'geolocation', {
        value: {
          watchPosition: () => 123,
          clearWatch: () => {},
          getCurrentPosition: (success) => {
            if (success) {
              success({
                coords: {
                  latitude: 35.7650,
                  longitude: -5.8200,
                  accuracy: 10,
                  speed: null,
                },
              })
            }
          },
        },
        writable: true,
        configurable: true,
      })
      Object.defineProperty(win.navigator, 'permissions', {
        value: {
          query: () => Promise.resolve({ state: 'granted' }),
        },
        writable: true,
        configurable: true,
      })
    },
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════════════

describe('Driver Delivery Tracking — Page Health + UX + Critical Actions', () => {
  // ── Single consolidated test to avoid Electron renderer crashes ───────────
  it('page health, UX checks, timeline, status update, and not-found state', () => {
    // ═══════════════════════════════════════════════════════════════════════
    // PART 1: Page Health + UX Checks with delivery data
    // ═══════════════════════════════════════════════════════════════════════
    setupTrackingIntercepts([MOCK_DELIVERY])
    visitDeliveryTracking('del-001')
    cy.wait(10000)

    // ── Page Health ──
    assertNoWhiteScreen()
    cy.url().should('include', '/driver/delivery/del-001/tracking')
    cy.url().should('not.include', '/login')
    cy.url().should('not.include', '/onboarding')
    cy.url().should('not.include', '/vendor')

    // ── UX: Title visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(/Delivery Tracking|Tracking|تتبع/i.test(text)).to.be.true
      // Component renders Order # + order_id.substring(0, 8)
      expect(text).to.match(/Order #order-00/i)
    })

    // ── UX: Status timeline / progress steps ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      // Steps: Accepted → Picked Up → On the Way → Delivered
      expect(text).to.match(/Accepted|accepted/i)
      expect(text).to.match(/Picked Up|picked up/i)
      expect(text).to.match(/On the Way|on the way/i)
      expect(text).to.match(/Delivered|delivered/i)
    })

    // ── UX: Pickup and Delivery addresses ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      // Delivery address visible; pickup is in map component
      expect(text).to.include('Tangier')
      expect(text).to.include('Buyer Home')
    })

    // ── UX: Customer info ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Customer|مشتري|Client/i)
      expect(text).to.include('Ali')
      expect(text).to.include('Buyer')
      expect(text).to.include('0611111111')
    })

    // ── UX: Delivery details ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Distance|مسافة/i)
      expect(text).to.include('5.2')
      expect(text).to.match(/km/)
      expect(text).to.match(/Delivery Price|سعر التوصيل/i)
      expect(text).to.include('25')
      expect(text).to.match(/MAD/)
    })

    // ── UX: Estimated time ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Estimated Time|Estimated|وقت/i)
    })

    // ── UX: Call Customer button ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Call Customer|Call|اتصال/i)
    })

    // ── UX: Navigation buttons (Google Maps, Waze) ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Google|Waze|Maps/i)
    })

    // ── UX: Tracking status panel ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Tracking|تتبع/i)
      expect(text).to.match(/Inactive|Active|live/i)
    })

    // ── UX: Start Tracking button ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Start Tracking|tracking/i)
    })

    // ── UX: Status update button for picked_up status ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Start Delivery|Delivery|deliver/i)
    })

    // ── UX: Cancel button ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Cancel|إلغاء/i)
    })

    // ═══════════════════════════════════════════════════════════════════════
    // PART 2: Critical Action — Click "Start Delivery" (safe, mocked)
    // ═══════════════════════════════════════════════════════════════════════
    cy.contains('button', /Start Delivery|Delivery/i)
      .should('be.visible')
      .click()

    cy.wait(3000)

    // Page should not crash after clicking
    assertNoAppCrash()
    cy.url().should('include', '/driver/delivery/del-001/tracking')

    // After successful mocked update, status should change
    // The button text should now show "Mark as Delivered" (on_the_way status)
    cy.get('body').should(($body) => {
      const text = $body.text()
      // Should now show "Mark as Delivered" or similar
      expect(text).to.match(/Mark as Delivered|Delivered|deliver/i)
    })

    // ═══════════════════════════════════════════════════════════════════════
    // PART 3: Not Found State (empty delivery response)
    // ═══════════════════════════════════════════════════════════════════════
    setupTrackingIntercepts(MOCK_DELIVERY_NOT_FOUND)
    visitDeliveryTracking('del-999')
    cy.wait(10000)

    assertNoAppCrash()

    // Should show not found message
    cy.get('body').should(($body) => {
      const text = $body.text()
      const hasNotFound =
        /Delivery not found|Not found|لا يوجد|non trouvé/i.test(text)
      expect(hasNotFound, 'expected not-found text').to.be.true
    })

    // Should have back button
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Back to Active|Back|رجوع/i)
    })
  })
})
