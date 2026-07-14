/**
 * Users API — extracted from src/services/api.js (Phase 4.7)
 *
 * No behavior changes. All Supabase queries, retry logic, and return shapes preserved exactly.
 * Re-exported by src/services/api.js for backward compatibility.
 */

import { authAdminOps } from '../authAdminOps'
import { withRetry } from '@/utils/withRetry'
import { sanitizePostgRESTFilter } from '@/utils/sanitization'
import {
  getUserBasicProfile,
  getUserById,
  listDeletedUsers,
  listUsers,
  updateUserById,
} from '@/data/userRepository'
import { buildRestoreUserPayload } from '@/business/userLogic'

export const usersApi = {
  getAll: async (filters = {}) => {
    return withRetry(async () => {
      const searchFilter = filters.search
        ? `first_name.ilike.%${sanitizePostgRESTFilter(filters.search)}%,last_name.ilike.%${sanitizePostgRESTFilter(filters.search)}%,email.ilike.%${sanitizePostgRESTFilter(filters.search)}%`
        : null

      const query = listUsers({
        filters,
        searchFilter,
        count: 'exact',
      })

      const { data, error, count } = await query

      if (error) throw error
      return { data, count }
    }, { maxRetries: 3, baseDelay: 1000 })()
  },

  getById: async (id) => {
    return withRetry(async () => {
      const { data, error } = await getUserById(id)

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 500 })()
  },

  update: async (id, updates) => {
    return withRetry(async () => {
      const { data, error } = await updateUserById(id, updates)

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  },

  // Soft delete instead of hard delete
  delete: async (id) => {
    return withRetry(async () => {
      const { data: userData, error: userError } = await getUserBasicProfile(id)

      if (userError) throw userError

      await authAdminOps.deleteUser(id)

      return userData
    }, { maxRetries: 1, baseDelay: 500 })()
  },

  // Restore a soft-deleted user
  restore: async (id) => {
    return withRetry(async () => {
      const { data, error } = await updateUserById(id, buildRestoreUserPayload())

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 500 })()
  },

  // Get deleted users
  getDeleted: async () => {
    return withRetry(async () => {
      const { data, error } = await listDeletedUsers()

      if (error) throw error
      return data
    }, { maxRetries: 3, baseDelay: 1000 })()
  }
}
