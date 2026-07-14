/**
 * Notifications Module — Stores Layer (placeholder)
 *
 * No dedicated notification store exists.
 * Notification state is managed through:
 * - React Query (useNotificationQueries.js) for server state
 * - Local component state in NotificationLink and Notifications page
 * - Window CustomEvents for badge count updates (notificationEvents.badge)
 * - useAuthStore for current user identity
 *
 * Migration candidates (future sprints):
 * - Extract notification badge count into a dedicated Zustand store
 * - Separate notification dropdown state from component state
 */
