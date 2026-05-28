/**
 * Edge Function: sync-role
 *
 * Syncs a user's `profiles.role` into `auth.users.app_metadata.role`
 * so that JWT claims remain consistent with the database.
 *
 * Called by the `process-outbox` function when it encounters an event
 * of type `auth.role_changed`.
 *
 * Payload shape:
 *   { user_id: string, new_role: string, old_role?: string }
 *
 * Security: requires service-role Bearer token (set by process-outbox).
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'

const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const VALID_ROLES = new Set(['admin', 'vendor', 'buyer', 'driver'])

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req.headers.get('Origin')),
      'Content-Type': 'application/json',
    },
  })
}

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req)
  if (optionsResponse) return optionsResponse

  if (req.method !== 'POST') {
    return json(req, { success: false, error: 'Method not allowed' }, 405)
  }

  // Verify caller is service_role (process-outbox uses service-role key)
  const authHeader = req.headers.get('Authorization') ?? ''
  const callerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!callerToken || callerToken !== SUPABASE_SERVICE_ROLE_KEY) {
    return json(req, { success: false, error: 'Unauthorized' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(req, { success: false, error: 'Invalid JSON body' }, 400)
  }

  const userId  = typeof body.user_id  === 'string' ? body.user_id.trim()  : ''
  const newRole = typeof body.new_role === 'string' ? body.new_role.trim() : ''

  if (!userId) {
    return json(req, { success: false, error: 'user_id is required' }, 400)
  }
  if (!newRole || !VALID_ROLES.has(newRole)) {
    return json(req, { success: false, error: `Invalid role: ${newRole}` }, 400)
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // Verify user exists first
  const { data: { user }, error: getUserError } = await adminClient.auth.admin.getUserById(userId)
  if (getUserError || !user) {
    return json(req, {
      success: false,
      error: `User not found: ${getUserError?.message ?? 'unknown'}`,
    }, 404)
  }

  const currentAppMetaRole = (user.app_metadata as Record<string, unknown>)?.role

  // Skip if already in sync (idempotent)
  if (currentAppMetaRole === newRole) {
    return json(req, { success: true, synced: false, reason: 'already_in_sync' })
  }

  // Update app_metadata
  const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
    app_metadata: {
      ...((user.app_metadata as Record<string, unknown>) ?? {}),
      role: newRole,
    },
  })

  if (updateError) {
    console.error(`[sync-role] Failed to update app_metadata for ${userId}:`, updateError.message)
    return json(req, {
      success: false,
      error: `Failed to sync app_metadata: ${updateError.message}`,
    }, 500)
  }

  // Write audit log
  await adminClient.from('role_change_audit_log').insert({
    target_user: userId,
    changed_by: null,
    old_role: String(currentAppMetaRole ?? 'unknown'),
    new_role: newRole,
    source: 'sync',
  })

  console.log(`[sync-role] Synced user ${userId}: ${currentAppMetaRole} → ${newRole}`)
  return json(req, { success: true, synced: true, old_role: currentAppMetaRole, new_role: newRole })
})
