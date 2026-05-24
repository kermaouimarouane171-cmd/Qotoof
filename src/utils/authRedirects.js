export const DEFAULT_AUTH_REDIRECT = '/marketplace'
export const PENDING_AUTH_REDIRECT_KEY = 'pending_auth_redirect'

export const resolveSafeAuthRedirect = (input, fallback = null) => {
  if (typeof input !== 'string') {
    return fallback
  }

  const trimmed = input.trim()

  // eslint-disable-next-line no-control-regex
  if (!trimmed || trimmed.includes('\\') || /[\u0000-\u001F]/.test(trimmed)) {
    return fallback
  }

  if (typeof window === 'undefined' || !window.location?.origin) {
    return trimmed.startsWith('/') && !trimmed.startsWith('//') ? trimmed : fallback
  }

  try {
    const candidate = new URL(trimmed, window.location.origin)

    if (candidate.origin !== window.location.origin || !candidate.pathname.startsWith('/')) {
      return fallback
    }

    return `${candidate.pathname}${candidate.search}${candidate.hash}`
  } catch {
    return fallback
  }
}

export const setPendingAuthRedirect = (input) => {
  if (typeof window === 'undefined') {
    return null
  }

  const safeRedirect = resolveSafeAuthRedirect(input, null)

  if (!safeRedirect) {
    window.sessionStorage.removeItem(PENDING_AUTH_REDIRECT_KEY)
    return null
  }

  window.sessionStorage.setItem(PENDING_AUTH_REDIRECT_KEY, safeRedirect)
  return safeRedirect
}

export const getPendingAuthRedirect = () => {
  if (typeof window === 'undefined') {
    return null
  }

  return resolveSafeAuthRedirect(
    window.sessionStorage.getItem(PENDING_AUTH_REDIRECT_KEY),
    null
  )
}

export const clearPendingAuthRedirect = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(PENDING_AUTH_REDIRECT_KEY)
}

export const consumePendingAuthRedirect = (fallback = DEFAULT_AUTH_REDIRECT) => {
  const redirect = getPendingAuthRedirect()
  clearPendingAuthRedirect()
  return redirect || fallback
}