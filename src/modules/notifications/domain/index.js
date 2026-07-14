/**
 * Notifications Module — Domain Layer (re-export)
 *
 * Re-exports notification-related domain logic, constants, and helpers.
 * No business logic changes.
 */

// ── Notification category helpers ────────────────────────────────────────
export {
  normalizeNotificationCategory,
  getNotificationPreferenceKey,
  isNotificationRead,
  resolveNotificationLink,
  resolveNotificationActionLabel,
  normalizeNotification,
  isWithinQuietHours,
  shouldMuteNotificationPreview,
} from '@/services/notifications'

// ── Notification preference constants (backward-compatible re-export) ────
// These are now defined in notificationPreferences.js (Phase 3.4 extraction).
// Re-exported here for backward compatibility. In the future, preference
// ownership should move to the users module.
export {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORY_OPTIONS,
  NOTIFICATION_PREFERENCE_FIELDS,
  normalizeNotificationPreferences,
} from '@/services/notificationPreferences'

// ── Notification events ──────────────────────────────────────────────────
export {
  notificationEvents,
  dispatchNotificationBadgeUpdate,
  dispatchNotificationPreferencesUpdated,
} from '@/services/notifications'
