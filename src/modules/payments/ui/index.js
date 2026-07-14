/**
 * Payments Module — UI Layer (re-export)
 *
 * Re-exports payment-related UI components and guards.
 * No UI changes. No component logic changes.
 * All components remain in their original locations.
 *
 * Note: PaymentStep.jsx and PaymentTypeSelector.jsx are checkout step
 * components and are exported from the checkout module, not here.
 */

// ── Payment Guard ────────────────────────────────────────────────────────
export { usePaymentGuard } from '@/contexts/PaymentGuard'

// ── Order payment components ─────────────────────────────────────────────
export { default as OrderPaymentSection } from '@/components/orders/OrderPaymentSection'
export { default as PaymentReceiptUpload } from '@/components/orders/PaymentReceiptUpload'

// ── Vendor payment policy settings ───────────────────────────────────────
export { default as PaymentPolicySettings } from '@/components/vendor/PaymentPolicySettings'
export { default as RefundPolicySettings } from '@/components/vendor/RefundPolicySettings'

// ── Driver delivery payment policy ───────────────────────────────────────
export { default as DeliveryPaymentPolicy } from '@/components/driver/DeliveryPaymentPolicy'
