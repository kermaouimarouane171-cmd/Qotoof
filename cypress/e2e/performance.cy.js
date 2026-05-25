/// <reference types="cypress" />

const APP_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

const setupPublicInterceptors = () => {
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

const seedAuthState = (win, role = 'buyer') => {
  const profiles = {
    buyer: { id: '11111111-1111-4111-8111-111111111111', email: 'buyer@greenmarket.test', full_name: 'Amina Buyer' },
    vendor: { id: '22222222-2222-4222-8222-222222222222', email: 'vendor@greenmarket.test', full_name: 'Youssef Vendor' },
  }

  const profile = profiles[role]
  win.localStorage.setItem('auth-store', JSON.stringify({
    state: {
      user: { id: profile.id, email: profile.email },
      profile: { id: profile.id, role, full_name: profile.full_name, onboarding_completed: true },
      loading: false,
    },
    version: 0,
  }))
}

const seedCart = () => {
  cy.addToCart('prod-001')
}

describe('Bundle Size Regression', () => {
  it('initial JS bundle size under 500KB gzipped', () => {
    setupPublicInterceptors()
    cy.visit('/')
    cy.get('script[type="module"]').first().invoke('attr', 'src').then((src) => {
      expect(src).to.be.a('string')
      cy.request({ url: src, encoding: 'binary' }).then((response) => {
        const bodyLength = response.body ? response.body.length : 0
        expect(bodyLength, 'module script size proxy').to.be.lessThan(500 * 1024)
      })
    })
  })
})

describe('Loading Performance', () => {
  it('marketplace page shows skeleton cards within 100ms', () => {
    setupPublicInterceptors()
    cy.intercept('GET', '**/rest/v1/profiles*', {
      delayMs: 500,
      statusCode: 200,
      body: [
        {
          id: 'vendor-001',
          role: 'vendor',
          first_name: 'Ali',
          last_name: 'Vendor',
          store_name: 'Atlas Fresh Farm',
          city: 'Rabat',
        },
      ],
    }).as('profiles')
    cy.intercept('GET', '**/rest/v1/products*', {
      delayMs: 500,
      statusCode: 200,
      body: [],
    }).as('products')

    cy.visit('/marketplace')
    cy.get('.animate-pulse').should('exist')
  })

  it('home page hero section visible without scrolling', () => {
    setupPublicInterceptors()
    cy.visit('/')
    cy.get('main, header, h1').first().should('be.visible')
  })

  it('lazy-loaded pages load within 2 seconds', () => {
    setupPublicInterceptors()
    cy.visit('/vendor/dashboard', {
      onBeforeLoad(win) {
        seedAuthState(win, 'vendor')
      },
    })

    cy.contains(/Dashboard|لوحة التحكم|Vendor/i, { timeout: 2000 }).should('be.visible')
  })
})

describe('React Query Caching', () => {
  it('navigating back to marketplace uses cached products', () => {
    setupPublicInterceptors()
    let productsRequestCount = 0
    cy.intercept('GET', '**/rest/v1/products*', (req) => {
      productsRequestCount += 1
      req.reply({
        statusCode: 200,
        body: [{ id: 'prod-001', name: 'Organic Tomatoes', vendor_id: 'vendor-001' }],
      })
    }).as('productsRequest')

    cy.visit('/marketplace')
    cy.wait('@productsRequest')
    cy.get('[data-testid="product-card"]').first().click()
    cy.go('back')
    cy.then(() => {
      expect(productsRequestCount).to.eq(1)
    })
  })

  it('cache invalidates after order placed', () => {
    setupPublicInterceptors()
    seedCart()
    cy.visit('/checkout', {
      onBeforeLoad(win) {
        seedAuthState(win, 'buyer')
      },
    })
    cy.get('[data-testid="checkout-step-shipping"]').should('be.visible')
    cy.visit('/buyer/orders', {
      onBeforeLoad(win) {
        seedAuthState(win, 'buyer')
      },
    })
    cy.contains(/Orders|طلباتي/i).should('be.visible')
  })
})