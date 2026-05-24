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

const roleUserMap = {
  buyer: {
    id: 'buyer-001',
    email: 'buyer@greenmarket.test',
    profile: {
      id: 'buyer-001',
      role: 'buyer',
      first_name: 'Amina',
      last_name: 'Buyer',
      onboarding_completed: true,
      agreement_accepted: true,
      phone_verified: true,
    },
  },
  vendor: {
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
    },
  },
  admin: {
    id: 'admin-001',
    email: 'admin@greenmarket.test',
    profile: {
      id: 'admin-001',
      role: 'admin',
      first_name: 'Nadia',
      last_name: 'Admin',
      onboarding_completed: true,
      agreement_accepted: true,
      phone_verified: true,
    },
  },
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

const parseUserIdFromQuery = (searchParams) => {
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

const setupCommonInterceptions = () => {
  cy.intercept('GET', '**/functions/v1/get-public-config', {
    statusCode: 200,
    body: defaultPublicConfig,
  }).as('getPublicConfig')

  cy.intercept('**/storage/v1/**', {
    statusCode: 200,
    body: { message: 'ok' },
  }).as('storageMock')

  cy.intercept('OPTIONS', '**/auth/v1/**', { statusCode: 200, body: {} }).as('authOptions')
  cy.intercept('OPTIONS', '**/rest/v1/**', { statusCode: 200, body: {} }).as('restOptions')
  cy.intercept('OPTIONS', '**/functions/v1/**', { statusCode: 200, body: {} }).as('functionsOptions')
}

const setupAuthInterceptions = ({
  role = 'buyer',
  loginSuccess = true,
  mfaEnabled = false,
}) => {
  const userData = roleUserMap[role]
  const accessToken = createMockJwt(userData.id, userData.email)
  const refreshToken = `refresh-${userData.id}`

  setupCommonInterceptions()

  cy.intercept('POST', '**/functions/v1/secure-login', (req) => {
    if (!loginSuccess) {
      req.reply({
        statusCode: 200,
        body: {
          success: false,
          error: 'Invalid login credentials',
        },
      })
      return
    }

    req.reply({
      statusCode: 200,
      body: {
        success: true,
        session: {
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      },
    })
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
        id: userData.id,
        email: userData.email,
        role: 'authenticated',
      },
    },
  }).as('authToken')

  cy.intercept('GET', '**/auth/v1/user*', {
    statusCode: 200,
    body: {
      id: userData.id,
      email: userData.email,
      role: 'authenticated',
    },
  }).as('authUser')

  cy.intercept('POST', '**/auth/v1/logout*', {
    statusCode: 204,
    body: {},
  }).as('authLogout')

  cy.intercept('GET', '**/rest/v1/**', (req) => {
    const url = new URL(req.url)
    const path = url.pathname

    if (path.endsWith('/profiles')) {
      const requestedId = parseUserIdFromQuery(url.searchParams)
      const matchedProfile = Object.values(roleUserMap)
        .map((entry) => entry.profile)
        .find((profile) => profile.id === requestedId) || userData.profile

      if (requestedId) {
        req.reply({
          statusCode: 200,
          body: matchedProfile,
        })
        return
      }

      req.reply({
        statusCode: 200,
        body: [matchedProfile],
      })
      return
    }

    if (path.endsWith('/mfa_settings')) {
      const body = mfaEnabled
        ? [{ id: 'mfa-001', user_id: userData.id, is_enabled: true, method: 'email' }]
        : []
      req.reply({ statusCode: 200, body })
      return
    }

    if (path.endsWith('/active_sessions')) {
      req.reply({ statusCode: 200, body: [] })
      return
    }

    if (path.endsWith('/audit_logs') || path.endsWith('/security_events')) {
      req.reply({ statusCode: 200, body: [] })
      return
    }

    req.reply({ statusCode: 200, body: [] })
  }).as('supabaseRest')

  cy.intercept('POST', '**/rest/v1/**', {
    statusCode: 201,
    body: {},
  }).as('supabaseRestPost')

  cy.intercept('PATCH', '**/rest/v1/**', {
    statusCode: 200,
    body: {},
  }).as('supabaseRestPatch')
}

const performLogin = ({ email, password = 'Test@123456' }) => {
  cy.visit('/login')
  cy.get('input[type="email"]').clear().type(email)
  cy.get('input[type="password"]').clear().type(password)
  cy.contains('button', /sign in|login|تسجيل الدخول|connexion/i).click()
  cy.wait('@secureLogin')
}

describe('Auth Flow And RBAC', () => {
  it('Buyer login redirects to the buyer role destination', () => {
    setupAuthInterceptions({ role: 'buyer' })

    performLogin({ email: roleUserMap.buyer.email })

    cy.location('pathname', { timeout: 15000 }).should((pathname) => {
      expect(pathname).to.match(/^\/buyer\//)
    })
  })

  it('Vendor login redirects to /vendor/dashboard', () => {
    setupAuthInterceptions({ role: 'vendor' })

    performLogin({ email: roleUserMap.vendor.email })

    cy.location('pathname', { timeout: 15000 }).should('eq', '/vendor/dashboard')
  })

  it('Wrong password shows an error and does not redirect', () => {
    setupAuthInterceptions({ role: 'buyer', loginSuccess: false })

    performLogin({
      email: roleUserMap.buyer.email,
      password: 'WrongPass1!',
    })

    cy.location('pathname').should('eq', '/login')
    cy.contains(/invalid email or password|invalid credentials/i).should('be.visible')
  })

  it('MFA required redirects to /mfa-verify and renders TwoFactor inputs', () => {
    setupAuthInterceptions({ role: 'vendor', mfaEnabled: true })

    performLogin({ email: roleUserMap.vendor.email })

    cy.location('pathname', { timeout: 15000 }).should('eq', '/mfa-verify')
    cy.get('#mfa-code-0').should('be.visible')
    cy.get('#mfa-code-5').should('be.visible')
  })

  it('Buyer visiting /vendor/dashboard is redirected to /unauthorized', () => {
    setupAuthInterceptions({ role: 'buyer' })

    performLogin({ email: roleUserMap.buyer.email })
    cy.visit('/vendor/dashboard')

    cy.location('pathname', { timeout: 15000 }).should('eq', '/unauthorized')
    cy.contains(/access denied|403/i).should('be.visible')
  })

  it('Admin page without auth redirects to /login', () => {
    setupCommonInterceptions()
    cy.clearLocalStorage()
    cy.clearCookies()

    cy.visit('/admin/dashboard')
    cy.location('pathname', { timeout: 15000 }).should('eq', '/login')
  })

  it('Sign out clears cart, lands on home, and protected buyer route redirects to /login', () => {
    setupAuthInterceptions({ role: 'buyer' })

    performLogin({ email: roleUserMap.buyer.email })

    cy.window().then((win) => {
      win.localStorage.setItem(
        'cart-storage',
        JSON.stringify({
          state: {
            items: [{ id: 'prod-001', name: 'Tomatoes', quantity: 2, vendor_id: 'vendor-001' }],
            lastValidated: null,
            checkoutVendorId: 'vendor-001',
          },
          version: 0,
        })
      )
    })

    cy.visit('/')
    cy.get('button[aria-expanded]').first().click()
    cy.contains('button', /sign out|logout|تسجيل الخروج|deconnexion/i).click()

    cy.location('pathname', { timeout: 15000 }).should('eq', '/')

    cy.window().then((win) => {
      const raw = win.localStorage.getItem('cart-storage')
      expect(raw, 'cart-storage should still be persisted').to.not.equal(null)
      const parsed = JSON.parse(raw)
      expect(parsed.state.items).to.have.length(0)
    })

    cy.visit('/buyer/dashboard')
    cy.location('pathname', { timeout: 15000 }).should('eq', '/login')
  })
})
