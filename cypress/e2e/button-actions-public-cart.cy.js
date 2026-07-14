/// <reference types="cypress" />

/**
 * Button Actions — Public Visitor + Cart (No Auth, No Backend)
 * Tests safe buttons that do not trigger payments, deletes, or auth flows.
 */

const defaultPublicConfig = {
  supabase: {
    url: 'https://test-project.supabase.co',
    anonKey: 'test-anon-key',
  },
  paypal: {
    clientId: 'paypal-client-id-placeholder',
    settlementCurrency: 'EUR',
  },
  recaptcha: {
    siteKey: 'recaptcha-site-key-placeholder',
  },
  email: {
    from: 'qotoof273@gmail.com',
  },
  app: {
    name: 'Qotoof',
    version: '1.0.0',
  },
}

const mockProductsResponse = [
  {
    id: 'prod-001',
    name: 'Organic Tomatoes',
    price_per_unit: 40,
    unit_type: 'piece',
    min_order_quantity: 1,
    available_quantity: 200,
    is_available: true,
    vendor_id: 'vendor-001',
    vendor_name: 'Atlas Fresh Farm',
    image_url: 'https://images.example.com/products/tomatoes.jpg',
    category: 'vegetables',
    subcategory: 'tomatoes',
    average_rating: 4.5,
    reviews_count: 12,
    vendor: {
      id: 'vendor-001',
      first_name: 'Sofian',
      last_name: 'Benjelloun',
      store_name: 'Atlas Fresh Farm',
      city: 'Casablanca',
      is_verified: true,
    },
    product_images: [
      { url: 'https://images.example.com/products/tomatoes.jpg', is_primary: true },
    ],
  },
  {
    id: 'prod-002',
    name: 'Premium Olive Oil',
    price_per_unit: 95,
    unit_type: 'piece',
    min_order_quantity: 1,
    available_quantity: 80,
    is_available: true,
    vendor_id: 'vendor-001',
    vendor_name: 'Atlas Fresh Farm',
    image_url: 'https://images.example.com/products/olive-oil.jpg',
    category: 'oils',
    subcategory: 'olive-oil',
    average_rating: 4.8,
    reviews_count: 8,
    vendor: {
      id: 'vendor-001',
      first_name: 'Sofian',
      last_name: 'Benjelloun',
      store_name: 'Atlas Fresh Farm',
      city: 'Casablanca',
      is_verified: true,
    },
    product_images: [
      { url: 'https://images.example.com/products/olive-oil.jpg', is_primary: true },
    ],
  },
]

const setupIntercepts = () => {
  cy.intercept('GET', '**/functions/v1/get-public-config', {
    statusCode: 200,
    body: defaultPublicConfig,
  }).as('getPublicConfig')

  // Catch-all first (Cypress uses last-match-wins; specific intercepts below override this)
  cy.intercept('GET', '**/rest/v1/**', { statusCode: 200, body: [] }).as('fallbackGet')
  cy.intercept('POST', '**/rest/v1/**', { statusCode: 200, body: {} }).as('fallbackPost')

  // Specific intercepts defined AFTER catch-all so they take precedence
  cy.intercept('GET', '**/rest/v1/products*', {
    statusCode: 200,
    body: mockProductsResponse,
    headers: { 'content-range': `0-${mockProductsResponse.length - 1}/${mockProductsResponse.length}` },
  }).as('products')

  cy.intercept('GET', '**/rest/v1/profiles*', {
    statusCode: 200,
    body: [
      {
        id: 'vendor-001',
        first_name: 'Sofian',
        last_name: 'Benjelloun',
        store_name: 'Atlas Fresh Farm',
        store_description: 'Fresh organic produce from the Atlas region',
        city: 'Casablanca',
        email: 'sofian@atlasfresh.ma',
      },
    ],
  }).as('profiles')
}

const clearCartStorage = () => {
  cy.window().then((win) => {
    win.localStorage.removeItem('cart-storage')
    win.localStorage.removeItem('qotoof_cart')
  })
}

const assertNoWhiteScreen = () => {
  cy.get('body').should('not.be.empty')
  cy.get('body').should('not.contain.text', 'An unexpected error occurred')
  cy.get('body').should('not.contain.text', 'حدث خطأ غير متوقع')
}

describe('Button Actions — Public + Cart', () => {
  beforeEach(() => {
    cy.viewport(1280, 720)
    setupIntercepts()
    clearCartStorage()
  })

  // ───────────────────────────────────────────────
  // PUBLIC — Marketplace
  // ───────────────────────────────────────────────

  it('visits Marketplace without white screen', () => {
    cy.visit('/marketplace')
    cy.wait('@products')
    assertNoWhiteScreen()
    cy.get('[data-testid="product-card"]').should('exist')
  })

  it('clicks a product card and navigates to product page', () => {
    cy.visit('/marketplace')
    cy.wait('@products')
    cy.get('[data-testid="product-card"]').first().click()
    cy.url().should('include', '/product/')
    assertNoWhiteScreen()
  })

  it('adds a product to cart via quick-add button', () => {
    cy.visit('/marketplace')
    cy.wait('@products')
    cy.get('[data-testid="add-to-cart-btn"]').first().click()
    // Cart badge or toast should appear (or simply no crash)
    assertNoWhiteScreen()
  })

  // ───────────────────────────────────────────────
  // CART — Empty State
  // ───────────────────────────────────────────────

  it('visits empty cart without white screen', () => {
    cy.visit('/cart')
    assertNoWhiteScreen()
    cy.get('[data-testid="cart-empty-state"]').should('exist')
  })

  it('navigates from empty cart to marketplace', () => {
    cy.visit('/cart')
    cy.get('[data-testid="cart-empty-state"]').should('exist')
    cy.get('[data-testid="cart-empty-state"] a[href="/marketplace"]').click()
    cy.url().should('include', '/marketplace')
    assertNoWhiteScreen()
  })

  // ───────────────────────────────────────────────
  // CART — With Items (via add-to-cart flow)
  // ───────────────────────────────────────────────

  it('increments item quantity in cart', () => {
    cy.visit('/marketplace')
    cy.wait('@products')
    cy.get('[data-testid="add-to-cart-btn"]').first().click()
    cy.visit('/cart')
    cy.get('[data-testid="cart-page"]').should('exist')
    cy.get('[data-testid="cart-item-quantity-input"]').should('have.value', '1')

    cy.get('[data-testid="cart-item-increment"]').first().click()
    cy.get('[data-testid="cart-item-quantity-input"]').should('have.value', '2')
    assertNoWhiteScreen()
  })

  it('decrements item quantity in cart', () => {
    cy.visit('/marketplace')
    cy.wait('@products')
    cy.get('[data-testid="add-to-cart-btn"]').first().click()
    cy.visit('/cart')
    cy.get('[data-testid="cart-item-quantity-input"]').should('have.value', '1')

    // Increment first to have something to decrement
    cy.get('[data-testid="cart-item-increment"]').first().click()
    cy.get('[data-testid="cart-item-quantity-input"]').should('have.value', '2')

    cy.get('[data-testid="cart-item-decrement"]').first().click()
    cy.get('[data-testid="cart-item-quantity-input"]').should('have.value', '1')
    assertNoWhiteScreen()
  })

  it('opens remove confirmation dialog and removes item', () => {
    cy.visit('/marketplace')
    cy.wait('@products')
    cy.get('[data-testid="add-to-cart-btn"]').first().click()
    cy.visit('/cart')
    cy.get('[data-testid="cart-item"]').should('exist')

    cy.get('[data-testid="cart-item-remove"]').first().click()
    cy.get('[data-testid="cart-remove-dialog"]').should('be.visible')

    cy.get('[data-testid="cart-remove-confirm"]').click()
    cy.get('[data-testid="cart-empty-state"]').should('exist')
    assertNoWhiteScreen()
  })

  it('shows enabled checkout button with items in cart', () => {
    cy.visit('/marketplace')
    cy.wait('@products')
    cy.get('[data-testid="add-to-cart-btn"]').first().click()
    cy.visit('/cart')
    cy.get('[data-testid="cart-page"]').should('exist')

    // Button should be visible and not disabled
    cy.get('[data-testid="cart-checkout-btn"]').first()
      .should('be.visible')
      .and('not.be.disabled')
    assertNoWhiteScreen()
  })
})
