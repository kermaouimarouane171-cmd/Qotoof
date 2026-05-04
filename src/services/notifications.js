import { supabase } from './supabase'
import { withRetry } from '@/utils/withRetry'

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  in_app_enabled: true,
  email_enabled: true,
  sms_enabled: false,
  order_updates: true,
  payment_updates: true,
  promotional_updates: true,
  review_updates: true,
  loyalty_updates: true,
  inventory_alerts: true,
  delivery_updates: true,
  system_updates: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
}

export const NOTIFICATION_CATEGORY_OPTIONS = [
  { id: 'order_update', label: 'الطلبات' },
  { id: 'payment', label: 'المدفوعات' },
  { id: 'delivery', label: 'التوصيل' },
  { id: 'review', label: 'التقييمات' },
  { id: 'loyalty', label: 'الولاء' },
  { id: 'promotion', label: 'العروض' },
  { id: 'inventory', label: 'المخزون' },
  { id: 'message', label: 'الرسائل' },
  { id: 'system', label: 'النظام' },
]

export const NOTIFICATION_PREFERENCE_FIELDS = [
  { key: 'order_updates', label: 'تحديثات الطلبات' },
  { key: 'payment_updates', label: 'تحديثات الدفع والعمولات' },
  { key: 'delivery_updates', label: 'تحديثات التوصيل' },
  { key: 'review_updates', label: 'التقييمات الجديدة' },
  { key: 'loyalty_updates', label: 'الولاء والإحالات' },
  { key: 'promotional_updates', label: 'العروض والكوبونات' },
  { key: 'inventory_alerts', label: 'تنبيهات المخزون والتوفر' },
  { key: 'system_updates', label: 'إشعارات النظام والرسائل العامة' },
]

const NOTIFICATION_CATEGORY_ALIASES = {
  order: 'order_update',
  order_update: 'order_update',
  order_updates: 'order_update',
  order_status: 'order_update',
  new_order: 'order_update',
  payment: 'payment',
  payment_updates: 'payment',
  payment_update: 'payment',
  commission: 'payment',
  bank_transfer: 'payment',
  promotion: 'promotion',
  promotions: 'promotion',
  promotional: 'promotion',
  promotional_updates: 'promotion',
  product: 'promotion',
  review: 'review',
  reviews: 'review',
  review_update: 'review',
  review_updates: 'review',
  loyalty: 'loyalty',
  loyalty_update: 'loyalty',
  loyalty_updates: 'loyalty',
  referral: 'loyalty',
  referrals: 'loyalty',
  inventory: 'inventory',
  inventory_alert: 'inventory',
  inventory_alerts: 'inventory',
  stock: 'inventory',
  low_stock: 'inventory',
  delivery: 'delivery',
  delivery_update: 'delivery',
  delivery_updates: 'delivery',
  delivery_assignment: 'delivery',
  driver_verification: 'delivery',
  message: 'message',
  messages: 'message',
  chat: 'message',
  general: 'system',
  system: 'system',
  support: 'system',
  partnership_request: 'system',
  partnership_request_response: 'system',
}

const NOTIFICATION_PREFERENCE_BY_CATEGORY = {
  order_update: 'order_updates',
  payment: 'payment_updates',
  promotion: 'promotional_updates',
  review: 'review_updates',
  loyalty: 'loyalty_updates',
  inventory: 'inventory_alerts',
  delivery: 'delivery_updates',
  message: 'system_updates',
  system: 'system_updates',
}

const NOTIFICATION_BADGE_EVENT = 'notification-badge-update'
const NOTIFICATION_PREFERENCES_EVENT = 'notification-preferences-updated'

const resolveListOptions = (limitOrOptions, maybeOptions = {}) => {
  if (typeof limitOrOptions === 'number' || typeof limitOrOptions === 'undefined') {
    return {
      limit: typeof limitOrOptions === 'number' ? limitOrOptions : 50,
      ...maybeOptions,
    }
  }

  return {
    limit: 50,
    ...(limitOrOptions || {}),
  }
}

const sanitizeTimeValue = (value) => {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 5) : null
}

const toMinutes = (value) => {
  if (!value || typeof value !== 'string' || !value.includes(':')) return null
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return (hours * 60) + minutes
}

export const normalizeNotificationCategory = (category, type = null) => {
  const rawValue = String(category || type || 'system').trim().toLowerCase()
  return NOTIFICATION_CATEGORY_ALIASES[rawValue] || 'system'
}

export const getNotificationPreferenceKey = (category, type = null) => {
  const normalizedCategory = normalizeNotificationCategory(category, type)
  return NOTIFICATION_PREFERENCE_BY_CATEGORY[normalizedCategory] || 'system_updates'
}

export const normalizeNotificationPreferences = (preferences = {}) => ({
  ...DEFAULT_NOTIFICATION_PREFERENCES,
  ...preferences,
  quiet_hours_start: sanitizeTimeValue(preferences?.quiet_hours_start),
  quiet_hours_end: sanitizeTimeValue(preferences?.quiet_hours_end),
})

export const isNotificationRead = (notification = {}) => Boolean(notification?.read_at || notification?.is_read)

export const resolveNotificationLink = (notification = {}) => {
  if (notification?.action_url) return notification.action_url
  if (notification?.link) return notification.link
  if (notification?.data?.action_url) return notification.data.action_url

  const orderId = notification?.data?.order_id || notification?.order_id
  if (orderId) return `/orders/${orderId}`

  const conversationId = notification?.data?.conversation_id || notification?.conversation_id
  if (conversationId) return `/messages?conversation=${conversationId}`

  if (normalizeNotificationCategory(notification?.category, notification?.type) === 'review') {
    return '/vendor/reviews'
  }

  if (notification?.type === 'driver_verification') {
    return '/admin/verification'
  }

  return null
}

export const resolveNotificationActionLabel = (notification = {}) => {
  if (notification?.action_label) return notification.action_label

  const link = resolveNotificationLink(notification)
  if (!link) return null

  if (link.startsWith('/orders/')) return 'عرض الطلب'
  if (link.startsWith('/messages')) return 'فتح المحادثة'
  if (link.startsWith('/vendor/reviews')) return 'عرض التقييمات'

  return 'فتح'
}

export const normalizeNotification = (notification = {}) => {
  const normalizedCategory = normalizeNotificationCategory(notification.category, notification.type)
  const isRead = isNotificationRead(notification)

  return {
    ...notification,
    category: normalizedCategory,
    channel: notification.channel || 'in_app',
    priority: notification.priority || 'normal',
    data: notification.data || {},
    is_read: isRead,
    read_at: isRead ? notification.read_at || notification.created_at || new Date().toISOString() : null,
    action_url: resolveNotificationLink(notification),
    action_label: resolveNotificationActionLabel(notification),
  }
}

export const isWithinQuietHours = (preferences = {}, value = new Date()) => {
  const normalizedPreferences = normalizeNotificationPreferences(preferences)
  const startMinutes = toMinutes(normalizedPreferences.quiet_hours_start)
  const endMinutes = toMinutes(normalizedPreferences.quiet_hours_end)

  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
    return false
  }

  const currentValue = value instanceof Date ? value : new Date(value)
  const currentMinutes = (currentValue.getHours() * 60) + currentValue.getMinutes()

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }

  return currentMinutes >= startMinutes || currentMinutes < endMinutes
}

export const shouldMuteNotificationPreview = (preferences = {}, notification = {}, value = new Date()) => {
  const normalizedPreferences = normalizeNotificationPreferences(preferences)
  if (!normalizedPreferences.in_app_enabled) {
    return true
  }

  const preferenceKey = getNotificationPreferenceKey(notification.category, notification.type)
  if (normalizedPreferences[preferenceKey] === false) {
    return true
  }

  return isWithinQuietHours(normalizedPreferences, value)
}

const buildNotificationInsertPayload = (notification = {}) => {
  const normalized = normalizeNotification(notification)

  return {
    user_id: normalized.user_id,
    title: normalized.title,
    message: normalized.message,
    type: normalized.type || 'system',
    category: normalized.category,
    channel: normalized.channel,
    priority: normalized.priority,
    action_url: normalized.action_url,
    action_label: normalized.action_label,
    data: normalized.data,
    is_read: normalized.is_read,
    read_at: normalized.read_at,
    deleted_at: normalized.deleted_at || null,
  }
}

export const dispatchNotificationBadgeUpdate = (unreadCount) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(NOTIFICATION_BADGE_EVENT, {
    detail: { unreadCount },
  }))
}

export const dispatchNotificationPreferencesUpdated = (preferences) => {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(NOTIFICATION_PREFERENCES_EVENT, {
    detail: { preferences: normalizeNotificationPreferences(preferences) },
  }))
}

export const notificationsApi = {
  getUserNotifications: withRetry(async (userId, limitOrOptions = 50, maybeOptions = {}) => {
    const options = resolveListOptions(limitOrOptions, maybeOptions)
    const {
      limit = 50,
      offset = 0,
      category = null,
      unreadOnly = false,
      readOnly = false,
    } = options

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (category) {
      query = query.eq('category', normalizeNotificationCategory(category, null))
    }

    if (unreadOnly) {
      query = query.is('read_at', null)
    }

    if (readOnly) {
      query = query.not('read_at', 'is', null)
    }

    const { data, error, count } = await query
    if (error) throw error

    const normalized = (data || []).map(normalizeNotification)
    if (typeof limitOrOptions === 'number' || typeof limitOrOptions === 'undefined') {
      return normalized
    }

    return {
      data: normalized,
      count: count || 0,
    }
  }, { maxRetries: 3, baseDelay: 1000 }),

  getUnreadCount: withRetry(async (userId) => {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .is('read_at', null)
      .range(0, 0)

    if (error) throw error
    return count || 0
  }, { maxRetries: 3, baseDelay: 1000 }),

  markAsRead: withRetry(async (notificationId) => {
    const timestamp = new Date().toISOString()
    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: timestamp })
      .eq('id', notificationId)
      .select()
      .maybeSingle()

    if (error) throw error
    return data ? normalizeNotification(data) : null
  }, { maxRetries: 2, baseDelay: 500 }),

  markAllAsRead: withRetry(async (userId, options = {}) => {
    const timestamp = new Date().toISOString()
    let query = supabase
      .from('notifications')
      .update({ is_read: true, read_at: timestamp })
      .eq('user_id', userId)
      .is('read_at', null)

    if (options.category) {
      query = query.eq('category', normalizeNotificationCategory(options.category, null))
    }

    const { error } = await query
    if (error) throw error
  }, { maxRetries: 2, baseDelay: 500 }),

  delete: withRetry(async (notificationId) => {
    const { data, error } = await supabase
      .from('notifications')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select()
      .maybeSingle()

    if (error) throw error
    return data ? normalizeNotification(data) : null
  }, { maxRetries: 1, baseDelay: 500 }),

  deleteAllRead: withRetry(async (userId) => {
    const { error } = await supabase
      .from('notifications')
      .update({ deleted_at: new Date().toISOString() })
      .eq('user_id', userId)
      .not('read_at', 'is', null)

    if (error) throw error
  }, { maxRetries: 1, baseDelay: 500 }),

  getPreferences: withRetry(async (userId) => {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) throw error

    if (data) {
      return normalizeNotificationPreferences(data)
    }

    const { data: inserted, error: insertError } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: userId }, { onConflict: 'user_id' })
      .select()
      .single()

    if (insertError) throw insertError
    return normalizeNotificationPreferences(inserted)
  }, { maxRetries: 2, baseDelay: 500 }),

  savePreferences: withRetry(async ({ userId, preferences }) => {
    const normalizedPreferences = normalizeNotificationPreferences(preferences)
    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: userId, ...normalizedPreferences }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error

    const normalized = normalizeNotificationPreferences(data)
    dispatchNotificationPreferencesUpdated(normalized)
    return normalized
  }, { maxRetries: 2, baseDelay: 500 }),

  create: withRetry(async (notification) => {
    const payload = buildNotificationInsertPayload(notification)
    const { data, error } = await supabase.rpc('create_user_notification', {
      p_user_id: payload.user_id,
      p_title: payload.title,
      p_message: payload.message,
      p_type: payload.type,
      p_category: payload.category,
      p_data: payload.data,
      p_channel: payload.channel,
      p_priority: payload.priority,
      p_action_url: payload.action_url,
      p_action_label: payload.action_label,
    })

    if (!error) {
      if (!data) return null
      return normalizeNotification({
        ...payload,
        id: data,
        created_at: new Date().toISOString(),
      })
    }

    const { data: inserted, error: insertError } = await supabase
      .from('notifications')
      .insert(payload)
      .select()
      .maybeSingle()

    if (insertError) throw insertError
    return inserted ? normalizeNotification(inserted) : null
  }, { maxRetries: 2, baseDelay: 1000 }),

  subscribe: (userId, callback) => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback({
            eventType: payload.eventType,
            new: payload.new ? normalizeNotification(payload.new) : null,
            old: payload.old ? normalizeNotification(payload.old) : null,
            raw: payload,
          })
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  },
}

export const createOrderNotification = withRetry(async (order, oldStatus, newStatus) => {
  const notifications = []

  const templates = {
    vendor_accepted: {
      buyer: {
        title: 'Order Accepted ✅',
        message: `Your order ${order.order_number} has been accepted by the vendor`,
        type: 'order',
        category: 'order_update',
      },
    },
    vendor_rejected: {
      buyer: {
        title: 'Order Rejected ❌',
        message: `Your order ${order.order_number} has been rejected by the vendor`,
        type: 'order',
        category: 'order_update',
      },
    },
    driver_assigned: {
      buyer: {
        title: 'Driver Assigned 🚚',
        message: `A driver has been assigned to your order ${order.order_number}`,
        type: 'delivery_assignment',
        category: 'delivery',
      },
    },
    driver_accepted: {
      buyer: {
        title: 'Driver Accepted Delivery',
        message: `The driver has accepted delivery for order ${order.order_number}`,
        type: 'delivery',
        category: 'delivery',
      },
      vendor: {
        title: 'Driver Accepted',
        message: `Driver has accepted delivery for order ${order.order_number}`,
        type: 'delivery',
        category: 'delivery',
      },
    },
    driver_picked_up: {
      buyer: {
        title: 'Order Picked Up 📦',
        message: `Your order ${order.order_number} has been picked up by the driver`,
        type: 'delivery',
        category: 'delivery',
      },
      vendor: {
        title: 'Driver Picked Up',
        message: `Driver has picked up the order ${order.order_number}`,
        type: 'delivery',
        category: 'delivery',
      },
    },
    on_the_way: {
      buyer: {
        title: 'On The Way! 🚚💨',
        message: `Your order ${order.order_number} is on the way to you`,
        type: 'delivery',
        category: 'delivery',
      },
    },
    delivered: {
      buyer: {
        title: 'Order Delivered! 🎉',
        message: `Your order ${order.order_number} has been delivered successfully`,
        type: 'order',
        category: 'order_update',
      },
      vendor: {
        title: 'Order Delivered',
        message: `Order ${order.order_number} has been delivered to the buyer`,
        type: 'order',
        category: 'order_update',
      },
      driver: {
        title: 'Delivery Completed ✅',
        message: `You have successfully delivered order ${order.order_number}`,
        type: 'delivery',
        category: 'delivery',
      },
    },
    cancelled: {
      buyer: {
        title: 'Order Cancelled',
        message: `Order ${order.order_number} has been cancelled`,
        type: 'order',
        category: 'order_update',
      },
      vendor: {
        title: 'Order Cancelled',
        message: `Order ${order.order_number} has been cancelled`,
        type: 'order',
        category: 'order_update',
      },
    },
  }

  const template = templates[newStatus]
  if (!template) return []

  if (template.buyer && order.buyer_id) {
    notifications.push(
      notificationsApi.create({
        user_id: order.buyer_id,
        ...template.buyer,
        action_url: `/orders/${order.id}`,
          action_label: 'عرض الطلب',
        data: { order_id: order.id, order_number: order.order_number },
      })
    )
  }

  if (template.vendor && order.vendor_id) {
    notifications.push(
      notificationsApi.create({
        user_id: order.vendor_id,
        ...template.vendor,
        action_url: `/orders/${order.id}`,
          action_label: 'عرض الطلب',
        data: { order_id: order.id, order_number: order.order_number },
      })
    )
  }

  if (template.driver && order.driver_id) {
    notifications.push(
      notificationsApi.create({
        user_id: order.driver_id,
        ...template.driver,
        action_url: `/orders/${order.id}`,
          action_label: 'عرض الطلب',
        data: { order_id: order.id, order_number: order.order_number },
      })
    )
  }

  return Promise.all(notifications)
}, { maxRetries: 2, baseDelay: 1000 })

export const createProductApprovalNotification = withRetry(async (product, decision, vendorId) => {
  const templates = {
    approved: {
      title: 'Product Approved ✅',
      message: `Your product "${product.name}" has been approved and is now visible to buyers`,
      type: 'product',
      category: 'promotion',
    },
    rejected: {
      title: 'Product Rejected ❌',
      message: `Your product "${product.name}" was rejected. Reason: ${product.rejection_reason || 'Not specified'}`,
      type: 'product',
      category: 'system',
    },
  }

  const template = templates[decision]
  if (!template || !vendorId) return null

  return notificationsApi.create({
    user_id: vendorId,
    ...template,
    action_url: '/vendor/products',
    action_label: 'عرض المنتجات',
    data: { product_id: product.id, product_name: product.name },
  })
}, { maxRetries: 2, baseDelay: 1000 })

export const notificationEvents = {
  badge: NOTIFICATION_BADGE_EVENT,
  preferences: NOTIFICATION_PREFERENCES_EVENT,
}