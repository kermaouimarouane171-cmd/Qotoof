import { z } from 'zod'
import {
  loginSchema as baseLoginSchema,
  registerSchema as baseRegisterSchema,
  productSchema as baseProductSchema,
  profileUpdateSchema,
} from '@/utils/validationSchemas'

export const loginSchema = baseLoginSchema
export const registerSchema = baseRegisterSchema

// Product schema used by admin/vendor forms that rely on stock_quantity naming.
export const productSchema = z.object({
  name: z.string().min(2, 'اسم المنتج مطلوب'),
  price: z.coerce.number().positive('السعر يجب أن يكون أكبر من 0'),
  stock_quantity: z.coerce.number().min(0, 'الكمية يجب أن تكون 0 أو أكثر'),
  category: z.string().min(1, 'الفئة مطلوبة'),
})

export const vendorSchema = z.object({
  company_name: z.string().min(2, 'اسم الشركة مطلوب'),
  contact_phone: z
    .string()
    .min(8, 'رقم الهاتف غير صالح')
    .max(20, 'رقم الهاتف غير صالح'),
  email: z.string().email('البريد الإلكتروني غير صالح'),
})

export const profileFormSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters')
    .regex(/^[a-zA-Z\u0600-\u06FF\s'-]+$/, 'First name can only contain letters'),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters')
    .regex(/^[a-zA-Z\u0600-\u06FF\s'-]+$/, 'Last name can only contain letters'),
  phone: z
    .string()
    .optional()
    .refine((value) => !value || /^[+]?[\d\s()-]{8,15}$/.test(value), {
      message: 'Please enter a valid phone number',
    }),
  address: z
    .string()
    .optional()
    .refine((value) => !value || value.length <= 200, {
      message: 'Address must be less than 200 characters',
    }),
  city: z
    .string()
    .optional()
    .refine((value) => !value || value.length <= 50, {
      message: 'City must be less than 50 characters',
    }),
  storeName: z
    .string()
    .optional()
    .refine((value) => !value || (value.length >= 3 && value.length <= 100), {
      message: 'Store name must be between 3 and 100 characters',
    }),
  storeDescription: z
    .string()
    .optional()
    .refine((value) => !value || value.length <= 500, {
      message: 'Store description must be less than 500 characters',
    }),
})

export { baseProductSchema, profileUpdateSchema }
