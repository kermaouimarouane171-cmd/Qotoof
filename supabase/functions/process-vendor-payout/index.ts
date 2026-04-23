/**
 * Edge Function: process-vendor-payout
 *
 * Wraps the payout lifecycle (approve → process → complete → reject)
 * in a single server-side endpoint, replacing direct RPC calls from
 * the admin browser (pages/admin/Payouts.jsx).
 *
 * Why this matters:
 *  – Financial mutations should never come straight from the browser
 *  – Server-side role enforcement prevents escalation attacks
 *  – Atomic audit logging is guaranteed even if the browser navigates away
 *  – One endpoint = one place to add future fraud checks
 *
 * Deploy:
 *   supabase functions deploy process-vendor-payout
 *
 * Environment variables required:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Authentication:
 *   Requires a valid JWT from an admin.  All other roles get 403.
 *
 * Request body:
 *   {
 *     action:  'approve' | 'reject' | 'process' | 'complete',
 *     payoutId: string,          // UUID
 *     reason?:  string,          // required for 'reject'
 *     notes?:   string           // optional for any action
 *   }
 *
 * Response (all actions):
 *   {
 *     success: boolean,
 *     payoutId: string,
 *     newStatus: string,
 *     referenceNumber?: string,  // returned for 'process'
 *     error?: string
 *   }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ──────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────
const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const JSON_HEADERS = { 'Content-Type': 'application/json', ...CORS_HEADERS }

type Action = 'approve' | 'reject' | 'process' | 'complete'

interface RequestBody {
  action:    Action
  payoutId:  string
  reason?:   string
  notes?:    string
}

// ──────────────────────────────────────────────────────────
// Helper
// ──────────────────────────────────────────────────────────
function respond(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

// ──────────────────────────────────────────────────────────
// Handler
// ──────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return respond({ error: 'Method not allowed' }, 405)
  }

  // ── Auth: require valid JWT
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return respond({ error: 'Missing authorization header' }, 401)
  }

  const callerJwt  = authHeader.replace('Bearer ', '')
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: { user }, error: authError } = await adminClient.auth.getUser(callerJwt)
  if (authError || !user) {
    return respond({ error: 'Invalid or expired token' }, 401)
  }

  // ── Auth: admin only
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return respond({ error: 'Forbidden: admin role required' }, 403)
  }

  // ── Parse body
  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return respond({ error: 'Invalid JSON body' }, 400)
  }

  const { action, payoutId, reason, notes } = body

  if (!action || !payoutId) {
    return respond({ error: 'Missing required fields: action, payoutId' }, 400)
  }

  const VALID_ACTIONS: Action[] = ['approve', 'reject', 'process', 'complete']
  if (!VALID_ACTIONS.includes(action)) {
    return respond({
      error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`,
    }, 400)
  }

  if (action === 'reject' && !reason) {
    return respond({ error: 'reason is required when action is "reject"' }, 400)
  }

  // ── Fetch payout to verify it exists and get current state
  const { data: payout, error: fetchError } = await adminClient
    .from('payouts')
    .select('id, vendor_id, amount, status')
    .eq('id', payoutId)
    .single()

  if (fetchError || !payout) {
    return respond({ error: 'Payout not found' }, 404)
  }

  // ── State machine: validate allowed transitions
  const TRANSITIONS: Record<Action, string> = {
    approve:  'pending',
    reject:   'pending',
    process:  'approved',
    complete: 'processing',
  }

  if (payout.status !== TRANSITIONS[action]) {
    return respond({
      error: `Cannot ${action} a payout with status "${payout.status}". Expected "${TRANSITIONS[action]}".`,
    }, 422)
  }

  // ── Execute the action
  try {
    switch (action) {
      case 'approve':  return await handleApprove(adminClient, payout, user.id, notes)
      case 'reject':   return await handleReject(adminClient, payout, user.id, reason!, notes)
      case 'process':  return await handleProcess(adminClient, payout, user.id)
      case 'complete': return await handleComplete(adminClient, payout, user.id)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return respond({ success: false, error: message }, 500)
  }
})

// ──────────────────────────────────────────────────────────
// approve
// ──────────────────────────────────────────────────────────
async function handleApprove(
  db: ReturnType<typeof createClient>,
  payout: { id: string; vendor_id: string; amount: number },
  adminId: string,
  notes?: string,
): Promise<Response> {
  const { error } = await db
    .from('payouts')
    .update({
      status:      'approved',
      approved_by: adminId,
      approved_at: new Date().toISOString(),
      notes:       notes ?? null,
    })
    .eq('id', payout.id)

  if (error) throw error

  await logAudit(db, payout, 'approved', 'pending', 'approved', adminId)

  return respond({ success: true, payoutId: payout.id, newStatus: 'approved' })
}

// ──────────────────────────────────────────────────────────
// reject
// ──────────────────────────────────────────────────────────
async function handleReject(
  db: ReturnType<typeof createClient>,
  payout: { id: string; vendor_id: string; amount: number },
  adminId: string,
  reason: string,
  notes?: string,
): Promise<Response> {
  const { error } = await db
    .from('payouts')
    .update({
      status:       'rejected',
      rejected_by:  adminId,
      rejected_at:  new Date().toISOString(),
      reject_reason: reason,
      notes:        notes ?? null,
    })
    .eq('id', payout.id)

  if (error) throw error

  await logAudit(db, payout, 'rejected', 'pending', 'rejected', adminId, { reason })

  return respond({ success: true, payoutId: payout.id, newStatus: 'rejected' })
}

// ──────────────────────────────────────────────────────────
// process (bank transfer)
// ──────────────────────────────────────────────────────────
async function handleProcess(
  db: ReturnType<typeof createClient>,
  payout: { id: string; vendor_id: string; amount: number },
  adminId: string,
): Promise<Response> {
  const { data, error } = await db.rpc('process_payout_bank_transfer', {
    p_payout_id: payout.id,
    p_vendor_id: payout.vendor_id,
    p_amount:    payout.amount,
  })

  if (error) throw error
  if (!data?.success) throw new Error(data?.error ?? 'RPC returned failure')

  await logAudit(db, payout, 'processing_started', 'approved', 'processing', adminId, {
    transaction_id: data.transaction_id,
    gateway:        'bank_transfer',
  })

  return respond({
    success:         true,
    payoutId:        payout.id,
    newStatus:       'processing',
    referenceNumber: data.reference_number,
  })
}

// ──────────────────────────────────────────────────────────
// complete
// ──────────────────────────────────────────────────────────
async function handleComplete(
  db: ReturnType<typeof createClient>,
  payout: { id: string; vendor_id: string; amount: number },
  adminId: string,
): Promise<Response> {
  const { error } = await db.rpc('complete_payout', {
    p_payout_id: payout.id,
  })

  if (error) throw error

  await logAudit(db, payout, 'completed', 'processing', 'completed', adminId)

  return respond({ success: true, payoutId: payout.id, newStatus: 'completed' })
}

// ──────────────────────────────────────────────────────────
// Audit helper
// ──────────────────────────────────────────────────────────
async function logAudit(
  db: ReturnType<typeof createClient>,
  payout: { id: string; amount: number },
  action: string,
  prevStatus: string,
  newStatus: string,
  adminId: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  // Ignore audit failures — they must not roll back the main operation
  await db.rpc('log_financial_audit', {
    p_entity_type:     'payout',
    p_entity_id:       payout.id,
    p_action:          action,
    p_previous_status: prevStatus,
    p_new_status:      newStatus,
    p_amount:          payout.amount,
    p_details:         { ...details, processed_by: adminId },
    p_reason:          null,
  }).maybeSingle()
}
