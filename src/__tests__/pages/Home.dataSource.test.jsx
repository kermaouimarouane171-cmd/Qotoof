import fs from 'fs'
import path from 'path'

const homePath = path.resolve(__dirname, '../../pages/Home.jsx')
const homeSource = fs.readFileSync(homePath, 'utf-8')

describe('Home.jsx — data source modernization', () => {
  test('does not import from src/services/api.js', () => {
    // Ensure old api.js imports are removed
    expect(homeSource).not.toMatch(/from\s+['"]@\/services\/api['"]/)
    expect(homeSource).not.toContain('productsApi')
    expect(homeSource).not.toContain('vendorsApi')
  })

  test('imports productSearchService', () => {
    expect(homeSource).toContain("from '@/services/search/productSearchService'")
  })

  test('imports profilesService', () => {
    expect(homeSource).toContain("from '@/modules/users'")
  })

  test('calls getFeaturedProducts from productSearchService', () => {
    expect(homeSource).toContain('getFeaturedProducts')
  })

  test('calls fetchActiveVerifiedVendors from profilesService', () => {
    expect(homeSource).toContain('fetchActiveVerifiedVendors')
  })

  test('still filters products by is_available', () => {
    expect(homeSource).toContain("p?.is_available !== false")
  })

  test('still sorts vendors by rating descending', () => {
    expect(homeSource).toContain('b?.rating || 0) - Number(a?.rating || 0)')
  })

  test('still slices to 8 products and 6 vendors', () => {
    expect(homeSource).toMatch(/slice\(0,\s*8\)/)
    expect(homeSource).toMatch(/slice\(0,\s*6\)/)
  })

  test('has safe fallback to empty arrays on error', () => {
    // SM-1 fix: Home.jsx now uses TanStack Query (useQuery) which handles errors
    // automatically — data falls back to the initialData [] default.
    // The old pattern (setFeaturedProducts([]) in catch) is replaced by:
    //   const { data: featuredProducts = [] } = useQuery(...)
    // Verify the useQuery pattern with default empty array is present instead.
    expect(homeSource).toMatch(/featuredProducts\s*=\s*\[\]/)
    expect(homeSource).toMatch(/trustedVendors\s*=\s*\[\]/)
  })

  test('search bar still navigates to marketplace with query', () => {
    expect(homeSource).toContain("/marketplace?search=")
  })

  test('is a guest-only page (no buyer-specific logic)', () => {
    // HomePageGateway redirects all authenticated users away from /
    // so Home.jsx should not contain buyer dashboard logic
    expect(homeSource).not.toContain('isBuyer')
    expect(homeSource).not.toContain('buyerStats')
    expect(homeSource).not.toContain('recentOrders')
    expect(homeSource).not.toContain('home.buyer.welcome')
    expect(homeSource).not.toContain('useAuthStore')
    expect(homeSource).not.toContain("from '@/services/supabase'")
  })

  test('still shows guest marketing sections (roles + how it works)', () => {
    expect(homeSource).toContain('home.roles.title')
    expect(homeSource).toContain('home.howItWorks.title')
  })

  test('uses i18n keys for guest marketing sections instead of hardcoded text', () => {
    // Categories use dynamic i18n keys via category.i18nKey
    expect(homeSource).toContain('home.categories.title')
    expect(homeSource).toContain('home.categories.subtitle')
    expect(homeSource).toContain('home.categories.viewAll')
    expect(homeSource).toContain('home.categories.wholesaleItems')
    expect(homeSource).toContain("home.categories.${category.i18nKey}")
    expect(homeSource).toContain('i18nKey:')
    // Featured products
    expect(homeSource).toContain('home.featuredProducts.title')
    expect(homeSource).toContain('home.featuredProducts.subtitle')
    expect(homeSource).toContain('home.featuredProducts.viewAll')
    expect(homeSource).toContain('home.featuredProducts.noProducts')
    expect(homeSource).toContain('home.featuredProducts.noImage')
    expect(homeSource).toContain('home.featuredProducts.freshProduct')
    expect(homeSource).toContain('home.featuredProducts.minOrder')
    // Trusted vendors
    expect(homeSource).toContain('home.trustedVendors.title')
    expect(homeSource).toContain('home.trustedVendors.subtitle')
    expect(homeSource).toContain('home.trustedVendors.viewAll')
    expect(homeSource).toContain('home.trustedVendors.noVendors')
    expect(homeSource).toContain('home.trustedVendors.verifiedBadge')
    expect(homeSource).toContain('home.trustedVendors.verified')
    expect(homeSource).toContain('home.trustedVendors.morocco')
    expect(homeSource).toContain('home.trustedVendors.unknownVendor')
    // Hero and CTAs
    expect(homeSource).toContain('home.hero.badge')
    expect(homeSource).toContain('home.cta.startNow')
    expect(homeSource).toContain('home.cta.browseMarketplace')
    // How it works steps use dynamic i18n keys via step.id
    expect(homeSource).toContain("home.howItWorks.steps.${step.id}.title")
    expect(homeSource).toContain("home.howItWorks.steps.${step.id}.description")
    expect(homeSource).toContain('id:')
  })
})

describe('Project contact email', () => {
  test('uses lowercase qotoof273@gmail.com in config and i18n', () => {
    const configSource = fs.readFileSync(path.resolve(__dirname, '../../lib/config.ts'), 'utf-8')
    expect(configSource).toContain("from: 'qotoof273@gmail.com'")
    expect(configSource).not.toContain("from: 'Qotoof273@gmail.com'")

    const arSource = fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/ar.json'), 'utf-8')
    const enSource = fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/en.json'), 'utf-8')
    const frSource = fs.readFileSync(path.resolve(__dirname, '../../i18n/locales/fr.json'), 'utf-8')

    for (const source of [arSource, enSource, frSource]) {
      expect(source).toContain('qotoof273@gmail.com')
      expect(source).not.toContain('Qotoof273@gmail.com')
    }
  })
})
