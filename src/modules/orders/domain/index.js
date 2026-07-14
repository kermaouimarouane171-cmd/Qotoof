// ============================================
// Orders Module — Domain Public API
// Re-exports order domain logic and constants.
// No files were moved — this is a re-export layer.
// ============================================

// Order business logic (status transitions, payload builders)
export {
  ALLOWED_STATUS_TRANSITIONS,
  isAllowedOrderStatusTransition,
  buildOrderStatusUpdatePayload,
} from '@/business/orderLogic'

// Order status constants (canonical status keys, colors, labels, groups)
export {
  ORDER_STATUS_VALUES,
  ORDER_STATUS_ENUM,
  ORDER_STATUSES,
  ORDER_STATUSES_ARRAY,
  ORDER_STATUS_COLORS,
  ORDER_STATUS_COLORS_FALLBACK,
  ORDER_STATUS_LABELS_EN,
  STATUS_I18N_KEYS,
  ACTIVE_ORDER_STATUSES,
  PAYMENT_CONFIRMATION_ELIGIBLE_STATUSES,
  BUYER_CANCELLABLE_STATUSES,
  TERMINAL_ORDER_STATUSES,
  getOrderStatusLabel,
  getOrderStatusConfig,
  getOrderStatusColors,
} from '@/constants/orderStatuses'
