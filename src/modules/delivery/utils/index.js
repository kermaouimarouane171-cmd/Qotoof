// ============================================
// Delivery Module — Utils Public API
// Re-exports delivery-related utility functions.
// No files were moved — this is a re-export layer.
// ============================================

// Placeholder for delivery-specific utilities.
// Currently delivery utilities are embedded in:
// - @/utils/currency (formatPrice — shared utility)
// - @/utils/logger (logger — shared utility)
// - @/services/shippingCalculator (calculateDistance — used by deliveryMatchingService)
// - @/services/deliveryMatchingService.js (calculateDistance, calculateDeliveryFee, calculateTieredDeliveryFee)
// - @/services/deliveryEligibilityService.js (normalizeLocation, checkDeliveryEligibility)
// - @/services/deliveryScheduleService.js (getDeliveryDayOfWeek, isSlotPastCutoff, decorateDeliverySlot)
//
// Future candidates:
// - delivery fee calculator (extract from deliveryMatchingService)
// - delivery zone classifier (extract from deliveryEligibilityService)
// - delivery time estimator
