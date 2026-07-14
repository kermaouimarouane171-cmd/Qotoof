# Admin Module

## Purpose

The admin module is the **composition and control surface** for platform administrators. It provides:
- Admin dashboard composition (overview, stats, quick links)
- Admin management screens (users, vendors, drivers, products, orders)
- Admin moderation screens (product moderation, reviews, disputes, fraud reports)
- Admin financial screens (commissions, commission management, payouts)
- Admin analytics/report pages
- Admin settings (platform settings, audit log, security, circuit breakers)
- Admin layout and navigation (AdminLayout with sidebar + mobile nav)
- Admin-specific hooks (useAdminUsers, useAdminStats, etc.)
- Admin-specific services (platformSettings, fraudReportService, disputeService)

## Current Status: Re-export Foundation Only

This module is currently a **re-export layer**. No source files have been moved.
The re-exports point to existing files in `src/pages/admin/`, `src/components/admin/`, `src/components/ProtectedRoute.jsx`, `src/services/`, and `src/hooks/queries/`.

**Source files re-exported:**
- `src/pages/admin/Dashboard.jsx` — admin dashboard page
- `src/pages/admin/Users.jsx` — admin user management page
- `src/pages/admin/Products.jsx` — admin product moderation page
- `src/pages/admin/Orders.jsx` — admin order management page
- `src/pages/admin/Analytics.jsx` — admin analytics page (recharts)
- `src/pages/admin/Settings.jsx` — admin platform settings page
- `src/pages/admin/Reports.jsx` — admin reports page
- `src/pages/admin/Vendors.jsx` — admin vendor management page
- `src/pages/admin/Drivers.jsx` — admin driver management page
- `src/pages/admin/Moderation.jsx` — admin product moderation page
- `src/pages/admin/Commissions.jsx` — admin commission analytics page
- `src/pages/admin/CommissionManagement.jsx` — admin commission management page
- `src/pages/admin/Payouts.jsx` — admin payouts page
- `src/pages/admin/Reviews.jsx` — admin reviews moderation page
- `src/pages/admin/Security.jsx` — admin security page (MFA, sessions, IP blocking, alerts)
- `src/pages/admin/Verification.jsx` — admin verification page (wraps VerificationPanel)
- `src/pages/admin/SupportTickets.jsx` — admin support tickets page
- `src/pages/admin/SettingsAuditLog.jsx` — admin settings audit log page
- `src/pages/admin/CircuitBreakers.jsx` — admin circuit breaker monitoring page
- `src/pages/admin/DisputeManagement.jsx` — admin dispute management page (disabled in router)
- `src/pages/admin/FraudReports.jsx` — admin fraud reports page (disabled in router)
- `src/components/admin/VerificationPanel.jsx` — verification panel component
- `src/components/ProtectedRoute.jsx` — AdminLayout export
- `src/services/platformSettings.js` — platform settings service
- `src/services/fraudReportService.js` — fraud report service
- `src/services/disputeService.js` — dispute service
- `src/hooks/queries/useVendorAdminQueries.js` — admin hooks (useAdminUsers, useAdminStats, etc.)

## Public API (Root Barrel — Lightweight)

The root barrel exports only lightweight non-UI symbols: admin services and admin hooks.

```js
import {
  // Admin services
  platformSettings,
  fraudReportService,
  disputeService,

  // Admin hooks
  adminKeys,
  useAdminUsers,
  useAdminUser,
  useDeletedUsers,
  useAdminStats,
  useUpdateUser,
  useDeleteUser,
  useRestoreUser,
} from '@/modules/admin'
```

### Intentionally NOT Exported from Root (Phase 6.18)

UI/page-level exports (20+ admin pages, `VerificationPanel`, `AdminLayout`) were removed from the root barrel to prevent eager loading of 20+ admin pages when importing lightweight symbols (API services, hooks).

| Symbol | Available Via |
|---|---|
| `AdminDashboardPage` | `lazy(() => import('@/pages/admin/Dashboard'))` or `@/modules/admin/ui` |
| `AdminUsersPage` | `lazy(() => import('@/pages/admin/Users'))` or `@/modules/admin/ui` |
| `AdminProductsPage` | `lazy(() => import('@/pages/admin/Products'))` or `@/modules/admin/ui` |
| `AdminOrdersPage` | `lazy(() => import('@/pages/admin/Orders'))` or `@/modules/admin/ui` |
| `AdminAnalyticsPage` | `lazy(() => import('@/pages/admin/Analytics'))` or `@/modules/admin/ui` |
| `AdminSettingsPage` | `lazy(() => import('@/pages/admin/Settings'))` or `@/modules/admin/ui` |
| `AdminReportsPage` | `lazy(() => import('@/pages/admin/Reports'))` or `@/modules/admin/ui` |
| `AdminVendorsPage` | `lazy(() => import('@/pages/admin/Vendors'))` or `@/modules/admin/ui` |
| `AdminDriversPage` | `lazy(() => import('@/pages/admin/Drivers'))` or `@/modules/admin/ui` |
| `AdminModerationPage` | `lazy(() => import('@/pages/admin/Moderation'))` or `@/modules/admin/ui` |
| `AdminCommissionsPage` | `lazy(() => import('@/pages/admin/Commissions'))` or `@/modules/admin/ui` |
| `AdminCommissionManagementPage` | `lazy(() => import('@/pages/admin/CommissionManagement'))` or `@/modules/admin/ui` |
| `AdminPayoutsPage` | `lazy(() => import('@/pages/admin/Payouts'))` or `@/modules/admin/ui` |
| `AdminReviewsPage` | `lazy(() => import('@/pages/admin/Reviews'))` or `@/modules/admin/ui` |
| `AdminSecurityPage` | `lazy(() => import('@/pages/admin/Security'))` or `@/modules/admin/ui` |
| `AdminVerificationPage` | `lazy(() => import('@/pages/admin/Verification'))` or `@/modules/admin/ui` |
| `AdminSupportTicketsPage` | `lazy(() => import('@/pages/admin/SupportTickets'))` or `@/modules/admin/ui` |
| `AdminSettingsAuditLogPage` | `lazy(() => import('@/pages/admin/SettingsAuditLog'))` or `@/modules/admin/ui` |
| `AdminCircuitBreakersPage` | `lazy(() => import('@/pages/admin/CircuitBreakers'))` or `@/modules/admin/ui` |
| `AdminDisputeManagementPage` | `lazy(() => import('@/pages/admin/DisputeManagement'))` or `@/modules/admin/ui` (disabled in router) |
| `AdminFraudReportsPage` | `lazy(() => import('@/pages/admin/FraudReports'))` or `@/modules/admin/ui` (disabled in router) |
| `VerificationPanel` | `@/components/admin/VerificationPanel` or `@/modules/admin/ui` |
| `AdminLayout` | `@/components/ProtectedRoute` or `@/modules/admin/ui` |

### UI / Page Import Policy

App code should import admin pages via lazy imports from original paths:
```js
const AdminDashboardPage = lazy(() => import('@/pages/admin/Dashboard'))
const AdminUsersPage = lazy(() => import('@/pages/admin/Users'))
```

Admin components should be imported from their original component paths:
```js
import VerificationPanel from '@/components/admin/VerificationPanel'
import { AdminLayout } from '@/components/ProtectedRoute'
```

UI exports remain available through `src/modules/admin/ui/index.js` for intra-module use only.

### Admin Pages

| Export | Source File | Purpose |
|---|---|---|
| `AdminDashboardPage` | `src/pages/admin/Dashboard.jsx` | Admin dashboard with stats overview |
| `AdminUsersPage` | `src/pages/admin/Users.jsx` | User management (list, edit, suspend, delete, restore) |
| `AdminProductsPage` | `src/pages/admin/Products.jsx` | Product moderation (approve, reject, feature) |
| `AdminOrdersPage` | `src/pages/admin/Orders.jsx` | Order management (view, filter, update status) |
| `AdminAnalyticsPage` | `src/pages/admin/Analytics.jsx` | Analytics dashboard with charts (recharts) |
| `AdminSettingsPage` | `src/pages/admin/Settings.jsx` | Platform settings (commission rate, fees, toggles) |
| `AdminReportsPage` | `src/pages/admin/Reports.jsx` | Report generation (sales, users, inventory, delivery) |
| `AdminVendorsPage` | `src/pages/admin/Vendors.jsx` | Vendor management (approve, reject, view stats) |
| `AdminDriversPage` | `src/pages/admin/Drivers.jsx` | Driver management (verify, view performance) |
| `AdminModerationPage` | `src/pages/admin/Moderation.jsx` | Product moderation queue |
| `AdminCommissionsPage` | `src/pages/admin/Commissions.jsx` | Commission analytics (charts, stats) |
| `AdminCommissionManagementPage` | `src/pages/admin/CommissionManagement.jsx` | Commission management (confirm payments, unfreeze) |
| `AdminPayoutsPage` | `src/pages/admin/Payouts.jsx` | Payout management (list, filter, status updates, export) |
| `AdminReviewsPage` | `src/pages/admin/Reviews.jsx` | Review moderation (delete, restore) |
| `AdminSecurityPage` | `src/pages/admin/Security.jsx` | Security center (MFA, sessions, IP blocking, alerts) |
| `AdminVerificationPage` | `src/pages/admin/Verification.jsx` | Verification panel wrapper |
| `AdminSupportTicketsPage` | `src/pages/admin/SupportTickets.jsx` | Support ticket management |
| `AdminSettingsAuditLogPage` | `src/pages/admin/SettingsAuditLog.jsx` | Settings change audit log |
| `AdminCircuitBreakersPage` | `src/pages/admin/CircuitBreakers.jsx` | Circuit breaker health monitoring |
| `AdminDisputeManagementPage` | `src/pages/admin/DisputeManagement.jsx` | Dispute management (disabled in router — table not in DB) |
| `AdminFraudReportsPage` | `src/pages/admin/FraudReports.jsx` | Fraud report management (disabled in router — table not in DB) |

### Admin Layout

`AdminLayout` is exported from `src/components/ProtectedRoute.jsx`. It provides:
- Sidebar navigation with admin links (dashboard, users, vendors, drivers, products, orders, analytics, reports, moderation, commissions, payouts, reviews, support tickets, security, settings)
- Mobile responsive layout (mobile header, drawer, bottom nav)
- Role-based access enforcement via `ProtectedRoute` with `requiredRole={USER_ROLES.ADMIN}` and `allowedRoles={[USER_ROLES.ADMIN]}`

### Admin Services

| Export | Source File | Methods |
|---|---|---|
| `platformSettings` | `src/services/platformSettings.js` | `getSettings()`, `updateSettings(updates, adminId, adminName)`, `invalidateSettingsCache()`, `getSettingsAuditLog(limit, offset)`, `subscribeToSettingsChanges(callback)` |
| `fraudReportService` | `src/services/fraudReportService.js` | `createFraudReport()`, `listFraudReportsForAdmin()`, `getFraudReportById()`, `updateFraudReport()`, `submitFraudReport()` |
| `disputeService` | `src/services/disputeService.js` | `openDispute()`, `releaseBuyerDataToVendor()`, `applyDisputePenalty()` |

### Admin Hooks

| Export | Source | Purpose |
|---|---|---|
| `adminKeys` | `useVendorAdminQueries.js` | Query key factory: `all`, `users()`, `userList(filters)`, `userDetail(id)`, `deletedUsers()`, `stats()` |
| `useAdminUsers(filters)` | `useVendorAdminQueries.js` | List users with filters (React Query) |
| `useAdminUser(id)` | `useVendorAdminQueries.js` | Get single user by ID |
| `useDeletedUsers()` | `useVendorAdminQueries.js` | Get soft-deleted users |
| `useAdminStats()` | `useVendorAdminQueries.js` | Get admin dashboard stats (via `analyticsApi.getAdminStats`) |
| `useUpdateUser()` | `useVendorAdminQueries.js` | Update user mutation |
| `useDeleteUser()` | `useVendorAdminQueries.js` | Soft-delete user mutation |
| `useRestoreUser()` | `useVendorAdminQueries.js` | Restore soft-deleted user mutation |

## What Belongs in Admin

- Admin dashboard composition (overview, stats, quick links)
- Admin pages (users, products, orders, vendors, drivers, etc.)
- Admin navigation surfaces (AdminLayout, sidebar links, mobile nav)
- Admin management screens (moderation, verification, settings)
- Admin moderation screens (product moderation, review moderation, dispute management, fraud reports)
- Admin financial screens (commissions, commission management, payouts)
- Admin analytics/report pages (composing analytics module outputs)
- Admin settings (platform settings, audit log, security, circuit breakers)
- Admin-specific hooks (useAdminUsers, useAdminStats, etc.)
- Admin-specific services (platformSettings, fraudReportService, disputeService)
- Admin-only UI wrappers (VerificationPanel)
- Admin layout and role enforcement (AdminLayout, ProtectedRoute admin role usage)

## What Does NOT Belong in Admin

- **User profile business ownership** — owned by `users` module. Admin composes user management screens.
- **Product catalog business ownership** — owned by `catalog` module. Admin composes product moderation pages.
- **Order lifecycle ownership** — owned by `orders` module. Admin displays and manages via UI but does not own lifecycle rules.
- **Payment provider logic** — owned by `payments` module. Admin views payment status but does not change provider behavior.
- **Commission calculation** — owned by `commissions` module. Admin manages commissions via UI but does not own calculations.
- **Delivery lifecycle** — owned by `delivery` module. Admin views/manages drivers but does not own delivery rules.
- **Notification delivery logic** — owned by `notifications` module. Admin views support tickets but does not own notification delivery.
- **Analytics calculations** — owned by `analytics` module. Admin composes analytics dashboards but does not own KPI calculations.
- **Auth/session logic** — owned by `auth` module. Admin enforces role checks via ProtectedRoute but does not own auth logic.

---

## Relationship with Auth

- `auth` owns authentication, session management, MFA, and role definitions.
- Admin enforces role checks via `ProtectedRoute` with `requiredRole={USER_ROLES.ADMIN}` and `allowedRoles={[USER_ROLES.ADMIN]}`.
- `AdminLayout` is defined in `src/components/ProtectedRoute.jsx` alongside other role layouts.
- Admin pages use `useAuthStore` for current user/profile/role.
- Admin **must not** change auth logic, ProtectedRoute behavior, or role definitions.

## Relationship with Users

- `users` owns user profiles, settings, and user-related data.
- Admin composes user management screens (`AdminUsersPage`, `AdminVendorsPage`, `AdminDriversPage`).
- Admin hooks (`useAdminUsers`, `useAdminUser`, `useUpdateUser`, `useDeleteUser`, `useRestoreUser`) wrap `usersApi` methods.
- Admin **must not** own user profile domain logic.

## Relationship with Catalog

- `catalog` owns products and product business logic.
- Admin composes product moderation pages (`AdminProductsPage`, `AdminModerationPage`).
- Admin **must not** own product CRUD logic.

## Relationship with Orders

- `orders` owns order lifecycle and status transitions.
- Admin displays and manages orders via `AdminOrdersPage`.
- Admin **must not** change order behavior or status transition rules.

## Relationship with Payments

- `payments` owns payment lifecycle and provider behavior.
- Admin views payment status in orders and payouts pages.
- Admin **must not** change payment provider behavior.

## Relationship with Commissions

- `commissions` owns commission lifecycle and calculations.
- Admin manages commissions via `AdminCommissionsPage` and `AdminCommissionManagementPage`.
- Admin **must not** change commission calculations or payout behavior.

## Relationship with Delivery

- `delivery` owns delivery lifecycle and driver management.
- Admin manages drivers via `AdminDriversPage` and views delivery performance.
- Admin **must not** change delivery behavior.

## Relationship with Analytics

- `analytics` owns metrics, reports, and KPI calculations.
- Admin composes analytics dashboards via `AdminAnalyticsPage` and `AdminReportsPage`.
- `useAdminStats()` hook wraps `analyticsApi.getAdminStats()`.
- Admin **must not** own KPI calculations.

## Relationship with Notifications

- `notifications` owns notification delivery and support ticket logic.
- Admin views support tickets via `AdminSupportTicketsPage`.
- Admin **must not** change notification delivery behavior.

---

## Module Structure

```
src/modules/admin/
├── index.js          # Public API entry point
├── api/
│   └── index.js      # platformSettings, fraudReportService, disputeService
├── data/
│   └── index.js      # Placeholder (admin data via services + Supabase directly)
├── domain/
│   └── index.js      # Placeholder (admin is composition surface, not domain owner)
├── ui/
│   └── index.js      # Admin pages, VerificationPanel, AdminLayout
├── hooks/
│   └── index.js      # adminKeys, useAdminUsers, useAdminStats, etc.
├── stores/
│   └── index.js      # Placeholder (no dedicated admin store)
├── utils/
│   └── index.js      # Placeholder (uses shared utilities)
└── README.md         # This file
```

---

## Allowed Dependencies

- `shared` — shared utilities and components
- `auth` — public API for role/admin checks (USER_ROLES, useAuthStore)
- `users` — public API for user facts (usersApi)
- `catalog` — public API for product facts (productsApi)
- `orders` — public API for order facts (ordersApi)
- `payments` — public API for payment facts
- `commissions` — public API for commission facts (commissionService)
- `delivery` — public API for driver/delivery facts
- `analytics` — public API for dashboard/report facts (analyticsApi, reportService)
- `notifications` — public API for notification facts
- `utils` — utility functions (logger, currency, encryption)
- `config` — configuration constants (APP_CONFIG)
- `lib/supabase` — Supabase client

## Forbidden Dependencies

- `checkout` internals — checkout flow is not an admin concern
- `cart` internals — cart state is not an admin concern
- `payment provider internals` — payment provider logic is not an admin concern
- `direct ownership of domain business logic` — admin composes, does not own

---

## Admin Route Map

Admin routes are defined in `src/router/AppRouter.jsx`:

| Path | Page | Status |
|---|---|---|
| `/admin` | → redirect to `/admin/dashboard` | ✅ Active |
| `/admin/dashboard` | `AdminDashboardPage` | ✅ Active |
| `/admin/users` | `AdminUsersPage` | ✅ Active |
| `/admin/products` | `AdminProductsPage` | ✅ Active |
| `/admin/orders` | `AdminOrdersPage` | ✅ Active |
| `/admin/analytics` | `AdminAnalyticsPage` | ✅ Active |
| `/admin/settings` | `AdminSettingsPage` | ✅ Active |
| `/admin/reports` | `AdminReportsPage` | ✅ Active |
| `/admin/vendors` | `AdminVendorsPage` | ✅ Active |
| `/admin/drivers` | `AdminDriversPage` | ✅ Active |
| `/admin/moderation` | `AdminModerationPage` | ✅ Active |
| `/admin/commissions` | `AdminCommissionsPage` | ✅ Active |
| `/admin/commission-management` | `AdminCommissionManagementPage` | ✅ Active |
| `/admin/payouts` | `AdminPayoutsPage` | ✅ Active |
| `/admin/reviews` | `AdminReviewsPage` | ✅ Active |
| `/admin/security` | `AdminSecurityPage` | ✅ Active |
| `/admin/verification` | `AdminVerificationPage` | ✅ Active |
| `/admin/support-tickets` | `AdminSupportTicketsPage` | ✅ Active |
| `/admin/support` | → redirect to `/admin/support-tickets` | ✅ Active |
| `/admin/disputes` | `AdminDisputeManagementPage` | ⚠️ Disabled (table not in DB) |
| `/admin/fraud-reports` | `AdminFraudReportsPage` | ⚠️ Disabled (table not in DB) |

All admin routes are protected by `ProtectedRoute` with:
- `Layout={AdminLayout}`
- `requiredRole={USER_ROLES.ADMIN}`
- `allowedRoles={[USER_ROLES.ADMIN]}`

---

## Migration Candidates for Future Sprints

| # | Item | Current Location | Target | Risk | Recommended Phase |
|---|---|---|---|---|---|
| MC1 | `src/pages/admin/Dashboard.jsx` | `src/pages/admin/` | `src/modules/admin/ui/` | Low — self-contained page | Phase 5+ |
| MC2 | `src/pages/admin/Users.jsx` | `src/pages/admin/` | `src/modules/admin/ui/` | Low — uses useAdminUsers hook | Phase 5+ |
| MC3 | `src/pages/admin/Products.jsx` | `src/pages/admin/` | `src/modules/admin/ui/` | Low — uses Supabase directly | Phase 5+ |
| MC4 | `src/pages/admin/Orders.jsx` (54KB) | `src/pages/admin/` | `src/modules/admin/ui/` | Medium — large file, uses Supabase directly | Phase 5+ |
| MC5 | `src/pages/admin/Analytics.jsx` | `src/pages/admin/` | `src/modules/admin/ui/` or `analytics/ui/` | Medium — uses Supabase + recharts | Phase 5+ |
| MC6 | `src/pages/admin/Settings.jsx` | `src/pages/admin/` | `src/modules/admin/ui/` | Low — uses platformSettings service | Phase 5+ |
| MC7 | `src/pages/admin/Reports.jsx` | `src/pages/admin/` | `src/modules/admin/ui/` or `analytics/ui/` | Low — uses reportService | Phase 5+ |
| MC8 | `src/pages/admin/Vendors.jsx` (32KB) | `src/pages/admin/` | `src/modules/admin/ui/` | Medium — large file | Phase 5+ |
| MC9 | `src/pages/admin/Drivers.jsx` (20KB) | `src/pages/admin/` | `src/modules/admin/ui/` | Medium — uses Supabase directly | Phase 5+ |
| MC10 | `src/pages/admin/Moderation.jsx` (30KB) | `src/pages/admin/` | `src/modules/admin/ui/` | Medium — large file | Phase 5+ |
| MC11 | `src/pages/admin/Commissions.jsx` | `src/pages/admin/` | `src/modules/admin/ui/` or `commissions/ui/` | Medium — uses Supabase + platformSettings | Phase 5+ |
| MC12 | `src/pages/admin/CommissionManagement.jsx` (29KB) | `src/pages/admin/` | `src/modules/admin/ui/` or `commissions/ui/` | Medium — uses commissionService + csvExport | Phase 5+ |
| MC13 | `src/pages/admin/Payouts.jsx` (29KB) | `src/pages/admin/` | `src/modules/admin/ui/` or `payments/ui/` | Medium — uses Supabase directly | Phase 5+ |
| MC14 | `src/pages/admin/Reviews.jsx` | `src/pages/admin/` | `src/modules/admin/ui/` or `reviews/ui/` | Low — uses reviewsApi | Phase 5+ |
| MC15 | `src/pages/admin/Security.jsx` (38KB) | `src/pages/admin/` | `src/modules/admin/ui/` | Medium — large file, uses multiple services | Phase 5+ |
| MC16 | `src/pages/admin/Verification.jsx` | `src/pages/admin/` | `src/modules/admin/ui/` | Low — thin wrapper around VerificationPanel | Phase 5+ |
| MC17 | `src/pages/admin/SupportTickets.jsx` | `src/pages/admin/` | `src/modules/admin/ui/` or `notifications/ui/` | Low — small file | Phase 5+ |
| MC18 | `src/pages/admin/SettingsAuditLog.jsx` | `src/pages/admin/` | `src/modules/admin/ui/` | Low — uses platformSettings | Phase 5+ |
| MC19 | `src/pages/admin/CircuitBreakers.jsx` | `src/pages/admin/` | `src/modules/admin/ui/` | Medium — uses Supabase + auditLogger | Phase 5+ |
| MC20 | `src/pages/admin/DisputeManagement.jsx` | `src/pages/admin/` | `src/modules/admin/ui/` | Medium — disabled in router, uses disputeService | Phase 5+ |
| MC21 | `src/pages/admin/FraudReports.jsx` | `src/pages/admin/` | `src/modules/admin/ui/` | Medium — disabled in router, uses fraudReportService | Phase 5+ |
| MC22 | `src/components/admin/VerificationPanel.jsx` | `src/components/admin/` | `src/modules/admin/ui/` | Low — self-contained component | Phase 5+ |
| MC23 | `AdminLayout` in `src/components/ProtectedRoute.jsx` | `src/components/` | `src/modules/admin/ui/` | Medium — part of ProtectedRoute file with other layouts | Phase 5+ |
| MC24 | `src/services/platformSettings.js` | `src/services/` | `src/modules/admin/api/` | Low — admin-specific service | Phase 5+ |
| MC25 | `src/services/fraudReportService.js` | `src/services/` | `src/modules/admin/api/` | Low — admin-specific service | Phase 5+ |
| MC26 | `src/services/disputeService.js` | `src/services/` | `src/modules/admin/api/` | Low — admin-specific service | Phase 5+ |
| MC27 | Admin hooks in `useVendorAdminQueries.js` | `src/hooks/queries/` | `src/modules/admin/hooks/` | Medium — mixed with vendor hooks, needs splitting | Phase 5+ |

---

## Safety Notes

### Permissions and Role Enforcement

- **Admin role check** is enforced by `ProtectedRoute` with `requiredRole={USER_ROLES.ADMIN}` and `allowedRoles={[USER_ROLES.ADMIN]}`.
- `ProtectedRoute` checks `profile.role` from `useAuthStore` and redirects to `/unauthorized` if the role doesn't match.
- **Do not change ProtectedRoute behavior.**
- **Do not change role definitions** in `src/constants/roles.js`.
- **Do not change admin permission checks** in any admin page.

### Admin Layout

- `AdminLayout` is defined in `src/components/ProtectedRoute.jsx` and provides the sidebar navigation for admin pages.
- It includes links to all admin pages (dashboard, users, vendors, drivers, products, orders, analytics, reports, moderation, commissions, commission-management, payouts, reviews, support-tickets, security, settings).
- Two routes are **temporarily disabled** in the sidebar and router: `disputes` and `fraud-reports` (tables do not exist in DB schema).
- **Do not change AdminLayout navigation links or structure.**

### Admin Pages

- Admin pages use a mix of **Supabase direct queries** and **service/hook abstractions**.
- Some pages (Dashboard, Orders, Products, Vendors, Drivers, Moderation, Security, CircuitBreakers) query Supabase directly.
- Other pages (Users, Settings, Reports, CommissionManagement, Reviews, SupportTickets) use services and hooks.
- **Do not change any admin page behavior.**
- **Do not change any Supabase queries in admin pages.**

### Platform Settings

- `platformSettings` service manages platform-wide settings (commission rate, platform fee, toggles).
- Settings changes are logged in `settings_audit_log` table.
- **Do not change platform settings behavior.**
- **Do not change settings audit log behavior.**

### Fraud Reports and Disputes

- `fraudReportService` and `disputeService` are admin-specific services for managing fraud reports and payment disputes.
- Both are **temporarily disabled** in the router because the `fraud_reports` and `payment_disputes` tables do not exist in the DB schema.
- The services are re-exported but the pages are not routed.
- **Do not change fraud report or dispute behavior.**

### Admin Hooks

- Admin hooks (`useAdminUsers`, `useAdminUser`, `useDeletedUsers`, `useAdminStats`, `useUpdateUser`, `useDeleteUser`, `useRestoreUser`) are in `src/hooks/queries/useVendorAdminQueries.js` alongside vendor hooks.
- `useAdminStats` wraps `analyticsApi.getAdminStats()` — it is an analytics hook used by admin.
- **Do not change admin hook behavior.**

### Supabase Tables Accessed by Admin

- `profiles` — user management (list, update, delete, restore)
- `products` — product moderation (approve, reject, feature)
- `orders` — order management (view, filter, update status)
- `order_items` — order detail view
- `payouts` — payout management
- `commissions` — commission management
- `platform_settings` — platform settings
- `settings_audit_log` — settings change audit trail
- `reviews` — review moderation
- `deliveries` — delivery/driver management
- `security_alerts` — security alerts (Security page)
- `blocked_ips` — IP blocking (Security page)
- `fraud_reports` — fraud reports (disabled, table not in DB)
- `payment_disputes` — payment disputes (disabled, table not in DB)
- **Do not modify schema or RLS policies.**
