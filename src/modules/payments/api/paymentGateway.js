import { supabase } from '@/services/supabase'
import { PAYMENT_METHOD } from '@/constants/payment'
import {
  getLatestPaymentRecordForOrder,
  getPaymentRecordById,
  insertPaymentRecord,
  normalizePaymentMethod,
  resolvePaymentMethod,
  updatePaymentRecordById,
} from './paymentRecords'
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
    this.paymentIntentCache = new Map()
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
        const frontendOrigin = typeof window !== 'undefined' ? window.location.origin : ''
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
            returnUrl: frontendOrigin ? `${frontendOrigin}/order-confirmation/${orderId}?paypal=success` : undefined,
            cancelUrl: frontendOrigin ? `${frontendOrigin}/order-confirmation/${orderId}?paypal=cancel` : undefined,
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
        const nowIso = new Date().toISOString()
        const customerName = customer?.name || null
        const customerPhone = customer?.phone || null

        // Save payment record (schema-safe columns only)
        const { data: payment, error } = await insertPaymentRecord({
          payload: {
            order_id: orderId,
            amount,
            payment_method: PAYMENT_METHOD.CASH,
            status: 'pending',
          },
        })

        if (error) throw error

        // Store COD metadata in orders.invoice_metadata
        const { data: orderData, error: orderFetchError } = await supabase
          .from('orders')
          .select('invoice_metadata')
          .eq('id', orderId)
          .single()

        if (orderFetchError) throw orderFetchError

        const existingMeta = orderData?.invoice_metadata || {}
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({
            invoice_metadata: {
              ...existingMeta,
              cod: {
                customer_name: customerName,
                customer_phone: customerPhone,
                amount,
                status: 'pending',
                created_at: nowIso,
              },
            },
            updated_at: nowIso,
          })
          .eq('id', orderId)

        if (orderUpdateError) throw orderUpdateError

        return {
          payment_method: PAYMENT_METHOD.CASH,
          method: PAYMENT_METHOD.CASH,
          paymentId: payment.id,
          status: 'pending',
          message: 'سيتم الدفع عند الاستلام',
        }
      },
      { maxRetries: 2, baseDelay: 1000 }
    )
  }

  async recordRefund({ payment, amount, reason, status, gatewayResponse = null }) {
    const result = await supabase
      .from('refunds')
      .insert({
        payment_id: payment.id,
        order_id: payment.order_id,
        amount,
        reason,
        status,
        gateway_response: gatewayResponse,
      })
    if (result.error) {
      logger.warn('refund_record_failed', {
        paymentId: payment.id,
        orderId: payment.order_id,
        amount,
        status,
        error: result.error,
      })
    }
    return result
  }

  /**
   * Process Bank Transfer
   */
  async processBankTransfer({ orderId, amount, customer }) {
    return withRetry(
      async () => {
        const nowIso = new Date().toISOString()
        const referenceNumber = `BANK-${orderId}-${Date.now()}`
        const customerName = customer?.name || null

        // Save payment record (schema-safe columns only)
        const { data: payment, error } = await insertPaymentRecord({
          payload: {
            order_id: orderId,
            amount,
            payment_method: PAYMENT_METHOD.BANK_TRANSFER,
            status: 'awaiting_transfer',
          },
        })
        if (error) throw error

        // Store bank transfer metadata in orders.invoice_metadata
        const { data: orderData, error: orderFetchError } = await supabase
          .from('orders')
          .select('invoice_metadata')
          .eq('id', orderId)
          .single()

        if (orderFetchError) throw orderFetchError

        const existingMeta = orderData?.invoice_metadata || {}
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({
            invoice_metadata: {
              ...existingMeta,
              bank_transfer: {
                ...(existingMeta.bank_transfer || {}),
                reference_number: referenceNumber,
                customer_name: customerName,
                initiated_at: nowIso,
              },
            },
            updated_at: nowIso,
          })
          .eq('id', orderId)

        if (orderUpdateError) throw orderUpdateError

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

        // Update order status if payment completed — uses SECURITY DEFINER RPC
        // to prevent direct client-side payment_status manipulation.
        if (status === 'completed' && payment) {
          const { error: rpcError } = await supabase.rpc('confirm_cmi_payment', {
            p_transaction_id: oid,
            p_order_id: payment.order_id,
          })
          if (rpcError) {
            logger.error('Error confirming CMI payment via RPC:', rpcError)
          }
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
          // Manual refund for COD/Bank — delegated to secure Edge Function
          const { data: result, error } = await supabase.functions.invoke('process-manual-refund', {
            body: {
              paymentId,
              amount,
              reason,
            },
          })

          if (error) throw error

          return {
            success: result?.success === true,
            status: result?.payment?.status,
            data: result,
          }
        }
      },
      { maxRetries: 2, baseDelay: 1000 }
    )
  }

  /**
   * Refund PayPal payment
   */
  async refundPayPalPayment(payment, amount, reason = '') {
    // Step 1: PayPal API call (once, no retry around it)
    const refundReason = reason || 'requested_by_customer'
    const { data, error } = await supabase.functions.invoke('refund-paypal-payment', {
      body: {
        orderId: payment.transaction_id,
        amount,
        reason: refundReason,
      },
    })

    if (error) throw error

    const nowIso = new Date().toISOString()

    // Step 2: DB persistence with isolated retry (does NOT re-call PayPal API)
    await withRetry(
      async () => {
        // 2a: Safe payments update (schema-compliant columns only)
        await updatePaymentRecordById({
          paymentId: payment.id,
          values: {
            status: 'refunded',
            updated_at: nowIso,
          },
          select: 'id',
        })

        // 2b: Merge refund metadata into orders.invoice_metadata
        const { data: orderData, error: orderFetchError } = await supabase
          .from('orders')
          .select('invoice_metadata')
          .eq('id', payment.order_id)
          .single()

        if (orderFetchError) throw orderFetchError

        const existingMeta = orderData?.invoice_metadata || {}
        const { error: orderUpdateError } = await supabase
          .from('orders')
          .update({
            invoice_metadata: {
              ...existingMeta,
              paypal_refund: {
                refund_id: data?.id || null,
                status: data?.status || null,
                amount,
                reason: refundReason || null,
                refunded_at: nowIso,
                gateway_summary: {
                  id: data?.id || null,
                  status: data?.status || null,
                  create_time: data?.create_time || null,
                  update_time: data?.update_time || null,
                },
              },
            },
            updated_at: nowIso,
          })
          .eq('id', payment.order_id)

        if (orderUpdateError) throw orderUpdateError
      },
      { maxRetries: 2, baseDelay: 1000 }
    )

    // Step 3: Non-blocking recordRefund (refunds table may not exist)
    try {
      await this.recordRefund({
        payment,
        amount,
        reason: refundReason,
        status: 'refunded',
        gatewayResponse: {
          id: data?.id || null,
          status: data?.status || null,
        },
      })
    } catch (recordErr) {
      logger.warn('PayPal refund succeeded but recordRefund skipped (refunds table unavailable):', recordErr.message)
    }

    return { success: true, status: 'refunded' }
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

          await this.recordRefund({
            payment,
            amount,
            reason: refundReason,
            status: 'refunded',
            gatewayResponse: result,
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

const toGatewayResult = async (operation) => {
  try {
    const data = await operation()
    return { data, error: null }
  } catch (error) {
    return { data: null, error }
  }
}

export const createPaymentIntent = async (params) => {
  const cacheKey = `${params?.orderId || ''}:${params?.paymentMethod || params?.payment_method || params?.method || ''}:${params?.currency || 'MAD'}`
  if (cacheKey.trim() !== '::' && paymentGateway.paymentIntentCache.has(cacheKey)) {
    return paymentGateway.paymentIntentCache.get(cacheKey)
  }

  const result = await toGatewayResult(() => paymentGateway.initializePayment(params))
  if (cacheKey.trim() !== '::' && !result.error) {
    paymentGateway.paymentIntentCache.set(cacheKey, result)
  }
  return result
}

export const confirmPayment = async (paymentId) => toGatewayResult(async () => {
  const { data: payment, error: fetchError } = await getPaymentRecordById({ paymentId })
  if (fetchError) throw fetchError

  const { data: updated, error: updateError } = await updatePaymentRecordById({
    paymentId,
    values: {
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    },
  })

  if (updateError) throw updateError
  return {
    ...(updated || payment),
    status: 'confirmed',
  }
})

export const getPaymentById = async (paymentId) => toGatewayResult(async () => {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      order:orders(
        id,
        order_number,
        buyer:profiles!buyer_id(id, first_name, last_name, email),
        vendor:profiles!vendor_id(id, first_name, store_name)
      )
    `)
    .eq('id', paymentId)
    .single()

  if (error) throw error
  return data
})

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
