import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const allowedPriorities = new Set(['low', 'normal', 'high'])

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
    const subject = String(body?.subject || '').trim()
    const description = String(body?.description || '').trim()
    const category = String(body?.category || 'general').trim() || 'general'
    const priority = String(body?.priority || 'normal').trim().toLowerCase()
    const orderId = typeof body?.orderId === 'string' && body.orderId.trim() ? body.orderId.trim() : null
    const attachments = Array.isArray(body?.attachments)
      ? body.attachments.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : []

    if (subject.length < 3 || subject.length > 140) {
      return new Response(
        JSON.stringify({ success: false, error: 'Subject must be between 3 and 140 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (description.length < 10 || description.length > 5000) {
      return new Response(
        JSON.stringify({ success: false, error: 'Description must be between 10 and 5000 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (!allowedPriorities.has(priority)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unsupported priority value' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    if (orderId) {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, buyer_id, vendor_id, driver_id')
        .eq('id', orderId)
        .single()

      if (orderError || !order) {
        return new Response(
          JSON.stringify({ success: false, error: 'Order not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }

      if (order.buyer_id !== user.id && order.vendor_id !== user.id && order.driver_id !== user.id) {
        return new Response(
          JSON.stringify({ success: false, error: 'You do not have access to this order' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .insert({
        user_id: user.id,
        order_id: orderId,
        category,
        subject,
        description,
        attachments,
        priority,
        status: 'open',
      })
      .select('*')
      .single()

    if (ticketError) {
      throw ticketError
    }

    return new Response(
      JSON.stringify({ success: true, ticket }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Create support ticket error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed to create support ticket' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})