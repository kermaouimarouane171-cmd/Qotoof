import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { DocumentIcon, ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { PhotoIcon, MusicalNoteIcon } from '@heroicons/react/24/solid'

/**
 * FilePreview - Renders file attachment previews inside chat messages
 */
const FilePreview = memo(function FilePreview({ file, onDownload, onRemove, compact = false }) {
  const { t } = useTranslation()
  const { url, type, name, size } = file || {}

  const formatSize = (bytes) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const isImage = type?.startsWith('image/')
  const isVideo = type?.startsWith('video/')
  const isAudio = type?.startsWith('audio/')
  const isPDF = type === 'application/pdf'

  return (
    <div className={`relative group rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 ${compact ? 'max-w-[200px]' : 'max-w-xs'}`}>
      {/* Remove button (before send) */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-1 right-1 z-10 p-0.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label={t('common.remove', 'إزالة')}
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      )}

      {isImage && (
        <div>
          <button
            type="button"
            className="w-full p-0 border-0 bg-transparent cursor-pointer"
            onClick={() => window.open(url, '_blank')}
            aria-label={name || 'open image'}
          >
            <img
              src={url}
              alt={name || t('chat.image', 'صورة')}
              className="w-full max-h-48 object-cover hover:opacity-90 transition-opacity"
            />
          </button>
          {!compact && (
            <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800">
              <span className="text-xs text-gray-500 truncate">{name}</span>
              {onDownload && (
                <button onClick={onDownload} className="p-1 hover:text-green-600 text-gray-400 shrink-0">
                  <ArrowDownTrayIcon className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {isVideo && (
        <div>
          <video src={url} controls className="w-full max-h-48">
            <track kind="captions" />
          </video>
          <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800">
            <span className="text-xs text-gray-500 truncate">{name}</span>
            {onDownload && (
              <button onClick={onDownload} className="p-1 hover:text-green-600 text-gray-400">
                <ArrowDownTrayIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {isAudio && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 flex items-center gap-2">
          <MusicalNoteIcon className="h-8 w-8 text-green-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-700 dark:text-gray-300 truncate">{name}</p>
            <audio src={url} controls className="w-full mt-1 h-8">
              <track kind="captions" />
            </audio>
          </div>
        </div>
      )}

      {isPDF && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <DocumentIcon className="h-6 w-6 text-red-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{name}</p>
            <p className="text-xs text-gray-400">{formatSize(size)}</p>
          </div>
          <ArrowDownTrayIcon className="h-4 w-4 text-gray-400 shrink-0 ml-auto" />
        </a>
      )}

      {!isImage && !isVideo && !isAudio && !isPDF && (
        <a
          href={url}
          download={name}
          className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <PhotoIcon className="h-6 w-6 text-blue-500" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{name}</p>
            <p className="text-xs text-gray-400">{formatSize(size)}</p>
          </div>
        </a>
      )}
    </div>
  )
})

export default FilePreview
