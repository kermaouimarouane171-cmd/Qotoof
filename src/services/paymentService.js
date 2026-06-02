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
import {
  getLatestPaymentRecordForOrder as fetchLatestPaymentRecordForOrder,
  insertPaymentRecord,
  updatePaymentRecordById,
} from '@/services/paymentRecords'
import { logger } from '@/utils/logger'
import { withRetry } from '@/utils/withRetry'
// Imports previously used for direct DB updates; now delegated to Edge Functions.
// import { PAYMENT_METHOD, PAYMENT_STATUS } from '@/constants/payment'

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
 * @param {string}  [params.paymentMethod] - Canonical payment method id
 * @param {string}  [params.payment_method] - Canonical snake_case alias
 * @param {string}  [params.method] - Deprecated alias retained for compatibility
 * @param {string}  [params.orderId]
 * @param {Object}  [params.customer]
 * @returns {Promise<Object>} Intent data (clientSecret, redirectUrl, etc.)
 */
export const createPaymentIntent = async ({ amount, currency = 'MAD', paymentMethod = null, payment_method = null, method = null, orderId, customer = {} }) => {
  try {
    const result = await paymentGateway.initializePayment({
      orderId,
      amount,
      paymentMethod,
      payment_method,
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
 * Legacy compatibility surface.
 * Active marketplace checkout no longer exposes CMI and this call now fails fast.
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
        const { data, error } = await supabase.functions.invoke('confirm-bank-transfer', {
          body: {
            orderId,
            transferProofUrl: receipt,
          },
        })

        if (error) throw error

        logger.info('[paymentService] Bank transfer confirmed via Edge Function for order:', orderId)
        return { success: true, data }
      } catch (error) {
        logger.error('[paymentService] confirmBankTransfer error:', error)
        return { success: false, error: error.message }
      }
    },
    { maxRetries: 2, baseDelay: 1000 }
  )
}

// ============================================================
// 4A. PAYMENT RECORD CONTRACT HELPERS
// ============================================================

export const createOrderPaymentRecord = async (paymentData) => {
  const { data, error } = await insertPaymentRecord({ payload: paymentData })
  if (error) throw error
  return data
}

export const getLatestOrderPaymentRecord = async ({ orderId, paymentMethod = null, select = '*', allowMissing = true } = {}) => {
  const { data, error } = await fetchLatestPaymentRecordForOrder({
    orderId,
    paymentMethod,
    select,
    allowMissing,
  })

  if (error) throw error
  return data
}

export const updateOrderPaymentRecord = async ({ paymentId, values, select = '*' }) => {
  const { data, error } = await updatePaymentRecordById({ paymentId, values, select })
  if (error) throw error
  return data
}

// ============================================================
// 5. REGISTER STAGED PAYMENT RECEIPT
// ============================================================

/**
 * Register a staged payment receipt against an order via Edge Function.
 * The file upload stays in Storage, while the sensitive order update is
 * validated and performed server-side.
 *
 * @param {Object} params
 * @param {string} params.orderId
 * @param {string} params.stage      - 'first' | 'second'
 * @param {string} params.storagePath
 * @returns {Promise<Object>} Updated order row
 */
export const registerPaymentReceipt = async ({ orderId, stage, storagePath }) => {
  const { data, error } = await supabase.functions.invoke('register-payment-receipt', {
    body: {
      orderId,
      stage,
      storagePath,
    },
  })

  if (error) {
    throw error
  }

  if (!data?.success || !data?.order) {
    throw new Error(data?.error || 'Failed to register payment receipt')
  }

  return data.order
}

// ============================================================
// 6. CONFIRM ORDER PAYMENT
// ============================================================

/**
 * Confirm vendor-side receipt verification / payment received state for an order.
 * This wraps the sensitive commission and order state mutations in an Edge Function.
 *
 * @param {Object} params
 * @param {string} params.orderId
 * @returns {Promise<Object>} Updated order + commission summary
 */
export const confirmOrderPayment = async ({ orderId }) => {
  const { data, error } = await supabase.functions.invoke('confirm-order-payment', {
    body: {
      orderId,
    },
  })

  if (error) {
    throw error
  }

  if (!data?.success || !data?.order) {
    throw new Error(data?.error || 'Failed to confirm order payment')
  }

  return data
}

// ============================================================
// 7. GET PAYMENT STATUS
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
// 8. REFUND PAYMENT
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
