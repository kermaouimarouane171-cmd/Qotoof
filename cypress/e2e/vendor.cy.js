/**
 * 🧪 E2E Tests - Vendor Dashboard
 * Tests vendor product and order management
 */

describe('Vendor Dashboard', () => {
  beforeEach(() => {
    // Login as vendor
    cy.loginAsVendor()
    cy.visit('/vendor/dashboard')
  })

  describe('Dashboard Overview', () => {
    it('should display vendor dashboard', () => {
      cy.contains(/dashboard|overview/i).should('be.visible')
      cy.get('[data-testid="stats-cards"]').should('have.length.greaterThan', 0)
    })

    it('should show sales statistics', () => {
      cy.contains(/revenue|sales|orders/i).should('be.visible')
    })
  })

  describe('Product Management', () => {
    beforeEach(() => {
      cy.visit('/vendor/products')
    })

    it('should display product list', () => {
      cy.contains(/my products|product list/i).should('be.visible')
    })

    it('should create new product', () => {
      cy.contains(/add product|new product/i).click()
      
      // Fill product form
      cy.get('input[name="name"]').type('Test Product')
      cy.get('select[name="category"]').select('vegetables')
      cy.get('input[name="price_per_unit"]').type('10')
      cy.get('input[name="available_quantity"]').type('100')
      cy.get('textarea[name="description"]').type('Test description')
      
      // Submit
      cy.contains(/save|create/i).click()
      
      // Should show success
      cy.contains(/product created|success/i).should('be.visible')
    })

    it('should edit product', () => {
      cy.get('[data-testid="product-card"]').first().contains(/edit/i).click()
      
      // Update price
      cy.get('input[name="price_per_unit"]').clear().type('15')
      cy.contains(/save|update/i).click()
      
      // Should show success
      cy.contains(/updated|success/i).should('be.visible')
    })

    it('should delete product', () => {
      cy.get('[data-testid="product-card"]').first().contains(/delete/i).click()
      
      // Confirm deletion
      cy.contains(/confirm|yes/i).click()
      
      // Should show success
      cy.contains(/deleted|success/i).should('be.visible')
    })
  })

  describe('Order Management', () => {
    beforeEach(() => {
      cy.visit('/vendor/orders')
    })

    it('should display orders list', () => {
      cy.contains(/orders|order list/i).should('be.visible')
    })

    it('should accept order', () => {
      cy.contains(/pending/i).first().parents('[data-testid="order-card"]').within(() => {
        cy.contains(/accept/i).click()
      })
      
      // Should show success
      cy.contains(/accepted|success/i).should('be.visible')
    })

    it('should reject order', () => {
      cy.contains(/pending/i).first().parents('[data-testid="order-card"]').within(() => {
        cy.contains(/reject/i).click()
      })
      
      // Confirm rejection
      cy.get('textarea').type('Out of stock')
      cy.contains(/confirm|yes/i).click()
      
      // Should show success
      cy.contains(/rejected|success/i).should('be.visible')
    })

    it('should assign driver to order', () => {
      cy.contains(/accepted/i).first().parents('[data-testid="order-card"]').within(() => {
        cy.contains(/assign driver/i).click()
      })
      
      // Select driver
      cy.get('[data-testid="driver-option"]').first().click()
      cy.contains(/confirm|assign/i).click()
      
      // Should show success
      cy.contains(/driver assigned|success/i).should('be.visible')
    })
  })

  describe('Vendor Analytics', () => {
    beforeEach(() => {
      cy.visit('/vendor/analytics')
    })

    it('should display analytics dashboard', () => {
      cy.contains(/analytics|statistics/i).should('be.visible')
      cy.get('[data-testid="chart"]').should('have.length.greaterThan', 0)
    })

    it('should show revenue chart', () => {
      cy.contains(/revenue|sales/i).should('be.visible')
    })

    it('should show orders chart', () => {
      cy.contains(/orders/i).should('be.visible')
    })
  })
})
