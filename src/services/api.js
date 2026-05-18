import { supabase } from './supabase'
import { authAdminOps } from './authAdminOps'
import {
  hydrateRowsWithProductItems,
  isProductImagesRelationError,
  runProductImageFallbackQuery,
} from './productImages'
import { useAuthStore } from '@/store/authStore'
import { withRetry } from '@/utils/withRetry'
import { sanitizePostgRESTFilter } from '@/utils/sanitization'

const PRODUCT_LIST_FIELDS = `
  id, name, description, category, subcategory,
  price_per_unit, unit_type, stock_quantity,
  min_order_quantity, is_available, approval_status,
  created_at, vendor_id
`

const PRODUCT_LIST_SELECT = `
  ${PRODUCT_LIST_FIELDS},
  product_images(url, is_primary)
`

const PRODUCT_DETAIL_SELECT = `
  *,
  product_images(url, is_primary),
  reviews!inner(rating, comment, created_at)
`

const PRODUCT_DETAIL_SELECT_WITHOUT_IMAGES = `
  *,
  reviews!inner(rating, comment, created_at)
`

const PENDING_PRODUCT_SELECT = `
  id, name, description, category, price_per_unit, unit_type,
  approval_status, created_at, vendor_id,
  vendor:profiles(first_name, last_name, store_name),
  images:product_images(url, is_primary)
`

const PENDING_PRODUCT_SELECT_WITHOUT_IMAGES = `
  id, name, description, category, price_per_unit, unit_type,
  approval_status, created_at, vendor_id,
  vendor:profiles(first_name, last_name, store_name)
`

const ORDER_DETAIL_SELECT = `
  *,
  buyer:profiles!buyer_id(id, first_name, last_name, avatar_url, phone, email),
  vendor:profiles!vendor_id(id, first_name, last_name, avatar_url, phone, store_name),
  items:order_items(id, product_id, quantity, unit_price, product:products(id, name, images:product_images(url, is_primary)))
`

const ORDER_DETAIL_SELECT_WITHOUT_IMAGES = `
  *,
  buyer:profiles!buyer_id(id, first_name, last_name, avatar_url, phone, email),
  vendor:profiles!vendor_id(id, first_name, last_name, avatar_url, phone, store_name),
  items:order_items(id, product_id, quantity, unit_price, product:products(id, name))
`

// Products API
export const productsApi = {
  getAll: async (filters = {}) => {
    return withRetry(async () => {
      const buildQuery = (selectClause) => {
        let query = supabase
          .from('products')
          .select(selectClause, { count: 'exact' })
          .is('deleted_at', null)

        if (filters.category) {
          query = query.eq('category', filters.category)
        }

        if (filters.minPrice) {
          query = query.gte('price_per_unit', filters.minPrice)
        }

        if (filters.maxPrice) {
          query = query.lte('price_per_unit', filters.maxPrice)
        }

        if (filters.search) {
          query = query.or(`name.ilike.%${sanitizePostgRESTFilter(filters.search)}%,description.ilike.%${sanitizePostgRESTFilter(filters.search)}%`)
        }

        if (filters.vendorId) {
          query = query.eq('vendor_id', filters.vendorId)
        }

        if (filters.approvalStatus) {
          query = query.eq('approval_status', filters.approvalStatus)
        }

        const limit = Math.min(filters.limit || 50, 200)
        const offset = filters.offset || 0
        return query
          .range(offset, offset + limit - 1)
          .order('created_at', { ascending: false })
      }

      const { data, count } = await runProductImageFallbackQuery({
        buildQuery,
        selectWithImages: PRODUCT_LIST_SELECT,
        selectWithoutImages: PRODUCT_LIST_FIELDS,
      })

      return { data, total: count }
    }, { maxRetries: 3, baseDelay: 1000 })()
  },

  getById: async (id) => {
    return withRetry(async () => {
      const buildQuery = (selectClause) => supabase
        .from('products')
        .select(selectClause)
        .eq('id', id)
        .is('deleted_at', null)
        .single()

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
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single()

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  },

  update: async (id, updates) => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  },

  // Secure hard delete through the server-side admin function
  delete: async (id) => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('products')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    }, { maxRetries: 1, baseDelay: 500 })()
  },

  // Restore a soft-deleted product
  restore: async (id) => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('products')
        .update({ deleted_at: null })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 500 })()
  },

  // Get deleted products
  getDeleted: async () => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          vendor:profiles(first_name, last_name, avatar_url, store_name)
        `)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })

      if (error) throw error
      return data
    }, { maxRetries: 3, baseDelay: 1000 })()
  },

  getPending: async () => {
    return withRetry(async () => {
      const buildQuery = (selectClause) => supabase
        .from('products')
        .select(selectClause)
        .eq('approval_status', 'pending')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      const { data } = await runProductImageFallbackQuery({
        buildQuery,
        selectWithImages: PENDING_PRODUCT_SELECT,
        selectWithoutImages: PENDING_PRODUCT_SELECT_WITHOUT_IMAGES,
      })

      return data
    }, { maxRetries: 3, baseDelay: 1000 })()
  },

  // Admin: Approve product
  approve: async (id) => {
    return withRetry(async () => {
      const { data: profile } = useAuthStore.getState()
      const { data, error } = await supabase
        .from('products')
        .update({
          approval_status: 'approved',
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
          is_available: true,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  },

  // Admin: Reject product with reason
  reject: async (id, reason = '') => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('products')
        .update({
          approval_status: 'rejected',
          rejection_reason: reason,
          is_available: false,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  },

  // Admin: Bulk approve products
  bulkApprove: async (ids) => {
    return withRetry(async () => {
      const { data: profile } = useAuthStore.getState()
      const { data, error } = await supabase
        .from('products')
        .update({
          approval_status: 'approved',
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
          is_available: true,
        })
        .in('id', ids)
        .select()

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  },

  // Admin: Bulk reject products
  bulkReject: async (ids, reason = '') => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('products')
        .update({
          approval_status: 'rejected',
          rejection_reason: reason,
          is_available: false,
        })
        .in('id', ids)
        .select()

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 1000 })()
  }
}

// Orders API
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
          *,
          buyer:profiles!buyer_id(first_name, last_name),
          vendor:profiles!vendor_id(first_name, last_name)
        `)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })

      if (error) throw error
      return data
    }, { maxRetries: 3, baseDelay: 1000 })()
  }
}

// Reviews API
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
          *,
          buyer:profiles(first_name, last_name, avatar_url)
        `)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })

      if (error) throw error
      return data
    }, { maxRetries: 3, baseDelay: 1000 })()
  }
}

// Vendors API
export const vendorsApi = {
  getAll: async (filters = {}) => {
    return withRetry(async () => {
      // Pagination: default 50, max 200
      const limit = Math.min(filters.limit || 50, 200)
      const offset = filters.offset || 0

      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, store_name, store_description, avatar_url, city, country, rating, created_at, is_verified', { count: 'exact' })
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
        .from('profiles')
        .select('id, first_name, last_name, email, phone, store_name, store_description, avatar_url, city, country, rating, bio, created_at, is_verified, operating_hours')
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

// Users API (Admin Management)
export const usersApi = {
  getAll: async (filters = {}) => {
    return withRetry(async () => {
      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, role, is_approved, created_at, avatar_url, city, country', { count: 'exact' })

      if (filters.role && filters.role !== 'all') {
        query = query.eq('role', filters.role)
      }

      if (filters.search) {
        query = query.or(`first_name.ilike.%${sanitizePostgRESTFilter(filters.search)}%,last_name.ilike.%${sanitizePostgRESTFilter(filters.search)}%,email.ilike.%${sanitizePostgRESTFilter(filters.search)}%`)
      }

      if (filters.sortBy === 'name') {
        query = query.order('first_name', { ascending: true })
      } else if (filters.sortBy === 'created') {
        query = query.order('created_at', { ascending: false })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      const limit = Math.min(filters.limit || 50, 200)
      const offset = filters.offset || 0
      query = query.range(offset, offset + limit - 1)

      const { data, error, count } = await query

      if (error) throw error
      return { data, count }
    }, { maxRetries: 3, baseDelay: 1000 })()
  },

  getById: async (id) => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
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
  },

  // Soft delete instead of hard delete
  delete: async (id) => {
    return withRetry(async () => {
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', id)
        .single()

      if (userError) throw userError

      await authAdminOps.deleteUser(id)

      return userData
    }, { maxRetries: 1, baseDelay: 500 })()
  },

  // Restore a soft-deleted user
  restore: async (id) => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .update({ deleted_at: null })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    }, { maxRetries: 2, baseDelay: 500 })()
  },

  // Get deleted users
  getDeleted: async () => {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, phone, role, is_approved, is_suspended, created_at, deleted_at')
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })

      if (error) throw error
      return data
    }, { maxRetries: 3, baseDelay: 1000 })()
  }
}

// Analytics API
export const analyticsApi = {
  getVendorStats: async (vendorId) => {
    return withRetry(async () => {
      // Parallel: fetch orders and count in single query
      const [totalOrdersResult, pendingOrdersResult, completedRevenueResult] = await Promise.all([
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('vendor_id', vendorId)
          .is('deleted_at', null),
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('vendor_id', vendorId)
          .eq('status', 'pending')
          .is('deleted_at', null),
        supabase
          .from('orders')
          .select('total')
          .eq('vendor_id', vendorId)
          .eq('status', 'completed')
          .is('deleted_at', null),
      ])

      if (totalOrdersResult.error) throw totalOrdersResult.error
      if (pendingOrdersResult.error) throw pendingOrdersResult.error
      if (completedRevenueResult.error) throw completedRevenueResult.error

      const totalRevenue = completedRevenueResult.data?.reduce((sum, o) => sum + o.total, 0) || 0
      const totalOrders = totalOrdersResult.count || 0
      const pendingOrders = pendingOrdersResult.count || 0

      return {
        totalRevenue,
        totalOrders,
        pendingOrders,
        orders: completedRevenueResult.data?.slice(0, 10) || []
      }
    }, { maxRetries: 3, baseDelay: 1000 })()
  },

  getAdminStats: async () => {
    return withRetry(async () => {
      // Parallel: all independent count queries run simultaneously
      const [usersResult, productsResult, ordersResult, revenueResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null),
        supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null),
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .is('deleted_at', null),
        supabase
          .from('orders')
          .select('total')
          .eq('status', 'completed')
          .is('deleted_at', null),
      ])

      if (usersResult.error) throw usersResult.error
      if (productsResult.error) throw productsResult.error
      if (ordersResult.error) throw ordersResult.error
      if (revenueResult.error) throw revenueResult.error

      const totalRevenue = revenueResult.data?.reduce((sum, o) => sum + o.total, 0) || 0

      return {
        totalUsers: usersResult.count,
        totalProducts: productsResult.count,
        totalOrders: ordersResult.count,
        totalRevenue
      }
    }, { maxRetries: 3, baseDelay: 1000 })()
  }
}
