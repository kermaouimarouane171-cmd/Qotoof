/**
 * Notifications Module — API Layer (re-export)
 *
 * Re-exports notification-related service functions.
 * No business logic changes. No Supabase query changes.
 * All exports are additive re-exports from existing source files.
 */

// ── notifications.js — core notification service ─────────────────────────
export {
  notificationsApi,
  notificationEvents,
  dispatchNotificationBadgeUpdate,
  dispatchNotificationPreferencesUpdated,
  createOrderNotification,
  createProductApprovalNotification,
} from '@/services/notifications'

// ── Notification preference helpers (backward-compatible re-export) ──────
// These are now defined in notificationPreferences.js (Phase 3.4 extraction).
// Re-exported here for backward compatibility. In the future, preference
// ownership should move to the users module.
export {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORY_OPTIONS,
  NOTIFICATION_PREFERENCE_FIELDS,
  normalizeNotificationPreferences,
} from '@/services/notificationPreferences'

// ── emailService — email delivery (notification channel) ─────────────────
// emailService handles email delivery via Supabase Edge Function 'send-email'.
// It is a notification delivery channel, not a notification business logic
// owner. Re-exported here for convenience but may belong in a separate
// email/communications module in the future.
export {
  emailService,
  useEmail,
} from '@/services/emailService'
