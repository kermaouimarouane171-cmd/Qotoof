// ============================================
// Shared Module — Utils Public API
// Re-exports generic, pure utility functions.
// No files were moved — this is a re-export layer.
// ============================================

// Currency formatting (MAD / Arabic / short format)
export {
  formatPrice,
  formatCurrency,
  formatPriceArabic,
  formatPriceShort,
  PriceDisplay,
} from '@/utils/currency'

// Logger (dev-only console wrapper)
export { logger } from '@/utils/logger'

// Error formatting (Supabase error → Arabic user message)
export { default as formatSupabaseError } from '@/utils/errorFormatter'

// Retry with exponential backoff
export { withRetry, useRetry } from '@/utils/withRetry'

// Zod validation primitives (email, password, phone, CIN, UUID, name)
export {
  emailPrimitive,
  emailSchema,
  strictPasswordPrimitive,
  passwordSchema,
  internationalPhoneSchema,
  moroccanPhonePrimitive,
  phoneSchema,
  moroccanCinSchema,
  uuidPrimitive,
  uuidSchema,
  nameSchema,
} from '@/utils/validationPrimitives'
