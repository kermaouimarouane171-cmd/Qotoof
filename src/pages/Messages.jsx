import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Card, LoadingSpinner } from '@/components/ui'
import { supabase } from '@/services/supabase'
import { chatService } from '@/services/chatService'
import toast from 'react-hot-toast'
import {
  ArrowLeftIcon,
  PaperAirplaneIcon,
  MagnifyingGlassIcon,
  ChatBubbleLeftRightIcon,
  PhoneIcon,
  CheckIcon,
  CheckCircleIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline'
import { logger } from '@/utils/logger'

// ============================================
// Messages Inbox
// ============================================

const MessagesInbox = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const loadConversations = useCallback(async () => {
    setLoading(true)
    try {
      const convos = await chatService.getUserConversations(user.id)
      setConversations(convos || [])
    } catch (error) {
      logger.error('Error loading conversations:', error)
      toast.error(t('messages.errors.loadFailed', 'Failed to load messages'))
    } finally {
      setLoading(false)
    }
  }, [user?.id, t])

  useEffect(() => {
    if (user?.id) {
      loadConversations()
    }
  }, [user?.id, loadConversations])

  const filteredConversations = conversations.filter(c => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return c.other_user_name?.toLowerCase().includes(q) ||
           c.last_message?.toLowerCase().includes(q)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('messages.inbox.title', 'Messages')}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('messages.inbox.conversationCount', '{{count}} conversation', { count: conversations.length })}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder={t('messages.inbox.searchPlaceholder', 'Search conversations...')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-12 pr-4 py-3"
          aria-label="Search messages"
        />
      </div>

      {/* Conversations List */}
      {filteredConversations.length === 0 ? (
        <Card className="p-12 text-center">
          <ChatBubbleLeftRightIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('messages.inbox.empty.title', 'No messages yet')}</h3>
          <p className="text-gray-500 mb-6">{t('messages.inbox.empty.description', 'Start a conversation with a vendor from their store page')}</p>
          <button
            onClick={() => navigate('/marketplace')}
            className="btn-primary inline-flex items-center gap-2"
          >
            <BuildingStorefrontIcon className="w-5 h-5" />
            {t('messages.inbox.empty.browseStores', 'Browse Stores')}
          </button>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredConversations.map((convo) => (
            <Card
              key={convo.id}
              className="p-4 cursor-pointer hover:shadow-md transition-all border border-gray-100 hover:border-green-200"
              onClick={() => navigate(`/messages/${convo.id}`)}
            >
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                  {convo.other_user_avatar ? (
                    <img src={convo.other_user_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <span className="text-white font-bold text-lg">
                      {(convo.other_user_name || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {convo.other_user_name || 'Unknown'}
                    </h3>
                    {convo.last_message_at && (
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {timeAgo(convo.last_message_at, t)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-sm truncate ${convo.unread_count > 0 ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                      {convo.last_message || 'Start a conversation...'}
                    </p>
                    {convo.unread_count > 0 && (
                      <span className="ml-2 w-5 h-5 bg-green-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                        {convo.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================
// Conversation View
// ============================================

const ConversationView = () => {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [messages, setMessages] = useState([])
  const [conversation, setConversation] = useState(null)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef(null)
  const channelRef = useRef(null)

  const loadConversation = useCallback(async () => {
    setLoading(true)
    try {
      const [msgs, convo] = await Promise.all([
        chatService.getMessages(id, { limit: 100 }),
        (async () => {
          const { data } = await supabase
            .from('conversations')
            .select(`
              *,
              participants:conversation_participants(
                user:profiles(id, first_name, last_name, avatar_url, phone, store_name)
              )
            `)
            .eq('id', id)
            .single()
          return data
        })(),
      ])

      setMessages(msgs || [])
      setConversation(convo)
    } catch (error) {
      logger.error('Error loading conversation:', error)
      toast.error(t('messages.errors.loadConversation', 'Failed to load conversation'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    if (id) loadConversation()
  }, [id, loadConversation])

  // Real-time subscription
  useEffect(() => {
    if (!id) return

    channelRef.current = chatService.subscribeToConversation(
      id,
      (payload) => {
        if (payload.eventType === 'INSERT') {
          setMessages(prev => [...prev, payload.new])
          scrollToBottom()
        }
      }
    )

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }
    }
  }, [id])

  // Mark as read
  useEffect(() => {
    if (id && user?.id) {
      chatService.markMessagesAsRead(id, user.id)
    }
  }, [id, user?.id])

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      await chatService.sendMessage(id, user.id, newMessage.trim())
      setNewMessage('')
    } catch (error) {
      logger.error('Error sending message:', error)
      toast.error(t('messages.errors.sendFailed', 'Failed to send message'))
    } finally {
      setSending(false)
    }
  }

  const otherUser = conversation?.participants?.find(p => p.user?.id !== user.id)?.user

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <Card className="p-4 mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/messages')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Back to messages"
          >
            <ArrowLeftIcon className="w-5 h-5 text-gray-600" />
          </button>

          {otherUser && (
            <>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                {otherUser.avatar_url ? (
                  <img src={otherUser.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <span className="text-white font-bold">
                    {(otherUser.first_name || '?').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-gray-900 truncate">
                  {otherUser.store_name || `${otherUser.first_name} ${otherUser.last_name}`}
                </h2>
                <p className="text-xs text-gray-500">{t('messages.conversation.vendorLabel', 'Vendor')}</p>
              </div>
              {otherUser.phone && (
                <a
                  href={`tel:${otherUser.phone}`}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                  aria-label="Call vendor"
                >
                  <PhoneIcon className="w-5 h-5" />
                </a>
              )}
            </>
          )}
        </div>
      </Card>

      {/* Messages */}
      <Card className="flex-1 overflow-y-auto p-4 mb-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">{t('messages.conversation.emptyText', 'No messages yet. Start the conversation!')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => {
              const isMine = msg.sender_id === user.id
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] sm:max-w-[60%] ${isMine ? 'order-1' : ''}`}>
                    <div className={`px-4 py-2.5 rounded-2xl ${
                      isMine
                        ? 'bg-green-600 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-900 rounded-bl-md'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                    <div className={`flex items-center gap-1 mt-1 px-1 ${isMine ? 'justify-end' : ''}`}>
                      <span className="text-[10px] text-gray-400">
                        {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMine && (
                        msg.is_read ? (
                          <CheckCircleIcon className="w-3 h-3 text-blue-500" />
                        ) : (
                          <CheckIcon className="w-3 h-3 text-gray-400" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </Card>

      {/* Message Input */}
      <form onSubmit={handleSend} className="flex items-center gap-3 flex-shrink-0">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={t('messages.conversation.typeMessage', 'Type a message...')}
          className="input flex-1 py-3"
          aria-label="Message input"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="w-12 h-12 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors"
          aria-label="Send message"
        >
          {sending ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <PaperAirplaneIcon className="w-5 h-5" />
          )}
        </button>
      </form>
    </div>
  )
}

// ============================================
// Helper
// ============================================

const timeAgo = (dateString, t) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return t('messages.timeAgo.now', 'Now')
  if (diffMins < 60) return `${diffMins}${t('messages.timeAgo.minutes', 'm')}`
  if (diffHours < 24) return `${diffHours}${t('messages.timeAgo.hours', 'h')}`
  if (diffDays < 7) return `${diffDays}${t('messages.timeAgo.days', 'd')}`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ============================================
// Export
// ============================================

export { MessagesInbox, ConversationView }
export default MessagesInbox
