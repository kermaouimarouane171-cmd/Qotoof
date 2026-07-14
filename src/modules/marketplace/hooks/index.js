// ============================================
// Marketplace Module — Hooks Public API
// Re-exports marketplace-related React Query hooks.
// No files were moved — this is a re-export layer.
// ============================================

// Product queries — re-exported from useProductQueries.js (split in Phase 2.6)
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
} from '@/hooks/queries/useProductQueries'

// Review queries — re-exported from @/modules/reviews (Phase 5.1 import adoption)
export {
  reviewKeys,
  useVendorReviews,
  useDeletedReviews,
  useCreateReview,
  useDeleteReview,
  useRestoreReview,
} from '@/modules/reviews'
