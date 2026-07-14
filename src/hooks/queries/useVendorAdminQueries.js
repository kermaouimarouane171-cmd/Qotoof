/**
 * Vendor & Admin Queries & Mutations — Backward-compatible re-export (Phase 4.7)
 *
 * The original file has been split into:
 *   - src/hooks/queries/useVendorQueries.js  → vendor hooks + vendorKeys
 *   - src/hooks/queries/useAdminQueries.js   → admin hooks + adminKeys
 *
 * This file re-exports them so that all existing imports from
 * '@/hooks/queries/useVendorAdminQueries' continue to work unchanged.
 *
 * No behavior changes. All React Query keys, caching, and invalidation
 * are preserved exactly in the split files.
 */

// Vendor hooks + keys
export {
  vendorKeys,
  useVendors,
  useVendor,
  useVendorStats,
  useUpdateVendor,
} from './useVendorQueries'

// Admin hooks + keys
export {
  adminKeys,
  useAdminUsers,
  useAdminUser,
  useDeletedUsers,
  useAdminStats,
  useUpdateUser,
  useDeleteUser,
  useRestoreUser,
} from './useAdminQueries'
