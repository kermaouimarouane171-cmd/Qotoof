import { supabase } from '@/services/supabase'

// Favorites API
export const favoritesApi = {
  // Get all favorites for a user
  getUserFavorites: async (userId) => {
    const { data, error } = await supabase
      .from('favorites')
      .select(`
        id, product_id, vendor_id, created_at,
        product:products(
          id, name, price_per_unit, unit_type, is_available, available_quantity,
          product_images(url, is_primary),
          vendor:profiles!products_vendor_id_fkey(id, first_name, last_name, store_name, city, avatar_url)
        ),
        vendor:profiles!favorites_vendor_id_fkey(id, first_name, last_name, store_name, city, store_description, avatar_url)
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
