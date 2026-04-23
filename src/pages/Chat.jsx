import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useAuthStore } from '@/store/authStore'
import { chatService } from '@/services/chatService'
import { logger } from '@/utils/logger'
import ChatList from '@/components/Chat/ChatList'
import ChatWindow from '@/components/Chat/ChatWindow'

export default function Chat() {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const [conversations, setConversations] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [recipient, setRecipient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mobileShowWindow, setMobileShowWindow] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    loadConversations()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadConversations = async () => {
    try {
      const data = await chatService.getUserConversations(user.id)
      setConversations(data || [])
    } catch (err) {
      logger.error('Chat: failed to load conversations', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectConversation = (conversation) => {
    setSelectedId(conversation.id)

    // Determine recipient (the other participant)
    const other = conversation.participant1_id === user.id
      ? conversation.participant2
      : conversation.participant1
    setRecipient(other)

    // Mobile: show chat window panel
    setMobileShowWindow(true)

    // Mark as read
    chatService.markMessagesAsRead(conversation.id, user.id).catch(() => {})

    // Update local unread count
    setConversations(prev =>
      prev.map(c => c.id === conversation.id ? { ...c, unread_count: 0 } : c)
    )
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-white dark:bg-gray-900" data-testid="chat-page">
      {/* Conversation list — hidden on mobile when window is shown */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-gray-200 dark:border-gray-700 flex-shrink-0 ${mobileShowWindow ? 'hidden md:flex' : 'flex'} flex-col`}>
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('chat.title', 'المحادثات')}
          </h1>
        </div>
        <ChatList
          conversations={conversations}
          selectedId={selectedId}
          onSelect={handleSelectConversation}
          loading={loading}
        />
      </div>

      {/* Chat window — takes full width on mobile */}
      <div className={`flex-1 flex flex-col min-w-0 ${mobileShowWindow ? 'flex' : 'hidden md:flex'}`}>
        {/* Mobile back button */}
        {mobileShowWindow && (
          <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <button
              onClick={() => setMobileShowWindow(false)}
              className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        )}

        <ChatWindow conversationId={selectedId} recipient={recipient} />
      </div>
    </div>
  )
}
