export const getClientIp = (req: Request) => {
  const forwardedFor = req.headers.get('x-forwarded-for') || ''
  return forwardedFor.split(',')[0]?.trim() || 'unknown'
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

export const jsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...jsonHeaders,
    ...extraHeaders,
    'Content-Type': 'application/json',
  },
})