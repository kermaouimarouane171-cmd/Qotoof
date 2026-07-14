/**
 * Vendors API — extracted from src/services/api.js (Phase 4.7)
 *
 * No behavior changes. All Supabase queries, retry logic, and return shapes preserved exactly.
 * Re-exported by src/services/api.js for backward compatibility.
 */

import { supabase } from '../supabase'
import { withRetry } from '@/utils/withRetry'
import { sanitizePostgRESTFilter } from '@/utils/sanitization'

export const vendorsApi = {
  getAll: async (filters = {}) => {
    return withRetry(async () => {
      // Pagination: default 50, max 200
      const limit = Math.min(filters.limit || 50, 200)
      const offset = filters.offset || 0

      let query = supabase
        .from('public_vendor_profiles')
        .select('id, first_name, last_name, store_name, store_description, avatar_url, city, country, rating, created_at, is_verified', { count: 'exact' })
        .eq('role', 'vendor')
        .eq('is_approved', true)
        .range(offset, offset + limit - 1)

      if (filters.search) {
        query = query.or(`store_name.ilike.%${sanitizePostgRESTFilter(filters.search)}%,first_name.ilike.%${sanitizePostgRESTFilter(filters.search)}%,last_name.ilike.%${sanitizePostgRESTFilter(filters.search)}%`)
      }

      query = query.order('created_at', { ascending: false })

      const { data, error, count } = await query
      if (error) throw error
      return { data, total: count }
    }, { maxRetries: 3, baseDelay: 1000 })()
  },

  getById: async (id) => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('public_vendor_profiles')
        .select('id, first_name, last_name, store_name, store_description, avatar_url, city, country, rating, bio, created_at, is_verified, operating_hours')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 500 })()
  },

  update: async (id, updates) => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  }
}
