/**
 * ErrorBoundary - التقاط أخطاء المكونات
 * 
 * يستخدم react-error-boundary لالتقاط الأخطاء التي تحدث في المكونات
 * وعرض واجهة بديلة (Fallback UI)
 */

import React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { useTranslation } from 'react-i18next';
import { logger } from '@/utils/logger';
import { logError } from '@/services/sentry';
import { recoverFromStaleAsset } from '@/utils/staleAssetRecovery';

const isChunkLoadError = (error) => {
  const message = String(error?.message || '').toLowerCase()
  return (
    message.includes('failed to fetch dynamically imported module')
    || message.includes('loading chunk')
    || message.includes('chunkloaderror')
  )
}

/**
 * مكون Fallback UI - يعرض عند حدوث خطأ
 */
export const ErrorFallback = ({ error, resetErrorBoundary }) => {
  const { t } = useTranslation()

  logger.error('Error caught by ErrorBoundary:', error);

  const chunkError = isChunkLoadError(error)

  React.useEffect(() => {
    if (!chunkError) return
    void recoverFromStaleAsset({ error, reason: 'error-boundary' })
  }, [chunkError, error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          {/* Icon */}
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4v2m0 0l-6-3m6 3l6-3"
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="mt-4 text-2xl font-bold text-gray-900">
            {t('errorBoundary.title', 'Something went wrong')}
          </h1>

          {/* Error Message */}
          <p className="mt-2 text-sm text-gray-500">
            {chunkError
              ? t('errorBoundary.chunkReloading', 'The app is trying to refresh automatically. If the problem persists, reload the page manually.')
              : t('errorBoundary.description', 'An unexpected application error occurred.')}
          </p>

          {/* Error Details (في بيئة Development فقط) */}
          {import.meta.env.DEV && (
            <div className="mt-4 p-4 bg-gray-100 rounded text-left">
              <p className="text-xs font-mono text-gray-700 break-words">
                <strong>{t('errorBoundary.errorLabel', 'Error:')}</strong> {error.message}
              </p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-bold text-gray-600">
                  {t('errorBoundary.fullDetails', 'Full details')}
                </summary>
                <pre className="mt-2 text-xs text-gray-600 overflow-auto max-h-40">
                  {error.stack}
                </pre>
              </details>
            </div>
          )}

          {/* Buttons */}
          <div className="mt-6 flex gap-4 justify-center">
            <button
              onClick={resetErrorBoundary}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              {t('errorBoundary.tryAgain', 'Try Again')}
            </button>
            <a
              href="/"
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition"
            >
              {t('errorBoundary.backHome', 'Back to Home')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * معالج الأخطاء - يتم استدعاؤه عند التقاط خطأ
 */
const handleError = (error, errorInfo) => {
  logger.error('=== ErrorBoundary Caught Error ===');
  logger.error('Message:', error.message);
  logger.error('Component Stack:', errorInfo.componentStack);
  logger.error('Full Stack:', error.stack);

  logError(error, {
    tags: { source: 'error-boundary' },
    extra: {
      componentStack: errorInfo.componentStack,
      stack: error.stack,
    },
  })
};

/**
 * مكون ErrorBoundary الرئيسي
 */
export const ErrorBoundary = ({ children }) => {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
      onReset={() => {
        // Let the boundary retry rendering in place.
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
};

/**
 * HOC للـ ErrorBoundary - للاستخدام مع المكونات
 */
export const withErrorBoundary = (Component) => {
  return (props) => (
    <ErrorBoundary>
      <Component {...props} />
    </ErrorBoundary>
  );
};

export default ErrorBoundary;
