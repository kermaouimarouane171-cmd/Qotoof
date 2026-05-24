/**
 * Sentry Error Monitoring Setup
 * Captures and reports errors in production.
 *
 * @sentry/react is loaded lazily via dynamic import so its ~800 kB bundle
 * does NOT block the initial page load. The module reference is stored
 * in `_sentry` once the async init completes.
 */

/** @type {import('@sentry/react') | null} Lazily resolved Sentry module */
let _sentry = null

import { sentryDsnLooksIssued } from '@/utils/envValidators'
import { logger } from '@/utils/logger'

/**
 * Initialize Sentry asynchronously.
 * Loads @sentry/react only when a DSN is configured and we're in production.
 * Call this in main.jsx — non-blocking.
 */
export const initSentry = async () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  const isProduction = import.meta.env.PROD

  if (!sentryDsnLooksIssued(dsn)) {
    console.warn('Sentry DSN not configured. Error monitoring disabled.')
    return
  }

  try {
    // Dynamic import keeps @sentry/react out of the initial bundle
    const Sentry = await import('@sentry/react')
    _sentry = Sentry

    Sentry.init({
      dsn,
      environment: isProduction ? 'production' : 'development',
      tracesSampleRate: isProduction ? 0.1 : 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
      ignoreErrors: [
        'top.GLOBALS',
        'chrome-extension://',
        'moz-extension://',
        'Network Error',
        'Failed to fetch',
        'atomicFindClose',
        'fb_xd_fragment',
        'CanvasRenderingContext2D',
      ],
      enabled: isProduction || dsn.includes('test'),
      beforeSend(event, hint) {
        if (event.exception) {
          const error = hint.originalException
          if (error?.target?.src) {
            const src = error.target.src
            if (src.includes('chrome-extension://') || src.includes('moz-extension://')) {
              return null
            }
          }
        }
        try {
          const user = JSON.parse(localStorage.getItem('auth-user') || '{}')
          if (user?.id) {
            event.user = { id: user.id, email: user.email }
          }
        } catch {
          // Ignore localStorage errors
        }
        return event
      },
      beforeBreadcrumb(breadcrumb) {
        if (breadcrumb.category === 'console' && import.meta.env.PROD) {
          return null
        }
        return breadcrumb
      },
    })

  } catch (err) {
    console.warn('Failed to load Sentry:', err)
  }
}

/**
 * Set user context for Sentry.
 * No-op if Sentry is not yet loaded.
 */
export const setSentryUser = (user) => {
  if (!_sentry) return
  if (user?.id) {
    _sentry.setUser({ id: user.id, email: user.email, username: user.email?.split('@')[0] })
  } else {
    _sentry.setUser(null)
  }
}

/**
 * Capture an exception manually.
 * No-op if Sentry is not yet loaded.
 */
export const captureException = (error, context = {}) => {
  if (!_sentry) return
  _sentry.withScope((scope) => {
    if (context.tags) Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, v))
    if (context.extra) Object.entries(context.extra).forEach(([k, v]) => scope.setExtra(k, v))
    if (context.level) scope.setLevel(context.level)
    _sentry.captureException(error)
  })
}

/**
 * Capture a message manually.
 * No-op if Sentry is not yet loaded.
 */
export const captureMessage = (message, context = {}) => {
  if (!_sentry) return
  _sentry.withScope((scope) => {
    if (context.tags) Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, v))
    if (context.extra) Object.entries(context.extra).forEach(([k, v]) => scope.setExtra(k, v))
    if (context.level) scope.setLevel(context.level)
    _sentry.captureMessage(message)
  })
}

/**
 * Start a Sentry performance span.
 * No-op if Sentry is not yet loaded.
 */
export const startSpan = (name, callback) => {
  if (!_sentry) return callback({})
  return _sentry.startSpan({ name }, callback)
}

/**
 * logError(error, context)
 * دالة مساعدة موحدة لتسجيل الأخطاء محليا وإرسالها إلى Sentry.
 */
export const logError = (error, context = {}) => {
  logger.error('خطأ مسجل:', error)
  captureException(error instanceof Error ? error : new Error(String(error)), context)
}

