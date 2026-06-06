/// <reference types="cypress" />

/**
 * Page Health + UX Checks + Critical Save Action
 * Tests /vendor/settings for an activated vendor.
 * All Supabase calls are mocked. No real backend is touched.
 */

// ── Helpers ────────────────────────────────────────────────────────────────

const assertBodyNotEmpty = () => {
  cy.get('body').should('not.be.empty')
}

const assertNoAppCrash = () => {
  cy.get('#root').should('exist')
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
  min_order_amount: 50,
  currency: 'MAD',
  low_stock_threshold: 10,
  payment_policy_full: true,
  payment_policy_split: true,
  payment_policy_cod: false,
  notify_new_orders: true,
  notify_order_updates: true,
  notify_customer_messages: true,
  notify_low_stock: true,
  notify_reviews: true,
  store_paused: false,
  store_paused_reason: '',
  latitude: 34.0209,
  longitude: -6.8416,
  store_address: 'Casablanca, Morocco',
}

const MOCK_CANCELLATION_POLICY = {
  allow_cancellation: true,
  free_cancellation_window_minutes: 120,
  cutoff_status: 'vendor_accepted',
  cancellation_fee_type: 'fixed',
  cancellation_fee_value: 0,
  refund_percentage: 100,
  policy_text_en: 'Free cancellation within 2 hours.',
  policy_text_ar: 'إلغاء مجاني خلال ساعتين.',
}

const MOCK_REFUND_POLICY = {
  return_window_days: 7,
  allow_partial_returns: true,
  return_shipping_paid_by: 'buyer',
  non_returnable_categories: [],
  policy_text: 'Returns accepted within 7 days.',
}

const MOCK_VENDOR_SESSION = {
  access_token: 'test-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'test-refresh-token',
  user: MOCK_VENDOR_USER,
}

// ── Intercept Setup ────────────────────────────────────────────────────────

const setupVendorSettingsIntercepts = () => {
  // Public config
  cy.intercept('GET', '**/functions/v1/get-public-config', {
    statusCode: 200,
    body: {
      supabase: { url: 'https://test-project.supabase.co', anonKey: 'test-anon-key' },
      sentry: { dsn: null },
      recaptcha: { siteKey: null },
      features: { enableDriverTracking: false },
      app: { name: 'Qotoof', version: '1.0.0' },
    },
  }).as('getPublicConfig')

  // CORS preflight
  cy.intercept('OPTIONS', '**/auth/v1/**', { statusCode: 200, body: {} })
  cy.intercept('OPTIONS', '**/rest/v1/**', { statusCode: 200, body: {} })

  // Auth
  cy.intercept('GET', '**/auth/v1/session', {
    statusCode: 200,
    body: {
      data: {
        session: {
          access_token: 'test-access-token',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: 'test-refresh-token',
          user: MOCK_VENDOR_USER,
        },
      },
      error: null,
    },
  }).as('authSession')

  cy.intercept('GET', '**/auth/v1/user', {
    statusCode: 200,
    body: { ...MOCK_VENDOR_USER, aud: 'authenticated', role: 'authenticated' },
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

  // Catch-all REST (before specific ones so specifics win)
  cy.intercept('GET', '**/rest/v1/**', { statusCode: 200, body: [] }).as('fallbackGet')
  cy.intercept('POST', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackPost')
  cy.intercept('PATCH', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackPatch')

  // Profile fetch (single object because .maybeSingle())
  cy.intercept('GET', '**/rest/v1/profiles*', {
    statusCode: 200,
    body: MOCK_VENDOR_PROFILE,
  }).as('getProfile')

  // Cancellation policy
  cy.intercept('GET', '**/rest/v1/vendor_cancellation_policies*', {
    statusCode: 200,
    body: MOCK_CANCELLATION_POLICY,
  }).as('getCancellationPolicy')

  // Refund policy
  cy.intercept('GET', '**/rest/v1/refund_policies*', {
    statusCode: 200,
    body: MOCK_REFUND_POLICY,
  }).as('getRefundPolicy')

  // Audit logs (fire-and-forget async)
  cy.intercept('POST', '**/rest/v1/audit_logs', {
    statusCode: 201,
    body: {},
  }).as('insertAuditLog')

  // IP address
  cy.intercept('GET', 'https://api.ipify.org/**', {
    statusCode: 200,
    body: { ip: '127.0.0.1' },
  }).as('getIpAddress')
}

const visitVendorSettings = () => {
  cy.visit('/vendor/settings', {
    onBeforeLoad: (win) => {
      win.localStorage.clear()
      win.sessionStorage.clear()
      win.localStorage.setItem('sb-oyaiiyekfkflesdmcvvo-auth-token', JSON.stringify(MOCK_VENDOR_SESSION))
    },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Page Health + UX Checks + Critical Save Action — Vendor Settings (/vendor/settings)', () => {
  beforeEach(() => {
    setupVendorSettingsIntercepts()
  })

  // ── 1. Page Health ──────────────────────────────────────────────────────
  it('[Health] /vendor/settings opens without white screen or crash for active vendor', () => {
    visitVendorSettings()
    cy.wait(12000)

    assertNoWhiteScreen()
    cy.location('pathname').should('eq', '/vendor/settings')
    cy.get('body').should('not.contain', 'Authentication is taking longer')
  })

  it('[Health] body is not empty and settings title is visible', () => {
    visitVendorSettings()
    cy.wait(12000)

    assertBodyNotEmpty()
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Vendor Settings|إعدادات|Settings|Paramètres/)
    })
  })

  // ── 2. UX Checks ────────────────────────────────────────────────────────
  it('[UX] active vendor sees store settings, PayPal, notifications, and save button', () => {
    visitVendorSettings()
    cy.wait(12000)

    // Store settings section
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Store Settings|Store Name|store_name|إعدادات المتجر/)
    })

    // PayPal section
    cy.get('body').should('contain', 'PayPal')

    // Notifications section
    cy.get('body').should(($body) => {
      const text = $body.text()
      expect(text).to.match(/Notifications|New Orders|Order Updates|الإشعارات/)
    })

    // Save button visible
    cy.get('button').then(($buttons) => {
      const saveBtn = $buttons.filter((i, el) =>
        /Save Settings|Save Changes|حفظ|Enregistrer|saving/i.test(el.innerText)
      )
      expect(saveBtn.length).to.be.at.least(1)
    })

    // Should NOT see activation redirect
    cy.location('pathname').should('eq', '/vendor/settings')
    cy.get('body').should('not.contain', 'تفعيل حساب البائع')
    cy.get('body').should('not.contain', 'digital contract')
  })

  // ── 3. Critical Action — Save Settings ────────────────────────────────
  it('[Critical] saving settings sends correct payload and does NOT include paypal_email or payout_method', () => {
    // Override the PATCH intercept to capture payload
    cy.intercept('PATCH', '**/rest/v1/profiles*', (req) => {
      req.reply({ statusCode: 200, body: { ...MOCK_VENDOR_PROFILE, ...req.body } })
    }).as('updateProfile')

    visitVendorSettings()
    cy.wait(12000)

    // Change store name to trigger hasChanges — find input near "Store Name" label
    cy.get('label').then(($labels) => {
      const storeNameLabel = $labels.filter((i, el) =>
        /Store Name|store_name|اسم المتجر/i.test(el.innerText)
      )
      if (storeNameLabel.length > 0) {
        cy.wrap(storeNameLabel[0]).closest('div').find('input').clear().type('Updated Test Store')
      } else {
        // Fallback: find first text input and change it
        cy.get('input[type="text"]').first().clear().type('Updated Test Store')
      }
    })

    // Click save button using stable selector
    cy.contains('button', /Save Settings|Save Changes|حفظ|Enregistrer/i)
      .should('not.be.disabled')
      .click()

    // Wait for update to be called and inspect payload via interception
    cy.wait('@updateProfile', { timeout: 10000 }).then((interception) => {
      const body = interception.request.body
      expect(body, 'payload should not be null').to.not.be.null
      expect(body).to.not.have.property('paypal_email')
      expect(body).to.not.have.property('payout_method')
      expect(body).to.have.property('store_name', 'Updated Test Store')
      expect(body).to.have.property('min_order_amount')
      expect(body).to.have.property('currency')
      expect(body).to.have.property('low_stock_threshold')
    })
  })

  // ── 4. Error Handling — Mocked save failure ─────────────────────────────
  it('[Error] mocked save failure does NOT crash the page and shows feedback', () => {
    cy.intercept('PATCH', '**/rest/v1/profiles*', {
      statusCode: 500,
      body: { message: 'Internal Server Error' },
    }).as('updateProfileError')

    visitVendorSettings()
    cy.wait(12000)

    // Change a field to enable save
    cy.get('label').then(($labels) => {
      const storeNameLabel = $labels.filter((i, el) =>
        /Store Name|store_name|اسم المتجر/i.test(el.innerText)
      )
      if (storeNameLabel.length > 0) {
        cy.wrap(storeNameLabel[0]).closest('div').find('input').clear().type('Crash Test Store')
      } else {
        cy.get('input[type="text"]').first().clear().type('Crash Test Store')
      }
    })

    // Click save button using stable selector
    cy.contains('button', /Save Settings|Save Changes|حفظ|Enregistrer/i)
      .should('not.be.disabled')
      .click()

    cy.wait('@updateProfileError', { timeout: 10000 })

    // Page should still be stable
    cy.location('pathname').should('eq', '/vendor/settings')
    assertNoAppCrash()

    // Should show some error feedback (toast or inline)
    cy.get('body').should(($body) => {
      const text = $body.text().toLowerCase()
      const hasError =
        text.includes('failed') ||
        text.includes('error') ||
        text.includes('فشل') ||
        text.includes('خطأ') ||
        text.includes('erreur')
      expect(hasError, 'expected error feedback text').to.be.true
    })
  })
})
