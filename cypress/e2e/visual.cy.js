/// <reference types="cypress" />

/**
 * Visual Regression Suite
 *
 * Setup:
 * 1) Install dependency: npm i -D cypress-image-snapshot --legacy-peer-deps
 * 2) Ensure command is registered in cypress/support/commands.js via addMatchImageSnapshotCommand().
 * 3) Ensure plugin is registered in cypress.config.js via addMatchImageSnapshotPlugin().
 * 4) Run with a stable viewport and base URL to avoid noisy diffs.
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

  cy.intercept('GET', '**/rest/v1/products*', { fixture: 'products.json' }).as('products')
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
  cy.intercept('POST', '**/auth/v1/token*').as('secureLogin')
}

describe('Visual Regression - Core Pages', () => {
  beforeEach(() => {
    cy.viewport(1366, 900)
    stabilizeUi()
  })

  it('captures Home page baseline', () => {
    cy.visit('/')
    cy.wait(300)
    cy.matchImageSnapshot('home-page')
  })

  it('captures Marketplace page baseline', () => {
    cy.visit('/marketplace')
    cy.wait('@products')
    cy.wait(300)
    cy.matchImageSnapshot('marketplace-page')
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

describe('Visual Regression - Key Components/States', () => {
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
