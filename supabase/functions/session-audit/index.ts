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

async function logAudit(
  adminClient: any,
  userId: string,
  action: string,
  metadata: Record<string, unknown> = {},
  entityType: string = 'session',
  entityId: string | null = null,
) {
  try {
    await adminClient.rpc('log_audit', {
      p_user_id: userId,
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId || userId,
      p_new_values: metadata,
    })
  } catch (err) {
    console.error('Failed to log session audit event:', err)
  }
}

const VALID_ACTIONS = new Set([
  'SESSION_CREATED',
  'SESSION_REVOKED',
  'SESSIONS_REVOKED_ALL',
  'SESSION_REVOKED_CURRENT',
  'SESSION_ACTIVITY_UPDATED',
  'NEGOTIATION_CREATED',
  'NEGOTIATION_ACCEPTED',
  'NEGOTIATION_REJECTED',
  'NEGOTIATION_COUNTERED',
  'NEGOTIATION_EXPIRED',
  'NEGOTIATION_CONVERTED',
])

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
    const action = typeof body?.action === 'string' ? body.action.trim() : ''
    const metadata = typeof body?.metadata === 'object' && body.metadata ? body.metadata : {}
    const entityType = typeof body?.entityType === 'string' ? body.entityType : 'session'
    const entityId = typeof body?.entityId === 'string' ? body.entityId : null

    if (!userId) {
      return json({ success: false, error: 'user_id is required in request body' }, 400, req)
    }

    if (!action || !VALID_ACTIONS.has(action)) {
      return json({ success: false, error: 'Invalid or missing action' }, 400, req)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const userAgent = req.headers.get('user-agent') ?? 'unknown'
    const forwardedFor = req.headers.get('x-forwarded-for')
    const realIp = req.headers.get('x-real-ip')
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp ?? 'unknown')

    await logAudit(adminClient, userId, action, {
      ...metadata,
      source_ip: clientIp,
      user_agent: userAgent,
    }, entityType, entityId)

    return json({ success: true }, 200, req)
  } catch (error) {
    console.error('session-audit error:', error)
    return json({ success: false, error: error instanceof Error ? error.message : 'Session audit failed' }, 500, req)
  }
})
