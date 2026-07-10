# Phase 3.3 — Notifications Module Foundation Report

**Phase:** 3.3 — Notifications Module Foundation  
**Date:** 2026-06-23  
**Status:** ✅ Completed  
**Approach:** Additive-first, behavior-preserving re-export layer

---

## 1. Confirmation: `.windsurfrules` Read and Followed

تم قراءة ملف `.windsurfrules` بالكامل وتم الالتزام بكل القواعد الواردة فيه:

- ✅ أصغر تغيير ممكن (re-export layer فقط، لا نقل ملفات)
- ✅ لا تغيير في Supabase queries أو database/RLS
- ✅ لا تغيير في Edge Functions
- ✅ لا تغيير في auth behavior
- ✅ لا تغيير في notification behavior
- ✅ لا `any` types
- ✅ لا `@ts-ignore` أو `@ts-expect-error`
- ✅ لا circular dependencies
- ✅ تم تشغيل lint و type-check بعد كل تغيير
- ✅ تم تشغيل lint, type-check, build, check:circular في النهاية

---

## 2. Current Notifications Architecture Summary

### Core Service

| File | Location | Lines | Role |
|---|---|---|---|
| `notifications.js` | `src/services/` | 669 | Core notification service: `notificationsApi` (CRUD, subscribe, preferences), formatting helpers, `createOrderNotification`, `createProductApprovalNotification`, `notificationEvents` |
| `commissionNotifications.js` | `src/services/` | 111 | Commission-specific notification triggers (in-app + email) |
| `emailService.js` | `src/services/` | 353 | Email delivery via `send-email` Edge Function (Resend) |
| `realtime.js` | `src/services/` | 385 | Shared realtime service with `subscribeToNotifications` and `useRealtimeNotifications` hook |

### UI Components

| File | Location | Lines | Role |
|---|---|---|---|
| `NotificationLink.jsx` | `src/components/notifications/` | 167 | Bell icon with unread badge, realtime subscription, toast on new notification |
| `Notifications.jsx` | `src/pages/` | 838 | Full notifications page: list, filters, mark-as-read, delete, preferences settings |

### Hooks

| File | Location | Lines | Role |
|---|---|---|---|
| `useNotificationQueries.js` | `src/hooks/queries/` | 247 | React Query hooks: `notificationKeys`, `useNotifications`, `useUnreadCount`, `useMarkAsRead`, `useMarkAllAsRead`, `useNotificationPreferences`, `useSaveNotificationPreferences` (also contains support ticket hooks — NOT re-exported) |

### Notification Architecture Details

**Where notifications are created:**
- `notificationsApi.create()` — via `create_user_notification` RPC with fallback to direct insert
- `createOrderNotification()` — templates for order status transitions (buyer/vendor/driver)
- `createProductApprovalNotification()` — vendor notification for product approval/rejection
- `commissionNotifications.*()` — in-app + email for commission events
- `notificationsApi.create()` calls in `commissionService.js`, `PaymentReceiptUpload.jsx`, `disputeService.js`, `fraudAwarenessService.js`, `partnershipService.js`

**Where notifications are read:**
- `notificationsApi.getUserNotifications()` — paginated list with filters
- `useNotifications()` — React Query hook
- `useUnreadCount()` — React Query hook with 30s polling

**Where notifications are marked as read:**
- `notificationsApi.markAsRead()` / `notificationsApi.markAllAsRead()`
- `useMarkAsRead()` / `useMarkAllAsRead()` — React Query mutations

**Where notification counts are calculated:**
- `notificationsApi.getUnreadCount()` — Supabase count query
- `NotificationLink` component — fetches count, dispatches `notificationEvents.badge` CustomEvent

**Where realtime subscriptions happen:**
- `notificationsApi.subscribe()` — Supabase Realtime channel on `notifications` table, scope-based naming
- `useRealtimeNotifications()` — React hook via `realtimeService.subscribeToNotifications()` with `realtimeManager` deduplication
- `NotificationLink` — subscribes with `{ scope: 'badge' }`, shows toast on INSERT

**Where notification preferences are read/written:**
- `notificationsApi.getPreferences()` / `notificationsApi.savePreferences()` — `notification_preferences` table
- `useNotificationPreferences()` / `useSaveNotificationPreferences()` — React Query hooks
- `NotificationsPage` — imports preference helpers directly from `@/services/notifications`

**Where notifications are shown in UI:**
- `NotificationLink` — bell badge in navbar
- `NotificationsPage` — full page with list, filters, preferences

### Files NOT Re-exported (Belong to Other Modules)

| File | Reason |
|---|---|
| `commissionService.js` | Commission logic — separate financial module (Phase 4) |
| `commissionNotifications.js` | Re-exported from notifications (creates notifications), but primarily a commission concern. Future: move to `commissions` module. |
| `useNotificationQueries.js` (support ticket parts) | Support tickets — future `support` module |
| `realtime.js` (non-notification parts) | Shared realtime service for orders, products, deliveries |
| `GeographicDeliveryNotification.jsx` | Delivery-specific UI component |
| `StoreEvolutionNotification.jsx` | Vendor-specific UI component |

---

## 3. Files Created

| File | Purpose |
|---|---|
| `src/modules/notifications/index.js` | Main public API entry point |
| `src/modules/notifications/api/index.js` | Re-exports notificationsApi, commissionNotifications, emailService, preference helpers |
| `src/modules/notifications/data/index.js` | Placeholder (notificationsApi is closest to data layer) |
| `src/modules/notifications/domain/index.js` | Re-exports notification formatting helpers, category normalization, events |
| `src/modules/notifications/ui/index.js` | Re-exports NotificationLink, NotificationsPage |
| `src/modules/notifications/hooks/index.js` | Re-exports notificationKeys, useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead, useNotificationPreferences, useSaveNotificationPreferences, useRealtimeNotifications |
| `src/modules/notifications/stores/index.js` | Placeholder (no dedicated notification store) |
| `src/modules/notifications/utils/index.js` | Re-exports notification formatting/display helpers |
| `src/modules/notifications/README.md` | Comprehensive module documentation |

**Total files created:** 9  
**Total files moved:** 0  
**Total files deleted:** 0

---

## 4. Files Re-exported/Wrapped (Not Moved)

| Source File | Re-exported From | Exports |
|---|---|---|
| `src/services/notifications.js` | `api/`, `domain/`, `utils/` | `notificationsApi`, `notificationEvents`, `dispatchNotificationBadgeUpdate`, `dispatchNotificationPreferencesUpdated`, `createOrderNotification`, `createProductApprovalNotification`, `DEFAULT_NOTIFICATION_PREFERENCES`, `NOTIFICATION_CATEGORY_OPTIONS`, `NOTIFICATION_PREFERENCE_FIELDS`, `normalizeNotificationPreferences`, `normalizeNotificationCategory`, `getNotificationPreferenceKey`, `isNotificationRead`, `resolveNotificationLink`, `resolveNotificationActionLabel`, `normalizeNotification`, `isWithinQuietHours`, `shouldMuteNotificationPreview` |
| `src/services/commissionNotifications.js` | `api/` | `commissionNotifications` |
| `src/services/emailService.js` | `api/` | `emailService`, `useEmail` |
| `src/services/realtime.js` | `hooks/` | `useRealtimeNotifications` |
| `src/hooks/queries/useNotificationQueries.js` | `hooks/` | `notificationKeys`, `useNotifications`, `useUnreadCount`, `useMarkAsRead`, `useMarkAllAsRead`, `useNotificationPreferences`, `useSaveNotificationPreferences` |
| `src/components/notifications/NotificationLink.jsx` | `ui/` | `NotificationLink` (default export) |
| `src/pages/Notifications.jsx` | `ui/` | `NotificationsPage` (default export) |

---

## 5. Public API Exposed by `src/modules/notifications`

```js
import {
  // API — notificationsApi (core CRUD + realtime)
  notificationsApi,
  notificationEvents,
  dispatchNotificationBadgeUpdate,
  dispatchNotificationPreferencesUpdated,
  createOrderNotification,
  createProductApprovalNotification,
  // API — preference helpers (legacy/backward-compatible)
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORY_OPTIONS,
  NOTIFICATION_PREFERENCE_FIELDS,
  normalizeNotificationPreferences,
  // API — commission notifications
  commissionNotifications,
  // API — email service
  emailService,
  useEmail,
  // Domain — formatting helpers
  normalizeNotificationCategory,
  getNotificationPreferenceKey,
  isNotificationRead,
  resolveNotificationLink,
  resolveNotificationActionLabel,
  normalizeNotification,
  isWithinQuietHours,
  shouldMuteNotificationPreview,
  // UI — components
  NotificationLink,
  NotificationsPage,
  // Hooks
  notificationKeys,
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useNotificationPreferences,
  useSaveNotificationPreferences,
  useRealtimeNotifications,
} from '@/modules/notifications'
```

---

## 6. Files Intentionally NOT Moved and Why

| File | Reason |
|---|---|
| `notifications.js` (669 lines) | **Medium risk.** Mixes notification delivery with preference management. Must split preferences into users module before moving. Documented as migration candidate. |
| `commissionNotifications.js` (111 lines) | Commission-specific notification triggers. Re-exported here but primarily a commission concern. Future: move to `commissions` module (Phase 4). |
| `emailService.js` (353 lines) | Email delivery channel. May belong in a separate `communications` module. Documented as migration candidate. |
| `realtime.js` (385 lines) | Shared realtime service for orders, notifications, products, deliveries. Must not move entirely — only notification-specific parts. **High risk.** |
| `Notifications.jsx` (838 lines) | Large page component with preferences UI. Must verify all imports before moving. **Medium risk.** |
| `useNotificationQueries.js` (247 lines) | Mixes notification hooks with support ticket hooks. Must split support hooks before moving. **Medium risk.** |
| `NotificationLink.jsx` (167 lines) | Self-contained but uses `useAuthStore` directly. **Low risk** but deferred for safety. |
| `GeographicDeliveryNotification.jsx` | Delivery-specific UI, not a notifications concern. |
| `StoreEvolutionNotification.jsx` | Vendor-specific UI, not a notifications concern. |

---

## 7. Imports Changed

**No imports were changed.** This phase is purely additive — the new module files re-export existing functionality without modifying any existing import statements.

---

## 8. Behavior Verification

| Behavior | Changed? | Details |
|---|---|---|
| Notification creation | ✅ Unchanged | `notificationsApi.create()`, `createOrderNotification()`, `createProductApprovalNotification()`, `commissionNotifications.*()` all unchanged |
| Notification reading | ✅ Unchanged | `notificationsApi.getUserNotifications()`, `useNotifications()`, `useUnreadCount()` all unchanged |
| Mark-as-read | ✅ Unchanged | `notificationsApi.markAsRead()`, `notificationsApi.markAllAsRead()`, `useMarkAsRead()`, `useMarkAllAsRead()` all unchanged |
| Realtime subscriptions | ✅ Unchanged | `notificationsApi.subscribe()`, `useRealtimeNotifications()` all unchanged. Channel naming, scope-based deduplication, and cleanup all preserved. |
| Notification preferences | ✅ Unchanged | `notificationsApi.getPreferences()`, `notificationsApi.savePreferences()`, `useNotificationPreferences()`, `useSaveNotificationPreferences()` all unchanged. Preference helpers re-exported for backward compatibility. |
| User/settings behavior | ✅ Unchanged | No user settings or auth behavior modified |
| Order/payment/delivery notification triggers | ✅ Unchanged | `createOrderNotification`, `commissionNotifications`, `PaymentReceiptUpload.jsx` notification calls, `disputeService.js`, `fraudAwarenessService.js`, `partnershipService.js` notification calls all unchanged |
| Routes | ✅ Unchanged | No routes modified |
| Supabase queries | ✅ Unchanged | No Supabase queries modified |
| Database schema / RLS | ✅ Unchanged | No schema or RLS changes |
| Edge Functions | ✅ Unchanged | No Edge Functions modified |
| Email delivery | ✅ Unchanged | `emailService` and `send-email` Edge Function unchanged |

---

## 9. Documentation Updates

### Documents Updated

| Document | Changes |
|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | Updated status line to include Phase 3.3 completion; added Phase 3.3 achievement note with detailed export list |
| `ARCHITECTURE_GUIDE.md` | Added Phase 3.3 completion status to progress section |
| `DEVELOPER_GUIDE.md` | Added notifications module to project structure tree with sub-layer details |
| `src/modules/notifications/README.md` | Created comprehensive module documentation (responsibility, public API, relationships, architecture, migration candidates, safety notes) |

### Documents Checked But Not Changed

| Document | Reason |
|---|---|
| `src/modules/users/README.md` | Already documents notification preferences as user-owned and references `notifications.js`. No changes needed — the users module already re-exports preference helpers. |
| `src/modules/orders/README.md` | Documents order module boundaries. No notification-related changes needed. |
| `src/modules/payments/README.md` | Documents payment module boundaries. No notification-related changes needed. |
| `src/modules/delivery/README.md` | Documents delivery module boundaries. No notification-related changes needed. |
| `src/modules/checkout/README.md` | Documents checkout module boundaries. No notification-related changes needed. |
| `src/modules/shared/README.md` | Documents shared module. No notification-related changes needed. |
| `src/app/README.md` | Documents app composition layer. No notification-related changes needed. |
| `docs/architecture/phase-2-final-gate-report.md` | Phase 2 report. No changes needed. |
| `docs/architecture/phase-2-6-critical-flow-preparation-report.md` | Phase 2.6 report. No changes needed. |
| `docs/architecture/phase-3-1-checkout-module-report.md` | Phase 3.1 report. No changes needed. |
| `docs/architecture/phase-3-2-payments-module-report.md` | Phase 3.2 report. No changes needed. |

### Outdated Documents Found

None. All documentation is current.

### Documentation Still Needing Future Updates

- `src/modules/users/README.md` — When notification preferences are extracted from `notifications.js` into the users module, the users README should be updated to reflect full preference ownership.
- `src/modules/notifications/README.md` — When `commissionNotifications.js` moves to a commissions module (Phase 4), the notifications README should be updated to remove the commission notifications re-export.

---

## 10. Verification Results

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ Exit code 0, no errors |
| Type-check | `npm run type-check` | ✅ Exit code 0, no errors |
| Build | `npm run build` | ✅ Exit code 0, built successfully (1m 54s) |
| Circular dependencies | `npm run check:circular` | ✅ No circular dependency found |

---

## 11. Module Boundaries

### What Notifications Owns

- Notification records CRUD (create, read, mark as read, soft-delete)
- Notification unread count queries and badge updates
- Notification list/dropdown UI (`NotificationLink`, `NotificationsPage`)
- Realtime notification subscriptions (`notificationsApi.subscribe`, `useRealtimeNotifications`)
- Notification formatting/display helpers
- Notification-related React Query hooks
- Notification CustomEvent system (`notificationEvents.badge`, `notificationEvents.preferences`)
- Order notification creation templates (`createOrderNotification`)
- Product approval notification creation (`createProductApprovalNotification`)
- Commission notification triggers (`commissionNotifications` — re-exported, future: move to commissions)
- Email delivery channel (`emailService` — re-exported, future: may become separate module)

### What Notifications Does NOT Own

- User profile ownership (owned by `users`)
- User settings ownership (owned by `users`)
- Notification preference ownership long-term (should migrate to `users`)
- Auth/session logic (owned by `auth`)
- Order lifecycle (owned by `orders`)
- Payment lifecycle (owned by `payments`)
- Delivery lifecycle (owned by `delivery`)
- Cart state (owned by `cart`)
- Admin dashboard composition
- Support tickets (future `support` module)
- Commission calculation (future `commissions` module)

---

## 12. Phase 3 Foundation Status

Phase 3 (Operations Modules) now includes three completed module foundations:

| Phase | Module | Status |
|---|---|---|
| 3.1 | `src/modules/checkout/` | ✅ Completed |
| 3.2 | `src/modules/payments/` | ✅ Completed |
| 3.3 | `src/modules/notifications/` | ✅ Completed |

### Is Phase 3 Foundation Complete?

**Yes.** The three critical operations modules (checkout, payments, notifications) now have re-export foundations. All existing functionality is accessible through clean public APIs without any behavior changes.

### Is a Phase 3 Final Gate Recommended Before Phase 4?

**Yes.** A Phase 3 Final Gate is recommended to verify:
1. All three module foundations are stable and pass all checks
2. No circular dependencies exist across the codebase
3. All existing imports continue to work
4. No behavior changes have been introduced
5. Documentation is consistent across all modules
6. Module boundaries are clear and respected

### Is a Notification Preferences Extraction Step Recommended Before Future Migration?

**Yes.** The following extraction steps are recommended before moving `notifications.js`:

1. **Extract preference management from `notifications.js`** into a separate `notificationPreferences.js` file or into the users module's API layer
2. **Update all consumers** of preference helpers to import from `@/modules/users` instead of `@/services/notifications` or `@/modules/notifications`
3. **Remove preference re-exports** from the notifications module once all consumers use the users module
4. **Split `useNotificationQueries.js`** to separate support ticket hooks from notification hooks
5. **Verify no circular dependency** between `users` and `notifications` modules after extraction

These steps should be performed in a dedicated sprint before attempting to move `notifications.js` into the module directory.

---

## 13. Conclusion

Phase 3.3 successfully creates the notifications module foundation as a re-export layer. All existing notification functionality is now accessible through `src/modules/notifications/` without any behavior changes, file moves, or import rewrites. The module provides a clean public API with clear boundaries, comprehensive documentation, and full verification (lint, type-check, build, circular dependencies all pass).

The notifications module is the third and final module in Phase 3 (Operations Modules), completing the Phase 3 foundation alongside checkout (3.1) and payments (3.2).
