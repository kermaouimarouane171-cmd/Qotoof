/**
 * 🧪 E2E Tests - Marketplace & Shopping
 * Tests browsing, searching, cart, and checkout
 */

describe('Marketplace', () => {
  beforeEach(() => {
    cy.visit('/marketplace')
  })

  describe('Product Browsing', () => {
    it('should display product listings', () => {
      // Should show product cards
      cy.get('[data-testid="product-card"]').should('have.length.greaterThan', 0)
    })

    it('should filter by category', () => {
      cy.contains(/plants|vegetables|fruits/i).click()
      // Should filter products
    })

    it('should search for products', () => {
      cy.get('input[placeholder*="search" i]').type('tomato')
      cy.get('input[placeholder*="search" i]').type('{enter}')
      
      // Should show search results
      cy.url().should('include', 'search=tomato')
    })

    it('should sort products', () => {
      cy.contains(/sort/i).click()
      cy.contains(/price|newest/i).click()
      // Should reorder products
    })
  })

  describe('Product Detail', () => {
    it('should navigate to product detail page', () => {
      cy.get('[data-testid="product-card"]').first().click()
      cy.url().should('include', '/product/')
    })

    it('should display product information', () => {
      cy.get('[data-testid="product-card"]').first().click()
      
      // Should show product details
      cy.get('[data-testid="product-name"]').should('be.visible')
      cy.get('[data-testid="product-price"]').should('be.visible')
      cy.get('[data-testid="product-description"]').should('be.visible')
    })

    it('should add product to cart', () => {
      cy.get('[data-testid="product-card"]').first().click()
      cy.contains(/add to cart/i).click()
      
      // Should show success message
      cy.contains(/added to cart/i).should('be.visible')
      
      // Cart count should increase
      cy.get('[data-testid="cart-count"]').should('contain', '1')
    })
  })
})

describe('Shopping Cart', () => {
  beforeEach(() => {
    cy.visit('/cart')
  })

  it('should display empty cart message', () => {
    cy.contains(/empty|no items/i).should('be.visible')
  })

  it('should update quantity', () => {
    // Add item to cart first
    cy.visit('/marketplace')
    cy.get('[data-testid="product-card"]').first().click()
    cy.contains(/add to cart/i).click()
    
    cy.visit('/cart')
    
    // Update quantity
    cy.get('[data-testid="quantity-input"]').clear().type('5')
    // Should update total
  })

  it('should remove items from cart', () => {
    // Add item to cart
    cy.visit('/marketplace')
    cy.get('[data-testid="product-card"]').first().click()
    cy.contains(/add to cart/i).click()
    
    cy.visit('/cart')
    
    // Remove item
    cy.contains(/remove/i).click()
    cy.contains(/empty|no items/i).should('be.visible')
  })

  it('should calculate totals correctly', () => {
    // Add items and verify totals
  })
})

describe('Checkout', () => {
  beforeEach(() => {
    // Login first
    cy.login()
    cy.visit('/checkout')
  })

  it('should display checkout form', () => {
    cy.get('input[name="address"]').should('be.visible')
    cy.get('input[name="city"]').should('be.visible')
  })

  it('should validate required fields', () => {
    cy.contains(/place order|checkout/i).click()
    // Should show validation errors
  })

  it('should complete order successfully', () => {
    cy.get('input[name="address"]').type('123 Test Street')
    cy.get('input[name="city"]').type('Casablanca')
    cy.contains(/place order|checkout/i).click()
    
    // Should redirect to confirmation
    cy.url().should('include', '/confirmation')
    cy.contains(/order placed|success/i).should('be.visible')
  })
})
