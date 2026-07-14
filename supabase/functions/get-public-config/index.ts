import { serve } from 'https://deno.land/std@0.200.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { enforceServerRateLimit, getClientIp, getCorsHeaders } from '../_shared/serverRateLimit.ts'

const PUBLIC_REQUEST_LIMIT = {
  maxAttempts: 100,
  windowSeconds: 60,
  blockSeconds: 60,
}

// Get public config for frontend (safe values only)
// NEVER return secrets like SERVICE_ROLE_KEY or PAYPAL_CLIENT_SECRET
const PUBLIC_CONFIG = {
  supabase: {
    url: Deno.env.get('VITE_SUPABASE_URL') || '',
    anonKey: Deno.env.get('VITE_SUPABASE_ANON_KEY') || '',
  },
  paypal: {
    clientId: Deno.env.get('VITE_PAYPAL_CLIENT_ID') || '',
    settlementCurrency: Deno.env.get('VITE_PAYPAL_SETTLEMENT_CURRENCY') || Deno.env.get('PAYPAL_SETTLEMENT_CURRENCY') || 'EUR',
  },
  stripe: {
    publishableKey: Deno.env.get('VITE_STRIPE_PUBLISHABLE_KEY') || '',
  },
  recaptcha: {
    siteKey: Deno.env.get('VITE_RECAPTCHA_SITE_KEY') || '',
  },
  email: {
    from: Deno.env.get('VITE_EMAIL_FROM') || 'noreply@greenmarket-marketplace.web.app',
  },
  app: {
    name: Deno.env.get('VITE_APP_NAME') || 'Qotoof',
    version: Deno.env.get('VITE_APP_VERSION') || '1.0.0',
  },
}

console.log('✅ Public config loaded:', {
  supabaseUrl: !!PUBLIC_CONFIG.supabase.url,
  paypalClientId: !!PUBLIC_CONFIG.paypal.clientId,
  stripePublishableKey: !!PUBLIC_CONFIG.stripe.publishableKey,
})

serve(async (req) => {
  try {
    const headers = new Headers(getCorsHeaders(req))
    headers.set('Content-Type', 'application/json')
    headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')

    if (req.method === 'OPTIONS') {
      return new Response('', { headers })
    }

    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers,
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase configuration missing')
    }

    const clientIp = getClientIp(req)
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const rateLimitResult = await enforceServerRateLimit({
      supabase,
      scope: 'public_request',
      identifierParts: ['get-public-config', clientIp],
      maxAttempts: PUBLIC_REQUEST_LIMIT.maxAttempts,
      windowSeconds: PUBLIC_REQUEST_LIMIT.windowSeconds,
      blockSeconds: PUBLIC_REQUEST_LIMIT.blockSeconds,
    })

    if (!rateLimitResult.allowed) {
      headers.set('Retry-After', String(rateLimitResult.retry_after_seconds || PUBLIC_REQUEST_LIMIT.blockSeconds))
      return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
        status: 429,
        headers,
      })
    }

    // Return public config
    return new Response(JSON.stringify(PUBLIC_CONFIG), {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('❌ Error in get-public-config:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
