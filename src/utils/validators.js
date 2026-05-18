import { z } from 'zod'
import { uuidPrimitive } from '@/utils/validationPrimitives'

const categorySchema = z.enum(['plants', 'vegetables', 'fruits', 'herbs', 'seeds'])

const quantitySchema = z
  .number({ invalid_type_error: 'Quantity must be a number' })
  .positive('Quantity must be greater than 0')

export const productSchemas = {
  create: z.object({
    name: z.string().min(3).max(200).transform((value) => value.trim()),
    description: z.string().max(5000).optional().default(''),
    category: categorySchema,
    price: z.number().positive('Price must be greater than 0').max(1000000),
    stock: z.number().min(0, 'Stock must be at least 0').max(1000000),
    minOrderQuantity: z.number().min(0, 'Minimum order quantity must be at least 0').max(100000),
    unitType: z.string().min(1).max(20),
    images: z.array(z.string().url()).optional().default([]),
  }),
}

export const cartSchemas = {
  addItem: z.object({
    productId: uuidPrimitive,
    quantity: quantitySchema.max(100000),
  }),
}

export const orderSchemas = {
  create: z.object({
    items: z.array(
      z.object({
        productId: uuidPrimitive,
        quantity: quantitySchema.max(100000),
        price: z.number().positive('Price must be greater than 0'),
      })
    ).min(1, 'Order must contain at least one item'),
    shippingAddress: z.object({
      street: z.string().min(3).max(500),
      city: z.string().min(2).max(100),
      state: z.string().min(2).max(100),
      zipCode: z.string().min(3).max(20),
      country: z.string().min(2).max(100),
    }),
    paymentMethod: z.enum(['bank', 'paypal', 'cod', 'bank_transfer', 'cash', 'cash_on_delivery', 'cmi']),
  }),
}

export default {
  productSchemas,
  cartSchemas,
  orderSchemas,
}