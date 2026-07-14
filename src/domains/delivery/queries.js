/**
 * @domain delivery
 * @auth-required true
 */

import { deliveriesApi } from '@/modules/delivery';

/** Fetch a single delivery record by ID. */
export const getDeliveryById     = (deliveryId) => deliveriesApi.getById(deliveryId);

/** Fetch all deliveries assigned to the current driver. */
export const getDriverDeliveries = (filters)    => deliveriesApi.getDriverDeliveries(filters);
