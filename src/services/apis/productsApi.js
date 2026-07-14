/**
 * Products API — extracted from src/services/api.js (Phase 4.7)
 *
 * No behavior changes. All Supabase queries, retry logic, and return shapes preserved exactly.
 * Re-exported by src/services/api.js for backward compatibility.
 */

import { supabase } from '../supabase'
import {
  runProductImageFallbackQuery,
} from '@/modules/catalog'
import { withRetry } from '@/utils/withRetry'
import { sanitizePostgRESTFilter } from '@/utils/sanitization'
import { isMissingDeletedAtColumnError } from '@/utils/supabaseErrors'
import { assertPayPalSetupOrThrow } from '@/utils/paypalEligibility'
import {
  getProductById,
  insertProduct,
  listDeletedProducts,
  listPendingProducts,
  listProducts,
  productSelects,
  updateManyProducts,
  updateProductById,
} from '@/data/productRepository'
import {
  buildApprovalPayload,
  buildRejectionPayload,
  buildRestorePayload,
  buildSoftDeletePayload,
  buildSuspensionPayload,
} from '@/business/productLogic'

const {
  PRODUCT_LIST_FIELDS,
  PRODUCT_LIST_SELECT,
  PRODUCT_DETAIL_SELECT,
  PRODUCT_DETAIL_SELECT_WITHOUT_IMAGES,
  PENDING_PRODUCT_SELECT,
  PENDING_PRODUCT_SELECT_WITHOUT_IMAGES,
} = productSelects

const getCurrentUserProfile = async () => {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError

  const userId = authData?.user?.id
  if (!userId) {
    const error = new Error('Authentication required')
    error.code = 'AUTH_REQUIRED'
    throw error
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, paypal_email, paypal_verified')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) throw profileError

  return profile
}

export const productsApi = {
  getAll: async (filters = {}) => {
    return withRetry(async () => {
      const buildQuery = (selectClause, includeDeletedFilter = true) => {
        const sanitizedFilters = {
          ...filters,
          search: filters.search
            ? `name.ilike.%${sanitizePostgRESTFilter(filters.search)}%,description.ilike.%${sanitizePostgRESTFilter(filters.search)}%`
            : null,
        }

        return listProducts({
          filters: sanitizedFilters,
          selectClause,
          includeDeletedFilter,
          count: 'exact',
        })
      }

      let data
      let count

      try {
        const result = await runProductImageFallbackQuery({
          buildQuery: (selectClause) => buildQuery(selectClause, true),
          selectWithImages: PRODUCT_LIST_SELECT,
          selectWithoutImages: PRODUCT_LIST_FIELDS,
        })
        data = result.data
        count = result.count
      } catch (error) {
        if (!isMissingDeletedAtColumnError(error)) {
          throw error
        }

        const result = await runProductImageFallbackQuery({
          buildQuery: (selectClause) => buildQuery(selectClause, false),
          selectWithImages: PRODUCT_LIST_SELECT,
          selectWithoutImages: PRODUCT_LIST_FIELDS,
        })
        data = result.data
        count = result.count
      }

      return { data, total: count }
    }, { maxRetries: 3, baseDelay: 1000 })()
  },

  getById: async (id) => {
    return withRetry(async () => {
      const buildQuery = (selectClause) => getProductById({ id, selectClause })

      const { data } = await runProductImageFallbackQuery({
        buildQuery,
        selectWithImages: PRODUCT_DETAIL_SELECT,
        selectWithoutImages: PRODUCT_DETAIL_SELECT_WITHOUT_IMAGES,
      })

      return data
    }, { maxRetries: 2, baseDelay: 500 })()
  },

  create: async (product) => {
    return withRetry(async () => {
      const profile = await getCurrentUserProfile()
      assertPayPalSetupOrThrow(profile, 'PayPal setup is required before publishing products')

      const { data, error } = await insertProduct(product)

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  },

  update: async (id, updates) => {
    return withRetry(async () => {
      const { data, error } = await updateProductById(id, updates)

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  },

  // Secure hard delete through the server-side admin function
  delete: async (id) => {
    return withRetry(async () => {
      const { data, error } = await updateProductById(id, buildSoftDeletePayload())

      if (error) throw error
      return data
    }, { maxRetries: 1, baseDelay: 500 })()
  },

  // Restore a soft-deleted product
  restore: async (id) => {
    return withRetry(async () => {
      const { data, error } = await updateProductById(id, buildRestorePayload())

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 500 })()
  },

  // Get deleted products
  getDeleted: async () => {
    return withRetry(async () => {
      const { data, error } = await listDeletedProducts()

      if (error) throw error
      return data
    }, { maxRetries: 3, baseDelay: 1000 })()
  },

  getPending: async () => {
    return withRetry(async () => {
      const buildQuery = (selectClause) => listPendingProducts({ selectClause })

      const { data } = await runProductImageFallbackQuery({
        buildQuery,
        selectWithImages: PENDING_PRODUCT_SELECT,
        selectWithoutImages: PENDING_PRODUCT_SELECT_WITHOUT_IMAGES,
      })

      return data
    }, { maxRetries: 3, baseDelay: 1000 })()
  },

  // Admin: Approve (publish) product
  approve: async (id, adminId = null) => {
    return withRetry(async () => {
      const { data, error } = await updateProductById(id, buildApprovalPayload(adminId))

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  },

  // Admin: Suspend product
  suspend: async (id) => {
    return withRetry(async () => {
      const { data, error } = await updateProductById(id, buildSuspensionPayload())

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  },

  // Admin: Reject product with reason
  reject: async (id, reason = '') => {
    return withRetry(async () => {
      const { data, error } = await updateProductById(id, buildRejectionPayload(reason))

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  },

  // Admin: Bulk approve (publish) products
  bulkApprove: async (ids, adminId = null) => {
    return withRetry(async () => {
      const { data, error } = await updateManyProducts(ids, buildApprovalPayload(adminId))

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  },

  // Admin: Bulk suspend products
  bulkSuspend: async (ids) => {
    return withRetry(async () => {
      const { data, error } = await updateManyProducts(ids, buildSuspensionPayload())

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  },

  // Admin: Bulk reject products
  bulkReject: async (ids, reason = '') => {
    return withRetry(async () => {
      const { data, error } = await updateManyProducts(ids, buildRejectionPayload(reason))

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  }
}
