// ============================================
// Delivery Module — Domain Public API
// Re-exports delivery domain logic and constants.
// No files were moved — this is a re-export layer.
// ============================================

// Driver configuration constants (driver.config.js)
// Contains: commission rates, delivery limits, statuses, validation rules
export {
  DRIVER_CONFIG,
  DRIVER_STATUSES,
  DELIVERY_STATUSES,
  EARNING_STATUSES,
  DRIVER_ERRORS,
  DRIVER_SUCCESS,
  DRIVER_QUERY_LIMITS,
  DRIVER_VALIDATION,
} from '@/config/driver.config'
export { default as driverConfig } from '@/config/driver.config'

// Delivery eligibility domain logic is in deliveryEligibilityService.js
// (re-exported from api/index.js — checkDeliveryEligibility, normalizeLocation)

// Delivery matching domain logic is in deliveryMatchingService.js
// (re-exported from api/index.js — doesDriverMatchDelivery, isDriverEligibleForOrder, etc.)

// Delivery schedule domain logic is in deliveryScheduleService.js
// (re-exported from api/index.js — isSlotPastCutoff, decorateDeliverySlot, etc.)
