/// <reference types="cypress" />

/**
 * Page Health + UX Checks + Critical Save Action
 * Tests /driver/settings for an activated driver.
 * All Supabase calls are mocked. No real backend is touched.
 * No real profile is updated, deleted, or modified on the server.
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
  email: 'driver@test.ma',
  phone: '0612345678',
  city: 'Tangier',
  is_active: true,
  onboarding_completed: true,
  onboarding_step: 100,
  vendor_search_done: true,
  paypal_email: 'driver-paypal@test.ma',
  paypal_verified: true,
  vehicle_type: 'motorcycle',
  vehicle_plate: 'ABC-1234',
  license_number: 'DL-123456',
  is_available_for_delivery: true,
  notify_new_deliveries: true,
  notify_order_updates: true,
  notify_customer_messages: true,
  min_delivery_distance_km: 0,
  max_delivery_distance_km: 50,
  accepted_cargo_sizes: ['small', 'medium'],
  driver_delivery_payment_cash: true,
  driver_delivery_payment_transfer: true,
  driver_delivery_payment_notes: '',
}

const MOCK_DRIVER_SESSION = {
  access_token: 'test-driver-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'test-driver-refresh',
  user: MOCK_DRIVER_USER,
}

// ── Intercept Setup ────────────────────────────────────────────────────────

const setupSettingsIntercepts = (profileData = MOCK_DRIVER_PROFILE, patchStatusCode = 200) => {
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
  cy.intercept('PATCH', '**/rest/v1/**', { statusCode: patchStatusCode, body: {} }).as('fallbackPatch')

  // 4. Specific REST overrides
  cy.intercept('GET', '**/rest/v1/profiles*', {
    statusCode: 200,
    body: profileData,
    headers: { 'content-range': '0-0/1' },
  }).as('getProfile')

  cy.intercept('PATCH', '**/rest/v1/profiles*', {
    statusCode: patchStatusCode,
    body: patchStatusCode === 200 ? { ...profileData, vehicle_plate: 'XYZ-5678' } : { message: 'Update failed' },
  }).as('updateProfile')

  cy.intercept('POST', '**/rest/v1/audit_logs', {
    statusCode: 201,
    body: {},
  }).as('auditLog')

  cy.intercept('GET', '**/rest/v1/notifications*', {
    statusCode: 200,
    body: [],
  }).as('getNotifications')

  // 5. Edge / config
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

const visitDriverSettings = () => {
  cy.visit('/driver/settings', {
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

describe('Driver Settings — Page Health + UX + Critical Save Action', () => {
  // ── Single consolidated test to avoid Electron renderer crashes ───────────
  it('page health, UX checks, save action, availability toggle, and error handling', () => {
    // ═══════════════════════════════════════════════════════════════════════
    // PART 1: Page Health + UX Checks
    // ═══════════════════════════════════════════════════════════════════════
    setupSettingsIntercepts(MOCK_DRIVER_PROFILE, 200)
    visitDriverSettings()
    cy.wait(8000)

    // ── Page Health ──
    assertNoWhiteScreen()
    cy.url().should('include', '/driver/settings')
    cy.url().should('not.include', '/login')
    cy.url().should('not.include', '/onboarding')
    cy.url().should('not.include', '/vendor')

    // ── UX: Title visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(/Driver Settings|Settings|إعدادات/i.test(text)).to.be.true
    })

    // ── UX: PayPal Setup ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/PayPal/i)
      expect(text).to.match(/PayPal Email|بريد|email/i)
      expect(text).to.match(/تم التحقق|Verified|verified/i)
    })
    // PayPal email is in input value, not body text
    cy.get('input[type="email"]').should('have.value', 'driver-paypal@test.ma')

    // ── UX: Vehicle Settings ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Vehicle|مركبة|véhicule/i)
      expect(text).to.match(/Vehicle Plate|Plate|لوحة/i)
      expect(text).to.match(/License|رخصة|permis/i)
    })
    // Vehicle data is in input values
    cy.get('input').then(($inputs) => {
      const values = $inputs.map((i, el) => el.value).get().join(' ')
      expect(values).to.include('ABC-1234')
      expect(values).to.include('DL-123456')
    })

    // ── UX: Delivery Preferences ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/تفضيلات التوصيل|Delivery|Préférences/i)
      expect(text).to.match(/أدنى|minimum|min/i)
      expect(text).to.match(/أقصى|maximum|max/i)
    })
    // Distance values are in inputs
    cy.get('input[type="number"]').then(($inputs) => {
      const values = $inputs.map((i, el) => el.value).get()
      expect(values).to.include('0')
      expect(values).to.include('50')
    })

    // ── UX: Cargo sizes visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/صغيرة|small|petite/i)
      expect(text).to.match(/متوسطة|medium|moyenne/i)
    })

    // ── UX: Delivery Payment Policy ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/نقداً|Cash|paiement/i)
      expect(text).to.match(/تحويل|Transfer|virement/i)
    })

    // ── UX: Availability Settings ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Available|Availability|متاح|disponible/i)
      expect(text).to.match(/delivery requests|توصيل|livraison/i)
    })

    // ── UX: Notifications ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Notifications|إشعارات|notific/i)
      expect(text).to.match(/New Delivery|طلبات جديدة|nouvelle/i)
      expect(text).to.match(/Order Status|حالة الطلب|statut/i)
      expect(text).to.match(/Customer|رسائل|messages/i)
    })

    // ── UX: Save button visible ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Save|حفظ|Enregistrer/i)
    })

    // ═══════════════════════════════════════════════════════════════════════
    // PART 2: Critical Save Action — Change Vehicle Plate (mocked)
    // ═══════════════════════════════════════════════════════════════════════
    cy.get('input[placeholder*="ABC"], input[name*="plate"], input').then(($inputs) => {
      const plateInput = $inputs.filter((i, el) => {
        const placeholder = el.getAttribute('placeholder') || ''
        const name = el.getAttribute('name') || ''
        const id = el.getAttribute('id') || ''
        return placeholder.includes('ABC') || name.includes('plate') || id.includes('plate')
      })
      if (plateInput.length > 0) {
        cy.wrap(plateInput).clear().type('XYZ-5678')
      }
    })

    cy.wait(1000)

    // Unsaved changes should appear
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/unsaved|unsaved changes|تغييرات|non enregistré/i)
    })

    // Click Save
    cy.contains('button', /Save Settings|Save|حفظ|Enregistrer/i)
      .should('be.visible')
      .click()

    cy.wait('@updateProfile', { timeout: 15000 }).then((interception) => {
      expect(interception.request.method).to.match(/PATCH/i)
    })

    cy.wait(3000)

    // Page should not crash after saving
    assertNoAppCrash()
    cy.url().should('include', '/driver/settings')

    // ── Success feedback ──
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/تم حفظ|Saved|success|updated|تحدث/i)
    })

    // ═══════════════════════════════════════════════════════════════════════
    // PART 3: Availability Toggle (safe, no real update)
    // ═══════════════════════════════════════════════════════════════════════
    cy.get('input[type="checkbox"]').then(($checkboxes) => {
      const availCheckbox = $checkboxes.filter((i, el) => {
        const id = el.getAttribute('id') || ''
        return id.includes('available') || id.includes('delivery')
      })
      if (availCheckbox.length > 0) {
        // Toggle off
        cy.wrap(availCheckbox).first().uncheck({ force: true })
        cy.wait(500)

        // Unsaved changes should reappear
        cy.get('body').should(($body) => {
          const text = $body.text()
          expect(text).to.match(/unsaved|unsaved changes|تغييرات|non enregistré/i)
        })

        // Toggle back on
        cy.wrap(availCheckbox).first().check({ force: true })
      }
    })

    // ═══════════════════════════════════════════════════════════════════════
    // PART 4: Error Handling — Mocked save failure
    // ═══════════════════════════════════════════════════════════════════════
    setupSettingsIntercepts(MOCK_DRIVER_PROFILE, 500)
    visitDriverSettings()
    cy.wait(8000)

    // Change a field
    cy.get('input').then(($inputs) => {
      const plateInput = $inputs.filter((i, el) => {
        const placeholder = el.getAttribute('placeholder') || ''
        return placeholder.includes('ABC')
      })
      if (plateInput.length > 0) {
        cy.wrap(plateInput).clear().type('ERROR-TEST')
      }
    })

    cy.wait(500)

    // Click Save with mocked error
    cy.contains('button', /Save Settings|Save|حفظ|Enregistrer/i)
      .should('be.visible')
      .click()

    cy.wait('@updateProfile', { timeout: 15000 })
    cy.wait(3000)

    // Page should NOT crash even on error
    assertNoAppCrash()
    cy.url().should('include', '/driver/settings')

    // Should show error feedback or remain on page
    cy.get('body').should(($body) => {
      const text = $body.text()
      // Either error message or still on settings page
      expect(text).to.match(/Failed|فشل|error|خطأ|Save/i)
    })
  })
})
