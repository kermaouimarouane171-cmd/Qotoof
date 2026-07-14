// ============================================
// Cart Module — API Public API
// Re-exports cart and favorites API services.
// No files were moved — this is a re-export layer.
// ============================================

// Favorites API (Supabase queries for favorites table)
// Source moved to src/modules/cart/api/favorites.js (Phase 6.9)
export { favoritesApi } from './favorites'

// Minimum order service (vendor cart buckets + minimum order evaluation)
// Source moved to src/modules/cart/api/minimumOrderService.js
export {
  buildVendorCartBuckets,
  evaluateVendorMinimumOrders,
  buildMinimumOrderMessage,
} from './minimumOrderService'
