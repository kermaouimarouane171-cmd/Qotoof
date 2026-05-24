import React from 'react'
import { ArrowLeftIcon, ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

const ErrorState = ({
  error,
  title = 'Something went wrong',
  description,
  onRetry,
  onGoBack,
  retryLabel = 'Try again',
  backLabel = 'Go back',
  className = '',
}) => {
  const message = typeof error === 'string' ? error : error?.message

  return (
    <div className={`rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center shadow-sm dark:border-red-900/40 dark:bg-red-950/40 ${className}`}>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">
        <ExclamationTriangleIcon className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-gray-600 dark:text-gray-300">
        {description || message || 'An unexpected error occurred.'}
      </p>
      {(onRetry || onGoBack) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              <ArrowPathIcon className="h-4 w-4" />
              {retryLabel}
            </button>
          )}
          {onGoBack && (
            <button
              type="button"
              onClick={onGoBack}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              {backLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default ErrorState