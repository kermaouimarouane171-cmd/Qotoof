// ============================================
// Cart Module — Domain Public API
// Re-exports cart domain constants and helpers.
// No files were moved — this is a re-export layer.
// ============================================

// Cart quantity utilities (normalization, formatting, step calculation)
// Source moved to src/modules/cart/domain/cartQuantity.js
export {
  normalizeQuantity,
  formatQuantity,
  getQuantityStep,
  isDecimalQuantityUnit,
} from './cartQuantity'
