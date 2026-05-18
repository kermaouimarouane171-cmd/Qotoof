/**
 * orderStatuses.js — Canonical Order Status Constants
 *
 * Single source of truth for order status keys, colors, and labels.
 * Replaces duplicated STATUS_CONFIG defined locally in:
 *   - pages/buyer/Orders.jsx
 *   - pages/vendor/Dashboard.jsx
 *   - pages/OrderDetail.jsx
 *   - pages/Tracking.jsx
 *   - pages/admin/Orders.jsx
 *
 * USAGE (Phase 2 — ADDITIVE ONLY):
 *   Existing pages continue to work unchanged.
 *   Migrate pages to use this file one by one per ADR-006.
 *
 * Color decisions (unified from 5 sources):
 *   - pending        → amber   (was: amber in buyer/admin, yellow in vendor/OrderDetail → amber wins)
 *   - vendor_accepted→ blue    (was: amber in buyer, blue elsewhere → blue wins — semantically correct)
 *   - on_the_way     → indigo  (was: orange in buyer, purple in admin, indigo in OrderDetail/Tracking → indigo wins)
 *   - driver_assigned→ purple  (was: orange in buyer, purple in admin/OrderDetail/Tracking → purple wins)
 *   - delivered      → emerald (was: emerald in buyer/admin, green in OrderDetail/Tracking → emerald wins)
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. STATUS KEY CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical status key strings.
 * Use these instead of raw string literals to get IDE autocomplete & typo safety.
 *
 * @example
 *   if (order.status === ORDER_STATUSES.DELIVERED) { ... }
 */
export const ORDER_STATUSES = Object.freeze({
  // ── Lifecycle: Pre-Driver ────────────────────────────────────────────────
  PENDING:          'pending',
  CONFIRMED:        'confirmed',
  PAYMENT_RECEIVED: 'payment_received',
  PREPARING:        'preparing',
  VENDOR_ACCEPTED:  'vendor_accepted',
  VENDOR_REJECTED:  'vendor_rejected',
  // ── Lifecycle: Driver Phase ──────────────────────────────────────────────
  AWAITING_DRIVER:  'awaiting_driver',
  DRIVER_ASSIGNED:  'driver_assigned',
  DRIVER_ACCEPTED:  'driver_accepted',
  DRIVER_PICKED_UP: 'driver_picked_up',
  SHIPPED:          'shipped',       // alias of on_the_way (some DB records)
  ON_THE_WAY:       'on_the_way',
  // ── Terminal ─────────────────────────────────────────────────────────────
  DELIVERED:        'delivered',
  CANCELLED:        'cancelled',
  REFUNDED:         'refunded',
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. STATUS COLORS (Tailwind classes — NO labels)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tailwind CSS class tokens per status.
 *
 * Each entry exposes four separate keys so pages can compose freely:
 *   bg     — background class       e.g. 'bg-amber-100'
 *   text   — text color class        e.g. 'text-amber-700'
 *   border — border color class      e.g. 'border-amber-200'
 *   dot    — dot/indicator bg class  e.g. 'bg-amber-500'
 *   hex    — raw hex for non-Tailwind use (charts, SVG, Canvas)
 *
 * Compose for different page patterns:
 *   buyer/admin pattern:   `${c.bg} ${c.text}`
 *   vendor pattern:        `${c.bg} ${c.text} border ${c.border}`
 *   OrderDetail pattern:   `${c.bg} ${c.text} border ${c.border}`
 *   dot indicator:         `${c.dot}`
 */
export const ORDER_STATUS_COLORS = Object.freeze({
  pending: {
    bg:     'bg-amber-100',
    text:   'text-amber-700',
    border: 'border-amber-200',
    dot:    'bg-amber-500',
    hex:    '#F59E0B',
  },
  confirmed: {
    bg:     'bg-blue-100',
    text:   'text-blue-700',
    border: 'border-blue-200',
    dot:    'bg-blue-500',
    hex:    '#3B82F6',
  },
  payment_received: {
    bg:     'bg-teal-100',
    text:   'text-teal-700',
    border: 'border-teal-200',
    dot:    'bg-teal-500',
    hex:    '#14B8A6',
  },
  preparing: {
    bg:     'bg-purple-100',
    text:   'text-purple-700',
    border: 'border-purple-200',
    dot:    'bg-purple-500',
    hex:    '#8B5CF6',
  },
  vendor_accepted: {
    bg:     'bg-blue-100',
    text:   'text-blue-700',
    border: 'border-blue-200',
    dot:    'bg-blue-500',
    hex:    '#3B82F6',
  },
  vendor_rejected: {
    bg:     'bg-red-100',
    text:   'text-red-700',
    border: 'border-red-200',
    dot:    'bg-red-500',
    hex:    '#EF4444',
  },
  awaiting_driver: {
    bg:     'bg-orange-100',
    text:   'text-orange-700',
    border: 'border-orange-200',
    dot:    'bg-orange-500',
    hex:    '#F97316',
  },
  driver_assigned: {
    bg:     'bg-purple-100',
    text:   'text-purple-700',
    border: 'border-purple-200',
    dot:    'bg-purple-500',
    hex:    '#8B5CF6',
  },
  driver_accepted: {
    bg:     'bg-purple-100',
    text:   'text-purple-700',
    border: 'border-purple-200',
    dot:    'bg-purple-500',
    hex:    '#8B5CF6',
  },
  driver_picked_up: {
    bg:     'bg-indigo-100',
    text:   'text-indigo-700',
    border: 'border-indigo-200',
    dot:    'bg-indigo-500',
    hex:    '#6366F1',
  },
  shipped: {
    bg:     'bg-indigo-100',
    text:   'text-indigo-700',
    border: 'border-indigo-200',
    dot:    'bg-indigo-500',
    hex:    '#6366F1',
  },
  on_the_way: {
    bg:     'bg-indigo-100',
    text:   'text-indigo-700',
    border: 'border-indigo-200',
    dot:    'bg-indigo-500',
    hex:    '#6366F1',
  },
  delivered: {
    bg:     'bg-emerald-100',
    text:   'text-emerald-700',
    border: 'border-emerald-200',
    dot:    'bg-emerald-500',
    hex:    '#10B981',
  },
  cancelled: {
    bg:     'bg-red-100',
    text:   'text-red-700',
    border: 'border-red-200',
    dot:    'bg-red-500',
    hex:    '#EF4444',
  },
  refunded: {
    bg:     'bg-gray-100',
    text:   'text-gray-700',
    border: 'border-gray-200',
    dot:    'bg-gray-500',
    hex:    '#6B7280',
  },
});

/**
 * Fallback colors for unknown/unmapped statuses.
 * Equivalent to STATUS_CONFIG.pending in current pages.
 */
export const ORDER_STATUS_COLORS_FALLBACK = ORDER_STATUS_COLORS.pending;

// ─────────────────────────────────────────────────────────────────────────────
// 3. STATUS LABEL FUNCTION (i18n-aware)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * English fallback labels — used when t() is not available or as default values.
 * Canonical namespace: `admin.orders.status.*`
 *
 * Note: admin/Orders.jsx already uses these keys.
 * Other pages that migrate should adopt the same i18n key pattern.
 */
const STATUS_LABEL_FALLBACKS = Object.freeze({
  pending:          'Pending',
  confirmed:        'Confirmed',
  payment_received: 'Payment Received',
  preparing:        'Preparing',
  vendor_accepted:  'Accepted by Vendor',
  vendor_rejected:  'Rejected by Vendor',
  awaiting_driver:  'Awaiting Driver',
  driver_assigned:  'Driver Assigned',
  driver_accepted:  'Driver Accepted',
  driver_picked_up: 'Picked Up',
  shipped:          'On the Way',
  on_the_way:       'On the Way',
  delivered:        'Delivered',
  cancelled:        'Cancelled',
  refunded:         'Refunded',
});

/**
 * i18n key map — maps status string → admin.orders.status.* key.
 * Using admin namespace as canonical (most complete coverage).
 * Exported so page components can reference these keys in STATUS_CONFIG derivations.
 */
export const STATUS_I18N_KEYS = Object.freeze({
  pending:          'admin.orders.status.pending',
  confirmed:        'admin.orders.status.confirmed',
  payment_received: 'admin.orders.status.paymentReceived',
  preparing:        'admin.orders.status.preparing',
  vendor_accepted:  'admin.orders.status.accepted',
  vendor_rejected:  'admin.orders.status.rejected',
  awaiting_driver:  'admin.orders.status.awaitingDriver',
  driver_assigned:  'admin.orders.status.driverAssigned',
  driver_accepted:  'admin.orders.status.driverAccepted',
  driver_picked_up: 'admin.orders.status.pickedUp',
  shipped:          'admin.orders.status.onTheWay',
  on_the_way:       'admin.orders.status.onTheWay',
  delivered:        'admin.orders.status.delivered',
  cancelled:        'admin.orders.status.cancelled',
  refunded:         'admin.orders.status.refunded',
});

/**
 * Returns a translated (or English fallback) label for a given order status.
 *
 * @param {string} status  - Order status string (e.g. 'pending', 'delivered')
 * @param {Function} [t]   - i18next t() function. If omitted, returns English fallback.
 * @returns {string}       - Human-readable status label
 *
 * @example
 *   // With i18n (admin/Orders.jsx pattern):
 *   getOrderStatusLabel('pending', t)  → t('admin.orders.status.pending', 'Pending')
 *
 *   // Without i18n (server-side or non-React context):
 *   getOrderStatusLabel('delivered')   → 'Delivered'
 *
 *   // Unknown status → raw value returned as-is:
 *   getOrderStatusLabel('custom_status') → 'custom_status'
 */
export function getOrderStatusLabel(status, t = null) {
  const fallback = STATUS_LABEL_FALLBACKS[status] ?? status;
  if (!t) return fallback;
  const i18nKey = STATUS_I18N_KEYS[status];
  if (!i18nKey) return fallback;
  return t(i18nKey, fallback);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. STATUS GROUP ARRAYS (duplicated in 2+ pages — consolidated here)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Statuses that represent an active (in-progress) order.
 * Used for filtering "In Progress" tab.
 * Duplicated in: buyer/Orders.jsx, admin/Orders.jsx
 */
export const ACTIVE_ORDER_STATUSES = Object.freeze([
  'pending',
  'vendor_accepted',
  'awaiting_driver',
  'driver_assigned',
  'driver_accepted',
  'driver_picked_up',
  'on_the_way',
  'shipped',
]);

/**
 * Statuses eligible for payment confirmation receipt upload.
 * Sourced from: OrderDetail.jsx → PAYMENT_CONFIRMATION_ELIGIBLE_STATUSES
 */
export const PAYMENT_CONFIRMATION_ELIGIBLE_STATUSES = Object.freeze([
  'confirmed',
  'vendor_accepted',
  'preparing',
  'shipped',
  'on_the_way',
  'driver_assigned',
  'driver_accepted',
  'driver_picked_up',
  'delivered',
]);

/**
 * Statuses that a buyer can cancel from.
 * Sourced from: OrderDetail.jsx → BUYER_CANCELLABLE_STATUSES
 */
export const BUYER_CANCELLABLE_STATUSES = Object.freeze([
  'pending',
  'confirmed',
  'awaiting_driver',
  'vendor_accepted',
  'payment_received',
  'preparing',
]);

/**
 * Terminal statuses — order cannot change from these.
 */
export const TERMINAL_ORDER_STATUSES = Object.freeze([
  'delivered',
  'cancelled',
  'vendor_rejected',
  'refunded',
]);

// ─────────────────────────────────────────────────────────────────────────────
// 5. CONVENIENCE HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the color tokens for a given status, falling back to `pending` colors
 * for unknown statuses — mirrors current pages' pattern of:
 *   `STATUS_CONFIG[order.status] || STATUS_CONFIG.pending`
 *
 * @param {string} status
 * @returns {{ bg: string, text: string, border: string, dot: string, hex: string }}
 *
 * @example
 *   const c = getOrderStatusColors(order.status);
 *   <span className={`${c.bg} ${c.text} border ${c.border}`}>...</span>
 */
export function getOrderStatusColors(status) {
  return ORDER_STATUS_COLORS[status] ?? ORDER_STATUS_COLORS_FALLBACK;
}
