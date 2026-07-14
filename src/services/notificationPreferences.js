/**
 * Notification Preferences Service (Phase 3.4 — H1 extraction)
 *
 * Extracted from notifications.js to separate user-owned notification preference
 * management from notification delivery/read/realtime behavior.
 *
 * This file owns:
 *   - Preference constants (defaults, category options, preference fields)
 *   - Category alias mapping (shared with notification delivery, but defined here
 *     as the canonical source)
 *   - Preference normalization and quiet-hours helpers
 *   - Preference event dispatching
 *
 * notifications.js imports from this file and re-exports everything for
 * backward compatibility. No existing imports are changed.
 *
 * Future migration: preference ownership should move to the users module.
 */

// ── Preference defaults ───────────────────────────────────────────────────
export const DEFAULT_NOTIFICATION_PREFERENCES = {
  in_app_enabled: true,
  email_enabled: true,
  sms_enabled: false,
  order_updates: true,
  payment_updates: true,
  promotional_updates: true,
  review_updates: true,
  loyalty_updates: true,
  inventory_alerts: true,
  delivery_updates: true,
  system_updates: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
}

// ── Category options for preference UI ────────────────────────────────────
export const NOTIFICATION_CATEGORY_OPTIONS = [
  { id: 'order_update', label: 'الطلبات' },
  { id: 'payment', label: 'المدفوعات' },
  { id: 'delivery', label: 'التوصيل' },
  { id: 'review', label: 'التقييمات' },
  { id: 'loyalty', label: 'الولاء' },
  { id: 'promotion', label: 'العروض' },
  { id: 'inventory', label: 'المخزون' },
  { id: 'message', label: 'الرسائل' },
  { id: 'system', label: 'النظام' },
]

// ── Preference fields for preference UI ───────────────────────────────────
export const NOTIFICATION_PREFERENCE_FIELDS = [
  { key: 'order_updates', label: 'تحديثات الطلبات' },
  { key: 'payment_updates', label: 'تحديثات الدفع والعمولات' },
  { key: 'delivery_updates', label: 'تحديثات التوصيل' },
  { key: 'review_updates', label: 'التقييمات الجديدة' },
  { key: 'loyalty_updates', label: 'الولاء والإحالات' },
  { key: 'promotional_updates', label: 'العروض والكوبونات' },
  { key: 'inventory_alerts', label: 'تنبيهات المخزون والتوفر' },
  { key: 'system_updates', label: 'إشعارات النظام والرسائل العامة' },
]

// ── Category alias mapping (shared canonical source) ──────────────────────
export const NOTIFICATION_CATEGORY_ALIASES = {
  order: 'order_update',
  order_update: 'order_update',
  order_updates: 'order_update',
  order_status: 'order_update',
  new_order: 'order_update',
  payment: 'payment',
  payment_updates: 'payment',
  payment_update: 'payment',
  commission: 'payment',
  bank_transfer: 'payment',
  promotion: 'promotion',
  promotions: 'promotion',
  promotional: 'promotion',
  promotional_updates: 'promotion',
  product: 'promotion',
  review: 'review',
  reviews: 'review',
  review_update: 'review',
  review_updates: 'review',
  loyalty: 'loyalty',
  loyalty_update: 'loyalty',
  loyalty_updates: 'loyalty',
  referral: 'loyalty',
  referrals: 'loyalty',
  inventory: 'inventory',
  inventory_alert: 'inventory',
  inventory_alerts: 'inventory',
  stock: 'inventory',
  low_stock: 'inventory',
  delivery: 'delivery',
  delivery_update: 'delivery',
  delivery_updates: 'delivery',
  delivery_assignment: 'delivery',
  driver_verification: 'delivery',
  message: 'message',
  messages: 'message',
  chat: 'message',
  general: 'system',
  system: 'system',
  support: 'system',
  partnership_request: 'system',
  partnership_request_response: 'system',
}

// ── Category → preference key mapping ─────────────────────────────────────
export const NOTIFICATION_PREFERENCE_BY_CATEGORY = {
  order_update: 'order_updates',
  payment: 'payment_updates',
  promotion: 'promotional_updates',
  review: 'review_updates',
  loyalty: 'loyalty_updates',
  inventory: 'inventory_alerts',
  delivery: 'delivery_updates',
  message: 'system_updates',
  system: 'system_updates',
}

// ── Event name constant ───────────────────────────────────────────────────
export const NOTIFICATION_PREFERENCES_EVENT = 'notification-preferences-updated'

// ── Time helpers ──────────────────────────────────────────────────────────
const sanitizeTimeValue = (value) => {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 5) : null
}

const toMinutes = (value) => {
  if (!value || typeof value !== 'string' || !value.includes(':')) return null
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return (hours * 60) + minutes
}

// ── Category normalization (shared — used by preferences and delivery) ────
export const normalizeNotificationCategory = (category, type = null) => {
  const rawValue = String(category || type || 'system').trim().toLowerCase()
  return NOTIFICATION_CATEGORY_ALIASES[rawValue] || 'system'
}

// ── Preference key resolver ───────────────────────────────────────────────
export const getNotificationPreferenceKey = (category, type = null) => {
  const normalizedCategory = normalizeNotificationCategory(category, type)
  return NOTIFICATION_PREFERENCE_BY_CATEGORY[normalizedCategory] || 'system_updates'
}

// ── Preference normalization ──────────────────────────────────────────────
export const normalizeNotificationPreferences = (preferences = {}) => ({
  ...DEFAULT_NOTIFICATION_PREFERENCES,
  ...preferences,
  quiet_hours_start: sanitizeTimeValue(preferences?.quiet_hours_start),
  quiet_hours_end: sanitizeTimeValue(preferences?.quiet_hours_end),
})

// ── Quiet hours check ─────────────────────────────────────────────────────
export const isWithinQuietHours = (preferences = {}, value = new Date()) => {
  const normalizedPreferences = normalizeNotificationPreferences(preferences)
  const startMinutes = toMinutes(normalizedPreferences.quiet_hours_start)
  const endMinutes = toMinutes(normalizedPreferences.quiet_hours_end)

  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
    return false
  }

  const currentValue = value instanceof Date ? value : new Date(value)
  const currentMinutes = (currentValue.getHours() * 60) + currentValue.getMinutes()

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes
}

// ── Preview mute check ────────────────────────────────────────────────────
export const shouldMuteNotificationPreview = (preferences = {}, notification = {}, value = new Date()) => {
  const normalizedPreferences = normalizeNotificationPreferences(preferences)
  if (!normalizedPreferences.in_app_enabled) {
    return true
  }

  const preferenceKey = getNotificationPreferenceKey(notification.category, notification.type)
  if (normalizedPreferences[preferenceKey] === false) {
    return true
  }

  return isWithinQuietHours(normalizedPreferences, value)
}

// ── Preference event dispatcher ───────────────────────────────────────────
export const dispatchNotificationPreferencesUpdated = (preferences) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(NOTIFICATION_PREFERENCES_EVENT, {
    detail: { preferences: normalizeNotificationPreferences(preferences) },
  }))
}
