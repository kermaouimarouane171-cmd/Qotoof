import { serve } from 'https://deno.land/std@0.200.0/http/server.ts'

// Get public config for frontend (safe values only)
// NEVER return secrets like SERVICE_ROLE_KEY or STRIPE_SECRET_KEY
const PUBLIC_CONFIG = {
  supabase: {
    url: Deno.env.get('VITE_SUPABASE_URL') || '',
    anonKey: Deno.env.get('VITE_SUPABASE_ANON_KEY') || '',
  },
  stripe: {
    publishableKey: Deno.env.get('VITE_STRIPE_PUBLIC_KEY') || '',
  },
  recaptcha: {
    siteKey: Deno.env.get('VITE_RECAPTCHA_SITE_KEY') || '',
  },
  email: {
    from: Deno.env.get('VITE_EMAIL_FROM') || 'noreply@qotoof.ma',
  },
  app: {
    name: Deno.env.get('VITE_APP_NAME') || 'Qotoof',
    version: Deno.env.get('VITE_APP_VERSION') || '1.0.0',
  },
}

console.log('✅ Public config loaded:', {
  supabaseUrl: !!PUBLIC_CONFIG.supabase.url,
  stripeKey: !!PUBLIC_CONFIG.stripe.publishableKey,
})

serve(async (req) => {
  try {
    // CORS headers for frontend access
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    headers.set('Access-Control-Allow-Origin', '*')
    headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Content-Type')
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
