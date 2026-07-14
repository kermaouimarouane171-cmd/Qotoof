const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map((o: string) => o.trim()).filter(Boolean) ?? []

const ALLOW_WILDCARD = ALLOWED_ORIGINS.includes('*')

const _warnedMissingOrigins = new Set<string>()

export function getCorsHeaders(requestOrigin: string | null): HeadersInit {
  // Development fallback: if ALLOWED_ORIGINS is not configured at all, echo
  // the request origin with a console warning.
  if (ALLOWED_ORIGINS.length === 0) {
    if (requestOrigin && !_warnedMissingOrigins.has(requestOrigin)) {
      _warnedMissingOrigins.add(requestOrigin)
      console.warn(`[cors] ALLOWED_ORIGINS not set — echoing request origin "${requestOrigin}" as fallback. Set the ALLOWED_ORIGINS Edge Function secret in production.`)
    }
    return {
      'Access-Control-Allow-Origin': requestOrigin || '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, x-client-security, apikey, content-type',
      'Access-Control-Max-Age': '86400',
    }
  }

  // Wildcard mode: allow any origin
  if (ALLOW_WILDCARD) {
    return {
      'Access-Control-Allow-Origin': requestOrigin || '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, x-client-security, apikey, content-type',
      'Access-Control-Max-Age': '86400',
    }
  }

  // Explicit allowlist mode: only echo known origins
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ''
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, x-client-security, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  }
}

export function isAllowedOrigin(requestOrigin: string | null): boolean {
  if (!requestOrigin) return false
  if (ALLOWED_ORIGINS.length === 0) return true // dev fallback
  return ALLOWED_ORIGINS.includes(requestOrigin)
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: getCorsHeaders(req.headers.get('Origin')),
    })
  }
  return null
}
