import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enforceServerRateLimit, getClientIp, getClientUserAgent, json, jsonHeaders } from '../_shared/serverRateLimit.ts'

const PUBLIC_REQUEST_LIMIT = {
  maxAttempts: 60,
  windowSeconds: 60,
  blockSeconds: 60,
}

const LOGIN_LIMIT = {
  maxAttempts: 5,
  windowSeconds: 15 * 60,
  blockSeconds: 30 * 60,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: jsonHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error('Supabase configuration missing')
    }

    const body = await req.json()
    const email = String(body?.email || '').trim().toLowerCase()
    const password = String(body?.password || '')
    const captchaToken = typeof body?.captchaToken === 'string' && body.captchaToken.trim()
      ? body.captchaToken.trim()
      : null

    if (!email || !password) {
      return json({ success: false, error: 'Email and password are required' }, 400)
    }

    const clientIp = getClientIp(req)
    const userAgent = getClientUserAgent(req)
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const publicRequestResult = await enforceServerRateLimit({
      supabase: adminClient,
      scope: 'public_request',
      identifierParts: ['secure-login', clientIp],
      maxAttempts: PUBLIC_REQUEST_LIMIT.maxAttempts,
      windowSeconds: PUBLIC_REQUEST_LIMIT.windowSeconds,
      blockSeconds: PUBLIC_REQUEST_LIMIT.blockSeconds,
    })

    if (!publicRequestResult.allowed) {
      return json(
        { success: false, error: 'Too many requests. Please try again later.' },
        429,
        { 'Retry-After': String(publicRequestResult.retry_after_seconds || PUBLIC_REQUEST_LIMIT.blockSeconds) },
      )
    }

    const loginResult = await enforceServerRateLimit({
      supabase: adminClient,
      scope: 'login_attempt',
      identifierParts: ['secure-login', clientIp, userAgent, email],
      maxAttempts: LOGIN_LIMIT.maxAttempts,
      windowSeconds: LOGIN_LIMIT.windowSeconds,
      blockSeconds: LOGIN_LIMIT.blockSeconds,
    })

    if (!loginResult.allowed) {
      return json(
        { success: false, error: 'Too many login attempts. Please try again later.' },
        429,
        { 'Retry-After': String(loginResult.retry_after_seconds || LOGIN_LIMIT.blockSeconds) },
      )
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password,
      options: captchaToken ? { captchaToken } : undefined,
    })

    if (error || !data?.session || !data?.user) {
      return json({ success: false, error: 'Invalid login credentials' }, 400)
    }

    return json({
      success: true,
      user: data.user,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        expires_in: data.session.expires_in,
        token_type: data.session.token_type,
      },
    })
  } catch (error) {
    console.error('secure-login error:', error)
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sign in',
    }, 500)
  }
})