import { logger } from './logger.js'

/**
 * Retry wrapper with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options
 * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {Function} options.shouldRetry - Function to determine if should retry
 */
export const withRetry = (fn, options = {}) => {
  const executeWithRetry = async (...args) => {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000,
      shouldRetry = (error) => {
        // Retry on network errors, timeouts, 5xx errors
        return error?.message?.includes('network') ||
               error?.message?.includes('timeout') ||
               error?.status >= 500
      }
    } = options

    let _lastError

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args)
      } catch (error) {
        _lastError = error

        if (attempt === maxRetries || !shouldRetry(error)) {
          const message = error?.message || error?.error_description || 'Unknown error'
          const status = error?.status || error?.code || 'N/A'
          logger.error(`Failed after ${attempt + 1} attempts: ${message} (status/code: ${status})`)
          throw error
        }

        // Exponential backoff with jitter
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
          maxDelay
        )

        logger.warn(`Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // Backward compatibility:
  // - as a wrapper: const wrapped = withRetry(fn)
  // - as direct call: await withRetry(fn)
  const wrappedWithRetry = async (...args) => executeWithRetry(...args)
  wrappedWithRetry.then = (onFulfilled, onRejected) => executeWithRetry().then(onFulfilled, onRejected)
  wrappedWithRetry.catch = (onRejected) => executeWithRetry().catch(onRejected)
  wrappedWithRetry.finally = (onFinally) => executeWithRetry().finally(onFinally)

  return wrappedWithRetry
}

/**
 * React hook for retrying actions
 */
import { useState, useCallback } from 'react'

export const useRetry = (fn, options = {}) => {
  const [isRetrying, setIsRetrying] = useState(false)
  const [lastError, setLastError] = useState(null)

  const execute = useCallback(async (...args) => {
    setIsRetrying(true)
    setLastError(null)

    try {
      const result = await withRetry(() => fn(...args), options)
      return result
    } catch (error) {
      setLastError(error)
      throw error
    } finally {
      setIsRetrying(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, JSON.stringify(options)]) // options serialized to avoid object identity issues

  return { execute, isRetrying, lastError }
}
