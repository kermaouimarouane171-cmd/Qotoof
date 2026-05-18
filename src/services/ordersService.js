/**
 * Orders Service
 *
 * Centralises direct Supabase queries on the `orders` table for non-admin roles.
 * Admin-only queries remain in their respective admin pages / services.
 */

import { supabase } from '@/services/supabase'

// ── Select clauses ────────────────────────────────────────────────────────────

const VENDOR_ORDERS_SELECT = `
  *,
  buyer:profiles!buyer_id(first_name, last_name, phone),
  items:order_items(*, product:products(name)),
  deliveries:deliveries(
    id,
    driver_id,
    status,
    driver:profiles!driver_id(first_name, last_name, phone),
    current_latitude,
    current_longitude,
    delivery_latitude,
    delivery_longitude
  )
`

// ── Vendor ────────────────────────────────────────────────────────────────────

/**
 * Fetch all orders for a vendor, newest first.
 *
 * @param {string} vendorId - The vendor's profile ID
 * @returns {Promise<Object[]>} Array of order rows (with nested joins)
 */
/**
 * Fetch all orders for a buyer (used for data export — no pagination).
 *
 * @param {string} buyerId - The buyer's user ID
 * @returns {Promise<Object[]>}
 */
export const fetchBuyerOrdersAll = async (buyerId) => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('buyer_id', buyerId)

  if (error) throw error
  return data || []
}

/**
 * Submit a return request for an order.
 *
 * @param {{ orderId: string, buyerId: string, reason: string, description: string, itemIds: string[] }} payload
 * @returns {Promise<Object>} Inserted return_request row
 */
export const submitReturnRequest = async ({ orderId, buyerId, reason, description, itemIds }) => {
  const { data, error } = await supabase
    .from('return_requests')
    .insert({
      order_id: orderId,
      buyer_id: buyerId,
      reason,
      description,
      item_ids: itemIds,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export const fetchVendorOrders = async (vendorId) => {
  const { data, error } = await supabase
    .from('orders')
    .select(VENDOR_ORDERS_SELECT)
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}
