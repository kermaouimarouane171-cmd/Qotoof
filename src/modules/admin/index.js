/**
 * Admin Module — Public API Entry Point (Phase 4.6)
 *
 * This module exposes existing admin dashboard and admin management surfaces
 * through a clean public API. It is a re-export/wrapper layer only — no behavior changes.
 *
 * Public API:
 *   import { platformSettings, useAdminUsers, fraudReportService } from '@/modules/admin'
 *
 * Phase 6.18 — Barrel Safety:
 * UI exports (20+ admin pages, VerificationPanel, AdminLayout) removed from root barrel.
 * UI exports remain available via `src/modules/admin/ui/index.js` for intra-module use.
 * App code imports pages directly via `lazy(() => import('@/pages/admin/...'))`
 * and components via `@/components/admin/...` — not through this barrel.
 * This prevents eager loading of 20+ admin pages when importing lightweight
 * symbols (API services, hooks).
 *
 * The admin module owns:
 *   - Admin-specific services (platformSettings, fraudReportService, disputeService)
 *   - Admin-specific hooks (useAdminUsers, useAdminStats, etc.)
 *
 * The admin module does NOT own:
 *   - User profile business ownership (owned by users module)
 *   - Product catalog business ownership (owned by catalog module)
 *   - Order lifecycle ownership (owned by orders module)
 *   - Payment provider logic (owned by payments module)
 *   - Commission calculation (owned by commissions module)
 *   - Delivery lifecycle (owned by delivery module)
 *   - Notification delivery logic (owned by notifications module)
 *   - Analytics calculations (owned by analytics module)
 *   - Auth/session logic (owned by auth module)
 *
 * Allowed dependencies:
 *   - shared, auth (public API for role/admin checks),
 *     users (public API for user facts), catalog (public API for product facts),
 *     orders (public API for order facts), payments (public API for payment facts),
 *     commissions (public API for commission facts), delivery (public API for driver/delivery facts),
 *     analytics (public API for dashboard/report facts), notifications (public API for notification facts),
 *     utils, config, lib/supabase
 *
 * Forbidden dependencies:
 *   - checkout internals, cart internals, payment provider internals,
 *     direct ownership of domain business logic
 */

// ── API ──────────────────────────────────────────────────────────────────
export {
  platformSettings,
  platformSettingsDefault,
  getSettings,
  updateSettings,
  invalidateSettingsCache,
  getSettingsAuditLog,
  subscribeToSettingsChanges,
  fraudReportService,
  FRAUD_REPORT_TYPES,
  FRAUD_STATUS_OPTIONS,
  FRAUD_PRIORITY_OPTIONS,
  getFraudEvidenceLinks,
  createFraudReport,
  listFraudReportsForAdmin,
  getFraudReportById,
  updateFraudReport,
  submitFraudReport,
  disputeService,
  openDispute,
  releaseBuyerDataToVendor,
  applyDisputePenalty,
} from './api'

// ── Hooks ────────────────────────────────────────────────────────────────
export {
  adminKeys,
  useAdminUsers,
  useAdminUser,
  useDeletedUsers,
  useAdminStats,
  useUpdateUser,
  useDeleteUser,
  useRestoreUser,
} from './hooks'
