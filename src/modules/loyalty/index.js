/**
 * Loyalty Module — Public API Entry Point (Phase 6.5)
 *
 * This module exposes existing loyalty functionality through a clean public API.
 * It is a re-export/wrapper layer only — no business logic changes.
 *
 * Public API:
 *   import { loyaltyApi, LOYALTY_TIERS, REFERRAL_REWARD_POINTS,
 *     calculateLoyaltyPointsForOrder, calculateRewardDiscountAmount,
 *     addLoyaltyPoints, generateReferralCode, processReferral
 *   } from '@/modules/loyalty'
 *
 * The loyalty module owns:
 *   - loyalty points (balance, award, deduct)
 *   - loyalty tiers (Bronze/Silver/Gold/Platinum progression)
 *   - loyalty transactions (history, sync)
 *   - loyalty rewards (catalog, redemption)
 *   - referrals (dashboard, attachment, bonus sync, code generation)
 *   - reward redemption orchestration (creates coupons as side effect)
 *
 * The loyalty module does NOT own:
 *   - coupon CRUD or validation (owned by coupons module)
 *   - order lifecycle (owned by orders module)
 *   - notification delivery (owned by notifications module)
 *   - user profile ownership (owned by users module)
 *   - cart state or checkout flow
 *
 * Allowed dependencies:
 *   - shared, auth (public API only), users (public API only),
 *     utils, config, lib/supabase
 *
 * Forbidden dependencies:
 *   - cart internals, checkout internals, payments internals,
 *     delivery internals, admin dashboard composition
 */

// ── API ──────────────────────────────────────────────────────────────────
export {
  loyaltyApi,
  default,
  LOYALTY_TIERS,
  REFERRAL_REWARD_POINTS,
  calculateLoyaltyPointsForOrder,
  calculateRewardDiscountAmount,
  addLoyaltyPoints,
  generateReferralCode,
  processReferral,
} from './api'
