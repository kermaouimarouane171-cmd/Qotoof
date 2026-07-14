/**
 * Admin Module — Hooks Layer (re-export)
 *
 * Re-exports admin-related React Query hooks from existing hook files.
 * These hooks wrap admin API calls with caching and invalidation.
 */

// ── Admin hooks from src/hooks/queries/useAdminQueries.js (Phase 4.7 split) ──
// adminKeys — query key factory for admin queries
// useAdminUsers(filters) — list users with filters
// useAdminUser(id) — get single user by ID
// useDeletedUsers() — get soft-deleted users
// useAdminStats() — get admin dashboard stats (via analyticsApi.getAdminStats)
// useUpdateUser() — update user mutation (invalidates user queries)
// useDeleteUser() — soft-delete user mutation
// useRestoreUser() — restore soft-deleted user mutation
export {
  adminKeys,
  useAdminUsers,
  useAdminUser,
  useDeletedUsers,
  useAdminStats,
  useUpdateUser,
  useDeleteUser,
  useRestoreUser,
} from '@/hooks/queries/useAdminQueries'
