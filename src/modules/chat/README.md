# Chat Module

## Purpose

The chat module encapsulates all chat/messaging functionality:
- Conversations (creation, listing, deletion)
- Messages (sending, reading, pagination)
- Message read status (marking as read)
- Chat realtime subscriptions (Supabase Realtime)
- File attachments (upload, validation, preview)
- Delivery/order context messaging (simpler `messagesApi`)
- Chat-related React Query hooks (queries + mutations)

## Current Status: Re-export Foundation Only

This module is currently a **re-export layer**. No source files have been moved.
The re-exports point to existing files in `src/services/`, `src/hooks/queries/`, and `src/hooks/mutations/`.

**Source files:**
- `src/services/chatService.jsx` (494 lines) — class-based chat service with realtime
- `src/services/favorites.js` (lines 113–169) — `messagesApi` for delivery/order contexts
- `src/hooks/queries/useChatQueries.js` (39 lines) — chat query hooks
- `src/hooks/mutations/useChatMutations.js` (66 lines) — chat mutation hooks

## Public API

```js
import {
  // API — Service instances
  chatService,
  messagesApi,

  // Hooks — Queries
  useChatList,
  useChatMessages,
  useUnreadCount,

  // Hooks — Mutations
  useSendMessage,
  useUploadFile,
  useMarkAsRead,
  useDeleteConversation,
} from '@/modules/chat'
```

### `chatService` Methods (from `src/services/chatService.jsx`)

- `getOrCreateConversation(userId1, userId2, context)` — get or create a conversation between two users
- `sendMessage({ conversationId, senderId, content, attachments, replyToId })` — send a message with optional attachments
- `getMessages(conversationId, { limit, before })` — get paginated messages for a conversation
- `getUserConversations(userId, filters)` — get all conversations for a user
- `markMessagesAsRead(conversationId, userId)` — mark unread messages as read
- `subscribeToConversation(conversationId, callback)` — subscribe to new messages via Supabase Realtime
- `uploadAttachment(file, conversationId)` — upload a file attachment to Supabase Storage
- `deleteConversation(conversationId, userId)` — delete a conversation and its messages
- `validateFile(file)` — validate file size, type, and extension

### `messagesApi` Methods (from `src/services/favorites.js`)

- `getDeliveryMessages(deliveryId)` — get messages for a delivery
- `getOrderMessages(orderId)` — get messages for an order
- `send(message)` — send a message (delivery/order context)
- `markAsRead(messageId)` — mark a single message as read
- `subscribeToDelivery(deliveryId, callback)` — subscribe to delivery messages
- `subscribeToOrder(orderId, callback)` — subscribe to order messages

### Hooks (from `useChatQueries.js` and `useChatMutations.js`)

**Queries:**
- `useChatList()` — fetch all conversations for the current user
- `useChatMessages(conversationId, { limit, offset })` — fetch paginated messages
- `useUnreadCount()` — total unread count across all conversations

**Mutations:**
- `useSendMessage(conversationId)` — send a message mutation
- `useUploadFile(conversationId)` — upload file attachment mutation
- `useMarkAsRead(conversationId)` — mark messages as read mutation
- `useDeleteConversation()` — delete conversation mutation

## What Belongs in Chat

- Conversation CRUD (create, list, delete)
- Message CRUD (send, read, paginate, delete)
- Message read status management
- Chat realtime subscriptions
- File attachment upload and validation
- Chat-related React Query hooks
- Chat UI components (future migration)
- Chat pages (future migration)

## What Does NOT Belong in Chat

- **User profile ownership** — owned by `users` module. Chat displays participant names/photos via Supabase joins.
- **Auth/session logic** — owned by `auth` module. Chat reads user identity from `useAuthStore`.
- **Order lifecycle** — owned by `orders` module. Chat may reference `order_id` or `context_id` but does not own order status.
- **Notification delivery logic** — owned by `notifications` module. Chat may trigger notifications in the future but does not own delivery.
- **Support ticket lifecycle** — support tickets are separate from chat. Support ticket hooks live in `useSupportTicketQueries.js`.
- **Payment logic** — owned by `payments` module.
- **Delivery logic** — owned by `delivery` module. Chat may reference `delivery_id` but does not own delivery state.
- **Admin dashboard composition** — not a chat concern.

---

## Relationship with Users

- Chat displays participant names/photos via Supabase joins on `profiles` table.
- Chat **does not** own user profiles or profile data.
- `chatService.getUserConversations()` joins `profiles` for participant info.

## Relationship with Orders

- Chat conversations can reference `context_type: 'order'` and `context_id: <orderId>`.
- `messagesApi.getOrderMessages(orderId)` fetches messages for a specific order.
- `ChatComponent` (in `src/components/ui/`) accepts `orderId` prop for order-context messaging.
- Chat **does not** own order lifecycle or order status transitions.
- `OrderDetail.jsx` and `vendor/Orders.jsx` import `ChatComponent` from `@/components/ui`.

## Relationship with Notifications

- Chat does not currently trigger notifications.
- `chatService` does not call `notificationsApi` or `create_user_notification` RPC.
- **Future:** chat may request notifications for new messages via `notifications` module public API.
- Chat **must not** own notification delivery logic.

## Relationship with Support

- Support tickets are **separate** from chat.
- Support ticket hooks (`useSupportTickets`, `useSupportTicket`, `useCreateTicket`, `useReplyToTicket`) live in `src/hooks/queries/useSupportTicketQueries.js`.
- Support tickets use Supabase `support_tickets` table, not `conversations`/`messages` tables.
- **Do not merge** support tickets into the chat module.

---

## Module Structure

```
src/modules/chat/
├── index.js          # Public API entry point
├── api/
│   └── index.js      # chatService, messagesApi
├── data/
│   └── index.js      # Placeholder (chatService/messagesApi are closest to data layer)
├── domain/
│   └── index.js      # Placeholder (domain logic embedded in chatService)
├── ui/
│   └── index.js      # Placeholder (chat components not re-exported yet)
├── hooks/
│   └── index.js      # useChatList, useChatMessages, useUnreadCount, useSendMessage, useUploadFile, useMarkAsRead, useDeleteConversation
├── stores/
│   └── index.js      # Placeholder (no dedicated chat store)
├── utils/
│   └── index.js      # Placeholder (utils embedded in chatService)
└── README.md         # This file
```

---

## Allowed Dependencies

- `shared` — shared utilities and components
- `auth` — public API only (for current user identity via `useAuthStore`)
- `users` — public API only (for participant profile display)
- `orders` — public API only (for order context references)
- `notifications` — public API only (for future notification requests)
- `utils` — utility functions (logger, withRetry, etc.)
- `config` — configuration constants
- `lib/supabase` — Supabase client

## Forbidden Dependencies

- `checkout` internals — checkout flow is not a chat concern
- `payments` internals — payment provider logic is not a chat concern
- `delivery` internals — delivery logic is not a chat concern (chat may reference `delivery_id`)
- `admin` dashboard composition — not a chat concern

---

## Migration Candidates for Future Sprints

| # | Item | Current Location | Target | Risk | Recommended Phase |
|---|---|---|---|---|---|
| MC1 | `src/services/chatService.jsx` (494 lines) | `src/services/` | `src/modules/chat/api/` | Medium — used by Chat.jsx, Messages.jsx, hooks, ChatWindow | Phase 4.4+ |
| MC2 | `messagesApi` in `src/services/favorites.js` (lines 113–169) | `src/services/favorites.js` | `src/modules/chat/api/` | Medium — part of a mixed file, used by `ChatComponent` | Phase 4.4+ |
| MC3 | `src/hooks/queries/useChatQueries.js` (39 lines) | `src/hooks/queries/` | `src/modules/chat/hooks/` | Low — clean, focused file | Phase 4.4+ |
| MC4 | `src/hooks/mutations/useChatMutations.js` (66 lines) | `src/hooks/mutations/` | `src/modules/chat/hooks/` | Low — clean, focused file | Phase 4.4+ |
| MC5 | `src/components/Chat/ChatWindow.jsx` (329 lines) | `src/components/Chat/` | `src/modules/chat/ui/` | Medium — uses chatService, authStore, realtime | Phase 4.4+ |
| MC6 | `src/components/Chat/ChatList.jsx` (124 lines) | `src/components/Chat/` | `src/modules/chat/ui/` | Low — presentational component | Phase 4.4+ |
| MC7 | `src/components/Chat/ChatMessage.jsx` (124 lines) | `src/components/Chat/` | `src/modules/chat/ui/` | Low — presentational component | Phase 4.4+ |
| MC8 | `src/components/Chat/FilePreview.jsx` (128 lines) | `src/components/Chat/` | `src/modules/chat/ui/` | Low — presentational component | Phase 4.4+ |
| MC9 | `src/components/ui/ChatComponent.jsx` (191 lines) | `src/components/ui/` | `src/modules/chat/ui/` | Medium — uses `messagesApi` from `favorites.js`, used by OrderDetail and vendor/Orders | Phase 4.4+ |
| MC10 | `src/pages/Chat.jsx` (93 lines) | `src/pages/` | `src/modules/chat/ui/` | Medium — uses chatService, ChatList, ChatWindow | Phase 4.5+ |
| MC11 | `src/pages/Messages.jsx` (410 lines) | `src/pages/` | `src/modules/chat/ui/` | High — uses chatService + Supabase directly, 410 lines | Phase 4.5+ |
| MC12 | Consolidate `chatService` and `messagesApi` | Two separate APIs | One unified chat API | High — different paradigms (class vs object), different table schemas | Phase 4.5+ |

---

## Safety Notes

### Realtime Subscriptions

- `chatService.subscribeToConversation()` uses Supabase Realtime channels.
- The subscription listens for `INSERT` events on the `messages` table filtered by `conversation_id`.
- `messagesApi.subscribeToDelivery()` and `subscribeToOrder()` also use Supabase Realtime.
- **Do not modify realtime subscription behavior** — changes could break message delivery.
- The `chatService` class manages channels in a `Map` and cleans up on unsubscribe.

### Two Chat APIs

- There are **two** chat/messaging APIs in the codebase:
  1. `chatService` in `src/services/chatService.jsx` — class-based, uses `conversations` + `messages` tables, supports attachments
  2. `messagesApi` in `src/services/favorites.js` — object-based, uses `messages` table with `delivery_id`/`order_id` fields, simpler
- These are separate APIs with different table schemas and paradigms. This is a known inconsistency.
- **Do not merge them** in this phase. Document as migration candidate MC12.

### `chatService.jsx` is a JSX File

- `src/services/chatService.jsx` uses `.jsx` extension because it exports a `ChatComponent` React component alongside the service.
- This is unusual for a service file. The `ChatComponent` export should eventually be moved to a separate UI file.
- **Do not change the file extension** in this phase.

### `messagesApi` Lives in `favorites.js`

- `messagesApi` is exported from `src/services/favorites.js` — a mixed service file containing favorites, wishlist, and messaging APIs.
- This is a known organizational issue. The messaging portion should eventually be extracted.
- **Do not extract it** in this phase. Document as migration candidate MC2.

### Supabase Tables

- `conversations` — conversation records (participant_1_id, participant_2_id, context_type, context_id, last_message, last_message_at)
- `messages` — message records (conversation_id, sender_id, content, attachments, is_read, delivery_id, order_id)
- `conversation_participants` — participant mapping (referenced in Messages.jsx)
- Chat attachments stored in Supabase Storage bucket `chat-attachments`
- **Do not modify schema or RLS policies.**
