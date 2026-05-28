const paypalPayoutStrategy = {
  async validateRecipient({ profile }) {
    if (!profile) throw new Error('Recipient profile is required')

    const email = typeof profile.paypal_email === 'string' ? profile.paypal_email.trim() : ''
    if (!email) {
      throw new Error('PAYPAL_EMAIL_REQUIRED')
    }

    if (profile.paypal_verified !== true) {
      throw new Error('PAYPAL_VERIFICATION_REQUIRED')
    }

    return {
      recipientType: 'EMAIL',
      recipientValue: email,
    }
  },
}

const STRATEGIES = {
  paypal: paypalPayoutStrategy,
}

export const getPayoutStrategy = (method = 'paypal') => {
  const normalizedMethod = String(method || 'paypal').toLowerCase()
  const strategy = STRATEGIES[normalizedMethod]

  if (!strategy) {
    throw new Error(`Unsupported payout method: ${normalizedMethod}`)
  }

  return strategy
}
