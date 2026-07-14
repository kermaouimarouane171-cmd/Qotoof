import { supabase } from '@/services/supabase'
import { sanitizeText } from '@/utils/sanitization'

// Messages API
export const messagesApi = {
  // Get messages for a delivery - Optimized: select only needed fields
  getDeliveryMessages: async (deliveryId) => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id, content, sender_id, receiver_id, created_at, is_read,
        sender:profiles!sender_id(first_name, last_name, avatar_url),
        receiver:profiles!receiver_id(first_name, last_name)
      `)
      .eq('delivery_id', deliveryId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data
  },

  // Get messages for an order - Optimized: select only needed fields
  getOrderMessages: async (orderId) => {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        id, content, sender_id, receiver_id, created_at, is_read,
        sender:profiles!sender_id(first_name, last_name, avatar_url),
        receiver:profiles!receiver_id(first_name, last_name)
      `)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data
  },

  // Send a message
  send: async (message) => {
    // Sanitize message content to prevent XSS
    const sanitizedMessage = {
      ...message,
      message: message?.message ? sanitizeText(String(message.message), { maxLength: 5000, allowNewlines: true, collapseWhitespace: false }).trim() : message?.message,
    }
    const { data, error } = await supabase
      .from('messages')
      .insert(sanitizedMessage)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Mark message as read
  markAsRead: async (messageId) => {
    const { data, error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('id', messageId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Mark all messages as read for a user
  markAllAsRead: async (userId) => {
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('receiver_id', userId)
      .eq('is_read', false)

    if (error) throw error
  },

  // Get unread message count
  getUnreadCount: async (userId) => {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('is_read', false)

    if (error) throw error
    return count || 0
  },

  // Subscribe to new messages (real-time)
  subscribeToDelivery: (deliveryId, callback) => {
    return supabase
      .channel(`messages-delivery-${deliveryId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `delivery_id=eq.${deliveryId}`
        },
        callback
      )
      .subscribe()
  },

  subscribeToOrder: (orderId, callback) => {
    return supabase
      .channel(`messages-order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `order_id=eq.${orderId}`
        },
        callback
      )
      .subscribe()
  },

  subscribeToUser: (userId, callback) => {
    return supabase
      .channel(`messages-user-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${userId}`
        },
        callback
      )
      .subscribe()
  }
}
