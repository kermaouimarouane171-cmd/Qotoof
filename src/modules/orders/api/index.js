// ============================================
// Orders Module — API Public API
// Re-exports order service functions and API objects.
// No files were moved — this is a re-export layer.
// ============================================

// Primary orders service (centralised Supabase queries on orders table)
export {
  fetchVendorOrders,
  subscribeToVendorOrders,
  fetchBuyerOrders,
  fetchBuyerOrdersAll,
  fetchAdminOrders,
  fetchOrderById,
  updateOrderStatus,
  subscribeToOrderById,
  submitReturnRequest,
  ordersService,
  default,
} from '@/services/ordersService'

// Legacy ordersApi (getAll, getById, create, updateStatus, delete, restore, getDeleted)
// Phase 4.7: now re-exported from the split file instead of the monolith api.js
export { ordersApi } from '@/services/apis/ordersApi'

// Vendor order actions — legacy functions currently living in deliveries.js
// These are order-related (vendor accept/reject + order realtime subscriptions)
// but historically placed in deliveries.js. They are now exported as
// `vendorOrderActionsApi` (canonical name) with a backward-compatible
// `ordersApi` alias from deliveries.js.
// Migration target: move to ordersService.ts or a new vendorOrderService.ts in Phase 3.
export {
  vendorOrderActionsApi,
  acceptOrder,
  rejectOrder,
  subscribeToOrder,
  subscribeToBuyerOrders,
} from '@/services/deliveries'
// NOTE: subscribeToVendorOrders from deliveries.js is NOT re-exported here
// because ordersService.ts already exports a subscribeToVendorOrders function.
// The deliveries.js version is accessible via vendorOrderActionsApi.subscribeToVendorOrders.

// Order Timeline API
// Source moved to src/modules/orders/api/orderTimelineApi.js (Phase 6.9)
export { orderTimelineApi } from './orderTimelineApi'
