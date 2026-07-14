// ============================================
// Catalog Module — Public API
//
// This is the single entry point for the catalog module.
// All other modules and pages should import from here:
//
//   import { productRepository, fetchProductById, useProducts } from '@/modules/catalog'
//
// Deep imports into this module are blocked by ESLint's
// no-restricted-imports rule (eslint.config.js).
//
// Phase 2.1 — Re-export layer only.
// No files have been moved. This module re-exports
// existing product data access, services, APIs,
// business logic, and hooks.
//
// Phase 6.19 — Barrel Safety:
// `export * from './ui'` removed from root barrel.
// UI exports (ProductCard, ProductForm, ProductDetailPage, etc.) remain
// available via `src/modules/catalog/ui/index.js` for intra-module use.
// App code imports ProductCard directly from `@/components/ui/ProductCard`
// and pages via `lazy(() => import('@/pages/...'))` — not through this barrel.
// This prevents eager loading of ProductDetailPage (1116 lines) and
// ProductCard (which imports cart/favorites stores) when importing
// lightweight symbols (APIs, domain helpers, hooks).
// ============================================

export * from './data'
export * from './api'
export * from './domain'
export * from './hooks'
export * from './stores'
export * from './utils'
