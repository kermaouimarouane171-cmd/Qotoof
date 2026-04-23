import { useState, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/store/authStore'
import { formatDistanceToNow } from 'date-fns'
import { ar, fr, enUS } from 'date-fns/locale'
import { MagnifyingGlassIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'

const localeMap = { ar, fr, en: enUS }

function formatTime(dateStr) {
  try {
    const date = new Date(dateStr)
    return formatDistanceToNow(date, { addSuffix: true, locale: localeMap['ar'] })
  } catch { return '' }
}

/**
 * ChatList - Left panel showing all conversations
 */
const ChatList = memo(function ChatList({ conversations = [], selectedId, onSelect, loading }) {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [search, setSearch] = useState('')

  const filtered = conversations.filter(conv => {
    const other = conv.participant_1_id === user?.id ? conv.participant_2 : conv.participant_1
    const name = `${other?.first_name || ''} ${other?.last_name || ''}`.toLowerCase()
    return name.includes(search.toLowerCase()) || (conv.last_message || '').toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="flex flex-col h-full border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          {t('chat.conversations', 'المحادثات')}
        </h2>
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('chat.search', 'ابحث...')}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-3 p-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <ChatBubbleLeftRightIcon className="h-12 w-12 mb-2" />
            <p className="text-sm">{t('chat.empty', 'لا توجد محادثات')}</p>
          </div>
        ) : (
          filtered.map(conv => {
            const other = conv.participant_1_id === user?.id ? conv.participant_2 : conv.participant_1
            const otherName = `${other?.first_name || ''} ${other?.last_name || ''}`.trim() || t('chat.unknownUser', 'مستخدم')
            const isSelected = conv.id === selectedId
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                data-testid="conversation-item"
                className={`w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  isSelected ? 'bg-green-50 dark:bg-green-900/20 border-r-4 border-green-500' : ''
                }`}
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  {other?.avatar_url ? (
                    <img src={other.avatar_url} alt={otherName} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-700 dark:text-green-300 font-semibold text-lg">
                      {otherName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-sm font-medium truncate ${isSelected ? 'text-green-700 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                      {otherName}
                    </span>
                    {conv.last_message_at && (
                      <span className="text-xs text-gray-400 shrink-0 ml-2">
                        {formatTime(conv.last_message_at)}
                      </span>
                    )}
                  </div>
                  <p className={`text-xs truncate ${conv.unread_count > 0 ? 'text-gray-900 dark:text-white font-medium' : 'text-gray-400'}`}>
                    {conv.last_message || t('chat.noMessages', 'ابدأ المحادثة')}
                  </p>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
})

export default ChatList
