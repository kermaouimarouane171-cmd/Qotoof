/**
 * ✅ Input Validation Schemas with Zod
 * Type-safe validation for all forms and inputs
 */

import { z } from 'zod'
import {
  emailSchema,
  passwordSchema,
  phoneSchema,
  emailPrimitive,
  strictPasswordPrimitive,
  moroccanPhonePrimitive,
} from '@/utils/validationPrimitives'

// ============================================
// 1. AUTHENTICATION SCHEMAS
// ============================================

/**
 * Login form validation
 */
export const loginSchema = z.object({
  email: emailSchema,

  password: passwordSchema,
})

/**
 * Registration form validation
 */
export const registerSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters')
    .regex(/^[$\p{L}\s\-']+$/u, 'First name contains invalid characters')
    .transform(name => name.trim()),

  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters')
    .regex(/^[$\p{L}\s\-']+$/u, 'Last name contains invalid characters')
    .transform(name => name.trim()),

  email: emailPrimitive,

  password: strictPasswordPrimitive,

  confirmPassword: z.string(),

  role: z
    .enum(['buyer', 'vendor', 'driver'], {
      errorMap: () => ({ message: 'Please select a valid role' }),
    }),

  phone: moroccanPhonePrimitive.optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

/**
 * Registration step 3 (buyer profile) validation
 */
export const registerBuyerProfileSchema = z.object({
  deliveryAddress: z
    .string()
    .min(5, 'Delivery address must be at least 5 characters')
    .max(500, 'Address must be less than 500 characters')
    .transform(addr => addr.trim()),

  preferredPaymentMethod: z
    .enum(['cash', 'bank_transfer', 'paypal'], {
      errorMap: () => ({ message: 'Please select a valid payment method' }),
    }),
})

/**
 * Registration step 3 (vendor profile) validation
 */
export const registerVendorProfileSchema = z.object({
  storeName: z
    .string()
    .min(3, 'Store name must be at least 3 characters')
    .max(100, 'Store name must be less than 100 characters')
    .transform(name => name.trim()),

  storeType: z
    .enum(['farm', 'cooperative', 'wholesale', 'retail'], {
      errorMap: () => ({ message: 'Please select a valid store type' }),
    }),

  city: z
    .string()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City must be less than 100 characters')
    .transform(city => city.trim()),

  cin: z
    .string()
    .min(1, 'CIN is required')
    .transform(cin => cin.trim().toUpperCase()),
})

/**
 * Registration step 3 (driver profile) validation
 */
export const registerDriverProfileSchema = z.object({
  vehicleType: z
    .enum(['motorcycle', 'car', 'van', 'truck'], {
      errorMap: () => ({ message: 'Please select a valid vehicle type' }),
    }),

  vehiclePlate: z
    .string()
    .max(20, 'Vehicle plate must be less than 20 characters')
    .optional()
    .transform(plate => plate?.trim().toUpperCase()),

  cin: z
    .string()
    .min(1, 'CIN is required')
    .transform(cin => cin.trim().toUpperCase()),
})

/**
 * Password reset validation
 */
export const passwordResetSchema = z.object({
  email: emailPrimitive,
})

/**
 * New password validation
 */
export const newPasswordSchema = z.object({
  password: strictPasswordPrimitive,

  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

// ============================================
// 2. PRODUCT SCHEMAS
// ============================================

/**
 * Product creation/update validation
 */
export const productSchema = z.object({
  name: z
    .string()
    .min(3, 'Product name must be at least 3 characters')
    .max(200, 'Product name must be less than 200 characters')
    .transform(name => name.trim()),

  description: z
    .string()
    .max(5000, 'Description must be less than 5000 characters')
    .optional()
    .transform(desc => desc?.trim() || ''),

  category: z
    .enum(['plants', 'vegetables', 'fruits', 'herbs', 'seeds'], {
      errorMap: () => ({ message: 'Please select a valid category' }),
    }),

  subcategory: z
    .string()
    .max(100, 'Subcategory must be less than 100 characters')
    .optional()
    .transform(sub => sub?.trim() || ''),

  price_per_unit: z
    .number({
      required_error: 'Price is required',
      invalid_type_error: 'Price must be a number',
    })
    .positive('Price must be greater than 0')
    .max(1000000, 'Price must be less than 1,000,000'),

  unit_type: z
    .string()
    .min(1, 'Unit type is required')
    .max(20, 'Unit type must be less than 20 characters')
    .default('kg'),

  min_order_quantity: z
    .number()
    .min(0, 'Minimum order quantity must be at least 0')
    .max(100000, 'Minimum order quantity must be less than 100,000')
    .default(1),

  available_quantity: z
    .number()
    .min(0, 'Available quantity must be at least 0')
    .max(1000000, 'Available quantity must be less than 1,000,000'),

  is_available: z.boolean().default(true),

  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .optional(),

  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .optional(),
})

// ============================================
// 3. ORDER SCHEMAS
// ============================================

/**
 * Order creation validation
 */
export const orderSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().uuid('Invalid product ID'),
        quantity: z
          .number()
          .positive('Quantity must be greater than 0')
          .max(100000, 'Quantity must be less than 100,000'),
        unit_price: z
          .number()
          .positive('Unit price must be greater than 0'),
      })
    )
    .min(1, 'Order must contain at least one item'),

  shipping_address: z
    .string()
    .min(10, 'Address must be at least 10 characters')
    .max(500, 'Address must be less than 500 characters')
    .transform(addr => addr.trim()),

  shipping_city: z
    .string()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City must be less than 100 characters')
    .transform(city => city.trim()),

  shipping_country: z
    .string()
    .default('Morocco'),

  shipping_latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .optional(),

  shipping_longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .optional(),

  buyer_notes: z
    .string()
    .max(2000, 'Notes must be less than 2000 characters')
    .optional()
    .transform(notes => notes?.trim() || ''),
})

/**
 * Order status update validation
 */
export const orderStatusSchema = z.object({
  status: z.enum([
    'pending',
    'vendor_accepted',
    'vendor_rejected',
    'driver_assigned',
    'driver_accepted',
    'driver_picked_up',
    'on_the_way',
    'delivered',
    'cancelled',
  ]),

  vendor_notes: z
    .string()
    .max(2000, 'Notes must be less than 2000 characters')
    .optional(),

  cancellation_reason: z
    .string()
    .max(1000, 'Reason must be less than 1000 characters')
    .optional(),
})

// ============================================
// 4. PROFILE SCHEMAS
// ============================================

/**
 * Profile update validation
 */
export const profileUpdateSchema = z.object({
  first_name: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters')
    .optional()
    .transform(name => name?.trim()),

  last_name: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters')
    .optional()
    .transform(name => name?.trim()),

  phone: z
    .union([phoneSchema, z.literal('')])
    .optional()
    .transform(phone => (phone === '' ? undefined : phone)),

  address: z
    .string()
    .max(500, 'Address must be less than 500 characters')
    .optional()
    .transform(addr => addr?.trim()),

  city: z
    .string()
    .max(100, 'City must be less than 100 characters')
    .optional()
    .transform(city => city?.trim()),

  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .optional(),

  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .optional(),

  avatar_url: z
    .string()
    .url('Invalid URL')
    .optional(),
})

// ============================================
// 5. DRIVER SCHEMAS
// ============================================

/**
 * Driver profile validation
 */
export const driverProfileSchema = z.object({
  vehicle_type: z
    .enum(['motorcycle', 'car', 'van', 'truck'], {
      errorMap: () => ({ message: 'Please select a valid vehicle type' }),
    }),

  vehicle_plate: z
    .string()
    .max(20, 'Vehicle plate must be less than 20 characters')
    .optional()
    .transform(plate => plate?.trim().toUpperCase()),

  is_available_for_delivery: z.boolean().default(false),
})

/**
 * Delivery status update validation
 */
export const deliveryStatusSchema = z.object({
  status: z.enum([
    'unassigned',
    'assigned',
    'accepted',
    'picked_up',
    'on_the_way',
    'delivered',
    'failed',
  ]),

  delivery_proof_url: z
    .string()
    .url('Invalid URL')
    .optional(),

  signature_url: z
    .string()
    .url('Invalid URL')
    .optional(),

  driver_notes: z
    .string()
    .max(2000, 'Notes must be less than 2000 characters')
    .optional(),
})

// ============================================
// 6. REVIEW SCHEMAS
// ============================================

/**
 * Review creation validation
 */
export const reviewSchema = z.object({
  rating: z
    .number()
    .int('Rating must be an integer')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),

  comment: z
    .string()
    .max(1000, 'Comment must be less than 1000 characters')
    .optional()
    .transform(comment => comment?.trim() || ''),
})

// ============================================
// 7. STORE SCHEMAS
// ============================================

/**
 * Store creation/update validation
 */
export const storeSchema = z.object({
  name: z
    .string()
    .min(3, 'Store name must be at least 3 characters')
    .max(100, 'Store name must be less than 100 characters')
    .transform(name => name.trim()),

  description: z
    .string()
    .max(2000, 'Description must be less than 2000 characters')
    .optional()
    .transform(desc => desc?.trim() || ''),

  image_url: z
    .string()
    .url('Invalid URL')
    .optional(),

  address: z
    .string()
    .max(500, 'Address must be less than 500 characters')
    .optional()
    .transform(addr => addr?.trim()),

  city: z
    .string()
    .max(100, 'City must be less than 100 characters')
    .optional()
    .transform(city => city?.trim()),

  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90')
    .optional(),

  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180')
    .optional(),

  min_order_value: z
    .number()
    .min(0, 'Minimum order value must be at least 0')
    .default(0),

  delivery_radius_km: z
    .number()
    .min(1, 'Delivery radius must be at least 1 km')
    .max(500, 'Delivery radius must be less than 500 km')
    .default(50),
})

// ============================================
// 8. NOTIFICATION SCHEMAS
// ============================================

/**
 * Notification creation validation
 */
export const notificationSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),

  message: z
    .string()
    .min(1, 'Message is required')
    .max(1000, 'Message must be less than 1000 characters'),

  type: z
    .string()
    .default('info'),

  data: z.record(z.unknown()).optional(),
})

// ============================================
// 9. SEARCH SCHEMAS
// ============================================

/**
 * Search query validation
 */
export const searchSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query is required')
    .max(200, 'Search query must be less than 200 characters')
    .transform(q => q.trim()),

  category: z
    .string()
    .optional(),

  min_price: z
    .number()
    .min(0, 'Minimum price must be at least 0')
    .optional(),

  max_price: z
    .number()
    .min(0, 'Maximum price must be at least 0')
    .optional(),

  page: z
    .number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1),

  limit: z
    .number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must be at most 100')
    .default(20),
})

// ============================================
// 10. ORDER TRACKING SCHEMAS
// ============================================

/**
 * Order number validation schema
 * Validates format: ORD-YYYYMMDD-NNNNN or ORD-XXXXXX (short form)
 */
export const orderNumberSchema = z
  .string()
  .min(3, 'orderTracking.validation.orderNumber.min')
  .max(30, 'orderTracking.validation.orderNumber.max')
  .regex(
    /^[A-Za-z0-9-]+$/,
    'orderTracking.validation.orderNumber.format'
  )
  .transform(s => s.trim().toUpperCase())

/**
 * Moroccan phone number validation schema
 * Accepts: +212XXXXXXXXX, 0XXXXXXXXX, 212XXXXXXXXX
 */
export const moroccanPhoneSchema = z
  .string()
  .min(9, 'orderTracking.validation.phone.min')
  .max(15, 'orderTracking.validation.phone.max')
  .refine(
    (phone) => {
      // Strip all non-digit except leading +
      const cleaned = phone.replace(/[^\d+]/g, '')
      // Match: +212XXXXXXXXX, 212XXXXXXXXX, 0XXXXXXXXX
      return (
        /^\+212\d{9}$/.test(cleaned) ||
        /^212\d{9}$/.test(cleaned) ||
        /^0[5-7]\d{8}$/.test(cleaned)
      )
    },
    { message: 'orderTracking.validation.phone.format' }
  )
  .transform((phone) => {
    // Normalize to +212 format
    const cleaned = phone.replace(/[^\d+]/g, '')
    if (cleaned.startsWith('+212')) return cleaned
    if (cleaned.startsWith('212')) return `+${cleaned}`
    if (cleaned.startsWith('0')) return `+212${cleaned.slice(1)}`
    return cleaned
  })

/**
 * Order tracking search schema (order number OR phone)
 */
export const orderTrackingSchema = z.object({
  orderNumber: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[A-Za-z0-9-]{3,30}$/.test(val.trim()),
      { message: 'orderTracking.validation.orderNumber.format' }
    )
    .transform(val => val?.trim().toUpperCase() || ''),

  phone: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true
        const cleaned = val.replace(/[^\d+]/g, '')
        return (
          /^\+212\d{9}$/.test(cleaned) ||
          /^212\d{9}$/.test(cleaned) ||
          /^0[5-7]\d{8}$/.test(cleaned)
        )
      },
      { message: 'orderTracking.validation.phone.format' }
    )
    .transform((val) => {
      if (!val) return ''
      const cleaned = val.replace(/[^\d+]/g, '')
      if (cleaned.startsWith('+212')) return cleaned
      if (cleaned.startsWith('212')) return `+${cleaned}`
      if (cleaned.startsWith('0')) return `+212${cleaned.slice(1)}`
      return cleaned
    }),
}).refine(
  (data) => data.orderNumber || data.phone,
  {
    message: 'orderTracking.validation.atLeastOne',
    path: ['orderNumber'],
  }
)

// ============================================
// 11. VALIDATION HELPERS
// ============================================

/**
 * Validate data against schema
 */
export const validateData = (schema, data) => {
  try {
    const validatedData = schema.parse(data)
    return {
      success: true,
      data: validatedData,
      errors: null,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = (error.issues || error.errors).map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }))

      return {
        success: false,
        data: null,
        errors,
      }
    }

    throw error
  }
}

/**
 * Create validation hook for React forms
 */
export const useFormValidation = (schema) => {
  return {
    validate: (data) => validateData(schema, data),
    validateField: (field, value) => {
      try {
        const parsed = schema.shape[field].parse(value)
        return { success: true, value: parsed, error: null }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return {
            success: false,
            value: null,
            error: error.errors[0]?.message,
          }
        }
        throw error
      }
    },
  }
}

// ============================================
// Default export
// ============================================
export default {
  loginSchema,
  registerSchema,
  registerBuyerProfileSchema,
  registerVendorProfileSchema,
  registerDriverProfileSchema,
  passwordResetSchema,
  newPasswordSchema,
  productSchema,
  orderSchema,
  orderStatusSchema,
  profileUpdateSchema,
  driverProfileSchema,
  deliveryStatusSchema,
  reviewSchema,
  storeSchema,
  notificationSchema,
  searchSchema,
  orderNumberSchema,
  moroccanPhoneSchema,
  orderTrackingSchema,
  validateData,
  useFormValidation,
}