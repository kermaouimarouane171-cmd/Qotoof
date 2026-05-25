const APP_URL = Cypress.config('baseUrl') || 'http://localhost:5173'

const USERS = {
  buyer: {
    id: '11111111-1111-4111-8111-111111111111',
    email: Cypress.env('BUYER_EMAIL') || 'buyer@greenmarket.test',
    settingsPath: '/buyer/settings',
    profile: {
      id: '11111111-1111-4111-8111-111111111111',
      role: 'buyer',
      first_name: 'Amina',
      last_name: 'Buyer',
      onboarding_completed: true,
      email_notifications: true,
      order_updates: true,
      marketing_emails: false,
      data_sharing: false,
      phone: '+212611111111',
    },
  },
  vendor: {
    id: '22222222-2222-4222-8222-222222222222',
    email: Cypress.env('VENDOR_EMAIL') || 'vendor@greenmarket.test',
    settingsPath: '/vendor/settings',
    profile: {
      id: '22222222-2222-4222-8222-222222222222',
      role: 'vendor',
      first_name: 'Youssef',
      last_name: 'Vendor',
      onboarding_completed: true,
      store_name: 'Atlas Fresh',
      min_order_amount: 50,
      low_stock_threshold: 10,
      payment_policy_full: true,
      payment_policy_split: true,
      payment_policy_cod: false,
      notify_new_orders: true,
      notify_order_updates: true,
      notify_customer_messages: true,
      notify_low_stock: true,
      notify_reviews: true,
      store_paused: false,
    },
  },
  driver: {
    id: '33333333-3333-4333-8333-333333333333',
    email: Cypress.env('DRIVER_EMAIL') || 'driver@greenmarket.test',
    settingsPath: '/driver/settings',
    profile: {
      id: '33333333-3333-4333-8333-333333333333',
      role: 'driver',
      first_name: 'Hamza',
      last_name: 'Driver',
      onboarding_completed: true,
      vehicle_type: 'car',
      vehicle_plate: 'AA-123-BB',
      license_number: 'DL-7654',
      is_available_for_delivery: true,
      notify_new_deliveries: true,
      notify_order_updates: true,
      notify_customer_messages: true,
      min_delivery_distance_km: 1,
      max_delivery_distance_km: 25,
      accepted_cargo_sizes: ['small', 'medium'],
      driver_delivery_payment_cash: true,
      driver_delivery_payment_transfer: true,
      driver_delivery_payment_notes: 'Default',
    },
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

const setupAuthenticatedInterceptors = (role) => {
  const userData = USERS[role]
  const accessToken = createMockJwt(userData.id, userData.email)
  const refreshToken = `refresh-${userData.id}`
  const authUser = buildAuthUser({ id: userData.id, email: userData.email })

  setupPublicConfigInterceptors()

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
    body: userData.profile,
  }).as('profileFetch')

  cy.intercept('PATCH', '**/rest/v1/profiles*', {
    statusCode: 200,
    body: {},
  }).as('profilePatch')

  cy.intercept('POST', '**/rest/v1/profiles*', {
    statusCode: 201,
    body: {},
  }).as('profilePost')

  cy.intercept('GET', '**/rest/v1/user_settings*', {
    statusCode: 200,
    body: {
      user_id: userData.id,
      email_notifications: true,
      sms_notifications: false,
      push_notifications: true,
      order_updates: true,
      promotional_emails: false,
      delivery_updates: true,
      show_phone_to_vendors: true,
      show_email_to_vendors: false,
    },
  }).as('userSettingsFetch')

  cy.intercept('POST', '**/rest/v1/user_settings*', {
    statusCode: 201,
    body: {},
  }).as('userSettingsUpsert')

  cy.intercept('GET', '**/rest/v1/cancellation_policies*', { statusCode: 200, body: [] })
  cy.intercept('GET', '**/rest/v1/refund_policies*', { statusCode: 200, body: [] })
  cy.intercept('POST', '**/rest/v1/cancellation_policies*', { statusCode: 201, body: {} }).as('cancelPolicyUpsert')
  cy.intercept('POST', '**/rest/v1/refund_policies*', { statusCode: 201, body: {} }).as('refundPolicyUpsert')

  cy.intercept('POST', '**/rest/v1/notifications*', { statusCode: 201, body: {} })
  cy.intercept('POST', '**/rest/v1/audit_logs*', { statusCode: 201, body: {} })
  cy.intercept('POST', '**/rest/v1/favorites*', { statusCode: 201, body: [] })
  cy.intercept('GET', '**/rest/v1/favorites*', { statusCode: 200, body: [] })
  cy.intercept('GET', '**/rest/v1/orders*', { statusCode: 200, body: [] })
  cy.intercept('PATCH', '**/rest/v1/products*', { statusCode: 200, body: [] }).as('productsPatch')
  cy.intercept('PATCH', '**/rest/v1/**', { statusCode: 200, body: {} })
  cy.intercept('POST', '**/rest/v1/**', { statusCode: 201, body: {} })
}

describe('Settings Pages - Buyer, Vendor, Driver', () => {
  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  it('buyer settings: updates notification + privacy preferences and opens delete modal flow guard', () => {
    setupAuthenticatedInterceptors('buyer')

    cy.loginAs('buyer')
    cy.visit(`${APP_URL}${USERS.buyer.settingsPath}`)
    cy.location('pathname', { timeout: 20000 }).should('eq', '/buyer/settings')

    cy.get('[role="switch"]').first().click()
    cy.contains(/Save Settings|حفظ الإعدادات/i).click()

    cy.get('[role="switch"]').eq(4).click()
    cy.contains(/Save Privacy Preferences|حفظ تفضيلات الخصوصية/i).click()

    cy.contains(/Delete My Account|حذف حسابي/i).click()
    cy.contains(/Delete Your Account|حذف حسابك/i).should('be.visible')
    cy.contains(/Continue|متابعة/i).click()
    cy.get('input[placeholder*="DELETE"]').type('DELETE')
    cy.contains(/Continue|متابعة/i).click()
    cy.contains(/Final Confirmation|التأكيد النهائي/i).should('be.visible')
  })

  it('vendor settings: edits store details, toggles emergency mode, then saves settings', () => {
    setupAuthenticatedInterceptors('vendor')

    cy.loginAs('vendor')
    cy.visit(`${APP_URL}${USERS.vendor.settingsPath}`)
    cy.location('pathname', { timeout: 20000 }).should('eq', '/vendor/settings')

    cy.get('input').first().clear().type('Atlas Fresh Prime')
    cy.get('input[type="number"]').first().clear().type('75')

    cy.get('textarea').first().clear().type('Maintenance window for inventory sync')
    cy.contains(/تفعيل وضع الطوارئ|Pause/i).click()
    cy.wait('@productsPatch')

    cy.contains(/إلغاء وضع الطوارئ|Resume/i).click()

    cy.contains(/Save Settings|حفظ الإعدادات/i).click()
    cy.wait('@profilePatch')
  })

  it('driver settings: updates vehicle + availability preferences and saves', () => {
    setupAuthenticatedInterceptors('driver')

    cy.loginAs('driver')
    cy.visit(`${APP_URL}${USERS.driver.settingsPath}`)
    cy.location('pathname', { timeout: 20000 }).should('eq', '/driver/settings')

    cy.get('select').first().select('van')
    cy.get('input[placeholder="ABC-1234"]').clear().type('DR-5555')
    cy.get('input[placeholder="DL-123456"]').clear().type('DL-2026-77')

    cy.get('#driver-available-for-delivery').click()
    cy.get('#driver-notify-new-deliveries').click()

    cy.contains(/Save Settings|حفظ الإعدادات/i).click()
    cy.wait('@profilePatch')
  })

  it('settings routes are protected for unauthenticated visitors', () => {
    setupPublicConfigInterceptors()

    cy.visit(`${APP_URL}/buyer/settings`)
    cy.location('pathname', { timeout: 15000 }).should('eq', '/login')

    cy.visit(`${APP_URL}/vendor/settings`)
    cy.location('pathname', { timeout: 15000 }).should('eq', '/login')

    cy.visit(`${APP_URL}/driver/settings`)
    cy.location('pathname', { timeout: 15000 }).should('eq', '/login')
  })
})
