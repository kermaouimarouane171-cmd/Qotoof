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

const bankPayoutStrategy = {
  async validateRecipient({ profile }) {
    if (!profile) throw new Error('Recipient profile is required')

    const accountName = typeof profile.bank_account_name === 'string' ? profile.bank_account_name.trim() : ''
    const iban = typeof profile.bank_account_iban === 'string' ? profile.bank_account_iban.replace(/\s/g, '') : ''
    const bankName = typeof profile.bank_name === 'string' ? profile.bank_name.trim() : ''

    if (!accountName) {
      throw new Error('BANK_ACCOUNT_NAME_REQUIRED')
    }

    if (!iban || iban.length < 24) {
      throw new Error('BANK_IBAN_REQUIRED')
    }

    if (!bankName) {
      throw new Error('BANK_NAME_REQUIRED')
    }

    return {
      recipientType: 'BANK',
      recipientValue: iban,
      bankName,
      accountName,
    }
  },
}

const STRATEGIES = {
  paypal: paypalPayoutStrategy,
  bank: bankPayoutStrategy,
}

export const getPayoutStrategy = (method = 'paypal') => {
  const normalizedMethod = String(method || 'paypal').toLowerCase()
  const strategy = STRATEGIES[normalizedMethod]

  if (!strategy) {
    throw new Error(`Unsupported payout method: ${normalizedMethod}`)
  }

  return strategy
}
