/**
 * Chat Module — API Layer (re-export)
 *
 * Re-exports chat-related service functions from existing source files.
 * No business logic changes. No Supabase query changes.
 * All exports are additive re-exports from existing source files.
 */

// ── chatService from src/services/chatService.jsx ─────────────────────────
// chatService is a class instance with:
//   getOrCreateConversation, sendMessage, getMessages, getUserConversations,
//   markMessagesAsRead, subscribeToConversation, uploadAttachment,
//   deleteConversation, validateFile
export {
  chatService,
} from '@/services/chatService'

export { default as chatServiceDefault } from '@/services/chatService'

// ── messagesApi from src/modules/chat/api/messagesApi.js (Phase 6.9) ──────
// messagesApi is a simpler message API for delivery/order contexts:
//   getDeliveryMessages, getOrderMessages, send, markAsRead,
//   subscribeToDelivery, subscribeToOrder, subscribeToUser
export {
  messagesApi,
} from './messagesApi'
