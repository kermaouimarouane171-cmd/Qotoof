/**
 * Logger utility - replaces console.* statements
 * In production: only errors are logged
 * In development: all logs are enabled
 */

const isDev = import.meta.env?.DEV ?? true

export const logger = {
  /**
   * Log only in development
   */
  log: (...args) => {
    if (isDev) {
      console.log(...args)
    }
  },

  /**
   * Warn only in development
   */
  warn: (...args) => {
    if (isDev) {
      console.warn(...args)
    }
  },

  /**
   * Always log errors (even in production)
   */
  error: (...args) => {
    console.error(...args)
  },

  /**
   * Debug logging (development only)
   */
  debug: (...args) => {
    if (isDev) {
      console.debug(...args)
    }
  },

  /**
   * Info logging (development only)
   */
  info: (...args) => {
    if (isDev) {
      console.info(...args)
    }
  }
}
