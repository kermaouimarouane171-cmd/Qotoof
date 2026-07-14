/**
 * Checkout Module — UI Layer (re-export)
 *
 * Re-exports checkout-related UI components.
 * No UI changes. No component logic changes.
 * All components remain in their original locations.
 */

// Checkout page (1696 lines — migration candidate, too large/risky to move now)
export { default as CheckoutPage } from '@/pages/CheckoutSimplified'

// Checkout step components
export { default as CheckoutAddressStep } from '@/components/checkout/CheckoutAddressStep'
export { default as CheckoutSummary } from '@/components/checkout/CheckoutSummary'
export { default as PaymentStep } from '@/components/checkout/PaymentStep'
export { default as PaymentTypeSelector } from '@/components/checkout/PaymentTypeSelector'
export { default as OrderSummary } from '@/components/checkout/OrderSummary'
export { default as AddressStep } from '@/components/checkout/AddressStep'
export { default as DriverSelectionStep } from '@/components/checkout/DriverSelectionStep'
