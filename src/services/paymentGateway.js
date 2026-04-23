import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'
import { withRetry } from '@/utils/withRetry'

/**
 * Payment Gateway Service
 * Supports multiple payment methods for Morocco:
 * - CMI (Centre Monétique Interbancaire - Morocco)
 * - COD (Cash on Delivery)
 * - Bank Transfer
 */
class PaymentGateway {
  constructor() {
    this.stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY
    // NOTE: Stripe secret key is handled server-side in Supabase Edge Functions only.
    // Never expose it in VITE_ env vars — it would be bundled into the client.
    this.cmiMerchantId = import.meta.env.VITE_CMI_MERCHANT_ID
    // NOTE: CMI store key is handled server-side in the 'create-cmi-session' Edge Function only.
    // Never expose it via VITE_ env vars — it would be bundled into the browser.
    this.isTestMode = import.meta.env.VITE_PAYMENT_MODE !== 'production'
    this.bankDetailsCache = new Map()
    this.bankDetailsTtlMs = 5 * 60 * 1000
  }

  /**
   * Initialize payment
   * @param {Object} options - Payment options
   * @param {string} options.orderId - Order ID
   * @param {number} options.amount - Amount in MAD
   * @param {string} options.method - Payment method (stripe, cm, cod, bank)
   * @param {string} options.currency - Currency (default: MAD)
   * @param {Object} options.customer - Customer info
   * @returns {Promise<Object>} Payment result
   */
  async initializePayment({ orderId, amount, method, currency = 'MAD', customer }) {
    return withRetry(
      async () => {
        switch (method) {
          case 'cmi':
            return await this.processCmiPayment({ orderId, amount, currency, customer })
          case 'cod':
            return await this.processCodPayment({ orderId, amount, customer })
          case 'bank':
            return await this.processBankTransfer({ orderId, amount, customer })
          default:
            throw new Error('Unsupported payment method for Morocco')
        }
      },
      { maxRetries: 2, baseDelay: 1000 }
    )
  }

  /**
   * Process Stripe payment
   */
  async processStripePayment({ orderId, amount, currency, customer }) {
    return withRetry(
      async () => {
        if (!this.stripePublicKey) {
          throw new Error('Stripe not configured')
        }

        // Create payment intent on backend
        const { data: paymentIntent, error } = await supabase.functions.invoke('create-payment-intent', {
          body: {
            orderId,
            amount: Math.round(amount * 100), // Convert to cents
            currency: currency.toLowerCase(),
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

        return {
          method: 'stripe',
          clientSecret: paymentIntent.clientSecret,
          paymentIntentId: paymentIntent.id,
          status: 'requires_confirmation',
        }
      },
      { maxRetries: 2, baseDelay: 1000 }
    )
  }

  /**
   * Process CMI payment (Moroccan gateway)
   * SECURITY: Hash generation and merchant keys are handled server-side via Edge Function.
   * The frontend only initiates the request; the backend returns the signed params.
   */
  async processCmiPayment({ orderId, amount, currency, customer }) {
    return withRetry(
      async () => {
        if (!this.cmiMerchantId) {
          throw new Error('CMI not configured')
        }

        // Delegate to backend Edge Function — never compute CMI hash on the client
        const { data: cmiSession, error: fnError } = await supabase.functions.invoke('create-cmi-session', {
          body: {
            orderId,
            amount: Math.round(amount * 100),
            currency: currency === 'MAD' ? '504' : '840',
            customer: { email: customer.email, name: customer.name, phone: customer.phone },
            okUrl: `${window.location.origin}/payment/success`,
            failUrl: `${window.location.origin}/payment/failed`,
          },
        })

        if (fnError) throw fnError

        // Save payment record (no sensitive keys stored here)
        const { data: payment, error } = await supabase
          .from('payments')
          .insert({
            order_id: orderId,
            amount,
            method: 'cmi',
            status: 'pending',
            transaction_id: cmiSession.transactionId,
          })
          .select()
          .single()

        if (error) throw error

        return {
          method: 'cmi',
          redirectUrl: cmiSession.redirectUrl,
          params: cmiSession.params, // Signed by backend — no store key in browser
          paymentId: payment.id,
          status: 'redirecting',
        }
      },
      { maxRetries: 2, baseDelay: 1000 }
    )
  }

  /**
   * Process Cash on Delivery
   */
  async processCodPayment({ orderId, amount, customer }) {
    return withRetry(
      async () => {
        // Save payment record
        const { data: payment, error } = await supabase
          .from('payments')
          .insert({
            order_id: orderId,
            amount,
            method: 'cod',
            status: 'pending',
            customer_name: customer.name,
            customer_phone: customer.phone,
          })
          .select()
          .single()

        if (error) throw error

        return {
          method: 'cod',
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
        const { data: payment, error } = await supabase
          .from('payments')
          .insert({
            order_id: orderId,
            amount,
            method: 'bank',
            status: 'awaiting_transfer',
            reference_number: referenceNumber,
            customer_name: customer.name,
          })
          .select()
          .single()

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
          method: 'bank',
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
   * Confirm Stripe payment
   */
  async confirmStripePayment(clientSecret, paymentMethod) {
    return withRetry(
      async () => {
        if (!this.stripePublicKey) {
          throw new Error('Stripe not configured')
        }

        // Load Stripe
        const stripe = await this.loadStripe()

        // Confirm payment
        const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: paymentMethod,
        })

        if (error) {
          logger.error('Stripe confirmation error:', error)
          throw new Error(error.message)
        }

        // Update payment status in database
        await supabase
          .from('payments')
          .update({
            status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
            gateway_response: paymentIntent,
            confirmed_at: new Date().toISOString(),
          })
          .eq('payment_intent_id', paymentIntent.id)

        return {
          status: paymentIntent.status,
          paymentIntentId: paymentIntent.id,
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
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single()

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
        const { data: payment, error: fetchError } = await supabase
          .from('payments')
          .select('*')
          .eq('id', paymentId)
          .single()

        if (fetchError) throw fetchError

        if (payment.method === 'stripe') {
          return await this.refundStripePayment(payment, amount)
        } else if (payment.method === 'cmi') {
          return await this.refundCmiPayment(payment, amount)
        } else {
          // Manual refund for COD/Bank
          await supabase
            .from('payments')
            .update({
              status: 'refunded',
              refund_amount: amount,
              refund_reason: reason,
              refunded_at: new Date().toISOString(),
            })
            .eq('id', paymentId)

          return { success: true, status: 'refunded' }
        }
      },
      { maxRetries: 2, baseDelay: 1000 }
    )
  }

  /**
   * Refund Stripe payment
   */
  async refundStripePayment(payment, amount) {
    return withRetry(
      async () => {
        const { data, error } = await supabase.functions.invoke('refund-payment', {
          body: {
            paymentIntentId: payment.payment_intent_id,
            amount: Math.round(amount * 100),
            reason: 'requested_by_customer',
          },
        })

        if (error) throw error

        await supabase
          .from('payments')
          .update({
            status: 'refunded',
            refund_amount: amount,
            refund_reason: 'requested_by_customer',
            refunded_at: new Date().toISOString(),
            gateway_response: data,
          })
          .eq('id', payment.id)

        return { success: true, status: 'refunded' }
      },
      { maxRetries: 2, baseDelay: 1000 }
    )
  }

  /**
   * Refund CMI payment
   */
  async refundCmiPayment(payment, amount) {
    return withRetry(
      async () => {
        // SECURITY: CMI refund must be processed server-side — never call CMI API directly from browser.
        // The merchant key and direct API access must stay on the backend.
        const { data: result, error } = await supabase.functions.invoke('refund-cmi-payment', {
          body: {
            paymentId: payment.id,
            transactionId: payment.transaction_id,
            amount: Math.round(amount * 100),
          },
        })

        if (error) throw error

        if (result?.success) {
          await supabase
            .from('payments')
            .update({
              status: 'refunded',
              refund_amount: amount,
              refunded_at: new Date().toISOString(),
            })
            .eq('id', payment.id)
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
   * Load Stripe library
   */
  async loadStripe() {
    if (window.Stripe) return window.Stripe(this.stripePublicKey)

    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://js.stripe.com/v3/'
      script.onload = () => resolve(window.Stripe(this.stripePublicKey))
      script.onerror = reject
      document.head.appendChild(script)
    })
  }

  /**
   * Get available payment methods
   */
  getAvailableMethods() {
    const methods = [
      { id: 'cod', name: 'الدفع عند الاستلام', icon: '💵', available: true },
      { id: 'bank', name: 'تحويل بنكي', icon: '🏦', available: true },
    ]

    if (this.cmiMerchantId) {
      methods.push({ id: 'cmi', name: 'CMI (المغرب)', icon: '🇲🇦', available: true })
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
