import { supabase } from './supabase'

// Favorites API
export const favoritesApi = {
  // Get all favorites for a user
  getUserFavorites: async (userId) => {
    // Only fetch primary images to avoid duplicate rows, select only needed product fields
    const { data, error } = await supabase
      .from('favorites')
      .select(`
        id, product_id, vendor_id, created_at,
        product:products(
          id, name, price_per_unit, unit_type, is_available,
          product_images!is_primary(url)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  // Check if product is favorited
  isProductFavorited: async (userId, productId) => {
    const { data, error } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return !!data
  },

  // Add product to favorites
  addProduct: async (userId, productId) => {
    const { data, error } = await supabase
      .from('favorites')
      .insert({ user_id: userId, product_id: productId })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Add vendor to favorites
  addVendor: async (userId, vendorId) => {
    const { data, error } = await supabase
      .from('favorites')
      .insert({ user_id: userId, vendor_id: vendorId })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Remove from favorites
  remove: async (favoriteId) => {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('id', favoriteId)

    if (error) throw error
  },

  // Toggle product favorite - Optimized: single query using upsert + delete pattern
  toggleProduct: async (userId, productId) => {
    // Try to find and delete existing favorite (single query)
    const { data: existing, error: findError } = await supabase
      .from('favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .maybeSingle()

    if (findError) throw findError

    if (existing) {
      // Remove existing favorite
      await favoritesApi.remove(existing.id)
      return { isFavorited: false }
    } else {
      // Add new favorite
      await favoritesApi.addProduct(userId, productId)
      return { isFavorited: true }
    }
  },

  // Subscribe to favorites changes (real-time)
  subscribe: (userId, callback) => {
    return supabase
      .channel('favorites-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'favorites',
          filter: `user_id=eq.${userId}`
        },
        callback
      )
      .subscribe()
  }
}

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
    const { data, error } = await supabase
      .from('messages')
      .insert(message)
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

// Order Timeline API
export const orderTimelineApi = {
  getByOrder: async (orderId) => {
    const { data, error } = await supabase
      .from('order_timeline')
      .select(`
        *,
        updated_by:profiles!order_timeline_updated_by_fkey(first_name, last_name, avatar_url, role)
      `)
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data
  },

  // Subscribe to timeline changes
  subscribe: (orderId, callback) => {
    return supabase
      .channel(`timeline-order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_timeline',
          filter: `order_id=eq.${orderId}`
        },
        callback
      )
      .subscribe()
  }
}

// Verification API
export const verificationApi = {
  // Upload verification document
  uploadDocument: async (userId, documentType, file) => {
    // Upload file to storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}/${documentType}_${Date.now()}.${fileExt}`
    
    const { error: uploadError } = await supabase.storage
      .from('verification-docs')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('verification-docs')
      .getPublicUrl(fileName)

    // Create database record
    const { data, error } = await supabase
      .from('verification_documents')
      .insert({
        user_id: userId,
        document_type: documentType,
        document_url: publicUrl
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Get user's verification documents
  getUserDocuments: async (userId) => {
    const { data, error } = await supabase
      .from('verification_documents')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  // Get all pending documents (admin)
  getPendingDocuments: async () => {
    const { data, error } = await supabase
      .from('verification_documents')
      .select(`
        *,
        user:profiles!verification_documents_user_id_fkey(first_name, last_name, email, phone, role)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  },

  // Review document (admin)
  reviewDocument: async (docId, status, adminNotes, adminId) => {
    const { data, error } = await supabase
      .from('verification_documents')
      .update({
        status,
        admin_notes: adminNotes,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', docId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  // Update user verification status
  updateVerificationStatus: async (userId, isVerified) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ 
        is_verified: isVerified,
        verification_status: isVerified ? 'verified' : 'rejected'
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  }
}
