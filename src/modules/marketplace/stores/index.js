// ============================================
// Marketplace Module — Stores Public API
// Re-exports marketplace-related Zustand stores if any exist.
// No files were moved — this is a re-export layer.
// ============================================

// Currently there is no dedicated marketplace store.
// Marketplace browsing state is managed by:
// - React Query (useProducts, useMarketplaceQueries) for server state
// - URL search params (filters, sorting, pagination) in page components
// - cartStore for cart actions (owned by cart module)
// - favoritesStore for favorites (owned by favorites/marketplace module)
//
// When a dedicated marketplace store is created (e.g., for filter state
// persistence or search history), it will be re-exported here.
