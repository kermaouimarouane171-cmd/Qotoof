/**
 * 🧪 Cypress Support - Custom Commands
 * Reusable commands for E2E tests
 */

import { addMatchImageSnapshotCommand } from 'cypress-image-snapshot/command'

addMatchImageSnapshotCommand({
  capture: 'viewport',
  customSnapshotsDir: 'cypress/snapshots',
})

// ============================================
// 1. AUTHENTICATION COMMANDS
// ============================================

/**
 * Login with email and password
 */
const completeOnboardingIfNeeded = () => {
  cy.location('pathname').then((pathname) => {
    if (!pathname.startsWith('/onboarding/')) {
      return
    }

    cy.get('[data-testid="onboarding-primary-action"]').click()
    cy.location('pathname').then((nextPath) => {
      if (nextPath.startsWith('/onboarding/')) {
        completeOnboardingIfNeeded()
      }
    })
  })
}

const waitForAliasIfRegistered = (aliasName) => {
  cy.then(() => {
    const aliases = Cypress.state('aliases') || {}
    if (aliases[aliasName]) {
      cy.wait(`@${aliasName}`, { timeout: 15000 })
    }
  })
}

Cypress.Commands.add('login', (email, password) => {
  cy.visit('/login')
  cy.get('[data-testid="login-email-input"]').clear().type(email)
  cy.get('[data-testid="login-password-input"]').clear().type(password)
  cy.get('[data-testid="login-submit-button"]').click()

  waitForAliasIfRegistered('secureLogin')

  completeOnboardingIfNeeded()
})

/**
 * Login as vendor
 */
Cypress.Commands.add('loginAsVendor', () => {
  const email = Cypress.env('VENDOR_EMAIL') || 'vendor@greenmarket.test'
  const password = Cypress.env('VENDOR_PASSWORD') || 'Test@123456'
  cy.login(email, password)
})

/**
 * Login as buyer
 */
Cypress.Commands.add('loginAsBuyer', () => {
  const email = Cypress.env('BUYER_EMAIL') || 'buyer@greenmarket.test'
  const password = Cypress.env('BUYER_PASSWORD') || 'Test@123456'
  cy.login(email, password)
})

/**
 * Login as admin
 */
Cypress.Commands.add('loginAsAdmin', () => {
  const email = Cypress.env('ADMIN_EMAIL') || 'admin@greenmarket.test'
  const password = Cypress.env('ADMIN_PASSWORD') || 'Test@123456'
  cy.login(email, password)
})

/**
 * Login as driver
 */
Cypress.Commands.add('loginAsDriver', () => {
  const email = Cypress.env('DRIVER_EMAIL') || 'driver@greenmarket.test'
  const password = Cypress.env('DRIVER_PASSWORD') || 'Test@123456'
  cy.login(email, password)
})

/**
 * Generic role-based login helper.
 * Example: cy.loginAs('buyer')
 */
Cypress.Commands.add('loginAs', (role = 'buyer') => {
  const normalizedRole = String(role || 'buyer').trim().toLowerCase()

  if (normalizedRole === 'buyer') return cy.loginAsBuyer()
  if (normalizedRole === 'vendor') return cy.loginAsVendor()
  if (normalizedRole === 'driver') return cy.loginAsDriver()
  if (normalizedRole === 'admin') return cy.loginAsAdmin()

  throw new Error(`Unsupported role for cy.loginAs(): ${role}`)
})

/**
 * Logout
 */
Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click()
  cy.get('[data-testid="logout-button"]').click()
  cy.url().should('not.include', '/vendor')
})

// ============================================
// 2. NAVIGATION COMMANDS
// ============================================

/**
 * Navigate to page and verify
 */
Cypress.Commands.add('navigateTo', (url, expectedText) => {
  cy.visit(url)
  if (expectedText) {
    cy.contains(expectedText).should('be.visible')
  }
})

/**
 * Wait for page to load
 */
Cypress.Commands.add('waitForPageLoad', () => {
  cy.get('[data-testid="page-loaded"]').should('exist')
})

// ============================================
// 3. FORM COMMANDS
// ============================================

/**
 * Fill form fields
 */
Cypress.Commands.add('fillForm', (fields) => {
  Object.entries(fields).forEach(([name, value]) => {
    const field = cy.get(`[name="${name}"]`)
    if (value.type === 'select') {
      field.select(value.value)
    } else if (value.type === 'checkbox') {
      if (value.checked) {
        field.check()
      } else {
        field.uncheck()
      }
    } else {
      field.clear().type(value.value)
    }
  })
})

/**
 * Submit form and verify
 */
Cypress.Commands.add('submitForm', (successMessage) => {
  cy.get('form').submit()
  if (successMessage) {
    cy.contains(successMessage).should('be.visible')
  }
})

// ============================================
// 4. DATA SEEDING COMMANDS
// ============================================

/**
 * Create test product via API
 */
Cypress.Commands.add('createProduct', (productData) => {
  cy.request('POST', '/api/test/products', productData)
})

/**
 * Create test order via API
 */
Cypress.Commands.add('createOrder', (orderData) => {
  cy.request('POST', '/api/test/orders', orderData)
})

/**
 * Add a fixture-backed product directly to persisted cart storage.
 */
Cypress.Commands.add('addToCart', (productId) => {
  cy.fixture('products').then((fixture) => {
    const products = fixture?.products || []
    const product = products.find((entry) => entry.id === productId)

    if (!product) {
      throw new Error(`Product not found in fixtures: ${productId}`)
    }

    cy.window().then((win) => {
      const rawCart = win.localStorage.getItem('cart-storage')
      let parsedCart = { state: { items: [], lastValidated: null, checkoutVendorId: null }, version: 0 }

      if (rawCart) {
        try {
          parsedCart = JSON.parse(rawCart)
        } catch (_e) {
          parsedCart = { state: { items: [], lastValidated: null, checkoutVendorId: null }, version: 0 }
        }
      }

      const state = parsedCart.state || {}
      const existingItems = Array.isArray(state.items) ? [...state.items] : []
      const existingIndex = existingItems.findIndex((item) => item.id === product.id)

      const cartItem = {
        id: product.id,
        name: product.name,
        price_per_unit: Number(product.price_per_unit || product.price || 0),
        unit_type: product.unit_type || 'kg',
        quantity: Number(product.min_order_quantity || 1),
        min_order_quantity: Number(product.min_order_quantity || 1),
        is_available: product.is_available !== false,
        available_quantity: Number(product.available_quantity || 999),
        vendor_id: product.vendor_id,
        vendor_name: product.vendor_name || product.store_name || 'Vendor',
        image_url: product.image_url || null,
        category: product.category || 'produce',
        subcategory: product.subcategory || null,
      }

      if (existingIndex >= 0) {
        existingItems[existingIndex] = {
          ...existingItems[existingIndex],
          ...cartItem,
          quantity: Number(existingItems[existingIndex].quantity || 0) + cartItem.quantity,
        }
      } else {
        existingItems.push(cartItem)
      }

      const nextCart = {
        ...parsedCart,
        state: {
          ...state,
          items: existingItems,
          checkoutVendorId: product.vendor_id || null,
          lastValidated: null,
        },
      }

      win.localStorage.setItem('cart-storage', JSON.stringify(nextCart))
    })
  })
})

/**
 * Clear test data
 */
Cypress.Commands.add('clearTestData', () => {
  cy.request('DELETE', '/api/test/clear')
})

// ============================================
// 5. VISUAL ASSERTION COMMANDS
// ============================================

/**
 * Assert element is visible
 */
Cypress.Commands.add('shouldBeVisible', (selector) => {
  cy.get(selector).should('be.visible')
})

/**
 * Assert element contains text
 */
Cypress.Commands.add('shouldContain', (selector, text) => {
  cy.get(selector).should('contain', text)
})

/**
 * Assert element has attribute
 */
Cypress.Commands.add('shouldHaveAttr', (selector, attr, value) => {
  cy.get(selector).should('have.attr', attr, value)
})

// ============================================
// 6. MOBILE COMMANDS
// ============================================

/**
 * Viewport mobile
 */
Cypress.Commands.add('mobileView', () => {
  cy.viewport('iphone-6')
})

/**
 * Viewport tablet
 */
Cypress.Commands.add('tabletView', () => {
  cy.viewport('ipad-2')
})

/**
 * Viewport desktop
 */
Cypress.Commands.add('desktopView', () => {
  cy.viewport(1280, 720)
})

// ============================================
// 7. WAIT COMMANDS
// ============================================

/**
 * Wait for network request
 */
Cypress.Commands.add('waitForRequest', (url) => {
  cy.intercept(url).as('request')
  return cy.wait('@request')
})

/**
 * Wait for animation
 */
Cypress.Commands.add('waitForAnimation', (ms = 500) => {
  cy.wait(ms)
})

// ============================================
// 8. DATABASE COMMANDS
// ============================================

/**
 * Query database (requires Supabase)
 */
Cypress.Commands.add('queryDatabase', (table, query) => {
  cy.task('queryDatabase', { table, query })
})

/**
 * Insert into database
 */
Cypress.Commands.add('insertIntoDatabase', (table, data) => {
  cy.task('insertIntoDatabase', { table, data })
})
