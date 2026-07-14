/**
 * Orders API — extracted from src/services/api.js (Phase 4.7)
 *
 * No behavior changes. All Supabase queries, retry logic, and return shapes preserved exactly.
 * Re-exported by src/services/api.js for backward compatibility.
 */

import { supabase } from '../supabase'
import {
  hydrateRowsWithProductItems,
  isProductImagesRelationError,
} from '@/modules/catalog'
import { withRetry } from '@/utils/withRetry'

const ORDER_DETAIL_SELECT = `
  id, order_number, buyer_id, vendor_id,
  status, total, payment_status, payment_method,
  shipping_address, shipping_city,
  created_at, updated_at,
  buyer:profiles!buyer_id(id, first_name, last_name, avatar_url, phone, email),
  vendor:profiles!vendor_id(id, first_name, last_name, avatar_url, phone, store_name),
  items:order_items(id, product_id, quantity, unit_price, product:products(id, name, images:product_images(url, is_primary)))
`

const ORDER_DETAIL_SELECT_WITHOUT_IMAGES = `
  id, order_number, buyer_id, vendor_id,
  status, total, payment_status, payment_method,
  shipping_address, shipping_city,
  created_at, updated_at,
  buyer:profiles!buyer_id(id, first_name, last_name, avatar_url, phone, email),
  vendor:profiles!vendor_id(id, first_name, last_name, avatar_url, phone, store_name),
  items:order_items(id, product_id, quantity, unit_price, product:products(id, name))
`

export const ordersApi = {
  getAll: async (filters = {}) => {
    return withRetry(async () => {
      // Flatten query: fetch orders without deep joins, items fetched separately when needed
      let query = supabase
        .from('orders')
        .select(`
          id, order_number, buyer_id, vendor_id, total, status,
          payment_status, payment_method, shipping_address, shipping_city,
          created_at, updated_at,
          buyer:profiles!buyer_id(first_name, last_name, avatar_url),
          vendor:profiles!vendor_id(first_name, last_name, avatar_url, store_name)
        `, { count: 'exact' })
        .is('deleted_at', null)

      if (filters.buyerId) {
        query = query.eq('buyer_id', filters.buyerId)
      }

      if (filters.vendorId) {
        query = query.eq('vendor_id', filters.vendorId)
      }

      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      // Pagination: default 50, max 200
      const limit = Math.min(filters.limit || 50, 200)
      const offset = filters.offset || 0
      query = query.range(offset, offset + limit - 1)

      query = query.order('created_at', { ascending: false })

      const { data, error, count } = await query
      if (error) throw error
      return { data, total: count }
    }, { maxRetries: 3, baseDelay: 1000 })()
  },

  getById: async (id) => {
    return withRetry(async () => {
      const buildQuery = (selectClause) => supabase
        .from('orders')
        .select(selectClause)
        .eq('id', id)
        .is('deleted_at', null)
        .single()

      const { data, error } = await buildQuery(ORDER_DETAIL_SELECT)
      if (error) {
        if (!isProductImagesRelationError(error)) throw error

        const { data: fallbackData, error: fallbackError } = await buildQuery(ORDER_DETAIL_SELECT_WITHOUT_IMAGES)
        if (fallbackError) throw fallbackError

        const [hydratedOrder] = await hydrateRowsWithProductItems(fallbackData ? [fallbackData] : [])
        return hydratedOrder || null
      }

      return data
    }, { maxRetries: 2, baseDelay: 500 })()
  },

  create: async (order) => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('orders')
        .insert(order)
        .select()
        .single()

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  },

  updateStatus: async (id, status) => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  },

  // Soft delete instead of hard delete
  delete: async (id) => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('orders')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    }, { maxRetries: 1, baseDelay: 500 })()
  },

  // Restore a soft-deleted order
  restore: async (id) => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('orders')
        .update({ deleted_at: null })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 500 })()
  },

  // Get deleted orders
  getDeleted: async () => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, buyer_id, vendor_id,
          status, total, payment_status, payment_method,
          created_at, updated_at, deleted_at,
          buyer:profiles!buyer_id(id, role, first_name, last_name, store_name, phone),
          vendor:profiles!vendor_id(id, role, first_name, last_name, store_name, phone)
        `)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })

      if (error) throw error
      return data
    }, { maxRetries: 3, baseDelay: 1000 })()
  }
}
