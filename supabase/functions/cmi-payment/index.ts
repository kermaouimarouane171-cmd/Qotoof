import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { orderId, amount } = await req.json()

  const CMI_STORE_KEY = Deno.env.get('CMI_STORE_KEY')
  const CMI_MERCHANT_ID = Deno.env.get('CMI_MERCHANT_ID')

  if (!CMI_STORE_KEY || !CMI_MERCHANT_ID) {
    return new Response(
      JSON.stringify({ error: 'CMI غير مضبوط' }),
      { status: 500 }
    )
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

  return new Response(
    JSON.stringify({ ...payload, hash: hashHex }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
})
