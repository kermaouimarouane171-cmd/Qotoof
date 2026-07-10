# Phase 6.5 — Loyalty Module Foundation Report

**Phase:** 6.5 — Loyalty Module Foundation (re-export layer)
**Date:** 2026-06-24
**Status:** ✅ Completed
**Approach:** Create a dedicated `src/modules/loyalty/` module as a safe re-export/wrapper layer, without moving source files

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` was read in full (614 lines) and strictly followed throughout this phase.

Key rules respected:
- ✅ Minimal changes — only new re-export files created, no source files modified
- ✅ Analysis before execution — loyalty.js, all consumers, and module boundaries inspected
- ✅ No Supabase/RLS/Auth/Payments/migrations touched
- ✅ No `any`, `@ts-ignore`, `@ts-expect-error`
- ✅ No business logic, calculation, validation, Supabase query, database/RLS, Edge Function, route, or UI changes
- ✅ No legacy path deletion, no mass file movement
- ✅ No circular dependencies (verified by madge — 712 files)
- ✅ No deep module imports (all re-exports go through `@/services/loyalty`, not module internals)

---

## 2. Confirmation: `src/services/loyalty.js` Was NOT Moved

✅ `src/services/loyalty.js` remains at its original location, completely unchanged.
- No file movement occurred in this phase.
- No function bodies were modified.
- No imports inside `loyalty.js` were changed.
- The file is 861 lines and touches 8 Supabase tables.

---

## 3. Confirmation: No Behavior Changed

✅ No behavior was changed in any way:
- No loyalty behavior changes
- No reward/referral behavior changes
- No coupon/cart/checkout behavior changes
- No Supabase query changes
- No React Query key changes
- No database/RLS changes
- No Edge Function changes
- No route changes
- No UI redesign

---

## 4. New Files Created (8 files)

| # | File | Type | Description |
|---|---|---|---|
| 1 | `src/modules/loyalty/index.js` | Public API entry point | Re-exports all loyalty exports from `./api` |
| 2 | `src/modules/loyalty/api/index.js` | API layer | Re-exports from `@/services/loyalty` |
| 3 | `src/modules/loyalty/domain/index.js` | Domain placeholder | Future home for tier/points logic |
| 4 | `src/modules/loyalty/hooks/index.js` | Hooks placeholder | Future home for loyalty React Query hooks |
| 5 | `src/modules/loyalty/ui/index.js` | UI placeholder | Future home for loyalty page/components |
| 6 | `src/modules/loyalty/stores/index.js` | Stores placeholder | Future home for loyalty Zustand store |
| 7 | `src/modules/loyalty/utils/index.js` | Utils placeholder | Future home for referral link, notification helper |
| 8 | `src/modules/loyalty/README.md` | Documentation | Module purpose, API, ownership, dependencies, migration plan |

---

## 5. New Loyalty Module Structure

```
src/modules/loyalty/
├── index.js          # Public API entry point
├── api/
│   └── index.js      # Re-exports loyaltyApi, constants, helpers from @/services/loyalty
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
└── README.md         # Module documentation
```

---

## 6. What Loyalty Owns

- **Loyalty points**: balance management (read, award, deduct) — `loyalty_points` table
- **Loyalty tiers**: Bronze/Silver/Gold/Platinum progression with multipliers — tier definitions and progression logic
- **Loyalty transactions**: history recording and retrieval — `loyalty_transactions` table
- **Loyalty rewards**: catalog browsing and redemption orchestration — `loyalty_rewards` table
- **Referrals**: code generation, attachment, tracking, bonus sync — `referrals` and `profiles` tables
- **Reward redemption orchestration**: creates personal one-time coupons as side effect — `coupons` table
- **Order benefits sync**: awards points for delivered orders — `orders` table
- **Loyalty dashboard**: aggregation of stats, history, rewards, referral data
- **Best-effort notifications**: inserts into `notifications` table (to be decoupled in future)

---

## 7. What Loyalty Depends On

| Dependency | Type | Direction | Notes |
|---|---|---|---|
| `users/profiles` | Cross-module | loyalty → users | Reads/writes `profiles.referral_code`, `profiles.referred_by` |
| `orders` | Cross-module | loyalty → orders | Reads delivered orders to award points |
| `notifications` | Cross-module | loyalty → notifications | Inserts notifications directly (best-effort, to be decoupled) |
| `coupons` | Cross-module | loyalty → coupons | Creates personal coupons in `coupons` table during reward redemption |
| `auth` | Cross-module | auth → loyalty | `authSessionStore.js` dynamically imports `loyaltyApi.attachReferralCode` |
| `supabase` | Infrastructure | loyalty → supabase | Direct Supabase client usage |
| `withRetry` | Utility | loyalty → utils | Retry wrapper for API calls |

---

## 8. Why Loyalty Does Not Belong to Coupons

| Aspect | Coupons | Loyalty |
|---|---|---|
| **Core concept** | Discount codes for price reduction | Points-based rewards program |
| **Supabase tables** | `coupons`, `coupon_redemptions` | `loyalty_points`, `loyalty_transactions`, `loyalty_rewards`, `referrals` |
| **User interaction** | Enter code at checkout → get discount | Earn points from orders → redeem for rewards |
| **Lifecycle** | Create → validate → redeem → track | Earn → accumulate → tier upgrade → redeem reward |
| **Coupons README scope** | Coupon CRUD, validation, normalization, discount calculation, redemption tracking | Does NOT mention loyalty, points, tiers, or referrals |

**Key distinction:** Loyalty creates coupons as a **side effect** of reward redemption. This is a cross-module dependency (loyalty → coupons), not ownership. Coupons owns coupon CRUD and validation; loyalty owns the loyalty program logic that happens to produce coupons.

---

## 9. Existing Imports Inspected

### Static Imports of `@/services/loyalty`

| File | Import | Type |
|---|---|---|
| `src/pages/buyer/Loyalty.jsx` | `import loyaltyApi, { LOYALTY_TIERS, calculateRewardDiscountAmount } from '@/services/loyalty'` | Default + named |
| `src/pages/buyer/Orders.jsx` | `import loyaltyApi from '@/services/loyalty'` | Default only |
| `src/__tests__/services/loyalty.test.js` | `import { calculateLoyaltyPointsForOrder, calculateRewardDiscountAmount, loyaltyApi } from '@/services/loyalty'` | Named only |

### Dynamic Imports

| File | Import | Type |
|---|---|---|
| `src/store/authSessionStore.js` | `const { default: loyaltyApi } = await import('@/services/loyalty')` | Dynamic default |

### Test Mocks

| File | Mock |
|---|---|
| `src/__tests__/pages/buyerOrdersRealtime.test.jsx` | `jest.mock('@/services/loyalty', ...)` |
| `src/features/orders/__tests__/orderFlow.integration.test.js` | `jest.mock('@/services/loyalty', ...)` |

### Other References

| File | Reference |
|---|---|
| `src/router/AppRouter.jsx` | `BuyerLoyalty` lazy import and route definition |
| `src/components/ProtectedRoute.jsx` | Nav link to `/buyer/loyalty` |
| `src/services/notificationPreferences.js` | `loyalty_updates` preference key, `loyalty` category |

---

## 10. Backward Compatibility Verification

| Question | Answer |
|---|---|
| Do old imports still work (`@/services/loyalty`)? | ✅ Yes — `src/services/loyalty.js` unchanged |
| Do new imports work (`@/modules/loyalty`)? | ✅ Yes — re-export layer created |
| Were any app imports changed? | ✅ No — this is foundation only, not import adoption |
| Were any legacy paths deleted? | ✅ No |
| Was loyalty behavior changed? | ✅ No — source file untouched |
| Was reward/referral behavior changed? | ✅ No |
| Was coupon/cart/checkout behavior changed? | ✅ No |
| Were React Query keys changed? | ✅ No |
| Were Supabase queries changed? | ✅ No |
| Were routes changed? | ✅ No |
| Were any deep module imports introduced? | ✅ No — re-exports use `@/services/loyalty` (not module internals) |
| Were any circular dependencies introduced? | ✅ No — verified by madge |

---

## 11. No Deep Module Imports Verification

The loyalty module API layer (`src/modules/loyalty/api/index.js`) re-exports from `@/services/loyalty` — this is the old service path, not a deep module import. No `@/modules/<name>/<sub>` patterns are used.

Grep for `from '@/modules/loyalty/` across all `src/**/*.{js,jsx,ts,tsx}` returned **0 results** (no deep imports of loyalty module internals).

---

## 12. Circular Dependency Check

| Verification | Result |
|---|---|
| `npm run check:circular` | ✅ 0 circular dependencies across 712 files |
| File count change | 705 → 712 (7 new `.js` files; README.md not tracked by madge) |

**Circular dependency analysis:**
- `src/modules/loyalty/api/index.js` imports from `@/services/loyalty` → `./supabase` + `@/utils/withRetry` — no cycle
- `src/modules/loyalty/index.js` imports from `./api` — no cycle
- All placeholder files (domain, hooks, ui, stores, utils) have no imports — no cycle possible

---

## 13. Documentation Updates

### Documents Updated

| Document | Update |
|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | Status line + Phase 6.5 completion note |
| `ARCHITECTURE_GUIDE.md` | Added Phase 6.5 to modular migration progress list |
| `DEVELOPER_GUIDE.md` | Added loyalty module to module structure tree in Section 3 |
| `src/modules/loyalty/README.md` | Created — full module documentation |

### Documents Checked But Not Changed

| Document | Status |
|---|---|
| `.windsurfrules` | ✅ Current |
| `eslint.config.js` | ✅ Current — no-restricted-imports rule covers loyalty module |
| `package.json` | ✅ Current |
| `src/modules/coupons/README.md` | ✅ Current — does not mention loyalty (correct) |
| `src/modules/users/README.md` | ✅ Current |
| `src/modules/orders/README.md` | ✅ Current — mentions `loyaltyApi` as intentionally NOT exported |
| `src/modules/notifications/README.md` | ✅ Current — mentions `loyalty` as a notification category |
| `src/modules/cart/README.md` | ✅ Current |
| `src/modules/checkout/README.md` | ✅ Current |

### Outdated Documents Found

| Document | Issue | Action |
|---|---|---|
| `src/modules/coupons/README.md` | Says "No source files have been moved" — 1 file moved (coupons.js in Phase 6.1) | Update in future |
| `src/modules/cart/README.md` | Says "No source files have been moved" — 2 files moved | Update in future |
| `src/modules/checkout/README.md` | Says "Files moved: 0" — 2 files moved | Update in future |
| `src/modules/reviews/README.md` | Says "No source files have been moved" — 3 files moved | Update in future |
| `src/modules/orders/README.md` | Lists `loyaltyApi` as "Intentionally NOT Exported" — now available from `@/modules/loyalty` | Update in future |
| `ARCHITECTURE_GUIDE.md` | Still references `src/features/` structure as primary | Update in future (documented TODO already exists) |

### Documentation Needing Future Updates

| Document | Update Needed | Target Phase |
|---|---|---|
| `src/modules/coupons/README.md` | Update "Current Status" section | Phase 6.6+ |
| `src/modules/cart/README.md` | Update "Current Status" section | Phase 6.6+ |
| `src/modules/checkout/README.md` | Update "Current Status" section | Phase 6.6+ |
| `src/modules/reviews/README.md` | Update "Current Status" section | Phase 6.6+ |
| `src/modules/orders/README.md` | Update loyalty reference to point to `@/modules/loyalty` | Phase 6.6+ |
| `src/modules/checkout/api/index.js` | Update coupon/minimumOrderService re-exports to use `@/modules/coupons` and `@/modules/cart` | Phase 6.6+ |

---

## 14. Command Results

| Command | Result |
|---|---|
| `npm run lint` | ✅ Exit code 0 — 0 errors, 0 warnings |
| `npm run type-check` | ✅ Exit code 0 — no type errors |
| `npm run build` | ✅ Exit code 0 — built in 2m 2s |
| `npm run check:circular` | ✅ Exit code 0 — 0 circular deps, 712 files |

### madge File Count

| Phase | Files Tracked | Circular Deps |
|---|---|---|
| Phase 6.4 | 705 | 0 |
| **Phase 6.5** | **712** | **0** |

File count increase: +7 (7 new `.js` files; README.md not tracked by madge).

---

## 15. Safe to Continue to Phase 6.6?

### ✅ Yes — 15/15 gate criteria pass

| # | Criterion | Status |
|---|---|---|
| G1 | All moved files have backward-compatible re-exports | ✅ N/A (no files moved) |
| G2 | All old import paths still work | ✅ `@/services/loyalty` unchanged |
| G3 | All new module imports work | ✅ `@/modules/loyalty` created and verified |
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

## 16. Recommended Phase 6.6 Candidates

| # | Task | Target | Risk | Notes |
|---|---|---|---|---|
| 1 | Loyalty import adoption | Update 3 app files to import from `@/modules/loyalty` instead of `@/services/loyalty` | Low | `pages/buyer/Loyalty.jsx`, `pages/buyer/Orders.jsx`, `store/authSessionStore.js` |
| 2 | `src/store/favoritesStore.js` movement | `src/modules/cart/stores/favoritesStore.js` | Medium | 206 lines, Zustand persist, check all consumers |
| 3 | `src/services/favorites.js` movement | `src/modules/cart/api/favorites.js` | Medium | 373 lines, mixed file — may need splitting first |

---

## 17. Remaining Risks Before Moving loyalty.js or favoritesStore.js

| # | Risk | Severity | Description | Recommended Action |
|---|---|---|---|---|
| R1 | `loyalty.js` is 861 lines with 8 Supabase tables | Medium | Large file with complex referral sync, order benefits sync, and reward redemption | Complete import adoption first (Phase 6.6), then move in Phase 6.7+ |
| R2 | `loyalty.js` has internal helper functions | Medium | `insertLoyaltyTransaction`, `fetchProcessedOrderTransactions`, `fetchReferralBonusTransactions`, `insertNotification`, `writePointsBalance` are not exported — they're internal helpers | Ensure no consumers import these directly before moving |
| R3 | `loyalty.js` creates coupons directly via Supabase | Medium | `redeemReward` inserts into `coupons` table directly instead of using `couponsApi.createCoupon()` | Future decoupling needed, but not a blocker for file movement |
| R4 | `loyalty.js` inserts notifications directly | Low | `insertNotification` helper inserts into `notifications` table directly | Future decoupling needed, but not a blocker for file movement |
| R5 | `authSessionStore.js` dynamically imports loyalty | Low | Dynamic import `import('@/services/loyalty')` — will need to be updated to `import('@/modules/loyalty')` during import adoption | Update during Phase 6.6 import adoption |
| R6 | `favoritesStore.js` uses Zustand persist | Medium | 206 lines with localStorage persistence — moving requires verifying all consumers | Inspect all imports before moving |
| R7 | `favorites.js` is a mixed file | Medium | Contains favoritesApi, orderTimelineApi, messagesApi — may need splitting before moving | Split file first, then move individual parts |
| R8 | `ProtectedRoute.jsx` contains 5 layouts | High | AdminLayout, VendorLayout, DriverLayout, BuyerLayout, MainLayout in one file | Split layouts before moving |
| R9 | `CheckoutSimplified.jsx` is 1696 lines | High | 20+ imports, most coupled page | Decompose before moving |
| R10 | `OrderDetail.jsx` is 1701 lines | High | Imports cart, delivery, payment, reviews, refund | Decompose before moving |
| R11 | Module READMEs outdated | Low | Multiple READMEs say "No source files moved" | Update in future |

---

## 18. Conclusion

### Phase 6.5: ✅ Completed

**Summary:**
- 8 new files created (7 `.js` re-export/placeholder files + 1 `README.md`)
- 0 files moved
- 0 files deleted
- 0 behavior changes
- 0 app imports changed (foundation only, not import adoption)
- `src/services/loyalty.js` remains at original location, completely unchanged
- New `@/modules/loyalty` public API works and re-exports all loyalty exports
- Old `@/services/loyalty` imports continue to work unchanged
- 0 circular dependencies (712 files)
- 0 deep module imports
- All 4 verification commands pass
- Loyalty module is now the 15th module in the modular architecture
