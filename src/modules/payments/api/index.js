/**
 * Payments Module — API Layer (re-export)
 *
 * Re-exports payment-related service functions.
 * No business logic changes. No Supabase query changes.
 * All exports are additive re-exports from existing source files.
 */

// ── paymentService — functional API wrapper ──────────────────────────────
export {
  createPaymentIntent,
  processPayPalPayment,
  processStripePayment,
  processCMIPayment,
  confirmBankTransfer,
  createOrderPaymentRecord,
  getLatestOrderPaymentRecord,
  updateOrderPaymentRecord,
  registerPaymentReceipt,
  confirmOrderPayment,
  getPaymentStatus,
  refundPayment,
} from './paymentService'

// ── paymentGateway — class-based gateway singleton ───────────────────────
export {
  paymentGateway,
  createPaymentIntent as createGatewayPaymentIntent,
  confirmPayment,
  getPaymentById,
  usePayment,
} from './paymentGateway'

// ── paymentRecords — payment record CRUD and normalization ───────────────
export {
  PAYMENT_METHOD_COLUMN,
  LEGACY_PAYMENT_METHOD_COLUMN,
  normalizePaymentMethod,
  getPaymentMethodCandidates,
  resolvePaymentMethod,
  decoratePaymentRecord,
  buildPaymentWritePayload,
  applyPaymentMethodFilter,
  insertPaymentRecord,
  getLatestPaymentRecordForOrder,
  getPaymentRecordById,
  updatePaymentRecordById,
} from './paymentRecords'

// ── cmiPayment — legacy/deprecated CMI compatibility surface ─────────────
// CMI is retired for marketplace checkout. These exports exist only for
// reading legacy payment records and are documented as deprecated.
export {
  initCMIPayment,
  verifyCMICallback,
  getCMIStatus,
} from './cmiPayment'

// ── refundPolicyService — vendor refund policy management ────────────────
export {
  DEFAULT_REFUND_POLICY,
  refundPolicyService,
  default as refundPolicyServiceDefault,
} from './refundPolicyService'
