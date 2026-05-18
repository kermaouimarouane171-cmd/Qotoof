import React from 'react'
import ReactDOM from 'react-dom/client'
import { StrictMode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { Toaster, toast } from 'react-hot-toast'
import { HelmetProvider } from 'react-helmet-async'
import * as Sentry from '@sentry/react'
import { registerSW } from 'virtual:pwa-register'
import ErrorBoundary from './components/ErrorBoundary'
import { SkipLink } from './utils/accessibility.jsx'
import App from './App'
import i18n from './i18n'
import './index.css'

// ============================================
// INITIALIZE SECURITY & PERFORMANCE
// ============================================

import { logger } from './utils/logger.js'
import { logError } from './services/sentry'
import { sentryDsnLooksIssued } from './utils/envValidators'
import { initConfig } from './lib/config'
import { configurePendingUpdateActivator, recoverFromStaleAsset } from './utils/staleAssetRecovery'

logger.log('[ENTRY] main.jsx loaded — starting app initialization')

const RootMode = import.meta.env.DEV ? React.Fragment : StrictMode

const sentryDsn = typeof import.meta.env.VITE_SENTRY_DSN === 'string'
  ? import.meta.env.VITE_SENTRY_DSN.trim()
  : ''

const hasValidSentryDsn = sentryDsnLooksIssued(sentryDsn)

if (hasValidSentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
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

let updateToastId = null

const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    if (updateToastId) return

    updateToastId = toast.custom((currentToast) => (
      <div className="max-w-md rounded-2xl border border-green-200 bg-white p-4 shadow-xl">
        <p className="text-sm font-semibold text-gray-900">A new version of Qotoof is ready.</p>
        <p className="mt-1 text-sm text-gray-600">Refresh now to load the latest assets and avoid stale pages.</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white"
            onClick={async () => {
              toast.dismiss(currentToast.id)
              updateToastId = null
              await updateServiceWorker(true)
            }}
          >
            Refresh now
          </button>
          <button
            type="button"
            className="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700"
            onClick={() => {
              toast.dismiss(currentToast.id)
              updateToastId = null
            }}
          >
            Later
          </button>
        </div>
      </div>
    ), { duration: Infinity, id: 'app-update-ready' })
  },
  onOfflineReady() {
    toast.success('Offline assets are ready for this device.', { id: 'offline-ready' })
  },
})

configurePendingUpdateActivator(async () => {
  await updateServiceWorker(true)
})

// ============================================
// RENDER APPLICATION
// ============================================

const renderApp = async () => {
  try {
    await initConfig()
  } catch (error) {
    logger.warn('Failed to initialize public config before render, continuing with fallbacks:', error)
  }

  ReactDOM.createRoot(document.getElementById('root')).render(
    <RootMode>
      <HelmetProvider>
      <BrowserRouter>
        <ErrorBoundary>
          {/* Skip Link for keyboard users */}
          <SkipLink target="#main-content" />

          <Sentry.ErrorBoundary fallback={<p className="p-4 text-red-600">{i18n.t('errorBoundary.sentryFallback', 'An unexpected error occurred. Please refresh the page.')}</p>}>
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
    </RootMode>,
  )
}

renderApp()

const handleRuntimeFailure = async (error, source, extra = {}) => {
  const recovered = await recoverFromStaleAsset({ error, reason: source })
  if (recovered) return

  if (import.meta.env.DEV) {
    console.error(`[${source}]`, error?.stack || error, extra)
  }

  logError(error instanceof Error ? error : new Error(String(error)), {
    tags: { source },
    extra,
  })
}

// 🚨 GLOBAL ERROR & REJECTION HANDLERS — for terminal visibility
window.addEventListener('error', (event) => {
  void handleRuntimeFailure(event.error || new Error(event.message), 'window.error', {
    file: event.filename,
    line: event.lineno,
    col: event.colno,
  })
})

window.addEventListener('unhandledrejection', (event) => {
  void handleRuntimeFailure(event.reason, 'window.unhandledrejection')
})

