// ============================================
// Users Module — API Public API
// Re-exports profile service functions and notification preference helpers.
// No files were moved — this is a re-export layer.
// ============================================

// Profile service (profilesService.ts)
export {
  fetchProfile,
  updateProfile,
  profilesService,
} from '@/services/profilesService'
export { default as profilesServiceDefault } from '@/services/profilesService'

// Notification preferences (user-owned settings)
// Preference constants and helpers are now in notificationPreferences.js (Phase 3.4).
// notificationsApi is still in notifications.js — it owns the Supabase queries.
export {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NOTIFICATION_CATEGORY_OPTIONS,
  NOTIFICATION_PREFERENCE_FIELDS,
  normalizeNotificationPreferences,
} from '@/services/notificationPreferences'

export {
  notificationsApi,
} from '@/modules/notifications'

// Verification API
// Source moved to src/modules/users/api/verificationApi.js (Phase 6.9)
export { verificationApi } from './verificationApi'
