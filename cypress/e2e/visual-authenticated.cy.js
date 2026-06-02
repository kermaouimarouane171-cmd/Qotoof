/// <reference types="cypress" />

/**
 * Visual Regression — Authenticated Pages
 *
 * NOTE: These tests are temporarily skipped because they require stable test
 * auth users or a dedicated auth mock. They are kept in the repo so they can
 * be re-enabled once auth mocking or seeded test users are available.
 *
 * TODO: Re-enable after one of the following is implemented:
 *   - Supabase staging seeded with test users (buyer/vendor/driver/admin)
 *   - A lightweight auth mock that the app accepts (e.g. supabase.auth.setSession)
 */

const FIXED_NOW = new Date('2026-05-20T10:00:00.000Z').getTime()

const stabilizeUi = () => {
  cy.clock(FIXED_NOW, ['Date'])

  cy.document().then((doc) => {
    const style = doc.createElement('style')
    style.setAttribute('data-testid', 'disable-animations-style')
    style.innerHTML = `
      *, *::before, *::after {
        transition: none !important;
        animation: none !important;
        caret-color: transparent !important;
      }
      html { scroll-behavior: auto !important; }
    `
    doc.head.appendChild(style)
  })
}

describe.skip('Visual Regression - Authenticated Pages', () => {
  beforeEach(() => {
    cy.viewport(1366, 900)
    stabilizeUi()
  })

  it('captures Buyer dashboard baseline', () => {
    cy.loginAsBuyer()
    cy.visit('/buyer/dashboard')
    cy.wait(300)
    cy.matchImageSnapshot('buyer-dashboard')
  })

  it('captures Vendor dashboard baseline', () => {
    cy.loginAsVendor()
    cy.visit('/vendor/dashboard')
    cy.wait(300)
    cy.matchImageSnapshot('vendor-dashboard')
  })

  it('captures Driver dashboard baseline', () => {
    cy.loginAsDriver()
    cy.visit('/driver/dashboard')
    cy.wait(300)
    cy.matchImageSnapshot('driver-dashboard')
  })

  it('captures Admin dashboard baseline', () => {
    cy.loginAsAdmin()
    cy.visit('/admin/dashboard')
    cy.wait(300)
    cy.matchImageSnapshot('admin-dashboard')
  })
})

describe.skip('Visual Regression - Cart States', () => {
  beforeEach(() => {
    cy.viewport(1366, 900)
    stabilizeUi()
  })

  it('captures empty cart state', () => {
    cy.loginAsBuyer()
    cy.visit('/cart')
    cy.wait(300)
    cy.matchImageSnapshot('cart-empty-state')
  })

  it('captures cart with item state', () => {
    cy.loginAsBuyer()
    cy.visit('/')
    cy.addToCart('product-1')
    cy.visit('/cart')
    cy.wait(300)
    cy.matchImageSnapshot('cart-with-items')
  })
})
