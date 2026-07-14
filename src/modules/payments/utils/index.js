/**
 * Payments Module — Utils Layer (re-export)
 *
 * Re-exports payment-related utility functions.
 * No utility logic changes.
 */

// ── PayPal eligibility utilities ─────────────────────────────────────────
export {
  PAYPAL_REQUIRED_ROLES,
  hasValidPayPalEmail,
  isPayPalSetupComplete,
  getPayPalSetupRoute,
  getPayPalSetupBlockMessage,
  assertPayPalSetupOrThrow,
} from '@/utils/paypalEligibility'
