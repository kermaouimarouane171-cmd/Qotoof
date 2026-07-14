// ============================================
// Delivery Module — Data Public API
// Re-exports delivery data access functions if present.
// No files were moved — this is a re-export layer.
// ============================================

// Placeholder — no dedicated delivery repository file exists yet.
// Delivery data access is currently embedded in:
// - @/services/deliveries.js (deliveriesApi: getDriverDeliveries, getUnassignedDeliveries, getById, etc.)
// - @/hooks/queries/useDriverQueries.js (useDriverDeliveries, useDeliveryDetail, useAvailableDeliveries)
// - @/services/deliveryMatchingService.js (getAvailableDriversForCheckout, getMatchingDeliveriesForDriver)
//
// Future candidates:
// - deliveryRepository.ts (low-level Supabase queries on deliveries table)
// - driverLocationRepository.ts (low-level queries on driver_locations table)
