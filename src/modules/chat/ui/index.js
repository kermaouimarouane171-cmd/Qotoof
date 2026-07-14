/**
 * Chat Module — UI Layer (re-export)
 *
 * Placeholder: Chat UI components are not re-exported yet because they are
 * tightly coupled to their parent contexts (pages, auth store, routing).
 *
 * Current chat UI lives in:
 *   - src/components/Chat/ChatWindow.jsx (329 lines) — main chat window with infinite scroll
 *   - src/components/Chat/ChatList.jsx (124 lines) — conversation list panel
 *   - src/components/Chat/ChatMessage.jsx (124 lines) — message bubble with attachments
 *   - src/components/Chat/FilePreview.jsx (128 lines) — file attachment preview
 *   - src/components/ui/ChatComponent.jsx (191 lines) — simpler chat for order/delivery contexts
 *   - src/pages/Chat.jsx (93 lines) — chat page using ChatList + ChatWindow
 *   - src/pages/Messages.jsx (410 lines) — messages inbox + conversation view
 *
 * These components/pages are too coupled to their parent contexts to be safely
 * re-exported as chat module UI. They should remain where they are until
 * a future phase decouples them.
 */
