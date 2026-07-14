export const getClientIp = (req: Request) => {
  const forwardedFor = req.headers.get('x-forwarded-for') || ''
  const realIp = req.headers.get('x-real-ip') || ''
  return forwardedFor.split(',')[0]?.trim() || realIp.trim() || 'unknown'
}

export const getClientUserAgent = (req: Request) => req.headers.get('user-agent') || 'unknown'

const encoder = new TextEncoder()

const normalizePart = (value: string | null | undefined) => String(value || '').trim().toLowerCase()

const toHex = (bytes: Uint8Array) => Array.from(bytes)
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('')

export const hashRateLimitParts = async (parts: Array<string | null | undefined>) => {
  const normalized = parts
    .map(normalizePart)
    .filter(Boolean)
    .join('|')

  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(normalized))
  return toHex(new Uint8Array(digest))
}

type RateLimitOptions = {
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      single: () => Promise<{ data: { allowed: boolean; retry_after_seconds: number; remaining: number; reset_at: string | null } | null; error: { message: string } | null }>
    }
  }
  scope: string
  identifierParts: Array<string | null | undefined>
  maxAttempts: number
  windowSeconds: number
  blockSeconds: number
}

export const enforceServerRateLimit = async ({
  supabase,
  scope,
  identifierParts,
  maxAttempts,
  windowSeconds,
  blockSeconds,
}: RateLimitOptions) => {
  const identifierHash = await hashRateLimitParts(identifierParts)
  const { data, error } = await supabase.rpc('enforce_rate_limit', {
    p_scope: scope,
    p_identifier_hash: identifierHash,
    p_max_attempts: maxAttempts,
    p_window_seconds: windowSeconds,
    p_block_seconds: blockSeconds,
  }).single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to enforce rate limit')
  }

  return data
}

import { getCorsHeaders as getSharedCorsHeaders } from './cors.ts'

export const getCorsHeaders = (req: Request): Record<string, string> => {
  return getSharedCorsHeaders(req.headers.get('Origin')) as Record<string, string>
}

/**
 * Build CORS headers for OPTIONS responses.
 * Returns full CORS headers including Access-Control-Allow-Origin scoped to the request.
 */
export const corsOptionsHeaders = (req: Request): Record<string, string> => {
  return getSharedCorsHeaders(req.headers.get('Origin')) as Record<string, string>
}

/**
 * Legacy static headers — DEPRECATED.
 * Use corsOptionsHeaders(req) or getCorsHeaders(req) instead.
 * Kept only for backward compatibility; includes a wildcard origin as a safe fallback.
 */
export const jsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Build a JSON Response with correct CORS headers.
 *
 * Overloads:
 *   json(body, status?)                           — no CORS (internal use only)
 *   json(body, status, req)                        — CORS from request origin
 *   json(body, status, extraHeaders)               — no CORS + extra headers
 *   json(body, status, req, extraHeaders)          — CORS from request + extra headers
 */
export const json = (
  body: unknown,
  status = 200,
  reqOrExtraHeaders?: Request | Record<string, string>,
  extraHeaders: Record<string, string> = {},
): Response => {
  const req = reqOrExtraHeaders instanceof Request ? reqOrExtraHeaders : undefined
  const extra: Record<string, string> = reqOrExtraHeaders instanceof Request
    ? extraHeaders
    : (reqOrExtraHeaders ?? {})
  const corsHdrs = req
    ? getCorsHeaders(req)
    : { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHdrs,
      ...extra,
      'Content-Type': 'application/json',
    },
  })
}