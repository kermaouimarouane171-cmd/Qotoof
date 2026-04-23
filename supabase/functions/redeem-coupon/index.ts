import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id

    // Parse request body
    const body = await req.json()
    const { couponCode, orderId } = body

    if (!couponCode) {
      return new Response(
        JSON.stringify({ success: false, error: 'Coupon code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!orderId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch coupon by code
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select(`
        *,
        vendor:profiles!coupons_vendor_id_fkey(id, store_name)
      `)
      .eq('code', couponCode.toUpperCase())
      .eq('is_active', true)
      .single()

    if (couponError || !coupon) {
      return new Response(
        JSON.stringify({ success: false, error: 'Coupon not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if coupon is expired
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Coupon has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if coupon has reached max uses
    const { count: totalCount, error: countError } = await supabase
      .from('coupon_redemptions')
      .select('*', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id)

    if (countError) throw countError

    if (coupon.max_uses && (totalCount || 0) >= coupon.max_uses) {
      return new Response(
        JSON.stringify({ success: false, error: 'Coupon has reached its maximum uses' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check per-user limit
    if (coupon.max_uses_per_user) {
      const { count: userUsage } = await supabase
        .from('coupon_redemptions')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id)
        .eq('user_id', userId)

      if ((userUsage || 0) >= coupon.max_uses_per_user) {
        return new Response(
          JSON.stringify({ success: false, error: 'You have already used this coupon the maximum number of times' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Check if user already redeemed this coupon for this order
    const { data: existingRedemption } = await supabase
      .from('coupon_redemptions')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('user_id', userId)
      .eq('order_id', orderId)
      .single()

    if (existingRedemption) {
      return new Response(
        JSON.stringify({ success: false, error: 'This coupon has already been applied to this order' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch order to validate and get order total
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, total, buyer_id, vendor_id')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (order.buyer_id !== userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'You do not have permission to apply coupons to this order' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check minimum order amount
    if (coupon.min_order_amount && order.total < coupon.min_order_amount) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Minimum order amount is ${coupon.min_order_amount} MAD`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Calculate discount
    let discountAmount = 0
    if (coupon.discount_type === 'percentage') {
      discountAmount = Math.round((order.total * coupon.discount_value) / 100)
    } else {
      discountAmount = coupon.discount_value
    }

    // Don't allow discount to exceed order total
    discountAmount = Math.min(discountAmount, order.total)

    // Create redemption record
    const { data: redemption, error: redeemError } = await supabase
      .from('coupon_redemptions')
      .insert({
        coupon_id: coupon.id,
        user_id: userId,
        order_id: orderId,
        redeemed_at: new Date().toISOString(),
        discount_amount: coupon.discount_type === 'fixed' ? discountAmount : null,
        discount_percentage: coupon.discount_type === 'percentage' ? coupon.discount_value : null,
        order_total: order.total,
      })
      .select()
      .single()

    if (redeemError) throw redeemError

    return new Response(
      JSON.stringify({
        success: true,
        redemption,
        discount: {
          type: coupon.discount_type,
          value: coupon.discount_value,
          amount: discountAmount,
        },
        message: `Coupon applied successfully! You saved ${discountAmount} MAD`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Redeem coupon error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
