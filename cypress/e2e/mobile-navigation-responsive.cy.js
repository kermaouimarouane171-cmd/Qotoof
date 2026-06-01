/*
 * Mobile navigation and responsive safety checks.
 * Focuses on bottom navigation behavior, role isolation, and horizontal overflow.
 */

const viewports = [
  { width: 360, height: 800, name: '360x800' },
  { width: 390, height: 844, name: '390x844' },
  { width: 412, height: 915, name: '412x915' },
  { width: 430, height: 932, name: '430x932' },
]

const runRoleNavE2E = Boolean(Cypress.env('RUN_ROLE_NAV_E2E'))

const assertNoHorizontalOverflow = () => {
  cy.window().then((win) => {
    const html = win.document.documentElement
    const body = win.document.body

    expect(html.scrollWidth, 'html should not overflow horizontally').to.be.lte(win.innerWidth + 1)
    expect(body.scrollWidth, 'body should not overflow horizontally').to.be.lte(win.innerWidth + 1)
  })
}

describe('Mobile Bottom Navigation & Responsive Checks', () => {
  viewports.forEach((vp) => {
    it(`auth pages stay clean without role bottom nav on ${vp.name}`, () => {
      cy.viewport(vp.width, vp.height)

      cy.visit('/login')
      cy.get('[data-testid="role-mobile-bottom-nav"]').should('not.exist')
      assertNoHorizontalOverflow()

      cy.visit('/register')
      cy.get('[data-testid="role-mobile-bottom-nav"]').should('not.exist')
      assertNoHorizontalOverflow()
    })

    it(`public marketplace/cart remain overflow-safe on ${vp.name}`, () => {
      cy.viewport(vp.width, vp.height)

      cy.visit('/marketplace')
      assertNoHorizontalOverflow()

      cy.visit('/cart')
      assertNoHorizontalOverflow()
    })
  })

  it('protected role dashboards redirect to login without rendering role bottom nav when unauthenticated', () => {
    cy.viewport(390, 844)

    ;['/buyer/dashboard', '/vendor/dashboard', '/driver/dashboard', '/admin/dashboard'].forEach((path) => {
      cy.visit(path)
      cy.location('pathname').should('eq', '/login')
      cy.get('[data-testid="role-mobile-bottom-nav"]').should('not.exist')
      assertNoHorizontalOverflow()
    })
  })

  ;(runRoleNavE2E ? it : it.skip)('buyer mobile bottom nav appears with buyer routes only and tabs navigate', () => {
    cy.viewport(390, 844)
    cy.loginAs('buyer')
    cy.visit('/buyer/dashboard')

    cy.get('[data-testid="role-mobile-bottom-nav"]').should('exist').and('have.attr', 'data-role', 'buyer')
    cy.get('[data-route="/vendor/orders"]').should('not.exist')
    cy.get('[data-route="/buyer/orders"]').click({ force: true })
    cy.location('pathname').should('include', '/buyer/orders')
    assertNoHorizontalOverflow()
  })

  ;(runRoleNavE2E ? it : it.skip)('vendor mobile bottom nav appears with vendor routes only and tabs navigate', () => {
    cy.viewport(390, 844)
    cy.loginAs('vendor')
    cy.visit('/vendor/dashboard')

    cy.get('[data-testid="role-mobile-bottom-nav"]').should('exist').and('have.attr', 'data-role', 'vendor')
    cy.get('[data-route="/buyer/orders"]').should('not.exist')
    cy.get('[data-route="/vendor/orders"]').click({ force: true })
    cy.location('pathname').should('include', '/vendor/orders')
    assertNoHorizontalOverflow()
  })

  ;(runRoleNavE2E ? it : it.skip)('driver mobile bottom nav appears with driver routes only and tabs navigate', () => {
    cy.viewport(390, 844)
    cy.loginAs('driver')
    cy.visit('/driver/dashboard')

    cy.get('[data-testid="role-mobile-bottom-nav"]').should('exist').and('have.attr', 'data-role', 'driver')
    cy.get('[data-route="/vendor/products"]').should('not.exist')
    cy.get('[data-route="/driver/active"]').click({ force: true })
    cy.location('pathname').should('include', '/driver/active')
    assertNoHorizontalOverflow()
  })

  ;(runRoleNavE2E ? it : it.skip)('admin mobile bottom nav appears with admin routes only and tabs navigate', () => {
    cy.viewport(390, 844)
    cy.loginAs('admin')
    cy.visit('/admin/dashboard')

    cy.get('[data-testid="role-mobile-bottom-nav"]').should('exist').and('have.attr', 'data-role', 'admin')
    cy.get('[data-route="/driver/active"]').should('not.exist')
    cy.get('[data-route="/admin/users"]').click({ force: true })
    cy.location('pathname').should('include', '/admin/users')
    assertNoHorizontalOverflow()
  })

  it('checkout remains overflow-safe on mobile (buyer)', () => {
    cy.viewport(390, 844)
    cy.loginAs('buyer')
    cy.visit('/checkout')

    cy.get('[data-testid="role-mobile-bottom-nav"]').should('not.exist')
    assertNoHorizontalOverflow()
  })
})
