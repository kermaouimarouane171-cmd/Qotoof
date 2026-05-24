/**
 * @domain catalog
 */

import { productsApi } from '@/services/api';

export const getAllProducts = (filters) => productsApi.getAll(filters);
export const getProductById = (id)      => productsApi.getById(id);
