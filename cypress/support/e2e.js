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
beforeEach(() => {
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
