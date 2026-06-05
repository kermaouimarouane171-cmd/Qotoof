describe('Page Health + UX Checks — Auth Pages', () => {
  // ─── Helpers ───
  const assertBodyNotEmpty = () => {
    cy.get('body').should('not.be.empty')
  }

  const assertNoAppCrash = () => {
    cy.get('#root').should('exist')
    cy.get('body').should('not.contain', 'Error Boundary')
    cy.get('body').should('not.contain', 'Something went wrong')
  }

  const assertNoWhiteScreen = () => {
    assertBodyNotEmpty()
    assertNoAppCrash()
  }

  const assertUserSeesAuthPurpose = () => {
    // Page should have a clear heading or context about authentication
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text()
      return /Login|Sign In|تسجيل الدخول|Connexion|Register|Sign Up|إنشاء حساب|Inscription/i.test(text)
    })
  }

  const assertUserGetsFeedbackAfterInvalidSubmit = () => {
    // After submitting empty/invalid form, user should see some feedback:
    // validation message, disabled state, error banner, or URL stays the same
    cy.location('pathname').should('satisfy', (pathname) =>
      pathname.includes('/login') || pathname.includes('/register')
    )
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text()
      const hasErrorText = /error|required|invalid|يرجى|الحقل| mandatory |obligatoire/i.test(text)
      const hasValidationAttr = $body.find('[aria-invalid="true"]').length > 0
      return hasErrorText || hasValidationAttr
    })
  }

  const interceptIncidentalAuth = () => {
    cy.intercept('GET', '**/functions/v1/get-public-config', {
      statusCode: 200,
      body: {
        supabase: { url: 'https://test-project.supabase.co', anonKey: 'test-anon-key' },
        sentry: { dsn: null },
        recaptcha: { siteKey: null },
        features: { enableDriverTracking: false },
        app: { name: 'Qotoof', version: '1.0.0' },
      },
    }).as('getPublicConfig')

    cy.intercept('OPTIONS', '**/auth/v1/**', { statusCode: 200, body: {} })
    cy.intercept('OPTIONS', '**/rest/v1/**', { statusCode: 200, body: {} })
    cy.intercept('OPTIONS', '**/functions/v1/**', { statusCode: 200, body: {} })

    // Intercept any accidental real auth calls so they never hit Supabase
    cy.intercept('POST', '**/auth/v1/signup*', { statusCode: 200, body: { id: 'test-user', email: 'test@example.com' } }).as('authSignup')
    cy.intercept('POST', '**/auth/v1/token*', { statusCode: 200, body: { access_token: 'test-token', token_type: 'bearer', expires_in: 3600, user: { id: 'test-user', email: 'test@example.com' } } }).as('authToken')
    cy.intercept('POST', '**/auth/v1/logout*', { statusCode: 204, body: {} }).as('authLogout')
  }

  beforeEach(() => {
    cy.window().then((win) => {
      win.localStorage.removeItem('sb-oyaiiyekfkflesdmcvvo-auth-token')
      win.localStorage.removeItem('auth-store')
      win.localStorage.removeItem('cart-storage')
      win.localStorage.removeItem('qotoof_cart')
      win.sessionStorage.clear()
    })
    interceptIncidentalAuth()
  })

  // ═══════════════════════════════════════════════
  // LOGIN — Page Health
  // ═══════════════════════════════════════════════

  it('[Health] /login opens without white screen or crash', () => {
    cy.visit('/login')
    cy.location('pathname').should('eq', '/login')
    assertNoWhiteScreen()
  })

  it('[Health] /login shows a visible form and submit button', () => {
    cy.visit('/login')
    cy.get('[data-testid="login-form"]').should('be.visible')
    cy.get('[data-testid="login-submit-button"]').should('be.visible').and('not.be.disabled')
    assertNoWhiteScreen()
  })

  it('[Health] submitting empty login does not crash the page', () => {
    cy.visit('/login')
    cy.get('[data-testid="login-submit-button"]').click()
    assertNoWhiteScreen()
    cy.location('pathname').should('eq', '/login')
  })

  it('[UX] /login clearly identifies itself as a login page', () => {
    cy.visit('/login')
    assertUserSeesAuthPurpose()
    assertNoWhiteScreen()
  })

  it('[UX] /login shows understandable email/password labels or placeholders', () => {
    cy.visit('/login')
    // Labels may render inside child components; check the whole page
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text()
      return /Email|البريد|e-mail|Password|كلمة المرور|mot de passe/i.test(text)
    })
    assertNoWhiteScreen()
  })

  it('[UX] submitting empty login gives visible feedback to the user', () => {
    cy.visit('/login')
    cy.get('[data-testid="login-submit-button"]').click()
    assertUserGetsFeedbackAfterInvalidSubmit()
    assertNoWhiteScreen()
  })

  it('[UX] /login has a clear path to register', () => {
    cy.visit('/login')
    cy.contains(/Sign up|إنشاء حساب|Créer un compte|Register/i).should('be.visible').click()
    cy.location('pathname').should('include', '/register')
    assertNoWhiteScreen()
  })

  it('[UX] /login has a working forgot-password link if present', () => {
    cy.visit('/login')
    cy.get('body').then(($body) => {
      const $link = $body.find('[data-testid="forgot-password-link"]')
      if ($link.length === 0) {
        cy.log('Forgot-password link not found — skipping navigation assertion')
        assertNoWhiteScreen()
        return
      }
      cy.wrap($link).click()
      cy.location('pathname').should('include', '/forgot-password')
      assertNoWhiteScreen()
    })
  })

  // ═══════════════════════════════════════════════
  // REGISTER — Page Health
  // ═══════════════════════════════════════════════

  it('[Health] /register opens without white screen or crash', () => {
    cy.visit('/register')
    cy.location('pathname').should('eq', '/register')
    assertNoWhiteScreen()
  })

  it('[Health] /register shows a visible form and action button', () => {
    cy.visit('/register')
    cy.get('[data-testid="register-form"]').should('be.visible')
    // On step 1 the next button is visible; submit button only appears on step 4
    cy.get('[data-testid="register-next-button"]').should('be.visible')
    assertNoWhiteScreen()
  })

  it('[Health] submitting empty register does not crash the page', () => {
    cy.visit('/register')
    cy.get('[data-testid="register-next-button"]').click()
    assertNoWhiteScreen()
    cy.location('pathname').should('eq', '/register')
  })

  it('[UX] /register clearly identifies itself as a registration page', () => {
    cy.visit('/register')
    assertUserSeesAuthPurpose()
    assertNoWhiteScreen()
  })

  it('[UX] /register shows understandable basic fields', () => {
    cy.visit('/register')
    // Basic fields appear on step 2; navigate there first
    cy.get('[data-testid="register-role-buyer"]').click()
    cy.get('[data-testid="register-next-button"]').click()
    cy.get('[data-testid="register-step-2"]').should('exist')
    // Check that the form contains recognizable field labels
    cy.get('body').should('satisfy', ($body) => {
      const text = $body.text()
      return /Email|البريد|e-mail|Password|كلمة المرور|mot de passe|Name|الاسم|nom/i.test(text)
    })
    assertNoWhiteScreen()
  })

  it('[UX] role choices are visible and understandable', () => {
    cy.visit('/register')
    cy.get('[data-testid="register-role-buyer"]').should('be.visible')
    cy.get('[data-testid="register-role-vendor"]').should('be.visible')
    cy.get('[data-testid="register-role-driver"]').should('be.visible')
    assertNoWhiteScreen()
  })

  it('[UX] selecting vendor role does not break the page and shows clear next step', () => {
    cy.visit('/register')
    cy.get('[data-testid="register-role-vendor"]').click()
    cy.get('[data-testid="register-role-vendor"]').should('have.class', 'border-green-500')
    cy.get('[data-testid="register-next-button"]').click()
    // Step 2 should appear without crash
    cy.get('[data-testid="register-step-2"]').should('exist')
    assertNoWhiteScreen()
  })

  it('[UX] submitting without selecting role gives visible feedback', () => {
    cy.visit('/register')
    cy.get('[data-testid="register-next-button"]').click()
    assertUserGetsFeedbackAfterInvalidSubmit()
    assertNoWhiteScreen()
  })

  it('[UX] /register has a clear path back to login', () => {
    cy.visit('/register')
    cy.contains(/تسجيل الدخول|Log in|Connexion|Sign in/i).should('be.visible').click()
    cy.location('pathname').should('include', '/login')
    assertNoWhiteScreen()
  })
})
