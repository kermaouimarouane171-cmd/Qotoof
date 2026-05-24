import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { useTranslation } from 'react-i18next'
import InfiniteScroll from 'react-infinite-scroll-component'
import {
  PaperClipIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/store/authStore'
import { chatService } from '@/services/chatService'
import { logger } from '@/utils/logger'
import ChatMessage from './ChatMessage'
import FilePreview from './FilePreview'

const MESSAGES_PER_PAGE = 30
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'audio/mpeg', 'application/pdf']

const ChatWindow = memo(function ChatWindow({ conversationId, recipient }) {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const [messages, setMessages] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState([])
  const [replyTo, setReplyTo] = useState(null)
  const [fileError, setFileError] = useState(null)
  const [page, setPage] = useState(0)

  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const inputRef = useRef(null)
  const subscriptionRef = useRef(null)

  // Load initial messages
  useEffect(() => {
    if (!conversationId) return
    setMessages([])
    setPage(0)
    setHasMore(true)
    setLoading(true)
    loadMessages(0)

    // Subscribe to new messages
    subscriptionRef.current = chatService.subscribeToConversation(
      conversationId,
      (newMessage) => {
        setMessages(prev => {
          if (prev.some(m => m.id === newMessage.id)) return prev
          return [...prev, newMessage]
        })
        chatService.markMessagesAsRead(conversationId, user?.id).catch(() => {})
      }
    )

    return () => {
      subscriptionRef.current?.unsubscribe?.()
    }
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadMessages = useCallback(async (pageNum) => {
    try {
      const data = await chatService.getMessages(conversationId, {
        limit: MESSAGES_PER_PAGE,
        offset: pageNum * MESSAGES_PER_PAGE
      })
      const sorted = [...(data || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      if (pageNum === 0) {
        setMessages(sorted)
        scrollToBottom()
      } else {
        setMessages(prev => [...sorted, ...prev])
      }
      setHasMore((data?.length || 0) === MESSAGES_PER_PAGE)
    } catch (err) {
      logger.error('ChatWindow: failed to load messages', err)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  const loadMore = useCallback(() => {
    const next = page + 1
    setPage(next)
    loadMessages(next)
  }, [page, loadMessages])

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  const handleFiles = (files) => {
    setFileError(null)
    const valid = []
    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setFileError(t('chat.invalidFileType', 'نوع الملف غير مدعوم'))
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        setFileError(t('chat.fileTooLarge', 'الملف أكبر من 10 ميجابايت'))
        continue
      }
      valid.push({ file, preview: URL.createObjectURL(file), type: file.type, name: file.name, size: file.size })
    }
    setAttachments(prev => [...prev, ...valid].slice(0, 5))
  }

  const removeAttachment = (index) => {
    setAttachments(prev => {
      const next = [...prev]
      URL.revokeObjectURL(next[index].preview)
      next.splice(index, 1)
      return next
    })
  }

  const handleSend = async () => {
    const trimmed = text.trim()
    if (!trimmed && attachments.length === 0) return
    setSending(true)
    try {
      // Upload attachments first
      const uploadedFiles = []
      for (const att of attachments) {
        const result = await chatService.uploadAttachment(att.file, conversationId)
        if (result?.url) {
          uploadedFiles.push({ url: result.url, type: att.type, name: att.name, size: att.size })
        }
      }

      await chatService.sendMessage({
        conversationId,
        senderId: user.id,
        content: trimmed,
        attachments: uploadedFiles,
        replyToId: replyTo?.id
      })

      setText('')
      setAttachments([])
      setReplyTo(null)
      scrollToBottom()
    } catch (err) {
      logger.error('ChatWindow: send failed', err)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleDelete = async (messageId) => {
    try {
      await chatService.deleteConversation?.(messageId, user?.id)
      setMessages(prev => prev.filter(m => m.id !== messageId))
    } catch (err) {
      logger.error('ChatWindow: delete failed', err)
    }
  }

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <PaperAirplaneIcon className="h-8 w-8 text-green-500" />
          </div>
          <p className="text-gray-500 dark:text-gray-400">{t('chat.selectConversation', 'اختر محادثة للبدء')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 bg-white dark:bg-gray-900" data-testid="chat-window">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
        <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-sm font-semibold text-green-700 dark:text-green-300">
          {recipient?.full_name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-800 dark:text-gray-100 truncate">
            {recipient?.full_name || t('chat.unknownUser', 'مستخدم')}
          </p>
          <p className="text-xs text-gray-400">{recipient?.role || ''}</p>
        </div>
        <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
          <EllipsisVerticalIcon className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* Messages */}
      <div
        id="chat-messages-scroll"
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
          </div>
        ) : (
          <div id="scrollable-messages" className="flex flex-col gap-3 flex-1 overflow-y-auto">
            <InfiniteScroll
              dataLength={messages.length}
              next={loadMore}
              hasMore={hasMore}
              inverse
              scrollableTarget="scrollable-messages"
              loader={
                <div className="text-center py-2">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-green-500" />
                </div>
              }
              style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
            >
              {messages.map((msg, i) => {
                const isOwn = msg.sender_id === user?.id
                const prevMsg = messages[i - 1]
                const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id

                return (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isOwn={isOwn}
                    showAvatar={showAvatar}
                    onDelete={handleDelete}
                    onReply={setReplyTo}
                  />
                )
              })}
            </InfiniteScroll>
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Reply preview */}
      {replyTo && (
        <div className="mx-4 mb-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-r-lg flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-green-600">{replyTo.sender?.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{replyTo.content}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="p-1 shrink-0">
            <XMarkIcon className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      )}

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex items-center gap-2 px-4 pb-2 overflow-x-auto">
          {attachments.map((att, i) => (
            <FilePreview
              key={i}
              file={{ url: att.preview, type: att.type, name: att.name, size: att.size }}
              compact
              onRemove={() => removeAttachment(i)}
            />
          ))}
        </div>
      )}

      {/* Error */}
      {fileError && (
        <p className="px-4 pb-1 text-xs text-red-500">{fileError}</p>
      )}

      {/* Input bar */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
        <div className="flex items-end gap-2 bg-gray-100 dark:bg-gray-700 rounded-2xl px-3 py-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors shrink-0"
            title={t('chat.attach', 'إرفاق ملف')}
          >
            <PaperClipIcon className="h-5 w-5 text-gray-500" />
          </button>

          <textarea
            ref={inputRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={t('chat.typeMessage', 'اكتب رسالة...')}
            className="flex-1 bg-transparent resize-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 outline-none max-h-32 min-h-[20px]"
            data-testid="chat-input"
          />

          <button
            onClick={handleSend}
            disabled={sending || (!text.trim() && attachments.length === 0)}
            className="p-1.5 bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-full transition-colors shrink-0"
            data-testid="send-message-btn"
          >
            {sending
              ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              : <PaperAirplaneIcon className="h-5 w-5 text-white" />
            }
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        multiple
        className="hidden"
        onChange={e => handleFiles(Array.from(e.target.files || []))}
      />
    </div>
  )
})

export default ChatWindow
