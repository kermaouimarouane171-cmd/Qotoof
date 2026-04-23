/**
 * 🧪 Cypress Support - Custom Commands
 * Reusable commands for E2E tests
 */

// ============================================
// 1. AUTHENTICATION COMMANDS
// ============================================

/**
 * Login with email and password
 */
Cypress.Commands.add('login', (email, password) => {
  cy.session([email, password], () => {
    cy.visit('/login')
    cy.get('input[type="email"]').type(email)
    cy.get('input[type="password"]').type(password)
    cy.contains('button', /sign in|login/i).click()
    cy.url().should('not.include', '/login')
  })
})

/**
 * Login as vendor
 */
Cypress.Commands.add('loginAsVendor', () => {
  const email = Cypress.env('VENDOR_EMAIL') || 'vendor@example.com'
  const password = Cypress.env('VENDOR_PASSWORD') || 'Vendor123!'
  cy.login(email, password)
})

/**
 * Login as buyer
 */
Cypress.Commands.add('loginAsBuyer', () => {
  const email = Cypress.env('BUYER_EMAIL') || 'buyer@example.com'
  const password = Cypress.env('BUYER_PASSWORD') || 'Buyer123!'
  cy.login(email, password)
})

/**
 * Login as admin
 */
Cypress.Commands.add('loginAsAdmin', () => {
  const email = Cypress.env('ADMIN_EMAIL') || 'admin@example.com'
  const password = Cypress.env('ADMIN_PASSWORD') || 'Admin123!'
  cy.login(email, password)
})

/**
 * Login as driver
 */
Cypress.Commands.add('loginAsDriver', () => {
  const email = Cypress.env('DRIVER_EMAIL') || 'driver@example.com'
  const password = Cypress.env('DRIVER_PASSWORD') || 'Driver123!'
  cy.login(email, password)
})

/**
 * Logout
 */
Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click()
  cy.contains(/sign out|logout/i).click()
  cy.url().should('include', '/login')
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
