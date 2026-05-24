/**
 * @domain ordering
 * @auth-required true
 *
 * Order read operations (queries).
 * Sourced from `src/services/api.js` → ordersApi and useOrderView hook.
 */

import { ordersApi } from '@/services/api';

/** Fetch all orders for the current user. */
export const getAllOrders = (filters) => ordersApi.getAll(filters);

/** Fetch a single order by ID. */
export const getOrderById = (orderId) => ordersApi.getById(orderId);

/**
 * TanStack Query hook — unified order read model via RPC.
 * Returns { order, items, payment, buyer, vendor, driver, delivery }.
 *
 * @example
 * const { data } = useOrderView(orderId);
 */
export { useOrderView } from '@/hooks/useOrderView';
