/**
 * E2E Tests - Buyer Flow
 * Tests browsing, cart, checkout, orders, and buyer dashboard
 */

describe('Buyer Flow', () => {
  beforeEach(() => {
    cy.loginAsBuyer()
    cy.visit('/buyer/dashboard')
  })

  describe('Buyer Dashboard', () => {
    it('should display buyer dashboard overview', () => {
      cy.get('[data-testid="page-loaded"]').should('exist')
      cy.contains(/dashboard|overview|welcome/i).should('be.visible')
      cy.get('[data-testid="stats-cards"]').should('have.length.greaterThan', 0)
    })

    it('should show recent orders section', () => {
      cy.contains(/recent orders|my orders/i).should('be.visible')
      cy.get('[data-testid="order-card"]').should('have.length.greaterThan', 0)
    })

    it('should display saved addresses', () => {
      cy.visit('/buyer/addresses')
      cy.contains(/my addresses|saved addresses/i).should('be.visible')
      cy.get('[data-testid="address-card"]').should('have.length.greaterThan', 0)
    })

    it('should navigate to buyer settings', () => {
      cy.visit('/buyer/settings')
      cy.contains(/settings|preferences/i).should('be.visible')
      cy.get('[data-testid="settings-form"]').should('be.visible')
    })
  })

  describe('Shopping & Cart', () => {
    it('should browse marketplace and filter by category', () => {
      cy.visit('/marketplace')
      cy.get('[data-testid="product-card"]').should('have.length.greaterThan', 0)

      // Filter by category
      cy.get('[data-testid="category-filter"]').should('exist')
      cy.get('[data-testid="category-filter"]').first().click()
      cy.url().should('match', /category=/)
    })

    it('should search for products and see results', () => {
      cy.visit('/marketplace')
      cy.get('[data-testid="search-input"]').type('tomato{enter}')
      cy.url().should('include', 'search=tomato')
      cy.get('[data-testid="product-card"]').should('have.length.greaterThan', 0)
    })

    it('should add product to cart and verify cart count', () => {
      cy.visit('/marketplace')
      cy.get('[data-testid="product-card"]').first().within(() => {
        cy.get('[data-testid="add-to-cart-btn"]').click()
      })
      cy.get('[data-testid="cart-count"]').should('contain', '1')
      cy.contains(/added to cart|item added/i).should('be.visible')
    })

    it('should update cart quantity and recalculate total', () => {
      // Add item first
      cy.visit('/marketplace')
      cy.get('[data-testid="product-card"]').first().within(() => {
        cy.get('[data-testid="add-to-cart-btn"]').click()
      })

      cy.visit('/cart')
      cy.get('[data-testid="cart-item"]').should('have.length.greaterThan', 0)
      cy.get('[data-testid="quantity-input"]').first().clear().type('3')
      cy.get('[data-testid="cart-total"]').should('be.visible')
    })

    it('should remove item from cart', () => {
      cy.visit('/marketplace')
      cy.get('[data-testid="product-card"]').first().within(() => {
        cy.get('[data-testid="add-to-cart-btn"]').click()
      })

      cy.visit('/cart')
      cy.get('[data-testid="cart-item"]').first().within(() => {
        cy.get('[data-testid="remove-item-btn"]').click()
      })
      cy.contains(/cart is empty|no items/i).should('be.visible')
    })
  })

  describe('Checkout & Orders', () => {
    it('should complete checkout with valid address', () => {
      // Add item to cart
      cy.visit('/marketplace')
      cy.get('[data-testid="product-card"]').first().within(() => {
        cy.get('[data-testid="add-to-cart-btn"]').click()
      })

      cy.visit('/checkout')
      cy.get('[data-testid="checkout-form"]').should('be.visible')

      // Fill delivery details
      cy.get('[data-testid="address-select"]').should('exist')
      cy.get('[data-testid="address-select"]').first().click()

      // Select payment method
      cy.get('[data-testid="payment-method"]').first().click()

      // Place order
      cy.get('[data-testid="place-order-btn"]').click()
      cy.url().should('include', '/confirmation')
      cy.contains(/order placed|order confirmed|thank you/i).should('be.visible')
    })

    it('should view order details after checkout', () => {
      cy.visit('/buyer/orders')
      cy.get('[data-testid="order-card"]').first().click()
      cy.get('[data-testid="order-details"]').should('be.visible')
      cy.get('[data-testid="order-status"]').should('be.visible')
    })

    it('should track order delivery status', () => {
      cy.visit('/buyer/orders')
      cy.get('[data-testid="order-card"]').first().within(() => {
        cy.get('[data-testid="track-order-btn"]').click()
      })
      cy.get('[data-testid="order-tracking"]').should('be.visible')
      cy.get('[data-testid="tracking-timeline"]').should('exist')
    })

    it('should request a return for an order', () => {
      cy.visit('/buyer/orders')
      cy.get('[data-testid="order-card"]').first().within(() => {
        cy.get('[data-testid="return-order-btn"]').click()
      })
      cy.get('[data-testid="return-form"]').should('be.visible')
      cy.get('[data-testid="return-reason"]').select('damaged')
      cy.get('[data-testid="return-description"]').type('Product arrived damaged')
      cy.get('[data-testid="submit-return-btn"]').click()
      cy.contains(/return requested|return submitted/i).should('be.visible')
    })
  })

  describe('Buyer Features', () => {
    it('should view and apply coupons', () => {
      cy.visit('/buyer/coupons')
      cy.contains(/my coupons|available coupons/i).should('be.visible')
      cy.get('[data-testid="coupon-card"]').should('have.length.greaterThan', 0)
    })

    it('should access loyalty points page', () => {
      cy.visit('/buyer/loyalty')
      cy.contains(/loyalty|points|rewards/i).should('be.visible')
      cy.get('[data-testid="points-balance"]').should('be.visible')
    })

    it('should view buyer reports and spending summary', () => {
      cy.visit('/buyer/reports')
      cy.contains(/reports|spending|summary/i).should('be.visible')
      cy.get('[data-testid="spending-chart"]').should('exist')
    })

    it('should manage shopping lists', () => {
      cy.visit('/buyer/shopping-lists')
      cy.contains(/shopping lists|my lists/i).should('be.visible')
      cy.get('[data-testid="create-list-btn"]').click()
      cy.get('[data-testid="list-name-input"]').type('Weekly Groceries')
      cy.get('[data-testid="save-list-btn"]').click()
      cy.contains(/list created|success/i).should('be.visible')
    })
  })
})
