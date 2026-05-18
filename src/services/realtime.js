import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'

/**
 * Real-time Service
 * Provides live updates for orders, notifications, products, and deliveries
 * Uses Supabase Realtime (WebSocket) under the hood
 */
class RealtimeService {
  constructor() {
    this.channels = new Map()
    this.isConnected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 1000
  }

  /**
   * Initialize realtime connection
   */
  async initialize() {
    if (this.isConnected) return

    try {
      // Supabase realtime is handled through channel subscriptions
      // We just need to track connection state
      this.isConnected = true
      this.reconnectAttempts = 0
      logger.info('Realtime service initialized')
    } catch (error) {
      logger.error('Failed to initialize realtime:', error)
      this.isConnected = false
    }
  }

  /**
    * Subscribe to buyer order changes
    * @param {string} userId - Buyer user ID
   * @param {function} callback - Callback function for order changes
   * @returns {function} Unsubscribe function
   */
  subscribeToOrders(userId, callback) {
    if (!userId) {
      logger.warn('Cannot subscribe to orders: no userId')
      return () => {}
    }

    const channelName = `orders:${userId}`
    
    // Unsubscribe if already subscribed
    if (this.channels.has(channelName)) {
      this.unsubscribe(channelName)
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'orders',
          filter: `buyer_id=eq.${userId}`,
        },
        (payload) => {
          logger.info('Order changed:', payload)
          callback(payload)
          
          // Show toast for new orders
          if (payload.eventType === 'INSERT') {
            toast.success('📦 طلب جديد تم استلامه!')
          } else if (payload.eventType === 'UPDATE') {
            const status = payload.new?.status
            if (status === 'confirmed') {
              toast.success('✅ تم تأكيد طلبك')
            } else if (status === 'shipped') {
              toast.success('🚚 طلبك في الطريق!')
            } else if (status === 'delivered') {
              toast.success('✓ تم تسليم طلبك')
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info(`Subscribed to ${channelName}`)
        } else if (status === 'CHANNEL_ERROR') {
          logger.error(`Channel error: ${channelName}`)
          this.handleReconnect(channelName, () => this.subscribeToOrders(userId, callback))
        }
      })

    this.channels.set(channelName, channel)

    // Return unsubscribe function
    return () => this.unsubscribe(channelName)
  }

  /**
   * Subscribe to vendor orders
   * @param {string} vendorId - Vendor ID
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  subscribeToVendorOrders(vendorId, callback) {
    if (!vendorId) {
      logger.warn('Cannot subscribe to vendor orders: no vendorId')
      return () => {}
    }

    const channelName = `vendor-orders:${vendorId}`
    
    if (this.channels.has(channelName)) {
      this.unsubscribe(channelName)
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          logger.info('New vendor order:', payload)
          callback(payload)
          toast.success('🎉 طلب جديد من عميل!')
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload) => {
          logger.info('Vendor order updated:', payload)
          callback(payload)
        }
      )
      .subscribe()

    this.channels.set(channelName, channel)
    return () => this.unsubscribe(channelName)
  }

  /**
   * Subscribe to notifications
   * @param {string} userId - User ID
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  subscribeToNotifications(userId, callback) {
    if (!userId) {
      logger.warn('Cannot subscribe to notifications: no userId')
      return () => {}
    }

    const channelName = `notifications:${userId}`
    
    if (this.channels.has(channelName)) {
      this.unsubscribe(channelName)
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          logger.info('New notification:', payload)
          callback(payload)
          
          // Show notification toast
          const notification = payload.new
          if (notification) {
            toast.info(notification.message || 'إشعار جديد')
          }
        }
      )
      .subscribe()

    this.channels.set(channelName, channel)
    return () => this.unsubscribe(channelName)
  }

  /**
   * Subscribe to product changes (for marketplace live updates)
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  subscribeToProducts(callback) {
    const channelName = 'products:all'
    
    if (this.channels.has(channelName)) {
      this.unsubscribe(channelName)
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          logger.info('Product changed:', payload)
          callback(payload)
        }
      )
      .subscribe()

    this.channels.set(channelName, channel)
    return () => this.unsubscribe(channelName)
  }

  /**
   * Subscribe to delivery updates for drivers
   * @param {string} driverId - Driver ID
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  subscribeToDeliveries(driverId, callback) {
    if (!driverId) {
      logger.warn('Cannot subscribe to deliveries: no driverId')
      return () => {}
    }

    const channelName = `deliveries:${driverId}`
    
    if (this.channels.has(channelName)) {
      this.unsubscribe(channelName)
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deliveries',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload) => {
          logger.info('Delivery changed:', payload)
          callback(payload)
          
          if (payload.eventType === 'INSERT') {
            toast.success('🚚 طلب توصيل جديد!')
          } else if (payload.eventType === 'UPDATE') {
            const status = payload.new?.status
            if (status === 'picked_up') {
              toast.info('📦 تم استلام الطلب')
            } else if (status === 'delivered') {
              toast.success('✓ تم التوصيل بنجاح!')
            }
          }
        }
      )
      .subscribe()

    this.channels.set(channelName, channel)
    return () => this.unsubscribe(channelName)
  }

  /**
   * Subscribe to NEW unassigned delivery requests (for drivers to see new requests)
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  subscribeToNewDeliveryRequests(callback) {
    const channelName = 'deliveries:unassigned'

    if (this.channels.has(channelName)) {
      this.unsubscribe(channelName)
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'deliveries',
          filter: 'status=eq.unassigned',
        },
        (payload) => {
          logger.info('New delivery request:', payload)
          callback(payload)
        }
      )
      .subscribe()

    this.channels.set(channelName, channel)
    return () => this.unsubscribe(channelName)
  }

  /**
   * Subscribe to stock changes for a product
   * @param {string} productId - Product ID
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  subscribeToProductStock(productId, callback) {
    if (!productId) return () => {}

    const channelName = `product-stock:${productId}`
    
    if (this.channels.has(channelName)) {
      this.unsubscribe(channelName)
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'products',
          filter: `id=eq.${productId}`,
        },
        (payload) => {
          logger.info('Product stock changed:', payload)
          callback(payload)
          
          const newQty = payload.new?.available_quantity
          if (newQty === 0) {
            toast.error('⚠️ نفذ المنتج من المخزون')
          } else if (newQty <= 10) {
            toast(`مخزون منخفض: ${newQty} متبقي`, { icon: '⚠️' })
          }
        }
      )
      .subscribe()

    this.channels.set(channelName, channel)
    return () => this.unsubscribe(channelName)
  }

  /**
   * Unsubscribe from a channel
   * @param {string} channelName - Channel name
   */
  unsubscribe(channelName) {
    const channel = this.channels.get(channelName)
    if (channel) {
      supabase.removeChannel(channel)
      this.channels.delete(channelName)
      logger.info(`Unsubscribed from ${channelName}`)
    }
  }

  /**
   * Unsubscribe from all channels
   */
  unsubscribeAll() {
    this.channels.forEach((channel, name) => {
      supabase.removeChannel(channel)
      logger.info(`Unsubscribed from ${name}`)
    })
    this.channels.clear()
    this.isConnected = false
  }

  /**
   * Handle reconnection
   * @param {string} channelName - Channel name
   * @param {function} subscribeFn - Subscribe function
   */
  async handleReconnect(channelName, subscribeFn) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * this.reconnectAttempts
    
    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)
    
    setTimeout(() => {
      subscribeFn()
    }, delay)
  }

  /**
   * Get active channels count
   * @returns {number}
   */
  getActiveChannelsCount() {
    return this.channels.size
  }
}

// Singleton instance
export const realtimeService = new RealtimeService()

// React hooks for easy integration
import { useEffect, useRef } from 'react'

/**
 * Hook to subscribe to orders realtime
 * @param {string} userId - User ID
 * @param {function} callback - Callback function
 */
export const useRealtimeOrders = (userId, callback) => {
  const callbackRef = useRef(callback)
  
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    realtimeService.initialize()
    
    const unsubscribe = realtimeService.subscribeToOrders(
      userId,
      (payload) => callbackRef.current?.(payload)
    )

    return () => unsubscribe()
  }, [userId])
}

/**
 * Hook to subscribe to vendor orders realtime
 * @param {string} vendorId - Vendor ID
 * @param {function} callback - Callback function
 */
export const useRealtimeVendorOrders = (vendorId, callback) => {
  const callbackRef = useRef(callback)
  
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    realtimeService.initialize()
    
    const unsubscribe = realtimeService.subscribeToVendorOrders(
      vendorId,
      (payload) => callbackRef.current?.(payload)
    )

    return () => unsubscribe()
  }, [vendorId])
}

/**
 * Hook to subscribe to notifications realtime
 * @param {string} userId - User ID
 * @param {function} callback - Callback function
 */
export const useRealtimeNotifications = (userId, callback) => {
  const callbackRef = useRef(callback)
  
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    realtimeService.initialize()
    
    const unsubscribe = realtimeService.subscribeToNotifications(
      userId,
      (payload) => callbackRef.current?.(payload)
    )

    return () => unsubscribe()
  }, [userId])
}

/**
 * Hook to subscribe to deliveries realtime
 * @param {string} driverId - Driver ID
 * @param {function} callback - Callback function
 */
export const useRealtimeDeliveries = (driverId, callback) => {
  const callbackRef = useRef(callback)
  
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    realtimeService.initialize()
    
    const unsubscribe = realtimeService.subscribeToDeliveries(
      driverId,
      (payload) => callbackRef.current?.(payload)
    )

    return () => unsubscribe()
  }, [driverId])
}

export default realtimeService
