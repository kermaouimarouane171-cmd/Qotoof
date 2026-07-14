import { supabase } from '@/services/supabase'
import { withRetry } from '@/utils/withRetry'

const toAmount = (value) => Number(Number(value || 0).toFixed(2))

export const normalizeCoupon = (coupon = {}) => ({
  ...coupon,
  applies_to: coupon.applies_to || 'order',
  minimum_quantity: Number(coupon.minimum_quantity || 0),
  min_order_amount: Number(coupon.min_order_amount || 0),
  max_uses_per_user: coupon.max_uses_per_user == null ? null : Number(coupon.max_uses_per_user),
  starts_at: coupon.starts_at || coupon.created_at || null,
  metadata: coupon.metadata || {},
})

const isAssignedToUser = (coupon, userId = null) => {
  const assignedUserId = normalizeCoupon(coupon).metadata?.assigned_user_id || null
  return !assignedUserId || assignedUserId === userId
}

export const isCouponCurrentlyActive = (coupon, now = new Date()) => {
  const normalized = normalizeCoupon(coupon)
  const currentDate = new Date(now)

  if (normalized.is_active === false) return false
  if (normalized.starts_at && new Date(normalized.starts_at) > currentDate) return false
  if (normalized.expires_at && new Date(normalized.expires_at) < currentDate) return false

  return true
}

export const calculateCouponDiscountAmount = ({ coupon, subtotal }) => {
  const normalized = normalizeCoupon(coupon)
  const orderSubtotal = Number(subtotal || 0)

  if (!normalized || orderSubtotal <= 0) return 0
  if (!isCouponCurrentlyActive(normalized)) return 0
  if (normalized.min_order_amount && orderSubtotal < normalized.min_order_amount) return 0

  if (normalized.discount_type === 'percentage') {
    return toAmount(orderSubtotal * (Number(normalized.discount_value || 0) / 100))
  }

  return toAmount(Math.min(Number(normalized.discount_value || 0), orderSubtotal))
}

export const calculateBulkDiscountBreakdown = ({ coupons = [], items = [], now = new Date() }) => {
  const vendorBuckets = items.reduce((accumulator, item) => {
    if (!item.vendor_id) return accumulator
    if (!accumulator[item.vendor_id]) {
      accumulator[item.vendor_id] = {
        subtotal: 0,
        quantity: 0,
      }
    }

    accumulator[item.vendor_id].subtotal += Number(item.price_per_unit || item.price || 0) * Number(item.quantity || 0)
    accumulator[item.vendor_id].quantity += Number(item.quantity || 0)
    return accumulator
  }, {})

  const offersByVendor = {}
  let totalDiscount = 0

  Object.entries(vendorBuckets).forEach(([vendorId, bucket]) => {
    const eligibleOffers = coupons
      .map(normalizeCoupon)
      .filter((coupon) => coupon.vendor_id === vendorId)
      .filter((coupon) => coupon.applies_to === 'bulk')
      .filter((coupon) => isCouponCurrentlyActive(coupon, now))
      .filter((coupon) => !coupon.minimum_quantity || bucket.quantity >= coupon.minimum_quantity)
      .filter((coupon) => !coupon.min_order_amount || bucket.subtotal >= coupon.min_order_amount)
      .map((coupon) => ({
        coupon,
        discountAmount: calculateCouponDiscountAmount({
          coupon,
          subtotal: bucket.subtotal,
        }),
      }))
      .filter((entry) => entry.discountAmount > 0)
      .sort((left, right) => right.discountAmount - left.discountAmount)

    const bestOffer = eligibleOffers[0]
    if (!bestOffer) return

    offersByVendor[vendorId] = {
      coupon: bestOffer.coupon,
      discountAmount: bestOffer.discountAmount,
      subtotal: toAmount(bucket.subtotal),
      quantity: bucket.quantity,
    }
    totalDiscount += bestOffer.discountAmount
  })

  return {
    totalDiscount: toAmount(totalDiscount),
    offersByVendor,
  }
}

/**
 * Coupons API Service
 * Handles coupon fetching, redemption, and management for buyers and vendors
 */
export const couponsApi = {
  // ============================================
  // Buyer-facing operations
  // ============================================

  /**
   * Get all active coupons available to a buyer
   * Optimized: Single aggregated query instead of N+1 per-coupon queries
   */
  getAvailableCoupons: withRetry(async (userId = null, filters = {}) => {
    // Pagination: default 50, max 200
    const limit = Math.min(filters.limit || 50, 200)
    const offset = filters.offset || 0

    let query = supabase
      .from('coupons')
      .select(`
        id, code, title, description, discount_type, discount_value,
        min_order_amount, minimum_quantity, applies_to, max_uses, max_uses_per_user, expires_at, starts_at, metadata,
        is_active, created_at, vendor_id,
        vendor:profiles!coupons_vendor_id_fkey(id, store_name, avatar_url)
      `, { count: 'exact' })
      .eq('is_active', true)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false })

    const { data, error, count } = await query
    if (error) throw error
    if (!data || data.length === 0) return { data: [], total: 0 }

    // If userId provided, fetch usage data in 2 aggregated queries (not 2N)
    let usageMap = {}
    if (userId) {
      const [totalResult, userResult] = await Promise.all([
        supabase
          .from('coupon_redemptions')
          .select('coupon_id')
          .in('coupon_id', data.map(c => c.id)),
        supabase
          .from('coupon_redemptions')
          .select('coupon_id')
          .in('coupon_id', data.map(c => c.id))
          .eq('user_id', userId),
      ])

      // Count total uses per coupon
      const totalCounts = {}
      ;(totalResult.data || []).forEach(r => {
        totalCounts[r.coupon_id] = (totalCounts[r.coupon_id] || 0) + 1
      })

      // Count user uses per coupon
      const userCounts = {}
      ;(userResult.data || []).forEach(r => {
        userCounts[r.coupon_id] = (userCounts[r.coupon_id] || 0) + 1
      })

      usageMap = { totalCounts, userCounts }
    }

    // Enrich coupons with usage data client-side
    const enrichedData = data.map((coupon) => {
      const totalUsage = usageMap.totalCounts?.[coupon.id] || 0
      const userUsage = usageMap.userCounts?.[coupon.id] || 0

      return {
        ...normalizeCoupon(coupon),
        user_usage: userUsage,
        total_usage: totalUsage,
        is_expired: coupon.expires_at ? new Date(coupon.expires_at) < new Date() : false,
        is_used_up: coupon.max_uses ? totalUsage >= coupon.max_uses : false,
        is_assigned_to_current_user: isAssignedToUser(coupon, userId),
        can_redeem: coupon.applies_to !== 'bulk' &&
                    isAssignedToUser(coupon, userId) &&
                    !(coupon.starts_at && new Date(coupon.starts_at) > new Date()) &&
                    !(coupon.expires_at && new Date(coupon.expires_at) < new Date()) &&
                    !(coupon.max_uses && totalUsage >= coupon.max_uses) &&
                    !(coupon.max_uses_per_user && userUsage >= coupon.max_uses_per_user),
      }
    }).filter((coupon) => coupon.is_assigned_to_current_user)

    return { data: enrichedData, total: count }
  }, { maxRetries: 3, baseDelay: 1000 }),

  /**
   * Validate a coupon code without redeeming it
   * Optimized: Parallel count queries
   */
  validateCoupon: withRetry(async (couponCode, userId, orderAmount = null) => {
    // Fetch coupon
    const { data: coupon, error: fetchError } = await supabase
      .from('coupons')
      .select('id, code, discount_type, discount_value, min_order_amount, minimum_quantity, applies_to, max_uses, max_uses_per_user, expires_at, starts_at, is_active, vendor_id, metadata')
      .eq('code', couponCode.toUpperCase())
      .eq('is_active', true)
      .single()

    if (fetchError || !coupon) {
      return { valid: false, error: 'الكوبون غير موجود أو غير صالح' }
    }

    if (!isAssignedToUser(coupon, userId)) {
      return { valid: false, error: 'هذا الكوبون مرتبط بحساب آخر' }
    }

    if (coupon.applies_to === 'bulk') {
      return { valid: false, error: 'هذا العرض يطبق تلقائياً على الكميات ولا يحتاج إلى إدخال يدوي.' }
    }

    if (coupon.starts_at && new Date(coupon.starts_at) > new Date()) {
      return { valid: false, error: 'هذا الكوبون لم يبدأ بعد' }
    }

    // Check expired
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return { valid: false, error: 'انتهت صلاحية هذا الكوبون' }
    }

    // Parallel: count total uses and user uses simultaneously
    const [totalResult, userResult] = await Promise.all([
      supabase
        .from('coupon_redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id),
      userId ? supabase
        .from('coupon_redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id)
        .eq('user_id', userId)
      : Promise.resolve({ count: 0 }),
    ])

    const totalCount = totalResult.count || 0
    const userUsage = userResult.count || 0

    if (coupon.max_uses && totalCount >= coupon.max_uses) {
      return { valid: false, error: 'تم استنفاد هذا الكوبون' }
    }

    if (userId && coupon.max_uses_per_user && userUsage >= coupon.max_uses_per_user) {
      return { valid: false, error: 'تم الوصول إلى الحد الأقصى لاستخدام هذا الكوبون' }
    }

    if (coupon.min_order_amount && orderAmount && orderAmount < coupon.min_order_amount) {
      return {
        valid: false,
        error: `الحد الأدنى للطلب هو ${Number(coupon.min_order_amount || 0).toFixed(2)} درهم`,
      }
    }

    return { valid: true, coupon: normalizeCoupon(coupon) }
  }, { maxRetries: 2, baseDelay: 500 }),

  /**
   * Redeem a coupon for a user
   * Validates all rules before redemption
   */
  redeemCoupon: withRetry(async (couponCode, userId, orderId, orderAmount = null) => {
    // Validate first
    const validation = await couponsApi.validateCoupon(couponCode, userId, orderAmount)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    const coupon = validation.coupon

    // Create redemption record
    const { data, error } = await supabase
      .from('coupon_redemptions')
      .insert({
        coupon_id: coupon.id,
        user_id: userId,
        order_id: orderId,
        redeemed_at: new Date().toISOString(),
        discount_amount: coupon.discount_type === 'fixed'
          ? coupon.discount_value
          : null,
        discount_percentage: coupon.discount_type === 'percentage'
          ? coupon.discount_value
          : null,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }, { maxRetries: 2, baseDelay: 1000 }),

  /**
   * Get user's redeemed coupons with usage history
   */
  getUserRedemptions: withRetry(async (userId) => {
    const { data, error } = await supabase
      .from('coupon_redemptions')
      .select(`
        *,
        coupon:coupons(
          *,
          vendor:profiles!coupons_vendor_id_fkey(store_name)
        )
      `)
      .eq('user_id', userId)
      .order('redeemed_at', { ascending: false })

    if (error) throw error
    return data || []
  }, { maxRetries: 3, baseDelay: 1000 }),

  // ============================================
  // Vendor-facing operations
  // ============================================

  /**
   * Get vendor's coupons
   */
  getVendorCoupons: withRetry(async (vendorId) => {
    const { data, error } = await supabase
      .from('coupons')
      .select(`
        *,
        redemptions:coupon_redemptions(count)
      `)
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data || []).map(normalizeCoupon)
  }, { maxRetries: 3, baseDelay: 1000 }),

  getBulkDiscountCandidates: withRetry(async (vendorIds = []) => {
    if (!vendorIds.length) return []

    const { data, error } = await supabase
      .from('coupons')
      .select('id, code, title, description, vendor_id, discount_type, discount_value, min_order_amount, minimum_quantity, applies_to, starts_at, expires_at, is_active, metadata')
      .in('vendor_id', vendorIds)
      .eq('applies_to', 'bulk')
      .eq('is_active', true)

    if (error) throw error
    return (data || []).map(normalizeCoupon)
  }, { maxRetries: 2, baseDelay: 1000 }),

  /**
   * Create a new coupon (vendor only)
   */
  createCoupon: withRetry(async (coupon) => {
    // Validate required fields
    if (!coupon.vendor_id) throw new Error('Vendor ID is required')
    if (!coupon.code) throw new Error('Coupon code is required')
    if (!coupon.discount_type || !['percentage', 'fixed'].includes(coupon.discount_type)) {
      throw new Error('Discount type must be "percentage" or "fixed"')
    }
    if (!coupon.discount_value || coupon.discount_value <= 0) {
      throw new Error('Discount value must be greater than 0')
    }
    if (coupon.discount_type === 'percentage' && coupon.discount_value > 100) {
      throw new Error('Percentage discount cannot exceed 100')
    }

    // Uppercase the code
    const couponData = {
      ...coupon,
      code: (coupon.code || '').toUpperCase(),
      applies_to: coupon.applies_to || 'order',
      minimum_quantity: coupon.minimum_quantity ? Number(coupon.minimum_quantity) : null,
      starts_at: coupon.starts_at || null,
      metadata: coupon.metadata || {},
      is_active: coupon.is_active !== undefined ? coupon.is_active : true,
      created_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('coupons')
      .insert(couponData)
      .select()
      .single()

    if (error) throw error
    return data
  }, { maxRetries: 2, baseDelay: 1000 }),

  /**
   * Update a coupon
   */
  updateCoupon: withRetry(async (couponId, updates) => {
    // Don't allow updating vendor_id
    // eslint-disable-next-line no-unused-vars
    const { vendor_id, ...safeUpdates } = updates

    // Uppercase code if provided
    if (safeUpdates.code) {
      safeUpdates.code = safeUpdates.code.toUpperCase()
    }

    const { data, error } = await supabase
      .from('coupons')
      .update({
        ...safeUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', couponId)
      .select()
      .single()

    if (error) throw error
    return data
  }, { maxRetries: 2, baseDelay: 1000 }),

  /**
   * Deactivate a coupon (soft delete)
   */
  deactivateCoupon: withRetry(async (couponId) => {
    const { data, error } = await supabase
      .from('coupons')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', couponId)
      .select()
      .single()

    if (error) throw error
    return data
  }, { maxRetries: 2, baseDelay: 1000 }),

  /**
   * Get coupon usage stats - Optimized: parallel queries
   */
  getCouponStats: withRetry(async (couponId) => {
    // Parallel: total count + recent redemptions
    const [totalResult, recentResult] = await Promise.all([
      supabase
        .from('coupon_redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', couponId),
      supabase
        .from('coupon_redemptions')
        .select('id, redeemed_at, discount_amount, discount_percentage, user:profiles!coupon_redemptions_user_id_fkey(first_name, last_name)')
        .eq('coupon_id', couponId)
        .order('redeemed_at', { ascending: false })
        .limit(10),
    ])

    // Calculate total discount given
    const { data: redemptionAmounts } = await supabase
      .from('coupon_redemptions')
      .select('discount_amount')
      .eq('coupon_id', couponId)

    const totalDiscount = (redemptionAmounts || []).reduce((sum, r) => {
      if (r.discount_amount) return sum + r.discount_amount
      return sum
    }, 0)

    return {
      totalRedemptions: totalResult.count || 0,
      recentRedemptions: recentResult.data || [],
      totalDiscount,
    }
  }, { maxRetries: 3, baseDelay: 1000 }),

  // ============================================
  // Admin-facing operations
  // ============================================

  /**
   * Get all coupons across all vendors (admin) - Optimized: pagination + selective columns
   */
  getAllCoupons: withRetry(async (filters = {}) => {
    // Pagination: default 50, max 200
    const limit = Math.min(filters.limit || 50, 200)
    const offset = filters.offset || 0

    let query = supabase
      .from('coupons')
      .select(`
        id, code, title, description, discount_type, discount_value,
        min_order_amount, max_uses, max_uses_per_user, expires_at,
        is_active, created_at, vendor_id,
        vendor:profiles!coupons_vendor_id_fkey(id, first_name, last_name, store_name, email)
      `, { count: 'exact' })
      .range(offset, offset + limit - 1)

    if (filters.vendorId) {
      query = query.eq('vendor_id', filters.vendorId)
    }

    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive)
    }

    if (filters.search) {
      query = query.ilike('code', `%${filters.search}%`)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error, count } = await query
    if (error) throw error
    return { data: data || [], total: count }
  }, { maxRetries: 3, baseDelay: 1000 }),
}

// ============================================
// Real-time subscriptions
// ============================================

/**
 * Subscribe to coupon redemption events for a vendor
 */
export const subscribeToVendorCouponRedemptions = (vendorId, callback) => {
  return supabase
    .channel(`vendor-coupon-redemptions-${vendorId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'coupon_redemptions',
        filter: `coupon.vendor_id=eq.${vendorId}`,
      },
      callback
    )
    .subscribe()
}

export default couponsApi
