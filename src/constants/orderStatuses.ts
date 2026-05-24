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

const ORDER_STATUS_VALUES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PAYMENT_RECEIVED: 'payment_received',
  PREPARING: 'preparing',
  VENDOR_ACCEPTED: 'vendor_accepted',
  VENDOR_REJECTED: 'vendor_rejected',
  AWAITING_DRIVER: 'awaiting_driver',
  DRIVER_ASSIGNED: 'driver_assigned',
  DRIVER_ACCEPTED: 'driver_accepted',
  DRIVER_PICKED_UP: 'driver_picked_up',
  SHIPPED: 'shipped',
  ON_THE_WAY: 'on_the_way',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
} as const

export type OrderStatus = (typeof ORDER_STATUS_VALUES)[keyof typeof ORDER_STATUS_VALUES]

type OrderStatusEnum = Readonly<typeof ORDER_STATUS_VALUES>

type OrderStatusColorConfig = {
  bg: string
  text: string
  border: string
  dot: string
  hex: string
}

type StatusTranslator = ((key: string, fallback?: string) => string) | null

/**
 * Canonical status key strings.
 * Use these instead of raw string literals to get IDE autocomplete & typo safety.
 *
 * @example
 *   if (order.status === ORDER_STATUS_ENUM.DELIVERED) { ... }
 */
export const ORDER_STATUS_ENUM: OrderStatusEnum = Object.freeze({
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

/**
 * Flat array of every canonical status key, ordered by lifecycle position.
 * Generated from the canonical enum so keys stay synchronized.
 */
export const ORDER_STATUSES: readonly OrderStatus[] = Object.freeze(Object.values(ORDER_STATUS_ENUM));

/**
 * Backward-compatible alias retained for existing imports.
 */
export const ORDER_STATUSES_ARRAY: readonly OrderStatus[] = ORDER_STATUSES;

/**
 * Legacy explicit listing retained for readability in docs/history.
 */
export const _ORDER_STATUSES_EXPLICIT: readonly OrderStatus[] = Object.freeze([
  // Pre-driver lifecycle
  'pending',
  'confirmed',
  'payment_received',
  'preparing',
  'vendor_accepted',
  'vendor_rejected',
  // Driver phase
  'awaiting_driver',
  'driver_assigned',
  'driver_accepted',
  'driver_picked_up',
  'shipped',
  'on_the_way',
  // Terminal
  'delivered',
  'cancelled',
  'refunded',
]);

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
export const ORDER_STATUS_COLORS: Readonly<Record<OrderStatus, OrderStatusColorConfig>> = Object.freeze({
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
export const ORDER_STATUS_COLORS_FALLBACK: OrderStatusColorConfig = ORDER_STATUS_COLORS.pending;

// ─────────────────────────────────────────────────────────────────────────────
// 3. STATUS LABEL FUNCTION (i18n-aware)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Arabic fallback labels — used when t() is not available.
 * Arabic is the primary language of Qotoof; these strings serve as the
 * canonical human-readable fallback for non-i18n contexts (emails, logs, etc.).
 * Canonical i18n namespace: `admin.orders.status.*`
 *
 * English equivalents for reference:
 *   pending → 'Pending'          confirmed → 'Confirmed'
 *   vendor_accepted → 'Accepted' delivered → 'Delivered'
 *   cancelled → 'Cancelled'      refunded  → 'Refunded'
 */
const STATUS_LABEL_FALLBACKS: Readonly<Record<OrderStatus, string>> = Object.freeze({
  pending:          'قيد الانتظار',
  confirmed:        'تم التأكيد',
  payment_received: 'تم استلام الدفع',
  preparing:        'قيد التحضير',
  vendor_accepted:  'قبله البائع',
  vendor_rejected:  'رفضه البائع',
  awaiting_driver:  'في انتظار السائق',
  driver_assigned:  'تم تعيين سائق',
  driver_accepted:  'قبله السائق',
  driver_picked_up: 'في الطريق — تم الاستلام',
  shipped:          'في الطريق',
  on_the_way:       'في الطريق',
  delivered:        'تم التوصيل',
  cancelled:        'ملغي',
  refunded:         'تم الاسترداد',
});

/**
 * English labels — used when an English-language context explicitly needs them
 * (e.g. admin audit logs, English emails).
 * Import and use directly; do NOT pass to getOrderStatusLabel().
 */
export const ORDER_STATUS_LABELS_EN: Readonly<Record<OrderStatus, string>> = Object.freeze({
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
export const STATUS_I18N_KEYS: Readonly<Record<OrderStatus, string>> = Object.freeze({
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
export function getOrderStatusLabel(status: OrderStatus | string, t: StatusTranslator = null): string {
  const fallback = STATUS_LABEL_FALLBACKS[status] ?? status;
  if (!t) return fallback;
  const i18nKey = STATUS_I18N_KEYS[status];
  if (!i18nKey) return fallback;
  return t(i18nKey, fallback);
}

/**
 * Returns the full display configuration for a status:
 * Tailwind colors + resolved label (i18n-aware with Arabic fallback).
 *
 * @param {string} status
 * @param {Function} [t]
 * @returns {{ bg: string, text: string, border: string, label: string }}
 */
export function getOrderStatusConfig(
  status: OrderStatus | string,
  t: StatusTranslator = null,
): { bg: string; text: string; border: string; label: string } {
  const colors = ORDER_STATUS_COLORS[status as OrderStatus] ?? ORDER_STATUS_COLORS_FALLBACK;
  return {
    bg: colors.bg,
    text: colors.text,
    border: colors.border,
    label: getOrderStatusLabel(status, t),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. STATUS GROUP ARRAYS (duplicated in 2+ pages — consolidated here)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Statuses that represent an active (in-progress) order.
 * Used for filtering the "In Progress" tab in buyer/Orders and admin/Orders.
 *
 * Includes the full pre-driver lifecycle (confirmed → preparing) that the
 * original per-page ACTIVE_STATUSES arrays omitted.
 */
export const ACTIVE_ORDER_STATUSES: readonly OrderStatus[] = Object.freeze([
  'pending',
  'confirmed',
  'payment_received',
  'preparing',
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
export const PAYMENT_CONFIRMATION_ELIGIBLE_STATUSES: readonly OrderStatus[] = Object.freeze([
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
export const BUYER_CANCELLABLE_STATUSES: readonly OrderStatus[] = Object.freeze([
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
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = Object.freeze([
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
export function getOrderStatusColors(status: OrderStatus | string): OrderStatusColorConfig {
  return ORDER_STATUS_COLORS[status as OrderStatus] ?? ORDER_STATUS_COLORS_FALLBACK;
}
