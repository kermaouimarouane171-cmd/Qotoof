/**
 * Notifications Module — Hooks Layer (re-export)
 *
 * Re-exports notification-related React Query hooks and realtime hooks.
 * No hook logic changes.
 */

// ── Notification query keys and hooks ────────────────────────────────────
export {
  notificationKeys,
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useNotificationPreferences,
  useSaveNotificationPreferences,
} from '@/hooks/queries/useNotificationQueries'

// ── Realtime notification hook ───────────────────────────────────────────
export {
  useRealtimeNotifications,
} from '@/services/realtime'
