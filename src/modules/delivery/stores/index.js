// ============================================
// Delivery Module — Stores Public API
// Re-exports delivery-related Zustand stores if present.
// No files were moved — this is a re-export layer.
// ============================================

// Placeholder — no dedicated delivery store exists yet.
// Delivery state is managed via:
// - React Query (useDriverDeliveries, useDeliveryDetail, useAvailableDeliveries, etc.)
// - Supabase Realtime subscriptions (subscribeToDeliveryUpdates, subscribeToDriverDeliveries)
// - Local component state in driver pages
// - useAuthStore for current user/profile
//
// Future candidates:
// - useDeliveryStore (if centralized delivery state management is needed)
// - useDriverAvailabilityStore (for driver online/offline state)
