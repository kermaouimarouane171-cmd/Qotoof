// ============================================
// Orders Module — Stores Public API
// Re-exports order-related Zustand stores if present.
// No files were moved — this is a re-export layer.
// ============================================

// Placeholder — no dedicated order store exists yet.
// Order state is managed via:
// - React Query (useOrders, useOrder, useCreateOrder, useUpdateOrderStatus)
// - Supabase Realtime subscriptions (subscribeToVendorOrders, subscribeToOrderById)
// - Local component state in order pages
//
// Future candidates:
// - useOrderStore (if centralized order state management is needed)
// - useOrderFilterStore (for order list filter state)
