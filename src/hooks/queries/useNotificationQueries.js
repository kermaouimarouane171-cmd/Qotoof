/**
 * Notifications Queries (Phase 3.4 — support ticket hooks extracted to useSupportTicketQueries.js)
 *
 * Support ticket hooks are re-exported from useSupportTicketQueries.js for backward compatibility.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { normalizeNotificationCategory, notificationsApi } from '@/modules/notifications'

// Re-export support ticket hooks for backward compatibility
export {
  supportKeys,
  useSupportTickets,
  useSupportTicket,
  useCreateTicket,
  useReplyToTicket,
} from './useSupportTicketQueries'

export const notificationKeys = {
  all: ['notifications'],
  list: (filters) => [...notificationKeys.all, 'list', filters],
  unreadCount: () => [...notificationKeys.all, 'unread'],
}

// ══════════════════════════════════════════
// NOTIFICATION QUERIES
// ══════════════════════════════════════════

export const useNotifications = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: notificationKeys.list(filters),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return []

      let query = supabase
        .from('notifications')
          .select('id, user_id, type, title, message, order_id, is_read, read_at, created_at, category, data')

      if (filters.category) {
        query = query.eq('category', normalizeNotificationCategory(filters.category))
      }

      if (filters.unreadOnly) {
        query = query.is('read_at', null)
      }

      if (filters.readOnly) {
        query = query.not('read_at', 'is', null)
      }

      const limit = filters.limit || 30
      const offset = filters.offset || 0
      query = query.range(offset, offset + limit - 1)

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    staleTime: 30_000,
    ...options,
  })
}

export const useUnreadCount = (options = {}) => {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return 0

      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact' })
        .eq('user_id', session.user.id)
        .is('read_at', null)
        .range(0, 0)

      if (error) throw error
      return count || 0
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    ...options,
  })
}

// ══════════════════════════════════════════
// NOTIFICATION MUTATIONS
// ══════════════════════════════════════════

export const useMarkAsRead = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (notificationId) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export const useMarkAllAsRead = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', session.user.id)
        .is('read_at', null)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

export const useNotificationPreferences = (options = {}) => {
  return useQuery({
    queryKey: [...notificationKeys.all, 'preferences'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      return notificationsApi.getPreferences(session.user.id)
    },
    staleTime: 60_000,
    ...options,
  })
}

export const useSaveNotificationPreferences = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (preferences) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      return notificationsApi.savePreferences({
        userId: session.user.id,
        preferences,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
  })
}

