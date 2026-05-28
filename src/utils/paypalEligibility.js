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

  return hasValidPayPalEmail(profile.paypal_email) && profile.paypal_verified === true
}

export const getPayPalSetupRoute = (role) => {
  if (role === 'vendor') return '/vendor/settings'
  if (role === 'driver') return '/driver/settings'
  return '/profile'
}

export const getPayPalSetupBlockMessage = () => (
  'يجب إضافة بريد PayPal الإلكتروني وتأكيده قبل البدء في البيع/التوصيل.'
)

export const assertPayPalSetupOrThrow = (profile, fallbackMessage = null) => {
  if (isPayPalSetupComplete(profile)) return

  const error = new Error(fallbackMessage || getPayPalSetupBlockMessage())
  error.code = 'PAYPAL_SETUP_REQUIRED'
  throw error
}
