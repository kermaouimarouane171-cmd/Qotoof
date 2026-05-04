/**
 * Payment Service — Functional API
 *
 * Thin, named-function wrapper around paymentGateway (class-based).
 * Provides the exact function signatures required by checkout pages
 * and order management flows.
 *
 * All heavy lifting (CMI, COD, Bank) is delegated to
 * src/services/paymentGateway.js so no logic is duplicated.
 *
 * @module services/paymentService
 */

import { supabase } from '@/services/supabase'
import { paymentGateway } from '@/services/paymentGateway'
import { logger } from '@/utils/logger'
import { withRetry } from '@/utils/withRetry'
import { PAYMENT_STATUS } from '@/constants/payment'

// ============================================================
// 1. CREATE PAYMENT INTENT
// ============================================================

/**
 * Create a payment intent for a given amount, currency and method.
 * Returns a gateway-specific token/secret needed to confirm the payment.
 *
 * @param {Object} params
 * @param {number}  params.amount   - Amount in MAD
 * @param {string}  params.currency - Currency code (default 'MAD')
 * @param {string}  params.method   - 'paypal' | 'cmi' | 'cod' | 'bank'
 * @param {string}  [params.orderId]
 * @param {Object}  [params.customer]
 * @returns {Promise<Object>} Intent data (clientSecret, redirectUrl, etc.)
 */
export const createPaymentIntent = async ({ amount, currency = 'MAD', method, orderId, customer = {} }) => {
  try {
    const result = await paymentGateway.initializePayment({
      orderId,
      amount,
      method,
      currency,
      customer,
    })
    return { success: true, data: result }
  } catch (error) {
    logger.error('[paymentService] createPaymentIntent error:', error)
    return { success: false, error: error.message }
  }
}

// ============================================================
// 2. PROCESS PAYPAL PAYMENT
// ============================================================

/**
 * Process a PayPal payment for an order.
 *
 * @param {Object} params
 * @param {string} params.orderId        - Order ID
 * @param {number} params.amount         - Amount in MAD
 * @param {string} [params.currency]     - Currency code (default 'MAD')
 * @param {Object} [params.customer]     - { email, name }
 * @returns {Promise<Object>} PayPal order initialization result
 */
export const processPayPalPayment = async ({ orderId, amount, currency = 'MAD', customer = {} }) => {
  try {
    const result = await paymentGateway.processPayPalPayment({
      orderId,
      amount,
      currency,
      customer,
    })
    return { success: true, data: result }
  } catch (error) {
    logger.error('[paymentService] processPayPalPayment error:', error)
    return { success: false, error: error.message }
  }
}

// Backward compatibility for any legacy import that still references Stripe naming.
export const processStripePayment = processPayPalPayment

// ============================================================
// 3. PROCESS CMI PAYMENT
// ============================================================

/**
 * Initiate a CMI (Centre Monétique Interbancaire) payment.
 * Returns a redirectUrl — the caller must redirect the user to it.
 *
 * @param {Object} params
 * @param {string} params.orderId    - Order ID
 * @param {number} params.amount     - Amount in MAD
 * @param {string} [params.lang]     - UI language for CMI page ('ar' | 'fr' | 'en')
 * @param {Object} [params.customer] - { email, name, phone }
 * @param {string} [params.currency]
 * @returns {Promise<Object>} { redirectUrl, paymentId, status }
 */
export const processCMIPayment = async ({ orderId, amount, lang = 'ar', customer = {}, currency = 'MAD' }) => {
  try {
    const result = await paymentGateway.processCmiPayment({
      orderId,
      amount,
      currency,
      customer: { ...customer, lang },
    })
    return { success: true, data: result }
  } catch (error) {
    logger.error('[paymentService] processCMIPayment error:', error)
    return { success: false, error: error.message }
  }
}

// ============================================================
// 4. CONFIRM BANK TRANSFER
// ============================================================

/**
 * Confirm a bank transfer by attaching a receipt/proof document URL.
 * Updates the payment record to 'processing' pending admin verification.
 *
 * @param {Object} params
 * @param {string} params.orderId   - Order ID
 * @param {string} params.receipt   - URL or base64 of the transfer receipt
 * @returns {Promise<Object>} Updated payment record
 */
export const confirmBankTransfer = async ({ orderId, receipt }) => {
  return withRetry(
    async () => {
      try {
        // Fetch the pending bank transfer payment for this order
        const { data: payment, error: fetchError } = await supabase
          .from('payments')
          .select('id, status, method')
          .eq('order_id', orderId)
          .eq('method', 'bank')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

        if (fetchError) throw fetchError

        if (payment.status === PAYMENT_STATUS.COMPLETED) {
          return { success: false, error: 'الدفع مكتمل بالفعل' }
        }

        // Attach receipt and move to processing
        const { data: updated, error: updateError } = await supabase
          .from('payments')
          .update({
            status: PAYMENT_STATUS.PROCESSING,
            receipt_url: receipt,
            receipt_uploaded_at: new Date().toISOString(),
          })
          .eq('id', payment.id)
          .select()
          .single()

        if (updateError) throw updateError

        logger.info('[paymentService] Bank transfer receipt uploaded for order:', orderId)
        return { success: true, data: updated }
      } catch (error) {
        logger.error('[paymentService] confirmBankTransfer error:', error)
        return { success: false, error: error.message }
      }
    },
    { maxRetries: 2, baseDelay: 1000 }
  )
}

// ============================================================
// 5. GET PAYMENT STATUS
// ============================================================

/**
 * Get the latest payment record for an order.
 *
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Latest payment record or error
 */
export const getPaymentStatus = async (orderId) => {
  try {
    const data = await paymentGateway.getPaymentStatus(orderId)
    return { success: true, data }
  } catch (error) {
    logger.error('[paymentService] getPaymentStatus error:', error)
    return { success: false, error: error.message }
  }
}

// ============================================================
// 6. REFUND PAYMENT
// ============================================================

/**
 * Refund a payment by payment record ID.
 *
 * @param {string} paymentId - Payment record ID
 * @param {number} amount    - Amount to refund (MAD)
 * @param {string} [reason]  - Reason for refund
 * @returns {Promise<Object>}
 */
export const refundPayment = async (paymentId, amount, reason = '') => {
  try {
    const result = await paymentGateway.refundPayment(paymentId, amount, reason)
    return { success: true, data: result }
  } catch (error) {
    logger.error('[paymentService] refundPayment error:', error)
    return { success: false, error: error.message }
  }
}
