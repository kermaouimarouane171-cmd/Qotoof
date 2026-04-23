import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { chatService } from '@/services/chatService'

/**
 * Fetch all conversations for the current user
 */
export function useChatList() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['chat', 'conversations', user?.id],
    queryFn: () => chatService.getUserConversations(user.id),
    enabled: !!user?.id,
    staleTime: 30 * 1000
  })
}

/**
 * Fetch messages for a conversation (paginated)
 */
export function useChatMessages(conversationId, { limit = 30, offset = 0 } = {}) {
  return useQuery({
    queryKey: ['chat', 'messages', conversationId, offset],
    queryFn: () => chatService.getMessages(conversationId, { limit, offset }),
    enabled: !!conversationId,
    staleTime: 0,
    refetchOnWindowFocus: false
  })
}

/**
 * Total unread count across all conversations
 */
export function useUnreadCount() {
  const { data: conversations } = useChatList()
  const total = (conversations || []).reduce((sum, c) => sum + (c.unread_count || 0), 0)
  return total
}
