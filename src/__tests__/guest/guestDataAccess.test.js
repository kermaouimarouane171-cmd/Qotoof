/**
 * Guest data access tests
 *
 * Verifies that public/guest-facing pages and services query the safe
 * public_vendor_profiles view (created by migration 039) instead of the
 * authenticated-only public_profiles or raw profiles table.
 *
 * These checks are source-level because the actual Supabase client is
 * mocked in unit tests; the real failure mode is an RLS 403 against a
 * live database for anonymous users.
 */

const fs = require('fs')
const path = require('path')

const readSrc = (relativePath) =>
  fs.readFileSync(path.join(__dirname, '../../../', relativePath), 'utf-8')

describe('Guest data access uses public_vendor_profiles', () => {
  it('productsApi.ts fetches product vendor from public_vendor_profiles', () => {
    const source = readSrc('src/api/productsApi.ts')
    expect(source).toContain("vendor:public_vendor_profiles!vendor_id(")
    expect(source).not.toContain("vendor:profiles!products_vendor_id_fkey(")
  })

  it('productsApi.ts keeps onRelationError outside the SQL template strings', () => {
    const source = readSrc('src/api/productsApi.ts')
    const runCallMatch = source.match(/runProductImageFallbackQuery\(\{[\s\S]*?\}\)/)
    expect(runCallMatch).toBeTruthy()
    const runCall = runCallMatch[0]
    // The error handler must be a separate object property, not embedded in the SQL strings.
    expect(runCall).toContain('onRelationError:')
    expect(runCall).toContain('logger.warn')
    const selectStrings = runCall.match(/selectWithImages:\s*`[\s\S]*?`|selectWithoutImages:\s*`[\s\S]*?`/g) || []
    for (const str of selectStrings) {
      expect(str).not.toContain('onRelationError')
      expect(str).not.toContain('logger.warn')
    }
  })

  it('profilesService.ts fetches active vendors from public_vendor_profiles', () => {
    const source = readSrc('src/services/profilesService.ts')
    const fetchFnMatch = source.match(/fetchActiveVerifiedVendors:[\s\S]*?return \{ data: \(data as unknown as Profile\[\]\) \|\| \[\], error: null \}/)
    expect(fetchFnMatch).toBeTruthy()
    expect(fetchFnMatch[0]).toContain("from('public_vendor_profiles')")
    expect(fetchFnMatch[0]).not.toContain("from('public_profiles')")
  })

  it('About.jsx loads stats from public_vendor_profiles', () => {
    const source = readSrc('src/pages/About.jsx')
    const loadStatsMatch = source.match(/loadStats = useCallback[\s\S]*?\}, \[user\]/)
    expect(loadStatsMatch).toBeTruthy()
    expect(loadStatsMatch[0]).toContain("from('public_vendor_profiles')")
    expect(loadStatsMatch[0]).not.toContain("from('public_profiles')")
  })

  it('StoreDetail.jsx loads store from public_vendor_profiles', () => {
    const source = readSrc('src/pages/StoreDetail.jsx')
    const loadMatch = source.match(/const \{ data, error \} = await supabase[\s\S]*?\.single\(\)/)
    expect(loadMatch).toBeTruthy()
    expect(loadMatch[0]).toContain("from('public_vendor_profiles')")
    expect(loadMatch[0]).not.toContain("from('profiles')")
  })

  it('Cart.jsx loads vendor minimum-order settings from public_vendor_profiles', () => {
    const source = readSrc('src/pages/Cart.jsx')
    const matches = [...source.matchAll(/from\('public_vendor_profiles'\)/g)]
    expect(matches.length).toBeGreaterThanOrEqual(2)
    expect(source).not.toMatch(/from\('public_profiles'\)/)
  })

  it('ProductDetail.jsx joins product vendor to public_vendor_profiles', () => {
    const source = readSrc('src/pages/ProductDetail.jsx')
    expect(source).toContain("vendor:public_vendor_profiles!vendor_id(")
    expect(source).not.toContain("vendor:profiles!products_vendor_id_fkey(")
  })

  it('productSearchService.js fetches public vendors from public_vendor_profiles without email', () => {
    const source = readSrc('src/services/search/productSearchService.js')
    const fetchFnMatch = source.match(/const fetchPublicVendors = async[\s\S]*?return filterPublicVendors/)
    expect(fetchFnMatch).toBeTruthy()
    expect(fetchFnMatch[0]).toContain("from('public_vendor_profiles')")
    expect(fetchFnMatch[0]).not.toContain('email')
    // Public vendor selects should not expose email anywhere.
    const publicVendorSelects = [...source.matchAll(/vendor:public_vendor_profiles[^`]*?\(/g)]
    expect(publicVendorSelects.length).toBeGreaterThanOrEqual(1)
    for (const match of publicVendorSelects) {
      const start = match.index
      const end = source.indexOf(')', start)
      const select = source.slice(start, end)
      expect(select).not.toContain('email')
    }
  })

  it('vendorsApi.js fetches public vendors from public_vendor_profiles without email or phone', () => {
    const source = readSrc('src/services/apis/vendorsApi.js')
    expect(source).toContain("from('public_vendor_profiles')")
    expect(source).not.toContain("from('public_profiles')")
    expect(source).not.toContain('email')
    expect(source).not.toContain('phone')
  })
})

describe('TanStack Query configuration', () => {
  it('queryClient.js uses gcTime instead of deprecated cacheTime', () => {
    const source = readSrc('src/services/queryClient.js')
    expect(source).toContain('gcTime:')
    expect(source).not.toContain('cacheTime:')
  })
})

describe('Role constants', () => {
  it('ProtectedRoute uses USER_ROLES.GUEST instead of string literal', () => {
    const source = readSrc('src/components/ProtectedRoute.jsx')
    expect(source).toContain('USER_ROLES.GUEST')
    expect(source).not.toMatch(/const role = profile\?\.role \|\| 'guest'/)
  })
})

describe('Contact form auth gate', () => {
  it('Contact.jsx hides the submission form from guests and shows a sign-in prompt', () => {
    const source = readSrc('src/pages/Contact.jsx')
    expect(source).toContain("{user ? (")
    expect(source).toContain("import AuthGate from '@/components/auth/AuthGate'")
    expect(source).toContain("<AuthGate")
    expect(source).toContain('from="/contact"')
  })

  it('favoritesStore.js supports guest favorites without requiring userId', () => {
    const source = readSrc('src/modules/cart/stores/favoritesStore.js')
    expect(source).toContain('toggleProduct: async (userId, productId)')
    expect(source).toContain('if (!userId)')
    expect(source).toContain('loadGuestFavorites')
    expect(source).toContain('syncFavoritesToServer')
  })

  it('Favorites.jsx allows guest access and loads guest favorites', () => {
    const source = readSrc('src/pages/Favorites.jsx')
    expect(source).toContain('loadGuestFavorites')
    expect(source).toContain('if (user)')
    expect(source).not.toContain("if (!user) {\n      navigate('/login')")
    expect(source).toContain('favorites.guestNotice')
  })

  it('ProductCard.jsx allows guests to toggle favorites locally', () => {
    const source = readSrc('src/components/ui/ProductCard.jsx')
    expect(source).toContain('toggleProduct(user?.id || null, product.id)')
  })

  it('AppRouter.jsx exposes /favorites as a public route', () => {
    const source = readSrc('src/router/AppRouter.jsx')
    const publicRouteMatch = source.match(/<Route path="\/" element={<MainLayout \/>}>[\s\S]*?<\/Route>/)
    expect(publicRouteMatch).toBeTruthy()
    expect(publicRouteMatch[0]).toContain('path="favorites"')
  })

  it('get-public-config Edge Function enforces server-side rate limiting', () => {
    const source = readSrc('supabase/functions/get-public-config/index.ts')
    expect(source).toContain('enforceServerRateLimit')
    expect(source).toContain("scope: 'public_request'")
    expect(source).toContain("'get-public-config'")
    expect(source).toContain('status: 429')
  })
})
