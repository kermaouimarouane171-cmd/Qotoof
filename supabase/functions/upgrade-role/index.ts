/**
 * Edge Function: upgrade-role
 *
 * Allows an authenticated user to upgrade their own role from 'buyer' to
 * 'vendor' or 'driver'. Runs server-side with service_role so the client
 * never touches profiles.role directly.
 *
 * Request body:
 *   {
 *     target_role:    'vendor' | 'driver'    (required)
 *     store_name?:    string                  (required when target_role='vendor')
 *     description?:   string
 *     business_type?: string
 *     experience_years?: number
 *     city:           string                  (required)
 *     phone:          string                  (required, Moroccan format)
 *     vehicle_type?:  string                  (required when target_role='driver')
 *     vehicle_plate?: string                  (required when target_role='driver')
 *   }
 *
 * Security:
 *   - Requires a valid user JWT (Authorization: Bearer <user_access_token>)
 *   - Only 'buyer' role users can upgrade (prevents vendor→admin escalation)
 *   - Role is written via service_role client, NOT via profiles_self_update RLS
 *   - Emits role_changed event to outbox for JWT sync via sync-role function
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY         = Deno.env.get('SUPABASE_ANON_KEY')!

const MOROCCAN_PHONE_RE = /^(\+212|0)([5-7]\d{8})$/

const UPGRADEABLE_ROLES = new Set(['vendor', 'driver'])

// Roles that are allowed to request an upgrade (only buyer for now)
const ALLOWED_SOURCE_ROLES = new Set(['buyer'])

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

  // 1. Verify caller JWT — must be a real authenticated user
  const authHeader = req.headers.get('Authorization') ?? ''
  const callerToken = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!callerToken) {
    return json(req, { success: false, error: 'Authorization header required' }, 401)
  }

  // Create a user-scoped client to validate the JWT
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${callerToken}` } },
  })

  const { data: { user: callerUser }, error: authError } = await userClient.auth.getUser()
  if (authError || !callerUser) {
    return json(req, { success: false, error: 'Invalid or expired token' }, 401)
  }

  const callerId = callerUser.id

  // 2. Parse request body
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(req, { success: false, error: 'Invalid JSON body' }, 400)
  }

  const targetRole    = typeof body.target_role    === 'string' ? body.target_role.trim().toLowerCase()    : ''
  const storeName     = typeof body.store_name     === 'string' ? body.store_name.trim()                   : ''
  const description   = typeof body.description   === 'string' ? body.description.trim()                  : null
  const businessType  = typeof body.business_type === 'string' ? body.business_type.trim()                : null
  const experienceYrs = typeof body.experience_years === 'number' ? body.experience_years                  : null
  const city          = typeof body.city           === 'string' ? body.city.trim()                         : ''
  const phone         = typeof body.phone          === 'string' ? body.phone.trim()                        : ''
  const vehicleType   = typeof body.vehicle_type   === 'string' ? body.vehicle_type.trim()                 : null
  const vehiclePlate  = typeof body.vehicle_plate  === 'string' ? body.vehicle_plate.trim()                : null

  // 3. Validate target role
  if (!UPGRADEABLE_ROLES.has(targetRole)) {
    return json(req, {
      success: false,
      error: `target_role must be one of: ${[...UPGRADEABLE_ROLES].join(', ')}`,
    }, 400)
  }

  // 4. Common field validation
  if (!city || city.length < 2 || city.length > 100) {
    return json(req, { success: false, error: 'city is required (2–100 characters)' }, 400)
  }
  if (!phone || !MOROCCAN_PHONE_RE.test(phone)) {
    return json(req, { success: false, error: 'Valid Moroccan phone number required (+212 or 06/07...)' }, 400)
  }

  // 5. Role-specific validation
  if (targetRole === 'vendor') {
    if (!storeName || storeName.length < 3 || storeName.length > 100) {
      return json(req, { success: false, error: 'store_name is required (3–100 characters)' }, 400)
    }
    if (description && description.length > 2000) {
      return json(req, { success: false, error: 'description must be ≤ 2000 characters' }, 400)
    }
    if (experienceYrs !== null && (experienceYrs < 0 || experienceYrs > 80)) {
      return json(req, { success: false, error: 'experience_years must be 0–80' }, 400)
    }
  } else if (targetRole === 'driver') {
    if (!vehiclePlate || vehiclePlate.length < 3 || vehiclePlate.length > 20) {
      return json(req, { success: false, error: 'vehicle_plate is required (3–20 characters)' }, 400)
    }
  }

  // 6. Load current profile using service_role client to bypass RLS
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data: currentProfile, error: profileFetchError } = await adminClient
    .from('profiles')
    .select('id, role, store_name')
    .eq('id', callerId)
    .single()

  if (profileFetchError || !currentProfile) {
    console.error('[upgrade-role] Profile fetch failed:', profileFetchError?.message)
    return json(req, { success: false, error: 'Profile not found' }, 404)
  }

  // 7. Source role check — only buyers can upgrade themselves
  if (!ALLOWED_SOURCE_ROLES.has(currentProfile.role)) {
    return json(req, {
      success: false,
      error: `Only users with role 'buyer' can upgrade. Current role: ${currentProfile.role}`,
    }, 403)
  }

  // 8. Prevent re-upgrading to the same role
  if (currentProfile.role === targetRole) {
    return json(req, {
      success: false,
      error: `Already a ${targetRole}`,
    }, 409)
  }

  // 9. For vendor: check store_name uniqueness
  if (targetRole === 'vendor') {
    const { data: existingStore } = await adminClient
      .from('profiles')
      .select('id')
      .eq('store_name', storeName)
      .neq('id', callerId)
      .maybeSingle()

    if (existingStore) {
      return json(req, {
        success: false,
        error: 'store_name is already taken. Please choose a different name.',
      }, 409)
    }
  }

  // 10. Build update payload
  const profileUpdate: Record<string, unknown> = {
    role: targetRole,
    city,
    phone,
  }

  if (targetRole === 'vendor') {
    profileUpdate.store_name        = storeName
    profileUpdate.description       = description
    profileUpdate.business_type     = businessType
    profileUpdate.experience_years  = experienceYrs
  } else if (targetRole === 'driver') {
    profileUpdate.vehicle_type               = vehicleType ?? 'motorcycle'
    profileUpdate.vehicle_plate              = vehiclePlate
    profileUpdate.is_available_for_delivery  = false
  }

  // 11. Apply update via service_role (bypasses RLS profiles_self_update)
  const { error: updateError } = await adminClient
    .from('profiles')
    .update(profileUpdate)
    .eq('id', callerId)

  if (updateError) {
    console.error('[upgrade-role] Profile update failed:', updateError.message)
    return json(req, { success: false, error: 'Failed to upgrade account. Please try again.' }, 500)
  }

  // 12. Emit outbox event so sync-role updates auth.users app_metadata
  await adminClient.from('outbox').insert({
    event_type:  'auth.role_changed',
    payload:     JSON.stringify({ user_id: callerId, new_role: targetRole, old_role: currentProfile.role }),
    status:      'pending',
  }).then(({ error }) => {
    if (error) {
      // Non-fatal — sync-role can be called manually if needed
      console.warn('[upgrade-role] Outbox insert failed (non-fatal):', error.message)
    }
  })

  // 13. Write role change audit log
  await adminClient.from('role_change_audit_log').insert({
    target_user: callerId,
    changed_by:  callerId,
    old_role:    currentProfile.role,
    new_role:    targetRole,
    source:      'self_upgrade',
  }).then(({ error }) => {
    if (error) console.warn('[upgrade-role] Audit log insert failed (non-fatal):', error.message)
  })

  console.log(`[upgrade-role] User ${callerId} upgraded from '${currentProfile.role}' to '${targetRole}'`)

  return json(req, {
    success: true,
    old_role: currentProfile.role,
    new_role: targetRole,
  }, 200)
})
