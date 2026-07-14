// ============================================
// Marketplace Module — API Public API
// Re-exports marketplace browsing APIs and search services.
// No files were moved — this is a re-export layer.
// ============================================

// Algolia search service (thin wrapper around productSearchService)
export { algoliaService } from '@/services/search/algoliaService'

// Store type service (store classification + delivery options)
export { storeTypeService, STORE_TYPE_RULES, DELIVERY_OPTION_META } from '@/services/storeTypeService'
