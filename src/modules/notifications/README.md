# Notifications Module

**Phase:** 3.3 — Notifications Module Foundation (re-export layer)  
**Status:** Wrapper/re-export foundation only. No files moved. No behavior changed.

---

## Module Responsibility

The notifications module owns:

- **Notification records** — creating, reading, marking as read, soft-deleting notifications in the `notifications` table
- **Notification counts** — unread count queries and badge count updates
- **Notification list/dropdown UI** — `NotificationLink` (bell icon with badge), `NotificationsPage` (full notification list with filters, preferences, and mark-as-read)
- **Realtime notification subscriptions** — `notificationsApi.subscribe()` for Supabase Realtime `postgres_changes` on `notifications` table, `useRealtimeNotifications` hook from `realtime.js`
- **Notification formatting/display helpers** — `normalizeNotification`, `normalizeNotificationCategory`, `isNotificationRead`, `resolveNotificationLink`, `resolveNotificationActionLabel`, `isWithinQuietHours`, `shouldMuteNotificationPreview`
- **Notification-related hooks** — `useNotifications`, `useUnreadCount`, `useMarkAsRead`, `useMarkAllAsRead`, `useNotificationPreferences`, `useSaveNotificationPreferences`, `notificationKeys`
- **Notification events** — `notificationEvents.badge` and `notificationEvents.preferences` CustomEvent dispatchers for cross-component communication
- **Order notification creation** — `createOrderNotification` (generates buyer/vendor/driver notifications on order status transitions)
- **Product approval notification creation** — `createProductApprovalNotification` (notifies vendor of product approval/rejection)
- ~~**Commission notification triggers** — `commissionNotifications`~~ — removed from notifications re-export in Phase 7.32. Now exclusively exported from `@/modules/commissions`.
- **Email delivery channel** — `emailService` (sends emails via `send-email` Supabase Edge Function using Resend)

## What Does NOT Belong in Notifications

- **User profile ownership** — owned by `users` module. Notifications reads user identity from `useAuthStore` only.
- **User settings ownership** — owned by `users` module. `user_settings` table is a users concern.
- **Notification preference ownership (long-term)** — `notification_preferences` table is a user-owned setting. Preference constants and helpers have been extracted to `src/services/notificationPreferences.js` (Phase 3.4). The notifications module re-exports them for backward compatibility. Future migration should move preference ownership entirely to `users` module.
- **Auth/session logic** — owned by `auth` module. Notifications reads `user.id` from `useAuthStore` only.
- **Order lifecycle** — owned by `orders` module. Notifications only creates notification records when order status changes; it does not own order status transitions.
- **Payment lifecycle** — owned by `payments` module. Notifications only creates notification records for payment/commission events.
- **Delivery lifecycle** — owned by `delivery` module. Notifications only creates notification records for delivery events.
- **Cart state** — owned by `cart` module.
- **Admin dashboard composition** — not a notifications concern.
- **Support tickets** — `useNotificationQueries.js` previously also exported support ticket hooks (`useSupportTickets`, `useSupportTicket`, `useCreateTicket`, `useReplyToTicket`). These have been extracted to `src/hooks/queries/useSupportTicketQueries.js` (Phase 3.4). They are NOT re-exported from the notifications module. They belong in a future `support` module. `useNotificationQueries.js` re-exports them for backward compatibility only.

---

## Relationship with Users

- **Users owns notification preferences** — the `notification_preferences` table is a user-owned setting.
- **Phase 3.4 extraction** — preference constants and helpers (`DEFAULT_NOTIFICATION_PREFERENCES`, `NOTIFICATION_CATEGORY_OPTIONS`, `NOTIFICATION_PREFERENCE_FIELDS`, `normalizeNotificationPreferences`, `isWithinQuietHours`, `shouldMuteNotificationPreview`, `normalizeNotificationCategory`, `getNotificationPreferenceKey`, `dispatchNotificationPreferencesUpdated`) have been extracted to `src/services/notificationPreferences.js`.
- **Notifications re-exports** these helpers from `notificationPreferences.js` for backward compatibility.
- **Users module** re-exports preference constants from `notificationPreferences.js` directly.
- **`notificationsApi.getPreferences` and `notificationsApi.savePreferences`** remain in `notifications.js` because they are methods on the `notificationsApi` object. They use `normalizeNotificationPreferences` from `notificationPreferences.js` internally.
- **Future migration** should move `notificationsApi.getPreferences` and `notificationsApi.savePreferences` to a users-module API, and remove preference re-exports from the notifications module.
- **No circular dependency** — `notificationPreferences.js` does not import from `notifications.js`. `notifications.js` imports from `notificationPreferences.js` (one-directional).

## Relationship with Orders

- Orders **triggers** notifications via `createOrderNotification(order, oldStatus, newStatus)` when order status changes.
- Notifications **only creates** notification records for buyer/vendor/driver based on order status templates.
- Notifications does **not** own order status transitions or order lifecycle.
- Future: orders should call `notificationsApi.create()` or use an event system instead of importing `createOrderNotification` directly.

## Relationship with Payments

- Payments (via `commissionService.js`) **triggers** notifications via `commissionNotifications` and `notificationsApi.create()`.
- Notifications **only creates** notification records for commission events (sale confirmed, month-end, reminders, frozen, payment confirmed).
- Notifications does **not** own commission calculation or payment processing.
- **`commissionNotifications.js`** was previously re-exported from the notifications module for backward compatibility. It is primarily a commission concern — it contains commission business rules (sale confirmed, month-end summary, reminders, account freeze, payment confirmation) that happen to send notifications. The re-export was removed in Phase 7.32.
- **Long-term owner: `src/modules/commissions`** — implementation moved to `src/modules/commissions/api/commissionNotifications.js` in Phase 7.24. Re-export from notifications module removed in Phase 7.32.
- **Notifications should own notification delivery/storage/display**, not commission business rules. The current coupling exists because `commissionNotifications.js` uses `notificationsApi.create()` internally, but that is a consumer relationship, not an ownership relationship.
- **Migration plan:**
  1. ✅ Phase 4.4: Created `src/modules/commissions/` and re-exported `commissionNotifications` from there.
  2. ✅ Phase 7.24: Moved `commissionNotifications.js` to `src/modules/commissions/api/`. Updated notifications barrel to re-export from `@/modules/commissions`.
  3. ✅ Phase 7.25–7.30: Updated `commissionService.js` import, moved to commissions module, deleted compatibility stub.
  4. ✅ Phase 7.32: Removed `commissionNotifications` re-export from notifications module. Zero consumers were using it.

## Relationship with Delivery

- Delivery status changes **trigger** notifications via `createOrderNotification` (e.g., `driver_assigned`, `driver_picked_up`, `on_the_way`, `delivered`).
- Notifications does **not** own delivery lifecycle or delivery tracking.

## Relationship with Auth

- Notifications reads `user.id` from `useAuthStore` to know which user's notifications to fetch/subscribe.
- Notifications does **not** own auth session logic, login, logout, or profile fetching.
- `NotificationLink` component uses `useAuthStore` to get current user and renders nothing if no user.

## Relationship with Admin

- Admin pages may display notifications or trigger notifications to vendors (e.g., product approval, commission confirmation).
- Notifications does **not** own admin dashboard composition.
- `commissionService.js` (used by admin) calls `notificationsApi.create()` to notify admins and vendors of commission events.

---

## Public API (Root Barrel — Lightweight)

The root barrel exports only lightweight non-UI symbols: API services, domain helpers, and hooks.

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

### Intentionally NOT Exported from Root (Phase 6.18)

UI/page-level exports were removed from the root barrel to prevent eager loading of `NotificationLink.jsx` (which imports notifications service) when importing lightweight symbols (APIs, domain helpers, hooks).

| Symbol | Available Via |
|---|---|
| `NotificationLink` | `@/components/notifications/NotificationLink` or `@/modules/notifications/ui` |
| `NotificationsPage` | `lazy(() => import('@/pages/Notifications'))` or `@/modules/notifications/ui` |

### UI / Page Import Policy

App code should import notification components from their original paths:
```js
import NotificationLink from '@/components/notifications/NotificationLink'
const NotificationsPage = lazy(() => import('@/pages/Notifications'))
```

UI exports remain available through `src/modules/notifications/ui/index.js` for intra-module use only.

---

## Module Structure

```
src/modules/notifications/
├── index.js          # Public API entry point
├── api/
│   └── index.js      # Re-exports notificationsApi, commissionNotifications, emailService, preference helpers
├── data/
│   └── index.js      # Placeholder (notificationsApi is closest to data layer)
├── domain/
│   └── index.js      # Re-exports notification formatting helpers, category normalization, events
├── ui/
│   └── index.js      # Re-exports NotificationLink, NotificationsPage
├── hooks/
│   └── index.js      # Re-exports notificationKeys, useNotifications, useUnreadCount, useMarkAsRead, useMarkAllAsRead, useNotificationPreferences, useSaveNotificationPreferences, useRealtimeNotifications
├── stores/
│   └── index.js      # Placeholder (no dedicated notification store)
├── utils/
│   └── index.js      # Re-exports notification formatting/display helpers
└── README.md         # This file
```

---

## Current Notifications Architecture

### Where Notifications Are Created

| Function | Location | Trigger | Description |
|---|---|---|---|
| `notificationsApi.create()` | `notifications.js:426` | Called by various services | Creates notification via `create_user_notification` RPC (fallback: direct insert). Normalizes payload, resolves action URL/label. |
| `createOrderNotification()` | `notifications.js:496` | Order status changes | Creates buyer/vendor/driver notifications from templates based on new order status. |
| `createProductApprovalNotification()` | `notifications.js:638` | Admin product approval/rejection | Creates vendor notification for product approval/rejection. |
| `commissionNotifications.*()` | `commissionNotifications.js:48` | Commission events | Creates in-app + email notifications for commission lifecycle events. |
| `notificationsApi.create()` in `commissionService.js` | `commissionService.js:453,661` | Commission payment notice, manual unfreeze | Creates admin/vendor notifications for commission payment notices and manual unfreeze. |

### Where Notifications Are Read

| Function | Location | Description |
|---|---|---|
| `notificationsApi.getUserNotifications()` | `notifications.js:271` | Fetches user notifications with filters (category, unreadOnly, readOnly, pagination). |
| `useNotifications()` | `useNotificationQueries.js:26` | React Query hook for notification list with Supabase session. |
| `useUnreadCount()` | `useNotificationQueries.js:62` | React Query hook for unread count with polling. |

### Where Notifications Are Marked as Read

| Function | Location | Description |
|---|---|---|
| `notificationsApi.markAsRead()` | `notifications.js:327` | Marks single notification as read with retry. |
| `notificationsApi.markAllAsRead()` | `notifications.js:345` | Marks all unread notifications as read with optional category filter. |
| `useMarkAsRead()` | `useNotificationQueries.js:89` | React Query mutation for single mark-as-read. |
| `useMarkAllAsRead()` | `useNotificationQueries.js:106` | React Query mutation for mark-all-as-read. |

### Where Notification Counts Are Calculated

| Function | Location | Description |
|---|---|---|
| `notificationsApi.getUnreadCount()` | `notifications.js:315` | Counts unread notifications via Supabase `count: 'exact'`. |
| `useUnreadCount()` | `useNotificationQueries.js:62` | React Query hook with 30s refetch interval. |
| `NotificationLink` component | `NotificationLink.jsx:74` | Fetches unread count, updates badge, dispatches `notificationEvents.badge` CustomEvent. |

### Where Realtime Subscriptions Happen

| Function | Location | Description |
|---|---|---|
| `notificationsApi.subscribe()` | `notifications.js:460` | Creates Supabase Realtime channel on `notifications` table filtered by `user_id`. Uses unique scope-based channel names. Returns unsubscribe function. |
| `useRealtimeNotifications()` | `realtime.js:341` | React hook wrapping `realtimeService.subscribeToNotifications()`. Uses `realtimeManager` for channel deduplication. |
| `NotificationLink` component | `NotificationLink.jsx:132` | Subscribes to realtime notifications with `{ scope: 'badge' }`, shows toast on INSERT when not on `/notifications` page. |

### Where Notification Preferences Are Read/Written

| Function | Location | Description |
|---|---|---|
| `notificationsApi.getPreferences()` | `notifications.js:388` | Fetches preferences from `notification_preferences` table, creates default if missing. |
| `notificationsApi.savePreferences()` | `notifications.js:411` | Upserts preferences, dispatches `notificationEvents.preferences` event. |
| `useNotificationPreferences()` | `useNotificationQueries.js:127` | React Query hook for preferences. |
| `useSaveNotificationPreferences()` | `useNotificationQueries.js:140` | React Query mutation for saving preferences. |
| `NotificationsPage` component | `Notifications.jsx:28-36` | Imports preference helpers directly from `@/services/notifications`. |

### Where Notifications Are Shown in UI

| Component | Location | Description |
|---|---|---|
| `NotificationLink` | `components/notifications/NotificationLink.jsx` | Bell icon with unread badge in navbar. Subscribes to realtime, shows toast on new notifications. |
| `NotificationsPage` | `pages/Notifications.jsx` | Full notifications page with list, filters (category, read/unread), mark-as-read, mark-all-as-read, delete, notification preferences settings, pagination. 838 lines. |

---

## Allowed Dependencies

- `@/modules/shared` — shared UI components, hooks, utilities
- `@/modules/auth` — auth public API (for current user identity via `useAuthStore`)
- `@/modules/users` — users public API (for preferences in future migration)
- `@/utils` — general utilities (`logger`, `withRetry`)
- `@/config` / `@/lib/config` — configuration
- `@/services/supabase` — Supabase client
- `@/services/notifications` — core notification service (source of re-exports)
- `@/services/emailService` — email delivery service
- `@/services/realtime` — realtime subscription service
- `@/hooks/queries/useNotificationQueries` — notification React Query hooks

## Forbidden Dependencies

- `@/modules/checkout` — checkout internals
- `@/modules/payments` — payments internals
- `@/modules/delivery` — delivery internals
- `@/modules/orders` — orders internals
- `@/modules/cart` — cart internals
- Admin dashboard composition — not a notifications concern

---

## Notification Events (CustomEvent System)

The notifications module uses a lightweight `CustomEvent` system for cross-component communication:

| Event Name | Constant | Dispatcher | Description |
|---|---|---|---|
| `notification-badge-update` | `notificationEvents.badge` | `dispatchNotificationBadgeUpdate(count)` | Notifies components that unread count changed. `NotificationLink` listens to this. |
| `notification-preferences-updated` | `notificationEvents.preferences` | `dispatchNotificationPreferencesUpdated(prefs)` | Notifies components that preferences changed. `NotificationLink` listens to this. |

This is **not** a new event system — it already exists in `notifications.js` and is re-exported here unchanged.

---

## Notification Categories

| Category ID | Label (AR) | Preference Key |
|---|---|---|
| `order_update` | الطلبات | `order_updates` |
| `payment` | المدفوعات | `payment_updates` |
| `delivery` | التوصيل | `delivery_updates` |
| `review` | التقييمات | `review_updates` |
| `loyalty` | الولاء | `loyalty_updates` |
| `promotion` | العروض | `promotional_updates` |
| `inventory` | المخزون | `inventory_alerts` |
| `message` | الرسائل | `system_updates` |
| `system` | النظام | `system_updates` |

Category aliases are handled by `normalizeNotificationCategory()` which maps various type strings (e.g., `order`, `new_order`, `commission`, `bank_transfer`, `delivery_assignment`, etc.) to canonical category IDs.

---

## Supabase Tables

| Table | Purpose | Access Pattern |
|---|---|---|
| `notifications` | Notification records | CRUD via `notificationsApi` and React Query hooks |
| `notification_preferences` | User notification preferences | Read/write via `notificationsApi.getPreferences/savePreferences` |

### RPC Functions

| RPC | Purpose |
|---|---|
| `create_user_notification` | Creates notification record server-side (preferred path). Falls back to direct insert if RPC unavailable. |

### Edge Functions

| Edge Function | Purpose |
|---|---|
| `send-email` | Sends email via Resend. Called by `emailService.sendEmail()`. |

**Note:** No Supabase queries, RPC functions, Edge Functions, database schema, or RLS policies are modified in this phase.

---

## Migration Candidates for Future Sprints

| File | Current Location | Migration Target | Risk | Notes |
|---|---|---|---|---|
| `notifications.js` | `src/services/` | `src/modules/notifications/api/` | **Medium** | 669 lines. Mixes notification delivery with preference management. Must split preferences into users module before moving. |
| `commissionNotifications.js` | `@/modules/commissions/api/` | Already migrated | ✅ Done | Moved in Phase 7.24. Stub deleted Phase 7.26. Re-export removed from notifications module Phase 7.32. |
| `NotificationLink.jsx` | `src/components/notifications/` | `src/modules/notifications/ui/` | **Low** | 167 lines. Self-contained bell badge component. Safe to move. |
| `Notifications.jsx` | `src/pages/` | `src/modules/notifications/ui/` | **Medium** | 838 lines. Large page component with preferences UI. Must verify all imports. |
| `useNotificationQueries.js` | `src/hooks/queries/` | `src/modules/notifications/hooks/` | **Medium** | 247 lines. Mixes notification hooks with support ticket hooks. Must split support hooks before moving. |
| `realtime.js` (notification parts) | `src/services/` | `src/modules/notifications/data/` or keep shared | **High** | 385 lines. Shared realtime service for orders, notifications, products, deliveries. Must not move entirely — only notification-specific parts. |
| `emailService.js` | `src/services/` | `src/modules/notifications/api/` or separate email module | **Medium** | 353 lines. Email delivery channel. May belong in a separate `communications` module. |
| `notification_preferences` (preference logic) | `notifications.js` | `src/modules/users/api/` | **Medium** | Preference management should move to users module. Must update all consumers. |

---

## Safety Notes

### Realtime Subscriptions

- `notificationsApi.subscribe()` creates unique Supabase Realtime channels with scope-based naming (`notifications:${userId}:${scope}:${sequence}`) to avoid channel conflicts.
- `useRealtimeNotifications` uses `realtimeManager` for channel deduplication across components.
- `NotificationLink` subscribes with `{ scope: 'badge' }` and cleans up on unmount.
- **No realtime behavior changed in this phase.**

### Notification Preferences

- Preferences are currently managed through `notificationsApi.getPreferences/savePreferences` in `notifications.js`.
- Both `users` module and `notifications` module re-export the same preference helpers from `notifications.js`.
- This is intentional for backward compatibility — no circular dependency exists at the module level.
- Future migration should move preference ownership to `users` module.
- **No preference behavior changed in this phase.**

### Notification Creation

- `notificationsApi.create()` uses `create_user_notification` RPC (preferred) with fallback to direct table insert.
- `createOrderNotification()` generates notifications from order status templates.
- `createProductApprovalNotification()` generates vendor notifications for product approval/rejection.
- `commissionNotifications.*()` generates in-app + email notifications for commission events.
- **No notification creation behavior changed in this phase.**

### Email Delivery

- `emailService` sends emails via `send-email` Supabase Edge Function using Resend.
- Handles order confirmations, order status updates, vendor new order alerts, commission notifications.
- Gracefully handles failures (returns error objects without throwing).
- **No email delivery behavior changed in this phase.**

### Notification Triggers

- Order status changes trigger `createOrderNotification` — unchanged.
- Commission events trigger `commissionNotifications` — unchanged.
- Product approval/rejection triggers `createProductApprovalNotification` — unchanged.
- Payment receipt upload triggers `notificationsApi.create` in `PaymentReceiptUpload.jsx` — unchanged.
- Fraud awareness, disputes, partnership requests trigger `notificationsApi.create` — unchanged.
- **No notification triggers changed in this phase.**

---

## Current Status

- **Phase 3.3:** ✅ Foundation created as re-export layer.
- **Files created:** 9 (index.js + 7 sub-layer index.js + README.md)
- **Files moved:** 0
- **Files deleted:** 0
- **Imports changed:** 0
- **Behavior changed:** No
- **Supabase queries changed:** No
- **Realtime subscriptions changed:** No
- **Notification preferences changed:** No
- **Notification triggers changed:** No
- **Email delivery changed:** No
- **Database schema / RLS changed:** No
- **Routes changed:** No
- **UI redesigned:** No
