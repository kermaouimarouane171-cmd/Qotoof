const getContrastRatio = (foreground, background) => {
  const parseRgb = (value) => {
    const match = String(value || '').match(/\d+(?:\.\d+)?/g)
    if (!match || match.length < 3) {
      return null
    }

    return match.slice(0, 3).map(Number).map((channel) => channel / 255)
  }

  const linearize = (channel) => (
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  )

  const fg = parseRgb(foreground)
  const bg = parseRgb(background)

  if (!fg || !bg) {
    return 0
  }

  const luminance = (channels) => {
    const [r, g, b] = channels.map(linearize)
    return (0.2126 * r) + (0.7152 * g) + (0.0722 * b)
  }

  const lum1 = luminance(fg)
  const lum2 = luminance(bg)
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)

  return (lighter + 0.05) / (darker + 0.05)
}

export const assertFocusManagement = (triggerSelector, expectedFocusSelector) => {
  cy.get(triggerSelector).focus().click()
  cy.get(expectedFocusSelector).should('have.focus')
}

export const assertAriaLive = (selector, expectedText) => {
  cy.get(selector).should('have.attr', 'aria-live').and('not.be.empty')
  cy.get(selector).should('contain.text', expectedText)
}

export const assertKeyboardNavigation = (containerSelector, expectedOrder) => {
  cy.get(containerSelector).within(() => {
    expectedOrder.forEach((selector) => {
      cy.focused().should('match', selector)
      cy.focused().tab()
    })
  })
}

export const assertColorContrast = (selector, minRatio = 4.5) => {
  cy.get(selector).then(($el) => {
    const style = getComputedStyle($el[0])
    const ratio = getContrastRatio(style.color, style.backgroundColor)
    expect(ratio).to.be.gte(minRatio)
  })
}

export default {
  assertFocusManagement,
  assertAriaLive,
  assertKeyboardNavigation,
  assertColorContrast,
}