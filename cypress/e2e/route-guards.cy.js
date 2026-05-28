describe('Critical Route Guards', () => {
  it('redirects unauthenticated buyer route access to /login', () => {
    cy.clearCookies()
    cy.clearLocalStorage()

    cy.visit('/buyer/orders', { failOnStatusCode: false })

    cy.url().should('include', '/login')
  })

  it('redirects unauthenticated vendor route access to /login', () => {
    cy.clearCookies()
    cy.clearLocalStorage()

    cy.visit('/vendor/orders', { failOnStatusCode: false })

    cy.url().should('include', '/login')
  })

  it('handles auth:sessionExpired by forcing login with expired marker', () => {
    cy.visit('/marketplace', { failOnStatusCode: false })

    cy.window().then((win) => {
      win.dispatchEvent(new win.CustomEvent('auth:sessionExpired'))
    })

    cy.url().should('include', '/login?expired=true')
  })
})
