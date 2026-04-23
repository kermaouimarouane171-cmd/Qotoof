// ***********************************************************
// Cypress E2E Support File
// ***********************************************************

// Import commands
import './commands'

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
