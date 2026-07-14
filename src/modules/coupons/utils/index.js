/**
 * Coupons Module — Utils Layer (re-export)
 *
 * Re-exports coupon-related utility/helper functions.
 * No utility logic changes.
 */

// ── Coupon formatting and calculation helpers ─────────────────────────────
export {
  normalizeCoupon,
  isCouponCurrentlyActive,
  calculateCouponDiscountAmount,
  calculateBulkDiscountBreakdown,
} from '../api/coupons'
