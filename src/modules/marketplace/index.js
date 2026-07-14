// ============================================
// Marketplace Module — Public API
//
// This is the single entry point for the marketplace module.
// All other modules and pages should import from here:
//
//   import { algoliaService, useProducts, storeTypeService } from '@/modules/marketplace'
//
// Deep imports into this module are blocked by ESLint's
// no-restricted-imports rule (eslint.config.js).
//
// Phase 2.2 — Re-export layer only.
// No files have been moved. This module re-exports
// existing marketplace browsing services, store type service,
// seasonal calendar, and query hooks.
//
// Phase 6.19 — Barrel Safety:
// `export * from './ui'` removed from root barrel.
// UI exports (MarketplacePage, StoresPage, StoreDetailPage, SearchBar, etc.)
// remain available via `src/modules/marketplace/ui/index.js` for intra-module use.
// App code imports SearchBar directly from `@/components/Search/SearchBar`
// and pages via `lazy(() => import('@/pages/...'))` — not through this barrel.
// This prevents eager loading of MarketplacePage, StoreDetailPage (1288 lines),
// and other heavy pages when importing lightweight symbols (APIs, domain helpers, hooks).
// ============================================

export * from './api'
export * from './domain'
export * from './hooks'
export * from './stores'
export * from './utils'
