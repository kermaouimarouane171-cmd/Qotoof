/**
 * E2E Tests - Driver Flow
 * Tests delivery acceptance, pickup, completion, earnings, and driver profile
 */

describe('Driver Flow', () => {
  beforeEach(() => {
    cy.loginAsDriver()
    cy.visit('/driver/dashboard')
  })

  describe('Driver Dashboard', () => {
    it('should display driver dashboard with delivery overview', () => {
      cy.get('[data-testid="page-loaded"]').should('exist')
      cy.contains(/dashboard|deliveries|welcome/i).should('be.visible')
      cy.get('[data-testid="stats-cards"]').should('have.length.greaterThan', 0)
    })

    it('should show today delivery count and earnings summary', () => {
      cy.get('[data-testid="today-deliveries"]').should('be.visible')
      cy.get('[data-testid="today-earnings"]').should('be.visible')
    })

    it('should display online/offline toggle', () => {
      cy.get('[data-testid="driver-status-toggle"]').should('be.visible')
      cy.get('[data-testid="driver-status-toggle"]').click()
      cy.get('[data-testid="driver-status"]').should('contain', /online|offline/i)
    })
  })

  describe('Available Deliveries', () => {
    it('should view available delivery requests', () => {
      cy.visit('/driver/available')
      cy.contains(/available deliveries|requests/i).should('be.visible')
      cy.get('[data-testid="delivery-request-card"]').should('have.length.greaterThan', 0)
    })

    it('should accept a delivery request', () => {
      cy.visit('/driver/available')
      cy.get('[data-testid="delivery-request-card"]').first().within(() => {
        cy.get('[data-testid="accept-delivery-btn"]').click()
      })
      cy.contains(/accepted|delivery assigned/i).should('be.visible')
      cy.url().should('match', /\/driver\/delivery\/|\/driver\/pickup/)
    })

    it('should reject a delivery request', () => {
      cy.visit('/driver/available')
      cy.get('[data-testid="delivery-request-card"]').first().within(() => {
        cy.get('[data-testid="reject-delivery-btn"]').click()
      })
      cy.get('[data-testid="reject-reason-input"]').type('Too far from current location')
      cy.get('[data-testid="confirm-reject-btn"]').click()
      cy.contains(/rejected|declined/i).should('be.visible')
    })

    it('should filter available deliveries by distance', () => {
      cy.visit('/driver/available')
      cy.get('[data-testid="distance-filter"]').should('exist')
      cy.get('[data-testid="distance-filter"]').first().click()
      cy.get('[data-testid="delivery-request-card"]').should('have.length.greaterThan', 0)
    })
  })

  describe('Delivery Pickup', () => {
    it('should navigate to pickup location', () => {
      cy.visit('/driver/pickup')
      cy.contains(/pickup|vendor location/i).should('be.visible')
      cy.get('[data-testid="pickup-address"]').should('be.visible')
      cy.get('[data-testid="pickup-map"]').should('exist')
    })

    it('should confirm package pickup from vendor', () => {
      cy.visit('/driver/pickup')
      cy.get('[data-testid="confirm-pickup-btn"]').click()
      cy.get('[data-testid="pickup-photo-option"]').should('be.visible')
      cy.get('[data-testid="pickup-notes-input"]').type('Package collected, good condition')
      cy.get('[data-testid="complete-pickup-btn"]').click()
      cy.contains(/pickup confirmed|en route/i).should('be.visible')
    })
  })

  describe('Delivery Completion', () => {
    it('should navigate to delivery drop-off location', () => {
      cy.visit('/driver/delivery')
      cy.contains(/delivery|drop.?off|destination/i).should('be.visible')
      cy.get('[data-testid="delivery-address"]').should('be.visible')
      cy.get('[data-testid="delivery-map"]').should('exist')
    })

    it('should complete delivery with proof of delivery', () => {
      cy.visit('/driver/delivery')
      cy.get('[data-testid="complete-delivery-btn"]').click()
      cy.get('[data-testid="delivery-photo-upload"]').should('be.visible')
      cy.get('[data-testid="recipient-name-input"]').type('Ahmed Benali')
      cy.get('[data-testid="delivery-notes-input"]').type('Delivered to front door')
      cy.get('[data-testid="confirm-delivery-btn"]').click()
      cy.contains(/delivery completed|delivered successfully/i).should('be.visible')
    })

    it('should report a delivery issue', () => {
      cy.visit('/driver/delivery')
      cy.get('[data-testid="report-issue-btn"]').click()
      cy.get('[data-testid="issue-type-select"]').should('be.visible')
      cy.get('[data-testid="issue-type-select"]').select('customer_not_available')
      cy.get('[data-testid="issue-description-input"]').type('Customer not answering phone')
      cy.get('[data-testid="submit-issue-btn"]').click()
      cy.contains(/issue reported|support notified/i).should('be.visible')
    })
  })

  describe('Driver Earnings & Profile', () => {
    it('should view earnings history', () => {
      cy.visit('/driver/earnings')
      cy.contains(/earnings|income|payouts/i).should('be.visible')
      cy.get('[data-testid="earnings-chart"]').should('exist')
      cy.get('[data-testid="earnings-list"]').should('have.length.greaterThan', 0)
    })

    it('should view weekly and monthly earnings breakdown', () => {
      cy.visit('/driver/earnings')
      cy.get('[data-testid="earnings-period-select"]').should('exist')
      cy.get('[data-testid="earnings-period-select"]').select('weekly')
      cy.get('[data-testid="weekly-total"]').should('be.visible')
      cy.get('[data-testid="earnings-period-select"]').select('monthly')
      cy.get('[data-testid="monthly-total"]').should('be.visible')
    })

    it('should update driver profile information', () => {
      cy.visit('/driver/profile')
      cy.contains(/my profile|driver profile/i).should('be.visible')
      cy.get('[data-testid="profile-form"]').should('be.visible')
      cy.get('[data-testid="phone-input"]').clear().type('+212612345678')
      cy.get('[data-testid="save-profile-btn"]').click()
      cy.contains(/profile updated|saved/i).should('be.visible')
    })

    it('should view driver security settings', () => {
      cy.visit('/driver/security')
      cy.contains(/security|safety/i).should('be.visible')
      cy.get('[data-testid="security-checklist"]').should('exist')
    })

    it('should view delivery pricing and rate card', () => {
      cy.visit('/driver/pricing')
      cy.contains(/pricing|rates|per delivery/i).should('be.visible')
      cy.get('[data-testid="rate-card"]').should('have.length.greaterThan', 0)
    })
  })
})
