import { supabase } from '@/services/supabase'
import { PAYMENT_METHOD } from '@/constants/payment'
import {
  getLatestPaymentRecordForOrder,
  getPaymentRecordById,
  insertPaymentRecord,
  normalizePaymentMethod,
  resolvePaymentMethod,
  updatePaymentRecordById,
} from '@/services/paymentRecords'
import { logger } from '@/utils/logger'
import { withRetry } from '@/utils/withRetry'
import { getPayPalClientId as getConfiguredPayPalClientId } from '@/lib/config'

/**
 * Payment Gateway Service
 * Supports the active marketplace payment methods.
 * Historical CMI support remains available only for reading or refunding legacy records.
 */
class PaymentGateway {
  constructor() {
    this.paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID
    // NOTE: PayPal secret is handled server-side in Supabase Edge Functions only.
    // Never expose it in VITE_ env vars — it would be bundled into the client.
    this.isTestMode = import.meta.env.VITE_PAYMENT_MODE !== 'production'
    this.bankDetailsCache = new Map()
    this.bankDetailsTtlMs = 5 * 60 * 1000
  }

  getPayPalClientId() {
    return getConfiguredPayPalClientId() || this.paypalClientId || import.meta.env.VITE_PAYPAL_CLIENT_ID || ''
  }

  /**
   * Initialize payment
   * @param {Object} options - Payment options
   * @param {string} options.orderId - Order ID
   * @param {number} options.amount - Amount in MAD
   * @param {string} [options.paymentMethod] - Canonical payment method id
   * @param {string} [options.payment_method] - Canonical snake_case alias
   * @param {string} [options.method] - Deprecated alias kept for backward compatibility
   * @param {string} options.currency - Currency (default: MAD)
   * @param {Object} options.customer - Customer info
   * @returns {Promise<Object>} Payment result
   */
  async initializePayment({ orderId, amount, paymentMethod = null, payment_method = null, method = null, currency = 'MAD', customer }) {
    const normalizedMethod = normalizePaymentMethod(paymentMethod ?? payment_method ?? method)

    return withRetry(
      async () => {
        switch (normalizedMethod) {
          case PAYMENT_METHOD.PAYPAL:
            return await this.processPayPalPayment({ orderId, amount, currency, customer })
          case PAYMENT_METHOD.CMI:
            throw new Error('CMI is retired for marketplace checkout. Use PayPal or bank transfer instead.')
          case PAYMENT_METHOD.CASH:
            return await this.processCodPayment({ orderId, amount, customer })
          case PAYMENT_METHOD.BANK_TRANSFER:
            return await this.processBankTransfer({ orderId, amount, customer })
          default:
            throw new Error('Unsupported payment method for Morocco')
        }
      },
      { maxRetries: 2, baseDelay: 1000 }
    )
  }

  /**
   * Process PayPal payment
   */
  async processPayPalPayment({ orderId, amount, currency, customer }) {
    return withRetry(
      async () => {
        if (!this.getPayPalClientId()) {
          throw new Error('PayPal not configured')
        }

        // Create PayPal order on backend
        const { data: paypalOrder, error } = await supabase.functions.invoke('create-paypal-order', {
          body: {
            orderId,
            amount,
            currency,
            customer: {
              email: customer.email,
              name: customer.name,
            },
            metadata: {
              orderId,
              platform: 'qotoof',
            },
          },
        })

        if (error) throw error

        const { data: payment, error: paymentError } = await insertPaymentRecord({
          payload: {
            order_id: orderId,
            amount,
            payment_method: PAYMENT_METHOD.PAYPAL,
            status: 'pending',
            transaction_id: paypalOrder?.orderId || null,
          },
        })

        if (paymentError) throw paymentError

        return {
          payment_method: PAYMENT_METHOD.PAYPAL,
          method: PAYMENT_METHOD.PAYPAL,
          paymentId: payment.id,
          orderId: paypalOrder?.orderId,
          approvalUrl: paypalOrder?.approvalUrl,
          status: paypalOrder?.approvalUrl ? 'redirecting' : 'requires_confirmation',
        }
      },
      { maxRetries: 2, baseDelay: 1000 }
    )
  }

  /**
   * Historical compatibility shim.
   * Active marketplace checkout no longer exposes CMI.
   */
  async processCmiPayment() {
    throw new Error('CMI is retired for marketplace checkout. Use PayPal or bank transfer instead.')
  }

  /**
   * Process Cash on Delivery
   */
  async processCodPayment({ orderId, amount, customer }) {
    return withRetry(
      async () => {
        // Save payment record
        const { data: payment, error } = await insertPaymentRecord({
          payload: {
            order_id: orderId,
            amount,
            payment_method: PAYMENT_METHOD.CASH,
            status: 'pending',
            customer_name: customer.name,
            customer_phone: customer.phone,
          },
        })

        if (error) throw error

        return {
          payment_method: PAYMENT_METHOD.CASH,
          method: PAYMENT_METHOD.CASH,
          paymentId: payment.id,
          status: 'confirmed',
          message: 'سيتم الدفع عند الاستلام',
        }
      },
      { maxRetries: 2, baseDelay: 1000 }
    )
  }

  /**
   * Process Bank Transfer
   */
  async processBankTransfer({ orderId, amount, customer }) {
    return withRetry(
      async () => {
        // Generate reference number
        const referenceNumber = `BANK-${orderId}-${Date.now()}`

        // Save payment record
        const { data: payment, error } = await insertPaymentRecord({
          payload: {
            order_id: orderId,
            amount,
            payment_method: PAYMENT_METHOD.BANK_TRANSFER,
            status: 'awaiting_transfer',
            reference_number: referenceNumber,
            customer_name: customer.name,
          },
        })

        if (error) throw error

        // SECURITY: Bank details (IBAN, BIC) must NOT be hardcoded in frontend.
        // Fetch them from a server-side config so they can be rotated without a code deploy.
        let bankDetails = { reference: referenceNumber }
        try {
          const bankConfig = await this.getCachedBankDetails(referenceNumber)
          if (bankConfig) bankDetails = { ...bankConfig, reference: referenceNumber }
        } catch (e) {
          logger.error('Failed to fetch bank details from backend:', e)
        }

        return {
          payment_method: PAYMENT_METHOD.BANK_TRANSFER,
          method: PAYMENT_METHOD.BANK_TRANSFER,
          paymentId: payment.id,
          status: 'awaiting_transfer',
          referenceNumber,
          bankDetails,
          message: 'يرجى إكمال التحويل خلال 24 ساعة',
          deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        }
      },
      { maxRetries: 2, baseDelay: 1000 }
    )
  }

  /**
   * Cache bank details to avoid duplicate function calls for near-identical requests.
   */
  async getCachedBankDetails(referenceNumber) {
    const cacheKey = 'default'
    const cached = this.bankDetailsCache.get(cacheKey)
    const now = Date.now()
    if (cached && cached.expiresAt > now) {
      return cached.value
    }

    const { data: bankConfig } = await supabase.functions.invoke('get-bank-details', {
      body: { referenceNumber }
    })
    this.bankDetailsCache.set(cacheKey, {
      value: bankConfig || null,
      expiresAt: now + this.bankDetailsTtlMs,
    })
    return bankConfig || null
  }

  /**
   * Confirm PayPal payment
   */
  async confirmPayPalPayment(orderId) {
    return withRetry(
      async () => {
        if (!this.getPayPalClientId()) {
          throw new Error('PayPal not configured')
        }

        const { data: captureResult, error } = await supabase.functions.invoke('capture-paypal-order', {
          body: { orderId },
        })

        if (error) {
          logger.error('PayPal confirmation error:', error)
          throw new Error(error.message)
        }

        const status = captureResult?.paymentStatus || (captureResult?.status === 'COMPLETED' ? 'completed' : 'pending')

        return {
          status,
          orderId,
          internalOrderId: captureResult?.internalOrderId || null,
        }
      },
      { maxRetries: 2, baseDelay: 1000 }
    )
  }

  /**
   * Verify CMI payment callback
   */
  async verifyCmiCallback(callbackData) {
    return withRetry(
      async () => {
        const { authCode, txnStatus, oid } = callbackData

        // SECURITY: Hash verification must happen server-side where the CMI store key lives.
        // Delegate to the Edge Function which verifies the signature and returns the result.
        const { data: verification, error: verifyError } = await supabase.functions.invoke('verify-cmi-callback', {
          body: callbackData,
        })

        if (verifyError || !verification?.valid) {
          logger.error('CMI callback verification failed', verifyError)
          return { success: false, error: 'Invalid signature' }
        }

        // Update payment status
        const status = txnStatus === 'Approved' ? 'completed' : 'failed'

        const { data: payment, error } = await supabase
          .from('payments')
          .update({
            status,
            gateway_response: { txnStatus, oid, authCode },
            auth_code: authCode,
            confirmed_at: status === 'completed' ? new Date().toISOString() : null,
          })
          .eq('transaction_id', oid)
          .select()
          .single()

        if (error) {
          logger.error('Error updating CMI payment:', error)
          return { success: false, error: error.message }
        }

        // Update order status if payment completed
        if (status === 'completed' && payment) {
          await supabase
            .from('orders')
            .update({ payment_status: 'paid' })
            .eq('id', payment.order_id)
        }

        return {
          success: status === 'completed',
          paymentId: payment?.id,
          status,
        }
      },
      { maxRetries: 3, baseDelay: 1000 }
    )
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(orderId) {
    return withRetry(
      async () => {
        const { data, error } = await getLatestPaymentRecordForOrder({ orderId })

        if (error) throw error

        return data
      },
      { maxRetries: 3, baseDelay: 1000 }
    )
  }

  /**
   * Refund payment
   */
  async refundPayment(paymentId, amount, reason = '') {
    return withRetry(
      async () => {
        const { data: payment, error: fetchError } = await getPaymentRecordById({ paymentId })

        if (fetchError) throw fetchError

        const paymentMethod = resolvePaymentMethod(payment)

        if (paymentMethod === PAYMENT_METHOD.PAYPAL) {
          return await this.refundPayPalPayment(payment, amount, reason)
        } else if (paymentMethod === PAYMENT_METHOD.CMI || paymentMethod === 'card') {
          return await this.refundCmiPayment(payment, amount, reason)
        } else {
          // Manual refund for COD/Bank
          await updatePaymentRecordById({
            paymentId,
            values: {
              status: 'refunded',
              refund_amount: amount,
              refund_reason: reason,
              refunded_at: new Date().toISOString(),
            },
            select: 'id',
          })

          return { success: true, status: 'refunded' }
        }
      },
      { maxRetries: 2, baseDelay: 1000 }
    )
  }

  /**
   * Refund PayPal payment
   */
  async refundPayPalPayment(payment, amount, reason = '') {
    return withRetry(
      async () => {
        const refundReason = reason || 'requested_by_customer'
        const { data, error } = await supabase.functions.invoke('refund-paypal-payment', {
          body: {
            orderId: payment.transaction_id,
            amount,
            reason: refundReason,
          },
        })

        if (error) throw error

        await updatePaymentRecordById({
          paymentId: payment.id,
          values: {
            status: 'refunded',
            refund_amount: amount,
            refund_reason: refundReason,
            refunded_at: new Date().toISOString(),
            gateway_response: data,
          },
          select: 'id',
        })

        return { success: true, status: 'refunded' }
      },
      { maxRetries: 2, baseDelay: 1000 }
    )
  }

  /**
   * Refund CMI payment
   */
  async refundCmiPayment(payment, amount, reason = '') {
    return withRetry(
      async () => {
        // SECURITY: CMI refund must be processed server-side — never call CMI API directly from browser.
        // The merchant key and direct API access must stay on the backend.
        const refundReason = reason || 'requested_by_customer'
        const { data: result, error } = await supabase.functions.invoke('refund-cmi-payment', {
          body: {
            orderId: payment.order_id,
            paymentId: payment.id,
            transactionId: payment.transaction_id,
            amount,
            reason: refundReason,
          },
        })

        if (error) throw error

        if (result?.success) {
          await updatePaymentRecordById({
            paymentId: payment.id,
            values: {
              status: 'refunded',
              refund_amount: amount,
              refund_reason: refundReason,
              refunded_at: new Date().toISOString(),
            },
            select: 'id',
          })
        }

        return { success: result?.success === true, status: result?.status }
      },
      { maxRetries: 2, baseDelay: 1000 }
    )
  }

  // generateCmiHash intentionally removed from frontend.
  // Hash generation requires the CMI store key which must never be exposed to the browser.
  // All CMI signing is handled by the 'create-cmi-session' Edge Function.

  /**
   * Get available payment methods
   */
  getAvailableMethods() {
    const methods = [
      { id: 'cod', name: 'الدفع عند الاستلام', icon: '💵', available: true },
      { id: 'bank', name: 'تحويل بنكي', icon: '🏦', available: true },
    ]

    if (this.getPayPalClientId()) {
      methods.push({ id: 'paypal', name: 'PayPal', icon: '🅿️', available: true })
    }

    return methods
  }
}

// Singleton instance
export const paymentGateway = new PaymentGateway()

// React hook for easy integration
import { useState, useCallback } from 'react'

export const usePayment = () => {
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState(null)

  const processPayment = useCallback(async (options) => {
    setProcessing(true)
    setError(null)

    try {
      const result = await paymentGateway.initializePayment(options)
      return { success: true, data: result }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setProcessing(false)
    }
  }, [])

  return {
    processPayment,
    processing,
    error,
    availableMethods: paymentGateway.getAvailableMethods(),
  }
}

export default paymentGateway
