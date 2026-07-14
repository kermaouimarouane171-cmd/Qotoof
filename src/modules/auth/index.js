// ============================================
// Auth Module — Public API
//
// This is the single entry point for the auth module.
// All other modules and pages should import from here:
//
//   import { useAuthStore, USER_ROLES, resolveSafeAuthRedirect } from '@/modules/auth'
//
// Deep imports into this module are blocked by ESLint's
// no-restricted-imports rule (eslint.config.js).
//
// Phase 1.3 — Re-export layer only.
// No files have been moved. This module re-exports
// existing auth stores, services, and utilities.
//
// Phase 6.21 — Barrel Safety:
// `export * from './ui'` removed from root barrel.
// UI exports (ProtectedRoute, MainLayout, AdminLayout, VendorLayout,
// DriverLayout, MFASetup, MFAVerify, PhoneVerification,
// SessionManager, TwoFactor, AuthLayout) remain available via
// `src/modules/auth/ui/index.js` for intra-module use.
// App code imports ProtectedRoute and layouts directly from
// `@/components/ProtectedRoute` and auth components from `@/components/auth/...`
// — not through this barrel.
// ============================================

export * from './stores'
export * from './api'
export * from './domain'
export * from './utils'
