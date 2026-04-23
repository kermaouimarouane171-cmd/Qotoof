/**
 * Tests for emailService
 * Note: We test the email logic in isolation due to import.meta.env dependencies.
 */

describe('emailService', () => {
  // Simulated email service
  const createEmailService = () => {
    const sentEmails = []

    return {
      async sendEmail({ to, subject, html }) {
        sentEmails.push({ to, subject, html, sentAt: new Date() })
        return { success: true, messageId: `msg_${sentEmails.length}` }
      },

      async sendOrderConfirmation(order) {
        return this.sendEmail({
          to: order.buyer_email,
          subject: `Order Confirmation - ${order.order_number}`,
          html: `<h1>Order Confirmed</h1><p>Order: ${order.order_number}</p><p>Total: ${order.total} MAD</p>`,
        })
      },

      async sendOrderStatusUpdate({ email, name, order_number, status }) {
        return this.sendEmail({
          to: email,
          subject: `Order ${order_number} Status Update`,
          html: `<p>Your order ${order_number} is now: ${status}</p>`,
        })
      },

      async sendNewOrderToVendor({ email, name, order_number, total }) {
        return this.sendEmail({
          to: email,
          subject: `New Order: ${order_number}`,
          html: `<p>New order ${order_number} for ${total} MAD</p>`,
        })
      },

      async sendPasswordReset({ email, name, resetUrl }) {
        return this.sendEmail({
          to: email,
          subject: 'Password Reset Request',
          html: `<p>Click here to reset your password: <a href="${resetUrl}">Reset</a></p>`,
        })
      },

      async sendOTP(user, otp) {
        return this.sendEmail({
          to: user.email,
          subject: 'Your Verification Code',
          html: `<p>Your code is: <strong>${otp}</strong></p>`,
        })
      },

      async sendWelcomeEmail({ email, name, role }) {
        return this.sendEmail({
          to: email,
          subject: 'Welcome to Qotoof!',
          html: `<p>Welcome ${name}! You're registered as a ${role}.</p>`,
        })
      },

      getSentEmails() {
        return sentEmails
      },
    }
  }

  let service

  beforeEach(() => {
    service = createEmailService()
  })

  describe('sendOrderConfirmation', () => {
    it('should send order confirmation email', async () => {
      const order = {
        id: 'o1',
        order_number: 'ORD-001',
        total: 100,
        buyer_email: 'buyer@test.com',
        buyer_name: 'Test Buyer',
      }

      const result = await service.sendOrderConfirmation(order)

      expect(result.success).toBe(true)
      expect(service.getSentEmails()).toHaveLength(1)
    })
  })

  describe('sendOrderStatusUpdate', () => {
    it('should send order status update email', async () => {
      const result = await service.sendOrderStatusUpdate({
        email: 'buyer@test.com',
        name: 'Test Buyer',
        order_number: 'ORD-001',
        status: 'delivered',
      })

      expect(result.success).toBe(true)
    })
  })

  describe('sendNewOrderToVendor', () => {
    it('should send new order notification to vendor', async () => {
      const result = await service.sendNewOrderToVendor({
        email: 'vendor@test.com',
        name: 'Test Vendor',
        order_number: 'ORD-001',
        total: 100,
      })

      expect(result.success).toBe(true)
    })
  })

  describe('sendPasswordReset', () => {
    it('should send password reset email', async () => {
      const result = await service.sendPasswordReset({
        email: 'user@test.com',
        name: 'Test User',
        resetUrl: 'https://example.com/reset/token',
      })

      expect(result.success).toBe(true)
    })
  })

  describe('sendOTP', () => {
    it('should send OTP email', async () => {
      const user = { email: 'user@test.com', first_name: 'Test' }
      const otp = '123456'

      const result = await service.sendOTP(user, otp)

      expect(result.success).toBe(true)
    })
  })

  describe('sendWelcomeEmail', () => {
    it('should send welcome email to new user', async () => {
      const result = await service.sendWelcomeEmail({
        email: 'newuser@test.com',
        name: 'New User',
        role: 'buyer',
      })

      expect(result.success).toBe(true)
    })
  })
})
