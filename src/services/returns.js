import { supabase } from './supabase'
import { withRetry } from '@/utils/withRetry'

/**
 * Return Requests API Service
 * Handles product return/refund requests from buyers
 */
export const returnsApi = {
  // ============================================
  // Buyer operations
  // ============================================

  /**
   * Create a new return request
   */
  createReturnRequest: withRetry(async (returnData) => {
    // Validate required fields
    if (!returnData.order_id) throw new Error('Order ID is required')
    if (!returnData.product_id) throw new Error('Product ID is required')
    if (!returnData.reason || !['defective', 'wrong_item', 'not_as_described', 'changed_mind', 'other'].includes(returnData.reason)) {
      throw new Error('Valid reason is required')
    }

    const requestData = {
      buyer_id: returnData.buyer_id,
      order_id: returnData.order_id,
      product_id: returnData.product_id,
      reason: returnData.reason,
      description: returnData.description || '',
      quantity: returnData.quantity || 1,
      status: 'pending',
      created_at: new Date().toISOString(),
    }

    // Add photo URLs if uploaded
    if (returnData.photoUrls && returnData.photoUrls.length > 0) {
      requestData.photo_urls = returnData.photoUrls
    }

    const { data, error } = await supabase
      .from('return_requests')
      .insert(requestData)
      .select()
      .single()

    if (error) throw error
    return data
  }, { maxRetries: 2, baseDelay: 1000 }),

  /**
   * Get user's return requests - Optimized: pagination
   */
  getUserReturns: withRetry(async (userId, filters = {}) => {
    // Pagination: default 20, max 100
    const limit = Math.min(filters.limit || 20, 100)
    const offset = filters.offset || 0

    let query = supabase
      .from('return_requests')
      .select(`
        id, order_id, product_id, reason, description, quantity,
        status, created_at, updated_at,
        order:orders(order_number, total, created_at, vendor_id),
        product:products(name, images:product_images!is_primary(url)),
        vendor:profiles!return_requests_vendor_id_fkey(store_name)
      `, { count: 'exact' })
      .eq('buyer_id', userId)
      .range(offset, offset + limit - 1)

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error, count } = await query
    if (error) throw error
    return { data: data || [], total: count }
  }, { maxRetries: 3, baseDelay: 1000 }),

  /**
   * Get a specific return request - Optimized: selective columns
   */
  getReturnById: withRetry(async (returnId) => {
    const { data, error } = await supabase
      .from('return_requests')
      .select(`
        id, order_id, product_id, buyer_id, vendor_id,
        reason, description, quantity, status,
        photo_urls, vendor_response, vendor_response_at,
        admin_notes, processed_by, processed_at,
        created_at, updated_at,
        order:orders(id, order_number, total, status, created_at,
          buyer:profiles!orders_buyer_id_fkey(id, first_name, last_name, email, phone),
          vendor:profiles!orders_vendor_id_fkey(id, first_name, last_name, store_name)
        ),
        product:products(id, name, price_per_unit, images:product_images!is_primary(url)),
        admin_notes_data:return_notes(id, note, created_at, created_by)
      `)
      .eq('id', returnId)
      .single()

    if (error) throw error
    return data
  }, { maxRetries: 2, baseDelay: 500 }),

  /**
   * Cancel a return request (buyer can cancel while pending)
   */
  cancelReturnRequest: withRetry(async (returnId, userId) => {
    const { data, error } = await supabase
      .from('return_requests')
      .update({
        status: 'cancelled_by_buyer',
        updated_at: new Date().toISOString(),
      })
      .eq('id', returnId)
      .eq('buyer_id', userId)
      .eq('status', 'pending')
      .select()
      .single()

    if (error) throw error
    return data
  }, { maxRetries: 2, baseDelay: 1000 }),

  // ============================================
  // Vendor operations
  // ============================================

  /**
   * Get return requests for vendor's orders - Optimized: pagination
   */
  getVendorReturns: withRetry(async (vendorId, filters = {}) => {
    // Pagination: default 20, max 100
    const limit = Math.min(filters.limit || 20, 100)
    const offset = filters.offset || 0

    let query = supabase
      .from('return_requests')
      .select(`
        id, order_id, product_id, buyer_id, reason, description, quantity,
        status, created_at,
        buyer:profiles!return_requests_buyer_id_fkey(first_name, last_name, phone),
        order:orders(order_number, total),
        product:products(name, images:product_images!is_primary(url))
      `, { count: 'exact' })
      .eq('vendor_id', vendorId)
      .range(offset, offset + limit - 1)

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error, count } = await query
    if (error) throw error
    return { data: data || [], total: count }
  }, { maxRetries: 3, baseDelay: 1000 }),

  /**
   * Vendor respond to return request (approve/reject)
   */
  respondToReturnRequest: withRetry(async (returnId, vendorId, action, responseNotes) => {
    if (!['approved', 'rejected'].includes(action)) {
      throw new Error('Action must be "approved" or "rejected"')
    }

    const { data, error } = await supabase
      .from('return_requests')
      .update({
        status: action === 'approved' ? 'vendor_approved' : 'vendor_rejected',
        vendor_response: responseNotes || '',
        vendor_response_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', returnId)
      .eq('vendor_id', vendorId)
      .select()
      .single()

    if (error) throw error

    // Create notification for buyer
    if (data) {
      const orderData = await supabase
        .from('return_requests')
        .select('order:orders(order_number, buyer_id)')
        .eq('id', returnId)
        .single()

      if (orderData.data?.order) {
        await supabase.from('notifications').insert({
          user_id: orderData.data.order.buyer_id,
          type: 'return_update',
          title: action === 'approved' ? 'Return Request Approved ✅' : 'Return Request Rejected ❌',
          message: `Your return request for order ${orderData.data.order.order_number} has been ${action === 'approved' ? 'approved' : 'rejected'} by the vendor.`,
          data: { return_id: returnId, order_id: orderData.data.order.id },
          is_read: false,
          created_at: new Date().toISOString(),
        })
      }
    }

    return data
  }, { maxRetries: 2, baseDelay: 1000 }),

  // ============================================
  // Admin operations
  // ============================================

  /**
   * Get all return requests (admin) - Optimized: mandatory pagination + selective columns
   */
  getAllReturns: withRetry(async (filters = {}) => {
    // Pagination: REQUIRED for admin view, default 50, max 200
    const limit = Math.min(filters.limit || 50, 200)
    const offset = filters.offset || 0

    let query = supabase
      .from('return_requests')
      .select(`
        id, order_id, product_id, buyer_id, vendor_id,
        reason, status, created_at,
        buyer:profiles!return_requests_buyer_id_fkey(first_name, last_name, email),
        vendor:profiles!return_requests_vendor_id_fkey(first_name, last_name, store_name),
        order:orders(order_number, total),
        product:products(name)
      `, { count: 'exact' })
      .range(offset, offset + limit - 1)

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.vendorId) {
      query = query.eq('vendor_id', filters.vendorId)
    }

    if (filters.buyerId) {
      query = query.eq('buyer_id', filters.buyerId)
    }

    if (filters.search) {
      query = query.or(`order.order_number.ilike.%${filters.search}%,product.name.ilike.%${filters.search}%`)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error, count } = await query
    if (error) throw error
    return { data: data || [], total: count }
  }, { maxRetries: 3, baseDelay: 1000 }),

  /**
   * Admin process a return request (issue refund)
   */
  processReturn: withRetry(async (returnId, action, adminId, notes = '') => {
    if (!['refund_issued', 'escalated', 'closed'].includes(action)) {
      throw new Error('Invalid action')
    }

    const { data, error } = await supabase
      .from('return_requests')
      .update({
        status: action,
        admin_notes: notes,
        processed_by: adminId,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', returnId)
      .select()
      .single()

    if (error) throw error

    // Create audit log entry
    await supabase.from('return_audit_log').insert({
      return_id: returnId,
      action,
      notes,
      performed_by: adminId,
      performed_at: new Date().toISOString(),
    })

    return data
  }, { maxRetries: 2, baseDelay: 1000 }),

  /**
   * Get return request statistics - Optimized: parallel count queries
   */
  getReturnStats: withRetry(async () => {
    // Parallel: all independent count queries run simultaneously
    const [totalResult, pendingResult, approvedResult, refundedResult, reasonResult] = await Promise.all([
      supabase.from('return_requests').select('*', { count: 'exact', head: true }),
      supabase.from('return_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('return_requests').select('*', { count: 'exact', head: true }).eq('status', 'vendor_approved'),
      supabase.from('return_requests').select('*', { count: 'exact', head: true }).eq('status', 'refund_issued'),
      supabase.from('return_requests').select('reason').neq('status', 'cancelled_by_buyer'),
    ])

    const reasonCounts = {}
    ;(reasonResult.data || []).forEach(r => {
      reasonCounts[r.reason] = (reasonCounts[r.reason] || 0) + 1
    })

    return {
      total: totalResult.count || 0,
      pending: pendingResult.count || 0,
      approved: approvedResult.count || 0,
      refunded: refundedResult.count || 0,
      reasonBreakdown: reasonCounts,
    }
  }, { maxRetries: 3, baseDelay: 1000 }),
}

// ============================================
// Real-time subscriptions
// ============================================

/**
 * Subscribe to new return requests for a vendor
 */
export const subscribeToVendorReturns = (vendorId, callback) => {
  return supabase
    .channel(`vendor-returns-${vendorId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'return_requests',
        filter: `vendor_id=eq.${vendorId}`,
      },
      callback
    )
    .subscribe()
}

/**
 * Subscribe to return request updates for a buyer
 */
export const subscribeToBuyerReturns = (buyerId, callback) => {
  return supabase
    .channel(`buyer-returns-${buyerId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'return_requests',
        filter: `buyer_id=eq.${buyerId}`,
      },
      callback
    )
    .subscribe()
}

export default returnsApi
