import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

/**
 * CMI (Centre Monétique Interbancaire) Webhook Handler
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

const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

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
      await supabase.from('payments').update({ status: 'succeeded', cmi_transaction_id: transactionId, paid_at: new Date().toISOString() }).eq('cmi_order_id', body.OID)
      await supabase.from('orders').update({ status: 'confirmed', payment_status: 'paid' }).eq('id', body.OID)
      await supabase.from('audit_logs').insert({ action: 'cmi_payment_succeeded', entity_type: 'payment', entity_id: body.OID, metadata: { amount: body.AMOUNT, currency: body.CURRENCY } })
    } else {
      await supabase.from('payments').update({ status: 'failed', failure_reason: \`CMI RETCODE: \${status}\` }).eq('cmi_order_id', body.OID)
      await supabase.from('orders').update({ status: 'payment_failed', payment_status: 'failed' }).eq('id', body.OID)
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
export function buildCMIPaymentParams({ orderId, amount, currency = 'MAD', customer }) {
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
