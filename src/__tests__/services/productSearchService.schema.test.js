import fs from 'fs'
import path from 'path'

const servicePath = path.resolve(__dirname, '../../services/search/productSearchService.js')
const serviceSource = fs.readFileSync(servicePath, 'utf-8')
const serviceLines = serviceSource.split('\n')

// Helper: get all non-comment lines that contain a specific keyword
const getActiveCodeLines = (keyword) => serviceLines.filter((line) => {
  if (!line.includes(keyword)) return false
  const trimmed = line.trim()
  // Skip comments (lines starting with // or /* or inside block comments)
  if (trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) return false
  return true
})

// Split into Algolia and Supabase branches for targeted checks
const searchProductsViaSupabaseIndex = serviceSource.indexOf('const searchProductsViaSupabase')
const algoliaIndex = serviceSource.indexOf('const searchProductsViaAlgolia')
const supabaseBranch = serviceSource.slice(searchProductsViaSupabaseIndex)

describe('productSearchService — Supabase fallback must not reference ghost columns', () => {
  test('Supabase fallback does not select average_rating in active code', () => {
    const activeLines = getActiveCodeLines('average_rating')
    const supabaseActive = activeLines.filter((l) => supabaseBranch.includes(l))
    expect(supabaseActive).toEqual([])
  })

  test('Supabase fallback does not select reviews_count in active code', () => {
    const activeLines = getActiveCodeLines('reviews_count')
    const supabaseActive = activeLines.filter((l) => supabaseBranch.includes(l))
    expect(supabaseActive).toEqual([])
  })

  test('Supabase fallback does not order by average_rating in active code', () => {
    expect(getActiveCodeLines("order('average_rating'")).toEqual([])
  })

  test('Supabase fallback does not order by reviews_count in active code', () => {
    expect(getActiveCodeLines("order('reviews_count'")).toEqual([])
  })

  test('Supabase fallback does not filter by average_rating (gte) in active code', () => {
    expect(getActiveCodeLines("gte('average_rating'")).toEqual([])
  })

  test('Supabase fallback does not use textSearch on search_document in active code', () => {
    expect(getActiveCodeLines("textSearch('search_document'")).toEqual([])
  })

  test('Supabase fallback still references products table', () => {
    expect(supabaseBranch).toContain(".from('products')")
  })

  test('Supabase fallback still uses safe ordering columns', () => {
    expect(supabaseBranch).toMatch(/order\('price_per_unit'/)
    expect(supabaseBranch).toMatch(/order\('name'/)
    expect(supabaseBranch).toMatch(/order\('created_at'/)
  })
})

describe('productSearchService — global constants must not select ghost columns', () => {
  test('PRODUCT_CORE_SELECT does not contain average_rating', () => {
    const coreMatch = serviceSource.match(/const PRODUCT_CORE_SELECT = `([^`]+)`/s)
    expect(coreMatch).toBeTruthy()
    expect(coreMatch[1]).not.toContain('average_rating')
  })

  test('PRODUCT_CORE_SELECT does not contain reviews_count', () => {
    const coreMatch = serviceSource.match(/const PRODUCT_CORE_SELECT = `([^`]+)`/s)
    expect(coreMatch).toBeTruthy()
    expect(coreMatch[1]).not.toContain('reviews_count')
  })

  test('PRODUCT_SUGGESTION selects do not contain average_rating', () => {
    expect(serviceSource).not.toMatch(/PRODUCT_SUGGESTION[^`]*average_rating/)
  })

  test('file still references products table', () => {
    expect(serviceSource).toContain(".from('products')")
  })
})

describe('productSearchService — Algolia branch left untouched', () => {
  test('Algolia branch still references rating filter', () => {
    const algoliaBranch = serviceSource.slice(algoliaIndex, searchProductsViaSupabaseIndex)
    expect(algoliaBranch).toMatch(/rating >=/)
  })
})
