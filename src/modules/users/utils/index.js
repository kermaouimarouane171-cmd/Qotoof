// ============================================
// Users Module — Utils Public API
// Re-exports profile-related utility functions.
// No files were moved — this is a re-export layer.
// ============================================

// CIN validation utilities
export {
  formatCIN,
  maskCIN,
  validateCIN,
} from '@/utils/cinValidation'

// Profile form validation schema
export { profileFormSchema } from '@/lib/validationSchemas'
