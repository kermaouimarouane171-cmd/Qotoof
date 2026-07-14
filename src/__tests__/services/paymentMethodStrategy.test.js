import { getPayoutStrategy } from '@/modules/commissions'

describe('paymentMethodStrategy', () => {
  describe('getPayoutStrategy', () => {
    test('returns paypal strategy by default', () => {
      const strategy = getPayoutStrategy()
      expect(strategy).toBeDefined()
      expect(typeof strategy.validateRecipient).toBe('function')
    })

    test('returns paypal strategy when method is "paypal"', () => {
      const strategy = getPayoutStrategy('paypal')
      expect(strategy).toBeDefined()
      expect(typeof strategy.validateRecipient).toBe('function')
    })

    test('normalizes method to lowercase', () => {
      const strategy = getPayoutStrategy('PayPal')
      expect(strategy).toBeDefined()
      expect(typeof strategy.validateRecipient).toBe('function')
    })

    test('defaults to paypal when method is null', () => {
      const strategy = getPayoutStrategy(null)
      expect(strategy).toBeDefined()
      expect(typeof strategy.validateRecipient).toBe('function')
    })

    test('defaults to paypal when method is undefined', () => {
      const strategy = getPayoutStrategy(undefined)
      expect(strategy).toBeDefined()
      expect(typeof strategy.validateRecipient).toBe('function')
    })

    test('defaults to paypal when method is empty string', () => {
      const strategy = getPayoutStrategy('')
      expect(strategy).toBeDefined()
      expect(typeof strategy.validateRecipient).toBe('function')
    })

    test('throws for unsupported method', () => {
      expect(() => getPayoutStrategy('bank-transfer')).toThrow(
        'Unsupported payout method: bank-transfer'
      )
    })

    test('throws for unsupported method with correct normalized name in message', () => {
      expect(() => getPayoutStrategy('STRIPE')).toThrow(
        'Unsupported payout method: stripe'
      )
    })
  })

  describe('paypalPayoutStrategy.validateRecipient', () => {
    test('returns EMAIL recipient type for valid verified profile', async () => {
      const strategy = getPayoutStrategy('paypal')
      const result = await strategy.validateRecipient({
        profile: {
          paypal_email: 'vendor@example.com',
          paypal_verified: true,
        },
      })

      expect(result).toEqual({
        recipientType: 'EMAIL',
        recipientValue: 'vendor@example.com',
      })
    })

    test('trims whitespace from paypal_email', async () => {
      const strategy = getPayoutStrategy('paypal')
      const result = await strategy.validateRecipient({
        profile: {
          paypal_email: '  vendor@example.com  ',
          paypal_verified: true,
        },
      })

      expect(result.recipientValue).toBe('vendor@example.com')
    })

    test('throws PAYPAL_EMAIL_REQUIRED when paypal_email is missing', async () => {
      const strategy = getPayoutStrategy('paypal')
      await expect(
        strategy.validateRecipient({ profile: { paypal_verified: true } })
      ).rejects.toThrow('PAYPAL_EMAIL_REQUIRED')
    })

    test('throws PAYPAL_EMAIL_REQUIRED when paypal_email is empty string', async () => {
      const strategy = getPayoutStrategy('paypal')
      await expect(
        strategy.validateRecipient({
          profile: { paypal_email: '', paypal_verified: true },
        })
      ).rejects.toThrow('PAYPAL_EMAIL_REQUIRED')
    })

    test('throws PAYPAL_EMAIL_REQUIRED when paypal_email is not a string', async () => {
      const strategy = getPayoutStrategy('paypal')
      await expect(
        strategy.validateRecipient({
          profile: { paypal_email: 123, paypal_verified: true },
        })
      ).rejects.toThrow('PAYPAL_EMAIL_REQUIRED')
    })

    test('throws PAYPAL_VERIFICATION_REQUIRED when paypal_verified is false', async () => {
      const strategy = getPayoutStrategy('paypal')
      await expect(
        strategy.validateRecipient({
          profile: { paypal_email: 'vendor@example.com', paypal_verified: false },
        })
      ).rejects.toThrow('PAYPAL_VERIFICATION_REQUIRED')
    })

    test('throws PAYPAL_VERIFICATION_REQUIRED when paypal_verified is missing', async () => {
      const strategy = getPayoutStrategy('paypal')
      await expect(
        strategy.validateRecipient({
          profile: { paypal_email: 'vendor@example.com' },
        })
      ).rejects.toThrow('PAYPAL_VERIFICATION_REQUIRED')
    })

    test('throws when profile is null', async () => {
      const strategy = getPayoutStrategy('paypal')
      await expect(
        strategy.validateRecipient({ profile: null })
      ).rejects.toThrow('Recipient profile is required')
    })

    test('throws when profile is undefined', async () => {
      const strategy = getPayoutStrategy('paypal')
      await expect(
        strategy.validateRecipient({})
      ).rejects.toThrow('Recipient profile is required')
    })
  })
})
