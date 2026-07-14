// ============================================
// Catalog Module — Domain Public API
// Re-exports catalog domain constants, types, and business logic.
// No files were moved — this is a re-export layer.
// ============================================

// Product approval / moderation business logic
export {
  buildApprovalPayload,
  buildSuspensionPayload,
  buildRejectionPayload,
  buildSoftDeletePayload,
  buildRestorePayload,
} from '@/business/productLogic'

// Categories
export {
  PRODUCT_CATEGORIES,
  MAIN_CATEGORIES,
  getSuggestedSubcategories,
  getCategoryById,
  getCategoryIds,
  getCategoryLabel,
} from '@/constants/categories'
