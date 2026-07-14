// ============================================
// Delivery Module — Hooks Public API
// Re-exports delivery/driver-related React hooks.
// No files were moved — this is a re-export layer.
// ============================================

// Driver query hooks (useDriverQueries.js)
// Contains: driver profile, deliveries, available deliveries, stats, earnings,
// mutations for profile update, delivery accept, status update, location update, availability toggle
export {
  driverKeys,
  useDriverProfile,
  useDriverDeliveries,
  useDeliveryDetail,
  useAvailableDeliveries,
  useDriverStats,
  useDriverEarnings,
  useUpdateDriverProfile,
  useAcceptDelivery,
  useUpdateDeliveryStatus,
  useUpdateDriverLocation,
  useToggleDriverAvailability,
} from '@/hooks/queries/useDriverQueries'
