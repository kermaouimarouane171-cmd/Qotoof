// ============================================
// Users Module — Public API
//
// This is the single entry point for the users module.
// All other modules and pages should import from here:
//
//   import { fetchProfile, updateProfile, profilesService } from '@/modules/users'
//
// Deep imports into this module are blocked by ESLint's
// no-restricted-imports rule (eslint.config.js).
//
// Phase 1.4 — Re-export layer only.
// No files have been moved. This module re-exports
// existing profile services, notification preferences,
// and validation utilities.
//
// Phase 6.21 — Barrel Safety:
// `export * from './ui'` removed from root barrel.
// UI exports (ProfilePage, BuyerSettingsPage, BuyerAddressesPage,
// VendorProfilePage, DriverProfilePage, VendorPublicProfilePage) remain
// available via `src/modules/users/ui/index.js` for intra-module use.
// App code loads pages via `lazy(() => import('@/pages/...'))` — not
// through this barrel.
// ============================================

export * from './api'
export * from './domain'
export * from './data'
export * from './stores'
export * from './utils'
