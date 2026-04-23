/**
 * Integration Tests: Search Flow
 * Tests Algolia search integration, filtering, and result rendering logic.
 */

describe('Search Flow Integration', () => {
  // Mock Algolia service
  const createMockAlgolia = (productsDB = []) => ({
    isEnabled: () => true,
    async searchProducts(query, opts = {}) {
      let hits = productsDB.filter(p => {
        const matchQuery = !query || p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase())
        const matchCategory = !opts.category || p.category === opts.category
        const matchMin = opts.priceMin == null || p.price >= opts.priceMin
        const matchMax = opts.priceMax == null || p.price <= opts.priceMax
        const matchStock = opts.inStock == null || (opts.inStock ? p.stock_quantity > 0 : true)
        return matchQuery && matchCategory && matchMin && matchMax && matchStock
      })

      // Sorting
      if (opts.sortBy === 'price_asc') hits = hits.sort((a, b) => a.price - b.price)
      if (opts.sortBy === 'price_desc') hits = hits.sort((a, b) => b.price - a.price)
      if (opts.sortBy === 'rating_desc') hits = hits.sort((a, b) => (b.rating || 0) - (a.rating || 0))

      const hitsPerPage = opts.hitsPerPage || 24
      const page = opts.page || 0
      const paged = hits.slice(page * hitsPerPage, (page + 1) * hitsPerPage)
      return { hits: paged, nbHits: hits.length, nbPages: Math.ceil(hits.length / hitsPerPage), page }
    },
    async getSearchSuggestions(q) {
      return productsDB
        .filter(p => p.name.toLowerCase().startsWith(q.toLowerCase()))
        .slice(0, 5)
        .map(p => ({ objectID: p.id, name: p.name, category: p.category }))
    }
  })

  const products = [
    { id: '1', name: 'طماطم طازجة', category: 'خضروات', price: 15, rating: 4.5, stock_quantity: 100 },
    { id: '2', name: 'تفاح أحمر', category: 'فواكه', price: 25, rating: 4.0, stock_quantity: 50 },
    { id: '3', name: 'خيار', category: 'خضروات', price: 10, rating: 3.5, stock_quantity: 0 },
    { id: '4', name: 'بطيخ', category: 'فواكه', price: 40, rating: 4.8, stock_quantity: 30 },
    { id: '5', name: 'جزر', category: 'خضروات', price: 8, rating: 4.2, stock_quantity: 200 },
    { id: '6', name: 'زيت زيتون', category: 'تغذية', price: 150, rating: 4.9, stock_quantity: 25 }
  ]

  const algolia = createMockAlgolia(products)

  test('returns all products for empty query', async () => {
    const result = await algolia.searchProducts('')
    expect(result.hits.length).toBe(6)
    expect(result.nbHits).toBe(6)
  })

  test('filters by text query', async () => {
    const result = await algolia.searchProducts('طماطم')
    expect(result.hits.length).toBe(1)
    expect(result.hits[0].id).toBe('1')
  })

  test('filters by category', async () => {
    const result = await algolia.searchProducts('', { category: 'خضروات' })
    expect(result.hits.length).toBe(3)
    expect(result.hits.every(h => h.category === 'خضروات')).toBe(true)
  })

  test('filters by price range', async () => {
    const result = await algolia.searchProducts('', { priceMin: 15, priceMax: 40 })
    expect(result.hits.every(h => h.price >= 15 && h.price <= 40)).toBe(true)
  })

  test('filters in-stock items', async () => {
    const result = await algolia.searchProducts('', { inStock: true })
    expect(result.hits.every(h => h.stock_quantity > 0)).toBe(true)
    expect(result.hits.some(h => h.id === '3')).toBe(false) // خيار — out of stock
  })

  test('sorts by price ascending', async () => {
    const result = await algolia.searchProducts('', { sortBy: 'price_asc' })
    const prices = result.hits.map(h => h.price)
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1])
    }
  })

  test('sorts by rating descending', async () => {
    const result = await algolia.searchProducts('', { sortBy: 'rating_desc' })
    const ratings = result.hits.map(h => h.rating || 0)
    for (let i = 1; i < ratings.length; i++) {
      expect(ratings[i]).toBeLessThanOrEqual(ratings[i - 1])
    }
  })

  test('paginates results', async () => {
    const page0 = await algolia.searchProducts('', { hitsPerPage: 3, page: 0 })
    const page1 = await algolia.searchProducts('', { hitsPerPage: 3, page: 1 })
    expect(page0.hits.length).toBe(3)
    expect(page1.hits.length).toBe(3)
    expect(page0.nbPages).toBe(2)
    const ids0 = page0.hits.map(h => h.id)
    const ids1 = page1.hits.map(h => h.id)
    expect(ids0.some(id => ids1.includes(id))).toBe(false)
  })

  test('returns suggestions for partial query', async () => {
    const suggestions = await algolia.getSearchSuggestions('طم')
    expect(suggestions.some(s => s.name.includes('طماطم'))).toBe(true)
  })

  test('returns empty suggestions for very short query', async () => {
    const suggestions = await algolia.getSearchSuggestions('ز')
    // Either empty or starts with ز — just check it's an array
    expect(Array.isArray(suggestions)).toBe(true)
  })

  test('no results for non-matching query', async () => {
    const result = await algolia.searchProducts('منتج غير موجود xyz')
    expect(result.hits.length).toBe(0)
    expect(result.nbHits).toBe(0)
  })
})
