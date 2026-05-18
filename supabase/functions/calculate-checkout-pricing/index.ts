import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { buildAuthoritativeCheckout } from '../_shared/checkoutAuthority.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase configuration missing')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Authentication required' }, 401)
    }

    const token = authHeader.split(' ')[1]
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return json({ success: false, error: 'Invalid or expired token' }, 401)
    }

    const payload = await req.json()
    const checkout = await buildAuthoritativeCheckout({
      supabase,
      userId: user.id,
      payload,
      strictCouponValidation: false,
      strictPaymentValidation: false,
    })

    return json({
      success: true,
      pricing: checkout.pricing,
      availablePaymentTypes: checkout.availablePaymentTypes,
      codEligibility: checkout.codEligibility,
      couponError: checkout.couponError,
    })
  } catch (error) {
    console.error('calculate-checkout-pricing error:', error)
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate checkout pricing',
    }, 500)
  }
})