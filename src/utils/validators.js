/**
 * Input Validation Schemas (Zod)
 * Comprehensive validation for all API requests
 */

import { z } from 'zod';

// Common schemas
const emailSchema = z.string().email('Invalid email address').trim();
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');
const phoneSchema = z.string().regex(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/, 'Invalid phone number');
const uuidSchema = z.string().uuid('Invalid ID format');

// AUTH SCHEMAS
export const authSchemas = {
  register: z.object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
    role: z.enum(['buyer', 'seller', 'driver', 'admin']),
    phone: phoneSchema.optional(),
    businessName: z.string().optional(),
    agreeToTerms: z.boolean().refine((val) => val === true, 'You must accept the terms'),
  }).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),

  login: z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
    rememberMe: z.boolean().optional(),
  }),

  verifyEmail: z.object({
    email: emailSchema,
    otp: z.string().length(6, 'OTP must be 6 digits'),
  }),

  refreshToken: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),

  forgotPassword: z.object({
    email: emailSchema,
  }),

  resetPassword: z.object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),

  setupTwoFA: z.object({
    userId: uuidSchema,
  }),

  verifyTwoFA: z.object({
    token: z.string().min(1, 'Token is required'),
    code: z.string().length(6, 'Code must be 6 digits'),
  }),

  updateProfile: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: phoneSchema.optional(),
    avatar: z.string().url().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
  }),
};

// PRODUCT SCHEMAS
export const productSchemas = {
  create: z.object({
    name: z.string().min(2, 'Product name is required').max(255),
    description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
    category: z.string().min(1, 'Category is required'),
    subcategory: z.string().optional(),
    price: z.number().positive('Price must be positive'),
    stock: z.number().int().min(0, 'Stock cannot be negative'),
    minOrderQuantity: z.number().int().min(1, 'Minimum order quantity must be at least 1').optional(),
    unitType: z.enum(['piece', 'kg', 'liter', 'meter', 'hour', 'day'], 'Invalid unit type'),
    images: z.array(z.string().url()).min(1, 'At least one image is required'),
    attributes: z.record(z.string()).optional(),
  }),

  update: z.object({
    name: z.string().min(2).max(255).optional(),
    description: z.string().min(10).max(5000).optional(),
    price: z.number().positive().optional(),
    stock: z.number().int().min(0).optional(),
    unitType: z.enum(['piece', 'kg', 'liter', 'meter', 'hour', 'day']).optional(),
    isAvailable: z.boolean().optional(),
    attributes: z.record(z.string()).optional(),
  }),

  addReview: z.object({
    rating: z.number().min(1).max(5, 'Rating must be between 1 and 5'),
    comment: z.string().min(1, 'Comment is required').max(500),
    photos: z.array(z.string().url()).optional(),
  }),

  search: z.object({
    query: z.string().min(1, 'Search query is required'),
    category: z.string().optional(),
    minPrice: z.number().min(0).optional(),
    maxPrice: z.number().min(0).optional(),
    page: z.number().int().min(1).optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),
};

// CART SCHEMAS
export const cartSchemas = {
  addItem: z.object({
    productId: uuidSchema,
    quantity: z.number().int().min(1, 'Quantity must be at least 1').max(1000),
    attributes: z.record(z.string()).optional(),
  }),

  updateItem: z.object({
    quantity: z.number().int().min(1).max(1000),
  }),

  applyCoupon: z.object({
    code: z.string().min(1, 'Coupon code is required').max(50),
  }),
};

// ORDER SCHEMAS
export const orderSchemas = {
  create: z.object({
    items: z.array(
      z.object({
        productId: uuidSchema,
        quantity: z.number().int().min(1),
        price: z.number().positive(),
      })
    ).min(1, 'At least one item is required'),
    shippingAddressId: uuidSchema.optional(),
    shippingAddress: z.object({
      street: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(1),
      zipCode: z.string().min(1),
      country: z.string().min(1),
    }).optional(),
    paymentMethod: z.enum(['cmi', 'cod', 'bank']),
    couponCode: z.string().optional(),
    shippingMethod: z.enum(['standard', 'express', 'overnight']).optional(),
    notes: z.string().max(500).optional(),
  }),

  cancel: z.object({
    reason: z.string().min(1, 'Cancellation reason is required').max(500),
  }),

  return: z.object({
    reason: z.string().min(1, 'Return reason is required').max(500),
    items: z.array(
      z.object({
        orderItemId: uuidSchema,
        quantity: z.number().int().min(1),
      })
    ).min(1, 'At least one item must be returned'),
  }),
};

// PAYMENT SCHEMAS
export const paymentSchemas = {
  stripeIntent: z.object({
    orderId: uuidSchema,
    amount: z.number().positive('Amount must be positive'),
  }),

  stripeConfirm: z.object({
    paymentIntentId: z.string().min(1),
    token: z.string().optional(),
  }),

  cmiProcess: z.object({
    orderId: uuidSchema,
    amount: z.number().positive(),
    cardNumber: z.string().regex(/^\d{16}$/, 'Invalid card number'),
    expiryDate: z.string().regex(/^\d{2}\/\d{2}$/, 'Invalid expiry date'),
    cvv: z.string().regex(/^\d{3,4}$/, 'Invalid CVV'),
    cardholderName: z.string().min(2, 'Cardholder name is required'),
  }),

  codConfirm: z.object({
    orderId: uuidSchema,
  }),

  refund: z.object({
    orderId: uuidSchema,
    amount: z.number().positive().optional(),
    reason: z.string().min(1, 'Refund reason is required').max(500),
  }),
};

// VENDOR SCHEMAS
export const vendorSchemas = {
  updateProfile: z.object({
    businessName: z.string().min(2).max(255).optional(),
    description: z.string().max(2000).optional(),
    image: z.string().url().optional(),
    phone: phoneSchema.optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
    businessHours: z.object({
      monday: z.array(z.string()).optional(),
      tuesday: z.array(z.string()).optional(),
      wednesday: z.array(z.string()).optional(),
      thursday: z.array(z.string()).optional(),
      friday: z.array(z.string()).optional(),
      saturday: z.array(z.string()).optional(),
      sunday: z.array(z.string()).optional(),
    }).optional(),
  }),

  updateOrderStatus: z.object({
    status: z.enum(['confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
    notes: z.string().optional(),
  }),
};

// DRIVER SCHEMAS
export const driverSchemas = {
  updateProfile: z.object({
    vehicleType: z.string().optional(),
    vehicleColor: z.string().optional(),
    licensePlate: z.string().optional(),
    licenseNumber: z.string().optional(),
    licenseExpiry: z.string().datetime().optional(),
    insuranceNumber: z.string().optional(),
    bankAccount: z.string().optional(),
    bankName: z.string().optional(),
  }),

  updateLocation: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().optional(),
    heading: z.number().optional(),
    speed: z.number().optional(),
  }),

  startDelivery: z.object({
    photoProof: z.string().url(),
    notes: z.string().optional(),
  }),

  completeDelivery: z.object({
    photoProof: z.string().url(),
    signature: z.string().optional(),
    otp: z.string().length(6, 'OTP must be 6 digits').optional(),
    notes: z.string().optional(),
  }),
};

// ADMIN SCHEMAS
export const adminSchemas = {
  updateUser: z.object({
    role: z.enum(['buyer', 'seller', 'driver', 'admin']).optional(),
    status: z.enum(['active', 'inactive', 'suspended', 'banned']).optional(),
    email: emailSchema.optional(),
    isEmailVerified: z.boolean().optional(),
  }),

  approveProduct: z.object({
    approved: z.boolean(),
    rejectionReason: z.string().optional(),
  }),

  updateSettings: z.object({
    commissonRate: z.number().min(0).max(100).optional(),
    minOrderAmount: z.number().min(0).optional(),
    shippingCost: z.number().min(0).optional(),
    taxRate: z.number().min(0).max(100).optional(),
    maintenanceMode: z.boolean().optional(),
  }),
};

// USER SCHEMAS
export const userSchemas = {
  addAddress: z.object({
    label: z.string().min(1, 'Address label is required'),
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    zipCode: z.string().min(1, 'ZIP code is required'),
    country: z.string().min(1, 'Country is required'),
    isDefault: z.boolean().optional(),
  }),

  updateAddress: z.object({
    label: z.string().optional(),
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    country: z.string().optional(),
    isDefault: z.boolean().optional(),
  }),

  updatePreferences: z.object({
    emailNotifications: z.boolean().optional(),
    smsNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    language: z.enum(['en', 'ar', 'fr']).optional(),
    currency: z.string().optional(),
    darkMode: z.boolean().optional(),
  }),
};

// SUPPORT SCHEMAS
export const supportSchemas = {
  createTicket: z.object({
    title: z.string().min(5, 'Title must be at least 5 characters').max(255),
    description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
    category: z.enum(['billing', 'product', 'delivery', 'account', 'other']),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    attachments: z.array(z.string().url()).optional(),
  }),

  addReply: z.object({
    message: z.string().min(1, 'Message is required').max(5000),
    attachments: z.array(z.string().url()).optional(),
  }),
};

/**
 * Validation utility function
 */
export const validateInput = async (schema, data) => {
  try {
    const validated = await schema.parseAsync(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      };
    }
    return { success: false, errors: [{ message: 'Validation failed' }] };
  }
};

export default {
  authSchemas,
  productSchemas,
  cartSchemas,
  orderSchemas,
  paymentSchemas,
  vendorSchemas,
  driverSchemas,
  adminSchemas,
  userSchemas,
  supportSchemas,
};
