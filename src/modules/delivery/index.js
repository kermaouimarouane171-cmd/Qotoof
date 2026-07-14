// ============================================
// Delivery Module — Public API
//
// This is the single entry point for the delivery module.
// All other modules and pages should import from here:
//
//   import { deliveriesApi, driverLocationService, useDriverDeliveries } from '@/modules/delivery'
//
// Deep imports into this module are blocked by ESLint's
// no-restricted-imports rule (eslint.config.js).
//
// Phase 2.5 — Re-export layer only.
// No files have been moved. This module re-exports
// existing delivery services, driver config, driver hooks,
// and delivery domain logic.
//
// Phase 6.17 — Barrel Safety:
// `export * from './ui'` removed from root barrel.
// UI exports (driver pages, delivery components) are still available via
// `src/modules/delivery/ui/index.js` for intra-module use.
// App code imports pages directly via `lazy(() => import('@/pages/driver/...'))`
// and components via `@/components/driver/...` — not through this barrel.
// This prevents eager loading of LiveDriverMap → Map.jsx → Leaflet
// when importing lightweight symbols (APIs, domain helpers, hooks).
// ============================================

export * from './api'
export * from './data'
export * from './domain'
export * from './hooks'
export * from './stores'
export * from './utils'
