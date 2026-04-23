// Supabase Edge Function: verify-cmi-callback
// Verifies CMI payment callback and updates order status
// Deploy: supabase functions deploy verify-cmi-callback --no-verify-jwt

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================
// Environment Configuration
// ============================================

const CMI_STORE_KEY = Deno.env.get('CMI_STORE_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// ============================================
// CMI Hash Verification
// ============================================

function verifyCMISignature(params: Record<string, string>): boolean {
  const { hash, oid, amount, currency, transactionType, installment, ...rest } = params
  
  // Reconstruct the hash string in the same order as creation
  const hashStr = `${oid}${amount}${rest.okUrl || ''}${rest.failUrl || ''}${transactionType}${installment}${currency}`
  
  // Create SHA1 hash
  const encoder = new TextEncoder()
  const data = encoder.encode(hashStr + CMI_STORE_KEY)
  const hashBuffer = crypto.subtle.digestSync('SHA-1', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashBytes = new Uint8Array(hashArray)
  const calculatedHash = btoa(String.fromCharCode(...hashBytes))
  
  return calculatedHash === hash
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
    if (!CMI_STORE_KEY) {
      console.error('CMI configuration error: Missing store key')
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

    // Parse callback data
    const body = await req.json()
    const {
      oid, // CMI order ID
      Response, // Response code: Approved, Declined, Error
      ResponseMsg, // Response message
      TransId, // Transaction ID from bank
      currency,
      amount,
      transactionType,
      installment,
      hash, // Signature hash
      ProcReturnCode, // Processing return code
      // Custom data we passed during creation
      DATA_ORDER_ID,
      DATA_PLATFORM,
      ...extraData
    } = body

    // Verify signature
    const isValidSignature = verifyCMISignature(body)
    
    if (!isValidSignature) {
      console.error('CMI callback signature verification failed', { oid, Response })
      return new Response(
        JSON.stringify({ 
          error: 'Invalid signature',
          verified: false,
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

    // Determine payment status
    const isApproved = Response === 'Approved' && ProcReturnCode === '00'
    const paymentStatus = isApproved ? 'completed' : 'failed'
    const errorCode = ProcReturnCode !== '00' ? ProcReturnCode : null
    const errorMessage = isApproved ? null : (ResponseMsg || 'Payment declined')

    // Extract original order ID from CMI order ID
    // Format: QTO-{orderId}-{timestamp}
    let originalOrderId = DATA_ORDER_ID
    if (!originalOrderId && oid) {
      const match = oid.match(/^QTO-(.+)-\d+$/)
      if (match) {
        originalOrderId = match[1]
      }
    }

    if (!originalOrderId) {
      console.error('Could not extract original order ID from CMI callback', { oid })
      return new Response(
        JSON.stringify({ error: 'Invalid order ID format' }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      )
    }

    // Update database
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

      // Update payment record
      const { error: paymentError } = await supabase
        .from('payments')
        .update({
          status: paymentStatus,
          transaction_id: TransId || null,
          auth_code: isApproved ? ProcReturnCode : null,
          gateway_response: body,
          paid_at: isApproved ? new Date().toISOString() : null,
          reference_number: oid || null,
        })
        .eq('order_id', originalOrderId)

      if (paymentError) {
        console.error('Failed to update payment record:', paymentError)
        throw new Error(`Failed to update payment: ${paymentError.message}`)
      }

      // Update order payment status
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          payment_status: paymentStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', originalOrderId)

      if (orderError) {
        console.error('Failed to update order:', orderError)
        throw new Error(`Failed to update order: ${orderError.message}`)
      }

      // Log financial audit if payment failed
      if (!isApproved) {
        const { error: auditError } = await supabase
          .from('financial_audit_log')
          .insert({
            entity_type: 'payment',
            entity_id: originalOrderId,
            action: 'payment_failed',
            previous_status: 'pending',
            new_status: 'failed',
            amount: amount ? parseInt(amount) / 100 : 0, // Convert from cents
            performed_by: 'system',
            performed_by_role: 'gateway',
            details: {
              cmi_response: Response,
              cmi_message: ResponseMsg,
              cmi_code: ProcReturnCode,
              transaction_id: TransId,
            },
            reason: errorMessage,
          })

        if (auditError) {
          console.error('Failed to create audit log:', auditError)
        }
      }
    }

    // Return response
    return new Response(
      JSON.stringify({
        success: isApproved,
        orderId: originalOrderId,
        cmiOrderId: oid,
        transactionId: TransId,
        status: paymentStatus,
        message: isApproved ? 'Payment successful' : errorMessage,
        errorCode,
        verified: true,
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
    console.error('CMI callback verification error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to verify CMI callback',
        code: 'CMI_CALLBACK_ERROR',
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
