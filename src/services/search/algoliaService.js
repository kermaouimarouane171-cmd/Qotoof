import productSearchService from './productSearchService'

/**
 * Search products via Algolia
 * Falls back gracefully when not configured
 */
async function searchProducts(query, options = {}) {
  return productSearchService.searchProducts({
    query,
    category: options.category,
    subcategory: options.subcategory,
    region: options.region,
    minPrice: options.priceMin,
    maxPrice: options.priceMax,
    rating: options.rating,
    inStock: options.inStock,
    page: options.page,
    hitsPerPage: options.hitsPerPage,
    sortBy: options.sortBy,
  })
}

/**
 * Get search suggestions / autocomplete
 */
async function getSearchSuggestions(query, { hitsPerPage = 5 } = {}) {
  return productSearchService.getSearchSuggestions(query, { hitsPerPage })
}

/**
 * Build facet filter object from URL params
 */
function buildFiltersFromParams(params = {}) {
  return productSearchService.buildFiltersFromParams(params)
}

export const algoliaService = {
  searchProducts,
  getSearchSuggestions,
  buildFiltersFromParams,
  isEnabled: () => productSearchService.isAlgoliaEnabled()
}
