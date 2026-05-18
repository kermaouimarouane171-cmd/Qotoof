/**
 * Notifications & Support Queries
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { normalizeNotificationCategory, notificationsApi } from '@/services/notifications'
import { createSupportTicket } from '@/services/supportTickets'

export const notificationKeys = {
  all: ['notifications'],
  list: (filters) => [...notificationKeys.all, 'list', filters],
  unreadCount: () => [...notificationKeys.all, 'unread'],
}

export const supportKeys = {
  all: ['support'],
  tickets: (filters) => [...supportKeys.all, 'tickets', filters],
  ticket: (id) => [...supportKeys.all, 'ticket', id],
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
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

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

// ══════════════════════════════════════════
// SUPPORT QUERIES & MUTATIONS
// ══════════════════════════════════════════

export const useSupportTickets = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: supportKeys.tickets(filters),
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      let query = supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    },
    staleTime: 60_000,
    ...options,
  })
}

export const useSupportTicket = (id, options = {}) => {
  return useQuery({
    queryKey: supportKeys.ticket(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*, messages:support_messages(*)')
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled: !!id,
    ...options,
  })
}

export const useCreateTicket = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ subject, message, description, category, orderId, attachments, priority }) => {
      return createSupportTicket({
        subject,
        description: description || message,
        category,
        orderId,
        attachments,
        priority,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supportKeys.all })
    },
  })
}

export const useReplyToTicket = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ ticketId, message }) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: session.user.id,
          message,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: supportKeys.ticket(variables.ticketId) })
    },
  })
}
