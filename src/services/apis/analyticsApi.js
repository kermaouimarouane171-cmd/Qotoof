/**
 * Analytics API — extracted from src/services/api.js (Phase 4.7)
 *
 * No behavior changes. All Supabase queries, retry logic, and return shapes preserved exactly.
 * Re-exported by src/services/api.js for backward compatibility.
 */

import { supabase } from '../supabase'
import { withRetry } from '@/utils/withRetry'
import { requireAdmin, requireVendorMatch } from '@/utils/authHelpers'

export const analyticsApi = {
  getVendorStats: async (vendorId) => {
    // Defense-in-depth: verify vendorId matches authenticated user
    const vendorCheck = await requireVendorMatch(vendorId)
    if (!vendorCheck.isVendor) {
      return { error: vendorCheck.error }
    }

    return withRetry(async () => {
      // Parallel: fetch orders and count in single query
      const [totalOrdersResult, pendingOrdersResult, completedRevenueResult] = await Promise.all([
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('vendor_id', vendorId)
          .is('deleted_at', null),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
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
    // Defense-in-depth: verify admin role (complements RLS)
    const adminCheck = await requireAdmin()
    if (!adminCheck.isAdmin) {
      return { error: adminCheck.error }
    }

    return withRetry(async () => {
      // Parallel: all independent count queries run simultaneously
      const [usersResult, productsResult, ordersResult, revenueResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null),
        supabase
          .from('products')
          .select('id', { count: 'exact', head: true })
          .is('deleted_at', null),
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
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
