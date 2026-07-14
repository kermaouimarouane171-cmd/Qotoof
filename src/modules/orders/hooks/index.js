// ============================================
// Orders Module — Hooks Public API
// Re-exports order-related React hooks.
// No files were moved — this is a re-export layer.
// ============================================

// Order view hook (fetches unified order view via RPC)
export { useOrderView } from '@/hooks/useOrderView'

// Order query keys and hooks — re-exported from useOrderQueries.js (split in Phase 2.6)
export {
  orderKeys,
  useOrders,
  useOrder,
  useDeletedOrders,
  useCreateOrder,
  useUpdateOrderStatus,
  useDeleteOrder,
  useRestoreOrder,
} from '@/hooks/queries/useOrderQueries'
