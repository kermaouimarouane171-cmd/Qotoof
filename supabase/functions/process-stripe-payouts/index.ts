// ============================================
// Supabase Edge Function: process-stripe-payouts
// Processes pending payout records for vendors and drivers.
// Since Morocco is not supported by Stripe Connect, payouts are
// sent via Stripe Global Payouts to Moroccan bank accounts (MAD).
// This function can be triggered:
//   1. Manually by an admin
//   2. Via a cron schedule (e.g. daily)
//   3. Automatically after order delivery confirmation
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'
import Stripe from 'https://esm.sh/stripe@14.7.0?target=deno'
import { requireRole } from '../_shared/auth.ts'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
)

const json = (body: unknown, status = 200, req?: Request) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...(req ? getCorsHeaders(req.headers.get('Origin')) : {}), 'Content-Type': 'application/json' },
  })

// Convert MAD amount to cents (Stripe requires smallest currency unit)
const toCents = (amount: number) => Math.round(Number(amount) * 100)

serve(async (req) => {
  const optionsResponse = handleOptions(req)
  if (optionsResponse) return optionsResponse

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, req)
    }

    // Only admins can trigger payout processing
    let isAdmin = false
    try {
      const auth = await requireRole(req, ['admin'])
      isAdmin = !!auth.userId
    } catch {
      // If auth fails, check if this is a cron invocation (service role)
      const authHeader = req.headers.get('Authorization') || ''
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      if (authHeader.replace('Bearer ', '') !== serviceKey) {
        return json({ error: 'Unauthorized' }, 401, req)
      }
    }

    const body = await req.json().catch(() => ({}))
    const { payoutId, recipientId, status = 'pending' } = body

    // If a specific payout ID is provided, process just that one
    if (payoutId) {
      return await processSinglePayout(payoutId, req)
    }

    // Otherwise, fetch all pending payouts (optionally filtered by recipient)
    let query = supabase
      .from('payout_records')
      .select(`
        id, order_id, recipient_id, recipient_type, amount, currency, status,
        stripe_payment_intent_id, stripe_payout_id
      `)
      .eq('status', status)

    if (recipientId) {
      query = query.eq('recipient_id', recipientId)
    }

    const { data: payouts, error: fetchError } = await await query.limit(50)

    if (fetchError) {
      return json({ error: 'Failed to fetch payouts', details: fetchError.message }, 500, req)
    }

    if (!payouts || payouts.length === 0) {
      return json({ message: 'No pending payouts to process', processed: 0 }, 200, req)
    }

    console.log(`Processing ${payouts.length} pending payouts`)

    const results: Array<Record<string, unknown>> = []

    for (const payout of payouts) {
      const result = await processPayoutRecord(payout)
      results.push(result)
    }

    const succeeded = results.filter((r) => r.status === 'paid').length
    const failed = results.filter((r) => r.status === 'failed').length

    return json({
      message: `Processed ${payouts.length} payouts`,
      processed: payouts.length,
      succeeded,
      failed,
      results,
    }, 200, req)
  } catch (error) {
    console.error('process-stripe-payouts error:', error)
    return json(
      { error: (error as Error).message || 'Payout processing failed' },
      500,
      req,
    )
  }
})

// ============================================
// Process a single payout record
// ============================================
async function processSinglePayout(payoutId: string, req: Request): Promise<Response> {
  const { data: payout, error } = await supabase
    .from('payout_records')
    .select(`
      id, order_id, recipient_id, recipient_type, amount, currency, status,
      stripe_payment_intent_id, stripe_payout_id
    `)
    .eq('id', payoutId)
    .single()

  if (error || !payout) {
    return json({ error: 'Payout record not found' }, 404, req)
  }

  if (payout.status !== 'pending') {
    return json({ error: `Payout is already ${payout.status}` }, 400, req)
  }

  const result = await processPayoutRecord(payout)
  return json(result, 200, req)
}

// ============================================
// Process a payout record — fetch recipient bank details and send payout
// ============================================
async function processPayoutRecord(payout: Record<string, unknown>): Promise<Record<string, unknown>> {
  const payoutId = payout.id as string
  const recipientId = payout.recipient_id as string
  const recipientType = payout.recipient_type as string
  const amount = Number(payout.amount)
  const currency = (payout.currency as string || 'MAD').toLowerCase()

  try {
    // 1. Fetch recipient's bank details from profiles
    const { data: recipient, error: recipientError } = await supabase
      .from('profiles')
      .select(`
        id, full_name, email,
        bank_account_name, bank_account_iban, bank_name, bank_swift_code,
        phone
      `)
      .eq('id', recipientId)
      .single()

    if (recipientError || !recipient) {
      await updatePayoutStatus(payoutId, 'failed', { failure_reason: 'Recipient not found' })
      return { id: payoutId, status: 'failed', error: 'Recipient not found' }
    }

    // 2. Validate bank details
    if (!recipient.bank_account_iban) {
      await updatePayoutStatus(payoutId, 'failed', { failure_reason: 'Recipient has no IBAN on file' })
      return { id: payoutId, status: 'failed', error: 'No IBAN on file for recipient' }
    }

    // 3. Mark as processing
    await updatePayoutStatus(payoutId, 'processing', {})

    // 4. Attempt Stripe Global Payout
    // Note: Stripe Global Payouts requires the recipient to have a Stripe
    // account (Account v2). For now, we create a Payout to the platform's
    // bank account and mark the payout as "pending manual transfer".
    // In production, this would use Stripe Global Payouts API to send
    // directly to the Moroccan bank account.
    try {
      const amountCents = toCents(amount)

      // Create a Stripe Payout from the platform account balance.
      // This moves funds from Stripe to the platform's bank account,
      // from which the admin manually transfers to the vendor/driver.
      // TODO: Replace with Stripe Global Payouts API when available
      // for Moroccan bank accounts in production.
      const stripePayout = await stripe.payouts.create({
        amount: amountCents,
        currency: currency,
        method: 'standard',
        metadata: {
          payout_record_id: payoutId,
          recipient_id: recipientId,
          recipient_type: recipientType,
          recipient_name: recipient.full_name || '',
          order_id: String(payout.order_id || ''),
        },
      })

      // 5. Update payout record with Stripe payout ID
      await supabase
        .from('payout_records')
        .update({
          stripe_payout_id: stripePayout.id,
          status: 'processing',
          processed_at: new Date().toISOString(),
          payment_method: 'stripe_global_payout',
        })
        .eq('id', payoutId)

      console.log(`Payout ${payoutId} initiated via Stripe: ${stripePayout.id}`)

      return {
        id: payoutId,
        status: 'processing',
        stripe_payout_id: stripePayout.id,
        amount,
        recipient: recipient.full_name,
      }
    } catch (stripeError) {
      const errorMsg = (stripeError as Error).message
      console.error(`Stripe payout failed for ${payoutId}:`, errorMsg)

      // If Stripe payout fails (e.g. insufficient balance), mark for manual processing
      await supabase
        .from('payout_records')
        .update({
          status: 'pending',
          payment_method: 'manual',
          failure_reason: `Stripe payout failed: ${errorMsg}. Marked for manual transfer.`,
          processed_at: new Date().toISOString(),
        })
        .eq('id', payoutId)

      return {
        id: payoutId,
        status: 'pending',
        error: errorMsg,
        fallback: 'manual_transfer',
      }
    }
  } catch (error) {
    const errorMsg = (error as Error).message
    await updatePayoutStatus(payoutId, 'failed', { failure_reason: errorMsg })
    return { id: payoutId, status: 'failed', error: errorMsg }
  }
}

// ============================================
// Helper: update payout status
// ============================================
async function updatePayoutStatus(
  payoutId: string,
  status: string,
  extra: Record<string, unknown>
): Promise<void> {
  await supabase
    .from('payout_records')
    .update({ status, ...extra })
    .eq('id', payoutId)
}
