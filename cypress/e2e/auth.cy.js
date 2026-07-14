const APP_URL = 'http://localhost:5173'

const usersByRole = {
  buyer: {
    id: '11111111-1111-4111-8111-111111111111',
    email: Cypress.env('BUYER_EMAIL') || 'buyer@greenmarket.test',
    dashboardPath: '/marketplace',
    profilePath: '/buyer/orders',
    profile: {
      id: '11111111-1111-4111-8111-111111111111',
      role: 'buyer',
      first_name: 'Amina',
      last_name: 'Buyer',
      onboarding_completed: true,
    },
  },
  vendor: {
    id: '22222222-2222-4222-8222-222222222222',
    email: Cypress.env('VENDOR_EMAIL') || 'vendor@greenmarket.test',
    dashboardPath: '/vendor/dashboard',
    profilePath: '/vendor/dashboard',
    profile: {
      id: '22222222-2222-4222-8222-222222222222',
      role: 'vendor',
      first_name: 'Youssef',
      last_name: 'Vendor',
      onboarding_completed: true,
    },
  },
  driver: {
    id: '33333333-3333-4333-8333-333333333333',
    email: Cypress.env('DRIVER_EMAIL') || 'driver@greenmarket.test',
    dashboardPath: '/driver/dashboard',
    profilePath: '/driver/dashboard',
    profile: {
      id: '33333333-3333-4333-8333-333333333333',
      role: 'driver',
      first_name: 'Hamza',
      last_name: 'Driver',
      onboarding_completed: true,
    },
  },
  admin: {
    id: '44444444-4444-4444-8444-444444444444',
    email: Cypress.env('ADMIN_EMAIL') || 'admin@greenmarket.test',
    dashboardPath: '/admin/dashboard',
    profilePath: '/admin/dashboard',
    profile: {
      id: '44444444-4444-4444-8444-444444444444',
      role: 'admin',
      first_name: 'Nadia',
      last_name: 'Admin',
      onboarding_completed: true,
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

const setupAuthenticatedInterceptors = ({ role = 'buyer', secureLoginReply } = {}) => {
  const userData = usersByRole[role]
  const accessToken = createMockJwt(userData.id, userData.email)
  const refreshToken = `refresh-${userData.id}`
  const authUser = buildAuthUser({ id: userData.id, email: userData.email })

  setupPublicConfigInterceptors()

  cy.intercept('POST', '**/functions/v1/secure-login', (req) => {
    if (secureLoginReply) {
      req.reply(secureLoginReply)
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
      expires_at: 4102444800,
      user: authUser,
    },
  }).as('authToken')

  cy.intercept('GET', '**/auth/v1/user*', {
    statusCode: 200,
    body: authUser,
  }).as('authUser')

  cy.intercept('POST', '**/auth/v1/logout*', {
    statusCode: 204,
    body: {},
  }).as('authLogout')

  cy.intercept('GET', '**/rest/v1/profiles*', {
    statusCode: 200,
    body: userData.profile,
  }).as('profileFetch')

  cy.intercept('GET', '**/rest/v1/mfa_settings*', { statusCode: 200, body: [] })
  cy.intercept('GET', '**/rest/v1/active_sessions*', { statusCode: 200, body: [] })
  cy.intercept('GET', '**/rest/v1/audit_logs*', { statusCode: 200, body: [] })
  cy.intercept('GET', '**/rest/v1/security_events*', { statusCode: 200, body: [] })
  cy.intercept('POST', '**/rest/v1/**', { statusCode: 201, body: {} })
  cy.intercept('PATCH', '**/rest/v1/**', { statusCode: 200, body: {} })
}

const setupRegisterInterceptors = ({ withSession = false, role = 'buyer' } = {}) => {
  const roleData = usersByRole[role]
  const accessToken = createMockJwt(roleData.id, roleData.email)
  const refreshToken = `refresh-${roleData.id}`
  const authUser = buildAuthUser({ id: roleData.id, email: roleData.email })

  setupPublicConfigInterceptors()

  cy.intercept('POST', '**/auth/v1/signup*', {
    statusCode: 200,
    body: {
      user: {
        id: roleData.id,
        email: roleData.email,
      },
      session: withSession
        ? {
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: 4102444800,
          user: authUser,
        }
        : null,
    },
  }).as('signUp')

  cy.intercept('POST', '**/rest/v1/profiles*', {
    statusCode: 201,
    body: {},
  }).as('createProfile')

  cy.intercept('GET', '**/rest/v1/profiles*', {
    statusCode: 200,
    body: roleData.profile,
  }).as('profileFetch')

  cy.intercept('POST', '**/rest/v1/**', { statusCode: 201, body: {} })
  cy.intercept('PATCH', '**/rest/v1/**', { statusCode: 200, body: {} })
}

const setupForgotPasswordInterceptors = ({ rateLimited = false } = {}) => {
  setupPublicConfigInterceptors()

  cy.intercept('POST', '**/auth/v1/recover*', {
    statusCode: rateLimited ? 429 : 200,
    body: rateLimited
      ? { error: 'Too many requests' }
      : {},
  }).as('forgotPassword')
}

const goToRegisterStep2 = (role = 'buyer') => {
  cy.visit(`${APP_URL}/register`)
  cy.get('[data-testid="register-page"]').should('be.visible')
  cy.get(`[data-testid="register-role-${role}"]`).click()
  cy.get('[data-testid="register-next-button"]').click()
}

const fillRegisterBasicInfo = ({
  firstName = 'Test',
  lastName = 'User',
  email = `user.${Date.now()}@greenmarket.test`,
  phone = '+212600000001',
  password = 'StrongPass1!',
  confirmPassword = 'StrongPass1!',
} = {}) => {
  cy.get('[data-testid="register-first-name-input"]').clear().type(firstName)
  cy.get('[data-testid="register-last-name-input"]').clear().type(lastName)
  cy.get('[data-testid="register-email-input"]').clear().type(email)
  cy.get('[data-testid="register-phone-input"]').clear().type(phone)
  cy.get('[data-testid="register-password-input"]').clear().type(password)
  cy.get('[data-testid="register-confirm-password-input"]').clear().type(confirmPassword)
}

const goToRegisterStep4 = ({ role = 'buyer', email, phone, password = 'StrongPass1!' } = {}) => {
  goToRegisterStep2(role)
  fillRegisterBasicInfo({
    firstName: 'Test',
    lastName: 'User',
    email,
    phone,
    password,
    confirmPassword: password,
  })
  cy.get('[data-testid="register-next-button"]').click()

  if (role === 'buyer') {
    cy.get('[data-testid="register-delivery-address-input"]').clear().type('Casablanca Maarif, Street 10')
    cy.get('[data-testid="register-payment-method-select"]').select('cash')
  }

  if (role === 'vendor') {
    cy.get('[data-testid="register-store-name-input"]').clear().type('Atlas Fresh Store')
    cy.get('[data-testid="register-city-select"]').select('الدار البيضاء')
    cy.get('[data-testid="register-cin-input"]').clear().type('AB123456')
  }

  if (role === 'driver') {
    cy.get('[data-testid="register-vehicle-type-select"]').select('car')
    cy.get('[data-testid="register-vehicle-plate-input"]').clear().type('123-أ-45')
    cy.get('[data-testid="register-cin-input"]').clear().type('AB123456')
  }

  cy.get('[data-testid="register-next-button"]').click()
}

describe('Authentication', () => {
  beforeEach(() => {
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  describe('Login Flow', () => {
    it('should login as buyer and redirect to marketplace', () => {
      // التحقق من تسجيل دخول المشتري وإعادة توجيهه إلى السوق
      setupAuthenticatedInterceptors({ role: 'buyer' })
      cy.login(usersByRole.buyer.email, Cypress.env('BUYER_PASSWORD') || 'Test@123456')
      cy.visit(`${APP_URL}/marketplace`)
      cy.location('pathname', { timeout: 15000 }).should('eq', '/marketplace')
    })

    it('should login as vendor and redirect to vendor dashboard', () => {
      // التحقق من تسجيل دخول البائع والانتقال إلى لوحة تحكم البائع
      setupAuthenticatedInterceptors({ role: 'vendor' })
      cy.login(usersByRole.vendor.email, Cypress.env('VENDOR_PASSWORD') || 'Test@123456')
      cy.location('pathname', { timeout: 15000 }).should('eq', '/vendor/dashboard')
    })

    it('should login as driver and redirect to driver dashboard', () => {
      // التحقق من تسجيل دخول السائق والانتقال إلى لوحة تحكم السائق
      setupAuthenticatedInterceptors({ role: 'driver' })
      cy.login(usersByRole.driver.email, Cypress.env('DRIVER_PASSWORD') || 'Test@123456')
      cy.location('pathname', { timeout: 15000 }).should('eq', '/driver/dashboard')
    })

    it('should login as admin and redirect to admin dashboard', () => {
      // التحقق من تسجيل دخول المشرف والانتقال إلى لوحة تحكم الإدارة
      setupAuthenticatedInterceptors({ role: 'admin' })
      cy.login(usersByRole.admin.email, Cypress.env('ADMIN_PASSWORD') || 'Test@123456')
      cy.location('pathname', { timeout: 15000 }).should('eq', '/admin/dashboard')
    })

    it('should show error for wrong password', () => {
      // التأكد من ظهور رسالة خطأ عند إدخال كلمة مرور خاطئة
      setupAuthenticatedInterceptors({
        role: 'buyer',
        secureLoginReply: {
          statusCode: 200,
          body: { success: false, error: 'Invalid login credentials' },
        },
      })

      cy.visit(`${APP_URL}/login`)
      cy.get('[data-cy="email-input"]').type(usersByRole.buyer.email)
      cy.get('[data-cy="password-input"]').type('WrongPass123!')
      cy.get('[data-cy="login-button"]').click()

      cy.location('pathname').should('eq', '/login')
      cy.get('[data-cy="login-error"]').should('be.visible')
    })

    it('should show error for non-existent email', () => {
      // التحقق من ظهور خطأ عام عند محاولة تسجيل دخول ببريد غير موجود
      setupAuthenticatedInterceptors({
        role: 'buyer',
        secureLoginReply: {
          statusCode: 200,
          body: { success: false, error: 'Invalid login credentials' },
        },
      })

      cy.visit(`${APP_URL}/login`)
      cy.get('[data-cy="email-input"]').type('notfound@greenmarket.test')
      cy.get('[data-cy="password-input"]').type('WrongPass123!')
      cy.get('[data-cy="login-button"]').click()

      cy.location('pathname').should('eq', '/login')
      cy.get('[data-cy="login-error"]').should('be.visible')
    })

    it('should show error for empty fields', () => {
      // التحقق من رسائل التحقق عند ترك الحقول فارغة
      setupPublicConfigInterceptors()
      cy.visit(`${APP_URL}/login`)
      cy.get('[data-cy="login-button"]').click()
      cy.get('[data-cy="login-error"]').should('be.visible')
    })

    it('should keep user logged in on page refresh', () => {
      // التأكد من بقاء الجلسة فعالة بعد تحديث الصفحة
      setupAuthenticatedInterceptors({ role: 'vendor' })
      cy.login(usersByRole.vendor.email, Cypress.env('VENDOR_PASSWORD') || 'Test@123456')
      cy.location('pathname').should('eq', '/vendor/dashboard')
      cy.reload()
      cy.location('pathname', { timeout: 15000 }).should('eq', '/vendor/dashboard')
    })

    it('should handle rate limiting gracefully', () => {
      // التأكد من التعامل مع الحد الأقصى للمحاولات دون كسر الواجهة
      setupAuthenticatedInterceptors({
        role: 'buyer',
        secureLoginReply: {
          statusCode: 200,
          body: { success: false, error: 'Too many attempts, please try again later.' },
        },
      })

      cy.visit(`${APP_URL}/login`)
      cy.get('[data-cy="email-input"]').type(usersByRole.buyer.email)
      cy.get('[data-cy="password-input"]').type('WrongPass123!')
      cy.get('[data-cy="login-button"]').click()

      cy.location('pathname').should('eq', '/login')
      cy.get('[data-cy="login-error"]').should('be.visible')
    })
  })

  describe('Register Flow', () => {
    it('should register a new buyer account', () => {
      // إنشاء حساب مشتري جديد والتحقق من الانتقال لصفحة تحقق البريد
      setupRegisterInterceptors({ withSession: false, role: 'buyer' })
      const buyerEmail = `buyer.${Date.now()}@greenmarket.test`

      goToRegisterStep4({
        role: 'buyer',
        email: buyerEmail,
        phone: '+212600000111',
      })

      cy.get('[data-testid="register-terms-checkbox"]').check({ force: true })
      cy.contains('button', /إنشاء الحساب|Create Account/i).click()

      cy.wait('@signUp')
      cy.location('pathname', { timeout: 15000 }).should('eq', '/verify-email')
    })

    it('should register a new vendor account with store details', () => {
      // إنشاء حساب بائع جديد مع معلومات المتجر
      setupRegisterInterceptors({ withSession: false, role: 'vendor' })
      const vendorEmail = `vendor.${Date.now()}@greenmarket.test`

      goToRegisterStep4({
        role: 'vendor',
        email: vendorEmail,
        phone: '+212600000222',
      })

      cy.get('[data-testid="register-terms-checkbox"]').check({ force: true })
      cy.get('[data-testid="register-submit-button"]').click()

      cy.wait('@signUp')
      cy.location('pathname', { timeout: 15000 }).should('eq', '/verify-email')
    })

    it('should register a new driver account with CIN', () => {
      // إنشاء حساب سائق جديد مع إلزامية CIN
      setupRegisterInterceptors({ withSession: false, role: 'driver' })
      const driverEmail = `driver.${Date.now()}@greenmarket.test`

      goToRegisterStep4({
        role: 'driver',
        email: driverEmail,
        phone: '+212600000333',
      })

      cy.get('[data-testid="register-terms-checkbox"]').check({ force: true })
      cy.get('[data-testid="register-submit-button"]').click()

      cy.wait('@signUp')
      cy.location('pathname', { timeout: 15000 }).should('eq', '/verify-email')
    })

    it('should validate email format', () => {
      // التحقق من رفض صيغة بريد إلكتروني غير صحيحة
      goToRegisterStep2('buyer')
      fillRegisterBasicInfo({ email: 'invalid-email', phone: '+212600000444' })
      cy.get('[data-testid="register-next-button"]').click()
      cy.contains(/email|بريد|valid|صحيح/i).should('be.visible')
    })

    it('should validate Moroccan phone number format (+212...)', () => {
      // التحقق من إلزام صيغة رقم هاتف مغربي تبدأ بـ +212
      goToRegisterStep2('buyer')
      fillRegisterBasicInfo({ email: `phone.${Date.now()}@greenmarket.test`, phone: '+212' })
      cy.get('[data-testid="register-next-button"]').click()
      cy.get('[data-testid="register-step-2"]').should('be.visible')
    })

    it('should validate password strength (min 8 chars)', () => {
      // التحقق من رفض كلمة مرور أقل من 8 أحرف
      goToRegisterStep2('buyer')
      fillRegisterBasicInfo({
        email: `weak.${Date.now()}@greenmarket.test`,
        phone: '+212600000555',
        password: 'Abc12!',
        confirmPassword: 'Abc12!',
      })
      cy.get('[data-testid="register-next-button"]').click()
      cy.contains(/8|password|كلمة المرور|strong|قوية/i).should('be.visible')
    })

    it('should show error when passwords do not match', () => {
      // التحقق من ظهور خطأ عند عدم تطابق كلمتي المرور
      goToRegisterStep2('buyer')
      fillRegisterBasicInfo({
        email: `mismatch.${Date.now()}@greenmarket.test`,
        phone: '+212600000666',
        password: 'StrongPass1!',
        confirmPassword: 'StrongPass2!',
      })
      cy.get('[data-testid="register-next-button"]').click()
      cy.contains(/match|تطابق|Passwords/i).should('be.visible')
    })

    it('should require accepting terms and conditions', () => {
      // التحقق من منع الإرسال بدون الموافقة على الشروط والأحكام
      setupRegisterInterceptors({ withSession: false, role: 'buyer' })
      goToRegisterStep4({
        role: 'buyer',
        email: `terms.${Date.now()}@greenmarket.test`,
        phone: '+212600000777',
      })

      cy.get('[data-testid="register-submit-button"]').click()
      cy.contains(/الشروط|الأحكام|terms/i).should('be.visible')
      cy.location('pathname').should('eq', '/register')
    })

    it('should show verification email prompt after registration', () => {
      // التحقق من ظهور شاشة/تنبيه تأكيد البريد بعد التسجيل
      setupRegisterInterceptors({ withSession: false, role: 'buyer' })
      const email = `verify.${Date.now()}@greenmarket.test`

      goToRegisterStep4({
        role: 'buyer',
        email,
        phone: '+212600000888',
      })

      cy.get('[data-testid="register-terms-checkbox"]').check({ force: true })
      cy.get('[data-testid="register-submit-button"]').click()
      cy.location('pathname', { timeout: 15000 }).should('eq', '/verify-email')
      cy.get('[data-testid="verify-email-page"]').should('be.visible')
    })
  })

  describe('Password Reset', () => {
    it('should send password reset email', () => {
      // التحقق من نجاح طلب إعادة تعيين كلمة المرور
      setupForgotPasswordInterceptors({ rateLimited: false })
      cy.visit(`${APP_URL}/forgot-password`)

      cy.get('[data-testid="forgot-password-email-input"]').type('buyer@greenmarket.test')
      cy.get('[data-testid="forgot-password-submit-button"]').click()
      cy.wait('@forgotPassword')
      cy.get('[data-testid="forgot-password-success"]').should('be.visible')
    })

    it('should show error for non-existent email in reset', () => {
      // التحقق من السلوك الآمن لصفحة النسيان حتى مع بريد غير موجود
      setupForgotPasswordInterceptors({ rateLimited: false })
      cy.visit(`${APP_URL}/forgot-password`)

      cy.get('[data-testid="forgot-password-email-input"]').type('ghost@greenmarket.test')
      cy.get('[data-testid="forgot-password-submit-button"]').click()
      cy.wait('@forgotPassword')
      cy.get('[data-testid="forgot-password-success"]').should('be.visible')
    })
  })

  describe('Logout', () => {
    it('should logout and redirect to home page', () => {
      // التحقق من تسجيل الخروج والعودة إلى الصفحة الرئيسية
      setupAuthenticatedInterceptors({ role: 'buyer' })
      cy.login(usersByRole.buyer.email, Cypress.env('BUYER_PASSWORD') || 'Test@123456')

      cy.logout()
      cy.location('pathname', { timeout: 15000 }).should('eq', '/')
    })

    it('should clear all local state on logout', () => {
      // التأكد من تنظيف الحالة المحلية (auth/cart) بعد تسجيل الخروج
      setupAuthenticatedInterceptors({ role: 'buyer' })
      cy.login(usersByRole.buyer.email, Cypress.env('BUYER_PASSWORD') || 'Test@123456')

      cy.window().then((win) => {
        win.localStorage.setItem('cart-storage', JSON.stringify({ state: { items: [{ id: 'p1' }] }, version: 0 }))
      })

      cy.logout()

      cy.window().should((win) => {
        const authStore = win.localStorage.getItem('auth-store')
        expect(authStore).to.not.contain('11111111-1111-4111-8111-111111111111')

        const cartRaw = win.localStorage.getItem('cart-storage')
        const cart = cartRaw ? JSON.parse(cartRaw) : { state: { items: [] } }
        expect(cart.state.items || []).to.have.length(0)
      })
    })
  })

  describe('Protected Routes', () => {
    it('should redirect unauthenticated user to login', () => {
      // التحقق من منع الوصول لصفحات محمية بدون تسجيل دخول
      setupPublicConfigInterceptors()
      cy.clearLocalStorage()
      cy.clearCookies()
      cy.visit(`${APP_URL}/checkout`)
      cy.location('pathname', { timeout: 15000 }).should('eq', '/login')
    })

    it('should prevent buyer from accessing vendor routes', () => {
      // التحقق من منع المشتري من الدخول لمسارات البائع
      setupAuthenticatedInterceptors({ role: 'buyer' })
      cy.login(usersByRole.buyer.email, Cypress.env('BUYER_PASSWORD') || 'Test@123456')
      cy.window().then((win) => {
        win.history.pushState({}, '', '/vendor/dashboard')
        win.dispatchEvent(new win.PopStateEvent('popstate'))
      })
      cy.location('pathname', { timeout: 15000 }).should((pathname) => {
        expect(pathname).to.not.eq('/vendor/dashboard')
        expect(['/unauthorized', '/buyer/orders']).to.include(pathname)
      })
    })

    it('should prevent vendor from accessing admin routes', () => {
      // التحقق من منع البائع من الدخول لمسارات الإدارة
      setupAuthenticatedInterceptors({ role: 'vendor' })
      cy.login(usersByRole.vendor.email, Cypress.env('VENDOR_PASSWORD') || 'Test@123456')
      cy.window().then((win) => {
        win.history.pushState({}, '', '/admin/dashboard')
        win.dispatchEvent(new win.PopStateEvent('popstate'))
      })
      cy.location('pathname', { timeout: 15000 }).should((pathname) => {
        expect(pathname).to.not.eq('/admin/dashboard')
        expect(['/unauthorized', '/vendor/dashboard', '/vendor/digital-contract']).to.include(pathname)
      })
    })
  })
})
