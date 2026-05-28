import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  capturePayPalOrder,
  extractPayPalCaptures,
  getPayPalAccessToken,
  paypalCorsHeaders,
  paypalJsonResponse,
  persistPayPalOrderState,
} from '../_shared/paypalCheckout.ts'

serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: paypalCorsHeaders })
    }

    if (req.method !== 'POST') {
      return paypalJsonResponse({ error: 'Method not allowed' }, 405)
    }

    const { orderId } = await req.json()

    if (!orderId) {
      return paypalJsonResponse({ error: 'Missing required field: orderId' }, 400)
    }

    const token = await getPayPalAccessToken()
    const captureResult = await capturePayPalOrder(token, orderId)
    const captures = extractPayPalCaptures(captureResult)
    const persistedState = await persistPayPalOrderState({
      paypalOrderId: orderId,
      paypalOrderData: captureResult,
    })

    return paypalJsonResponse(
      {
        id: captureResult?.id,
        status: captureResult?.status,
        captures,
        paymentId: persistedState.paymentId,
        internalOrderId: persistedState.internalOrderId,
        paymentStatus: persistedState.paymentStatus,
        orderPaymentStatus: persistedState.orderPaymentStatus,
      },
      200
    )
  } catch (error) {
    return paypalJsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500)
  }
})
