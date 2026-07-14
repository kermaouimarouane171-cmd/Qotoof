// ============================================
// Cart Module — Public API
//
// This is the single entry point for the cart module.
// All other modules and pages should import from here:
//
//   import { useCartStore, useFavoritesStore, favoritesApi } from '@/modules/cart'
//
// Deep imports into this module are blocked by ESLint's
// no-restricted-imports rule (eslint.config.js).
//
// Phase 2.3 — Re-export layer only.
// Phase 6.13 — Removed `export * from './ui'` from root barrel to prevent
// eager loading of Cart.jsx/Favorites.jsx → Map.jsx → Leaflet when consumers
// only need stores/api/domain/hooks/utils. UI exports remain available via
// `@/modules/cart/ui` for internal use, but are not eagerly loaded by root.
// No app code imported CartPage/FavoritesPage from the root barrel.
// ============================================

export * from './api'
export * from './domain'
export * from './hooks'
export * from './stores'
export * from './utils'
