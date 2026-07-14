/**
 * Notifications Module — Utils Layer (re-export)
 *
 * Re-exports notification-related utility/helper functions.
 * No utility logic changes.
 */

// ── Notification formatting and display helpers ──────────────────────────
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
