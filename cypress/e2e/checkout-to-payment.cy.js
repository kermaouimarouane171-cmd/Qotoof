const defaultPublicConfig = {
  supabase: {
    url: 'https://test-project.supabase.co',
    anonKey: 'test-anon-key',
  },
  paypal: {
    clientId: 'paypal-client-id-placeholder',
    settlementCurrency: 'EUR',
  },
  recaptcha: {
    siteKey: 'recaptcha-site-key-placeholder',
  },
  email: {
    from: 'Qotoof273@gmail.com',
  },
  app: {
    name: 'Qotoof',
    version: '1.0.0',
  },
}

const authTokenResponse = {
  access_token: 'test-access-token',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'test-refresh-token',
  user: {
    id: 'buyer-001',
    email: 'buyer@greenmarket.test',
    role: 'authenticated',
  },
}

const setupSupabaseInterceptions = (fixture, options = {}) => {
  const drivers = options.emptyDrivers ? [] : (fixture.drivers || [])

  cy.intercept('GET', '**/functions/v1/get-public-config', {
    statusCode: 200,
    body: defaultPublicConfig,
  }).as('getPublicConfig')

  cy.intercept('POST', '**/auth/v1/token*', {
    statusCode: 200,
    body: authTokenResponse,
  }).as('authToken')

  cy.intercept('GET', '**/auth/v1/user*', {
    statusCode: 200,
    body: {
      id: fixture.buyer.id,
      email: fixture.buyer.email,
      role: 'authenticated',
    },
  }).as('authUser')

  cy.intercept('POST', '**/auth/v1/logout*', {
    statusCode: 204,
    body: {},
  }).as('authLogout')

  cy.intercept('POST', '**/functions/v1/create-checkout-order', {
    statusCode: 200,
    body: fixture.checkout_order_response,
  }).as('createCheckoutOrder')

  cy.intercept('POST', '**/functions/v1/create-paypal-order', {
    statusCode: 200,
    body: {
      orderId: 'paypal-order-001',
      approvalUrl: 'https://paypal.example.com/checkout',
    },
  }).as('createPaypalOrder')

  cy.intercept('**/rest/v1/**', (req) => {
    const url = new URL(req.url)
    const path = url.pathname
    const search = url.search

    if (path.endsWith('/platform_settings')) {
      req.reply({ statusCode: 200, body: fixture.platform_settings || {} })
      return
    }

    if (path.endsWith('/vendor_delivery_slots')) {
      req.reply({ statusCode: 200, body: fixture.delivery_slots || [] })
      return
    }

    if (path.endsWith('/orders')) {
      if (req.method === 'GET') {
        req.reply({ statusCode: 200, body: [] })
        return
      }

      req.reply({ statusCode: 200, body: fixture.checkout_order_response?.orders || [] })
      return
    }

    if (path.endsWith('/order_items')) {
      req.reply({ statusCode: 200, body: fixture.order_items || [] })
      return
    }

    if (path.endsWith('/payments')) {
      if (search.includes('limit=1')) {
        req.reply({ statusCode: 200, body: fixture.payment_record || null })
        return
      }

      req.reply({ statusCode: 200, body: fixture.payment_record ? [fixture.payment_record] : [] })
      return
    }

    if (path.endsWith('/coupons')) {
      req.reply({ statusCode: 200, body: [] })
      return
    }

    if (path.endsWith('/coupon_redemptions')) {
      req.reply({ statusCode: 200, body: [] })
      return
    }

    if (path.endsWith('/profiles')) {
      if (search.includes('role=eq.driver')) {
        req.reply({ statusCode: 200, body: drivers })
        return
      }

      if (search.includes('id=in.(')) {
        req.reply({ statusCode: 200, body: [fixture.vendor] })
        return
      }

      if (search.includes(`id=eq.${fixture.vendor.id}`)) {
        req.reply({ statusCode: 200, body: fixture.vendor })
        return
      }

      if (search.includes(`id=eq.${fixture.buyer.id}`)) {
        req.reply({ statusCode: 200, body: fixture.buyer })
        return
      }

      req.reply({ statusCode: 200, body: [] })
      return
    }

    req.reply({ statusCode: 200, body: [] })
  }).as('supabaseRest')
}

const ensureCheckoutLocation = () => {
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="location-selected-state"]').length > 0) {
      return
    }

    cy.get('[data-testid="location-search-input"]').clear().type('Casablanca')
    cy.get('[data-testid="location-search-result"]', { timeout: 15000 }).first().click()
    cy.get('[data-testid="location-selected-state"]', { timeout: 15000 }).should('be.visible')
  })
}

const fillShippingAndContinue = (addressValue) => {
  cy.contains('button', addressValue).click()
  cy.get('[data-testid="checkout-full-name-input"]').clear().type('Amina El Idrissi')
  cy.get('[data-testid="checkout-phone-input"]').clear().type('+212600000001')
  cy.get('[data-testid="checkout-city-input"]').clear().type('Casablanca')
  cy.get('[data-testid="checkout-address-input"]').clear().type(addressValue)
  ensureCheckoutLocation()
  cy.get('[data-testid="checkout-continue-to-delivery"]').click()
  cy.get('[data-testid="checkout-step-delivery"]').should('be.visible')
}

describe('Checkout To Payment', () => {
  it('Happy path: buyer completes checkout with COD and sees order confirmation number', () => {
    cy.fixture('checkout-happy').then((fixture) => {
      setupSupabaseInterceptions(fixture)
      cy.loginAs('buyer')
      cy.addToCart('prod-001')

      cy.visit('/checkout')
      cy.get('[data-testid="checkout-page"]').should('be.visible')

      fillShippingAndContinue(fixture.buyer.address)

      cy.contains(`${fixture.drivers[0].first_name} ${fixture.drivers[0].last_name}`).should('be.visible')
      cy.get('input[name="driver"]').first().check({ force: true })

      cy.get('[data-testid="checkout-continue-to-payment"]').click()
      cy.get('[data-testid="checkout-step-payment"]').should('be.visible')

      cy.get('[data-testid="payment-type-cod"]').click()
      cy.get('[data-testid="payment-terms-checkbox"]').check({ force: true })

      cy.get('[data-testid="checkout-submit"]').should('not.be.disabled').click()

      cy.url().should('include', '/order-confirmation')
      cy.get('[data-testid="order-confirmation-page"]').should('be.visible')
      cy.contains(`#${fixture.checkout_order_response.orders[0].id.slice(0, 8)}`).should('be.visible')
    })
  })

  it('Minimum order: below-threshold checkout shows blocker and disables progression', () => {
    cy.fixture('checkout-minimum-order').then((fixture) => {
      setupSupabaseInterceptions(fixture)
      cy.loginAs('buyer')
      cy.addToCart('prod-001')

      cy.visit('/checkout')
      cy.get('[data-testid="checkout-page"]').should('be.visible')

      cy.get('[data-testid="checkout-minimum-order-blocker"]').should('be.visible')
      cy.get('[data-testid="checkout-minimum-order-error"]').should('contain', 'الحد الأدنى')
      cy.get('[data-testid="checkout-continue-to-delivery"]').should('be.disabled')
    })
  })

  it('No drivers: empty driver API shows no-drivers message and order cannot be completed', () => {
    cy.fixture('checkout-no-drivers').then((fixture) => {
      setupSupabaseInterceptions(fixture, { emptyDrivers: true })
      cy.loginAs('buyer')
      cy.addToCart('prod-001')

      cy.visit('/checkout')
      cy.get('[data-testid="checkout-page"]').should('be.visible')

      fillShippingAndContinue(fixture.buyer.address)

      cy.contains('No Drivers Currently Available').should('be.visible')
      cy.get('[data-testid="checkout-continue-to-payment"]').click()

      cy.get('[data-testid="checkout-step-payment"]').should('be.visible')
      cy.get('[data-testid="payment-type-cod"]').click()
      cy.get('[data-testid="payment-terms-checkbox"]').check({ force: true })
      cy.get('[data-testid="checkout-submit"]').click()

      cy.url().should('include', '/checkout')
      cy.get('[data-testid="order-confirmation-page"]').should('not.exist')
    })
  })

  it('Auth guard: visiting /checkout without login redirects to /login', () => {
    cy.clearLocalStorage()
    cy.clearCookies()

    cy.visit('/checkout')
    cy.url().should('include', '/login')
  })
})
