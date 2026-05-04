const resetCartStorage = () => {
  cy.visit('/marketplace', {
    onBeforeLoad(win) {
      win.localStorage.removeItem('cart-storage')
    },
  })
}

const addFirstAvailableProductToCart = () => {
  cy.get('[data-testid="product-card"]').its('length').should('be.greaterThan', 0)
  cy.get('[data-testid="add-to-cart-btn"]').first().click()
  cy.window().should((win) => {
    const rawCart = win.localStorage.getItem('cart-storage')
    expect(rawCart).to.be.a('string').and.not.be.empty

    const parsedCart = JSON.parse(rawCart)
    expect(parsedCart?.state?.items?.length || 0).to.be.greaterThan(0)
  })
}

const goToCheckoutFromCart = () => {
  cy.visit('/cart')
  cy.get('[data-testid="cart-item"]').its('length').should('be.gte', 1)
  cy.get('[data-testid="cart-checkout-btn"]:visible').first().click()
  cy.url().should('include', '/checkout')
  cy.get('[data-testid="checkout-page"]').should('be.visible')
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

const completeCheckoutShippingStep = () => {
  cy.get('[data-testid="checkout-full-name-input"]').clear().type('QA Buyer')
  cy.get('[data-testid="checkout-phone-input"]').clear().type('+212600000001')
  cy.get('[data-testid="checkout-city-input"]').clear().type('Casablanca')
  cy.get('[data-testid="checkout-address-input"]').clear().type('123 Test Street, Casablanca')
  ensureCheckoutLocation()
  cy.get('[data-testid="checkout-continue-to-delivery"]').click()
  cy.get('[data-testid="checkout-step-delivery"]').should('be.visible')
}

const completeCheckoutPaymentStep = () => {
  cy.get('[data-testid="checkout-continue-to-payment"]:visible').first().click()
  cy.get('[data-testid="checkout-step-payment"]').should('be.visible')

  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="payment-type-cod"]:not(:disabled)').length > 0) {
      cy.get('[data-testid="payment-type-cod"]').click()
      return
    }

    if ($body.find('[data-testid="payment-type-full"]:not(:disabled)').length > 0) {
      cy.get('[data-testid="payment-type-full"]').click()
    } else {
      cy.get('[data-testid="payment-type-split"]:not(:disabled)').first().click()
    }

    cy.get('[data-testid="payment-bank-option"]').first().click()
  })

  cy.get('[data-testid="payment-terms-checkbox"]').check({ force: true })
}

describe('Marketplace Critical Path', () => {
  beforeEach(() => {
    cy.loginAsBuyer()
    resetCartStorage()
  })

  it('covers browse to checkout start', () => {
    cy.get('[data-testid="product-card"]').its('length').should('be.greaterThan', 0)
    addFirstAvailableProductToCart()

    cy.visit('/cart')
    cy.get('[data-testid="cart-item"]').its('length').should('be.gte', 1)
    cy.get('[data-testid="cart-checkout-btn"]:visible').first().click()

    cy.url().should('include', '/checkout')
    cy.get('[data-testid="checkout-page"]').should('be.visible')
  })

  it('keeps cart state consistent across quantity updates and removal', () => {
    addFirstAvailableProductToCart()
    cy.visit('/cart')

    cy.get('[data-testid="cart-item"]').first().within(() => {
      cy.get('[data-testid="cart-item-quantity-input"]').invoke('val').then((initialValue) => {
        cy.get('[data-testid="cart-item-increment"]').click()
        cy.get('[data-testid="cart-item-quantity-input"]').should(($input) => {
          expect($input.val()).not.to.eq(initialValue)
        })
        cy.get('[data-testid="cart-item-decrement"]').click()
      })

      cy.get('[data-testid="cart-item-remove"]').click()
    })

    cy.get('[data-testid="cart-remove-dialog"]').should('be.visible')
    cy.get('[data-testid="cart-remove-confirm"]').click()
    cy.get('[data-testid="cart-empty-state"]').should('be.visible')
  })

  it('validates checkout fields and creates an order successfully', () => {
    addFirstAvailableProductToCart()
    goToCheckoutFromCart()

    cy.get('[data-testid="checkout-full-name-input"]').clear()
    cy.get('[data-testid="checkout-phone-input"]').clear()
    cy.get('[data-testid="checkout-city-input"]').clear()
    cy.get('[data-testid="checkout-address-input"]').clear()
    cy.get('[data-testid="checkout-continue-to-delivery"]').click()
    cy.get('[data-testid="checkout-full-name-error"]').should('be.visible')
    cy.get('[data-testid="checkout-phone-error"]').should('be.visible')
    cy.get('[data-testid="checkout-city-error"]').should('be.visible')
    cy.get('[data-testid="checkout-address-error"]').should('be.visible')

    completeCheckoutShippingStep()
    completeCheckoutPaymentStep()
    cy.get('[data-testid="checkout-submit"]').click()

    cy.url().should('include', '/order-confirmation')
    cy.get('[data-testid="order-confirmation-page"]', { timeout: 30000 }).should('be.visible')
  })
})
