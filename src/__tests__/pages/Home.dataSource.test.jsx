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
    expect(homeSource).toContain("from '@/services/profilesService'")
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

  test('has safe fallback to empty arrays in catch block', () => {
    // Checks that catch block sets both arrays to []
    const catchMatch = homeSource.match(/catch\s*\([^)]*\)\s*\{([^}]*\{[^}]*\}[^}]*\}[^}]*)?[^}]*/s)
    // Simpler: look for setFeaturedProducts and setTrustedVendors inside catch/error handling
    expect(homeSource).toMatch(/catch\s*\([^)]*\)\s*\{[\s\S]*?setFeaturedProducts\(\[\]\)[\s\S]*?setTrustedVendors\(\[\]\)/)
  })

  test('search bar still navigates to marketplace with query', () => {
    expect(homeSource).toContain("/marketplace?search=")
  })
})
