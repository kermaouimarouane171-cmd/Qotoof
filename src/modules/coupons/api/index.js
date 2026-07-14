/**
 * Coupons Module — API Layer (re-export)
 *
 * Re-exports coupon-related service functions.
 * No business logic changes. No Supabase query changes.
 * All exports are additive re-exports from existing source files.
 */

// ── coupons.js — core coupon service (moved to module-local path) ──────────
export {
  couponsApi,
  subscribeToVendorCouponRedemptions,
} from './coupons'

export { default as couponsApiDefault } from './coupons'
