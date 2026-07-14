// ============================================
// Supabase Edge Function: paypal-webhook
// Handles PayPal webhook events for payment lifecycle management.
// Verifies webhook authenticity, processes events idempotently.
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAYPAL_CLIENT_ID = Deno.env.get('VITE_PAYPAL_CLIENT_ID')
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET')
const PAYPAL_API_BASE = Deno.env.get('PAYPAL_API_BASE')
  || (Deno.env.get('VITE_PAYMENT_MODE') === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com')
const PAYPAL_WEBHOOK_ID = Deno.env.get('PAYPAL_WEBHOOK_ID')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, paypal-transmission-id, paypal-transmission-time, paypal-cert-url, paypal-auth-algo, paypal-transmission-sig, paypal-webhook-id',
}

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })

// ============================================
// PayPal Webhook Verification
// ============================================

type WebhookHeaders = {
  transmissionId: string
  transmissionTime: string
  certUrl: string
  authAlgo: string
  transmissionSig: string
  webhookId: string
}

const extractWebhookHeaders = (req: Request): WebhookHeaders | null => {
  const transmissionId = req.headers.get('paypal-transmission-id')
  const transmissionTime = req.headers.get('paypal-transmission-time')
  const certUrl = req.headers.get('paypal-cert-url')
  const authAlgo = req.headers.get('paypal-auth-algo')
  const transmissionSig = req.headers.get('paypal-transmission-sig')
  const webhookId = req.headers.get('paypal-webhook-id') || PAYPAL_WEBHOOK_ID

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig || !webhookId) {
    return null
  }

  return { transmissionId, transmissionTime, certUrl, authAlgo, transmissionSig, webhookId }
}

const getPayPalAccessToken = async (): Promise<string> => {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials are not configured')
  }

  const credentials = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)

  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  const data = await response.json()

  if (!response.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || 'Unable to get PayPal access token')
  }

  return data.access_token as string
}

const verifyWebhookSignature = async (
  headers: WebhookHeaders,
  rawBody: string,
): Promise<boolean> => {
  const accessToken = await getPayPalAccessToken()

  const verificationPayload = {
    auth_algo: headers.authAlgo,
    cert_url: headers.certUrl,
    transmission_id: headers.transmissionId,
    transmission_sig: headers.transmissionSig,
    transmission_time: headers.transmissionTime,
    webhook_id: headers.webhookId,
    webhook_event: JSON.parse(rawBody),
  }

  const response = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(verificationPayload),
  })

  if (!response.ok) {
    const errorData = await response.text()
    console.error('[paypal-webhook] Verification API call failed:', response.status, errorData)
    return false
  }

  const data = await response.json()
  const verificationStatus = String(data?.verification_status || '').toUpperCase()

  return verificationStatus === 'SUCCESS'
}

// ============================================
// Idempotency: Event Log
// ============================================

type EventLogResult = {
  alreadyProcessed: boolean
  error?: string
}

const checkEventAlreadyProcessed = async (
  client: ReturnType<typeof createClient>,
  eventId: string,
): Promise<EventLogResult> => {
  const { data, error } = await client
    .from('paypal_webhook_events')
    .select('id, processed_at')
    .eq('paypal_event_id', eventId)
    .maybeSingle()

  if (error) {
    return { alreadyProcessed: false, error: error.message }
  }

  return { alreadyProcessed: Boolean(data) }
}

const recordEventProcessed = async (
  client: ReturnType<typeof createClient>,
  eventId: string,
  eventType: string,
  result: string,
): Promise<{ error?: string }> => {
  const { error } = await client
    .from('paypal_webhook_events')
    .insert({
      paypal_event_id: eventId,
      event_type: eventType,
      result,
      processed_at: new Date().toISOString(),
    })

  if (error) {
    return { error: error.message }
  }

  return {}
}

// ============================================
// Event Handlers
// ============================================

type PayPalResource = {
  id?: string
  status?: string
  amount?: { value?: string; currency_code?: string }
  note_to_payer?: string
  custom_id?: string
  supplementary_data?: { related_ids?: { order_id?: string } }
  links?: Array<{ href?: string; rel?: string }>
} & Record<string, unknown>

type PayPalWebhookEvent = {
  id: string
  event_type: string
  resource_type?: string
  resource?: PayPalResource
  summary?: string
  create_time?: string
} & Record<string, unknown>

const resolveOrderIdFromResource = (resource: PayPalResource): string | null => {
  if (resource.custom_id) return resource.custom_id
  if (resource.supplementary_data?.related_ids?.order_id) {
    return resource.supplementary_data.related_ids.order_id
  }
  return null
}

const findPaymentByTransactionId = async (
  client: ReturnType<typeof createClient>,
  transactionId: string,
): Promise<{ id: string; order_id: string | null; status: string | null } | null> => {
  const { data, error } = await client
    .from('payments')
    .select('id, order_id, status')
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[paypal-webhook] Error finding payment by transaction_id:', error.message)
    return null
  }

  return data
}

const findPaymentByOrderId = async (
  client: ReturnType<typeof createClient>,
  orderId: string,
): Promise<{ id: string; order_id: string | null; status: string | null } | null> => {
  const { data, error } = await client
    .from('payments')
    .select('id, order_id, status')
    .eq('order_id', orderId)
    .eq('payment_method', 'paypal')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[paypal-webhook] Error finding payment by order_id:', error.message)
    return null
  }

  return data
}

// -- CHECKOUT.ORDER.APPROVED --
const handleOrderApproved = async (
  client: ReturnType<typeof createClient>,
  event: PayPalWebhookEvent,
): Promise<string> => {
  const paypalOrderId = event.resource?.id
  if (!paypalOrderId) {
    console.warn('[paypal-webhook] CHECKOUT.ORDER.APPROVED: missing resource.id')
    return 'skipped_missing_resource_id'
  }

  const payment = await findPaymentByTransactionId(client, paypalOrderId)
  if (!payment) {
    console.warn(`[paypal-webhook] CHECKOUT.ORDER.APPROVED: no local payment for PayPal order ${paypalOrderId}`)
    return 'skipped_no_local_payment'
  }

  // Only update if payment is still pending — don't downgrade completed/refunded
  if (payment.status === 'pending') {
    const { error } = await client
      .from('payments')
      .update({
        status: 'pending',
        transaction_id: paypalOrderId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)

    if (error) {
      console.error('[paypal-webhook] CHECKOUT.ORDER.APPROVED: failed to update payment:', error.message)
      return 'db_error'
    }
  }

  console.log(`[paypal-webhook] CHECKOUT.ORDER.APPROVED: recorded for payment ${payment.id}`)
  return 'processed'
}

// -- SUBSCRIPTION PAYMENT HANDLER --
// Handles subscription payments identified by custom_id format: sub:vendorId:planId:billingCycle:timestamp
const handleSubscriptionPayment = async (
  client: ReturnType<typeof createClient>,
  event: PayPalWebhookEvent,
): Promise<string> => {
  const customId = event.resource?.custom_id ||
    event.resource?.supplementary_data?.related_ids?.order_id ||
    null

  if (!customId || !customId.startsWith('sub:')) {
    return 'not_subscription'
  }

  // Parse: sub:vendorId:planId:billingCycle:timestamp
  const parts = customId.split(':')
  if (parts.length < 4) {
    console.warn(`[paypal-webhook] Subscription payment: invalid custom_id format: ${customId}`)
    return 'invalid_subscription_format'
  }

  const vendorId = parts[1]
  const planId = parts[2]
  const billingCycle = parts[3] || 'monthly'

  if (!vendorId || !planId) {
    console.warn(`[paypal-webhook] Subscription payment: missing vendorId or planId in ${customId}`)
    return 'missing_subscription_fields'
  }

  // Validate planId
  const validPlans = ['basic', 'pro', 'enterprise']
  if (!validPlans.includes(planId)) {
    console.warn(`[paypal-webhook] Subscription payment: invalid planId: ${planId}`)
    return 'invalid_plan_id'
  }

  const now = new Date().toISOString()
  const subscriptionEnd = billingCycle === 'yearly'
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // Update vendor's subscription
  const { error: profileError } = await client
    .from('profiles')
    .update({
      subscription_plan: planId,
      subscription_status: 'active',
      subscription_start: now,
      subscription_end: subscriptionEnd,
      trial_ends_at: null,
      updated_at: now,
    })
    .eq('id', vendorId)

  if (profileError) {
    console.error(`[paypal-webhook] Subscription payment: failed to update profile for vendor ${vendorId}:`, profileError.message)
    return 'db_error'
  }

  // Log in subscription_history
  const { error: historyError } = await client
    .from('subscription_history')
    .insert({
      vendor_id: vendorId,
      old_plan: 'free',
      new_plan: planId,
      change_type: 'upgrade',
      amount: event.resource?.amount?.value ? Number(event.resource.amount.value) : null,
      reason: `PayPal subscription payment (${billingCycle})`,
    })

  if (historyError) {
    console.error(`[paypal-webhook] Subscription payment: failed to log history for vendor ${vendorId}:`, historyError.message)
    // Don't fail — the subscription was already updated
  }

  console.log(`[paypal-webhook] Subscription payment: vendor ${vendorId} upgraded to ${planId} (${billingCycle})`)
  return 'subscription_activated'
}

// -- PAYMENT.CAPTURE.COMPLETED --
const handleCaptureCompleted = async (
  client: ReturnType<typeof createClient>,
  event: PayPalWebhookEvent,
): Promise<string> => {
  const captureId = event.resource?.id
  const paypalOrderId = resolveOrderIdFromResource(event.resource || {})

  if (!captureId && !paypalOrderId) {
    console.warn('[paypal-webhook] PAYMENT.CAPTURE.COMPLETED: missing capture_id and order_id')
    return 'skipped_missing_references'
  }

  // Check if this is a subscription payment first
  const customId = event.resource?.custom_id ||
    event.resource?.supplementary_data?.related_ids?.order_id ||
    null
  if (customId && customId.startsWith('sub:')) {
    return handleSubscriptionPayment(client, event)
  }

  // Try to find payment by PayPal order ID (stored as transaction_id)
  let payment: { id: string; order_id: string | null; status: string | null } | null = null

  if (paypalOrderId) {
    payment = await findPaymentByTransactionId(client, paypalOrderId)
  }

  if (!payment && captureId) {
    // Try by gateway_transaction_id if we stored capture ID there
    const { data, error } = await client
      .from('payments')
      .select('id, order_id, status')
      .eq('gateway_transaction_id', captureId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!error) {
      payment = data
    }
  }

  if (!payment) {
    console.warn(`[paypal-webhook] PAYMENT.CAPTURE.COMPLETED: no local payment for capture ${captureId}, order ${paypalOrderId}`)
    return 'skipped_no_local_payment'
  }

  // Don't downgrade refunded payments
  if (payment.status === 'refunded') {
    console.log(`[paypal-webhook] PAYMENT.CAPTURE.COMPLETED: payment ${payment.id} already refunded, skipping`)
    return 'skipped_already_refunded'
  }

  // Update payment to completed
  const now = new Date().toISOString()
  const { error: paymentError } = await client
    .from('payments')
    .update({
      status: 'completed',
      gateway_transaction_id: captureId || null,
      confirmed_at: now,
      updated_at: now,
    })
    .eq('id', payment.id)

  if (paymentError) {
    console.error('[paypal-webhook] PAYMENT.CAPTURE.COMPLETED: failed to update payment:', paymentError.message)
    return 'db_error'
  }

  // Update order payment_status
  if (payment.order_id) {
    const { error: orderError } = await client
      .from('orders')
      .update({
        payment_status: 'paid',
        updated_at: now,
      })
      .eq('id', payment.order_id)

    if (orderError) {
      console.error('[paypal-webhook] PAYMENT.CAPTURE.COMPLETED: failed to update order:', orderError.message)
      // Payment was updated, so still count as processed
    }
  }

  console.log(`[paypal-webhook] PAYMENT.CAPTURE.COMPLETED: payment ${payment.id} marked completed`)
  return 'processed'
}

// -- PAYMENT.CAPTURE.REFUNDED --
const handleCaptureRefunded = async (
  client: ReturnType<typeof createClient>,
  event: PayPalWebhookEvent,
): Promise<string> => {
  const refundId = event.resource?.id
  const captureId = event.resource?.links?.find((l) => l.rel === 'up')?.href?.split('/').pop() || null
  const refundAmount = event.resource?.amount?.value
  const refundCurrency = event.resource?.amount?.currency_code

  if (!refundId) {
    console.warn('[paypal-webhook] PAYMENT.CAPTURE.REFUNDED: missing refund id')
    return 'skipped_missing_refund_id'
  }

  // Find payment by capture ID (stored as gateway_transaction_id)
  let payment: { id: string; order_id: string | null; status: string | null } | null = null

  if (captureId) {
    const { data, error } = await client
      .from('payments')
      .select('id, order_id, status')
      .eq('gateway_transaction_id', captureId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!error) {
      payment = data
    }
  }

  if (!payment) {
    // Try by transaction_id (PayPal order ID) from supplementary_data
    const orderId = resolveOrderIdFromResource(event.resource || {})
    if (orderId) {
      payment = await findPaymentByTransactionId(client, orderId)
    }
  }

  if (!payment) {
    console.warn(`[paypal-webhook] PAYMENT.CAPTURE.REFUNDED: no local payment for refund ${refundId}`)
    return 'skipped_no_local_payment'
  }

  // Check if refund record already exists (idempotency)
  const { data: existingRefund } = await client
    .from('refunds')
    .select('id')
    .eq('payment_id', payment.id)
    .eq('gateway_response->id', refundId)
    .maybeSingle()

  if (existingRefund) {
    console.log(`[paypal-webhook] PAYMENT.CAPTURE.REFUNDED: refund ${refundId} already recorded`)
    return 'skipped_duplicate_refund'
  }

  // Create refund record
  const { error: refundError } = await client
    .from('refunds')
    .insert({
      payment_id: payment.id,
      order_id: payment.order_id,
      amount: refundAmount ? Number(refundAmount) : 0,
      reason: event.resource?.note_to_payer || 'PayPal webhook refund',
      status: 'completed',
      gateway_response: {
        id: refundId,
        capture_id: captureId,
        amount: refundAmount,
        currency: refundCurrency,
        event_id: event.id,
      },
    })

  if (refundError) {
    console.error('[paypal-webhook] PAYMENT.CAPTURE.REFUNDED: failed to create refund record:', refundError.message)
    return 'db_error'
  }

  // Update payment status to refunded
  const now = new Date().toISOString()
  const { error: paymentError } = await client
    .from('payments')
    .update({
      status: 'refunded',
      updated_at: now,
    })
    .eq('id', payment.id)

  if (paymentError) {
    console.error('[paypal-webhook] PAYMENT.CAPTURE.REFUNDED: failed to update payment status:', paymentError.message)
  }

  // Update order payment_status
  if (payment.order_id) {
    const { error: orderError } = await client
      .from('orders')
      .update({
        payment_status: 'refunded',
        updated_at: now,
      })
      .eq('id', payment.order_id)

    if (orderError) {
      console.error('[paypal-webhook] PAYMENT.CAPTURE.REFUNDED: failed to update order:', orderError.message)
    }
  }

  console.log(`[paypal-webhook] PAYMENT.CAPTURE.REFUNDED: refund ${refundId} recorded for payment ${payment.id}`)
  return 'processed'
}

// -- PAYMENT.CAPTURE.DENIED --
const handleCaptureDenied = async (
  client: ReturnType<typeof createClient>,
  event: PayPalWebhookEvent,
): Promise<string> => {
  const captureId = event.resource?.id
  const paypalOrderId = resolveOrderIdFromResource(event.resource || {})

  if (!captureId && !paypalOrderId) {
    console.warn('[paypal-webhook] PAYMENT.CAPTURE.DENIED: missing references')
    return 'skipped_missing_references'
  }

  let payment: { id: string; order_id: string | null; status: string | null } | null = null

  if (paypalOrderId) {
    payment = await findPaymentByTransactionId(client, paypalOrderId)
  }

  if (!payment && captureId) {
    const { data, error } = await client
      .from('payments')
      .select('id, order_id, status')
      .eq('gateway_transaction_id', captureId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!error) {
      payment = data
    }
  }

  if (!payment) {
    console.warn(`[paypal-webhook] PAYMENT.CAPTURE.DENIED: no local payment for capture ${captureId}, order ${paypalOrderId}`)
    return 'skipped_no_local_payment'
  }

  // Don't downgrade refunded or completed payments
  if (payment.status === 'refunded' || payment.status === 'completed') {
    console.log(`[paypal-webhook] PAYMENT.CAPTURE.DENIED: payment ${payment.id} already ${payment.status}, skipping`)
    return `skipped_already_${payment.status}`
  }

  const now = new Date().toISOString()
  const { error: paymentError } = await client
    .from('payments')
    .update({
      status: 'failed',
      failure_reason: `PayPal capture denied (event ${event.id})`,
      updated_at: now,
    })
    .eq('id', payment.id)

  if (paymentError) {
    console.error('[paypal-webhook] PAYMENT.CAPTURE.DENIED: failed to update payment:', paymentError.message)
    return 'db_error'
  }

  if (payment.order_id) {
    const { error: orderError } = await client
      .from('orders')
      .update({
        payment_status: 'failed',
        updated_at: now,
      })
      .eq('id', payment.order_id)

    if (orderError) {
      console.error('[paypal-webhook] PAYMENT.CAPTURE.DENIED: failed to update order:', orderError.message)
    }
  }

  console.log(`[paypal-webhook] PAYMENT.CAPTURE.DENIED: payment ${payment.id} marked failed`)
  return 'processed'
}

// ============================================
// Event Router
// ============================================

const SUPPORTED_EVENTS = new Set([
  'CHECKOUT.ORDER.APPROVED',
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.REFUNDED',
  'PAYMENT.CAPTURE.DENIED',
])

const handleEvent = async (
  client: ReturnType<typeof createClient>,
  event: PayPalWebhookEvent,
): Promise<string> => {
  switch (event.event_type) {
    case 'CHECKOUT.ORDER.APPROVED':
      return handleOrderApproved(client, event)
    case 'PAYMENT.CAPTURE.COMPLETED':
      return handleCaptureCompleted(client, event)
    case 'PAYMENT.CAPTURE.REFUNDED':
      return handleCaptureRefunded(client, event)
    case 'PAYMENT.CAPTURE.DENIED':
      return handleCaptureDenied(client, event)
    default:
      console.warn(`[paypal-webhook] Unsupported event type: ${event.event_type}`)
      return 'unsupported_event'
  }
}

// ============================================
// Main Handler
// ============================================

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405)
    }

    // Extract and validate webhook headers
    const webhookHeaders = extractWebhookHeaders(req)
    if (!webhookHeaders) {
      console.warn('[paypal-webhook] Missing required PayPal signature headers')
      return jsonResponse({ error: 'Missing required signature headers' }, 400)
    }

    // Get raw body for verification
    const rawBody = await req.text()

    // Parse the event
    let event: PayPalWebhookEvent
    try {
      event = JSON.parse(rawBody)
    } catch {
      console.error('[paypal-webhook] Failed to parse webhook body as JSON')
      return jsonResponse({ error: 'Invalid JSON body' }, 400)
    }

    if (!event.id || !event.event_type) {
      console.warn('[paypal-webhook] Missing event id or event_type')
      return jsonResponse({ error: 'Missing event id or event_type' }, 400)
    }

    // Verify webhook signature with PayPal
    let verified = false
    try {
      verified = await verifyWebhookSignature(webhookHeaders, rawBody)
    } catch (err) {
      console.error('[paypal-webhook] Verification error:', err instanceof Error ? err.message : 'unknown')
      return jsonResponse({ error: 'Webhook verification failed' }, 401)
    }

    if (!verified) {
      console.warn(`[paypal-webhook] Verification failed for event ${event.id}`)
      return jsonResponse({ error: 'Webhook verification failed' }, 401)
    }

    // Create Supabase admin client
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[paypal-webhook] Missing Supabase environment variables')
      return jsonResponse({ error: 'Server configuration error' }, 500)
    }

    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Idempotency: check if event was already processed
    const eventLogResult = await checkEventAlreadyProcessed(client, event.id)
    if (eventLogResult.error) {
      console.error(`[paypal-webhook] Error checking event log for ${event.id}:`, eventLogResult.error)
      // Continue processing — better to risk duplicate than to miss event
    } else if (eventLogResult.alreadyProcessed) {
      console.log(`[paypal-webhook] Event ${event.id} already processed, skipping`)
      return jsonResponse({ received: true, status: 'already_processed' }, 200)
    }

    // Handle the event
    const result = await handleEvent(client, event)

    // Record event in log
    const recordResult = await recordEventProcessed(client, event.id, event.event_type, result)
    if (recordResult.error) {
      console.error(`[paypal-webhook] Failed to record event ${event.id} in log:`, recordResult.error)
      // Don't fail the response — event was processed
    }

    console.log(`[paypal-webhook] Event ${event.id} (${event.event_type}) processed: ${result}`)

    // Return 200 for all verified events, including unsupported ones
    // This prevents PayPal from retrying
    return jsonResponse({ received: true, status: result }, 200)
  } catch (error) {
    console.error('[paypal-webhook] Unhandled error:', error instanceof Error ? error.message : 'unknown')
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
})
