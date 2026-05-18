// Supabase Edge Function: refund-cmi-payment
// Processes refund for CMI payments via void or refund API
// Deploy: supabase functions deploy refund-cmi-payment

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================
// Environment Configuration
// ============================================

const CMI_MERCHANT_ID = Deno.env.get('CMI_MERCHANT_ID')
const CMI_STORE_KEY = Deno.env.get('CMI_STORE_KEY')
const CMI_API_URL = Deno.env.get('CMI_API_URL') || 'https://payment.cmi.co.ma/fim/api'
const CMI_REFUND_URL = Deno.env.get('CMI_REFUND_URL') || 'https://payment.cmi.co.ma/fim/Refund'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// ============================================
// Helper Functions
// ============================================

async function generateRefundSignature(params: Record<string, string>): Promise<string> {
  // CMI refund signature: oid + amount + currency + refundType
  const { oid, amount, currency, refundType } = params
  const hashStr = `${oid}${amount}${currency}${refundType || 'Credit'}`
  
  const encoder = new TextEncoder()
  const data = encoder.encode(hashStr + CMI_STORE_KEY)
  const hashBuffer = await crypto.subtle.digest('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashBytes = new Uint8Array(hashArray)
  const hashBase64 = btoa(String.fromCharCode(...hashBytes))
  
  return hashBase64
}

async function callCMIRefundAPI(formData: Record<string, string>): Promise<any> {
  // CMI refund API uses SOAP or REST depending on version
  // This implementation uses the standard refund endpoint
  
  const urlencoded = new URLSearchParams(formData)
  
  const response = await fetch(CMI_REFUND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: urlencoded,
  })

  const responseText = await response.text()
  
  // CMI typically returns XML or key-value pairs
  // Parse the response
  const result: Record<string, string> = {}
  const pairs = responseText.split('&')
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=')
    if (key && value !== undefined) {
      result[key] = decodeURIComponent(value)
    }
  }
  
  return {
    success: response.ok,
    data: result,
    rawResponse: responseText,
  }
}

// ============================================
// Main Handler
// ============================================

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    // Validate environment
    if (!CMI_MERCHANT_ID || !CMI_STORE_KEY) {
      console.error('CMI configuration error: Missing merchant ID or store key')
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    // Parse request body
    const body = await req.json()
    const {
      orderId: payloadOrderId,
      paymentId,
      transactionId,
      amount,
      reason,
      refundType = 'Credit', // Credit = full/partial refund, Void = cancel before settlement
      requestedBy,
      notes,
    } = body

    // Validate required fields
    const numericAmount = Number(amount)
    if ((!payloadOrderId && !paymentId) || !numericAmount || numericAmount <= 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing or invalid required fields',
          required: ['orderId or paymentId', 'amount (must be > 0)'],
        }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    if (!reason) {
      return new Response(
        JSON.stringify({ error: 'Refund reason is required' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    // Initialize Supabase client
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Supabase configuration error')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Get the original payment
    let paymentQuery = supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)

    if (paymentId) {
      paymentQuery = paymentQuery.eq('id', paymentId)
    } else {
      paymentQuery = paymentQuery.eq('order_id', payloadOrderId)
    }

    const { data: payment, error: paymentError } = await paymentQuery.maybeSingle()

    if (paymentError || !payment) {
      return new Response(
        JSON.stringify({ error: 'Payment not found for this order' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    const orderId = payloadOrderId || payment.order_id

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: 'Unable to resolve order for this refund' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    // Verify payment was completed
    if (payment.status !== 'completed') {
      return new Response(
        JSON.stringify({ 
          error: 'Can only refund completed payments',
          currentStatus: payment.status,
        }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    // Verify payment method is CMI
    if (payment.payment_method !== 'card' && payment.payment_method !== 'cmi') {
      return new Response(
        JSON.stringify({ 
          error: 'This payment was not made via CMI',
          paymentMethod: payment.payment_method,
        }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    if (numericAmount > Number(payment.amount || 0)) {
      return new Response(
        JSON.stringify({
          error: 'Refund amount exceeds original payment amount',
          originalAmount: payment.amount,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        }
      )
    }

    // Check if already refunded
    if (payment.refund_amount && payment.refund_amount > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'This payment has already been refunded',
          refundAmount: payment.refund_amount,
        }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    // Get CMI order ID from payment record
    const cmiOrderId = payment.payment_intent_id || payment.gateway_response?.cmi_order_id
    
    if (!cmiOrderId) {
      return new Response(
        JSON.stringify({ error: 'CMI transaction ID not found' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    // Get original transaction ID
    const originalTransId = payment.transaction_id || transactionId

    if (!originalTransId) {
      return new Response(
        JSON.stringify({ error: 'Original transaction ID not found' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    // Prepare refund parameters
    const refundAmount = Math.round(numericAmount * 100).toString() // Convert to cents
    const currency = payment.currency === 'MAD' ? '944' : '840'

    const refundParams = {
      oid: cmiOrderId,
      transId: originalTransId,
      amount: refundAmount,
      currency,
      refundType,
      merchantId: CMI_MERCHANT_ID,
    }

    // Generate signature
    const hash = await generateRefundSignature(refundParams)

    // Build refund request
    const refundFormData = {
      ...refundParams,
      hash,
      reason: reason || 'Customer refund',
    }

    // Call CMI refund API
    console.log('Initiating CMI refund for order:', orderId, 'amount:', numericAmount)
    
    const cmiResponse = await callCMIRefundAPI(refundFormData)

    if (!cmiResponse.success) {
      console.error('CMI refund API call failed:', cmiResponse)
      
      // Log failed refund attempt
      const { error: auditError } = await supabase
        .from('financial_audit_log')
        .insert({
          entity_type: 'refund',
          entity_id: orderId,
          action: 'refund_failed',
          previous_status: 'completed',
          new_status: 'refund_failed',
          amount: numericAmount,
          performed_by: requestedBy || 'system',
          performed_by_role: 'admin',
          details: {
            cmi_response: cmiResponse.data,
            reason,
            notes,
          },
          reason: 'CMI refund API call failed',
        })

      if (auditError) {
        console.error('Failed to create audit log:', auditError)
      }

      return new Response(
        JSON.stringify({ 
          error: 'CMI refund request failed',
          cmiResponse: cmiResponse.data,
        }),
        { 
          status: 502, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    // Check CMI response code
    const responseCode = cmiResponse.data?.ProcReturnCode
    const isSuccessful = responseCode === '00' || cmiResponse.data?.Response === 'Approved'

    if (!isSuccessful) {
      const errorMessage = cmiResponse.data?.ResponseMsg || 'Refund declined by bank'
      
      // Log failed refund
      await supabase
        .from('financial_audit_log')
        .insert({
          entity_type: 'refund',
          entity_id: orderId,
          action: 'refund_declined',
          previous_status: 'completed',
          new_status: 'refund_declined',
          amount: numericAmount,
          performed_by: requestedBy || 'system',
          performed_by_role: 'admin',
          details: {
            cmi_response: cmiResponse.data,
            reason,
            notes,
          },
          reason: errorMessage,
        })

      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          cmiResponse: cmiResponse.data,
          code: responseCode,
        }),
        { 
          status: 422, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    // Refund successful - update database
    const refundTransId = cmiResponse.data?.TransId || `REFUND-${Date.now()}`

    // Update payment record
    const { error: updatePaymentError } = await supabase
      .from('payments')
      .update({
        status: 'refunded',
        refund_amount: numericAmount,
        refund_reason: reason,
        refunded_at: new Date().toISOString(),
        gateway_response: {
          ...payment.gateway_response,
          refund: {
            amount: numericAmount,
            reason,
            refund_type: refundType,
            cmi_transaction_id: refundTransId,
            cmi_response: cmiResponse.data,
            refunded_at: new Date().toISOString(),
            refunded_by: requestedBy,
            notes,
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderId)

    if (updatePaymentError) {
      console.error('Failed to update payment record:', updatePaymentError)
      throw new Error(`Failed to update payment: ${updatePaymentError.message}`)
    }

    // Update order if fully refunded
    const originalAmount = payment.amount
    if (numericAmount >= originalAmount) {
      await supabase
        .from('orders')
        .update({
          payment_status: 'refunded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
    }

    // Log successful refund in audit trail
    const { error: auditError } = await supabase
      .from('financial_audit_log')
      .insert({
        entity_type: 'refund',
        entity_id: orderId,
        action: 'refund_completed',
        previous_status: 'completed',
        new_status: 'refunded',
        amount: numericAmount,
        performed_by: requestedBy || 'system',
        performed_by_role: 'admin',
        details: {
          cmi_transaction_id: refundTransId,
          cmi_response: cmiResponse.data,
          refund_type: refundType,
          reason,
          notes,
        },
        reason,
      })

    if (auditError) {
      console.error('Failed to create audit log:', auditError)
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        orderId,
        refundAmount: numericAmount,
        refundTransactionId: refundTransId,
        status: 'refunded',
        message: 'Refund processed successfully',
        cmiResponse: cmiResponse.data,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )

  } catch (error) {
    console.error('CMI refund processing error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to process CMI refund',
        code: 'CMI_REFUND_ERROR',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
})
