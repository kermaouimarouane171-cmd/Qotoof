// Supabase Edge Function: create-cmi-session
// Creates CMI (Moroccan Payment Gateway) 3D Secure payment session
// Deploy: supabase functions deploy create-cmi-session --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAuth } from '../_shared/auth.ts'
import { getCorsHeaders, handleOptions } from '../_shared/cors.ts'

// ============================================
// Environment Configuration
// ============================================

const CMI_MERCHANT_ID = Deno.env.get('CMI_MERCHANT_ID')
const CMI_STORE_KEY = Deno.env.get('CMI_STORE_KEY')
const CMI_API_URL = Deno.env.get('CMI_API_URL') || 'https://payment.cmi.co.ma/fim/api'
const CMI_SUCCESS_URL = Deno.env.get('CMI_SUCCESS_URL') || 'https://greenmarket-marketplace.web.app/payment/success'
const CMI_FAIL_URL = Deno.env.get('CMI_FAIL_URL') || 'https://greenmarket-marketplace.web.app/payment/fail'
const CMI_LANG = Deno.env.get('CMI_LANG') || 'en'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// ============================================
// CMI Hash Generation (SHA1)
// ============================================

async function generateCMISignature(params: Record<string, string>): Promise<string> {
  // CMI requires concatenating specific parameters in order
  const oid = params.oid || ''
  const amount = params.amount || ''
  const okUrl = params.okUrl || ''
  const failUrl = params.failUrl || ''
  const transactionType = params.transactionType || 'Auth'
  const installment = params.installment || ''
  const currency = params.currency || '944' // 944 = MAD (Moroccan Dirham)

  // Concatenate parameters for hash
  const hashStr = `${oid}${amount}${okUrl}${failUrl}${transactionType}${installment}${currency}`
  
  // Create SHA1 hash with store key
  const encoder = new TextEncoder()
  const data = encoder.encode(hashStr + CMI_STORE_KEY)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const _hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  
  // Base64 encode the hash
  const hashBytes = new Uint8Array(hashArray)
  const hashBase64 = btoa(String.fromCharCode(...hashBytes))
  
  return hashBase64
}

// ============================================
// Main Handler
// ============================================

serve(async (req) => {
  try {
    // CORS headers
    const optionsResponse = handleOptions(req)
    if (optionsResponse) return optionsResponse

    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { 
            'Content-Type': 'application/json',
            ...getCorsHeaders(req.headers.get('Origin')),
          } 
        }
      )
    }

    // Require authenticated user to prevent unauthorized payment session creation
    try {
      await requireAuth(req)
    } catch (error) {
      if (error instanceof Response) return error
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req.headers.get('Origin')) } }
      )
    }

    // Validate environment variables
    if (!CMI_MERCHANT_ID || !CMI_STORE_KEY) {
      console.error('CMI configuration error: Missing merchant ID or store key')
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            ...getCorsHeaders(req.headers.get('Origin')),
          } 
        }
      )
    }

    // Parse request body
    const body = await req.json()
    const { 
      orderId, 
      amount, 
      currency = 'MAD',
      customerName,
      customerEmail,
      customerPhone,
      billingAddress,
      installment = '0', // 0 = single payment, >0 = installment
      transactionType = 'Auth', // Auth = authorize, PreAuth = pre-authorization
      metadata = {}
    } = body

    // Validate required fields
    if (!orderId || !amount) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          required: ['orderId', 'amount']
        }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...getCorsHeaders(req.headers.get('Origin')),
          } 
        }
      )
    }

    // Validate amount is positive
    if (amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'Amount must be greater than 0' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...getCorsHeaders(req.headers.get('Origin')),
          } 
        }
      )
    }

    // CMI currency codes: 944 = MAD, 840 = USD, 978 = EUR
    const currencyCodeMap: Record<string, string> = {
      'MAD': '944',
      'USD': '840',
      'EUR': '978',
    }
    const cmiCurrency = currencyCodeMap[currency] || '944'

    // Generate unique order ID for CMI (must be unique per transaction)
    const cmiOrderId = `QTO-${orderId}-${Date.now()}`

    // Prepare CMI parameters
    const cmiParams = {
      oid: cmiOrderId,
      amount: Math.round(amount * 100).toString(), // CMI expects amount in cents
      okUrl: CMI_SUCCESS_URL,
      failUrl: CMI_FAIL_URL,
      transactionType,
      installment,
      currency: cmiCurrency,
    }

    // Generate signature hash
    const hash = await generateCMISignature(cmiParams)

    // Build CMI form data
    const cmiFormData = {
      ...cmiParams,
      merchantId: CMI_MERCHANT_ID,
      hash,
      lang: CMI_LANG,
      // Optional customer information
      email: customerEmail || '',
      BillToName: customerName || '',
      BillToCompany: billingAddress?.company || '',
      BillToStreet: billingAddress?.street || '',
      BillToCity: billingAddress?.city || '',
      BillToPostalCode: billingAddress?.postalCode || '',
      BillToCountry: billingAddress?.country || 'MA',
      BillToTel: customerPhone || '',
      // Custom metadata (will be returned in callback)
      DATA_ORDER_ID: orderId,
      DATA_PLATFORM: 'qotoof',
      ...Object.fromEntries(
        Object.entries(metadata).map(([key, value]) => [`DATA_${key.toUpperCase()}`, String(value)])
      ),
    }

    // Update payment record in Supabase with CMI session data
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

      const { error: updateError } = await supabase
        .from('payments')
        .update({
          payment_intent_id: cmiOrderId,
          gateway_response: {
            cmi_order_id: cmiOrderId,
            amount: amount,
            currency: currency,
            created_at: new Date().toISOString(),
          },
          status: 'pending',
        })
        .eq('order_id', orderId)

      if (updateError) {
        console.error('Failed to update payment record:', updateError)
        // Don't fail the request, just log the error
      }
    }

    // Return CMI form data and URL for frontend to redirect
    return new Response(
      JSON.stringify({
        success: true,
        paymentUrl: CMI_API_URL,
        formData: cmiFormData,
        cmiOrderId,
        message: 'Redirect to CMI payment page',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(req.headers.get('Origin')),
        },
      }
    )

  } catch (error) {
    console.error('CMI session creation error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to create CMI payment session',
        code: 'CMI_SESSION_ERROR',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(req.headers.get('Origin')),
        },
      }
    )
  }
})
