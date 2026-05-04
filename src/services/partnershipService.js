import { supabase } from '@/services/supabase'
import { notificationsApi } from '@/services/notifications'
import { logger } from '@/utils/logger'

const PROFILE_SELECT = 'id, role, first_name, last_name, store_name, city, phone, avatar_url, vehicle_type, vehicle_plate, rating'

const REQUEST_SELECT = `
  id,
  requester_id,
  requester_role,
  target_id,
  target_role,
  status,
  message,
  responded_at,
  created_at,
  requester:profiles!partnership_requests_requester_id_fkey(${PROFILE_SELECT}),
  target:profiles!partnership_requests_target_id_fkey(${PROFILE_SELECT})
`

const getDisplayName = (profile) => {
  if (!profile) return 'مستخدم'
  return profile.store_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'مستخدم'
}

const getNotificationType = (requesterRole, targetRole) => {
  return requesterRole === 'vendor' && targetRole === 'driver'
    ? 'partnership_request_driver'
    : 'partnership_request_vendor'
}

export const partnershipService = {
  async getIncomingRequests(userId) {
    const { data, error } = await supabase
      .from('partnership_requests')
      .select(REQUEST_SELECT)
      .eq('target_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getOutgoingRequests(userId) {
    const { data, error } = await supabase
      .from('partnership_requests')
      .select(REQUEST_SELECT)
      .eq('requester_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getRequestStatusBetween(requesterId, targetId) {
    const { data, error } = await supabase
      .from('partnership_requests')
      .select('id, status, requester_id, target_id')
      .or(`and(requester_id.eq.${requesterId},target_id.eq.${targetId}),and(requester_id.eq.${targetId},target_id.eq.${requesterId})`)
      .in('status', ['pending', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    return data
  },

  async sendRequest({ requesterId, requesterRole, targetId, targetRole, message = '' }) {
    if (!requesterId || !targetId || requesterId === targetId) {
      throw new Error('بيانات طلب الشراكة غير صالحة')
    }

    const existing = await this.getRequestStatusBetween(requesterId, targetId)
    if (existing?.status === 'pending') {
      return {
        success: true,
        requestId: existing.id,
        alreadyPending: true,
        reversePending: existing.requester_id === targetId,
      }
    }

    if (existing?.status === 'accepted') {
      return {
        success: true,
        requestId: existing.id,
        alreadyAccepted: true,
      }
    }

    const { data: request, error } = await supabase
      .from('partnership_requests')
      .insert({
        requester_id: requesterId,
        requester_role: requesterRole,
        target_id: targetId,
        target_role: targetRole,
        status: 'pending',
        message: message.trim() || null,
      })
      .select(REQUEST_SELECT)
      .single()

    if (error) throw error

    try {
      await notificationsApi.create({
        user_id: targetId,
        type: getNotificationType(requesterRole, targetRole),
        title: 'طلب شراكة جديد',
        message: requesterRole === 'vendor'
          ? 'لديك طلب شراكة جديد من بائع. افتح الطلبات الواردة للاطلاع عليه.'
          : 'لديك إشعار توفّر جديد من سائق. افتح الطلبات الواردة للاطلاع عليه.',
        data: {
          request_id: request.id,
          requester_id: requesterId,
          requester_role: requesterRole,
        },
      })
    } catch (notificationError) {
      logger.warn('Failed to create partnership notification:', notificationError)
    }

    return { success: true, request }
  },

  async cancelRequest(requestId, requesterId) {
    const { data, error } = await supabase
      .from('partnership_requests')
      .update({
        status: 'cancelled',
        responded_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('requester_id', requesterId)
      .eq('status', 'pending')
      .select(REQUEST_SELECT)
      .single()

    if (error) throw error
    return data
  },

  async respondToRequest(requestId, actorId, status) {
    if (!['accepted', 'rejected'].includes(status)) {
      throw new Error('حالة الطلب غير مدعومة')
    }

    const { data: request, error: requestError } = await supabase
      .from('partnership_requests')
      .update({
        status,
        responded_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('target_id', actorId)
      .eq('status', 'pending')
      .select(REQUEST_SELECT)
      .single()

    if (requestError) throw requestError

    if (status === 'accepted') {
      await this.linkProfilesAfterAcceptance(request)
    }

    try {
      await notificationsApi.create({
        user_id: request.requester_id,
        type: 'partnership_request_response',
        title: status === 'accepted' ? 'تم قبول طلب الشراكة' : 'تم رفض طلب الشراكة',
        message: status === 'accepted'
          ? '🎉 تمت الموافقة على طلب شراكتك!'
          : `تم رفض طلب الشراكة من ${getDisplayName(request.target)}.`,
        data: {
          request_id: request.id,
          status,
        },
      })
    } catch (notificationError) {
      logger.warn('Failed to create partnership response notification:', notificationError)
    }

    return request
  },

  async linkProfilesAfterAcceptance(request) {
    const vendorId = request.requester_role === 'vendor' ? request.requester_id : request.target_id
    const driverId = request.requester_role === 'driver' ? request.requester_id : request.target_id

    const { error: vendorError } = await supabase
      .from('profiles')
      .update({
        preferred_driver_id: driverId,
        has_own_driver: true,
        driver_search_done: true,
        partnership_status: 'accepted',
        preferred_driver_linked_at: new Date().toISOString(),
      })
      .eq('id', vendorId)

    if (vendorError) throw vendorError

    const { error: driverError } = await supabase
      .from('profiles')
      .update({
        preferred_vendor_id: vendorId,
        has_preferred_vendor: true,
        vendor_search_done: true,
        partnership_status: 'accepted',
        preferred_vendor_linked_at: new Date().toISOString(),
      })
      .eq('id', driverId)

    if (driverError) throw driverError
  },

  async getDriverSearchResults({ city = '', vehicleType = '', minRating = 0, availableOnly = false }) {
    let query = supabase
      .from('profiles')
      .select(`
        id,
        role,
        first_name,
        last_name,
        city,
        avatar_url,
        vehicle_type,
        vehicle_plate,
        rating,
        is_available_for_delivery,
        is_active
      `)
      .eq('role', 'driver')

    if (city) {
      query = query.ilike('city', `%${city.trim()}%`)
    }
    if (vehicleType) {
      query = query.eq('vehicle_type', vehicleType)
    }
    if (minRating > 0) {
      query = query.gte('rating', minRating)
    }
    if (availableOnly) {
      query = query.eq('is_available_for_delivery', true)
    }

    const { data: drivers, error } = await query.order('rating', { ascending: false })
    if (error) throw error

    const driverIds = (drivers || []).map((driver) => driver.id)
    const completedCounts = new Map()

    if (driverIds.length > 0) {
      const { data: deliveries, error: deliveriesError } = await supabase
        .from('deliveries')
        .select('driver_id, status')
        .in('driver_id', driverIds)
        .eq('status', 'delivered')

      if (deliveriesError) throw deliveriesError

      for (const delivery of deliveries || []) {
        completedCounts.set(delivery.driver_id, (completedCounts.get(delivery.driver_id) || 0) + 1)
      }
    }

    return (drivers || []).map((driver) => ({
      ...driver,
      completed_deliveries: completedCounts.get(driver.id) || 0,
    }))
  },

  async getVendorSearchResults({ city = '', category = '', minRating = 0, lookingForDriverOnly = true }) {
    let query = supabase
      .from('profiles')
      .select(`
        id,
        role,
        first_name,
        last_name,
        store_name,
        city,
        avatar_url,
        rating,
        has_own_driver,
        is_active
      `)
      .eq('role', 'vendor')

    if (city) {
      query = query.ilike('city', `%${city.trim()}%`)
    }
    if (minRating > 0) {
      query = query.gte('rating', minRating)
    }
    if (lookingForDriverOnly) {
      query = query.eq('has_own_driver', false)
    }

    const { data: vendors, error } = await query.order('rating', { ascending: false })
    if (error) throw error

    const vendorIds = (vendors || []).map((vendor) => vendor.id)
    const categoryMap = new Map()
    const weeklyOrderMap = new Map()

    if (vendorIds.length > 0) {
      const [{ data: products, error: productsError }, { data: orders, error: ordersError }] = await Promise.all([
        supabase
          .from('products')
          .select('vendor_id, category')
          .in('vendor_id', vendorIds),
        supabase
          .from('orders')
          .select('vendor_id, created_at')
          .in('vendor_id', vendorIds)
          .gte('created_at', new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString()),
      ])

      if (productsError) throw productsError
      if (ordersError) throw ordersError

      for (const product of products || []) {
        if (!categoryMap.has(product.vendor_id)) {
          categoryMap.set(product.vendor_id, new Set())
        }
        categoryMap.get(product.vendor_id).add(product.category)
      }

      for (const order of orders || []) {
        weeklyOrderMap.set(order.vendor_id, (weeklyOrderMap.get(order.vendor_id) || 0) + 1)
      }
    }

    return (vendors || [])
      .map((vendor) => ({
        ...vendor,
        product_categories: Array.from(categoryMap.get(vendor.id) || []),
        weekly_orders: weeklyOrderMap.get(vendor.id) || 0,
      }))
      .filter((vendor) => {
        if (!category) return true
        return vendor.product_categories.includes(category)
      })
  },
}

export default partnershipService