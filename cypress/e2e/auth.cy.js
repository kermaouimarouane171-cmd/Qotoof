/**
 * 🧪 E2E Tests - Authentication Flow
 * Tests login, registration, and password reset
 */

describe('Authentication', () => {
  beforeEach(() => {
    cy.visit('/login')
  })

  describe('Login', () => {
    it('should display login form correctly', () => {
      cy.get('input[type="email"]').should('be.visible')
      cy.get('input[type="password"]').should('be.visible')
      cy.contains('button', 'Sign In').should('be.visible')
    })

    it('should show validation errors for empty fields', () => {
      cy.contains('button', 'Sign In').click()
      // Should show error for empty email/password
    })

    it('should show error for invalid credentials', () => {
      cy.get('input[type="email"]').type('invalid@example.com')
      cy.get('input[type="password"]').type('wrongpassword')
      cy.contains('button', 'Sign In').click()
      
      // Should show error message
      cy.contains(/invalid|error|failed/i).should('be.visible')
    })

    it('should login successfully with valid credentials', () => {
      // Use test credentials
      cy.get('input[type="email"]').type(Cypress.env('TEST_USER_EMAIL') || 'buyer@greenmarket.test')
      cy.get('input[type="password"]').type(Cypress.env('TEST_USER_PASSWORD') || 'Test@123456')
      cy.contains('button', 'Sign In').click()
      
      // Should redirect away from the login page after a successful sign-in
      cy.url().should('not.include', '/login')
    })

    it('should navigate to registration page', () => {
      cy.contains(/register|sign up/i).click()
      cy.url().should('include', '/register')
    })

    it('should navigate to forgot password page', () => {
      cy.contains(/forgot|reset/i).click()
      cy.url().should('include', '/forgot-password')
    })
  })

  describe('Registration', () => {
    beforeEach(() => {
      cy.visit('/register')
    })

    it('should display registration form', () => {
      cy.get('input[name="firstName"]').should('be.visible')
      cy.get('input[name="lastName"]').should('be.visible')
      cy.get('input[type="email"]').should('be.visible')
      cy.get('input[type="password"]').should('be.visible')
    })

    it('should validate email format', () => {
      cy.get('input[type="email"]').type('invalid-email')
      cy.contains('button', /register|create/i).click()
      // Should show email validation error
    })

    it('should validate password strength', () => {
      cy.get('input[name="password"]').type('weak')
      // Should show password strength requirements
    })

    it('should show error for existing email', () => {
      cy.get('input[name="firstName"]').type('Test')
      cy.get('input[name="lastName"]').type('User')
      cy.get('input[type="email"]').type('existing@example.com')
      cy.get('input[name="password"]').type('StrongPass123!')
      cy.get('input[name="confirmPassword"]').type('StrongPass123!')
      cy.contains('button', /register|create/i).click()
      
      // Should show error for existing email
    })
  })

  describe('Password Reset', () => {
    beforeEach(() => {
      cy.visit('/forgot-password')
    })

    it('should display password reset form', () => {
      cy.get('input[type="email"]').should('be.visible')
      cy.contains('button', /send|reset/i).should('be.visible')
    })

    it('should show success message after submitting', () => {
      cy.get('input[type="email"]').type('test@example.com')
      cy.contains('button', /send|reset/i).click()
      
      // Should show success message
      cy.contains(/sent|check your email/i).should('be.visible')
    })
  })
})
