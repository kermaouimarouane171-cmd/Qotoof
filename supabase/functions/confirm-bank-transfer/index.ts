// Supabase Edge Function: confirm-bank-transfer
// Confirms bank transfer payment and updates order status
// Deploy: supabase functions deploy confirm-bank-transfer

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireRole } from '../_shared/auth.ts'

// ============================================
// Environment Configuration
// ============================================

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const BANK_TRANSFER_DETAILS = Deno.env.get('BANK_TRANSFER_DETAILS') || ''
const BANK_NAME = Deno.env.get('BANK_NAME') || 'Attijariwafa Bank'
const BANK_ACCOUNT_NUMBER = Deno.env.get('BANK_ACCOUNT_NUMBER') || ''
const BANK_RIB = Deno.env.get('BANK_RIB') || ''
const BANK_IBAN = Deno.env.get('BANK_IBAN') || ''
const BANK_BENEFICIARY = Deno.env.get('BANK_BENEFICIARY') || 'Qotoof SARL'

const isBankTransferMethod = (paymentMethod: string | null | undefined) => {
  const normalized = String(paymentMethod || '').trim()
  return normalized === 'bank' || normalized === 'bank_transfer'
}

// ============================================
// Helper Functions
// ============================================

function getBankDetails() {
  return {
    bankName: BANK_NAME,
    accountNumber: BANK_ACCOUNT_NUMBER,
    rib: BANK_RIB,
    iban: BANK_IBAN,
    beneficiary: BANK_BENEFICIARY,
    additionalInfo: BANK_TRANSFER_DETAILS,
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
          'Access-Control-Allow-Methods': 'POST, GET',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      })
    }

    // Validate environment
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

    // Handle GET request - return bank details
    if (req.method === 'GET') {
      const url = new URL(req.url)
      const orderId = url.searchParams.get('orderId')

      if (!orderId) {
        return new Response(
          JSON.stringify({ error: 'Missing orderId parameter' }),
          { 
            status: 400, 
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            } 
          }
        )
      }

      // Verify order exists
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, total, buyer_id, payment_method')
        .eq('id', orderId)
        .single()

      if (orderError || !order) {
        return new Response(
          JSON.stringify({ error: 'Order not found' }),
          { 
            status: 404, 
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            } 
          }
        )
      }

      // This endpoint is a legacy/manual compatibility surface.
      // Accept both the canonical bank contract and older bank_transfer rows.
      if (!isBankTransferMethod(order.payment_method)) {
        return new Response(
          JSON.stringify({ 
            error: 'This order is not using bank transfer payment',
            paymentMethod: order.payment_method,
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

      return new Response(
        JSON.stringify({
          success: true,
          orderId,
          amount: order.total,
          currency: 'MAD',
          bankDetails: getBankDetails(),
          instructions: [
            'Transfer the exact amount to the bank account above',
            'Use your order ID as transfer reference',
            'Upload the transfer receipt in your order dashboard',
            'Your order will be processed once payment is confirmed',
          ],
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // Handle POST request - confirm bank transfer
    if (req.method === 'POST') {
      const body = await req.json()
      const {
        orderId,
        transactionId,
        transferProofUrl,
        bankName: customerBankName,
        accountNumber: customerAccountNumber,
        transferDate,
        notes,
      } = body

      if (!orderId) {
        return new Response(
          JSON.stringify({ error: 'Missing orderId' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            }
          }
        )
      }

      // Authenticate and verify buyer role (API-002)
      let authUser: { id: string }
      try {
        const auth = await requireRole(req, ['buyer'])
        authUser = { id: auth.userId }
      } catch (error) {
        if (error instanceof Response) {
          const status = error.status
          const message = status === 401 ? 'Authentication required' : 'Access restricted to buyers only'
          return new Response(
            JSON.stringify({ error: message }),
            { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
          )
        }
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        )
      }

      const user = authUser

      // Get the order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          total,
          buyer_id,
          payment_method,
          payment_status,
          invoice_metadata
        `)
        .eq('id', orderId)
        .single()

      if (orderError || !order) {
        return new Response(
          JSON.stringify({ error: 'Order not found' }),
          {
            status: 404,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            }
          }
        )
      }

      // Verify buyer ownership
      if (order.buyer_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          {
            status: 403,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            }
          }
        )
      }

      // Verify payment method
      if (!isBankTransferMethod(order.payment_method)) {
        return new Response(
          JSON.stringify({ error: 'This order is not using bank transfer payment' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            }
          }
        )
      }

      // Check if already confirmed
      if (order.payment_status === 'paid' || order.payment_status === 'completed') {
        return new Response(
          JSON.stringify({
            error: 'Payment already confirmed for this order',
            status: 'already_paid',
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

      // Fetch payment record and verify status transition
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id, status')
        .eq('order_id', orderId)
        .single()

      const allowedPreviousStatuses = ['pending', 'awaiting_transfer']
      if (existingPayment && !allowedPreviousStatuses.includes(existingPayment.status)) {
        return new Response(
          JSON.stringify({
            error: 'Invalid payment status for confirmation',
            currentStatus: existingPayment.status,
          }),
          {
            status: 409,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            }
          }
        )
      }

      let paymentUpdateError
      if (existingPayment) {
        ({ error: paymentUpdateError } = await supabase
          .from('payments')
          .update({
            payment_method: 'bank',
            status: 'processing',
            transaction_id: transactionId || null,
            updated_at: new Date().toISOString(),
          })
          .eq('order_id', orderId))
      } else {
        ({ error: paymentUpdateError } = await supabase
          .from('payments')
          .insert({
            order_id: orderId,
            amount: order.total,
            payment_method: 'bank',
            status: 'processing',
            transaction_id: transactionId || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }))
      }

      if (paymentUpdateError) {
        console.error('Failed to update payment record:', paymentUpdateError)
        throw new Error(`Failed to update payment: ${paymentUpdateError.message}`)
      }

      // Build invoice_metadata preserving existing data and adding bank transfer info
      const currentMetadata = order.invoice_metadata && typeof order.invoice_metadata === 'object'
        ? order.invoice_metadata
        : {}
      const nextInvoiceMetadata = {
        ...currentMetadata,
        bank_transfer: {
          ...(currentMetadata.bank_transfer ?? {}),
          proof_url: transferProofUrl ?? null,
          bank_name: customerBankName ?? null,
          account_number_last4: customerAccountNumber ? String(customerAccountNumber).slice(-4) : null,
          transfer_date: transferDate ?? null,
          notes: notes ?? null,
          transaction_id: transactionId ?? null,
          submitted_at: new Date().toISOString(),
          submitted_by: user.id,
        },
      }

      // Update order payment status and invoice_metadata
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'processing',
          invoice_metadata: nextInvoiceMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)

      if (orderUpdateError) {
        console.error('Failed to update order:', orderUpdateError)
        throw new Error(`Failed to update order: ${orderUpdateError.message}`)
      }

      // Log financial audit
      const { error: auditError } = await supabase
        .from('financial_audit_log')
        .insert({
          entity_type: 'payment',
          entity_id: orderId,
          action: 'bank_transfer_submitted',
          previous_status: 'pending',
          new_status: 'processing',
          amount: order.total,
          performed_by: order.buyer_id,
          performed_by_role: 'buyer',
          details: {
            customer_bank_name: customerBankName,
            transfer_date: transferDate,
            proof_url: transferProofUrl,
          },
          reason: notes || 'Bank transfer payment submitted',
        })

      if (auditError) {
        console.error('Failed to create audit log:', auditError)
        // Don't fail the request, just log
      }

      return new Response(
        JSON.stringify({
          success: true,
          orderId,
          status: 'processing',
          message: 'Bank transfer confirmation submitted successfully',
          nextSteps: 'Your payment is being reviewed. You will receive a confirmation once verified.',
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // Method not allowed
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

  } catch (error) {
    console.error('Bank transfer confirmation error:', error)
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to process bank transfer confirmation',
        code: 'BANK_TRANSFER_ERROR',
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
