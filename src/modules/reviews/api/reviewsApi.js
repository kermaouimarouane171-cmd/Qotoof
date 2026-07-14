/**
 * Reviews API — extracted from src/services/api.js (Phase 4.7)
 *
 * No behavior changes. All Supabase queries, retry logic, and return shapes preserved exactly.
 * Re-exported by src/services/api.js for backward compatibility.
 */

import { supabase } from '@/services/supabase'
import { withRetry } from '@/utils/withRetry'

export const reviewsApi = {
  create: async (review) => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('reviews')
        .insert(review)
        .select()
        .single()

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  },

  getByVendor: async (vendorId, filters = {}) => {
    return withRetry(async () => {
      // Pagination: default 20, max 100
      const limit = Math.min(filters.limit || 20, 100)
      const offset = filters.offset || 0

      const { data, error, count } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, product_id, buyer_id, buyer:profiles(first_name, last_name, avatar_url)', { count: 'exact' })
        .eq('vendor_id', vendorId)
        .is('deleted_at', null)
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false })

      if (error) throw error
      return { data, total: count }
    }, { maxRetries: 3, baseDelay: 1000 })()
  },

  // Soft delete a review
  delete: async (id) => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('reviews')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    }, { maxRetries: 1, baseDelay: 500 })()
  },

  // Restore a soft-deleted review
  restore: async (id) => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('reviews')
        .update({ deleted_at: null })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 500 })()
  },

  // Get deleted reviews
  getDeleted: async () => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id, rating, comment, created_at, updated_at,
          product_id, vendor_id, buyer_id, deleted_at,
          buyer:profiles(id, role, first_name, last_name, store_name, phone, avatar_url)
        `)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })

      if (error) throw error
      return data
    }, { maxRetries: 3, baseDelay: 1000 })()
  }
}
