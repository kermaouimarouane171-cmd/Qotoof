const defaultPublicConfig = {
  supabase: {
    url: 'https://test-project.supabase.co',
    anonKey: 'test-anon-key',
  },
  app: {
    name: 'Qotoof',
    version: '1.0.0',
  },
}

const vendorUser = {
  id: 'vendor-001',
  email: 'vendor@greenmarket.test',
  profile: {
    id: 'vendor-001',
    role: 'vendor',
    first_name: 'Youssef',
    last_name: 'Vendor',
    store_name: 'Fresh Atlas',
    onboarding_completed: true,
    agreement_accepted: true,
    phone_verified: true,
    latitude: 33.5731,
    longitude: -7.5898,
  },
}

const buyerProfile = {
  id: 'buyer-001',
  role: 'buyer',
  first_name: 'Amina',
  last_name: 'Buyer',
  phone: '+212600000001',
}

const availableDrivers = [
  {
    driver_id: 'driver-001',
    first_name: 'Khalid',
    last_name: 'Driver',
    phone: '+212600000777',
    vehicle_type: 'van',
    vehicle_plate: '12345-A-7',
    rating: 4.9,
    distance: 2.4,
  },
]

const buildOrders = () => ([
  {
    id: 'order-pending-001',
    order_number: 'ORD-P-001',
    status: 'pending',
    total: 145.5,
    created_at: '2026-05-20T09:00:00.000Z',
    buyer: buyerProfile,
    items: [
      { id: 'item-1', quantity: 3, unit_price: 20, product: { name: 'Tomatoes' } },
      { id: 'item-2', quantity: 2, unit_price: 42.75, product: { name: 'Olive Oil' } },
    ],
    deliveries: [{ id: 'delivery-001', driver_id: null, status: 'unassigned' }],
  },
  {
    id: 'order-accepted-001',
    order_number: 'ORD-A-001',
    status: 'vendor_accepted',
    total: 220,
    created_at: '2026-05-20T08:00:00.000Z',
    buyer: buyerProfile,
    items: [{ id: 'item-3', quantity: 5, unit_price: 44, product: { name: 'Oranges' } }],
    deliveries: [{ id: 'delivery-accepted-001', driver_id: null, status: 'unassigned' }],
  },
  {
    id: 'order-delivered-001',
    order_number: 'ORD-D-001',
    status: 'delivered',
    total: 90,
    created_at: '2026-05-19T17:00:00.000Z',
    buyer: buyerProfile,
    items: [{ id: 'item-4', quantity: 2, unit_price: 45, product: { name: 'Potatoes' } }],
    deliveries: [{ id: 'delivery-delivered-001', driver_id: 'driver-001', status: 'delivered' }],
  },
])

const parseRequestedId = (searchParams) => {
  const idEq = searchParams.get('id')
  if (idEq && idEq.startsWith('eq.')) {
    return idEq.slice(3)
  }

  const userIdEq = searchParams.get('user_id')
  if (userIdEq && userIdEq.startsWith('eq.')) {
    return userIdEq.slice(3)
  }

  return null
}

const createMockJwt = (userId, email) => {
  const toBase64Url = (value) => Cypress.Buffer
    .from(JSON.stringify(value))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

  const header = toBase64Url({ alg: 'HS256', typ: 'JWT' })
  const payload = toBase64Url({
    sub: userId,
    email,
    role: 'authenticated',
    aud: 'authenticated',
    exp: 4102444800,
    iat: 1700000000,
  })

  return `${header}.${payload}.signature`
}

const setupVendorOrderInterceptions = () => {
  const accessToken = createMockJwt(vendorUser.id, vendorUser.email)
  const refreshToken = `refresh-${vendorUser.id}`
  let ordersState = buildOrders()

  cy.intercept('GET', '**/functions/v1/get-public-config', {
    statusCode: 200,
    body: defaultPublicConfig,
  }).as('getPublicConfig')

  cy.intercept('OPTIONS', '**/auth/v1/**', { statusCode: 200, body: {} }).as('authOptions')
  cy.intercept('OPTIONS', '**/rest/v1/**', { statusCode: 200, body: {} }).as('restOptions')
  cy.intercept('OPTIONS', '**/functions/v1/**', { statusCode: 200, body: {} }).as('functionsOptions')

  cy.intercept('POST', '**/functions/v1/secure-login', {
    statusCode: 200,
    body: {
      success: true,
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
      },
    },
  }).as('secureLogin')

  cy.intercept('POST', '**/auth/v1/token*', {
    statusCode: 200,
    body: {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: vendorUser.id,
        email: vendorUser.email,
        role: 'authenticated',
      },
    },
  }).as('authToken')

  cy.intercept('GET', '**/auth/v1/user*', {
    statusCode: 200,
    body: {
      id: vendorUser.id,
      email: vendorUser.email,
      role: 'authenticated',
    },
  }).as('authUser')

  cy.intercept('POST', '**/auth/v1/logout*', {
    statusCode: 204,
    body: {},
  }).as('authLogout')

  cy.intercept('POST', '**/functions/v1/accept-order', (req) => {
    const orderId = req.body?.orderId
    ordersState = ordersState.map((order) => (
      order.id === orderId ? { ...order, status: 'vendor_accepted' } : order
    ))

    const updatedOrder = ordersState.find((order) => order.id === orderId)
    req.reply({
      statusCode: 200,
      body: {
        success: true,
        order: updatedOrder,
      },
    })
  }).as('acceptOrder')

  cy.intercept('POST', '**/functions/v1/reject-order', (req) => {
    const orderId = req.body?.orderId
    ordersState = ordersState.map((order) => (
      order.id === orderId ? { ...order, status: 'vendor_rejected' } : order
    ))

    const updatedOrder = ordersState.find((order) => order.id === orderId)
    req.reply({
      statusCode: 200,
      body: {
        success: true,
        buyerNotified: true,
        order: updatedOrder,
      },
    })
  }).as('rejectOrder')

  cy.intercept('POST', '**/functions/v1/assign-driver', (req) => {
    const deliveryId = req.body?.deliveryId
    const driverId = req.body?.driverId

    const selectedDriver = availableDrivers.find((driver) => driver.driver_id === driverId)

    ordersState = ordersState.map((order) => {
      const delivery = order.deliveries?.[0]
      if (!delivery || delivery.id !== deliveryId) {
        return order
      }

      return {
        ...order,
        status: 'driver_assigned',
        deliveries: [
          {
            ...delivery,
            status: 'driver_assigned',
            driver_id: driverId,
            driver: selectedDriver,
          },
        ],
      }
    })

    const updatedOrder = ordersState.find((order) => order.deliveries?.[0]?.id === deliveryId)

    req.reply({
      statusCode: 200,
      body: {
        success: true,
        notificationCreated: true,
        delivery: updatedOrder?.deliveries?.[0],
      },
    })
  }).as('assignDriver')

  cy.intercept('GET', '**/rest/v1/**', (req) => {
    const url = new URL(req.url)
    const path = url.pathname

    if (path.endsWith('/profiles')) {
      const requestedId = parseRequestedId(url.searchParams)
      const profile = requestedId === buyerProfile.id ? buyerProfile : vendorUser.profile

      if (requestedId) {
        req.reply({
          statusCode: 200,
          body: profile,
        })
        return
      }

      req.reply({
        statusCode: 200,
        body: [profile],
      })
      return
    }

    if (path.endsWith('/mfa_settings')) {
      req.reply({ statusCode: 200, body: [] })
      return
    }

    if (path.endsWith('/orders')) {
      req.reply({ statusCode: 200, body: ordersState })
      return
    }

    if (path.endsWith('/active_sessions')) {
      req.reply({ statusCode: 200, body: [] })
      return
    }

    req.reply({ statusCode: 200, body: [] })
  }).as('supabaseRest')

  cy.intercept('POST', '**/rest/v1/rpc/find_nearby_drivers', {
    statusCode: 200,
    body: availableDrivers,
  }).as('findNearbyDrivers')

  cy.intercept('POST', '**/rest/v1/**', {
    statusCode: 201,
    body: {},
  }).as('supabaseRestPost')

  cy.intercept('PATCH', '**/rest/v1/**', {
    statusCode: 200,
    body: {},
  }).as('supabaseRestPatch')
}

const loginAsVendorThroughUi = () => {
  cy.visit('/login')
  cy.get('input[type="email"]').clear().type(vendorUser.email)
  cy.get('input[type="password"]').clear().type('Test@123456')
  cy.contains('button', /sign in|login|تسجيل الدخول|connexion/i).click()
  cy.wait('@secureLogin')
  cy.location('pathname', { timeout: 15000 }).should('eq', '/vendor/dashboard')
}

describe('Vendor Order Management', () => {
  beforeEach(() => {
    setupVendorOrderInterceptions()
    loginAsVendorThroughUi()
    cy.visit('/vendor/orders')
    cy.contains('Orders Management').should('be.visible')
  })

  it('Vendor sees pending orders on dashboard list', () => {
    cy.contains('ORD-P-001').should('be.visible')
    cy.contains('Pending').should('be.visible')
    cy.contains('Amina Buyer').should('be.visible')
  })

  it('Accept order updates status from Pending to Accepted', () => {
    cy.contains('ORD-P-001')
      .closest('.p-6')
      .within(() => {
        cy.contains('button', /^accept$/i).click()
      })

    cy.wait('@acceptOrder')
    cy.contains('ORD-P-001')
      .closest('.p-6')
      .within(() => {
        cy.contains(/accepted/i).should('be.visible')
      })
  })

  it('Assign driver triggers assign flow and mocked notification creation', () => {
    cy.contains('ORD-A-001')
      .closest('.p-6')
      .within(() => {
        cy.contains('button', /assign driver/i).click()
      })

    cy.wait('@findNearbyDrivers')
    cy.contains('Khalid Driver').click()
    cy.contains('button', /^assign driver$/i).last().click()

    cy.wait('@assignDriver').then((interception) => {
      expect(interception.response.statusCode).to.equal(200)
      expect(interception.response.body.notificationCreated).to.equal(true)
    })

    cy.contains('ORD-A-001')
      .closest('.p-6')
      .within(() => {
        cy.contains(/driver assigned/i).should('be.visible')
      })
  })

  it('Reject order triggers mocked buyer notification response', () => {
    cy.contains('ORD-P-001')
      .closest('.p-6')
      .within(() => {
        cy.contains('button', /^reject$/i).click()
      })

    cy.wait('@rejectOrder').then((interception) => {
      expect(interception.response.statusCode).to.equal(200)
      expect(interception.response.body.buyerNotified).to.equal(true)
    })

    cy.contains('ORD-P-001').should('not.exist')
  })

  it('Filter by status shows only delivered orders', () => {
    cy.contains('button', /^delivered$/i).click()

    cy.contains('ORD-D-001').should('be.visible')
    cy.contains('ORD-P-001').should('not.exist')
    cy.contains('ORD-A-001').should('not.exist')
  })

  it('Order detail card displays correct buyer, items count, and total', () => {
    cy.contains('ORD-P-001')
      .closest('.p-6')
      .within(() => {
        cy.contains('Buyer:').should('be.visible')
        cy.contains('Amina Buyer').should('be.visible')
        cy.contains('Items: 2 items').should('be.visible')
        cy.contains('145.50').should('be.visible')
      })
  })
})
