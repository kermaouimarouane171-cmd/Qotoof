const APP_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

const USERS = {
  buyer: {
    id: '11111111-1111-4111-8111-111111111111',
    email: Cypress.env('BUYER_EMAIL') || 'buyer@greenmarket.test',
    password: Cypress.env('BUYER_PASSWORD') || 'Test@123456',
    onboardingPath: '/onboarding/buyer',
    completePath: '/buyer/dashboard',
    slidesCount: 3,
  },
  vendor: {
    id: '22222222-2222-4222-8222-222222222222',
    email: Cypress.env('VENDOR_EMAIL') || 'vendor@greenmarket.test',
    password: Cypress.env('VENDOR_PASSWORD') || 'Test@123456',
    onboardingPath: '/onboarding/vendor',
    completePath: '/vendor/digital-contract',
    slidesCount: 4,
  },
  driver: {
    id: '33333333-3333-4333-8333-333333333333',
    email: Cypress.env('DRIVER_EMAIL') || 'driver@greenmarket.test',
    password: Cypress.env('DRIVER_PASSWORD') || 'Test@123456',
    onboardingPath: '/onboarding/driver',
    completePath: '/driver/settings',
    slidesCount: 3,
  },
}

const createMockJwt = (userId, email) => {
  const toBase64Url = (payload) => Cypress.Buffer
    .from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

  const header = toBase64Url({ alg: 'HS256', typ: 'JWT' })
  const body = toBase64Url({ sub: userId, email, exp: 4102444800, iat: 1700000000 })

  return `${header}.${body}.signature`
}

const buildAuthUser = ({ id, email }) => ({
  id,
  aud: 'authenticated',
  role: 'authenticated',
  email,
  email_confirmed_at: '2025-01-01T00:00:00.000Z',
  phone: '+212600000000',
  confirmed_at: '2025-01-01T00:00:00.000Z',
  last_sign_in_at: '2025-01-01T00:00:00.000Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  identities: [],
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
})

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

const setupRoleInterceptors = ({ role, onboardingCompleted = false, onboardingStep = 0 }) => {
  const user = USERS[role]
  const accessToken = createMockJwt(user.id, user.email)
  const refreshToken = `refresh-${user.id}`
  const authUser = buildAuthUser({ id: user.id, email: user.email })

  setupPublicInterceptors()

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
      expires_at: 4102444800,
      user: authUser,
    },
  }).as('authToken')

  cy.intercept('GET', '**/auth/v1/user*', {
    statusCode: 200,
    body: authUser,
  }).as('authUser')

  cy.intercept('GET', '**/rest/v1/profiles*', {
    statusCode: 200,
    body: {
      id: user.id,
      role,
      first_name: role,
      last_name: 'tester',
      onboarding_completed: onboardingCompleted,
      onboarding_step: onboardingStep,
    },
  }).as('profileFetch')

  cy.intercept('PATCH', '**/rest/v1/profiles*', {
    statusCode: 200,
    body: {},
  }).as('profilePatch')

  cy.intercept('POST', '**/rest/v1/profiles*', {
    statusCode: 201,
    body: {},
  }).as('profilePost')

  cy.intercept('GET', '**/rest/v1/**', { statusCode: 200, body: [] })
  cy.intercept('POST', '**/rest/v1/**', { statusCode: 201, body: {} })
}

const loginWithoutAutoOnboarding = (role) => {
  const user = USERS[role]

  cy.visit(`${APP_URL}/login`)
  cy.get('[data-testid="login-email-input"]').clear().type(user.email)
  cy.get('[data-testid="login-password-input"]').clear().type(user.password)
  cy.get('[data-testid="login-submit-button"]').click()
  cy.wait('@secureLogin')
}

const expectRedirectToLogin = (path) => {
  cy.visit(`${APP_URL}${path}`)
  cy.location('pathname', { timeout: 15000 }).should('eq', '/login')
  cy.contains(/Welcome back|Sign In|تسجيل الدخول/i).should('be.visible')
}

describe('Onboarding Flow - Complete E2E', () => {
  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  it('redirects unauthenticated users from onboarding routes to /login', () => {
    setupPublicInterceptors()
    expectRedirectToLogin('/onboarding/buyer')
    expectRedirectToLogin('/onboarding/vendor')
    expectRedirectToLogin('/onboarding/driver')
  })

  ;['buyer', 'vendor', 'driver'].forEach((roleKey) => {
    it(`completes ${roleKey} onboarding and redirects to role destination`, () => {
      const role = USERS[roleKey]
      setupRoleInterceptors({ role: roleKey, onboardingCompleted: false, onboardingStep: 0 })

      loginWithoutAutoOnboarding(roleKey)
      cy.location('pathname', { timeout: 20000 }).should('eq', role.onboardingPath)
      cy.get(`[data-testid="onboarding-${roleKey}"]`).should('be.visible')

      for (let step = 0; step < role.slidesCount - 1; step += 1) {
        cy.get('[data-testid="onboarding-primary-action"]').click()
      }

      cy.get('[data-testid="onboarding-primary-action"]').click()
      cy.location('pathname', { timeout: 20000 }).should('eq', role.completePath)
    })
  })

  it('allows going back to previous onboarding step for vendor', () => {
    setupRoleInterceptors({ role: 'vendor', onboardingCompleted: false, onboardingStep: 1 })
    loginWithoutAutoOnboarding('vendor')

    cy.location('pathname', { timeout: 20000 }).should('eq', '/onboarding/vendor')
    cy.get('[data-testid="onboarding-secondary-action"]').should('be.visible').click()
    cy.wait('@profilePatch')
  })

  it('prevents role mismatch route access by redirecting to correct onboarding path', () => {
    setupRoleInterceptors({ role: 'buyer', onboardingCompleted: false, onboardingStep: 0 })
    loginWithoutAutoOnboarding('buyer')

    cy.visit(`${APP_URL}/onboarding/vendor`)
    cy.location('pathname', { timeout: 15000 }).should('eq', '/onboarding/buyer')
  })
})
