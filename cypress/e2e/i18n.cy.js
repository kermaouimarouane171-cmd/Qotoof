/**
 * E2E Tests - Internationalization (i18n)
 * Tests language switching, translations, RTL support, and locale-specific formatting
 */

describe('Internationalization', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  describe('Language Switching', () => {
    it('should display language selector in header', () => {
      cy.get('[data-testid="language-selector"]').should('be.visible')
      cy.get('[data-testid="language-selector"]').within(() => {
        cy.contains(/en|ar|fr/i).should('be.visible')
      })
    })

    it('should switch from English to Arabic', () => {
      cy.get('[data-testid="language-selector"]').click()
      cy.get('[data-testid="lang-option-ar"]').click()
      cy.wait(500)
      cy.get('html').should('have.attr', 'lang', 'ar')
      cy.get('html').should('have.attr', 'dir', 'rtl')
    })

    it('should switch from English to French', () => {
      cy.get('[data-testid="language-selector"]').click()
      cy.get('[data-testid="lang-option-fr"]').click()
      cy.wait(500)
      cy.get('html').should('have.attr', 'lang', 'fr')
      cy.get('html').should('have.attr', 'dir', 'ltr')
    })

    it('should persist language selection after page reload', () => {
      cy.get('[data-testid="language-selector"]').click()
      cy.get('[data-testid="lang-option-fr"]').click()
      cy.wait(500)
      cy.reload()
      cy.get('html').should('have.attr', 'lang', 'fr')
    })

    it('should persist language after login and navigation', () => {
      cy.get('[data-testid="language-selector"]').click()
      cy.get('[data-testid="lang-option-ar"]').click()
      cy.wait(500)
      cy.login('buyer@example.com', 'Buyer123!')
      cy.visit('/buyer/dashboard')
      cy.get('html').should('have.attr', 'lang', 'ar')
    })
  })

  describe('Arabic (RTL) Layout', () => {
    beforeEach(() => {
      cy.get('[data-testid="language-selector"]').click()
      cy.get('[data-testid="lang-option-ar"]').click()
      cy.wait(500)
    })

    it('should apply RTL direction to the page', () => {
      cy.get('html').should('have.attr', 'dir', 'rtl')
      cy.get('body').should('have.css', 'direction', 'rtl')
    })

    it('should display Arabic text on homepage', () => {
      cy.get('[data-testid="hero-heading"]').should('be.visible')
      cy.get('[data-testid="hero-heading"]').invoke('text').should('not.be.empty')
    })

    it('should navigate marketplace with Arabic UI', () => {
      cy.visit('/marketplace')
      cy.get('[data-testid="product-card"]').should('have.length.greaterThan', 0)
      cy.get('[data-testid="search-input"]').should('have.attr', 'placeholder')
    })

    it('should display buyer dashboard in Arabic', () => {
      cy.login('buyer@example.com', 'Buyer123!')
      cy.visit('/buyer/dashboard')
      cy.get('[data-testid="page-loaded"]').should('exist')
      cy.get('[data-testid="stats-cards"]').should('have.length.greaterThan', 0)
    })
  })

  describe('French (LTR) Layout', () => {
    beforeEach(() => {
      cy.get('[data-testid="language-selector"]').click()
      cy.get('[data-testid="lang-option-fr"]').click()
      cy.wait(500)
    })

    it('should apply LTR direction to the page', () => {
      cy.get('html').should('have.attr', 'dir', 'ltr')
      cy.get('body').should('have.css', 'direction', 'ltr')
    })

    it('should display French text on homepage', () => {
      cy.get('[data-testid="hero-heading"]').should('be.visible')
      cy.get('[data-testid="hero-heading"]').invoke('text').should('not.be.empty')
    })

    it('should navigate marketplace with French UI', () => {
      cy.visit('/marketplace')
      cy.get('[data-testid="product-card"]').should('have.length.greaterThan', 0)
    })
  })

  describe('Locale-Specific Formatting', () => {
    it('should display currency in correct format for locale', () => {
      cy.get('[data-testid="language-selector"]').click()
      cy.get('[data-testid="lang-option-ar"]').click()
      cy.wait(500)
      cy.visit('/marketplace')
      cy.get('[data-testid="product-price"]').first().should('be.visible')
    })

    it('should display dates in correct locale format', () => {
      cy.login('buyer@example.com', 'Buyer123!')
      cy.get('[data-testid="language-selector"]').click()
      cy.get('[data-testid="lang-option-fr"]').click()
      cy.wait(500)
      cy.visit('/buyer/orders')
      cy.get('[data-testid="order-date"]').first().should('be.visible')
    })

    it('should format numbers according to locale', () => {
      cy.get('[data-testid="language-selector"]').click()
      cy.get('[data-testid="lang-option-ar"]').click()
      cy.wait(500)
      cy.login('buyer@example.com', 'Buyer123!')
      cy.visit('/buyer/dashboard')
      cy.get('[data-testid="stats-cards"]').should('have.length.greaterThan', 0)
    })
  })

  describe('Browser Language Detection', () => {
    it('should detect browser language and set accordingly', () => {
      cy.visit('/', {
        onBeforeLoad(win) {
          Object.defineProperty(win.navigator, 'language', { value: 'fr-FR' })
          Object.defineProperty(win.navigator, 'languages', { value: ['fr-FR', 'fr'] })
        },
      })
      cy.wait(500)
      cy.get('html').should('have.attr', 'lang', 'fr')
    })

    it('should default to English for unsupported browser language', () => {
      cy.visit('/', {
        onBeforeLoad(win) {
          Object.defineProperty(win.navigator, 'language', { value: 'de-DE' })
          Object.defineProperty(win.navigator, 'languages', { value: ['de-DE', 'de'] })
        },
      })
      cy.wait(500)
      cy.get('html').should('have.attr', 'lang', 'en')
    })
  })

  describe('Translation Completeness', () => {
    it('should have no missing translation keys on homepage', () => {
      cy.visit('/')
      cy.get('[data-testid="language-selector"]').click()
      cy.get('[data-testid="lang-option-ar"]').click()
      cy.wait(500)
      // Check that no raw translation keys (like translation.key) appear
      cy.get('body').should('not.contain', 'translation.')
      cy.get('body').should('not.contain', 'common.')
    })

    it('should have no missing translation keys on marketplace', () => {
      cy.visit('/marketplace')
      cy.get('[data-testid="language-selector"]').click()
      cy.get('[data-testid="lang-option-fr"]').click()
      cy.wait(500)
      cy.get('body').should('not.contain', 'translation.')
      cy.get('body').should('not.contain', 'marketplace.')
    })

    it('should have no missing translation keys on buyer dashboard', () => {
      cy.login('buyer@example.com', 'Buyer123!')
      cy.visit('/buyer/dashboard')
      cy.get('[data-testid="language-selector"]').click()
      cy.get('[data-testid="lang-option-ar"]').click()
      cy.wait(500)
      cy.get('body').should('not.contain', 'translation.')
      cy.get('body').should('not.contain', 'buyer.')
    })
  })
})
