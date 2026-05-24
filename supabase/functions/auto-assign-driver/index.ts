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
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'
import { requireRole } from '../_shared/auth.ts'

// ──────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────
const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// CORS headers are resolved dynamically per-request origin via getCorsHeaders(origin).
// See supabase/functions/_shared/cors.ts and the ALLOWED_ORIGINS Edge Function secret.

// ──────────────────────────────────────────────────────────
// Helper: JSON response
// ──────────────────────────────────────────────────────────
function respond(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...(req ? getCorsHeaders(req.headers.get('Origin')) : {}), 'Content-Type': 'application/json' },
  })
}

// ──────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // ── CORS preflight
  const optionsResponse = handleOptions(req)
  if (optionsResponse) return optionsResponse

  if (req.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, 405, req)
  }

  // ── Authenticate caller (admin or vendor)
  let auth
  try {
    auth = await requireRole(req, ['admin', 'vendor'])
  } catch (error) {
    if (error instanceof Response) {
      return new Response(error.body, {
        status: error.status,
        headers: {
          ...(req ? getCorsHeaders(req.headers.get('Origin')) : {}),
          'Content-Type': 'application/json',
        },
      })
    }
    return respond({ error: 'Authentication failed' }, 401, req)
  }

  const { userId, role: callerRole } = auth

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // ── Parse request body
  let body: { deliveryId?: string; orderId?: string; assignAll?: boolean }
  try {
    body = await req.json()
  } catch {
    return respond({ error: 'Invalid JSON body' }, 400, req)
  }

  // ── Route: assign all pending deliveries
  if (body.assignAll) {
    // Only admins may trigger bulk assignment
    if (callerRole !== 'admin') {
      return respond({ error: 'Only admins can bulk-assign deliveries' }, 403, req)
    }
    return await handleAssignAll(adminClient)
  }

  // ── Route: assign single delivery
  const { deliveryId, orderId } = body
  if (!deliveryId || !orderId) {
    return respond({ error: 'Missing required fields: deliveryId, orderId' }, 400, req)
  }

  return await handleAssignOne(adminClient, deliveryId, orderId, callerRole, userId)
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
    return respond({ success: false, error: 'Delivery not found' }, 404, req)
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
    return respond({ success: false, error: 'Order not found' }, 404, req)
  }

  const { data: vendor } = await adminClient
    .from('profiles')
    .select('latitude, longitude')
    .eq('id', order.vendor_id)
    .single()

  if (!vendor?.latitude || !vendor?.longitude) {
    return respond({ success: false, reason: 'Vendor location not set' }, req)
  }

  // 3. Find best available driver within 30 km using the spatial get_nearby_drivers RPC.
  //    This is faster than find_available_drivers_with_capacity because it uses a bounding
  //    box pre-filter and an index on (latitude, longitude) for driver rows only.
  const { data: drivers, error: driversError } = await adminClient
    .rpc('get_nearby_drivers', {
      p_lat:       vendor.latitude,
      p_lng:       vendor.longitude,
      p_radius_km: 30,
      p_limit:     10,
    })

  if (driversError) {
    return respond({ success: false, error: driversError.message }, 500, req)
  }

  if (!drivers || drivers.length === 0) {
    return respond({ success: false, reason: 'No available drivers within 20 km' }, req)
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
    return respond({ success: false, error: assignError.message }, 500, req)
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
// Uses cursor-based pagination so large backlogs don't exhaust memory.
// Uses Promise.allSettled so individual failures don't abort the batch.
// ──────────────────────────────────────────────────────────
async function handleAssignAll(
  adminClient: ReturnType<typeof createClient>,
): Promise<Response> {
  /** Rows processed per cursor page — keeps memory predictable */
  const BATCH_SIZE = 20

  const results: Array<Record<string, unknown>> = []
  let assigned = 0
  let failed   = 0
  let total    = 0
  let lastId: string | null = null
  let hasMore = true

  // Cursor-based pagination: fetch BATCH_SIZE rows at a time ordered by id
  while (hasMore) {
    let pageQuery = adminClient
      .from('deliveries')
      .select('id, order_id')
      .eq('status', 'unassigned')
      .order('id', { ascending: true })
      .limit(BATCH_SIZE)

    if (lastId) {
      pageQuery = pageQuery.gt('id', lastId)
    }

    const { data: page, error: pageError } = await pageQuery

    if (pageError) {
      return respond({ success: false, error: pageError.message }, 500)
    }

    if (!page || page.length === 0) {
      hasMore = false
      break
    }

    total  += page.length
    lastId  = page[page.length - 1].id
    hasMore = page.length === BATCH_SIZE

    // Process all deliveries in the page in parallel; individual failures are isolated
    const batchSettled = await Promise.allSettled(
      page.map(async (delivery) => {
        const res  = await handleAssignOne(adminClient, delivery.id, delivery.order_id, 'admin', '')
        const data = await res.clone().json()
        return { deliveryId: delivery.id, ...data }
      }),
    )

    for (const settled of batchSettled) {
      const item = settled.status === 'fulfilled'
        ? settled.value
        : { deliveryId: null, success: false, error: (settled as PromiseRejectedResult).reason?.message ?? 'unknown' }

      results.push(item as Record<string, unknown>)
      if ((item as Record<string, unknown>).success) {
        assigned++
      } else {
        failed++
      }
    }
  }

  if (total === 0) {
    return respond({ success: true, total: 0, assigned: 0, failed: 0, results: [] })
  }

  return respond({ success: true, total, assigned, failed, results })
}
