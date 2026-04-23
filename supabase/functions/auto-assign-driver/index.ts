/**
 * Edge Function: auto-assign-driver
 *
 * Moves the driver auto-assignment logic that was previously running
 * client-side (autoDispatch.js) to a secure, server-side endpoint.
 *
 * Running assignment in the browser was unsafe because:
 *  – Any user with devtools could manipulate which driver gets assigned
 *  – Two tabs open simultaneously caused race conditions
 *  – The RPC 'find_available_drivers_with_capacity' could be called by anyone
 *
 * This function uses the service-role key to bypass RLS and performs
 * an optimistic-lock UPDATE (WHERE status = 'unassigned') to prevent
 * double-assignment even under concurrent requests.
 *
 * Deploy:
 *   supabase functions deploy auto-assign-driver
 *
 * Environment variables required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Authentication:
 *   Requires a valid JWT from an admin or vendor (enforced below).
 *   Public callers are rejected with 401.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ──────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────
const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  ...CORS_HEADERS,
}

// ──────────────────────────────────────────────────────────
// Helper: JSON response
// ──────────────────────────────────────────────────────────
function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

// ──────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // ── CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, 405)
  }

  // ── Authenticate caller (admin or vendor)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return respond({ error: 'Missing authorization header' }, 401)
  }

  const callerJwt = authHeader.replace('Bearer ', '')

  // Verify the JWT and get caller profile using user-scoped client
  const callerClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error: authError } = await callerClient.auth.getUser(callerJwt)
  if (authError || !user) {
    return respond({ error: 'Invalid or expired token' }, 401)
  }

  // Fetch caller role from profiles
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: callerProfile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const callerRole = callerProfile?.role
  if (!['admin', 'vendor'].includes(callerRole)) {
    return respond({ error: 'Insufficient permissions' }, 403)
  }

  // ── Parse request body
  let body: { deliveryId?: string; orderId?: string; assignAll?: boolean }
  try {
    body = await req.json()
  } catch {
    return respond({ error: 'Invalid JSON body' }, 400)
  }

  // ── Route: assign all pending deliveries
  if (body.assignAll) {
    // Only admins may trigger bulk assignment
    if (callerRole !== 'admin') {
      return respond({ error: 'Only admins can bulk-assign deliveries' }, 403)
    }
    return await handleAssignAll(adminClient)
  }

  // ── Route: assign single delivery
  const { deliveryId, orderId } = body
  if (!deliveryId || !orderId) {
    return respond({ error: 'Missing required fields: deliveryId, orderId' }, 400)
  }

  return await handleAssignOne(adminClient, deliveryId, orderId, callerRole, user.id)
})

// ──────────────────────────────────────────────────────────
// Assign a single delivery
// ──────────────────────────────────────────────────────────
async function handleAssignOne(
  adminClient: ReturnType<typeof createClient>,
  deliveryId: string,
  orderId: string,
  _callerRole: string,
  _callerId: string,
): Promise<Response> {
  // 1. Fetch delivery — ensure it exists and is still unassigned
  const { data: delivery, error: deliveryError } = await adminClient
    .from('deliveries')
    .select('id, status, order_id')
    .eq('id', deliveryId)
    .single()

  if (deliveryError || !delivery) {
    return respond({ success: false, error: 'Delivery not found' }, 404)
  }

  if (delivery.status !== 'unassigned') {
    return respond({
      success: false,
      reason: 'Delivery already assigned',
      currentStatus: delivery.status,
    })
  }

  // 2. Get vendor location from order
  const { data: order } = await adminClient
    .from('orders')
    .select('vendor_id, shipping_latitude, shipping_longitude')
    .eq('id', orderId)
    .single()

  if (!order) {
    return respond({ success: false, error: 'Order not found' }, 404)
  }

  const { data: vendor } = await adminClient
    .from('profiles')
    .select('latitude, longitude')
    .eq('id', order.vendor_id)
    .single()

  if (!vendor?.latitude || !vendor?.longitude) {
    return respond({ success: false, reason: 'Vendor location not set' })
  }

  // 3. Find best available driver within 20 km with capacity
  const { data: drivers, error: driversError } = await adminClient
    .rpc('find_available_drivers_with_capacity', {
      p_search_latitude:  vendor.latitude,
      p_search_longitude: vendor.longitude,
      p_radius_km:        20,
      p_vehicle_type:     null,
    })

  if (driversError) {
    return respond({ success: false, error: driversError.message }, 500)
  }

  if (!drivers || drivers.length === 0) {
    return respond({ success: false, reason: 'No available drivers within 20 km' })
  }

  const bestDriver = drivers[0]

  // 4. Optimistic-lock assignment: only update if still 'unassigned'
  //    If two concurrent requests both reach here, only one will match.
  const { data: updated, error: assignError } = await adminClient
    .from('deliveries')
    .update({
      driver_id:   bestDriver.driver_id,
      status:      'assigned',
      assigned_at: new Date().toISOString(),
    })
    .eq('id', deliveryId)
    .eq('status', 'unassigned')  // optimistic lock
    .select('id')

  if (assignError) {
    return respond({ success: false, error: assignError.message }, 500)
  }

  if (!updated || updated.length === 0) {
    return respond({
      success: false,
      reason:  'Delivery was already assigned by a concurrent process',
    })
  }

  // 5. Increment driver active delivery count
  await adminClient.rpc('increment_driver_active_deliveries', {
    p_driver_id: bestDriver.driver_id,
  }).maybeSingle()  // ignore if RPC doesn't exist yet

  return respond({
    success:     true,
    deliveryId,
    driver:      bestDriver,
    assignedAt:  new Date().toISOString(),
  })
}

// ──────────────────────────────────────────────────────────
// Assign all unassigned deliveries (admin bulk action)
// ──────────────────────────────────────────────────────────
async function handleAssignAll(
  adminClient: ReturnType<typeof createClient>,
): Promise<Response> {
  const { data: deliveries, error } = await adminClient
    .from('deliveries')
    .select('id, order_id')
    .eq('status', 'unassigned')

  if (error) {
    return respond({ success: false, error: error.message }, 500)
  }

  if (!deliveries || deliveries.length === 0) {
    return respond({ success: true, total: 0, assigned: 0, failed: 0, results: [] })
  }

  // Process assignments in small batches to reduce end-to-end latency
  // without overwhelming downstream queries/RPCs.
  const BATCH_SIZE = 5
  const results: Array<Record<string, unknown>> = []
  let assigned = 0
  let failed = 0

  for (let i = 0; i < deliveries.length; i += BATCH_SIZE) {
    const batch = deliveries.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map(async (delivery) => {
        const res = await handleAssignOne(
          adminClient,
          delivery.id,
          delivery.order_id,
          'admin',
          '',
        )
        const data = await res.clone().json()
        return { deliveryId: delivery.id, ...data }
      }),
    )

    for (const item of batchResults) {
      results.push(item)
      if (item.success) {
        assigned++
      } else {
        failed++
      }
    }
  }

  return respond({
    success:  true,
    total:    deliveries.length,
    assigned,
    failed,
    results,
  })
}
