/**
 * Regression test: No primary-* color tokens in buyer pages
 *
 * The project uses `green-*`/`emerald-*` as the standard brand color tokens.
 * `primary-*` tokens (defined in tailwind.config.js as aliases for green-*)
 * were previously used inconsistently in Dashboard.jsx and CreateNegotiation.jsx.
 *
 * This test ensures no `primary-*` color classes reappear in buyer pages.
 *
 * Covers B-006 (Dashboard.jsx) and B-007 (CreateNegotiation.jsx).
 */

const fs = require('fs')
const path = require('path')

const BUYER_PAGES_WITH_COLOR_TOKENS = [
  'pages/buyer/Dashboard.jsx',
  'pages/buyer/CreateNegotiation.jsx',
]

// Also verify all other buyer pages don't use primary-* (they didn't before,
// but this prevents future regressions)
const ALL_BUYER_PAGES = [
  'pages/buyer/Dashboard.jsx',
  'pages/buyer/Orders.jsx',
  'pages/buyer/Addresses.jsx',
  'pages/buyer/Settings.jsx',
  'pages/buyer/Security.jsx',
  'pages/buyer/Coupons.jsx',
  'pages/buyer/Loyalty.jsx',
  'pages/buyer/ShoppingLists.jsx',
  'pages/buyer/RFQ.jsx',
  'pages/buyer/Tracking.jsx',
  'pages/buyer/Negotiation.jsx',
  'pages/buyer/CreateNegotiation.jsx',
]

describe('Buyer pages color token standardization', () => {
  for (const relPath of ALL_BUYER_PAGES) {
    const fileName = path.basename(relPath)

    it(`${fileName} does not use primary-* color tokens`, () => {
      const filePath = path.resolve(__dirname, '..', '..', relPath)
      if (!fs.existsSync(filePath)) {
        // Page may not exist in some configurations — skip gracefully
        console.warn(`File not found: ${relPath}`)
        return
      }
      const source = fs.readFileSync(filePath, 'utf-8')
      // Match primary- followed by a number (color shade)
      const matches = source.match(/primary-\d+/g)
      expect(matches).toBeNull()
    })
  }

  it('Dashboard.jsx uses green-* tokens (confirmed replacement)', () => {
    const filePath = path.resolve(__dirname, '..', '..', 'pages/buyer/Dashboard.jsx')
    const source = fs.readFileSync(filePath, 'utf-8')
    const greenMatches = source.match(/green-\d+/g)
    expect(greenMatches).not.toBeNull()
    expect(greenMatches.length).toBeGreaterThanOrEqual(5)
  })

  it('CreateNegotiation.jsx uses green-* tokens (confirmed replacement)', () => {
    const filePath = path.resolve(__dirname, '..', '..', 'pages/buyer/CreateNegotiation.jsx')
    const source = fs.readFileSync(filePath, 'utf-8')
    const greenMatches = source.match(/green-\d+/g)
    expect(greenMatches).not.toBeNull()
    expect(greenMatches.length).toBeGreaterThanOrEqual(6)
  })
})
