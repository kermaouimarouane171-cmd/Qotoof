/// <reference types="cypress" />

/**
 * Visual Regression — Public Pages
 * Deterministic baseline snapshots for pages that do not require authentication.
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
}

describe('Visual Regression - Public Pages', () => {
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
})
