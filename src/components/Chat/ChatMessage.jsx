import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CheckIcon,
  CheckCircleIcon,
  TrashIcon,
  ArrowUturnLeftIcon
} from '@heroicons/react/24/outline'
import FilePreview from './FilePreview'
import { format } from 'date-fns'

const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  showAvatar,
  onDelete,
  onReply
}) {
  const { t } = useTranslation()

  const { content, created_at, is_read, attachments, sender } = message

  const timeStr = created_at
    ? format(new Date(created_at), 'HH:mm')
    : ''

  const handleDownload = (url, name) => {
    const a = document.createElement('a')
    a.href = url
    a.download = name || 'download'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div
      className={`flex items-end gap-2 group ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
      data-testid="chat-message"
    >
      {/* Avatar */}
      {showAvatar ? (
        <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-medium text-green-700 dark:text-green-300 shrink-0 mb-1">
          {sender?.full_name?.[0]?.toUpperCase() || '?'}
        </div>
      ) : (
        <div className="w-7 shrink-0" />
      )}

      {/* Bubble */}
      <div className={`relative max-w-[70%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {/* Sender name for group-like contexts */}
        {!isOwn && showAvatar && (
          <span className="text-xs text-gray-400 dark:text-gray-500 px-1">
            {sender?.full_name || t('chat.unknownUser', 'مستخدم مجهول')}
          </span>
        )}

        {/* Attachments */}
        {attachments?.length > 0 && (
          <div className="flex flex-col gap-2">
            {attachments.map((file, i) => (
              <FilePreview
                key={i}
                file={file}
                compact
                onDownload={() => handleDownload(file.url, file.name)}
              />
            ))}
          </div>
        )}

        {/* Text content */}
        {content && (
          <div
            className={`relative px-4 py-2.5 rounded-2xl text-sm break-words whitespace-pre-wrap ${
              isOwn
                ? 'bg-green-500 text-white rounded-br-sm'
                : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm rounded-bl-sm'
            }`}
          >
            {content}

            {/* Time + read receipt */}
            <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <span className={`text-[10px] ${isOwn ? 'text-green-100' : 'text-gray-400'}`}>
                {timeStr}
              </span>
              {isOwn && (
                is_read
                  ? <CheckCircleIcon className="h-3.5 w-3.5 text-green-100" />
                  : <CheckIcon className="h-3.5 w-3.5 text-green-200" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hover actions */}
      <div className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mb-1 ${isOwn ? 'mr-1' : 'ml-1'}`}>
        <button
          onClick={() => onReply?.(message)}
          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600"
          title={t('chat.reply', 'رد')}
        >
          <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
        </button>
        {isOwn && onDelete && (
          <button
            onClick={() => onDelete(message.id)}
            className="p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"
            title={t('chat.delete', 'حذف')}
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
})

export default MessageBubble
