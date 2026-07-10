# Phase 6.28 — Coupons Import Adoption Report

**Phase:** 6.28 — Safe Import Adoption for `@/services/coupons` (Class C)
**Date:** 2026-06-25
**Status:** ✅ Completed — 2 files changed (1 app import + 1 module-internal import), 0 behavior changes

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` was read in full (614 lines) and strictly followed throughout this phase.

Key rules respected:
- ✅ No file movement
- ✅ No business logic, UI, coupon/checkout/cart/order/payment behavior changes
- ✅ No Supabase query, React Query key, database/RLS, Edge Function, or route changes
- ✅ No legacy stub deletion
- ✅ No mass import rewriting (only 2 targeted files)
- ✅ No circular dependencies (verified — 719 files, 0 circular)
- ✅ No forbidden deep module imports introduced
- ✅ No `any`, `@ts-ignore`, `@ts-expect-error`
- ✅ Coupon, checkout, cart, order, payment behavior unchanged

---

## 2. Confirmation: This Phase Only Targeted `@/services/coupons`

✅ Only `@/services/coupons` was migrated. No other paths were touched:
- ❌ Not touched: `@/store/cartStore`
- ❌ Not touched: `@/services/minimumOrderService`
- ❌ Not touched: `@/hooks/useCheckoutPricing`
- ❌ Not touched: Any Class D stubs

---

## 3. Files Inspected

### Rules & Configuration
- `.windsurfrules` (614 lines — read in full)
- `eslint.config.js` — ESLint config with `no-restricted-imports` rule
- `package.json` — project dependencies and scripts

### Phase Reports Read
- `docs/architecture/phase-6-27-favorites-store-import-adoption-report.md`
- `docs/architecture/phase-6-23-legacy-import-audit-report.md`
- `docs/architecture/phase-6-1-coupons-reviews-file-movement-report.md`

### Coupons Module Files Inspected
- `src/services/coupons.js` — compatibility stub (re-exports 6 named + 1 default from `@/modules/coupons`)
- `src/modules/coupons/api/coupons.js` — actual implementation (534 lines)
- `src/modules/coupons/api/index.js` — API layer barrel (exports `couponsApi`, `subscribeToVendorCouponRedemptions`, `couponsApiDefault`)
- `src/modules/coupons/index.js` — root barrel (exports API + domain + utils, no UI exports)
- `src/modules/coupons/README.md` — module documentation

### Importing Files Inspected
- `src/pages/CheckoutSimplified.jsx` — line 16, named import `couponsApi` (1696 lines, high-risk file)
- `src/modules/checkout/api/index.js` — line 23, module-internal re-export of 6 named symbols

### Main Documentation Read
- `MODULAR_DEVELOPMENT_PLAN.md`
- `ARCHITECTURE_GUIDE.md`
- `DEVELOPER_GUIDE.md`

---

## 4. Files Changed

| # | File | Line(s) | Change |
|---|---|---|---|
| 1 | `src/pages/CheckoutSimplified.jsx` | 16 | `import { couponsApi } from '@/services/coupons'` → `import { couponsApi } from '@/modules/coupons'` |
| 2 | `src/modules/checkout/api/index.js` | 23 | `} from '@/services/coupons'` → `} from '@/modules/coupons'` |

**Total: 2 files changed, all import-path-only.**

---

## 5. Imports Migrated

| # | File | Old Import | New Import | Notes |
|---|---|---|---|---|
| 1 | `src/pages/CheckoutSimplified.jsx:16` | `import { couponsApi } from '@/services/coupons'` | `import { couponsApi } from '@/modules/coupons'` | Named → named (same shape). High-risk file (1696 lines) — change is strictly import-path-only. |
| 2 | `src/modules/checkout/api/index.js:23` | `export { couponsApi, normalizeCoupon, isCouponCurrentlyActive, calculateCouponDiscountAmount, calculateBulkDiscountBreakdown } from '@/services/coupons'` | Same from `'@/modules/coupons'` | Module-internal re-export. No circular dependency risk — coupons module does not import from checkout module. |

---

## 6. Imports Intentionally Skipped

| # | Location | Reason |
|---|---|---|
| 1 | `src/services/coupons.js` (stub itself) | Intentionally kept unchanged — compatibility stub must remain |

**No other imports of `@/services/coupons` were found.** All consumers were migrated.

---

## 7. Whether Any Tests/Mocks Were Updated

**No test mocks were updated.** No test files mock `@/services/coupons` or `@/modules/coupons`. The migration did not require any mock changes.

---

## 8. Confirmation: `@/services/coupons` Still Works as Compatibility Stub

✅ `src/services/coupons.js` was NOT modified. It remains a compatibility re-export stub:
```js
export {
  couponsApi,
  subscribeToVendorCouponRedemptions,
  normalizeCoupon,
  isCouponCurrentlyActive,
  calculateCouponDiscountAmount,
  calculateBulkDiscountBreakdown,
} from '@/modules/coupons'

export { couponsApiDefault as default } from '@/modules/coupons'
```

Any remaining code that still imports from `@/services/coupons` will continue to work.

---

## 9. Confirmation: `@/modules/coupons` Exports the Needed Symbols

✅ The coupons module root barrel (`src/modules/coupons/index.js`) exports:
- `couponsApi` (named) — via `./api` → `./api/coupons`
- `subscribeToVendorCouponRedemptions` (named) — via `./api`
- `couponsApiDefault` (named) — via `./api` (this is the default export of `coupons.js`)
- `normalizeCoupon` (named) — via `./domain`
- `isCouponCurrentlyActive` (named) — via `./domain`
- `calculateCouponDiscountAmount` (named) — via `./domain`
- `calculateBulkDiscountBreakdown` (named) — via `./domain`

All symbols needed by `CheckoutSimplified.jsx` (`couponsApi`) and `checkout/api/index.js` (all 6 named exports) are available from the root barrel.

---

## 10. Confirmation: `@/modules/coupons` Remains Lightweight

✅ The coupons root barrel exports only from `./api`, `./domain`, `./utils`. No UI exports. No `export * from './ui'`. No eager loading of heavy components.

---

## 11. Confirmation: No Files Were Moved

- **Files moved:** 0

---

## 12. Confirmation: No Legacy Stubs Were Deleted

- **Stubs deleted:** 0
- `src/services/coupons.js` remains intact and unchanged.

---

## 13. Confirmation: No Behavior Changed

- No business logic, UI, coupon/checkout/cart/order/payment behavior changes
- Import-path-only changes — same `couponsApi` object, same functions, same Supabase queries
- No mock changes needed

---

## 14. Confirmation: Coupon Behavior Is Unchanged

✅ The `couponsApi` is the exact same object from `src/modules/coupons/api/coupons.js`. Only the import path changed. No coupon implementation was modified. All coupon operations (`getAvailableCoupons`, `validateCoupon`, `redeemCoupon`, `getUserRedemptions`, `getVendorCoupons`, `getBulkDiscountCandidates`, `createCoupon`, `updateCoupon`, `deactivateCoupon`, `getCouponStats`, `getAllCoupons`) are unchanged.

---

## 15. Confirmation: Checkout Discount Behavior Is Unchanged

✅ `calculateCouponDiscountAmount` and `calculateBulkDiscountBreakdown` are the exact same functions. No discount calculation logic was modified.

---

## 16. Confirmation: Cart Behavior Is Unchanged

✅ No cart-related code was modified.

---

## 17. Confirmation: Order Behavior Is Unchanged

✅ No order-related code was modified.

---

## 18. Confirmation: Payment Behavior Is Unchanged

✅ No payment-related code was modified.

---

## 19. Confirmation: Supabase Queries Are Unchanged

✅ No Supabase queries were modified.

---

## 20. Confirmation: React Query Keys Are Unchanged

✅ No React Query keys were modified.

---

## 21. Confirmation: Routes Are Unchanged

✅ No routes were modified.

---

## 22. Confirmation: No Forbidden Deep Imports Were Introduced

✅ All new imports use `@/modules/coupons` (root barrel). No deep imports like `@/modules/coupons/api/coupons` were introduced in app code.

---

## 23. Confirmation: No Circular Dependencies Were Introduced

✅ `npm run check:circular` — 719 files processed, 0 circular dependencies found.

The coupons module does not import from the checkout module, so changing `checkout/api/index.js` to import from `@/modules/coupons` instead of `@/services/coupons` introduces no circular dependency.

---

## 24. Documentation Updates

### Documents Updated
1. `docs/architecture/phase-6-28-coupons-import-adoption-report.md` — this report (created)
2. `MODULAR_DEVELOPMENT_PLAN.md` — Phase 6.28 completion note + status line update

### Documents Checked But Not Changed
1. `ARCHITECTURE_GUIDE.md` — no references to `@/services/coupons` found
2. `DEVELOPER_GUIDE.md` — no references to `@/services/coupons` found
3. `src/modules/coupons/README.md` — contains migration candidate table; historical, no change needed
4. `eslint.config.js` — no changes needed
5. `package.json` — no changes needed

### Documentation Still Needing Future Updates
- 14 outdated references from Phase 6.26 audit still remain across 8 module READMEs/placeholder files
- `src/modules/cart/README.md` still references `@/store/favoritesStore` in migration candidate table (noted in Phase 6.27)
- These should be addressed in a future documentation cleanup phase

---

## 25. Verification Results

### Lint & Type-Check
| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed (exit code 0) |
| `npm run type-check` | ✅ Passed (exit code 0) |

### Targeted Tests
| Test Suite | Tests | Result |
|---|---|---|
| `src/__tests__/services/coupons.test.js` | — | ✅ Passed |
| `src/__tests__/services/checkoutService.test.js` | — | ✅ Passed |
| `src/__tests__/pages/Checkout.test.js` | — | ✅ Passed |
| `src/__tests__/pages/CheckoutSimplified.i18n.test.jsx` | — | ✅ Passed |
| `src/__tests__/pages/buyerOrdersRealtime.test.jsx` | — | ✅ Passed |
| `src/__tests__/integration/checkoutFlow.test.js` | — | ✅ Passed |
| `src/__tests__/supabase/paypalCheckout.schema.test.js` | — | ✅ Passed |
| `src/__tests__/utils/checkoutCleanup.test.js` | — | ✅ Passed |
| `src/features/checkout/__tests__/checkout.integration.test.js` | — | ✅ Passed |
| `src/features/orders/__tests__/orderFlow.integration.test.js` | — | ✅ Passed |
| `src/features/marketplace/__tests__/addToCart.integration.test.js` | — | ✅ Passed |
| `src/__tests__/a11y/components.a11y.test.jsx` | — | ✅ Passed |
| **Total** | **207 passed** | **✅ 12 suites, all passed** |

### Final Checks
| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed (exit code 0) |
| `npm run type-check` | ✅ Passed (exit code 0) |
| `npm run build` | ✅ Passed (built in 2m 47s) |
| `npm run check:circular` | ✅ Passed (719 files, 0 circular dependencies) |

---

## 26. Is It Safe to Continue to Phase 6.29?

**Yes.** All verification checks pass. The migration is complete and safe:
- 2 files changed (1 app import + 1 module-internal import, all import-path-only)
- 207 targeted tests pass
- 0 circular dependencies
- `@/services/coupons` stub remains working
- `@/modules/coupons` root barrel remains lightweight
- No test mocks needed updating

---

## 27. Recommended Phase 6.29 Candidates

Based on the Phase 6.23 audit and current status:

### Option A: Class C — `@/services/minimumOrderService` (medium-high risk)
- 2 app imports (`CheckoutSimplified.jsx:23`, `Cart.jsx:22`)
- 1 module-internal (`checkout/api/index.js:29`)
- 1 jest.mock (`rtlComponents.test.jsx`)
- Requires coordinated update of app + module-internal + mock
- Migration: `import { buildMinimumOrderMessage, evaluateVendorMinimumOrders } from '@/services/minimumOrderService'` → `from '@/modules/cart'` (if exported) or `@/modules/checkout`

### Option B: Class C — `@/hooks/useCheckoutPricing` (medium risk)
- 1 app import (`CheckoutSimplified.jsx`)
- May require checking if `@/modules/checkout` exports the hook
- Fewer consumers but needs verification of export availability

### Option C: Class C — `@/store/cartStore` (highest risk)
- 1 app import (`OrderDetail.jsx:44`)
- 9 jest.mocks + 2 requires
- All 11 test references must be updated atomically
- Should be done last among Class C paths

**Recommendation:** Phase 6.29 should target `@/services/minimumOrderService` (Option A) as the natural next step. It shares `CheckoutSimplified.jsx` with this phase, and the module-internal `checkout/api/index.js` is already partially updated (coupons line changed, minimumOrderService line still uses old path). `@/hooks/useCheckoutPricing` should follow in Phase 6.30, and `@/store/cartStore` in Phase 6.31.

---

## 28. Remaining Risks Before Touching `CheckoutSimplified.jsx`, `minimumOrderService`, `useCheckoutPricing`, or `cartStore`

### `CheckoutSimplified.jsx` (1696 lines — high-risk file)
1. **Still has 2 remaining legacy imports:**
   - Line 23: `import { buildMinimumOrderMessage, evaluateVendorMinimumOrders } from '@/services/minimumOrderService'`
   - May also import from `@/hooks/useCheckoutPricing` (needs verification)
2. **These should be migrated in separate phases** (6.29 for minimumOrderService, 6.30 for useCheckoutPricing) to keep changes minimal and verifiable
3. **The file is 1696 lines** — any change must be strictly import-path-only

### `@/services/minimumOrderService`
1. **2 app imports** — `CheckoutSimplified.jsx:23` and `Cart.jsx:22`
2. **1 module-internal** — `checkout/api/index.js:29` (same file already touched in this phase)
3. **1 jest.mock** — in `rtlComponents.test.jsx`
4. **Must verify** that `@/modules/cart` or `@/modules/checkout` exports `buildMinimumOrderMessage` and `evaluateVendorMinimumOrders`

### `@/hooks/useCheckoutPricing`
1. **Needs inspection** — verify which file(s) import it and whether `@/modules/checkout` exports it
2. **May be in `CheckoutSimplified.jsx`** — needs careful verification

### `@/store/cartStore` (highest risk)
1. **9 jest.mocks + 2 requires** — highest mock count of any legacy path
2. **`OrderDetail.jsx` (1700 lines)** — imports `useCartStore` from `@/store/cartStore` (line 44)
3. **`buyer/Orders.jsx`** — also imports `useCartStore`
4. **All 11 test references must be updated atomically**
5. **5 test files already mock `@/modules/cart`** for `useFavoritesStore` (from Phase 6.27) — merging `useCartStore` mock into those same mocks requires careful handling

### Class D stub deletion
1. **Should NOT occur until Phase 7+** — after all Class B and C migrations are complete
2. **`@/services/apis/reviewsApi`** — has 1 indirect consumer (`src/services/api.js:22`) that must be updated first
3. **14 outdated documentation references** across 8 files need updating before stub deletion
