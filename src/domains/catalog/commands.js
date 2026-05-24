/**
 * @domain catalog
 * @side-effects Writes to `products` table and product_images storage bucket
 * @auth-required true (vendor or admin)
 */

import { productsApi } from '@/services/api';

export const createProduct = (payload)               => productsApi.create(payload);
export const updateProduct = (productId, updates)    => productsApi.update(productId, updates);
export const deleteProduct = (productId)             => productsApi.delete(productId);
