import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'
import {
  subscribe as managerSubscribe,
  unsubscribeAll as managerUnsubscribeAll,
  getActiveChannelsCount,
} from '@/services/realtimeManager'

/**
 * Real-time Service
 * Provides live updates for orders, notifications, products, and deliveries.
 *
 * Channel deduplication is now delegated to realtimeManager so that multiple
 * components watching the same logical feed share a single WebSocket subscription.
 */
class RealtimeService {
  constructor() {
    /** Maps channel keys → unsubscribe functions returned by realtimeManager */
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
    this.isConnected = true
    this.reconnectAttempts = 0
    logger.info('Realtime service initialized')
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

    const key = `orders:${userId}`
    // Remove previous registration for same key before re-subscribing
    if (this.channels.has(key)) this.unsubscribe(key)

    const wrappedCallback = (payload) => {
      logger.info('Order changed:', payload)
      callback(payload)
      if (payload.eventType === 'INSERT') {
        toast.success('📦 طلب جديد تم استلامه!')
      } else if (payload.eventType === 'UPDATE') {
        const status = payload.new?.status
        if (status === 'confirmed') toast.success('✅ تم تأكيد طلبك')
        else if (status === 'shipped') toast.success('🚚 طلبك في الطريق!')
        else if (status === 'delivered') toast.success('✓ تم تسليم طلبك')
      }
    }

    const unsub = managerSubscribe('orders', `buyer_id=eq.${userId}`, wrappedCallback)
    this.channels.set(key, unsub)
    return () => this.unsubscribe(key)
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

    const key = `vendor-orders:${vendorId}`
    if (this.channels.has(key)) this.unsubscribe(key)

    const wrappedInsert = (payload) => {
      logger.info('New vendor order:', payload)
      callback(payload)
      toast.success('🎉 طلب جديد من عميل!')
    }
    const wrappedUpdate = (payload) => {
      logger.info('Vendor order updated:', payload)
      callback(payload)
    }

    // Two callbacks on the same channel key — manager fan-outs them both
    const unsubInsert = managerSubscribe('orders', `vendor_id=eq.${vendorId}`, wrappedInsert, 'INSERT')
    const unsubUpdate = managerSubscribe('orders', `vendor_id=eq.${vendorId}`, wrappedUpdate, 'UPDATE')

    const unsub = () => { unsubInsert(); unsubUpdate() }
    this.channels.set(key, unsub)
    return () => this.unsubscribe(key)
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

    const key = `notifications:${userId}`
    if (this.channels.has(key)) this.unsubscribe(key)

    const wrappedCallback = (payload) => {
      logger.info('New notification:', payload)
      callback(payload)
      const notification = payload.new
      if (notification) toast.info(notification.message || 'إشعار جديد')
    }

    const unsub = managerSubscribe('notifications', `user_id=eq.${userId}`, wrappedCallback, 'INSERT')
    this.channels.set(key, unsub)
    return () => this.unsubscribe(key)
  }

  /**
   * Subscribe to product changes (for marketplace live updates)
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  subscribeToProducts(callback) {
    const key = 'products:all'
    if (this.channels.has(key)) this.unsubscribe(key)

    const wrappedCallback = (payload) => {
      logger.info('Product changed:', payload)
      callback(payload)
    }

    const unsub = managerSubscribe('products', '', wrappedCallback)
    this.channels.set(key, unsub)
    return () => this.unsubscribe(key)
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

    const key = `deliveries:${driverId}`
    if (this.channels.has(key)) this.unsubscribe(key)

    const wrappedCallback = (payload) => {
      logger.info('Delivery changed:', payload)
      callback(payload)
      if (payload.eventType === 'INSERT') {
        toast.success('🚚 طلب توصيل جديد!')
      } else if (payload.eventType === 'UPDATE') {
        const status = payload.new?.status
        if (status === 'picked_up') toast.info('📦 تم استلام الطلب')
        else if (status === 'delivered') toast.success('✓ تم التوصيل بنجاح!')
      }
    }

    const unsub = managerSubscribe('deliveries', `driver_id=eq.${driverId}`, wrappedCallback)
    this.channels.set(key, unsub)
    return () => this.unsubscribe(key)
  }

  /**
   * Subscribe to NEW unassigned delivery requests (for drivers to see new requests)
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  subscribeToNewDeliveryRequests(callback) {
    const key = 'deliveries:unassigned'
    if (this.channels.has(key)) this.unsubscribe(key)

    const wrappedCallback = (payload) => {
      logger.info('New delivery request:', payload)
      callback(payload)
    }

    const unsub = managerSubscribe('deliveries', 'status=eq.unassigned', wrappedCallback, 'INSERT')
    this.channels.set(key, unsub)
    return () => this.unsubscribe(key)
  }

  /**
   * Subscribe to stock changes for a product
   * @param {string} productId - Product ID
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  subscribeToProductStock(productId, callback) {
    if (!productId) return () => {}

    const key = `product-stock:${productId}`
    if (this.channels.has(key)) this.unsubscribe(key)

    const wrappedCallback = (payload) => {
      logger.info('Product stock changed:', payload)
      callback(payload)
      const newQty = payload.new?.available_quantity
      if (newQty === 0) toast.error('⚠️ نفذ المنتج من المخزون')
      else if (newQty <= 10) toast(`مخزون منخفض: ${newQty} متبقي`, { icon: '⚠️' })
    }

    const unsub = managerSubscribe('products', `id=eq.${productId}`, wrappedCallback, 'UPDATE')
    this.channels.set(key, unsub)
    return () => this.unsubscribe(key)
  }

  /**
   * Unsubscribe from a specific channel key
   * @param {string} channelName - Channel key
   */
  unsubscribe(channelName) {
    const unsub = this.channels.get(channelName)
    if (unsub) {
      unsub()
      this.channels.delete(channelName)
      logger.info(`Unsubscribed from ${channelName}`)
    }
  }

  /**
   * Unsubscribe from all channels registered by this service instance
   */
  unsubscribeAll() {
    this.channels.forEach((unsub, name) => {
      unsub()
      logger.info(`Unsubscribed from ${name}`)
    })
    this.channels.clear()
    managerUnsubscribeAll()
    this.isConnected = false
  }

  /**
   * Handle reconnection (kept for API compatibility — manager handles this internally)
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
   * Get active channels count — reflects deduplicated channels in realtimeManager
   * @returns {number}
   */
  getActiveChannelsCount() {
    return getActiveChannelsCount()
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
