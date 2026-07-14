/**
 * Coupons Module — Public API Entry Point (Phase 4.1)
 *
 * This module exposes existing coupon functionality through a clean public API.
 * It is a re-export/wrapper layer only — no business logic changes.
 *
 * Public API:
 *   import { couponsApi, normalizeCoupon, calculateCouponDiscountAmount } from '@/modules/coupons'
 *
 * The coupons module owns:
 *   - coupon records (CRUD via couponsApi)
 *   - coupon validation (validateCoupon)
 *   - coupon normalization (normalizeCoupon)
 *   - coupon active/expired checks (isCouponCurrentlyActive)
 *   - coupon discount calculation (calculateCouponDiscountAmount)
 *   - bulk discount calculation (calculateBulkDiscountBreakdown)
 *   - coupon redemption tracking (redeemCoupon, getUserRedemptions)
 *   - coupon realtime subscriptions (subscribeToVendorCouponRedemptions)
 *
 * The coupons module does NOT own:
 *   - checkout page composition
 *   - cart state
 *   - order lifecycle
 *   - payment provider logic
 *   - delivery logic
 *   - product catalog ownership
 *
 * Allowed dependencies:
 *   - shared, auth (public API only), users (public API only),
 *     utils, config, lib/supabase
 *
 * Forbidden dependencies:
 *   - cart internals, payments internals, delivery internals,
 *     orders internals, admin dashboard composition
 */

// ── API ──────────────────────────────────────────────────────────────────
export {
  couponsApi,
  subscribeToVendorCouponRedemptions,
  couponsApiDefault,
} from './api'

// ── Domain ───────────────────────────────────────────────────────────────
export {
  normalizeCoupon,
  isCouponCurrentlyActive,
  calculateCouponDiscountAmount,
  calculateBulkDiscountBreakdown,
} from './domain'

// ── Utils ────────────────────────────────────────────────────────────────
export {
  normalizeCoupon as utilsNormalizeCoupon,
  isCouponCurrentlyActive as utilsIsCouponCurrentlyActive,
  calculateCouponDiscountAmount as utilsCalculateCouponDiscountAmount,
  calculateBulkDiscountBreakdown as utilsCalculateBulkDiscountBreakdown,
} from './utils'
