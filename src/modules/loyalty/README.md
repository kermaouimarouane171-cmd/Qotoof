# Loyalty Module

**Phase:** 6.5 — Loyalty Module Foundation (re-export layer)
**Status:** Wrapper/re-export foundation only. No files moved. No behavior changed.

---

## Purpose

The loyalty module encapsulates all loyalty program functionality:
- Loyalty points management (balance, award, deduct)
- Loyalty tier progression (Bronze → Silver → Gold → Platinum)
- Loyalty transaction history
- Loyalty rewards catalog and redemption
- Referral system (codes, tracking, bonus sync)
- Loyalty dashboard aggregation (stats, history, rewards, referrals)
- Order benefits sync (awarding points for delivered orders)

## Why Loyalty Is Its Own Domain

Loyalty is a **distinct business domain** from coupons. While loyalty and coupons are related (loyalty reward redemption creates coupons as a side effect), they serve different purposes:

| Aspect | Coupons | Loyalty |
|---|---|---|
| **Core concept** | Discount codes for price reduction | Points-based rewards program |
| **User interaction** | Enter code at checkout → get discount | Earn points from orders → redeem for rewards |
| **Supabase tables** | `coupons`, `coupon_redemptions` | `loyalty_points`, `loyalty_transactions`, `loyalty_rewards`, `referrals` |
| **Lifecycle** | Create → validate → redeem → track | Earn → accumulate → tier upgrade → redeem reward |
| **Who benefits** | Any eligible buyer | Buyer with loyalty membership |

**Coupons does not own loyalty.** Coupons may be consumed by loyalty as a reward output (loyalty creates personal coupons when a buyer redeems a reward), but that is a cross-module dependency (loyalty → coupons), not ownership.

## Current Status: Re-export Foundation Only

This module is currently a **re-export layer**. No source files have been moved.
The re-exports point to existing files in `src/services/`.

**Source file:** `src/services/loyalty.js` (861 lines)

## Public API

```js
import {
  // API — Service object
  loyaltyApi,
  // API — Default export (same as loyaltyApi)
  default,
  // Constants
  LOYALTY_TIERS,
  REFERRAL_REWARD_POINTS,
  // Domain helpers
  calculateLoyaltyPointsForOrder,
  calculateRewardDiscountAmount,
  // Convenience functions
  addLoyaltyPoints,
  generateReferralCode,
  processReferral,
} from '@/modules/loyalty'
```

### `loyaltyApi` Methods

**Points operations:**
- `getPointsBalance(userId)` — get or create user's loyalty points balance
- `awardPoints(userId, points, reason, orderId?, metadata?)` — award points and update balance/tier
- `deductPoints(userId, points, reason, metadata?)` — deduct points (e.g., for reward redemption)

**Tier operations:**
- `getTier(points)` — get tier object for a given points total
- `checkTierUpgrade(userId, points)` — update user's tier in database
- `getTierProgress(points)` — get progress to next tier (current, next, progress %, points needed)

**History & analytics:**
- `getTransactionHistory(userId, limit?)` — get loyalty transaction history with order joins
- `getLoyaltyStats(userId)` — get dashboard stats (points, lifetime, tier, progress, referral bonus)

**Rewards:**
- `getAvailableRewards()` — get active loyalty rewards catalog
- `redeemReward(userId, rewardId)` — redeem a reward into a personal one-time coupon

**Referrals:**
- `getReferralDashboard(userId)` — get referral data (profile, referrals list, summary)
- `attachReferralCode({ userId, referralCode })` — attach a referral code to a new user
- `syncDeliveredOrderBenefits(userId)` — sync loyalty points for delivered orders + complete referral on first order
- `syncReferralBonuses(userId)` — credit pending referral bonuses

**Dashboard:**
- `getLoyaltyDashboard(userId)` — complete dashboard payload (syncs pending benefits, then fetches stats/history/rewards/referrals)

### Standalone Functions

- `addLoyaltyPoints(userId, event, points)` — convenience wrapper for `loyaltyApi.awardPoints`
- `generateReferralCode(userId)` — generate or retrieve user's referral code
- `processReferral(referralCode, newUserId)` — convenience wrapper for `loyaltyApi.attachReferralCode`

### Constants

- `LOYALTY_TIERS` — array of tier definitions: `{ name, minPoints, color, icon, multiplier }`
  - Bronze: 0+ points, 1.0× multiplier
  - Silver: 500+ points, 1.2× multiplier
  - Gold: 2000+ points, 1.5× multiplier
  - Platinum: 5000+ points, 2.0× multiplier
- `REFERRAL_REWARD_POINTS` — 100 points awarded per completed referral

### Domain Helpers

- `calculateLoyaltyPointsForOrder({ orderTotal, tierName })` — calculate points for an order based on tier multiplier
- `calculateRewardDiscountAmount({ reward, subtotal })` — calculate discount amount from a loyalty reward (capped at subtotal)

---

## What Belongs in Loyalty

- Loyalty points balance management (read, award, deduct)
- Loyalty tier definitions and progression logic
- Loyalty transaction history and recording
- Loyalty rewards catalog and redemption orchestration
- Referral code generation and management
- Referral relationship tracking and bonus crediting
- Order benefits sync (awarding points for delivered orders)
- Loyalty dashboard aggregation
- Loyalty notification creation (best-effort, via direct Supabase insert)

## What Does NOT Belong in Loyalty

- **Coupon CRUD and validation** — owned by `coupons` module. Loyalty creates coupons as a side effect of reward redemption, but does not own coupon lifecycle.
- **Order lifecycle** — owned by `orders` module. Loyalty reads delivered orders to award points but does not own order status transitions.
- **Notification delivery** — owned by `notifications` module. Loyalty inserts notifications directly (best-effort) but does not own notification infrastructure.
- **User profile ownership** — owned by `users` module. Loyalty reads/writes `profiles.referral_code` and `profiles.referred_by` but does not own profile data.
- **Cart state** — owned by `cart` module.
- **Checkout flow** — owned by `checkout` module.
- **Payment processing** — owned by `payments` module.
- **Auth/session logic** — owned by `auth` module.

---

## Relationship with Coupons

- Loyalty **consumes** the coupons data model when redeeming rewards.
- `loyaltyApi.redeemReward()` creates a personal one-time coupon in the `coupons` table.
- This is a **cross-module dependency** (loyalty → coupons), not ownership.
- Loyalty does **not** import from `@/modules/coupons` — it writes directly to the `coupons` table via Supabase.
- **Future improvement:** Loyalty should call `couponsApi.createCoupon()` instead of direct Supabase insert, but this is out of scope for Phase 6.5.

## Relationship with Orders

- Loyalty **reads** delivered orders to award loyalty points.
- `loyaltyApi.syncDeliveredOrderBenefits()` queries `orders` table for delivered orders and awards points.
- Loyalty does **not** own order lifecycle or status transitions.
- Loyalty does **not** import from `@/modules/orders`.

## Relationship with Users

- Loyalty reads/writes `profiles.referral_code` and `profiles.referred_by`.
- Loyalty reads `profiles` for referral dashboard data.
- Loyalty does **not** own profile data — that is the `users` module's responsibility.

## Relationship with Notifications

- Loyalty inserts notifications directly into the `notifications` table (best-effort, via `insertNotification` helper).
- This is a tight coupling that should be decoupled in the future.
- Loyalty should call `notificationsApi.create()` instead of direct Supabase insert in a future phase.

## Relationship with Auth

- Loyalty reads `user.id` from `useAuthStore` to know which user's loyalty data to fetch.
- `authSessionStore.js` dynamically imports `loyaltyApi.attachReferralCode` to process referral codes during registration.
- Loyalty does **not** own auth session logic.

---

## Module Structure

```
src/modules/loyalty/
├── index.js          # Public API entry point
├── api/
│   └── index.js      # Re-exports loyaltyApi, constants, helpers from src/services/loyalty.js
├── domain/
│   └── index.js      # Placeholder (tier/points logic currently in loyalty.js)
├── hooks/
│   └── index.js      # Placeholder (no dedicated loyalty hooks yet)
├── ui/
│   └── index.js      # Placeholder (Loyalty.jsx page not re-exported yet)
├── stores/
│   └── index.js      # Placeholder (no dedicated loyalty store)
├── utils/
│   └── index.js      # Placeholder (referral link, notification helper in loyalty.js)
└── README.md         # This file
```

---

## Supabase Tables

| Table | Purpose | Access Pattern |
|---|---|---|
| `loyalty_points` | User's points balance, tier, lifetime points | CRUD via `loyaltyApi.getPointsBalance`, `writePointsBalance` |
| `loyalty_transactions` | Transaction history (awards, deductions, referrals) | Insert via `insertLoyaltyTransaction`, read via `getTransactionHistory` |
| `loyalty_rewards` | Available rewards catalog | Read via `getAvailableRewards`, read in `redeemReward` |
| `referrals` | Referral relationships between users | CRUD via `attachReferralCode`, `syncReferralBonuses`, `getReferralDashboard` |
| `profiles` | User profile (referral code, referred_by) | Read/write referral fields |
| `orders` | Delivered orders for points sync | Read via `syncDeliveredOrderBenefits` |
| `notifications` | Best-effort notification inserts | Insert via `insertNotification` |
| `coupons` | Personal coupons created by reward redemption | Insert via `redeemReward` |

**No Supabase queries, database schema, or RLS policies are modified in this phase.**

---

## Old Compatibility Path (Deleted Phase 6.33)

The compatibility stub `src/services/loyalty.js` was deleted in Phase 6.33 after confirming zero active consumers. All imports should use `@/modules/loyalty` directly.

**Phase 6.6 Import Adoption:** App imports were migrated from `@/services/loyalty` to `@/modules/loyalty`. The old stub was deleted in Phase 6.33.

---

## Allowed Dependencies

- `@/modules/shared` — shared UI components, hooks, utilities
- `@/modules/auth` — auth public API (for current user identity)
- `@/modules/users` — users public API (for profile data if needed)
- `@/modules/coupons` — coupons public API (future: for reward redemption via couponsApi)
- `@/services/supabase` — Supabase client
- `@/utils/` — general utilities (`withRetry`, `logger`)
- `@/config` / `@/lib/config` — configuration

## Forbidden Dependencies

- `@/modules/checkout` — checkout internals
- `@/modules/payments` — payments internals
- `@/modules/delivery` — delivery internals
- `@/modules/orders` — orders internals (loyalty reads orders table directly, not via orders module)
- `@/modules/cart` — cart internals
- `@/modules/admin` — admin dashboard composition

---

## Future Migration Plan

| Step | Phase | Description |
|---|---|---|
| 1. Foundation | ✅ Phase 6.5 | Create re-export layer (this phase) |
| 2. Import adoption | Phase 6.6+ | Update app imports from `@/services/loyalty` to `@/modules/loyalty` |
| 3. File movement | Phase 6.7+ | Move `src/services/loyalty.js` to `src/modules/loyalty/api/loyalty.js` |
| 4. Domain extraction | Future | Extract tier definitions and points calculation to `domain/` |
| 5. Hooks creation | Future | Create `useLoyaltyDashboard`, `useReferralDashboard` hooks |
| 6. UI extraction | Future | Move `src/pages/buyer/Loyalty.jsx` to `src/modules/loyalty/ui/` |
| 7. Decouple notifications | Future | Replace `insertNotification` with `notificationsApi.create()` |
| 8. Decouple coupon creation | Future | Replace direct `coupons` table insert with `couponsApi.createCoupon()` |

---

## Migration Candidates for Future Sprints

| File | Current Location | Target | Risk | Notes |
|---|---|---|---|---|
| `loyalty.js` | `src/services/` | `src/modules/loyalty/api/` | Medium | 861 lines, 8 Supabase tables, complex referral sync — move after import adoption |
| `buyer/Loyalty.jsx` | `src/pages/buyer/` | `src/modules/loyalty/ui/` | Medium | Page component, imports loyaltyApi directly |
| Loyalty hooks | Does not exist yet | `src/modules/loyalty/hooks/` | Low | Create new: useLoyaltyDashboard, useReferralDashboard |

---

## Safety Notes

### Points Calculation

- `calculateLoyaltyPointsForOrder` uses `LOYALTY_POINT_RATE` (0.1) and tier multipliers.
- Any change to this formula could affect buyer rewards and tier progression.
- **Do not modify points calculation without thorough testing.**

### Referral System

- `syncDeliveredOrderBenefits` processes delivered orders and awards points.
- `syncReferralBonuses` credits referral bonuses when referrals complete their first order.
- These are complex sync operations with idempotency checks (processed order IDs, credited referral IDs).
- **Do not modify sync logic without understanding the idempotency guards.**

### Reward Redemption

- `redeemReward` creates a personal one-time coupon in the `coupons` table.
- It deducts points from the user's balance.
- It sends a notification to the user.
- **Do not modify reward redemption flow without testing coupon creation and points deduction.**

### Tier Progression

- Tiers are based on cumulative points (Bronze: 0+, Silver: 500+, Gold: 2000+, Platinum: 5000+).
- Tier is updated automatically when points are awarded.
- **Do not change tier thresholds without business approval.**

### Supabase Tables

- `loyalty_points`, `loyalty_transactions`, `loyalty_rewards`, `referrals` tables are defined in database migrations.
- **Do not modify schema or RLS policies.**

---

## Current Status

- **Phase 6.5:** ✅ Foundation created as re-export layer.
- **Phase 6.6:** ✅ Import adoption completed — 6 files migrated to `@/modules/loyalty`.
- **Phase 6.7:** ✅ File movement completed — `src/services/loyalty.js` moved to `src/modules/loyalty/api/loyalty.js`.
- **Files created:** 8 (index.js + 6 sub-layer index.js + README.md)
- **Files moved:** 1 (`src/services/loyalty.js` → `src/modules/loyalty/api/loyalty.js`)
- **Files deleted:** 0
- **Imports changed:** 6 (Phase 6.6) + 1 internal import path fix (Phase 6.7: `./supabase` → `@/services/supabase`)
- **Old path status:** `src/services/loyalty.js` is now a backward-compatible re-export stub
- **Behavior changed:** No
- **Supabase queries changed:** No
- **Database schema / RLS changed:** No
- **Routes changed:** No
- **UI redesigned:** No
