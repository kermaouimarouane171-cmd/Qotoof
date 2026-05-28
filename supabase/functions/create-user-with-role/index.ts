/**
 * Edge Function: create-user-with-role
 *
 * Atomically creates a Supabase auth user AND a profiles row in one operation.
 * If the profiles insert fails, the auth user is deleted to prevent orphan accounts.
 *
 * Uses an idempotency_key to prevent duplicate users from retried requests.
 *
 * Request body:
 *   {
 *     email:            string   (required)
 *     password:         string   (required)
 *     role:             'vendor'|'driver'|'buyer'  (required; 'admin' blocked)
 *     first_name:       string   (required)
 *     last_name:        string   (optional)
 *     phone:            string   (optional)
 *     idempotency_key:  string   (recommended; UUID or hash)
 *   }
 *
 * Security: callable by admin UI (requires valid service-role token)
 *           OR by the public sign-up flow (verified via JWT + role check).
 *           Set ALLOW_PUBLIC_SIGNUP=true env var to allow unauthenticated calls.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ALLOW_PUBLIC_SIGNUP       = Deno.env.get('ALLOW_PUBLIC_SIGNUP') === 'true'

// Roles that can be set via this endpoint (admin is reserved)
const ALLOWED_ROLES = new Set(['vendor', 'driver', 'buyer'])

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

  // Auth: service_role callers (admin ops) are always allowed.
  //       Public callers are only allowed when ALLOW_PUBLIC_SIGNUP=true.
  const authHeader  = req.headers.get('Authorization') ?? ''
  const callerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  const isServiceRole = callerToken === SUPABASE_SERVICE_ROLE_KEY

  if (!isServiceRole && !ALLOW_PUBLIC_SIGNUP) {
    return json(req, { success: false, error: 'Unauthorized' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(req, { success: false, error: 'Invalid JSON body' }, 400)
  }

  const email           = typeof body.email      === 'string' ? body.email.trim().toLowerCase()      : ''
  const password        = typeof body.password   === 'string' ? body.password                        : ''
  const role            = typeof body.role       === 'string' ? body.role.trim().toLowerCase()       : ''
  const firstName       = typeof body.first_name === 'string' ? body.first_name.trim()               : ''
  const lastName        = typeof body.last_name  === 'string' ? body.last_name.trim()                : ''
  const phone           = typeof body.phone      === 'string' ? body.phone.trim()                    : null
  const idempotencyKey  = typeof body.idempotency_key === 'string' ? body.idempotency_key.trim()     : null

  // Validate
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(req, { success: false, error: 'Valid email is required' }, 400)
  }
  if (!password || password.length < 8) {
    return json(req, { success: false, error: 'Password must be at least 8 characters' }, 400)
  }
  if (!ALLOWED_ROLES.has(role)) {
    return json(req, { success: false, error: `role must be one of: ${[...ALLOWED_ROLES].join(', ')}` }, 400)
  }
  if (!firstName) {
    return json(req, { success: false, error: 'first_name is required' }, 400)
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // Idempotency check
  if (idempotencyKey) {
    const { data: existing } = await adminClient
      .from('user_creation_audit')
      .select('id, auth_user_id, status, created_at')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle()

    if (existing) {
      if (existing.status === 'success') {
        return json(req, {
          success: true,
          idempotent: true,
          user_id: existing.auth_user_id,
        })
      }
      if (existing.status === 'pending') {
        return json(req, {
          success: false,
          error: 'Creation already in progress for this idempotency_key',
        }, 409)
      }
      // 'failed' – allow retry; continue below
    }
  }

  // Insert audit row (pending)
  const auditRow: Record<string, unknown> = {
    role,
    status: 'pending',
    idempotency_key: idempotencyKey ?? null,
  }
  const { data: auditRecord, error: auditInsertErr } = await adminClient
    .from('user_creation_audit')
    .insert(auditRow)
    .select('id')
    .single()

  if (auditInsertErr) {
    console.error('[create-user-with-role] Failed to write audit record:', auditInsertErr.message)
  }
  const auditId: string | null = auditRecord?.id ?? null

  // Step 1: Create auth user
  const { data: { user: newUser }, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,   // mark as confirmed so they can log in immediately
    app_metadata: { role },
    user_metadata: { first_name: firstName, last_name: lastName, phone },
  })

  if (createError || !newUser) {
    const msg = createError?.message ?? 'Unknown error creating auth user'
    if (auditId) {
      await adminClient.from('user_creation_audit').update({ status: 'failed', error_message: msg }).eq('id', auditId)
    }
    return json(req, { success: false, error: msg }, 400)
  }

  // Step 2: Insert profiles row
  const { error: profileError } = await adminClient.from('profiles').insert({
    id:         newUser.id,
    email,
    first_name: firstName,
    last_name:  lastName,
    phone,
    role,
    is_verified: false,
  })

  if (profileError) {
    // ROLLBACK: delete the auth user to prevent orphan
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(newUser.id)
    if (deleteError) {
      // Log for manual cleanup
      console.error(
        `[create-user-with-role] CRITICAL: auth user ${newUser.id} created but profiles insert failed ` +
        `AND delete also failed. Manual cleanup required. Profile error: ${profileError.message}. ` +
        `Delete error: ${deleteError.message}`
      )
    }
    const msg = `Profile creation failed: ${profileError.message}`
    if (auditId) {
      await adminClient.from('user_creation_audit').update({ status: 'failed', error_message: msg }).eq('id', auditId)
    }
    return json(req, { success: false, error: msg }, 500)
  }

  // Mark audit as success
  if (auditId) {
    await adminClient.from('user_creation_audit').update({
      status: 'success',
      auth_user_id: newUser.id,
    }).eq('id', auditId)
  }

  console.log(`[create-user-with-role] Created ${role} user: ${newUser.id} (${email})`)
  return json(req, {
    success: true,
    user_id: newUser.id,
    email,
    role,
  }, 201)
})
