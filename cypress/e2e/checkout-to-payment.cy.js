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
    from: 'qotoof273@gmail.com',
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

  cy.intercept('POST', '**/functions/v1/secure-login', {
    statusCode: 200,
    body: {
      success: true,
      session: {
        access_token: 'test-jwt.eyJzdWIiOiJidXllci0wMDEiLCJlbWFpbCI6ImJ1eWVyQGdyZWVubWFya2V0LnRlc3QifQ.signature',
        refresh_token: 'test-refresh-token',
      },
    },
  }).as('secureLogin')

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

    if (path.includes('/rpc/')) {
      if (path.endsWith('/find_available_drivers_for_checkout')) {
        req.reply({ statusCode: 200, body: drivers })
        return
      }
      if (path.endsWith('/is_vendor_open')) {
        req.reply({ statusCode: 200, body: true })
        return
      }
      if (path.endsWith('/get_order_view')) {
        req.reply({
          statusCode: 200,
          body: {
            order: {
              id: fixture.checkout_order_response.orders[0]?.id || 'order-10001',
              status: 'pending',
              payment_method: 'cod',
              first_payment_amount: 0,
              total_amount: fixture.checkout_order_response.pricing?.total || 140.4,
              created_at: new Date().toISOString(),
              buyer_id: fixture.buyer.id,
              vendor_id: fixture.vendor.id,
              shipping_address: fixture.buyer.address,
              delivery_city: fixture.buyer.city,
            },
            items: fixture.order_items || [],
            payment: fixture.payment_record || { status: 'pending', payment_method: 'cod' },
            buyer: {
              id: fixture.buyer.id,
              full_name: `${fixture.buyer.first_name} ${fixture.buyer.last_name}`,
              first_name: fixture.buyer.first_name,
              last_name: fixture.buyer.last_name,
              phone: fixture.buyer.phone,
              email: fixture.buyer.email,
              avatar_url: null,
            },
            vendor: {
              id: fixture.vendor.id,
              store_name: fixture.vendor.store_name,
              phone: null,
              email: null,
              city: fixture.vendor.city,
              avatar_url: null,
              latitude: fixture.vendor.latitude,
              longitude: fixture.vendor.longitude,
            },
            driver: null,
            delivery: null,
          },
        })
        return
      }
      req.reply({ statusCode: 200, body: [] })
      return
    }

    if (path.endsWith('/public_profiles')) {
      const pubAccept = req.headers['accept'] || req.headers['Accept'] || ''
      const pubWantsObject = pubAccept.includes('application/vnd.pgrst.object+json')
      req.reply({
        statusCode: 200,
        body: pubWantsObject ? fixture.vendor : [fixture.vendor],
      })
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

      const accept = req.headers['accept'] || req.headers['Accept'] || ''
      const wantsObject = accept.includes('application/vnd.pgrst.object+json')

      if (search.includes(`id=eq.${fixture.vendor.id}`)) {
        req.reply({ statusCode: 200, body: wantsObject ? fixture.vendor : [fixture.vendor] })
        return
      }

      if (search.includes(`id=eq.${fixture.buyer.id}`)) {
        req.reply({ statusCode: 200, body: wantsObject ? fixture.buyer : [fixture.buyer] })
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
  cy.wait(1500)
  cy.get('[data-testid="checkout-continue-to-delivery"]').click()
  cy.get('[data-testid="checkout-step-delivery"]').should('be.visible')
}

describe('Checkout To Payment', () => {
  it('Happy path: buyer completes checkout with COD and sees order confirmation number', () => {
    cy.fixture('checkout-happy').then((fixture) => {
      setupSupabaseInterceptions(fixture)
      cy.viewport(1280, 720)
      cy.loginAs('buyer')
      cy.addToCart('prod-001')

      cy.fixture('products').then((productsFixture) => {
        const products = Array.isArray(productsFixture) ? productsFixture : (productsFixture?.products || [])
        const product = products.find((p) => p.id === 'prod-001')
        const cartItem = {
          id: product.id,
          name: product.name,
          price_per_unit: Number(product.price_per_unit || product.price || 0),
          unit_type: product.unit_type || 'kg',
          quantity: Math.max(2, Number(product.min_order_quantity || 1)),
          min_order_quantity: Number(product.min_order_quantity || 1),
          is_available: product.is_available !== false,
          available_quantity: Number(product.available_quantity || 999),
          vendor_id: product.vendor_id,
          vendor_name: product.vendor_name || product.store_name || 'Vendor',
          image_url: product.image_url || null,
          category: product.category || 'produce',
          subcategory: product.subcategory || null,
        }

        cy.visit('/checkout', {
          onBeforeLoad: (win) => {
            win.localStorage.setItem('cart-storage', JSON.stringify({
              state: {
                items: [cartItem],
                checkoutVendorId: product.vendor_id || null,
                lastValidated: null,
              },
              version: 4,
            }))
            win.localStorage.setItem('sb-oyaiiyekfkflesdmcvvo-auth-token', JSON.stringify({
              access_token: 'test-jwt.eyJzdWIiOiJidXllci0wMDEiLCJlbWFpbCI6ImJ1eWVyQGdyZWVubWFya2V0LnRlc3QifQ.signature',
              refresh_token: 'test-refresh-token',
              expires_in: 3600,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              token_type: 'bearer',
              user: {
                id: fixture.buyer.id,
                email: fixture.buyer.email,
                aud: 'authenticated',
                role: 'authenticated',
              },
            }))
          },
        })
      })
      cy.url({ timeout: 15000 }).should('include', '/checkout')
      cy.wait(3000)
      cy.get('body').then(($body) => {
        const html = $body.html()
        cy.writeFile('cypress/downloads/debug-body.html', html)
      })
      cy.get('[data-testid="checkout-page"]', { timeout: 20000 }).should('be.visible')

      fillShippingAndContinue(fixture.buyer.address)

      cy.contains(`${fixture.drivers[0].first_name} ${fixture.drivers[0].last_name}`).should('be.visible')
      cy.get('input[name="driver"]').first().check({ force: true })

      cy.get('[data-testid="checkout-continue-to-payment"]').click()
      cy.get('[data-testid="checkout-step-payment"]', { timeout: 15000 }).should('be.visible')

      cy.get('[data-testid="payment-type-cod"]').click()
      cy.get('[data-testid="payment-terms-checkbox"]').check({ force: true })

      cy.get('[data-testid="checkout-submit"]').should('not.be.disabled').click()

      cy.url().should('include', '/order-confirmation')
      cy.get('[data-testid="order-confirmation-page"]', { timeout: 15000 }).should('be.visible')
      cy.contains(`#${fixture.checkout_order_response.orders[0].id.slice(0, 8)}`).should('be.visible')
    })
  })

  it('Minimum order: below-threshold checkout shows blocker and disables progression', () => {
    cy.fixture('checkout-minimum-order').then((fixture) => {
      setupSupabaseInterceptions(fixture)
      cy.viewport(1280, 720)
      cy.loginAs('buyer')
      cy.addToCart('prod-001')

      cy.fixture('products').then((productsFixture) => {
        const products = Array.isArray(productsFixture) ? productsFixture : (productsFixture?.products || [])
        const product = products.find((p) => p.id === 'prod-001')
        const cartItem = {
          id: product.id,
          name: product.name,
          price_per_unit: Number(product.price_per_unit || product.price || 0),
          unit_type: product.unit_type || 'kg',
          quantity: Math.max(2, Number(product.min_order_quantity || 1)),
          min_order_quantity: Number(product.min_order_quantity || 1),
          is_available: product.is_available !== false,
          available_quantity: Number(product.available_quantity || 999),
          vendor_id: product.vendor_id,
          vendor_name: product.vendor_name || product.store_name || 'Vendor',
          image_url: product.image_url || null,
          category: product.category || 'produce',
          subcategory: product.subcategory || null,
        }

        cy.visit('/checkout', {
          onBeforeLoad: (win) => {
            win.localStorage.setItem('cart-storage', JSON.stringify({
              state: {
                items: [cartItem],
                checkoutVendorId: product.vendor_id || null,
                lastValidated: null,
              },
              version: 4,
            }))
            win.localStorage.setItem('sb-oyaiiyekfkflesdmcvvo-auth-token', JSON.stringify({
              access_token: 'test-jwt.eyJzdWIiOiJidXllci0wMDEiLCJlbWFpbCI6ImJ1eWVyQGdyZWVubWFya2V0LnRlc3QifQ.signature',
              refresh_token: 'test-refresh-token',
              expires_in: 3600,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              token_type: 'bearer',
              user: {
                id: fixture.buyer.id,
                email: fixture.buyer.email,
                aud: 'authenticated',
                role: 'authenticated',
              },
            }))
          },
        })
      })
      cy.url({ timeout: 15000 }).should('include', '/checkout')
      cy.wait(3000)
      cy.get('body').then(($body) => {
        const text = $body.text().trim().substring(0, 200)
        cy.log('BODY TEXT:', text)
        cy.log('URL:', cy.location('href'))
      })
      cy.get('[data-testid="checkout-page"]', { timeout: 20000 }).should('be.visible')

      cy.get('[data-testid="checkout-minimum-order-blocker"]').should('be.visible')
      cy.get('[data-testid="checkout-minimum-order-error"]').should('contain', 'الحد الأدنى')
      cy.get('[data-testid="checkout-continue-to-delivery"]').should('be.disabled')
    })
  })

  it('No drivers: empty driver API shows no-drivers message and order cannot be completed', () => {
    cy.fixture('checkout-no-drivers').then((fixture) => {
      setupSupabaseInterceptions(fixture, { emptyDrivers: true })
      cy.viewport(1280, 720)
      cy.loginAs('buyer')
      cy.addToCart('prod-001')

      cy.fixture('products').then((productsFixture) => {
        const products = Array.isArray(productsFixture) ? productsFixture : (productsFixture?.products || [])
        const product = products.find((p) => p.id === 'prod-001')
        const cartItem = {
          id: product.id,
          name: product.name,
          price_per_unit: Number(product.price_per_unit || product.price || 0),
          unit_type: product.unit_type || 'kg',
          quantity: Math.max(2, Number(product.min_order_quantity || 1)),
          min_order_quantity: Number(product.min_order_quantity || 1),
          is_available: product.is_available !== false,
          available_quantity: Number(product.available_quantity || 999),
          vendor_id: product.vendor_id,
          vendor_name: product.vendor_name || product.store_name || 'Vendor',
          image_url: product.image_url || null,
          category: product.category || 'produce',
          subcategory: product.subcategory || null,
        }

        cy.visit('/checkout', {
          onBeforeLoad: (win) => {
            win.localStorage.setItem('cart-storage', JSON.stringify({
              state: {
                items: [cartItem],
                checkoutVendorId: product.vendor_id || null,
                lastValidated: null,
              },
              version: 4,
            }))
            win.localStorage.setItem('sb-oyaiiyekfkflesdmcvvo-auth-token', JSON.stringify({
              access_token: 'test-jwt.eyJzdWIiOiJidXllci0wMDEiLCJlbWFpbCI6ImJ1eWVyQGdyZWVubWFya2V0LnRlc3QifQ.signature',
              refresh_token: 'test-refresh-token',
              expires_in: 3600,
              expires_at: Math.floor(Date.now() / 1000) + 3600,
              token_type: 'bearer',
              user: {
                id: fixture.buyer.id,
                email: fixture.buyer.email,
                aud: 'authenticated',
                role: 'authenticated',
              },
            }))
          },
        })
      })
      cy.url({ timeout: 15000 }).should('include', '/checkout')
      cy.wait(3000)
      cy.get('body').then(($body) => {
        const text = $body.text().trim().substring(0, 200)
        cy.log('BODY TEXT:', text)
        cy.log('URL:', cy.location('href'))
      })
      cy.get('[data-testid="checkout-page"]', { timeout: 20000 }).should('be.visible')

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
