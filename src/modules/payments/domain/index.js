/**
 * Payments Module — Domain Layer (re-export)
 *
 * Re-exports payment-related domain logic, constants, and helpers.
 * No business logic changes.
 */

// ── Payment constants ────────────────────────────────────────────────────
export {
  PAYMENT_METHOD,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  PAYMENT_STATUS_BADGE,
  PAYMENT_STATUS_HEX,
  PAYMENT_STATUS_LABEL_AR,
  getAvailablePaymentMethods,
  getPaymentMethodById,
  getPaymentStatusBadge,
  getPaymentStatusColor,
} from '@/constants/payment'

// ── PayPal eligibility helpers ───────────────────────────────────────────
export {
  PAYPAL_REQUIRED_ROLES,
  hasValidPayPalEmail,
  isPayPalSetupComplete,
  getPayPalSetupRoute,
  getPayPalSetupBlockMessage,
  assertPayPalSetupOrThrow,
} from '@/utils/paypalEligibility'

// ── Existing domains/payments re-exports (commands + queries) ────────────
export {
  confirmOrderPayment as domainConfirmOrderPayment,
  registerPaymentReceipt as domainRegisterPaymentReceipt,
  confirmBankTransfer as domainConfirmBankTransfer,
  getPaymentStatus as domainGetPaymentStatus,
  getLatestOrderPaymentRecord as domainGetLatestOrderPaymentRecord,
} from '@/domains/payments'
