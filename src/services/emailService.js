import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

/**
 * Email Notification Service
 * Handles all email notifications in the application
 * Uses Supabase Edge Functions for actual email sending
 */
class EmailService {
  constructor() {
    this.enabled = import.meta.env.VITE_EMAIL_ENABLED === 'true'
    this.fromEmail = import.meta.env.VITE_EMAIL_FROM || 'Qotoof273@gmail.com'
    this.appName = 'Qotoof'
  }

  /**
   * Send order confirmation email to buyer
   */
  async sendOrderConfirmation(order, customer) {
    if (!this.enabled) {
      logger.info('Email disabled, skipping order confirmation')
      return { success: true, skipped: true }
    }

    return this.sendEmail({
      to: customer.email,
      toName: customer.name,
      subject: `تأكيد طلبك #${order.order_number || order.id.slice(0, 8)}`,
      template: 'order_confirmation',
      data: {
        orderNumber: order.order_number || order.id.slice(0, 8),
        orderDate: new Date(order.created_at).toLocaleDateString('ar-MA'),
        total: order.total,
        items: order.items || [],
        shippingAddress: order.shipping_address,
        shippingCity: order.shipping_city,
        paymentMethod: order.payment_method,
        estimatedDelivery: order.estimated_delivery,
      },
    })
  }

  /**
   * Send order status update to buyer
   */
  async sendOrderStatusUpdate(order, customer, newStatus) {
    if (!this.enabled) return { success: true, skipped: true }

    const statusMessages = {
      confirmed: {
        subject: '✅ تم تأكيد طلبك',
        message: 'تم تأكيد طلبك من قبل البائع وسيتم التحضير قريباً',
      },
      preparing: {
        subject: '📦 طلبك قيد التحضير',
        message: 'البائع يحضر طلبك الآن',
      },
      shipped: {
        subject: '🚚 طلبك في الطريق!',
        message: 'تم شحن طلبك وهو في الطريق إليك',
      },
      delivered: {
        subject: '✓ تم تسليم طلبك',
        message: 'تم تسليم طلبك بنجاح. نتمنى أن تكون راضياً عن منتجاتنا',
      },
      cancelled: {
        subject: '❌ تم إلغاء طلبك',
        message: 'تم إلغاء طلبك. سيتم استرداد المبلغ إن كان مدفوعاً',
      },
    }

    const statusInfo = statusMessages[newStatus] || {
      subject: 'تحديث حالة طلبك',
      message: `تم تحديث حالة طلبك إلى: ${newStatus}`,
    }

    return this.sendEmail({
      to: customer.email,
      toName: customer.name,
      subject: statusInfo.subject,
      template: 'order_status_update',
      data: {
        orderNumber: order.order_number || order.id.slice(0, 8),
        status: newStatus,
        message: statusInfo.message,
        trackingUrl: `${window.location.origin}/orders/${order.id}/tracking`,
      },
    })
  }

  /**
   * Send new order notification to vendor
   */
  async sendNewOrderToVendor(order, vendor) {
    if (!this.enabled) return { success: true, skipped: true }

    return this.sendEmail({
      to: vendor.email,
      toName: vendor.name,
      subject: `🎉 طلب جديد #${order.order_number || order.id.slice(0, 8)}`,
      template: 'vendor_new_order',
      data: {
        orderNumber: order.order_number || order.id.slice(0, 8),
        orderDate: new Date(order.created_at).toLocaleDateString('ar-MA'),
        total: order.total,
        items: order.items || [],
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        shippingCity: order.shipping_city,
        actionUrl: `${window.location.origin}/vendor/orders`,
      },
    })
  }

  /**
   * Send delivery assignment to driver
   */
  async sendDeliveryAssignment(delivery, driver) {
    if (!this.enabled) return { success: true, skipped: true }

    return this.sendEmail({
      to: driver.email,
      toName: driver.name,
      subject: '🚚 مهمة توصيل جديدة',
      template: 'driver_new_delivery',
      data: {
        deliveryId: delivery.id.slice(0, 8),
        pickupAddress: delivery.pickup_address,
        deliveryAddress: delivery.delivery_address,
        earnings: delivery.earnings,
        actionUrl: `${window.location.origin}/driver/dashboard`,
      },
    })
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(user, resetUrl) {
    if (!this.enabled) return { success: true, skipped: true }

    return this.sendEmail({
      to: user.email,
      toName: user.name,
      subject: 'إعادة تعيين كلمة المرور',
      template: 'password_reset',
      data: {
        resetUrl,
        expiryHours: 1,
      },
    })
  }

  /**
   * Send email verification
   */
  async sendEmailVerification(user, verificationUrl) {
    if (!this.enabled) return { success: true, skipped: true }

    return this.sendEmail({
      to: user.email,
      toName: user.name,
      subject: 'تأكيد بريدك الإلكتروني',
      template: 'email_verification',
      data: {
        verificationUrl,
      },
    })
  }

  /**
   * Send return request confirmation
   */
  async sendReturnRequestConfirmation(returnRequest, customer) {
    if (!this.enabled) return { success: true, skipped: true }

    return this.sendEmail({
      to: customer.email,
      toName: customer.name,
      subject: '📋 تم استلام طلب الإرجاع',
      template: 'return_request',
      data: {
        returnId: returnRequest.id.slice(0, 8),
        orderNumber: returnRequest.order_number,
        reason: returnRequest.reason,
        status: 'قيد المراجعة',
      },
    })
  }

  /**
   * Send return status update
   */
  async sendReturnStatusUpdate(returnRequest, customer, newStatus) {
    if (!this.enabled) return { success: true, skipped: true }

    const statusMessages = {
      approved: {
        subject: '✅ تمت الموافقة على طلب الإرجاع',
        message: 'تمت الموافقة على طلب الإرجاع. سيتم استرداد المبلغ خلال 3-5 أيام عمل',
      },
      rejected: {
        subject: '❌ تم رفض طلب الإرجاع',
        message: 'عذراً، تم رفض طلب الإرجاع. يرجى التواصل مع خدمة العملاء',
      },
      refunded: {
        subject: '💰 تم استرداد المبلغ',
        message: 'تم استرداد المبلغ إلى حسابك',
      },
    }

    const statusInfo = statusMessages[newStatus] || {
      subject: 'تحديث طلب الإرجاع',
      message: `تم تحديث طلب الإرجاع إلى: ${newStatus}`,
    }

    return this.sendEmail({
      to: customer.email,
      toName: customer.name,
      subject: statusInfo.subject,
      template: 'return_status_update',
      data: {
        returnId: returnRequest.id.slice(0, 8),
        status: newStatus,
        message: statusInfo.message,
      },
    })
  }

  /**
   * Send OTP code for MFA verification
   * @param {Object} user - User object with email property
   * @param {string} otp - The OTP code to send
   */
  async sendOTP(user, otp) {
    if (!this.enabled) return { success: true, skipped: true }

    return this.sendEmail({
      to: user.email,
      toName: user.user_metadata?.full_name || user.email.split('@')[0],
      subject: '🔐 رمز التحقق الخاص بك - Qotoof',
      template: 'otp_verification',
      data: {
        otp,
        expiryMinutes: 10,
        appName: this.appName,
      },
    })
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(user) {
    if (!this.enabled) return { success: true, skipped: true }

    return this.sendEmail({
      to: user.email,
      toName: user.name,
      subject: '🎉 مرحباً بك في قطوف!',
      template: 'welcome',
      data: {
        name: user.name,
        marketplaceUrl: `${window.location.origin}/marketplace`,
        becomeVendorUrl: `${window.location.origin}/become-vendor`,
      },
    })
  }

  /**
   * Send payment receipt
   */
  async sendPaymentReceipt(payment, order, customer) {
    if (!this.enabled) return { success: true, skipped: true }

    return this.sendEmail({
      to: customer.email,
      toName: customer.name,
      subject: '🧾 إيصال الدفع',
      template: 'payment_receipt',
      data: {
        orderNumber: order.order_number || order.id.slice(0, 8),
        amount: payment.amount,
        paymentMethod: payment.method,
        paymentDate: new Date(payment.created_at).toLocaleDateString('ar-MA'),
        transactionId: payment.transaction_id || payment.id.slice(0, 8),
      },
    })
  }

  /**
   * Core email sending function
   * Uses Supabase Edge Function
   */
  async sendEmail({ to, toName, subject, template, data }) {
    try {
      const { response, error } = await supabase.functions.invoke('send-email', {
        body: {
          to,
          toName,
          from: this.fromEmail,
          fromName: this.appName,
          subject,
          template,
          data,
        },
      })

      if (error) {
        logger.error('Email sending error:', error)
        return { success: false, error: error.message }
      }

      logger.info('Email sent successfully to:', to)
      return { success: true, messageId: response?.messageId }
    } catch (error) {
      logger.error('Email service error:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * Queue email for sending (non-blocking)
   */
  queueEmail(...args) {
    setTimeout(() => {
      this.sendEmail(...args).catch(err => {
        logger.error('Queued email failed:', err)
      })
    }, 0)
  }
}

// Singleton instance
export const emailService = new EmailService()

// React hook for easy integration
import { useCallback } from 'react'

export const useEmail = () => {
  const sendEmail = useCallback((options) => {
    return emailService.sendEmail(options)
  }, [])

  const queueEmail = useCallback((options) => {
    emailService.queueEmail(options)
  }, [])

  return { sendEmail, queueEmail, enabled: emailService.enabled }
}

export default emailService
