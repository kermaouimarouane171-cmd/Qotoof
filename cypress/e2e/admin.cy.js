/**
 * E2E Tests - Admin Flow
 * Tests admin dashboard, user management, product moderation, orders, payouts, and settings
 */

describe('Admin Flow', () => {
  beforeEach(() => {
    cy.loginAsAdmin()
    cy.visit('/admin/dashboard')
  })

  describe('Admin Dashboard', () => {
    it('should display admin dashboard with platform overview', () => {
      cy.get('[data-testid="page-loaded"]').should('exist')
      cy.contains(/admin dashboard|platform overview/i).should('be.visible')
      cy.get('[data-testid="stats-cards"]').should('have.length.greaterThan', 0)
    })

    it('should show platform metrics: users, vendors, orders, revenue', () => {
      cy.get('[data-testid="total-users"]').should('be.visible')
      cy.get('[data-testid="total-vendors"]').should('be.visible')
      cy.get('[data-testid="total-orders"]').should('be.visible')
      cy.get('[data-testid="total-revenue"]').should('be.visible')
    })

    it('should display recent activity feed', () => {
      cy.contains(/recent activity|activity log/i).should('be.visible')
      cy.get('[data-testid="activity-item"]').should('have.length.greaterThan', 0)
    })
  })

  describe('User Management', () => {
    it('should view all users list', () => {
      cy.visit('/admin/users')
      cy.contains(/users|user management/i).should('be.visible')
      cy.get('[data-testid="user-table"]').should('be.visible')
      cy.get('[data-testid="user-row"]').should('have.length.greaterThan', 0)
    })

    it('should search and filter users by role', () => {
      cy.visit('/admin/users')
      cy.get('[data-testid="user-search-input"]').type('buyer')
      cy.get('[data-testid="role-filter"]').select('buyer')
      cy.get('[data-testid="user-row"]').should('have.length.greaterThan', 0)
    })

    it('should suspend or activate a user account', () => {
      cy.visit('/admin/users')
      cy.get('[data-testid="user-row"]').first().within(() => {
        cy.get('[data-testid="user-actions-btn"]').click()
        cy.get('[data-testid="suspend-user-btn"]').click()
      })
      cy.get('[data-testid="suspend-confirm-input"]').type('suspend')
      cy.get('[data-testid="confirm-suspend-btn"]').click()
      cy.contains(/user suspended|account suspended/i).should('be.visible')
    })

    it('should view user details and order history', () => {
      cy.visit('/admin/users')
      cy.get('[data-testid="user-row"]').first().click()
      cy.get('[data-testid="user-details-panel"]').should('be.visible')
      cy.contains(/order history|user orders/i).should('be.visible')
    })
  })

  describe('Product Moderation', () => {
    it('should view products pending approval', () => {
      cy.visit('/admin/products')
      cy.contains(/products|product moderation/i).should('be.visible')
      cy.get('[data-testid="pending-tab"]').click()
      cy.get('[data-testid="product-review-card"]').should('have.length.greaterThan', 0)
    })

    it('should approve a product listing', () => {
      cy.visit('/admin/products')
      cy.get('[data-testid="pending-tab"]').click()
      cy.get('[data-testid="product-review-card"]').first().within(() => {
        cy.get('[data-testid="approve-product-btn"]').click()
      })
      cy.contains(/product approved|listing approved/i).should('be.visible')
    })

    it('should reject a product listing with reason', () => {
      cy.visit('/admin/products')
      cy.get('[data-testid="pending-tab"]').click()
      cy.get('[data-testid="product-review-card"]').first().within(() => {
        cy.get('[data-testid="reject-product-btn"]').click()
      })
      cy.get('[data-testid="rejection-reason-input"]').type('Inappropriate product image')
      cy.get('[data-testid="confirm-rejection-btn"]').click()
      cy.contains(/product rejected|listing rejected/i).should('be.visible')
    })
  })

  describe('Order Management', () => {
    it('should view all platform orders', () => {
      cy.visit('/admin/orders')
      cy.contains(/orders|order management/i).should('be.visible')
      cy.get('[data-testid="orders-table"]').should('be.visible')
      cy.get('[data-testid="order-row"]').should('have.length.greaterThan', 0)
    })

    it('should filter orders by status', () => {
      cy.visit('/admin/orders')
      cy.get('[data-testid="status-filter"]').select('pending')
      cy.get('[data-testid="order-row"]').should('have.length.greaterThan', 0)
      cy.get('[data-testid="order-row"]').each(($row) => {
        cy.wrap($row).should('contain', /pending/i)
      })
    })

    it('should manually update order status', () => {
      cy.visit('/admin/orders')
      cy.get('[data-testid="order-row"]').first().within(() => {
        cy.get('[data-testid="order-status-select"]').select('cancelled')
        cy.get('[data-testid="update-status-btn"]').click()
      })
      cy.get('[data-testid="status-update-reason"]').type('Vendor requested cancellation')
      cy.get('[data-testid="confirm-status-update"]').click()
      cy.contains(/status updated|order updated/i).should('be.visible')
    })

    it('should view order details with full timeline', () => {
      cy.visit('/admin/orders')
      cy.get('[data-testid="order-row"]').first().click()
      cy.get('[data-testid="order-detail-view"]').should('be.visible')
      cy.get('[data-testid="order-timeline"]').should('exist')
      cy.get('[data-testid="order-payment-info"]').should('be.visible')
    })
  })

  describe('Payouts & Commissions', () => {
    it('should view pending payouts to vendors', () => {
      cy.visit('/admin/payouts')
      cy.contains(/payouts|vendor payouts/i).should('be.visible')
      cy.get('[data-testid="payout-list"]').should('have.length.greaterThan', 0)
    })

    it('should process a vendor payout', () => {
      cy.visit('/admin/payouts')
      cy.get('[data-testid="payout-list"]').first().within(() => {
        cy.get('[data-testid="process-payout-btn"]').click()
      })
      cy.get('[data-testid="payout-confirm-modal"]').should('be.visible')
      cy.get('[data-testid="confirm-payout-btn"]').click()
      cy.contains(/payout processed|payment sent/i).should('be.visible')
    })

    it('should view commission rates and settings', () => {
      cy.visit('/admin/commissions')
      cy.contains(/commissions|platform fees/i).should('be.visible')
      cy.get('[data-testid="commission-rate-input"]').should('be.visible')
    })
  })

  describe('Driver Management', () => {
    it('should view all registered drivers', () => {
      cy.visit('/admin/drivers')
      cy.contains(/drivers|driver management/i).should('be.visible')
      cy.get('[data-testid="driver-table"]').should('be.visible')
      cy.get('[data-testid="driver-row"]').should('have.length.greaterThan', 0)
    })

    it('should verify a driver account', () => {
      cy.visit('/admin/driver-verification')
      cy.contains(/driver verification|pending drivers/i).should('be.visible')
      cy.get('[data-testid="pending-driver-card"]').first().within(() => {
        cy.get('[data-testid="view-documents-btn"]').click()
      })
      cy.get('[data-testid="driver-documents-modal"]').should('be.visible')
      cy.get('[data-testid="approve-driver-btn"]').click()
      cy.contains(/driver verified|approved/i).should('be.visible')
    })
  })

  describe('Reviews Moderation', () => {
    it('should view reported reviews', () => {
      cy.visit('/admin/reviews')
      cy.contains(/reviews|review moderation/i).should('be.visible')
      cy.get('[data-testid="reported-reviews-list"]').should('have.length.greaterThan', 0)
    })

    it('should remove an inappropriate review', () => {
      cy.visit('/admin/reviews')
      cy.get('[data-testid="review-card"]').first().within(() => {
        cy.get('[data-testid="remove-review-btn"]').click()
      })
      cy.get('[data-testid="removal-reason-input"]').type('Offensive language')
      cy.get('[data-testid="confirm-removal-btn"]').click()
      cy.contains(/review removed|deleted/i).should('be.visible')
    })
  })

  describe('Platform Settings', () => {
    it('should view and update platform settings', () => {
      cy.visit('/admin/settings')
      cy.contains(/platform settings|configuration/i).should('be.visible')
      cy.get('[data-testid="settings-form"]').should('be.visible')
      cy.get('[data-testid="site-name-input"]').should('be.visible')
      cy.get('[data-testid="maintenance-toggle"]').should('exist')
    })

    it('should view audit log of admin actions', () => {
      cy.visit('/admin/settings/audit-log')
      cy.contains(/audit log|activity log/i).should('be.visible')
      cy.get('[data-testid="audit-log-entry"]').should('have.length.greaterThan', 0)
    })

    it('should configure circuit breaker settings', () => {
      cy.visit('/admin/settings/circuit-breakers')
      cy.contains(/circuit breakers|rate limits/i).should('be.visible')
      cy.get('[data-testid="circuit-breaker-config"]').should('exist')
    })
  })

  describe('Analytics', () => {
    it('should view platform analytics dashboard', () => {
      cy.visit('/admin/analytics')
      cy.contains(/analytics|platform analytics/i).should('be.visible')
      cy.get('[data-testid="analytics-chart"]').should('have.length.greaterThan', 0)
    })

    it('should view revenue analytics over time', () => {
      cy.visit('/admin/analytics')
      cy.get('[data-testid="revenue-chart"]').should('be.visible')
      cy.get('[data-testid="date-range-picker"]').should('exist')
    })
  })
})
