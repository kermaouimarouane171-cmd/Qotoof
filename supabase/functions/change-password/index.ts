import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'

const json = (body: unknown, status = 200, req?: Request) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...(req ? getCorsHeaders(req.headers.get('Origin')) : {}),
      'Content-Type': 'application/json',
    },
  })

async function logAuthEvent(
  adminClient: any,
  userId: string,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await adminClient.rpc('log_audit', {
      p_user_id: userId,
      p_action: action,
      p_entity_type: 'auth',
      p_entity_id: userId,
      p_new_values: metadata,
    })
  } catch (err) {
    console.error('Failed to log password-change audit event:', err)
  }
}

const MIN_PASSWORD_LENGTH = 8

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

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return json({ success: false, error: 'Authentication required' }, 401, req)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)
    const token = authHeader.split(' ')[1]

    const { data: { user }, error: authError } = await adminClient.auth.getUser(token)
    if (authError || !user) {
      return json({ success: false, error: 'Invalid or expired token' }, 401, req)
    }

    const body = await req.json()
    const newPassword: string = typeof body?.password === 'string' ? body.password : ''
    const currentPassword: string = typeof body?.currentPassword === 'string' ? body.currentPassword : ''
    const isRecoveryMode: boolean = Boolean(body?.recoveryMode)

    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      return json({ success: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, 400, req)
    }

    // SECURITY: Verify current password before allowing change — EXCEPT in recovery mode
    // where the user already proved identity via the email reset link.
    if (!isRecoveryMode) {
      if (!currentPassword) {
        return json({ success: false, error: 'Current password is required' }, 400, req)
      }

      // Verify the current password by attempting a sign-in with the anon client
      const anonClient = createClient(supabaseUrl, anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { error: verifyError } = await anonClient.auth.signInWithPassword({
        email: user.email || '',
        password: currentPassword,
      })

      if (verifyError) {
        const userAgent = req.headers.get('user-agent') ?? 'unknown'
        const forwardedFor = req.headers.get('x-forwarded-for')
        const realIp = req.headers.get('x-real-ip')
        await logAuthEvent(adminClient, user.id, 'PASSWORD_UPDATE_FAILED', {
          reason: 'invalid_current_password',
          source_ip: forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp ?? 'unknown'),
        })
        return json({ success: false, error: 'Current password is incorrect' }, 403, req)
      }
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      password: newPassword,
    })

    if (updateError) {
      return json({ success: false, error: updateError.message }, 400, req)
    }

    const userAgent = req.headers.get('user-agent') ?? 'unknown'
    const forwardedFor = req.headers.get('x-forwarded-for')
    const realIp = req.headers.get('x-real-ip')
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp ?? 'unknown')

    await logAuthEvent(adminClient, user.id, 'PASSWORD_UPDATED', {
      source_ip: clientIp,
      user_agent: userAgent,
    })

    return json({ success: true }, 200, req)
  } catch (error) {
    console.error('change-password error:', error)
    return json({ success: false, error: error instanceof Error ? error.message : 'Password change failed' }, 500, req)
  }
})
