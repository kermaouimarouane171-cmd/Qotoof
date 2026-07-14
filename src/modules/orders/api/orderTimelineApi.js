import { supabase } from '@/services/supabase'

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
