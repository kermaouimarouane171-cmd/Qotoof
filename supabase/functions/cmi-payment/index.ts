import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'
import { requireAuth } from '../_shared/auth.ts'

const json = (body: unknown, status = 200, req?: Request) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...(req ? getCorsHeaders(req.headers.get('Origin')) : {}),
      'Content-Type': 'application/json',
    },
  })

serve(async (req) => {
  const optionsResponse = handleOptions(req)
  if (optionsResponse) return optionsResponse

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, req)
  }

  // Require authenticated user to prevent unauthorized CMI payment signature generation
  try {
    await requireAuth(req)
  } catch (error) {
    if (error instanceof Response) return error
    return json({ error: 'Authentication required' }, 401, req)
  }

  let orderId: string
  let amount: number
  try {
    const body = await req.json()
    orderId = String(body?.orderId || '').trim()
    amount = Number(body?.amount)
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, req)
  }

  if (!orderId || !amount || amount <= 0) {
    return json({ error: 'Valid orderId and amount are required' }, 400, req)
  }

  const CMI_STORE_KEY = Deno.env.get('CMI_STORE_KEY')
  const CMI_MERCHANT_ID = Deno.env.get('CMI_MERCHANT_ID')

  if (!CMI_STORE_KEY || !CMI_MERCHANT_ID) {
    return json({ error: 'CMI not configured' }, 500, req)
  }

  const payload = {
    merchant_id: CMI_MERCHANT_ID,
    order_id: orderId,
    amount: amount,
    timestamp: new Date().toISOString(),
  }

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(CMI_STORE_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(JSON.stringify(payload))
  )

  const hashHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return json({ ...payload, hash: hashHex }, 200, req)
})
