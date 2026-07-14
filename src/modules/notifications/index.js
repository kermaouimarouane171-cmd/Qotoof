/**
 * Notifications Module — Public API Entry Point (Phase 3.3)
 *
 * This module exposes existing notification functionality through a clean public API.
 * It is a re-export/wrapper layer only — no business logic changes.
 *
 * Public API:
 *   import { notificationsApi, useNotifications, resolveNotificationLink } from '@/modules/notifications'
 *
 * Phase 6.18 — Barrel Safety:
 * UI exports (NotificationLink, NotificationsPage) removed from root barrel.
 * UI exports remain available via `src/modules/notifications/ui/index.js` for intra-module use.
 * App code imports NotificationLink directly from `@/components/notifications/NotificationLink`
 * and NotificationsPage via `lazy(() => import('@/pages/Notifications'))` — not through this barrel.
 * This prevents eager loading of NotificationLink.jsx (which imports notifications service)
 * when importing lightweight symbols (APIs, domain helpers, hooks).
 *
 * The notifications module owns:
 *   - notification records (create, read, mark as read, delete)
 *   - notification counts (unread count)
 *   - realtime notification subscriptions
 *   - notification formatting/display helpers
 *   - notification-related hooks
 *
 * Notification preferences are currently re-exported here for backward
 * compatibility but should migrate to the users module in the future.
 *
 * Allowed dependencies:
 *   - shared, auth (public API for current user), users (public API for
 *     preferences in future), utils, config, lib/supabase
 *
 * Forbidden dependencies:
 *   - checkout internals, payments internals, delivery internals,
 *     orders internals, admin dashboard composition
 */

// ── API ──────────────────────────────────────────────────────────────────
export {
  notificationsApi,
  notificationEvents,
  dispatchNotificationBadgeUpdate,
  dispatchNotificationPreferencesUpdated,
  createOrderNotification,
  createProductApprovalNotification,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORY_OPTIONS,
  NOTIFICATION_PREFERENCE_FIELDS,
  normalizeNotificationPreferences,
  emailService,
  useEmail,
} from './api'

// ── Domain ───────────────────────────────────────────────────────────────
export {
  normalizeNotificationCategory,
  getNotificationPreferenceKey,
  isNotificationRead,
  resolveNotificationLink,
  resolveNotificationActionLabel,
  normalizeNotification,
  isWithinQuietHours,
  shouldMuteNotificationPreview,
} from './domain'

// ── Hooks ────────────────────────────────────────────────────────────────
export {
  notificationKeys,
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useNotificationPreferences,
  useSaveNotificationPreferences,
  useRealtimeNotifications,
} from './hooks'

// ── Utils ────────────────────────────────────────────────────────────────
export {
  normalizeNotificationCategory as utilsNormalizeNotificationCategory,
  getNotificationPreferenceKey as utilsGetNotificationPreferenceKey,
  isNotificationRead as utilsIsNotificationRead,
  resolveNotificationLink as utilsResolveNotificationLink,
  resolveNotificationActionLabel as utilsResolveNotificationActionLabel,
  normalizeNotification as utilsNormalizeNotification,
  isWithinQuietHours as utilsIsWithinQuietHours,
  shouldMuteNotificationPreview as utilsShouldMuteNotificationPreview,
} from './utils'
