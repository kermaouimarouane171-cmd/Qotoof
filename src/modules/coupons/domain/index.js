/**
 * Coupons Module — Domain Layer (re-export)
 *
 * Re-exports coupon-related domain logic, normalization, validation,
 * and discount calculation helpers.
 * No business logic changes.
 */

// ── Coupon normalization and validation helpers ───────────────────────────
export {
  normalizeCoupon,
  isCouponCurrentlyActive,
  calculateCouponDiscountAmount,
  calculateBulkDiscountBreakdown,
} from '../api/coupons'
