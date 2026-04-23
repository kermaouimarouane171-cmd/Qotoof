import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'
import { withRetry } from '@/utils/withRetry'

/**
 * SMS Service
 * Sends SMS notifications via Supabase Edge Functions (which call Twilio server-side).
 * Twilio credentials are never exposed to the client.
 */
class SMSService {
  constructor() {
    this.enabled = import.meta.env.VITE_SMS_ENABLED === 'true'
  }

  /**
   * Format Moroccan phone numbers to E.164 format (+212XXXXXXXXX)
   */
  formatPhoneNumber(phone) {
    if (!phone) return null
    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, '')
    // If starts with 212 (country code) keep as is
    if (digits.startsWith('212') && digits.length === 12) return `+${digits}`
    // If starts with 0 (local format), replace with +212
    if (digits.startsWith('0') && digits.length === 10) return `+212${digits.slice(1)}`
    // If 9 digits, prepend +212
    if (digits.length === 9) return `+212${digits}`
    // Already has + prefix form
    if (phone.startsWith('+')) return phone
    return null
  }

  /**
   * Send SMS via Supabase Edge Function (server-side Twilio call)
   */
  async sendSMS({ to, message }) {
    if (!this.enabled) {
      logger.info('[SMS] Disabled, skipping send', { to, messageLength: message.length })
      return { success: true, skipped: true }
    }

    const formattedPhone = this.formatPhoneNumber(to)
    if (!formattedPhone) {
      logger.warn('[SMS] Invalid phone number:', to)
      return { success: false, error: 'Invalid phone number format' }
    }

    return withRetry(async () => {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: { to: formattedPhone, message },
      })

      if (error) throw error
      return { success: true, sid: data?.sid }
    }, { maxRetries: 2, baseDelay: 1000 })
  }

  /**
   * Send 2FA verification code
   */
  async send2FACode(phone, code) {
    return this.sendSMS({
      to: phone,
      message: `رمز التحقق من قطوف: ${code}. صالح لمدة 10 دقائق. لا تشاركه مع أحد. | Qotoof verification: ${code}. Valid 10 min.`,
    })
  }

  /**
   * Send delivery OTP to buyer (shared with driver at door)
   */
  async sendDeliveryOTP(phone, otp, orderNumber) {
    return this.sendSMS({
      to: phone,
      message: `قطوف: رمز استلام طلبك #${orderNumber} هو: ${otp}. أعطه للسائق عند التسليم فقط.`,
    })
  }

  /**
   * Send delivery status notification
   */
  async sendDeliveryNotification(phone, status, driverName, eta) {
    const messages = {
      confirmed: `قطوف: تم تأكيد طلبك وجاري تجهيزه. سنعلمك عند الشحن.`,
      shipped: `قطوف: طلبك في الطريق! السائق: ${driverName}. وقت التسليم المتوقع: ${eta}`,
      arriving_soon: `قطوف: السائق ${driverName} على بعد 5 دقائق. استعد لاستلام طلبك.`,
      delivered: `قطوف: تم تسليم طلبك بنجاح. شكراً لتسوقك معنا! `,
      failed: `قطوف: تعذر تسليم طلبك. يرجى التواصل معنا للجدولة.`,
    }
    return this.sendSMS({
      to: phone,
      message: messages[status] || `قطوف: تحديث على طلبك - الحالة: ${status}`,
    })
  }

  /**
   * Send vendor notification
   */
  async sendVendorNotification(phone, message) {
    return this.sendSMS({
      to: phone,
      message: `قطوف للبائعين: ${message}. افتح التطبيق للتفاصيل.`,
    })
  }
}

export const smsService = new SMSService()
export default smsService
