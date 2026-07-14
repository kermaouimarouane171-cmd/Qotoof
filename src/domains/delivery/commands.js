/**
 * @domain delivery
 * @side-effects Writes to `deliveries` table via Supabase or Edge Functions
 * @auth-required true
 */

import { deliveriesApi } from '@/modules/delivery';

/** Driver accepts a delivery assignment. */
export const acceptDelivery  = (deliveryId)         => deliveriesApi.acceptDelivery(deliveryId);

/** Driver rejects a delivery assignment. */
export const rejectDelivery  = (deliveryId, reason) => deliveriesApi.rejectDelivery(deliveryId, reason);

/** Driver marks parcel as picked up from vendor. */
export const markPickedUp    = (deliveryId)         => deliveriesApi.markPickedUp(deliveryId);

/** Driver marks delivery as on the way. */
export const markOnTheWay    = (deliveryId)         => deliveriesApi.markOnTheWay(deliveryId);

/** Driver marks delivery as completed. */
export const markDelivered   = (deliveryId, proof)  => deliveriesApi.markDelivered(deliveryId, proof);
