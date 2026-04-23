import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { chatService } from '@/services/chatService'

/**
 * Send a message in a conversation
 */
export function useSendMessage(conversationId) {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  return useMutation({
    mutationFn: ({ content, attachments, replyToId }) =>
      chatService.sendMessage({
        conversationId,
        senderId: user.id,
        content,
        attachments,
        replyToId
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] })
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations', user?.id] })
    }
  })
}

/**
 * Upload a file attachment
 */
export function useUploadFile(conversationId) {
  return useMutation({
    mutationFn: (file) => chatService.uploadAttachment(file, conversationId)
  })
}

/**
 * Mark messages in a conversation as read
 */
export function useMarkAsRead(conversationId) {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  return useMutation({
    mutationFn: () => chatService.markMessagesAsRead(conversationId, user.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations', user?.id] })
    }
  })
}

/**
 * Delete a conversation (or message)
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  return useMutation({
    mutationFn: (conversationId) => chatService.deleteConversation(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversations', user?.id] })
    }
  })
}
