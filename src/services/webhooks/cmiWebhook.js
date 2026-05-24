import { supabase } from '@/services/supabase'

/**
 * CMI (Centre Monétique Interbancaire) Webhook Handler
 * Legacy reference module only. Active marketplace checkout does not use CMI initiation anymore.
 * CMI is Morocco's national interbank payment network.
 * 
 * NOTE: Webhook verification must be done server-side (Supabase Edge Function).
 * This module provides client-side payment status polling + Edge Function code.
 */

// ─────────────────────────────────────────────────────────────────
// SUPABASE EDGE FUNCTION CODE (deploy as supabase/functions/cmi-webhook/index.ts)
// ─────────────────────────────────────────────────────────────────
export const CMI_EDGE_FUNCTION = `
import { createClient } from 'https://esm.sh/@supabase/supabase-js'
import { createHash } from 'https://deno.land/std/hash/mod.ts'

function verifyCMISignature(payload, signature, storeKey) {
  const sortedKeys = Object.keys(payload).filter(k => k !== 'HASH').sort()
  const hashInput = storeKey + sortedKeys.map(k => payload[k]).join('') + storeKey
  const expected = createHash('md5').update(hashInput).toString('hex').toUpperCase()
  return expected === signature?.toUpperCase()
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  
  const body = await req.json()
  const storeKey = Deno.env.get('CMI_STORE_KEY')
  
  if (!verifyCMISignature(body, body.HASH, storeKey)) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  const transactionId = body.TRANID || body.OID
  const status = body.RETCODE // '00' = success in CMI

  try {
    if (status === '00') {
      // Delegate state transition to payment-status-write edge function
      // provider: 'cmi', status: 'succeeded', referenceId: body.OID, transactionId: transactionId
    } else {
      // Delegate state transition to payment-status-write edge function
      // provider: 'cmi', status: 'failed', referenceId: body.OID
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }

  // CMI requires "ACTION=POSTAUTH" response for approval
  return new Response(status === '00' ? 'ACTION=POSTAUTH' : 'ACTION=FAIL', { 
    status: 200, 
    headers: { 'Content-Type': 'text/plain' } 
  })
})
`

/**
 * Secure payment state write through Edge Function.
 * Requires authenticated user; authorization is enforced server-side.
 */
export async function writeCMIPaymentStatus({
  status,
  referenceId,
  orderId,
  failureReason,
  transactionId,
}) {
  const { data, error } = await supabase.functions.invoke('payment-status-write', {
    body: {
      provider: 'cmi',
      status,
      referenceId,
      orderId,
      failureReason,
      transactionId,
    },
  })

  if (error) {
    return { success: false, error: error.message || 'Edge function invocation failed' }
  }

  return data
}

/**
 * Subscribe to real-time CMI payment updates
 */
export function subscribeToCMIPaymentUpdates(orderId, callback) {
  const channel = supabase
    .channel(`cmi-payment:${orderId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'orders',
      filter: `id=eq.${orderId}`,
    }, (payload) => {
      const order = payload.new
      if (order.payment_status === 'paid') callback({ success: true, order })
      else if (order.payment_status === 'failed') callback({ success: false, order })
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}

/**
 * Build CMI payment form parameters (client-side redirect to CMI portal)
 */
export function buildCMIPaymentParams({ orderId, amount, currency: _currency = 'MAD', customer }) {
  const merchantId = import.meta.env.VITE_CMI_MERCHANT_ID
  const callbackUrl = `${window.location.origin}/api/webhooks/cmi`
  const okUrl = `${window.location.origin}/orders/${orderId}/confirmation`
  const failUrl = `${window.location.origin}/checkout?error=payment_failed`

  return {
    clientid: merchantId,
    amount: amount.toFixed(2),
    currency: '504', // MAD ISO 4217 code
    oid: orderId,
    okurl: okUrl,
    failurl: failUrl,
    callbackUrl,
    storetype: '3d_pay_hosting',
    lang: 'ar',
    email: customer?.email || '',
    BillToName: customer?.name || '',
  }
}
