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
export {
  cartKeys,
  paymentKeys,
  useCart,
  useCartCount,
  useAddToCart,
  useUpdateCartItem,
  useRemoveFromCart,
  useClearCart,
  usePaymentHistory,
  usePaymentDetail,
  useCreatePayment,
  useConfirmPayment,
} from './useCartPaymentQueries'

// Vendor & Admin
export {
  vendorKeys,
  adminKeys,
  useVendors,
  useVendor,
  useVendorStats,
  useUpdateVendor,
  useAdminUsers,
  useAdminUser,
  useDeletedUsers,
  useAdminStats,
  useUpdateUser,
  useDeleteUser,
  useRestoreUser,
} from './useVendorAdminQueries'

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

// Notifications & Support
export {
  notificationKeys,
  supportKeys,
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useNotificationPreferences,
  useSaveNotificationPreferences,
  useSupportTickets,
  useSupportTicket,
  useCreateTicket,
  useReplyToTicket,
} from './useNotificationQueries'
