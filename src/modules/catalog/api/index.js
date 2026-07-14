// ============================================
// Catalog Module — API Public API
// Re-exports product services and API functions.
// No files were moved — this is a re-export layer.
// ============================================

// Products API (fetchProducts, fetchProductById, fetchAvailableRegions)
export {
  fetchProducts,
  fetchProductById,
  fetchAvailableRegions,
} from './productsApi'

// Product images helpers
export {
  isProductImagesRelationError,
  mergeProductImages,
  hydrateProductsWithImages,
  hydrateRowsWithProductField,
  hydrateRowsWithProductItems,
  runProductImageFallbackQuery,
} from '@/services/productImages'

// Product search service
export {
  default as productSearchService,
  buildProductSearchFiltersFromParams,
  normalizeProductSearchFilters,
  normalizeSearchProduct,
} from '@/services/search/productSearchService'

// Product search helpers
export {
  buildProductSearchFiltersFromParams as buildProductSearchFiltersFromParamsHelper,
  normalizeProductSearchFilters as normalizeProductSearchFiltersHelper,
  normalizeSearchProduct as normalizeSearchProductHelper,
} from '@/services/search/productSearchHelpers'
