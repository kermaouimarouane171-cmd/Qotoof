/**
 * Loyalty Module — API Layer (re-export)
 *
 * Re-exports loyalty-related service functions.
 * No business logic changes. No Supabase query changes.
 * All exports are additive re-exports from existing source files.
 */

// ── loyalty.js — core loyalty service (source: src/modules/loyalty/api/loyalty.js) ───
export {
  loyaltyApi,
  LOYALTY_TIERS,
  REFERRAL_REWARD_POINTS,
  calculateLoyaltyPointsForOrder,
  calculateRewardDiscountAmount,
  addLoyaltyPoints,
  generateReferralCode,
  processReferral,
} from './loyalty'

export { default } from './loyalty'
