// ***********************************************************
// Cypress E2E Support File
// ***********************************************************

// Import commands
import './commands'
import 'cypress-axe'
import './a11y-helpers'

// Global axe configuration for Cypress
Cypress.Commands.add('checkPageA11y', (context = null, options = {}) => {
  cy.injectAxe()
  cy.checkA11y(context, {
    includedImpacts: ['critical', 'serious'],
    rules: {
      'color-contrast': { enabled: true },
    },
    ...options,
  }, (violations) => {
    violations.forEach((violation) => {
      const nodes = violation.nodes.map((node) => node.target.join(', ')).join('\n')
      Cypress.log({
        name: `a11y violation [${violation.impact}]`,
        message: `${violation.id}: ${violation.description}\nNodes: ${nodes}`,
      })
    })
  })
})

// Global beforeEach
// The mobile-white-screen diagnostic spec manages its own visits and viewports.
// Skip the default visit when that spec is running to avoid overwriting listeners.
const IS_DIAGNOSTIC_SPEC = Cypress.spec?.relative?.includes('mobile-white-screen')
const IS_CHECKOUT_SPEC = Cypress.spec?.relative?.includes('checkout-to-payment')

beforeEach(() => {
  if (IS_DIAGNOSTIC_SPEC || IS_CHECKOUT_SPEC) return  // these specs handle their own setup

  // Set viewport to desktop by default
  cy.viewport(1280, 720)

  // Visit base URL
  cy.visit('/')
})

// Global afterEach
afterEach(() => {
  // Clear local storage between tests
  cy.clearLocalStorage()

  // Clear cookies
  cy.clearCookies()
})

// Handle uncaught exceptions
Cypress.on('uncaught:exception', (err, runnable) => {
  // Ignore specific errors
  if (err.message.includes('ResizeObserver')) {
    return false
  }
  
  // Return true to fail the test
  return true
})
