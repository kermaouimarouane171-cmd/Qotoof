import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const allowedStages = new Set(['first', 'second'])
const allowedSecondStageStatuses = new Set([
  'shipped',
  'on_the_way',
  'driver_assigned',
  'driver_accepted',
  'driver_picked_up',
  'delivered',
  'payment_received',
])

const stageFieldMap = {
  first: {
    amountField: 'first_payment_amount',
    statusField: 'first_payment_status',
    receiptField: 'first_payment_receipt_url',
    paidAtField: 'first_payment_paid_at',
  },
  second: {
    amountField: 'second_payment_amount',
    statusField: 'second_payment_status',
    receiptField: 'second_payment_receipt_url',
    paidAtField: 'second_payment_paid_at',
  },
} as const

type Stage = keyof typeof stageFieldMap

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = await req.json()
    const orderId = typeof body?.orderId === 'string' && body.orderId.trim() ? body.orderId.trim() : ''
    const stage = typeof body?.stage === 'string' ? body.stage.trim().toLowerCase() : ''
    const storagePath = typeof body?.storagePath === 'string' && body.storagePath.trim() ? body.storagePath.trim() : ''

    if (!orderId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!allowedStages.has(stage)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unsupported payment stage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!storagePath || !storagePath.startsWith(`${user.id}/`)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid receipt storage path' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const stageKey = stage as Stage
    const config = stageFieldMap[stageKey]

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        buyer_id,
        payment_type,
        status,
        first_payment_amount,
        first_payment_status,
        second_payment_amount,
        second_payment_status
      `)
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (order.buyer_id !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: 'You do not have access to this order' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const amount = Number(order[config.amountField] || 0)
    const currentStatus = String(order[config.statusField] || 'pending')

    if (amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No payment amount is due for this stage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (currentStatus === 'verified') {
      return new Response(
        JSON.stringify({ success: false, error: 'This payment receipt has already been verified' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (stageKey === 'second') {
      if (order.payment_type !== 'split') {
        return new Response(
          JSON.stringify({ success: false, error: 'Second payment receipts are only allowed for split payments' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      if (String(order.first_payment_status || 'pending') !== 'verified') {
        return new Response(
          JSON.stringify({ success: false, error: 'First payment must be verified before uploading the second receipt' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      if (!allowedSecondStageStatuses.has(String(order.status || ''))) {
        return new Response(
          JSON.stringify({ success: false, error: 'Second payment receipt is not available yet for this order status' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    const now = new Date().toISOString()
    const updatePayload = {
      [config.receiptField]: storagePath,
      [config.paidAtField]: now,
      [config.statusField]: 'paid',
      updated_at: now,
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updatePayload)
      .eq('id', orderId)
      .eq('buyer_id', user.id)
      .select('*')
      .single()

    if (updateError || !updatedOrder) {
      throw updateError || new Error('Failed to update order payment receipt')
    }

    // Outbox: async SMS to vendor notifying of receipt upload — non-blocking
    await supabase.from('domain_events_outbox').insert({
      event_type: 'payment.receipt_uploaded',
      payload: {
        order_id: orderId,
        order_number: updatedOrder.order_number ?? null,
        buyer_id: user.id,
        vendor_id: updatedOrder.vendor_id ?? null,
        stage,
      },
      source_function: 'register-payment-receipt',
    })

    return new Response(
      JSON.stringify({ success: true, order: updatedOrder }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Register payment receipt error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to register payment receipt' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})