import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enforceServerRateLimit, getClientIp, getClientUserAgent } from '../_shared/serverRateLimit.ts'
import { isIpBlocked, logSecurityAlert } from '../_shared/ipBlocking.ts'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'

const logAuthEvent = async (
  adminClient: any,
  userId: string | null,
  action: string,
  metadata: Record<string, unknown> = {},
) => {
  try {
    await adminClient.rpc('log_audit', {
      p_user_id: userId,
      p_action: action,
      p_entity_type: 'auth',
      p_entity_id: userId,
      p_new_values: metadata,
    })
  } catch (err) {
    console.error('Failed to log auth audit event:', err)
  }
}

const getUserRole = async (adminClient: any, userId: string): Promise<string | null> => {
  try {
    const { data, error } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
    if (error || !data) return null
    return data.role || null
  } catch (err) {
    console.error('Failed to fetch user role for audit log:', err)
    return null
  }
}

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

const json = (
  body: unknown,
  status = 200,
  req?: Request,
  extraHeaders: Record<string, string> = {},
) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...(req ? getCorsHeaders(req.headers.get('Origin')) : {}),
    'Content-Type': 'application/json',
    ...extraHeaders,
  },
})

serve(async (req) => {
  const optionsResponse = handleOptions(req)
  if (optionsResponse) return optionsResponse

  try {
    if (req.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405, req)
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
      return json({ success: false, error: 'Email and password are required' }, 400, req)
    }

    const clientIp = getClientIp(req)
    const userAgent = getClientUserAgent(req)
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const ipBlocked = await isIpBlocked(adminClient, clientIp)

    if (ipBlocked) {
      await logSecurityAlert(adminClient, {
        alertType: 'unauthorized_access',
        severity: 'high',
        title: `Blocked IP attempted login: ${clientIp}`,
        description: 'Request rejected because the source IP is on the block list.',
        sourceIp: clientIp,
        userAgent,
        requestPath: '/secure-login',
        requestMethod: 'POST',
      })

      return json({ success: false, error: 'Invalid login credentials' }, 403, req)
    }

    const publicRequestResult = await enforceServerRateLimit({
      supabase: adminClient,
      scope: 'public_request',
      identifierParts: ['secure-login', clientIp],
      maxAttempts: PUBLIC_REQUEST_LIMIT.maxAttempts,
      windowSeconds: PUBLIC_REQUEST_LIMIT.windowSeconds,
      blockSeconds: PUBLIC_REQUEST_LIMIT.blockSeconds,
    })

    if (!publicRequestResult.allowed) {
      await logSecurityAlert(adminClient, {
        alertType: 'rate_limit_exceeded',
        severity: 'medium',
        title: `Public request limit exceeded: ${clientIp}`,
        description: 'Too many requests to the secure-login endpoint.',
        sourceIp: clientIp,
        userAgent,
        requestPath: '/secure-login',
        requestMethod: 'POST',
        metadata: { retry_after_seconds: publicRequestResult.retry_after_seconds },
      })

      return json(
        { success: false, error: 'Too many requests. Please try again later.' },
        429,
        req,
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
      await logSecurityAlert(adminClient, {
        alertType: 'brute_force_login',
        severity: 'high',
        title: `Login rate limit exceeded: ${clientIp}`,
        description: `Repeated login attempts for ${email}`,
        sourceIp: clientIp,
        userAgent,
        requestPath: '/secure-login',
        requestMethod: 'POST',
        metadata: { retry_after_seconds: loginResult.retry_after_seconds },
      })

      return json(
        { success: false, error: 'Too many login attempts. Please try again later.' },
        429,
        req,
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
      await logAuthEvent(adminClient, null, 'LOGIN_FAILED', {
        source_ip: clientIp,
        user_agent: userAgent,
        reason: 'Invalid credentials',
      })
      return json({ success: false, error: 'Invalid login credentials' }, 400, req)
    }

    const profileRole = await getUserRole(adminClient, data.user.id)
    await logAuthEvent(adminClient, data.user.id, 'SIGNED_IN', {
      role: profileRole,
      source_ip: clientIp,
      user_agent: userAgent,
    })

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
    }, 200, req)
  } catch (error) {
    console.error('secure-login error:', error)
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sign in',
    }, 500, req)
  }
})