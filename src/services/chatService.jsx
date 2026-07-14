import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/services/supabase'
import { withRetry } from '@/utils/withRetry'
import { logger } from '@/utils/logger'
import { sanitizeText } from '@/utils/sanitization'
import { enforceRateLimit, checkChatMessageSendRate, checkChatConversationCreateRate, checkChatFileUploadRate } from '@/utils/rateLimiter'
import toast from 'react-hot-toast'

/**
 * Chat Service
 * Real-time messaging between buyers and vendors
 */
class ChatService {
  constructor() {
    this.channels = new Map()
  }

  /**
   * Get or create conversation between two users
   */
  async getOrCreateConversation(userId1, userId2, _context = {}) {
    // Rate limit: 10 conversations per hour per user
    enforceRateLimit(checkChatConversationCreateRate, userId1)

    return withRetry(async () => {
      // Check if a direct conversation already exists between these two users
      // via conversation_participants join table
      const { data: existing } = await supabase
        .from('conversations')
        .select('id, type, title, created_by')
        .eq('type', 'direct')
        .in('id', (
          supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', userId1)
        ))
        .maybeSingle()

      // Verify the other user is also a participant
      if (existing) {
        const { data: participantCheck } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('conversation_id', existing.id)
          .eq('user_id', userId2)
          .maybeSingle()

        if (participantCheck) {
          return existing
        }
      }

      // Create new conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: 'direct',
          created_by: userId1,
        })
        .select('id, type, title, created_by')
        .single()

      if (convError) throw convError

      // Add both users as participants
      const { error: participantError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: conversation.id, user_id: userId1 },
          { conversation_id: conversation.id, user_id: userId2 },
        ])

      if (participantError) throw participantError

      return conversation
    }, { maxRetries: 2, baseDelay: 500 })
  }

  /**
   * Send message - with retry logic
   */
  async sendMessage(
    conversationIdOrPayload,
    senderIdArg,
    contentArg,
    attachmentsArg = [],
    _authToken = null
  ) {
    const payload =
      typeof conversationIdOrPayload === 'object' && conversationIdOrPayload !== null
        ? conversationIdOrPayload
        : {
            conversationId: conversationIdOrPayload,
            senderId: senderIdArg,
            content: contentArg,
            attachments: attachmentsArg,
          }

    const {
      conversationId,
      senderId,
      content,
      attachments = [],
    } = payload

    // Sanitize content to prevent XSS
    const sanitizedContent = sanitizeText(String(content || ''), { maxLength: 5000, allowNewlines: true, collapseWhitespace: false }).trim()

    // Rate limit: 30 messages per 10 minutes per sender
    enforceRateLimit(checkChatMessageSendRate, senderId)

    return withRetry(async () => {
      const { data: message, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content: sanitizedContent,
          attachments,
          is_read: false,
        })
        .select('id, conversation_id, sender_id, content, created_at')
        .single()

      if (error) throw error

      // Update conversation last message - fire and forget
      supabase
        .from('conversations')
        .update({
          last_message: sanitizedContent.substring(0, 100),
          last_message_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
        .then(({ error: updateError }) => {
          if (updateError) logger.error('Failed to update conversation last_message:', updateError)
        })

      return message
    }, { maxRetries: 2, baseDelay: 500 })
  }

  /**
   * Get conversation messages - Optimized: selective columns
   */
  async getMessages(conversationId, { limit = 50, before } = {}) {
    return withRetry(async () => {
      let query = supabase
        .from('messages')
        .select(`
          id, conversation_id, sender_id, content, created_at, is_read,
          sender:profiles(id, first_name, last_name, avatar_url)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (before) {
        query = query.lt('created_at', before)
      }

      const { data, error } = await query
      if (error) throw error
      return data?.reverse() || []
    }, { maxRetries: 2, baseDelay: 500 })
  }

  /**
   * Get user conversations - Optimized: pagination + flatten unread count
   */
  async getUserConversations(userId, filters = {}) {
    return withRetry(async () => {
      // Pagination: default 50, max 200
      const limit = Math.min(filters.limit || 50, 200)

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id, participant_1_id, participant_2_id, last_message, last_message_at, context_type, context_id,
          participant_1:profiles!participant_1_id(id, first_name, last_name, avatar_url),
          participant_2:profiles!participant_2_id(id, first_name, last_name, avatar_url)
        `)
        .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
        .order('last_message_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    }, { maxRetries: 2, baseDelay: 500 })
  }

  /**
   * Mark messages as read - with retry
   */
  async markMessagesAsRead(conversationId, userId) {
    return withRetry(async () => {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .eq('is_read', false)

      if (error) throw error
    }, { maxRetries: 2, baseDelay: 500 })
  }

  /**
   * Subscribe to conversation updates
   */
  subscribeToConversation(conversationId, callback) {
    const channelName = `conversation:${conversationId}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          logger.info('New message:', payload)
          callback(payload.new)
        }
      )
      .subscribe()

    this.channels.set(channelName, channel)

    return () => {
      supabase.removeChannel(channel)
      this.channels.delete(channelName)
    }
  }

  /**
   * Upload message attachment - with validation and retry
   */
  static MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB (unified with ChatWindow.jsx)

  static ALLOWED_MIME_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm',
    'audio/mpeg', 'audio/wav', 'audio/ogg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]

  static BLOCKED_EXTENSIONS = [
    'exe', 'bat', 'cmd', 'sh', 'ps1', 'msi', 'dll', 'com', 'scr',
    'vbs', 'js', 'jsx', 'ts', 'tsx', 'php', 'py', 'rb', 'pl',
    'jar', 'class', 'war', 'ear',
  ]

  validateFile(file) {
    if (!file || !(file instanceof File)) {
      throw new Error('Invalid file')
    }

    // Check file size
    if (file.size > ChatService.MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${ChatService.MAX_FILE_SIZE / (1024 * 1024)}MB`)
    }

    if (file.size === 0) {
      throw new Error('File is empty')
    }

    // Check MIME type
    if (!ChatService.ALLOWED_MIME_TYPES.some(type => file.type === type || (type.endsWith('/*') && file.type.startsWith(type.replace('/*', '/'))))) {
      throw new Error(`File type "${file.type || 'unknown'}" is not allowed`)
    }

    // Check extension against blocklist
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ChatService.BLOCKED_EXTENSIONS.includes(ext)) {
      throw new Error(`File extension ".${ext}" is not allowed`)
    }

    return true
  }

  async uploadAttachment(file, conversationId) {
    // Validate file before upload
    this.validateFile(file)

    // Rate limit: 20 uploads per hour per conversation
    enforceRateLimit(checkChatFileUploadRate, conversationId)

    return withRetry(async () => {
      const fileExt = file.name.split('.').pop()
      const fileName = `${conversationId}/${Date.now()}.${fileExt}`

      const { data: _data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, file)

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(fileName)

      return {
        url: publicUrl,
        name: file.name,
        type: file.type,
        size: file.size,
      }
    }, { maxRetries: 2, baseDelay: 500 })
  }

  /**
   * Delete conversation - with retry
   */
  async deleteConversation(conversationId, userId) {
    return withRetry(async () => {
      // Check user is participant
      const { data: conversation } = await supabase
        .from('conversations')
        .select('id, participant_1_id, participant_2_id')
        .eq('id', conversationId)
        .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
        .single()

      if (!conversation) {
        throw new Error('Unauthorized')
      }

      // Delete messages then conversation
      const { error: msgError } = await supabase
        .from('messages')
        .delete()
        .eq('conversation_id', conversationId)

      if (msgError) throw msgError

      const { error: convError } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId)

      if (convError) throw convError
    }, { maxRetries: 2, baseDelay: 500 })
  }
}

export const chatService = new ChatService()

/**
 * Chat Component
 * Ready-to-use chat interface
 */
export const ChatComponent = ({ conversationId, otherUser, currentUserId }) => {
  const userId = currentUserId || null
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Load messages
  useEffect(() => {
    if (!conversationId) return

    const loadMessages = async () => {
      setLoading(true)
      try {
        const msgs = await chatService.getMessages(conversationId)
        setMessages(msgs)
      } catch (error) {
        logger.error('Error loading messages:', error)
        toast.error('فشل في تحميل الرسائل')
      } finally {
        setLoading(false)
      }
    }

    loadMessages()
    chatService.markMessagesAsRead(conversationId, userId)
  }, [conversationId, userId])

  // Subscribe to new messages
  useEffect(() => {
    if (!conversationId) return

    const unsubscribe = chatService.subscribeToConversation(
      conversationId,
      (message) => {
        setMessages(prev => [...prev, message])
      }
    )

    return () => unsubscribe()
  }, [conversationId])

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send message
  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      await chatService.sendMessage(
        conversationId,
        userId,
        newMessage
      )
      setNewMessage('')
      inputRef.current?.focus()
    } catch (error) {
      logger.error('Error sending message:', error)
      toast.error('فشل في إرسال الرسالة')
    } finally {
      setSending(false)
    }
  }, [newMessage, sending, conversationId, userId])

  // Handle enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!conversationId) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        اختر محادثة للبدء
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[500px] bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
            <span className="text-white font-bold">
              {otherUser?.first_name?.[0]}{otherUser?.last_name?.[0] || '?'}
            </span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">
              {otherUser ? `${otherUser.first_name} ${otherUser.last_name}` : 'المستخدم'}
            </p>
            <p className="text-xs text-green-600">متصل الآن</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            لا توجد رسائل بعد. ابدأ المحادثة!
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.sender_id === userId
            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                    isOwn
                      ? 'bg-green-500 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
                  <p className={`text-xs mt-1 ${isOwn ? 'text-green-100' : 'text-gray-500'}`}>
                    {new Date(message.created_at).toLocaleTimeString('ar-MA', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="اكتب رسالتك..."
            className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            rows={1}
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="px-6 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? '...' : 'إرسال'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default chatService
