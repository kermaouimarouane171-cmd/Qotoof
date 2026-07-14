// ============================================
// Supabase Edge Function: stripe-connect-onboarding
// Creates or retrieves a Stripe Connect Express account
// for vendors and drivers, and returns an Account Link
// URL for onboarding via Stripe's hosted form.
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

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const FRONTEND_APP_URL = (Deno.env.get('VITE_APP_URL') || Deno.env.get('FRONTEND_APP_URL') || '').trim().replace(/\/+$/g, '')

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const json = (body: unknown, status = 200, req?: Request) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...(req ? getCorsHeaders(req.headers.get('Origin')) : {}), 'Content-Type': 'application/json' },
  })

serve(async (req) => {
  const optionsResponse = handleOptions(req)
  if (optionsResponse) return optionsResponse

  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405, req)
    }

    // Authenticate — only vendors and drivers can onboard
    const auth = await requireRole(req, ['vendor', 'driver'])
    const userId = auth.userId
    const role = auth.role

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, phone, role, stripe_connect_account_id, stripe_connect_status')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return json({ error: 'Profile not found' }, 404, req)
    }

    const body = await req.json().catch(() => ({}))
    const refreshUrl = (body.refreshUrl || `${FRONTEND_APP_URL}/vendor/settings?stripe_refresh=1`).trim()
    const returnUrl = (body.returnUrl || `${FRONTEND_APP_URL}/vendor/settings?stripe_return=1`).trim()

    let accountId = profile.stripe_connect_account_id

    // 1. Create Stripe Connect Express account if it doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'MA',
        email: profile.email,
        capabilities: {
          transfers: { requested: true },
        },
        business_type: role === 'vendor' ? 'company' : 'individual',
        metadata: {
          user_id: userId,
          role: role,
          platform: 'qotoof',
        },
      })

      accountId = account.id

      // Save the account ID to the profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          stripe_connect_account_id: accountId,
          stripe_connect_status: 'pending',
        })
        .eq('id', userId)

      if (updateError) {
        console.error('Failed to save stripe_connect_account_id:', updateError.message)
      }

      console.log(`Created Stripe Connect account ${accountId} for ${role} ${userId}`)
    }

    // 2. Check current account status
    const account = await stripe.accounts.retrieve(accountId)
    const isFullyOnboarded = account.details_submitted && account.payouts_enabled

    // Update profile with current status
    const statusMapping: Record<string, string> = {
      not_connected: 'not_connected',
      pending: 'pending',
      enabled: 'enabled',
      restricted: 'restricted',
      rejected: 'rejected',
    }

    let connectStatus = 'pending'
    if (account.charges_enabled && account.payouts_enabled) {
      connectStatus = 'enabled'
    } else if (account.details_submitted) {
      connectStatus = 'restricted'
    } else if (account.requirements?.currently_due && account.requirements.currently_due.length > 0) {
      connectStatus = 'pending'
    }

    await supabase
      .from('profiles')
      .update({
        stripe_connect_status: statusMapping[connectStatus] || connectStatus,
        stripe_connect_details_submitted: account.details_submitted || false,
        stripe_connect_payouts_enabled: account.payouts_enabled || false,
        stripe_connect_charges_enabled: account.charges_enabled || false,
      })
      .eq('id', userId)

    // 3. If already fully onboarded, return status without creating a new link
    if (isFullyOnboarded) {
      return json({
        success: true,
        accountId,
        status: 'enabled',
        detailsSubmitted: true,
        payoutsEnabled: true,
        chargesEnabled: true,
        onboardingUrl: null,
        message: 'Stripe Connect account is already fully onboarded.',
      }, 200, req)
    }

    // 4. Create Account Link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    })

    return json({
      success: true,
      accountId,
      status: connectStatus,
      detailsSubmitted: account.details_submitted || false,
      payoutsEnabled: account.payouts_enabled || false,
      chargesEnabled: account.charges_enabled || false,
      onboardingUrl: accountLink.url,
      expiresAt: accountLink.expires_at,
    }, 200, req)
  } catch (error) {
    console.error('stripe-connect-onboarding error:', error)
    const status = (error as { status?: number }).status || 500
    return json(
      { error: (error as Error).message || 'Onboarding failed' },
      status,
      req,
    )
  }
})
