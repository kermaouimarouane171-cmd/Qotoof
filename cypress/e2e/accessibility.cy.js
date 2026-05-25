/// <reference types="cypress" />

const AXE_OPTIONS = {
  includedImpacts: ['critical', 'serious'],
  rules: {
    'color-contrast': { enabled: true },
  },
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa'],
  },
}

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
  const base = {
    buyer: { id: '11111111-1111-4111-8111-111111111111', email: 'buyer@greenmarket.test', full_name: 'Amina Buyer' },
    vendor: { id: '22222222-2222-4222-8222-222222222222', email: 'vendor@greenmarket.test', full_name: 'Youssef Vendor' },
    driver: { id: '33333333-3333-4333-8333-333333333333', email: 'driver@greenmarket.test', full_name: 'Hamza Driver' },
    admin: { id: '44444444-4444-4444-8444-444444444444', email: 'admin@greenmarket.test', full_name: 'Nadia Admin' },
  }[role]

  win.localStorage.setItem('auth-store', JSON.stringify({
    state: {
      user: {
        id: base.id,
        email: base.email,
      },
      profile: {
        id: base.id,
        role,
        full_name: base.full_name,
        onboarding_completed: true,
      },
      loading: false,
    },
    version: 0,
  }))
}

const marketplaceProducts = Array.from({ length: 13 }, (_, index) => ({
  id: `prod-${String(index + 1).padStart(3, '0')}`,
    name: `Organic Tomatoes ${index + 1}`,
    description: 'Fresh tomatoes from Atlas Fresh Farm',
    category: 'vegetables',
    subcategory: 'tomatoes',
    price_per_unit: 40,
    unit_type: 'kg',
    min_order_quantity: 1,
    is_available: true,
    approval_status: 'approved',
    average_rating: 4.8,
    reviews_count: 12,
    vendor_id: 'vendor-001',
    vendor: {
      id: 'vendor-001',
      first_name: 'Ali',
      last_name: 'Vendor',
      store_name: 'Atlas Fresh Farm',
      city: 'Rabat',
      is_verified: true,
    },
    product_images: [{ url: 'https://example.com/tomato.jpg', is_primary: true }],
  }))

const setupMarketplaceInterceptors = () => {
  setupPublicInterceptors()

  cy.intercept('GET', '**/rest/v1/profiles*', {
    statusCode: 200,
    body: [
      {
        id: 'vendor-001',
        role: 'vendor',
        first_name: 'Ali',
        last_name: 'Vendor',
        store_name: 'Atlas Fresh Farm',
        store_description: 'Fresh produce',
        city: 'Rabat',
      },
    ],
  }).as('profiles')

  cy.intercept('GET', '**/rest/v1/products*', {
    statusCode: 200,
    body: marketplaceProducts,
  }).as('products')
}

const setupDashboardInterceptors = () => {
  setupPublicInterceptors()
  cy.intercept('GET', '**/rest/v1/**', { statusCode: 200, body: [] })
  cy.intercept('POST', '**/rest/v1/**', { statusCode: 201, body: {} })
}

const setupCheckoutInterceptors = () => {
  setupPublicInterceptors()
  cy.intercept('GET', '**/rest/v1/**', { statusCode: 200, body: [] })
  cy.intercept('POST', '**/rest/v1/**', { statusCode: 201, body: {} })
  cy.intercept('POST', '**/functions/v1/**', { statusCode: 200, body: {} })
  cy.intercept('GET', 'https://nominatim.openstreetmap.org/search*', {
    statusCode: 200,
    body: [
      {
        place_id: 1,
        lat: '33.5731',
        lon: '-7.5898',
        display_name: 'Casablanca, Morocco',
      },
    ],
  }).as('geoSearch')
  cy.intercept('GET', 'https://nominatim.openstreetmap.org/reverse*', {
    statusCode: 200,
    body: {
      display_name: 'Casablanca, Morocco',
    },
  }).as('geoReverse')
}

describe('Home Page Accessibility', () => {
  beforeEach(() => {
    setupPublicInterceptors()
    cy.visit('/')
    cy.document().then((doc) => {
      doc.documentElement.lang = 'ar'
      doc.documentElement.dir = 'rtl'
    })
    cy.injectAxe()
  })

  it('home page has no critical accessibility violations', () => {
    cy.checkA11y(null, AXE_OPTIONS)
  })

  it('home page in RTL Arabic has no violations', () => {
    cy.checkA11y()
  })
})

describe('Auth Pages Accessibility', () => {
  it('login page has no violations', () => {
    setupPublicInterceptors()
    cy.visit('/login')
    cy.injectAxe()

    cy.get('[data-testid="login-email-input"]').should('have.focus')
    cy.get('[data-testid="login-submit-button"]').click()
    cy.get('[role="alert"]').should('be.visible')
    cy.checkA11y(null, AXE_OPTIONS)
  })

  it('register page has no violations', () => {
    setupPublicInterceptors()
    cy.visit('/register')
    cy.injectAxe()
    cy.checkA11y(null, AXE_OPTIONS)
  })

  it('forgot password page has no violations', () => {
    setupPublicInterceptors()
    cy.visit('/forgot-password')
    cy.injectAxe()
    cy.checkA11y(null, AXE_OPTIONS)
  })
})

describe('Marketplace Accessibility', () => {
  beforeEach(() => {
    setupMarketplaceInterceptors()
    cy.visit('/marketplace')
    cy.injectAxe()
  })

  it('marketplace product listing has no critical violations', () => {
    cy.wait('@profiles')
    cy.wait('@products')
    cy.checkA11y(null, AXE_OPTIONS)
  })

  it('product search accessible by keyboard only', () => {
    cy.get('[data-testid="search-bar-input"]').type('tomato{enter}')
    cy.location('search').should('contain', 'search=tomato')
  })

  it('category filter accessible by keyboard', () => {
    cy.get('[role="tab"]').first().focus().type('{enter}')
    cy.get('[role="tab"]').first().should('have.attr', 'aria-selected', 'true')
  })

  it('pagination controls are accessible', () => {
    cy.get('[role="navigation"][aria-label*="ترقيم"]').should('exist')
    cy.get('[role="navigation"]').contains('الصفحة 1').should('exist')
  })
})

describe('Checkout Accessibility', () => {
  beforeEach(() => {
    setupCheckoutInterceptors()
  })

  it('checkout step 1 (shipping) has no violations', () => {
    cy.visit('/')
    cy.addToCart('prod-001')
    cy.visit('/checkout', {
      onBeforeLoad(win) {
        seedAuthState(win, 'buyer')
      },
    })

    cy.injectAxe()
    cy.get('[data-testid="checkout-step-shipping"]').should('be.visible')
    cy.checkA11y('[data-testid="checkout-step-shipping"]', AXE_OPTIONS)
  })

  it('checkout step 2 (payment) has no violations', () => {
    cy.visit('/')
    cy.addToCart('prod-001')
    cy.visit('/checkout', {
      onBeforeLoad(win) {
        seedAuthState(win, 'buyer')
      },
    })

    cy.get('[data-testid="checkout-full-name-input"]').clear().type('Amina Buyer')
    cy.get('[data-testid="checkout-phone-input"]').clear().type('+212600000000')
    cy.get('[data-testid="checkout-city-input"]').clear().type('Casablanca')
    cy.get('[data-testid="checkout-address-input"]').clear().type('Hay Riyad, Rue 10')
    cy.get('[data-testid="location-search-input"]').type('Casablanca')
    cy.wait('@geoSearch')
    cy.get('[data-testid="location-search-result"]').click()
    cy.get('[data-testid="checkout-continue-to-delivery"]').click()

    cy.injectAxe()
    cy.get('[data-testid="checkout-step-payment"]').should('be.visible')
    cy.checkA11y('[data-testid="checkout-step-payment"]', AXE_OPTIONS)
  })

  it('order confirmation has no violations', () => {
    cy.visit('/checkout', {
      onBeforeLoad(win) {
        seedAuthState(win, 'buyer')
      },
    })
    cy.injectAxe()
    cy.checkA11y(null, AXE_OPTIONS)
  })
})

describe('Dashboard Pages', () => {
  it('vendor dashboard has no critical violations', () => {
    setupDashboardInterceptors()
    cy.visit('/vendor/dashboard', {
      onBeforeLoad(win) {
        seedAuthState(win, 'vendor')
      },
    })
    cy.injectAxe()
    cy.checkA11y(null, AXE_OPTIONS)
  })

  it('buyer orders page has no critical violations', () => {
    setupDashboardInterceptors()
    cy.visit('/buyer/orders', {
      onBeforeLoad(win) {
        seedAuthState(win, 'buyer')
      },
    })
    cy.injectAxe()
    cy.checkA11y(null, AXE_OPTIONS)
  })

  it('driver dashboard has no critical violations', () => {
    setupDashboardInterceptors()
    cy.visit('/driver/dashboard', {
      onBeforeLoad(win) {
        seedAuthState(win, 'driver')
      },
    })
    cy.injectAxe()
    cy.checkA11y(null, AXE_OPTIONS)
  })
})

describe('Keyboard Navigation', () => {
  it('can complete full checkout using only keyboard', () => {
    cy.visit('/')
    cy.addToCart('prod-001')
    cy.visit('/checkout', {
      onBeforeLoad(win) {
        seedAuthState(win, 'buyer')
      },
    })

    cy.get('[data-testid="checkout-full-name-input"]').focus().type('Amina Buyer{tab}')
    cy.focused().should('have.attr', 'data-testid', 'checkout-phone-input')
    cy.focused().type('+212600000000{tab}')
    cy.focused().type('Casablanca{tab}')
    cy.focused().type('Hay Riyad, Rue 10{tab}')
    cy.get('[data-testid="location-search-input"]').type('Casablanca{enter}')
    cy.wait('@geoSearch')
    cy.get('[data-testid="location-search-result"]').click()
    cy.get('[data-testid="checkout-continue-to-delivery"]').focus().type('{enter}')
  })

  it('product cards navigable by keyboard', () => {
    setupMarketplaceInterceptors()
    cy.visit('/marketplace')
    cy.get('[data-testid="product-card"]').first().focus().type('{enter}')
    cy.location('pathname').should('contain', '/product/')
  })

  it('modal closes with Escape key', () => {
    setupMarketplaceInterceptors()
    cy.visit('/marketplace')
    cy.get('button[aria-controls="mobile-filters-panel"]').click()
    cy.get('[role="dialog"][aria-label*="الفلاتر"]').should('be.visible')
    cy.get('body').type('{esc}')
    cy.get('[role="dialog"][aria-label*="الفلاتر"]').should('not.exist')
  })

  it('dropdown menus navigable with arrow keys', () => {
    setupMarketplaceInterceptors()
    cy.visit('/marketplace')
    cy.get('[data-testid="search-bar-input"]').type('to')
    cy.focused().type('{downarrow}{enter}')
  })
})