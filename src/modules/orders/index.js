// ============================================
// Orders Module — Public API
//
// This is the single entry point for the orders module.
// All other modules and pages should import from here:
//
//   import { fetchOrderById, updateOrderStatus, orderTimelineApi } from '@/modules/orders'
//
// Deep imports into this module are blocked by ESLint's
// no-restricted-imports rule (eslint.config.js).
//
// Phase 2.4 — Re-export layer only.
// No files have been moved. This module re-exports
// existing order services, repository, business logic,
// status constants, and hooks.
//
// Phase 6.15 — Barrel Safety:
// `export * from './ui'` removed from root barrel.
// UI exports (pages, components) are still available via
// `src/modules/orders/ui/index.js` for intra-module use.
// App code imports pages directly via `lazy(() => import('@/pages/...'))`
// and components via `@/components/orders/...` — not through this barrel.
// This prevents eager loading of OrderDetail.jsx → RouteMap.jsx → Leaflet
// when importing lightweight symbols (constants, APIs, hooks).
// ============================================

export * from './api'
export * from './data'
export * from './domain'
export * from './hooks'
export * from './stores'
export * from './utils'
