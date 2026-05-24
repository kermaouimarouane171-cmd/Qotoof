const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') ?? []

export function getCorsHeaders(requestOrigin: string | null): HeadersInit {
  const origin = requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0] ?? ''
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req.headers.get('Origin')) })
  }
  return null
}
