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
    console.error('Failed to log sign-out audit event:', err)
  }
}

serve(async (req) => {
  const optionsResponse = handleOptions(req)
  if (optionsResponse) return optionsResponse

  try {
    if (req.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405, req)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase configuration missing')
    }

    const body = await req.json()
    const userId = typeof body?.user_id === 'string' ? body.user_id.trim() : null

    if (!userId) {
      return json({ success: false, error: 'user_id is required in request body' }, 400, req)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const userAgent = req.headers.get('user-agent') ?? 'unknown'
    const forwardedFor = req.headers.get('x-forwarded-for')
    const realIp = req.headers.get('x-real-ip')
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp ?? 'unknown')

    await logAuthEvent(adminClient, userId, 'SIGNED_OUT', {
      source_ip: clientIp,
      user_agent: userAgent,
    })

    await adminClient.auth.admin.signOut(userId, 'local')

    return json({ success: true }, 200, req)
  } catch (error) {
    console.error('sign-out error:', error)
    return json({ success: false, error: error instanceof Error ? error.message : 'Sign-out failed' }, 500, req)
  }
})
