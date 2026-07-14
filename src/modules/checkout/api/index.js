/**
 * Checkout Module — API Layer (re-export)
 *
 * Re-exports checkout-related service functions.
 * No business logic changes. No Supabase query changes.
 * All exports are additive re-exports from existing source files.
 */

// Checkout service — order creation, pricing calculation, payload building
export {
  calculateOrderTotals,
  calculateCheckoutPricing,
  createCheckoutOrder,
} from './checkoutService'

// Coupon API used during checkout (applying coupons, bulk discounts)
export {
  couponsApi,
  normalizeCoupon,
  isCouponCurrentlyActive,
  calculateCouponDiscountAmount,
  calculateBulkDiscountBreakdown,
} from '@/modules/coupons'

// Minimum order validation used during checkout
export {
  buildMinimumOrderMessage,
  evaluateVendorMinimumOrders,
} from '@/modules/cart'
