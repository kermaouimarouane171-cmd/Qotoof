/**
 * React Query Hooks - Barrel Export
 * Central export for all query hooks
 */

// Auth
export {
  authKeys,
  useSession,
  useCurrentUser,
  useRegister,
  useLogin,
  useLogout,
  useVerifyEmail,
  useForgotPassword,
  useResetPassword,
  useUpdateProfile,
  useUploadAvatar,
  useChangePassword,
  useDeleteAccount,
} from './useAuthQueries'

// Marketplace (Products, Orders, Reviews)
export {
  productKeys,
  orderKeys,
  reviewKeys,
  useProducts,
  useProduct,
  usePendingProducts,
  useDeletedProducts,
  useInfiniteProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useRestoreProduct,
  useApproveProduct,
  useRejectProduct,
  useBulkApproveProducts,
  useBulkRejectProducts,
  useOrders,
  useOrder,
  useDeletedOrders,
  useCreateOrder,
  useUpdateOrderStatus,
  useDeleteOrder,
  useRestoreOrder,
  useVendorReviews,
  useDeletedReviews,
  useCreateReview,
  useDeleteReview,
  useRestoreReview,
} from './useMarketplaceQueries'

// Cart & Payments
// FG-008: DB-backed cart hooks (useCart, useCartCount, useAddToCart, useUpdateCartItem,
// useRemoveFromCart, useClearCart) are intentionally NOT re-exported here. They are
// deprecated and must not be used in the buyer checkout flow. The Zustand/localStorage
// cart store is the single source of truth for Beta.
export {
  paymentKeys,
  usePaymentHistory,
  usePaymentDetail,
  useCreatePayment,
  useConfirmPayment,
} from './useCartPaymentQueries'

// Vendor & Admin (Phase 4.7: split into useVendorQueries + useAdminQueries)
export {
  vendorKeys,
  useVendors,
  useVendor,
  useVendorStats,
  useUpdateVendor,
} from './useVendorQueries'

export {
  adminKeys,
  useAdminUsers,
  useAdminUser,
  useDeletedUsers,
  useAdminStats,
  useUpdateUser,
  useDeleteUser,
  useRestoreUser,
} from './useAdminQueries'

// Driver
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
} from './useDriverQueries'

// Notifications
export {
  notificationKeys,
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useNotificationPreferences,
  useSaveNotificationPreferences,
} from './useNotificationQueries'

// Support (extracted from useNotificationQueries.js in Phase 3.4)
export {
  supportKeys,
  useSupportTickets,
  useSupportTicket,
  useCreateTicket,
  useReplyToTicket,
} from './useSupportTicketQueries'
