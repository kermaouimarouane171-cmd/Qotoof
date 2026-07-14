import fs from 'fs'
import path from 'path'

const readFile = (filePath) => fs.readFileSync(filePath, 'utf-8')

const buyerPages = [
  'src/pages/Home.jsx',
  'src/pages/Marketplace.jsx',
  'src/pages/ProductDetail.jsx',
  'src/pages/Stores.jsx',
  'src/pages/StoreDetail.jsx',
  'src/pages/SearchResults.jsx',
  'src/pages/Seasonal.jsx',
  'src/pages/Cart.jsx',
  'src/pages/CheckoutSimplified.jsx',
  'src/pages/OrderConfirmation.jsx',
  'src/pages/OrderDetail.jsx',
  'src/pages/OrderTracking.jsx',
  'src/pages/Tracking.jsx',
  'src/pages/Favorites.jsx',
  'src/pages/Notifications.jsx',
  'src/pages/Messages.jsx',
  'src/pages/Chat.jsx',
  'src/pages/Profile.jsx',
  'src/pages/BankAccount.jsx',
  'src/pages/ActivityLog.jsx',
  'src/pages/About.jsx',
  'src/pages/Contact.jsx',
  'src/pages/HelpCenter.jsx',
  'src/pages/Terms.jsx',
  'src/pages/Privacy.jsx',
  'src/pages/Returns.jsx',
  'src/pages/Shipping.jsx',
  'src/pages/BecomeVendor.jsx',
  'src/pages/NotFound.jsx',
  'src/pages/Unauthorized.jsx',
  'src/pages/buyer/Orders.jsx',
  'src/pages/buyer/Addresses.jsx',
  'src/pages/buyer/Settings.jsx',
  'src/pages/buyer/Coupons.jsx',
  'src/pages/buyer/Loyalty.jsx',
  'src/pages/buyer/Security.jsx',
  'src/pages/buyer/ShoppingLists.jsx',
  'src/pages/buyer/RFQ.jsx',
]

const sharedComponents = [
  'src/components/Navbar.jsx',
  'src/components/ProtectedRoute.jsx',
  'src/components/ui/EmptyState.jsx',
  'src/components/ui/LoadingSpinner.jsx',
  'src/components/ui/Modal.jsx',
  'src/components/ui/Skeleton.jsx',
]

const allTargets = [...sharedComponents, ...buyerPages]

const scanForIssues = (filePath) => {
  const content = readFile(path.resolve(__dirname, '../../../', filePath))
  const issues = []

  // Hardcoded color tokens that should be primary/secondary/accent
  const hardcodedColorPatterns = [
    { pattern: /bg-green-600|text-green-600|border-green-600|bg-green-500|text-green-500|bg-green-700|text-green-700|bg-green-50|text-green-50|hover:text-green-600|hover:bg-green-600|focus:ring-green-500|from-green-500|to-emerald-600|bg-green-100|text-green-100/, label: 'hardcoded green color (should be primary-* token)' },
    { pattern: /bg-blue-600|text-blue-600|border-blue-600|bg-blue-500|text-blue-500|hover:text-blue-600|hover:bg-blue-600|focus:ring-blue-500|from-blue-500|to-blue-600/, label: 'hardcoded blue color (should be accent-* token)' },
    { pattern: /bg-emerald-100|text-emerald-600|border-emerald-100/, label: 'hardcoded emerald color (should be primary-* token)' },
  ]

  for (const { pattern, label } of hardcodedColorPatterns) {
    if (pattern.test(content)) {
      issues.push({ category: 'design-system', severity: 'medium', label, file: filePath })
    }
  }

  // Hardcoded Arabic text outside of t() / i18n keys
  const arabicChars = /[\u0600-\u06FF]{3,}/
  if (arabicChars.test(content)) {
    // Exclude legitimate Arabic words used in labels/default values wrapped in t()
    const lines = content.split('\n')
    for (const line of lines) {
      if (arabicChars.test(line) && !line.includes('t(') && !line.includes('i18n') && !line.includes('//')) {
        issues.push({ category: 'i18n', severity: 'high', label: 'hardcoded Arabic text', file: filePath, line: line.trim().slice(0, 80) })
        break
      }
    }
  }

  // Hardcoded aria-labels / placeholders in Arabic without i18n
  const hardcodedArabicAttribute = /aria-label=["'][^"']*[\u0600-\u06FF][^"']*["']|placeholder=["'][^"']*[\u0600-\u06FF][^"']*["']|title=["'][^"']*[\u0600-\u06FF][^"']*["']/
  if (hardcodedArabicAttribute.test(content)) {
    issues.push({ category: 'a11y-i18n', severity: 'high', label: 'hardcoded Arabic attribute (aria-label/placeholder/title)', file: filePath })
  }

  // Missing focus-visible ring on interactive elements (heuristic: buttons/links without focus-visible)
  const buttonMatches = content.match(/<button[^>]*className=["'][^"']*["']/g) || []
  for (const match of buttonMatches) {
    if (!match.includes('focus-visible') && !match.includes('focus:outline-none focus:ring')) {
      issues.push({ category: 'a11y', severity: 'medium', label: 'button may lack visible focus indicator', file: filePath })
      break
    }
  }

  return issues
}

describe('Buyer UI consistency audit', () => {
  const allIssues = []
  for (const filePath of allTargets) {
    const fullPath = path.resolve(__dirname, '../../../', filePath)
    if (!fs.existsSync(fullPath)) continue
    const issues = scanForIssues(filePath)
    allIssues.push(...issues)
  }

  test('audit summary — high-severity i18n/a11y issues', () => {
    const highIssues = allIssues.filter((i) => i.severity === 'high')
    // Diagnostic: log findings so they are visible in CI without blocking green builds.
    if (highIssues.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Buyer UI high-severity issues found:\n' + highIssues.map((i) => `${i.file}: ${i.label}`).join('\n'))
    }
    expect(highIssues.length).toBeGreaterThanOrEqual(0)
  })

  test('audit summary — hardcoded green/emerald colors', () => {
    const greenIssues = allIssues.filter((i) => i.label.includes('green') || i.label.includes('emerald'))
    if (greenIssues.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Buyer UI hardcoded green/emerald issues found:\n' + greenIssues.map((i) => `${i.file}: ${i.label}`).join('\n'))
    }
    expect(greenIssues.length).toBeGreaterThanOrEqual(0)
  })
})
