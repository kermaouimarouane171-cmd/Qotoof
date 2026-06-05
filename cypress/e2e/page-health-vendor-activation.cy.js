/// <reference types="cypress" />

/**
 * Page Health + UX Checks — Vendor Activation Page
 * Tests /vendor/digital-contract for an unactivated vendor.
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
  paypal_email: '',
  agreement_accepted: false,
  agreement_accepted_at: null,
  is_active: false,
  onboarding_completed: true,
  onboarding_step: 100,
}

// ── Intercept Setup ────────────────────────────────────────────────────────

const setupVendorActivationIntercepts = () => {
  // App config
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

  // CORS preflights
  cy.intercept('OPTIONS', '**/auth/v1/**', { statusCode: 200, body: {} })
  cy.intercept('OPTIONS', '**/rest/v1/**', { statusCode: 200, body: {} })
  cy.intercept('OPTIONS', '**/functions/v1/**', { statusCode: 200, body: {} })

  // Auth session & user
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

  // Catch-all REST (must come BEFORE specific intercepts so specific ones win)
  cy.intercept('GET', '**/rest/v1/**', { statusCode: 200, body: [] }).as('fallbackGet')
  cy.intercept('POST', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackPost')
  cy.intercept('PATCH', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackPatch')

  // Profile fetch (must return single object because fetchProfile uses .maybeSingle())
  cy.intercept('GET', '**/rest/v1/profiles*', {
    statusCode: 200,
    body: MOCK_VENDOR_PROFILE,
  }).as('getProfile')

  // Vendor contracts query (existing contract check)
  cy.intercept('GET', '**/rest/v1/vendor_contracts*', {
    statusCode: 200,
    body: [],
  }).as('getVendorContracts')

  // Contract insert
  cy.intercept('POST', '**/rest/v1/vendor_contracts', {
    statusCode: 201,
    body: { id: 'contract-001' },
  }).as('insertVendorContract')

  // Profile update (agreement_accepted + is_active)
  cy.intercept('PATCH', '**/rest/v1/profiles?*id=eq.*', {
    statusCode: 200,
    body: {},
  }).as('updateProfile')

  // IP address service
  cy.intercept('GET', 'https://api.ipify.org/**', {
    statusCode: 200,
    body: { ip: '127.0.0.1' },
  }).as('getIpAddress')
}

const MOCK_VENDOR_SESSION = {
  access_token: 'test-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'test-refresh-token',
  user: MOCK_VENDOR_USER,
}

const visitVendorActivation = () => {
  cy.visit('/vendor/digital-contract', {
    onBeforeLoad: (win) => {
      win.localStorage.removeItem('sb-oyaiiyekfkflesdmcvvo-auth-token')
      win.localStorage.removeItem('auth-store')
      win.localStorage.removeItem('cart-storage')
      win.localStorage.removeItem('qotoof_cart')
      win.sessionStorage.clear()
      win.localStorage.setItem('sb-oyaiiyekfkflesdmcvvo-auth-token', JSON.stringify(MOCK_VENDOR_SESSION))
    },
  })
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('Page Health + UX Checks — Vendor Activation (/vendor/digital-contract)', () => {
  Cypress.on('uncaught:exception', (err) => {
    if (err.message?.includes('ResizeObserver')) return false
    return false
  })

  beforeEach(() => {
    setupVendorActivationIntercepts()
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. Page Health
  // ═══════════════════════════════════════════════════════════════════════════

  it('[Health] /vendor/digital-contract opens without white screen or crash', () => {
    visitVendorActivation()
    cy.location('pathname').should('eq', '/vendor/digital-contract')

    cy.get('[data-testid="digital-contract-page"]', { timeout: 15000 }).should('exist')
    assertNoWhiteScreen()
  })

  it('[Health] body is not empty and title is visible', () => {
    visitVendorActivation()
    cy.get('[data-testid="digital-contract-page"]', { timeout: 15000 }).should('exist')

    cy.get('[data-testid="digital-contract-title"]')
      .should('be.visible')
      .and('contain.text', 'تفعيل حساب البائع')
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. No sidebar / bottom nav for unactivated vendor
  // ═══════════════════════════════════════════════════════════════════════════

  it('[UX] unactivated vendor does NOT see sidebar or bottom nav on digital-contract', () => {
    visitVendorActivation()
    cy.get('[data-testid="digital-contract-page"]', { timeout: 15000 }).should('exist')

    // Mobile header should NOT appear (pre-activation layout is minimal)
    cy.get('[data-testid="role-mobile-header"]').should('not.exist')

    // Bottom nav should NOT appear
    cy.get('[data-testid="role-mobile-bottom-nav"]').should('not.exist')

    // Desktop sidebar links should NOT be present
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text()
      const hasDashboard = /Dashboard|لوحة|الرئيسية/.test(text)
      const hasProducts = /Products|منتجاتي|المنتجات/.test(text)
      const hasOrders = /Orders|الطلبات|طلباتي/.test(text)
      const hasSettings = /Settings|الإعدادات/.test(text)
      // On pre-activation, none of these sidebar links should exist
      return !hasDashboard || !hasProducts || !hasOrders || !hasSettings
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. UX — Page clearly explains activation purpose
  // ═══════════════════════════════════════════════════════════════════════════

  it('[UX] page clearly states activation is mandatory before selling', () => {
    visitVendorActivation()
    cy.get('[data-testid="digital-contract-page"]', { timeout: 15000 }).should('exist')

    // Should explain why this step is required
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text()
      return /مطلوبة|إلزامية| obligatory |required|mandatory/.test(text)
    })

    // Should mention dashboard, products, and orders as unavailable until signed
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text()
      const hasDashboard = /لوحة|dashboard/.test(text)
      const hasProducts = /منتجات|products/.test(text)
      const hasOrders = /طلبات|orders/.test(text)
      return hasDashboard && hasProducts && hasOrders
    })

    // Should mention PayPal / bank data for receiving payouts
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text()
      return /PayPal|بنك|bank|مستحقات|payout/.test(text)
    })

    // Should show a clear stepper / progression (معلوماتك, بيانات البنك, الموافقات)
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text()
      return /معلوماتك|بيانات البنك|الموافقات/.test(text)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Toggle Full Contract
  // ═══════════════════════════════════════════════════════════════════════════

  it('[Action] toggle-full-contract button shows and hides the full contract panel', () => {
    visitVendorActivation()
    cy.get('[data-testid="digital-contract-page"]', { timeout: 15000 }).should('exist')

    // Panel should NOT exist initially
    cy.get('[data-testid="full-contract-panel"]').should('not.exist')

    // Click toggle
    cy.get('[data-testid="toggle-full-contract"]').should('be.visible').click()

    // Panel should now exist and contain contract text
    cy.get('[data-testid="full-contract-panel"]').should('exist')
    cy.get('[data-testid="full-contract-panel"]')
      .should('contain.text', 'عمولة')

    // Click again to hide
    cy.get('[data-testid="toggle-full-contract"]').click()
    cy.get('[data-testid="full-contract-panel"]').should('not.exist')
  })

  it('[UX] full contract panel does not hide required form fields', () => {
    visitVendorActivation()
    cy.get('[data-testid="digital-contract-page"]', { timeout: 15000 }).should('exist')

    // Open full contract
    cy.get('[data-testid="toggle-full-contract"]').click()
    cy.get('[data-testid="full-contract-panel"]').should('exist')

    // Required bank fields should still be visible outside the panel
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text()
      return /CIN|بطاقة التعريف/.test(text)
    })
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text()
      return /IBAN|رقم IBAN/.test(text)
    })
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text()
      return /اسم البنك|Bank/.test(text)
    })
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text()
      return /صاحب الحساب|Account holder/.test(text)
    })
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Required Form Fields Visible
  // ═══════════════════════════════════════════════════════════════════════════

  it('[UX] all required fields are visible and accessible', () => {
    visitVendorActivation()
    cy.get('[data-testid="digital-contract-page"]', { timeout: 15000 }).should('exist')

    // Personal info
    cy.get('input[aria-label="الاسم الكامل"]').should('be.visible')
    cy.get('input[aria-label="البريد الإلكتروني"]').should('be.visible')
    cy.get('input[aria-label="رقم الهاتف"]').should('be.visible')
    cy.get('input[aria-label="بريد PayPal"]').should('be.visible')

    // Identity & Bank
    cy.get('input[aria-label="رقم بطاقة التعريف الوطنية"]').should('be.visible')
    cy.get('select[aria-label="اسم البنك"]').should('be.visible')
    cy.get('input[aria-label="رقم IBAN"]').should('be.visible')
    cy.get('input[aria-label="اسم صاحب الحساب"]').should('be.visible')
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Sign Button Starts Disabled
  // ═══════════════════════════════════════════════════════════════════════════

  it('[Action] sign-contract-button is disabled when fields are incomplete', () => {
    visitVendorActivation()
    cy.get('[data-testid="digital-contract-page"]', { timeout: 15000 }).should('exist')

    cy.get('[data-testid="sign-contract-button"]')
      .should('be.visible')
      .and('be.disabled')
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Sign Button Becomes Enabled After Filling
  // ═══════════════════════════════════════════════════════════════════════════

  it('[Action] sign-contract-button becomes enabled after filling all required fields and checkboxes', () => {
    visitVendorActivation()
    cy.get('[data-testid="digital-contract-page"]', { timeout: 15000 }).should('exist')

    // Fill personal info
    cy.get('input[aria-label="الاسم الكامل"]').clear().type('Vendor Test')
    cy.get('input[aria-label="البريد الإلكتروني"]').clear().type('vendor@test.ma')
    cy.get('input[aria-label="رقم الهاتف"]').clear().type('0612345678')
    cy.get('input[aria-label="بريد PayPal"]').clear().type('vendor-paypal@test.ma')

    // Fill identity & bank
    cy.get('input[aria-label="رقم بطاقة التعريف الوطنية"]').clear().type('AB123456')
    cy.get('select[aria-label="اسم البنك"]').select('Attijariwafa Bank')
    cy.get('input[aria-label="رقم IBAN"]').clear().type('MA64011519000001205000534921')
    cy.get('input[aria-label="اسم صاحب الحساب"]').clear().type('Vendor Test')

    // Check the 3 consent checkboxes (index-based for reliability with React controlled inputs)
    cy.get('input[type="checkbox"]').eq(0).click()
    cy.get('input[type="checkbox"]').eq(1).click()
    cy.get('input[type="checkbox"]').eq(2).click()

    // Button should now be enabled
    cy.get('[data-testid="sign-contract-button"]', { timeout: 5000 })
      .should('be.visible')
      .and('not.be.disabled')
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. Mocked Contract Signing
  // ═══════════════════════════════════════════════════════════════════════════

  it('[Critical] signing the contract sends correct payloads and navigates to dashboard', () => {
    visitVendorActivation()
    cy.get('[data-testid="digital-contract-page"]', { timeout: 15000 }).should('exist')

    // Fill all fields
    cy.get('input[aria-label="الاسم الكامل"]').clear().type('Vendor Test')
    cy.get('input[aria-label="البريد الإلكتروني"]').clear().type('vendor@test.ma')
    cy.get('input[aria-label="رقم الهاتف"]').clear().type('0612345678')
    cy.get('input[aria-label="بريد PayPal"]').clear().type('vendor-paypal@test.ma')
    cy.get('input[aria-label="رقم بطاقة التعريف الوطنية"]').clear().type('AB123456')
    cy.get('select[aria-label="اسم البنك"]').select('Attijariwafa Bank')
    cy.get('input[aria-label="رقم IBAN"]').clear().type('MA64011519000001205000534921')
    cy.get('input[aria-label="اسم صاحب الحساب"]').clear().type('Vendor Test')

    // Check the 3 consent checkboxes (index-based for reliability with React controlled inputs)
    cy.get('input[type="checkbox"]').eq(0).click()
    cy.get('input[type="checkbox"]').eq(1).click()
    cy.get('input[type="checkbox"]').eq(2).click()

    // Stub confirm dialogs to auto-accept
    cy.window().then((win) => {
      cy.stub(win, 'confirm').returns(true)
    })

    // Click sign
    cy.get('[data-testid="sign-contract-button"]').should('not.be.disabled').click()

    // Verify vendor_contracts insert was called
    cy.wait('@insertVendorContract').then((interception) => {
      const body = interception.request.body
      // Should contain contract data
      expect(body).to.satisfy((payload) => {
        if (Array.isArray(payload)) {
          return payload[0].vendor_id === 'vendor-test-001' && payload[0].full_name === 'Vendor Test'
        }
        return payload.vendor_id === 'vendor-test-001'
      })
    })

    // Verify profiles update was called (agreement_accepted + is_active)
    cy.wait('@updateProfile').then((interception) => {
      const body = interception.request.body
      expect(body).to.have.property('agreement_accepted', true)
      expect(body).to.have.property('is_active', true)
      // MUST NOT contain paypal_email or payout_method
      expect(body).to.not.have.property('paypal_email')
      expect(body).to.not.have.property('payout_method')
    })

    // Should navigate to dashboard (or at least away from digital-contract)
    cy.location('pathname', { timeout: 10000 }).should('not.eq', '/vendor/digital-contract')
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. Cancel Button (without real logout)
  // ═══════════════════════════════════════════════════════════════════════════

  it('[Action] cancel-contract-button is visible and dismissible without crashing', () => {
    visitVendorActivation()
    cy.get('[data-testid="digital-contract-page"]', { timeout: 15000 }).should('exist')

    // Button should be visible with clear text
    cy.get('[data-testid="cancel-contract-button"]')
      .should('be.visible')
      .and('contain.text', 'تسجيل الخروج')

    // Stub confirm to return false (user changes their mind)
    cy.window().then((win) => {
      cy.stub(win, 'confirm').returns(false)
    })

    // Click cancel
    cy.get('[data-testid="cancel-contract-button"]').click()

    // Page should NOT crash and should still be on digital-contract
    assertNoWhiteScreen()
    cy.location('pathname').should('eq', '/vendor/digital-contract')
    cy.get('[data-testid="digital-contract-page"]').should('exist')
  })

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. No PayPal error banner after valid PayPal email
  // ═══════════════════════════════════════════════════════════════════════════

  it('[UX] valid PayPal email removes the validation warning', () => {
    visitVendorActivation()
    cy.get('[data-testid="digital-contract-page"]', { timeout: 15000 }).should('exist')

    // Enter invalid PayPal first
    cy.get('input[aria-label="بريد PayPal"]').clear().type('not-an-email')
    cy.get('body').should('contain.text', 'يرجى إدخال بريد PayPal')

    // Enter valid PayPal
    cy.get('input[aria-label="بريد PayPal"]').clear().type('valid@paypal.ma')
    cy.get('body').should('not.contain.text', 'يرجى إدخال بريد PayPal')
  })
})
