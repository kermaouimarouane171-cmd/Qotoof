/**
 * Driver Queries & Mutations
 * React Query hooks for driver delivery management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { CACHE_CONFIG } from '@/constants/apiEndpoints'

// ══════════════════════════════════════════
// QUERY KEYS
// ══════════════════════════════════════════

export const driverKeys = {
  all: ['driver'],
  profile: () => [...driverKeys.all, 'profile'],
  deliveries: () => [...driverKeys.all, 'deliveries'],
  deliveryList: (filters) => [...driverKeys.all, 'deliveries', filters],
  deliveryDetail: (id) => [...driverKeys.all, 'delivery', id],
  available: () => [...driverKeys.all, 'available'],
  stats: () => [...driverKeys.all, 'stats'],
  earnings: (period) => [...driverKeys.all, 'earnings', period],
}

// ══════════════════════════════════════════
// DRIVER QUERIES
// ══════════════════════════════════════════

export const useDriverProfile = (options = {}) => {
  return useQuery({
    queryKey: driverKeys.profile(),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('driver_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (error) throw error
      return data
    },
    staleTime: CACHE_CONFIG.PROFILE.staleTime,
    ...options,
  })
}

export const useDriverDeliveries = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: driverKeys.deliveryList(filters),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      let query = supabase
        .from('deliveries')
        .select(`
          *,
          order:orders(id, status, total_amount, delivery_address,
            buyer:profiles!orders_buyer_id_fkey(first_name, last_name, phone)
          )
        `)
        .eq('driver_id', session.user.id)

      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      query = query.order('created_at', { ascending: false })

      const limit = filters.limit || 20
      const offset = filters.offset || 0
      query = query.range(offset, offset + limit - 1)

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    staleTime: 30_000,
    keepPreviousData: true,
    ...options,
  })
}

export const useDeliveryDetail = (id, options = {}) => {
  return useQuery({
    queryKey: driverKeys.deliveryDetail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          order:orders(*,
            order_items(*, product:products(name, price_per_unit)),
            buyer:profiles!orders_buyer_id_fkey(first_name, last_name, phone, email)
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
    ...options,
  })
}

export const useAvailableDeliveries = (options = {}) => {
  return useQuery({
    queryKey: driverKeys.available(),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select(`
          *,
          order:orders(id, total_amount, delivery_address)
        `)
        .is('driver_id', null)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    ...options,
  })
}

export const useDriverStats = (options = {}) => {
  return useQuery({
    queryKey: driverKeys.stats(),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .rpc('get_driver_stats', { driver_user_id: session.user.id })

      if (error) throw error
      return data
    },
    staleTime: CACHE_CONFIG.ANALYTICS.staleTime,
    ...options,
  })
}

export const useDriverEarnings = (period = 'month', options = {}) => {
  return useQuery({
    queryKey: driverKeys.earnings(period),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .rpc('get_driver_earnings', {
          driver_user_id: session.user.id,
          time_period: period,
        })

      if (error) throw error
      return data
    },
    staleTime: CACHE_CONFIG.ANALYTICS.staleTime,
    ...options,
  })
}

// ══════════════════════════════════════════
// DRIVER MUTATIONS
// ══════════════════════════════════════════

export const useUpdateDriverProfile = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (updates) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('driver_profiles')
        .update(updates)
        .eq('user_id', session.user.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(driverKeys.profile(), data)
    },
  })
}

export const useAcceptDelivery = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (deliveryId) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('deliveries')
        .update({
          driver_id: session.user.id,
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', deliveryId)
        .is('driver_id', null)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: driverKeys.all })
    },
  })
}

export const useUpdateDeliveryStatus = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ deliveryId, status, location }) => {
      const updates = { status }
      if (location) updates.current_location = location
      if (status === 'picked_up') updates.picked_up_at = new Date().toISOString()
      if (status === 'delivered') updates.delivered_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('deliveries')
        .update(updates)
        .eq('id', deliveryId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: driverKeys.deliveryDetail(variables.deliveryId) })
      queryClient.invalidateQueries({ queryKey: driverKeys.deliveries() })
    },
  })
}

export const useUpdateDriverLocation = () => {
  return useMutation({
    mutationFn: async ({ deliveryId, latitude, longitude }) => {
      const { error } = await supabase
        .from('delivery_tracking')
        .insert({
          delivery_id: deliveryId,
          latitude,
          longitude,
          recorded_at: new Date().toISOString(),
        })

      if (error) throw error
      return { success: true }
    },
  })
}

export const useToggleDriverAvailability = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (isAvailable) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('driver_profiles')
        .update({ is_available: isAvailable })
        .eq('user_id', session.user.id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(driverKeys.profile(), data)
    },
  })
}
