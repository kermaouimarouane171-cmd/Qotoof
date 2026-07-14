export const PAYPAL_REQUIRED_ROLES = new Set(['vendor', 'driver'])

export const hasValidPayPalEmail = (value) => {
  if (typeof value !== 'string') return false
  const normalized = value.trim()
  if (!normalized) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
}

export const isPayPalSetupComplete = (profile) => {
  if (!profile || !PAYPAL_REQUIRED_ROLES.has(profile.role)) {
    return true
  }

  // If the vendor/driver chose bank transfer, no PayPal setup required.
  // Bank details are collected on the settings page but are NOT a hard gate —
  // the user can work and fill them later before requesting a payout.
  if (profile.payout_method === 'bank') {
    return true
  }

  // If the vendor/driver chose Stripe, PayPal setup is not required.
  if (profile.payout_method === 'stripe') {
    return true
  }

  // payout_method is 'paypal' (the DB default). This does NOT mean the user
  // actively chose PayPal — it's just the column default. Only block if the
  // user has STARTED setting up PayPal (paypal_email is set but invalid).
  // If paypal_email is null/empty, the user hasn't configured any payout
  // method yet — don't trap them on the settings page.
  if (!profile.paypal_email) {
    return true
  }

  // The user has provided a paypal_email — validate it.
  // NOTE: paypal_verified is not enforced for sandbox beta — the verification
  // flow does not exist yet. Email validity is sufficient to proceed.
  return hasValidPayPalEmail(profile.paypal_email)
}

export const getPayPalSetupRoute = (role) => {
  if (role === 'vendor') return '/vendor/settings'
  if (role === 'driver') return '/driver/settings'
  return '/profile'
}

export const getPayPalSetupBlockMessage = () => (
  'يجب إكمال إعداد بيانات الدفع (الحساب البنكي) قبل البدء في البيع/التوصيل.'
)

export const assertPayPalSetupOrThrow = (profile, fallbackMessage = null) => {
  if (isPayPalSetupComplete(profile)) return

  const error = new Error(fallbackMessage || getPayPalSetupBlockMessage())
  error.code = 'PAYPAL_SETUP_REQUIRED'
  throw error
}
