// ============================================
// Catalog Module — Data Public API
// Re-exports catalog data access functions and repositories.
// No files were moved — this is a re-export layer.
// ============================================

// Product repository (data access)
export {
  productSelects,
  listProducts,
  getProductById,
  insertProduct,
  updateProductById,
  listDeletedProducts,
  listPendingProducts,
  updateManyProducts,
} from '@/data/productRepository'
