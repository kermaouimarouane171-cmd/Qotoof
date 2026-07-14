/**
 * Regression test: Vendor hardcoded toast messages
 *
 * Ensures vendor page toast calls use t() instead of a literal string.
 */

const fs = require('fs')
const path = require('path')

const VENDOR_DIR = path.resolve(__dirname, '../../pages/vendor')

const FORBIDDEN_LITERALS = [
  // Products.jsx
  { file: 'Products.jsx', literal: "toast.error('Failed to load products')" },
  { file: 'Products.jsx', literal: "toast.success('Image removed')" },
  { file: 'Products.jsx', literal: "toast.error('Failed to remove image')" },
  // Orders.jsx
  { file: 'Orders.jsx', literal: "toast.success('Driver assigned successfully!')" },
  { file: 'Orders.jsx', literal: "toast.error('Failed to assign driver')" },
  // Subscription.jsx
  { file: 'Subscription.jsx', literal: "toast.success('Payment completed. We are refreshing your subscription status...')" },
  { file: 'Subscription.jsx', literal: "toast('Payment canceled. You can choose another plan anytime.', { icon: 'ℹ️' })" },
  { file: 'Subscription.jsx', literal: "toast.error('Unable to load subscription data right now')" },
  { file: 'Subscription.jsx', literal: "toast.error(error?.message || 'Unable to start checkout session')" },
]

describe('Vendor hardcoded toast messages', () => {
  const violations = []

  for (const { file, literal } of FORBIDDEN_LITERALS) {
    const filePath = path.join(VENDOR_DIR, file)
    if (!fs.existsSync(filePath)) continue
    const source = fs.readFileSync(filePath, 'utf-8')
    if (source.includes(literal)) {
      violations.push(`${file}: ${literal}`)
    }
  }

  it('has no literal toast calls in vendor pages', () => {
    expect(violations).toEqual([])
  })
})
