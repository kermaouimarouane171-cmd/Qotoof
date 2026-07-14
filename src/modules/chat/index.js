/**
 * Chat Module — Public API Entry Point (Phase 4.3)
 *
 * This module exposes existing chat/messaging functionality through a clean
 * public API. It is a re-export/wrapper layer only — no business logic changes.
 *
 * Public API:
 *   import { chatService, messagesApi, useChatList, useSendMessage } from '@/modules/chat'
 *
 * The chat module owns:
 *   - conversations (creation, listing, deletion)
 *   - messages (sending, reading, marking as read)
 *   - chat realtime subscriptions (subscribeToConversation)
 *   - file attachments (upload, validation)
 *   - chat-related React Query hooks (queries + mutations)
 *   - delivery/order message context (messagesApi)
 *
 * The chat module does NOT own:
 *   - user profile ownership
 *   - auth/session logic
 *   - order lifecycle
 *   - notification delivery logic
 *   - support ticket lifecycle
 *   - payment logic
 *   - delivery logic
 *   - admin dashboard composition
 *
 * Allowed dependencies:
 *   - shared, auth (public API only), users (public API only),
 *     orders (public API only for order context references),
 *     notifications (public API only for future notification requests),
 *     utils, config, lib/supabase
 *
 * Forbidden dependencies:
 *   - checkout internals, payments internals, delivery internals,
 *     admin dashboard composition
 */

// ── API ──────────────────────────────────────────────────────────────────
export {
  chatService,
  chatServiceDefault,
  messagesApi,
} from './api'

// ── Hooks ────────────────────────────────────────────────────────────────
export {
  // Queries
  useChatList,
  useChatMessages,
  useUnreadCount,
  // Mutations
  useSendMessage,
  useUploadFile,
  useMarkAsRead,
  useDeleteConversation,
} from './hooks'
