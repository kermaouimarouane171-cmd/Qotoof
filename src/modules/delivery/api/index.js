// ============================================
// Delivery Module — API Public API
// Re-exports delivery service functions and API objects.
// No files were moved — this is a re-export layer.
// ============================================

// Primary delivery service (deliveries.js)
// Contains: createDelivery, fetchDeliveryById, updateDeliveryStatus,
// assignDriver, markDelivered, subscribeToDeliveryUpdates, deliveriesApi
export {
  createDelivery,
  fetchDeliveryById,
  updateDeliveryStatus,
  assignDriver,
  markDelivered,
  subscribeToDeliveryUpdates,
  deliveriesApi,
} from '@/services/deliveries'

// Delivery matching service (deliveryMatchingService.js)
// Contains: cargo/payment options, driver matching, distance/fee calculation,
// nearest driver search, delivery request creation
export {
  CARGO_SIZE_OPTIONS,
  DRIVER_DELIVERY_PAYMENT_OPTIONS,
  DRIVER_SELECT,
  normalizeCargoSize,
  normalizeDriverDeliveryPaymentMethod,
  getCargoSizeLabel,
  getDriverDeliveryPaymentMethodLabel,
  normalizeDriverPreferences,
  driverSupportsPaymentMethod,
  getDriverSupportedPaymentMethods,
  doesDriverMatchDelivery,
  getAvailableDriversForCheckout,
  getMatchingDeliveriesForDriver,
  isDriverEligibleForOrder,
  calculateDistance,
  calculateDeliveryFee,
  getRegionFromCoords,
  calculateTieredDeliveryFee,
  findNearestDrivers,
  createDeliveryRequest,
} from '@/services/deliveryMatchingService'
export { default as deliveryMatchingService } from '@/services/deliveryMatchingService'

// Delivery eligibility service (deliveryEligibilityService.js)
// Contains: checkDeliveryEligibility, normalizeLocation
export {
  checkDeliveryEligibility,
  normalizeLocation as normalizeEligibilityLocation,
} from '@/services/deliveryEligibilityService'

// Delivery schedule service (deliveryScheduleService.js)
// Contains: delivery slot management, schedule snapshots
export {
  getDeliveryDayOfWeek,
  isSlotPastCutoff,
  decorateDeliverySlot,
  buildDeliveryScheduleSnapshot,
} from '@/services/deliveryScheduleService'
export { default as deliveryScheduleService } from '@/services/deliveryScheduleService'

// Driver location service (driverLocationService.js)
// Contains: real-time driver location tracking, browser GPS sessions
export { driverLocationService } from '@/services/driverLocationService'

// NOTE: Order-related functions (acceptOrder, rejectOrder, subscribeToOrder,
// subscribeToBuyerOrders, subscribeToVendorOrders) are legacy misplaced
// functions that historically lived in deliveries.js. They are now exported
// as `vendorOrderActionsApi` (canonical name) with a backward-compatible
// `ordersApi` alias. They are re-exported from the orders module, not here.
// Migration target: move to ordersService.ts or vendorOrderService.ts in Phase 3.
