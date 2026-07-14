/**
 * Chat Module — Hooks Layer (re-export)
 *
 * Re-exports chat-related React Query hooks.
 * No hook logic changes.
 */

// ── Chat query hooks ──────────────────────────────────────────────────────
export {
  useChatList,
  useChatMessages,
  useUnreadCount,
} from '@/hooks/queries/useChatQueries'

// ── Chat mutation hooks ───────────────────────────────────────────────────
export {
  useSendMessage,
  useUploadFile,
  useMarkAsRead,
  useDeleteConversation,
} from '@/hooks/mutations/useChatMutations'
