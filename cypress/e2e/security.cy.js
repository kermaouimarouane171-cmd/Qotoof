const APP_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

const setupPublicConfigInterceptors = () => {
  cy.intercept('GET', '**/functions/v1/get-public-config', {
    statusCode: 200,
    body: {
      supabase: { url: 'https://test-project.supabase.co', anonKey: 'test-anon-key' },
      app: { name: 'Qotoof', version: '1.0.0' },
    },
  }).as('getPublicConfig')

  cy.intercept('OPTIONS', '**/auth/v1/**', { statusCode: 200, body: {} })
  cy.intercept('OPTIONS', '**/rest/v1/**', { statusCode: 200, body: {} })
  cy.intercept('OPTIONS', '**/functions/v1/**', { statusCode: 200, body: {} })
}

const setupSecurityInterceptors = () => {
  setupPublicConfigInterceptors()
  cy.intercept('GET', '**/rest/v1/**', { statusCode: 200, body: [] }).as('restRead')
  cy.intercept('POST', '**/rest/v1/**', { statusCode: 201, body: {} }).as('restPost')
  cy.intercept('PATCH', '**/rest/v1/**', { statusCode: 200, body: {} }).as('restPatch')
}

describe('Security pages e2e', () => {
  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
    setupSecurityInterceptors()
  })

  it('protects buyer security route and redirects to login when unauthenticated', () => {
    cy.visit(`${APP_URL}/buyer/security`)
    cy.location('pathname', { timeout: 15000 }).should('eq', '/login')
    cy.contains(/Welcome back|Sign In|تسجيل الدخول/i).should('be.visible')
  })

  it('protects vendor security route and redirects to login when unauthenticated', () => {
    cy.visit(`${APP_URL}/vendor/security`)
    cy.location('pathname', { timeout: 15000 }).should('eq', '/login')
    cy.contains(/Welcome back|Sign In|تسجيل الدخول/i).should('be.visible')
  })

  it('protects driver security route and redirects to login when unauthenticated', () => {
    cy.visit(`${APP_URL}/driver/security`)
    cy.location('pathname', { timeout: 15000 }).should('eq', '/login')
    cy.contains(/Welcome back|Sign In|تسجيل الدخول/i).should('be.visible')
  })

  it('protects admin security route and redirects to login when unauthenticated', () => {
    cy.visit(`${APP_URL}/admin/security`)
    cy.location('pathname', { timeout: 15000 }).should('eq', '/login')
    cy.contains(/Welcome back|Sign In|تسجيل الدخول/i).should('be.visible')
  })
})
