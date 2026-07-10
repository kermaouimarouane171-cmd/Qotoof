# Phase 6.4 — Loyalty File Movement Evaluation Report

**Phase:** 6.4 — Loyalty File Movement Evaluation
**Date:** 2026-06-24
**Status:** ✅ Completed — Movement **deferred** (loyalty does not belong to coupons)
**Approach:** Inspect loyalty.js and all consumers, evaluate semantic ownership, decide whether to move to coupons or defer

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` was read in full (614 lines) and strictly followed throughout this phase.

Key rules respected:
- ✅ Analysis before execution — loyalty.js and all consumers inspected before any decision
- ✅ No guessing — semantic ownership was evaluated against documented module boundaries
- ✅ No business logic, Supabase query, database/RLS, Edge Function, route, or UI changes
- ✅ No `any`, `@ts-ignore`, `@ts-expect-error`
- ✅ No legacy path deletion, no mass file movement
- ✅ No circular dependencies (verified by madge — 705 files)
- ✅ No deep module imports

---

## 2. What Was Inspected

### Source File

| File | Lines | Exports | Internal Imports | Risk |
|---|---|---|---|---|
| `src/services/loyalty.js` | 861 | `loyaltyApi` (default), `LOYALTY_TIERS`, `REFERRAL_REWARD_POINTS`, `calculateLoyaltyPointsForOrder`, `calculateRewardDiscountAmount`, `addLoyaltyPoints`, `generateReferralCode`, `processReferral` | `./supabase` (relative), `@/utils/withRetry` (absolute) | Medium — large file, multiple Supabase tables, referral system |

### loyalty.js Domain Analysis

**What loyalty.js owns:**
- **Loyalty points**: `getPointsBalance`, `awardPoints`, `deductPoints` — queries `loyalty_points` table
- **Loyalty tiers**: `LOYALTY_TIERS` (Bronze/Silver/Gold/Platinum), `getTier`, `checkTierUpgrade`, `getTierProgress` — tier definitions and progression
- **Loyalty transactions**: `insertLoyaltyTransaction`, `fetchProcessedOrderTransactions`, `fetchReferralBonusTransactions`, `getTransactionHistory` — queries `loyalty_transactions` table
- **Loyalty rewards**: `getAvailableRewards`, `redeemReward` — queries `loyalty_rewards` table, creates coupons as side effect
- **Referral system**: `getReferralDashboard`, `attachReferralCode`, `syncReferralBonuses`, `generateReferralCode`, `processReferral`, `buildReferralLink` — queries `referrals` and `profiles` tables
- **Loyalty dashboard**: `getLoyaltyDashboard`, `getLoyaltyStats` — aggregates stats, history, rewards, referral data
- **Order benefits sync**: `syncDeliveredOrderBenefits` — queries `orders` table, awards points for delivered orders
- **Notifications**: `insertNotification` — inserts into `notifications` table (best-effort)
- **Coupon creation**: `redeemReward` creates coupons in `coupons` table as a side effect of reward redemption

**Supabase tables accessed by loyalty.js:**
1. `loyalty_points` — points balance per user
2. `loyalty_transactions` — transaction history
3. `loyalty_rewards` — available rewards catalog
4. `referrals` — referral relationships
5. `profiles` — user profile (referral code, referred_by)
6. `orders` — delivered orders for points sync
7. `notifications` — best-effort notification inserts
8. `coupons` — creates coupons as reward redemption output

### Import Paths Surveyed

| Import Pattern | Files Found | Details |
|---|---|---|
| `from '@/services/loyalty'` | 3 | `pages/buyer/Loyalty.jsx` (default + named), `pages/buyer/Orders.jsx` (default), `__tests__/services/loyalty.test.js` (named) |
| `import('@/services/loyalty')` (dynamic) | 1 | `store/authSessionStore.js` — dynamic import for referral code attachment |
| `jest.mock('@/services/loyalty')` | 2 | `__tests__/pages/buyerOrdersRealtime.test.jsx`, `features/orders/__tests__/orderFlow.integration.test.js` |
| `from '@/modules/coupons'` (loyalty) | 0 | No existing module-level loyalty imports |
| References to loyalty in routes/nav | 2 | `router/AppRouter.jsx` (BuyerLoyalty route), `components/ProtectedRoute.jsx` (nav link) |

### Coupons Module Boundaries (from README)

**What coupons module owns:**
- Coupon CRUD operations (create, read, update, deactivate)
- Coupon validation logic (code lookup, eligibility, usage limits)
- Coupon normalization (field defaults, type coercion)
- Coupon active/expired checks
- Coupon discount calculation (percentage, fixed, bulk)
- Coupon redemption tracking
- Coupon realtime subscriptions
- Coupon statistics and analytics

**What coupons module does NOT own:**
- Checkout page composition
- Cart state
- Order lifecycle
- Payment provider logic
- Delivery logic
- Product catalog ownership
- Auth/session logic
- User profile ownership
- Notification delivery logic
- Admin dashboard composition

**Notable:** The coupons README does NOT mention loyalty points, loyalty tiers, referrals, or loyalty rewards anywhere in its scope.

---

## 3. Decision: Movement **Deferred**

### ❌ loyalty.js does NOT belong to coupons

**Reasoning:**

1. **Distinct domain**: loyalty.js manages a complete loyalty/rewards program (points, tiers, referrals, rewards) — this is a separate business domain from coupons (discount codes, validation, redemption tracking).

2. **Coupons README scope**: The coupons module explicitly owns coupon CRUD, validation, normalization, discount calculation, and redemption tracking. Loyalty points, tiers, and referrals are NOT in scope.

3. **Cross-module dependency, not ownership**: While `redeemReward` creates coupons in the `coupons` table, this is a cross-module interaction (loyalty → coupons) where loyalty consumes the coupons module's data model. This does not mean loyalty logic belongs inside the coupons module.

4. **Multiple Supabase tables**: loyalty.js accesses 8 different tables, only one of which (`coupons`) is owned by the coupons module. The other 7 tables (`loyalty_points`, `loyalty_transactions`, `loyalty_rewards`, `referrals`, `profiles`, `orders`, `notifications`) are loyalty-domain tables.

5. **File size and complexity**: At 861 lines with complex referral sync logic, order benefit processing, and tier management, loyalty.js is a substantial service that would overwhelm the coupons module if placed there.

6. **Consumer analysis**: Consumers import loyalty for buyer dashboard features (Loyalty.jsx, Orders.jsx), referral processing (authSessionStore.js), and testing — none of these are coupon-related use cases.

### Recommended Future Ownership

**Create a dedicated `src/modules/loyalty/` module in a future phase.**

Proposed structure:
```
src/modules/loyalty/
├── index.js              # Public API entry point
├── api/
│   ├── index.js          # Re-export loyaltyApi
│   └── loyalty.js        # Moved from src/services/loyalty.js
├── domain/
│   └── index.js          # Tier definitions, point calculations
├── hooks/
│   └── index.js          # Future: useLoyaltyDashboard, useReferralDashboard
├── ui/
│   └── index.js          # Future: Loyalty page components
├── stores/
│   └── index.js          # Placeholder
├── utils/
│   └── index.js          # Referral link builder, notification helper
└── README.md
```

This should be created as a new module foundation (re-export layer first, then file movement in a subsequent phase).

---

## 4. Files Moved

**None.** No files were moved in this phase.

---

## 5. Compatibility Re-export Files

**None.** No re-export files were created.

---

## 6. Exports Preserved

**N/A.** No files were moved, so all exports remain at their original locations.

---

## 7. Files Intentionally Not Moved

| # | File | Skip Reason |
|---|---|---|
| 1 | `src/services/loyalty.js` | **Does not belong to coupons.** loyalty.js is a distinct domain (loyalty points, tiers, referrals, rewards) that needs its own dedicated module. Moving it to `src/modules/coupons/api/loyalty.js` would pollute the coupons module with unrelated domain logic and violate the single-responsibility principle documented in the coupons README. |

---

## 8. Backward Compatibility Verification

| Question | Answer |
|---|---|
| Do old imports still work (`@/services/loyalty`)? | ✅ Yes — file unchanged |
| Were any legacy paths deleted? | ✅ No |
| Was loyalty behavior changed? | ✅ No — file untouched |
| Was reward/discount behavior changed? | ✅ No — file untouched |
| Was coupon/cart/checkout behavior changed? | ✅ No — nothing changed |
| Were React Query keys changed? | ✅ No |
| Were Supabase queries changed? | ✅ No |
| Were routes changed? | ✅ No |
| Were any deep module imports introduced? | ✅ No — nothing changed |
| Were any circular dependencies introduced? | ✅ No — nothing changed |

---

## 9. No Deep Module Imports Verification

No changes were made, so no new deep module imports could have been introduced. Baseline is clean (verified by grep in Phase 6.3).

---

## 10. Circular Dependency Check

| Verification | Result |
|---|---|
| `npm run check:circular` | ✅ 0 circular dependencies across 705 files |
| File count change | 705 → 705 (no files moved) |

---

## 11. Documentation Updates

### Documents Updated

| Document | Update |
|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | Status line + Phase 6.4 completion note (deferred decision documented) |

### Documents Checked But Not Changed

| Document | Status |
|---|---|
| `ARCHITECTURE_GUIDE.md` | ✅ Current |
| `DEVELOPER_GUIDE.md` | ✅ Current |
| `eslint.config.js` | ✅ Current |
| `package.json` | ✅ Current |
| `.windsurfrules` | ✅ Current |
| `src/modules/coupons/README.md` | ✅ Current — does not mention loyalty (correct) |
| `src/modules/cart/README.md` | ✅ Current |
| `src/modules/checkout/README.md` | ✅ Current |

### Outdated Documents Found

| Document | Issue | Action |
|---|---|---|
| `src/modules/coupons/README.md` | Says "No source files have been moved" — actually 1 file moved (coupons.js in Phase 6.1) | Update in future |
| `src/modules/cart/README.md` | Says "No source files have been moved" — 2 files moved (minimumOrderService, cartQuantity) | Update in future |
| `src/modules/checkout/README.md` | Says "Files moved: 0" — 2 files moved (checkoutCleanup, useCheckoutPricing) | Update in future |
| `src/modules/reviews/README.md` | Says "No source files have been moved" — 3 files moved | Update in future |

### Documentation Needing Future Updates

| Document | Update Needed | Target Phase |
|---|---|---|
| `src/modules/coupons/README.md` | Update "Current Status" section | Phase 6.5+ |
| `src/modules/cart/README.md` | Update "Current Status" section | Phase 6.5+ |
| `src/modules/checkout/README.md` | Update "Current Status" section | Phase 6.5+ |
| `src/modules/reviews/README.md` | Update "Current Status" section | Phase 6.5+ |
| `src/modules/checkout/api/index.js` | Update coupon/minimumOrderService re-exports to use `@/modules/coupons` and `@/modules/cart` | Phase 6.5+ |
| `MODULAR_DEVELOPMENT_PLAN.md` | Add `src/modules/loyalty/` as a future module in the module list | Future loyalty module phase |

---

## 12. Command Results

| Command | Result |
|---|---|
| `npm run lint` | ✅ Exit code 0 — 0 errors, 0 warnings |
| `npm run type-check` | ✅ Exit code 0 — no type errors |
| `npm run build` | ✅ Exit code 0 — built in 1m 14s |
| `npm run check:circular` | ✅ Exit code 0 — 0 circular deps, 705 files |

### madge File Count

| Phase | Files Tracked | Circular Deps |
|---|---|---|
| Phase 6.3 | 705 | 0 |
| **Phase 6.4** | **705** | **0** |

No file count change (no files moved).

---

## 13. Safe to Continue to Phase 6.5?

### ✅ Yes — 15/15 gate criteria pass

| # | Criterion | Status |
|---|---|---|
| G1 | All moved files have backward-compatible re-exports | ✅ N/A (no files moved) |
| G2 | All old import paths still work | ✅ |
| G3 | All new module imports still work | ✅ N/A (no new imports) |
| G4 | `npm run lint` passes | ✅ |
| G5 | `npm run type-check` passes | ✅ |
| G6 | `npm run build` passes | ✅ |
| G7 | `npm run check:circular` passes | ✅ |
| G8 | No deep module imports | ✅ |
| G9 | No circular dependencies | ✅ |
| G10 | No business logic changed | ✅ |
| G11 | No Supabase queries changed | ✅ |
| G12 | No React Query keys changed | ✅ |
| G13 | No routes changed | ✅ |
| G14 | No database/RLS changes | ✅ |
| G15 | No legacy paths deleted | ✅ |

---

## 14. Recommended Phase 6.5 Candidates

| # | File | Target | Module | Risk | Notes |
|---|---|---|---|---|---|
| 1 | `src/store/favoritesStore.js` | `src/modules/cart/stores/favoritesStore.js` | cart | Medium | 206 lines, Zustand persist, check all consumers |
| 2 | `src/services/favorites.js` | `src/modules/cart/api/favorites.js` | cart | Medium | 373 lines, mixed file (favoritesApi, orderTimelineApi, messagesApi) — may need splitting first |
| 3 | Create `src/modules/loyalty/` foundation | New module | loyalty | Low | Create re-export layer first, then move loyalty.js in a subsequent phase |

---

## 15. Remaining Risks Before Moving Larger Files

| # | Risk | Severity | Description | Recommended Action |
|---|---|---|---|---|
| R1 | `ProtectedRoute.jsx` contains 5 layouts | High | AdminLayout, VendorLayout, DriverLayout, BuyerLayout, MainLayout in one file | Split layouts before moving |
| R2 | `authStore.js` imports from 4+ services | High | Auth store imports phoneOtpService, authRedirects, supabase | Decouple before moving |
| R3 | `CheckoutSimplified.jsx` is 1696 lines | High | 20+ imports, most coupled page | Decompose before moving |
| R4 | `OrderDetail.jsx` is 1701 lines | High | Imports cart, delivery, payment, reviews, refund | Decompose before moving |
| R5 | `ProductDetail.jsx` is 1116 lines | High | Imports cart, delivery, inventory, reviews, refund | Decompose before moving |
| R6 | `paymentGateway.js` is 700 lines | High | Large payment monolith | Do not move until well-tested |
| R7 | `chatService.jsx` uses `.jsx` extension | Medium | Service file with JSX due to ChatComponent export | Separate ChatComponent before moving |
| R8 | `favorites.js` is a mixed file | Medium | Contains favoritesApi, orderTimelineApi, messagesApi | Split before moving |
| R9 | `loyalty.js` needs its own module | Medium | 861 lines, distinct domain (points, tiers, referrals, rewards) | Create `src/modules/loyalty/` foundation first, then move |
| R10 | `checkout/api/index.js` still re-exports from old paths | Low | Still re-exports coupons from `@/services/coupons` and minimumOrderService from `@/services/minimumOrderService` (both now re-export stubs) | Update to use `@/modules/coupons` and `@/modules/cart` in future |
| R11 | Module READMEs outdated | Low | Multiple READMEs say "No source files moved" | Update in future |

---

## 16. Conclusion

### Phase 6.4: ✅ Completed — Movement Deferred

**Summary:**
- 0 files moved (intentionally deferred)
- 0 files deleted
- 0 behavior changes
- loyalty.js was inspected in full (861 lines, 8 Supabase tables, 5 consumers)
- Semantic ownership analysis concluded loyalty does NOT belong to coupons
- Recommended: create dedicated `src/modules/loyalty/` module in a future phase
- All 4 verification commands pass (baseline unchanged)
- 0 circular dependencies (705 files)
- 0 deep module imports
- Full backward compatibility maintained (nothing changed)
