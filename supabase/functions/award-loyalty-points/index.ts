import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Loyalty tier definitions with point multipliers
const LOYALTY_TIERS = [
  { name: 'Bronze', minPoints: 0, multiplier: 1.0 },
  { name: 'Silver', minPoints: 500, multiplier: 1.2 },
  { name: 'Gold', minPoints: 2000, multiplier: 1.5 },
  { name: 'Platinum', minPoints: 5000, multiplier: 2.0 },
]

// Base points rate: 1 point per 10 MAD spent
const BASE_POINTS_RATE = 0.1

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verify JWT token (only authorized services should call this)
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

    // Parse request body
    const body = await req.json()
    const { orderId, userId, orderTotal, reason } = body

    if (!orderId || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Order ID and User ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!orderTotal || orderTotal <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Valid order total is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify the order exists and belongs to the user
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, buyer_id, total, status, vendor_id')
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
        JSON.stringify({ success: false, error: 'Order does not belong to this user' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only award points for delivered orders
    if (order.status !== 'delivered') {
      return new Response(
        JSON.stringify({ success: false, error: 'Points can only be awarded for delivered orders' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if points have already been awarded for this order
    const { data: existingTransaction } = await supabase
      .from('loyalty_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('order_id', orderId)
      .eq('reason', 'order_completed')
      .single()

    if (existingTransaction) {
      return new Response(
        JSON.stringify({ success: false, error: 'Points have already been awarded for this order' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user's current loyalty points
    const { data: loyaltyData, error: loyaltyError } = await supabase
      .from('loyalty_points')
      .select('points, lifetime_points, tier')
      .eq('user_id', userId)
      .single()

    if (loyaltyError && loyaltyError.code !== 'PGRST116') {
      throw loyaltyError
    }

    const currentPoints = loyaltyData?.points || 0
    const currentTier = loyaltyData?.tier || 'Bronze'

    // Calculate tier multiplier
    const tier = LOYALTY_TIERS.find(t => t.name === currentTier) || LOYALTY_TIERS[0]
    const multiplier = tier.multiplier

    // Calculate base points (1 point per 10 MAD)
    const basePoints = Math.floor(orderTotal * BASE_POINTS_RATE)

    // Apply tier multiplier
    const adjustedPoints = Math.floor(basePoints * multiplier)

    // Ensure at least 1 point is awarded
    const finalPoints = Math.max(1, adjustedPoints)

    // Update loyalty points balance
    const { error: updateError } = await supabase
      .from('loyalty_points')
      .upsert({
        user_id: userId,
        points: currentPoints + finalPoints,
        lifetime_points: (loyaltyData?.lifetime_points || 0) + finalPoints,
        tier: currentTier,
      }, { onConflict: 'user_id' })

    if (updateError) throw updateError

    // Create loyalty transaction record
    const { data: transaction, error: txError } = await supabase
      .from('loyalty_transactions')
      .insert({
        user_id: userId,
        points_change: finalPoints,
        reason: reason || 'order_completed',
        order_id: orderId,
        balance_after: currentPoints + finalPoints,
        metadata: {
          order_total: orderTotal,
          base_points: basePoints,
          tier_multiplier: multiplier,
          tier: currentTier,
        },
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (txError) throw txError

    // Check for tier upgrade
    const newBalance = currentPoints + finalPoints
    const newTier = [...LOYALTY_TIERS].reverse().find(t => newBalance >= t.minPoints)?.name || 'Bronze'

    let tierUpgraded = false
    if (newTier !== currentTier) {
      const { error: tierError } = await supabase
        .from('loyalty_points')
        .update({ tier: newTier })
        .eq('user_id', userId)

      if (!tierError) {
        tierUpgraded = true
      }
    }

    // Create notification for user
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'loyalty',
      title: tierUpgraded ? `Congratulations! You've reached ${newTier} tier! 🎉` : 'Loyalty points earned! ⭐',
      message: tierUpgraded
        ? `You earned ${finalPoints} points from order ${order.order_number || orderId} and upgraded to ${newTier} tier!`
        : `You earned ${finalPoints} points from order ${order.order_number || orderId}. Balance: ${newBalance} points`,
      data: {
        order_id: orderId,
        points_earned: finalPoints,
        new_balance: newBalance,
        tier_upgraded: tierUpgraded,
        new_tier: tierUpgraded ? newTier : null,
      },
      is_read: false,
      created_at: new Date().toISOString(),
    })

    return new Response(
      JSON.stringify({
        success: true,
        pointsEarned: finalPoints,
        newBalance,
        tier: tierUpgraded ? newTier : currentTier,
        tierUpgraded,
        transaction,
        breakdown: {
          orderTotal,
          basePoints,
          multiplier,
          finalPoints,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Award loyalty points error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
