// ============================================
// Catalog Module — Stores Public API
// Re-exports catalog-related Zustand stores if any exist.
// No files were moved — this is a re-export layer.
// ============================================

// Currently there is no dedicated catalog store.
// Product-related state is managed by:
// - React Query (useProducts hook) for server state
// - cartStore for cart items
// - favoritesStore for favorite products
//
// When a dedicated catalog store is created (e.g., for product drafts,
// bulk upload state, or catalog filters), it will be re-exported here.
