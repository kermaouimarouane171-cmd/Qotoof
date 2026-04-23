import React from 'react'
import ReactDOM from 'react-dom/client'
import { StrictMode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { HelmetProvider } from 'react-helmet-async'
import * as Sentry from '@sentry/react'
import ErrorBoundary from './components/ErrorBoundary'
import { SkipLink } from './utils/accessibility.jsx'
import App from './App'
import './i18n'
import './index.css'

// ============================================
// INITIALIZE SECURITY & PERFORMANCE
// ============================================

import { logger } from './utils/logger.js'
import { logError } from './services/sentry'

logger.log('[ENTRY] main.jsx loaded — starting app initialization')

const sentryDsn = typeof import.meta.env.VITE_SENTRY_DSN === 'string'
  ? import.meta.env.VITE_SENTRY_DSN.trim()
  : ''

const hasValidSentryDsn = /^https?:\/\/[^\s@]+@[^\s/]+\/\d+/i.test(sentryDsn)

if (hasValidSentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 1.0,
    enabled: import.meta.env.PROD,
  })
} else if (sentryDsn && import.meta.env.DEV) {
  logger.warn('Skipping Sentry initialization because the configured DSN is invalid')
}

// Initialize security headers
import { initializeSecurity } from './utils/securityHeaders'
try {
  initializeSecurity()
} catch (error) {
  console.error('Security initialization failed:', error)
}

// Initialize performance monitoring
import { initializePerformance } from './utils/performance.jsx'
try {
  initializePerformance()
} catch (error) {
  console.error('Performance initialization failed:', error)
}

// Initialize privacy-friendly analytics
import { initializeAllAnalytics } from './services/analytics'
try {
  initializeAllAnalytics()
} catch (error) {
  console.error('Analytics initialization failed:', error)
}

// Log initialization in dev
if (import.meta.env.DEV) {
  logger.log('🚀 Qotoof initialized with enhanced security & performance')
  logger.log('🔍 Sentry monitoring:', import.meta.env.PROD ? 'enabled' : 'disabled (dev mode)')
  logger.log('📊 Analytics:', import.meta.env.PROD ? 'enabled' : 'disabled (dev mode)')
}

// ============================================
// RENDER APPLICATION
// ============================================

ReactDOM.createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
    <BrowserRouter>
      <ErrorBoundary>
        {/* Skip Link for keyboard users */}
        <SkipLink target="#main-content" />

        <Sentry.ErrorBoundary fallback={<p className="p-4 text-red-600">حدث خطأ غير متوقع. حاول تحديث الصفحة.</p>}>
          <App />
        </Sentry.ErrorBoundary>

        {/* Global Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#fff',
              color: '#374151',
              borderRadius: '12px',
              padding: '12px 16px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
              maxWidth: '500px',
            },
            success: {
              iconTheme: {
                primary: '#16a34a',
                secondary: '#fff',
              },
              duration: 2000,
            },
            error: {
              iconTheme: {
                primary: '#dc2626',
                secondary: '#fff',
              },
              duration: 4000,
            },
            warning: {
              iconTheme: {
                primary: '#f59e0b',
                secondary: '#fff',
              },
              duration: 3500,
            },
          }}
        />
      </ErrorBoundary>
    </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
)

// 🚨 GLOBAL ERROR & REJECTION HANDLERS — for terminal visibility
if (import.meta.env.DEV) {
  window.addEventListener('error', (e) => {
    console.error('[خطأ عام في المتصفح]', e.error?.stack || e.message, 'في', e.filename || 'غير معروف', ':', e.lineno || '?', e.colno || '?')
    logError(e.error || new Error(e.message), {
      tags: { source: 'window.error' },
      extra: { file: e.filename, line: e.lineno, col: e.colno },
    })
  })
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[رفض Promise غير معالج]', e.reason?.stack || e.reason)
    logError(e.reason instanceof Error ? e.reason : new Error(String(e.reason)), {
      tags: { source: 'window.unhandledrejection' },
    })
  })
}

// ⚠️ DEV-ONLY: Log lazy loading failures (safe implementation)
if (import.meta.env.DEV) {
  const originalLazy = React.lazy
  React.lazy = function (factory) {
    return originalLazy(() =>
      factory().catch((err) => {
        console.error('[LAZY IMPORT FAILED]', factory.toString().match(/\.(\w+\.jsx?|\w+\.tsx?)/)?.[1] || 'unknown', err)
        throw err
      })
    )
  }
}
