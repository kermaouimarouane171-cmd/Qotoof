import { logger } from '@/utils/logger'

export const CHUNK_RELOAD_STORAGE_KEY = 'qotoof_chunk_reload_attempted'

let activatePendingUpdate = null

export const isLikelyStaleAssetError = (error) => {
  const message = String(error?.message || error || '').toLowerCase()
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('loading chunk') ||
    message.includes('chunkloaderror')
  )
}

export const configurePendingUpdateActivator = (activator) => {
  activatePendingUpdate = typeof activator === 'function' ? activator : null
}

const buildRefreshUrl = () => {
  const url = new URL(window.location.href)
  url.searchParams.set('reload', Date.now().toString())
  return url.toString()
}

const clearClientCaches = async () => {
  if (!('caches' in window)) return

  const cacheKeys = await caches.keys()
  await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)))
}

const refreshServiceWorkers = async () => {
  if (!('serviceWorker' in navigator)) return

  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map(async (registration) => {
    await registration.update().catch(() => undefined)
  }))
}

export const recoverFromStaleAsset = async ({ error, reason = 'unknown' } = {}) => {
  if (!isLikelyStaleAssetError(error)) {
    return false
  }

  const alreadyAttempted = sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) === '1'
  if (alreadyAttempted) {
    sessionStorage.removeItem(CHUNK_RELOAD_STORAGE_KEY)
    return false
  }

  sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, '1')

  try {
    logger.warn('Attempting stale asset recovery', { reason, message: String(error?.message || error || '') })
    if (activatePendingUpdate) {
      await activatePendingUpdate().catch(() => undefined)
    }
    await refreshServiceWorkers().catch(() => undefined)
    await clearClientCaches().catch(() => undefined)
  } catch (recoveryError) {
    logger.warn('Stale asset recovery pre-reload step failed', recoveryError)
  }

  window.location.replace(buildRefreshUrl())
  return true
}