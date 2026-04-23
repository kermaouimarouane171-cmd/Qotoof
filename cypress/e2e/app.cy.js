// E2E Tests for Qotoof Application
// Run: npm run test:cypress

describe('Qotoof Application E2E Tests', () => {
  
  // ============================================
  // PUBLIC PAGES
  // ============================================
  
  describe('Public Pages', () => {
    it('should load home page successfully', () => {
      cy.visit('/')
      cy.get('h1').should('be.visible')
      cy.contains('Marketplace').should('be.visible')
    })

    it('should navigate to marketplace', () => {
      cy.visit('/marketplace')
      cy.get('h1').should('contain', 'Marketplace')
    })

    it('should search for products', () => {
      cy.visit('/marketplace')
      cy.get('input[type="text"]').first().type('طماطم')
      cy.get('input[type="text"]').first().type('{enter}')
      // Should not crash
      cy.url().should('include', 'search')
    })

    it('should view product details', () => {
      cy.visit('/marketplace')
      // Click first product if exists
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="product-card"]').length) {
          cy.get('[data-testid="product-card"]').first().click()
          cy.url().should('include', '/product/')
        }
      })
    })

    it('should load stores page', () => {
      cy.visit('/stores')
      cy.get('h1').should('contain', 'Stores')
    })

    it('should load about page', () => {
      cy.visit('/about')
      cy.get('h1').should('contain', 'About')
    })

    it('should load contact page', () => {
      cy.visit('/contact')
      cy.get('h1').should('contain', 'Contact')
    })
  })

  // ============================================
  // AUTHENTICATION
  // ============================================
  
  describe('Authentication', () => {
    it('should show login page', () => {
      cy.visit('/login')
      cy.get('input[type="email"]').should('be.visible')
      cy.get('input[type="password"]').should('be.visible')
    })

    it('should show register page', () => {
      cy.visit('/register')
      cy.get('input[type="email"]').should('be.visible')
    })

    it('should navigate between login and register', () => {
      cy.visit('/login')
      cy.contains('Register').click()
      cy.url().should('include', '/register')
      
      cy.visit('/register')
      cy.contains('Login').click()
      cy.url().should('include', '/login')
    })
  })

  // ============================================
  // CART FUNCTIONALITY
  // ============================================
  
  describe('Cart', () => {
    it('should load empty cart', () => {
      cy.visit('/cart')
      // Should show empty state or cart page
      cy.url().should('include', '/cart')
    })
  })

  // ============================================
  // CHECKOUT (Protected)
  // ============================================
  
  describe('Checkout', () => {
    beforeEach(() => {
      // Login as test user
      cy.visit('/login')
      // Note: Actual login would require test credentials
    })

    it('should redirect to login if not authenticated', () => {
      cy.visit('/checkout')
      cy.url().should('include', '/login')
    })
  })

  // ============================================
  // MOBILE RESPONSIVENESS
  // ============================================
  
  describe('Mobile Responsiveness', () => {
    const mobileViewports = [
      { width: 375, height: 667, name: 'iPhone X' },
      { width: 414, height: 736, name: 'iPhone 6/7/8 Plus' },
      { width: 360, height: 640, name: 'Android' },
    ]

    mobileViewports.forEach((viewport) => {
      it(`should display home page on ${viewport.name}`, () => {
        cy.viewport(viewport.width, viewport.height)
        cy.visit('/')
        cy.get('h1').should('be.visible')
      })

      it(`should display marketplace on ${viewport.name}`, () => {
        cy.viewport(viewport.width, viewport.height)
        cy.visit('/marketplace')
        cy.get('h1').should('be.visible')
      })
    })
  })

  // ============================================
  // NAVIGATION
  // ============================================
  
  describe('Navigation', () => {
    it('should navigate using header links', () => {
      cy.visit('/')
      
      // Test main navigation
      cy.contains('Marketplace').click()
      cy.url().should('include', '/marketplace')
      
      cy.visit('/')
      cy.contains('Stores').click()
      cy.url().should('include', '/stores')
    })

    it('should navigate using footer links', () => {
      cy.visit('/')
      
      // Scroll to footer
      cy.get('footer').scrollIntoView()
      
      // Test footer links
      cy.contains('About').click()
      cy.url().should('include', '/about')
    })
  })

  // ============================================
  // ERROR HANDLING
  // ============================================
  
  describe('Error Handling', () => {
    it('should show 404 for invalid routes', () => {
      cy.visit('/this-page-does-not-exist')
      // Should redirect to 404 or home
      cy.url().should('not.contain', '/this-page-does-not-exist')
    })

    it('should handle network errors gracefully', () => {
      cy.intercept('GET', '**/products*', { forceNetworkError: true }).as('productsError')
      cy.visit('/marketplace')
      // Should not crash completely
      cy.get('body').should('exist')
    })
  })

  // ============================================
  // PERFORMANCE
  // ============================================
  
  describe('Performance', () => {
    it('should load home page within 3 seconds', () => {
      const start = Date.now()
      cy.visit('/')
      cy.get('h1').should('be.visible')
      const loadTime = Date.now() - start
      expect(loadTime).to.be.lessThan(3000)
    })

    it('should load marketplace within 3 seconds', () => {
      const start = Date.now()
      cy.visit('/marketplace')
      cy.get('h1').should('be.visible')
      const loadTime = Date.now() - start
      expect(loadTime).to.be.lessThan(3000)
    })
  })

  // ============================================
  // ACCESSIBILITY
  // ============================================
  
  describe('Accessibility', () => {
    it('should have skip link for keyboard users', () => {
      cy.visit('/')
      cy.get('a[href="#main-content"]').should('exist')
    })

    it('should have proper heading hierarchy', () => {
      cy.visit('/')
      cy.get('h1').should('have.length.at.least', 1)
    })

    it('should have alt text on images', () => {
      cy.visit('/')
      cy.get('img').each(($img) => {
        cy.wrap($img).should('have.attr', 'alt')
      })
    })
  })
})
