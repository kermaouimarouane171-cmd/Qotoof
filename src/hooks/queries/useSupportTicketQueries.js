/**
 * Support Ticket Queries (Phase 3.4 — H2 extraction)
 *
 * Extracted from useNotificationQueries.js to separate support ticket hooks
 * from notification hooks. Support tickets are not a notifications concern.
 *
 * useNotificationQueries.js re-exports these hooks for backward compatibility.
 * No existing imports are changed.
 *
 * Future migration: these hooks should belong to a future support module
 * (or admin module if support is admin-only).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { createSupportTicket } from '@/services/supportTickets'

export const supportKeys = {
  all: ['support'],
  tickets: (filters) => [...supportKeys.all, 'tickets', filters],
  ticket: (id) => [...supportKeys.all, 'ticket', id],
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
          .select('id, user_id, subject, description, status, priority, category, created_at, updated_at, resolved_at, admin_notes')

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
