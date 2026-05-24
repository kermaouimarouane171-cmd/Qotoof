import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/auth.ts'

const PROCESS_OUTBOX_SECRET = Deno.env.get('PROCESS_OUTBOX_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const SUPABASE_FUNCTIONS_URL = Deno.env.get('SUPABASE_FUNCTIONS_URL') || `${SUPABASE_URL}/functions/v1`
const BATCH_LIMIT = 10

type OutboxEvent = {
  id: string
  event_type: string
  payload: Record<string, unknown>
  retry_count: number
}

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req.headers.get('Origin')),
      'Content-Type': 'application/json',
    },
  })
}

function extractOutboxSecret(req: Request): string {
  return (
    req.headers.get('PROCESS_OUTBOX_SECRET')
    || req.headers.get('process_outbox_secret')
    || req.headers.get('x-process-outbox-secret')
    || ''
  )
}

async function invokeFunction(name: string, payload: unknown): Promise<void> {
  const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '(no body)')
    throw new Error(`${name} returned ${res.status}: ${text}`)
  }
}

async function fetchProfileContact(userId: string): Promise<{ email?: string; phone?: string }> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('email, phone')
    .eq('id', userId)
    .maybeSingle()

  return {
    email: data?.email || undefined,
    phone: data?.phone || undefined,
  }
}

async function createNotification(userId: string, title: string, message: string, type: string, data: Record<string, unknown> = {}) {
  await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      message,
      data,
      is_read: false,
      created_at: new Date().toISOString(),
    })
}

async function updateLoyaltyPoints(userId: string, payload: Record<string, unknown>) {
  const orderTotal = Number(payload.order_total ?? payload.total ?? 0)
  const pointsToAdd = Number(payload.points_earned ?? payload.loyalty_points ?? Math.max(1, Math.floor(orderTotal / 10)))

  if (!Number.isFinite(pointsToAdd) || pointsToAdd <= 0) {
    return
  }

  const { data: current } = await supabaseAdmin
    .from('loyalty_points')
    .select('points, lifetime_points')
    .eq('user_id', userId)
    .maybeSingle()

  const currentPoints = Number(current?.points ?? 0)
  const currentLifetime = Number(current?.lifetime_points ?? 0)

  await supabaseAdmin
    .from('loyalty_points')
    .upsert({
      user_id: userId,
      points: currentPoints + pointsToAdd,
      lifetime_points: currentLifetime + pointsToAdd,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  await supabaseAdmin
    .from('loyalty_transactions')
    .insert({
      user_id: userId,
      order_id: payload.order_id ?? null,
      points: pointsToAdd,
      reason: 'delivery_completed_outbox',
      created_at: new Date().toISOString(),
    })
}

async function handleOrderAccepted(payload: Record<string, unknown>) {
  const buyerId = String(payload.buyer_id || '')
  if (!buyerId) return

  const orderRef = String(payload.order_number || payload.order_id || '')
  const { email, phone } = await fetchProfileContact(buyerId)

  if (email) {
    await invokeFunction('send-email', {
      to: email,
      subject: 'تم قبول طلبك',
      data: { message: `تم قبول طلبك ${orderRef}. شكراً لتسوقك معنا.` },
    })
  }

  if (phone) {
    await invokeFunction('send-sms', {
      to: phone,
      message: `تم قبول طلبك ${orderRef}.`,
    })
  }
}

async function handleOrderRejected(payload: Record<string, unknown>) {
  const buyerId = String(payload.buyer_id || '')
  if (!buyerId) return

  const orderRef = String(payload.order_number || payload.order_id || '')
  const reason = String(payload.reason || 'غير محدد')
  const { email } = await fetchProfileContact(buyerId)

  if (email) {
    await invokeFunction('send-email', {
      to: email,
      subject: 'تم رفض طلبك',
      data: { message: `تم رفض طلبك ${orderRef}. السبب: ${reason}.` },
    })
  }
}

async function handleDeliveryAssigned(payload: Record<string, unknown>) {
  const driverId = String(payload.driver_id || '')
  if (!driverId) return

  const orderRef = String(payload.order_number || payload.order_id || '')
  await createNotification(
    driverId,
    'تم تعيين توصيل جديد',
    `تم تعيينك لتوصيل الطلب ${orderRef}.`,
    'delivery_assignment',
    payload,
  )
}

async function handleDeliveryCompleted(payload: Record<string, unknown>) {
  const buyerId = String(payload.buyer_id || '')
  if (!buyerId) return

  const orderRef = String(payload.order_number || payload.order_id || '')
  const { email, phone } = await fetchProfileContact(buyerId)

  await createNotification(
    buyerId,
    'تم اكتمال التوصيل',
    `تم توصيل طلبك ${orderRef} بنجاح.`,
    'order_update',
    payload,
  )

  if (email) {
    await invokeFunction('send-email', {
      to: email,
      subject: 'تم توصيل طلبك بنجاح',
      data: { message: `تم توصيل طلبك ${orderRef} بنجاح.` },
    })
  }

  if (phone) {
    await invokeFunction('send-sms', {
      to: phone,
      message: `تم توصيل طلبك ${orderRef} بنجاح.`,
    })
  }

  await updateLoyaltyPoints(buyerId, payload)
}

async function routeEvent(eventType: string, payload: Record<string, unknown>) {
  switch (eventType) {
    case 'order.accepted':
      await handleOrderAccepted(payload)
      break
    case 'order.rejected':
      await handleOrderRejected(payload)
      break
    case 'delivery.assigned':
      await handleDeliveryAssigned(payload)
      break
    case 'delivery.completed':
      await handleDeliveryCompleted(payload)
      break
    default:
      throw new Error(`Unsupported event type: ${eventType}`)
  }
}

async function markProcessed(eventId: string) {
  await supabaseAdmin
    .from('domain_events_outbox')
    .update({
      processed_at: new Date().toISOString(),
      error: null,
    })
    .eq('id', eventId)
}

async function markFailed(event: OutboxEvent, errorMessage: string) {
  await supabaseAdmin
    .from('domain_events_outbox')
    .update({
      retry_count: (event.retry_count || 0) + 1,
      error: errorMessage.slice(0, 2000),
    })
    .eq('id', event.id)
}

serve(async (req: Request) => {
  const optionsResponse = handleOptions(req)
  if (optionsResponse) return optionsResponse

  if (req.method !== 'POST' && req.method !== 'GET') {
    return json(req, { success: false, error: 'Method not allowed' }, 405)
  }

  if (!PROCESS_OUTBOX_SECRET) {
    return json(req, { success: false, error: 'PROCESS_OUTBOX_SECRET is not configured' }, 500)
  }

  const providedSecret = extractOutboxSecret(req)
  if (providedSecret !== PROCESS_OUTBOX_SECRET) {
    return json(req, { success: false, error: 'Unauthorized' }, 401)
  }

  const { data: events, error: fetchError } = await supabaseAdmin
    .from('domain_events_outbox')
    .select('id, event_type, payload, retry_count')
    .is('processed_at', null)
    .lt('retry_count', 3)
    .order('created_at', { ascending: true })
    .limit(BATCH_LIMIT)

  if (fetchError) {
    return json(req, { success: false, error: fetchError.message }, 500)
  }

  if (!events || events.length === 0) {
    return json(req, { success: true, processed: 0, failed: 0, total: 0 })
  }

  const results = await Promise.allSettled(
    (events as OutboxEvent[]).map(async (event) => {
      try {
        await routeEvent(event.event_type, event.payload || {})
        await markProcessed(event.id)
        return { id: event.id, processed: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await markFailed(event, message)
        return { id: event.id, processed: false, error: message }
      }
    }),
  )

  const processed = results.filter(
    (entry) => entry.status === 'fulfilled' && entry.value.processed,
  ).length
  const failed = results.length - processed

  return json(req, {
    success: true,
    processed,
    failed,
    total: events.length,
  })
})
