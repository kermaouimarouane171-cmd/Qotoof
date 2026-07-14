/**
 * Checkout Module — Domain Layer (re-export)
 *
 * Re-exports checkout-related domain logic and constants.
 * No business logic changes.
 */

// Checkout cleanup / rollback utility (used when order creation fails)
export { rollbackCheckoutRecords } from '../utils/checkoutCleanup'
