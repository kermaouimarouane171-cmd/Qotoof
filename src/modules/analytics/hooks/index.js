/**
 * Analytics Module — Hooks Layer (re-export)
 *
 * Re-exports analytics-related React Query hooks from existing hook files.
 * These hooks wrap analyticsApi methods with caching and stale time configuration.
 */

// ── Analytics hooks from split files (Phase 4.7) ─────────────────────────
// useVendorStats(vendorId) — fetches vendor stats via analyticsApi.getVendorStats
//   from src/hooks/queries/useVendorQueries.js
// useAdminStats() — fetches admin stats via analyticsApi.getAdminStats
//   from src/hooks/queries/useAdminQueries.js
export { useVendorStats } from '@/hooks/queries/useVendorQueries'
export { useAdminStats } from '@/hooks/queries/useAdminQueries'
