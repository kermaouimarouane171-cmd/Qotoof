/**
 * Admin Module — UI Layer (re-export)
 *
 * Re-exports admin pages and admin components from existing source files.
 * These are default exports from src/pages/admin/ and src/components/admin/.
 *
 * Note: These pages are currently lazy-loaded in src/router/AppRouter.jsx via:
 *   const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'))
 * The re-exports here provide a clean public API for future imports:
 *   import { AdminDashboardPage } from '@/modules/admin'
 * Existing lazy imports in AppRouter.jsx continue to work unchanged.
 */

// ── Admin pages from src/pages/admin/ ────────────────────────────────────
export { default as AdminDashboardPage } from '@/pages/admin/Dashboard'
export { default as AdminUsersPage } from '@/pages/admin/Users'
export { default as AdminProductsPage } from '@/pages/admin/Products'
export { default as AdminOrdersPage } from '@/pages/admin/Orders'
export { default as AdminAnalyticsPage } from '@/pages/admin/Analytics'
export { default as AdminSettingsPage } from '@/pages/admin/Settings'
export { default as AdminReportsPage } from '@/pages/admin/Reports'
export { default as AdminVendorsPage } from '@/pages/admin/Vendors'
export { default as AdminDriversPage } from '@/pages/admin/Drivers'
export { default as AdminModerationPage } from '@/pages/admin/Moderation'
export { default as AdminCommissionsPage } from '@/pages/admin/Commissions'
export { default as AdminCommissionManagementPage } from '@/pages/admin/CommissionManagement'
export { default as AdminPayoutsPage } from '@/pages/admin/Payouts'
export { default as AdminReviewsPage } from '@/pages/admin/Reviews'
export { default as AdminSecurityPage } from '@/pages/admin/Security'
export { default as AdminVerificationPage } from '@/pages/admin/Verification'
export { default as AdminSupportTicketsPage } from '@/pages/admin/SupportTickets'
export { default as AdminSettingsAuditLogPage } from '@/pages/admin/SettingsAuditLog'
export { default as AdminCircuitBreakersPage } from '@/pages/admin/CircuitBreakers'

// Disabled in router (tables do not exist in DB schema yet)
export { default as AdminDisputeManagementPage } from '@/pages/admin/DisputeManagement'
export { default as AdminFraudReportsPage } from '@/pages/admin/FraudReports'

// ── Admin components from src/components/admin/ ──────────────────────────
export { default as VerificationPanel } from '@/components/admin/VerificationPanel'

// ── AdminLayout from src/components/ProtectedRoute.jsx ───────────────────
export { AdminLayout } from '@/components/ProtectedRoute'
