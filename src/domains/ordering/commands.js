/**
 * @domain ordering
 * @side-effects Writes to `orders` table via Supabase or Edge Functions
 * @auth-required true
 *
 * Order write operations (commands).
 * Sourced from `src/services/api.js` → ordersApi.
 */

import { ordersApi } from '@/services/api';

/**
 * Create a new order.
 * @param {object} payload
 */
export const createOrder = (payload) => ordersApi.create(payload);

/**
 * Cancel an existing order.
 * @param {string} orderId
 * @param {string} reason
 */
export const cancelOrder = (orderId, reason) => ordersApi.cancel(orderId, reason);

/**
 * Update an order (status, notes, etc.).
 * @param {string} orderId
 * @param {object} updates
 */
export const updateOrder = (orderId, updates) => ordersApi.update(orderId, updates);
