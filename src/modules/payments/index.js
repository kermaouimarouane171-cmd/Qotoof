/**
 * Payments Module — Public API Entry Point (Phase 3.2)
 *
 * This module exposes existing payment functionality through a clean public API.
 * It is a re-export/wrapper layer only — no business logic changes.
 *
 * Public API:
 *   import { paymentService, createPayPalOrder, PAYMENT_METHOD, ... } from '@/modules/payments'
 *
 * Phase 6.21 — Barrel Safety:
 * UI exports (usePaymentGuard, OrderPaymentSection, PaymentReceiptUpload,
 * PaymentPolicySettings, RefundPolicySettings, DeliveryPaymentPolicy) removed
 * from root barrel. UI exports remain available via `src/modules/payments/ui/index.js`.
 * App code imports usePaymentGuard from @/contexts/PaymentGuard, payment components
 * from @/components/orders/..., @/components/vendor/..., @/components/driver/... directly.
 *
 * Active payment methods: PayPal, Bank Transfer, COD (Cash on Delivery)
 * Legacy/deprecated: CMI (retired, kept for reading historical records only)
 *
 * Allowed dependencies:
 *   - shared, auth (public API), users (public API),
 *     orders (public API only for safe order references),
 *     checkout (public API only if absolutely necessary),
 *     utils, config, lib/supabase
 *
 * Forbidden dependencies:
 *   - cart internals, delivery internals, admin dashboard composition
 */

// ── API ──────────────────────────────────────────────────────────────────
export {
  // paymentService — functional API
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
  // paymentGateway — singleton
  paymentGateway,
  confirmPayment,
  getPaymentById,
  usePayment,
  createGatewayPaymentIntent,
  // paymentRecords — CRUD
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
  // cmiPayment — legacy/deprecated
  initCMIPayment,
  verifyCMICallback,
  getCMIStatus,
  // refundPolicyService
  DEFAULT_REFUND_POLICY,
  refundPolicyService,
} from './api'

export { refundPolicyServiceDefault } from './api'

// ── Domain ───────────────────────────────────────────────────────────────
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
  PAYPAL_REQUIRED_ROLES,
  hasValidPayPalEmail,
  isPayPalSetupComplete,
  getPayPalSetupRoute,
  getPayPalSetupBlockMessage,
  assertPayPalSetupOrThrow,
} from './domain'

// ── Hooks ────────────────────────────────────────────────────────────────
export {
  paymentKeys,
  usePaymentHistory,
  usePaymentDetail,
  useCreatePayment,
  useConfirmPayment,
} from './hooks'

// ── Utils ────────────────────────────────────────────────────────────────
export {
  hasValidPayPalEmail as utilsHasValidPayPalEmail,
  isPayPalSetupComplete as utilsIsPayPalSetupComplete,
  assertPayPalSetupOrThrow as utilsAssertPayPalSetupOrThrow,
} from './utils'
