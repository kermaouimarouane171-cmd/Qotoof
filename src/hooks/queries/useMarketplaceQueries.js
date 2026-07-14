/**
 * Marketplace Queries & Mutations (backward-compatible aggregate)
 *
 * This file was the original mixed hook file containing product, order, and
 * review hooks. In Phase 2.6, the hooks were split into three focused files:
 *   - useProductQueries.js  (product keys, queries, mutations)
 *   - useOrderQueries.js    (order keys, queries, mutations)
 *   - useReviewQueries.js   (review keys, queries, mutations)
 *
 * This file re-exports everything from the three new files so that existing
 * imports continue to work without changes. Consumers should migrate to
 * importing from the specific files or from the module public APIs:
 *   - @/modules/marketplace (product + review hooks)
 *   - @/modules/orders      (order hooks)
 */

// Product queries and mutations
export {
  productKeys,
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
} from './useProductQueries'

// Order queries and mutations
export {
  orderKeys,
  useOrders,
  useOrder,
  useDeletedOrders,
  useCreateOrder,
  useUpdateOrderStatus,
  useDeleteOrder,
  useRestoreOrder,
} from './useOrderQueries'

// Review queries and mutations
export {
  reviewKeys,
  useVendorReviews,
  useDeletedReviews,
  useCreateReview,
  useDeleteReview,
  useRestoreReview,
} from './useReviewQueries'
