# Phase 6.29 — Minimum Order Service Import Adoption Report

**Phase:** 6.29 — Safe Import Adoption for `@/services/minimumOrderService` (Class C)
**Date:** 2026-06-25
**Status:** ✅ Completed — 4 files changed (2 app imports + 1 module-internal + 1 test mock), 0 behavior changes

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` was read in full (614 lines) and strictly followed throughout this phase.

Key rules respected:
- ✅ No file movement
- ✅ No business logic, UI, minimum order/checkout/cart/order/payment behavior changes
- ✅ No Supabase query, React Query key, database/RLS, Edge Function, or route changes
- ✅ No legacy stub deletion
- ✅ No mass import rewriting (only 4 targeted files)
- ✅ No circular dependencies (verified — 719 files, 0 circular)
- ✅ No forbidden deep module imports introduced
- ✅ No `any`, `@ts-ignore`, `@ts-expect-error`
- ✅ Minimum order, checkout, cart, order, payment behavior unchanged

---

## 2. Confirmation: This Phase Only Targeted `@/services/minimumOrderService`

✅ Only `@/services/minimumOrderService` was migrated. No other paths were touched:
- ❌ Not touched: `@/store/cartStore`
- ❌ Not touched: `@/hooks/useCheckoutPricing`
- ❌ Not touched: Any Class D stubs

---

## 3. Ownership Decision

### Chosen Module Root: `@/modules/cart`

**Why `@/modules/cart` was chosen:**
1. **Source location:** The actual implementation lives at `src/modules/cart/api/minimumOrderService.js` — inside the cart module
2. **Cart API barrel exports:** `src/modules/cart/api/index.js` explicitly exports `buildVendorCartBuckets`, `evaluateVendorMinimumOrders`, `buildMinimumOrderMessage` from `./minimumOrderService`
3. **Cart root barrel exports:** `src/modules/cart/index.js` exports `* from './api'`, making all three symbols available from `@/modules/cart`
4. **Stub confirms ownership:** `src/services/minimumOrderService.js` (the stub) re-exports from `@/modules/cart`
5. **Cart README documents ownership:** `src/modules/cart/README.md` lists `minimumOrderService.js` as a cart module file

### Checkout Re-export: Compatibility, Not Public API

The checkout module (`src/modules/checkout/api/index.js`) re-exports `buildMinimumOrderMessage` and `evaluateVendorMinimumOrders` — but this is a **compatibility/convenience re-export**, not the canonical public API. The checkout module's own documentation (in `src/modules/checkout/index.js` header) lists `cart` as an allowed dependency, confirming that checkout → cart is the correct dependency direction. The checkout module does NOT own the minimum order service implementation.

**Decision:** Use `@/modules/cart` for all app imports. Update the checkout module-internal re-export to also import from `@/modules/cart` (eliminating the indirect dependency on the stub).

---

## 4. Files Inspected

### Rules & Configuration
- `.windsurfrules` (614 lines — read in full)
- `eslint.config.js` — ESLint config with `no-restricted-imports` rule
- `package.json` — project dependencies and scripts

### Phase Reports Read
- `docs/architecture/phase-6-28-coupons-import-adoption-report.md`
- `docs/architecture/phase-6-23-legacy-import-audit-report.md`

### Module Files Inspected
- `src/services/minimumOrderService.js` — compatibility stub (re-exports 3 named exports from `@/modules/cart`)
- `src/modules/cart/api/index.js` — cart API barrel (exports `favoritesApi`, `buildVendorCartBuckets`, `evaluateVendorMinimumOrders`, `buildMinimumOrderMessage`)
- `src/modules/cart/index.js` — cart root barrel (exports `* from './api'`, `./domain`, `./hooks`, `./stores`, `./utils`)
- `src/modules/checkout/api/index.js` — checkout API barrel (re-exports from `@/services/minimumOrderService` — now updated)
- `src/modules/checkout/index.js` — checkout root barrel (re-exports from `./api`)
- `src/modules/cart/README.md` — cart module documentation
- `src/modules/checkout/README.md` — checkout module documentation

### Importing Files Inspected
- `src/pages/Cart.jsx` — line 22, named imports `buildMinimumOrderMessage`, `evaluateVendorMinimumOrders`
- `src/pages/CheckoutSimplified.jsx` — line 23, same named imports (1696 lines, high-risk file)
- `src/modules/checkout/api/index.js` — line 29, module-internal re-export of same 2 symbols

### Test Files with Mocks Inspected
- `src/__tests__/snapshots/rtlComponents.test.jsx` — line 174, mocks `@/services/minimumOrderService` (renders `CartPage`)

### Main Documentation Read
- `MODULAR_DEVELOPMENT_PLAN.md`
- `ARCHITECTURE_GUIDE.md`
- `DEVELOPER_GUIDE.md`

---

## 5. Files Changed

| # | File | Line(s) | Change |
|---|---|---|---|
| 1 | `src/pages/Cart.jsx` | 22 | `from '@/services/minimumOrderService'` → `from '@/modules/cart'` |
| 2 | `src/pages/CheckoutSimplified.jsx` | 23 | Same change |
| 3 | `src/modules/checkout/api/index.js` | 29 | `} from '@/services/minimumOrderService'` → `} from '@/modules/cart'` |
| 4 | `src/__tests__/snapshots/rtlComponents.test.jsx` | 118–131, 174–177 | Merged `evaluateVendorMinimumOrders` and `buildMinimumOrderMessage` into `@/modules/cart` mock; removed `@/services/minimumOrderService` mock |

**Total: 4 files changed, all import-path-only.**

---

## 6. Imports Migrated

| # | File | Old Import | New Import | Notes |
|---|---|---|---|---|
| 1 | `src/pages/Cart.jsx:22` | `import { buildMinimumOrderMessage, evaluateVendorMinimumOrders } from '@/services/minimumOrderService'` | `from '@/modules/cart'` | Named → named (same shape) |
| 2 | `src/pages/CheckoutSimplified.jsx:23` | Same | Same | High-risk file (1696 lines) — strictly import-path-only |
| 3 | `src/modules/checkout/api/index.js:29` | `export { buildMinimumOrderMessage, evaluateVendorMinimumOrders } from '@/services/minimumOrderService'` | `from '@/modules/cart'` | Module-internal re-export. No circular dependency — checkout depends on cart (allowed), cart does not depend on checkout. |

---

## 7. Imports Intentionally Skipped

| # | Location | Reason |
|---|---|---|
| 1 | `src/services/minimumOrderService.js` (stub itself) | Intentionally kept unchanged — compatibility stub must remain |

**No other imports of `@/services/minimumOrderService` were found.** All consumers were migrated.

---

## 8. Whether Any Tests/Mocks Were Updated

**Yes — 1 test file was updated:**

`src/__tests__/snapshots/rtlComponents.test.jsx`:
- **Before:** `jest.mock('@/services/minimumOrderService', () => ({ evaluateVendorMinimumOrders: ..., buildMinimumOrderMessage: ... }))` (separate mock)
- **After:** These two functions were merged into the existing `jest.mock('@/modules/cart', ...)` block; the `@/services/minimumOrderService` mock was removed
- **Reason:** `Cart.jsx` (rendered in this test) now imports from `@/modules/cart` — the mock must intercept the new path

**No test expectations were changed.** Only mock interception paths were updated.

---

## 9. Confirmation: `@/services/minimumOrderService` Still Works as Compatibility Stub

✅ `src/services/minimumOrderService.js` was NOT modified. It remains a compatibility re-export stub:
```js
export {
  buildVendorCartBuckets,
  evaluateVendorMinimumOrders,
  buildMinimumOrderMessage,
} from '@/modules/cart'
```

---

## 10. Confirmation: `@/modules/cart` Exports the Needed Symbols

✅ The cart module root barrel exports via `* from './api'`:
- `buildVendorCartBuckets` — via `./api` → `./minimumOrderService`
- `evaluateVendorMinimumOrders` — via `./api` → `./minimumOrderService`
- `buildMinimumOrderMessage` — via `./api` → `./minimumOrderService`

All symbols needed by `Cart.jsx`, `CheckoutSimplified.jsx`, and `checkout/api/index.js` are available from `@/modules/cart`.

---

## 11. Confirmation: Module Roots Remain Lightweight

✅ `@/modules/cart` — exports only `./api`, `./domain`, `./hooks`, `./stores`, `./utils`. No UI exports. No eager loading.
✅ `@/modules/checkout` — exports only `./api`, `./domain`, `./hooks`, `./utils`. No UI exports. No eager loading.

---

## 12. Confirmation: No Files Were Moved

- **Files moved:** 0

---

## 13. Confirmation: No Legacy Stubs Were Deleted

- **Stubs deleted:** 0
- `src/services/minimumOrderService.js` remains intact and unchanged.

---

## 14. Confirmation: No Behavior Changed

- No business logic, UI, minimum order/checkout/cart/order/payment behavior changes
- Import-path-only changes — same functions, same implementation, same Supabase queries
- Mock structure change only affects test interception, not test expectations

---

## 15. Confirmation: Minimum Order Behavior Is Unchanged

✅ The `evaluateVendorMinimumOrders` and `buildMinimumOrderMessage` functions are the exact same functions from `src/modules/cart/api/minimumOrderService.js`. Only the import path changed. No implementation was modified.

---

## 16. Confirmation: Checkout Validation Behavior Is Unchanged

✅ No checkout validation logic was modified. The checkout module still re-exports the same functions (now from `@/modules/cart` directly instead of through the stub).

---

## 17. Confirmation: Cart Behavior Is Unchanged

✅ No cart-related code was modified beyond the import path.

---

## 18. Confirmation: Order Behavior Is Unchanged

✅ No order-related code was modified.

---

## 19. Confirmation: Payment Behavior Is Unchanged

✅ No payment-related code was modified.

---

## 20. Confirmation: Supabase Queries Are Unchanged

✅ No Supabase queries were modified.

---

## 21. Confirmation: React Query Keys Are Unchanged

✅ No React Query keys were modified.

---

## 22. Confirmation: Routes Are Unchanged

✅ No routes were modified.

---

## 23. Confirmation: No Forbidden Deep Imports Were Introduced

✅ All new imports use `@/modules/cart` (root barrel). No deep imports like `@/modules/cart/api/minimumOrderService` were introduced in app code.

---

## 24. Confirmation: No Circular Dependencies Were Introduced

✅ `npm run check:circular` — 719 files processed, 0 circular dependencies found.

The checkout module depends on the cart module (documented as allowed). The cart module does not depend on the checkout module. Changing `checkout/api/index.js` to import from `@/modules/cart` instead of `@/services/minimumOrderService` introduces no circular dependency.

---

## 25. Documentation Updates

### Documents Updated
1. `docs/architecture/phase-6-29-minimum-order-service-import-adoption-report.md` — this report (created)
2. `MODULAR_DEVELOPMENT_PLAN.md` — Phase 6.29 completion note + status line update

### Documents Checked But Not Changed
1. `ARCHITECTURE_GUIDE.md` — no references to `@/services/minimumOrderService` found
2. `DEVELOPER_GUIDE.md` — no references to `@/services/minimumOrderService` found
3. `src/modules/cart/README.md` — lists `minimumOrderService.js` as cart module file; accurate, no change needed
4. `src/modules/checkout/README.md` — references minimum order service in checkout context; historical, no change needed
5. `eslint.config.js` — no changes needed
6. `package.json` — no changes needed

### Documentation Still Needing Future Updates
- 14 outdated references from Phase 6.26 audit still remain across 8 module READMEs/placeholder files
- `src/modules/cart/README.md` still references `@/store/favoritesStore` in migration candidate table (noted in Phase 6.27)
- These should be addressed in a future documentation cleanup phase

---

## 26. Verification Results

### Lint & Type-Check
| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed (exit code 0) |
| `npm run type-check` | ✅ Passed (exit code 0) |

### Targeted Tests
| Test Suite | Tests | Result |
|---|---|---|
| `src/__tests__/services/minimumOrderService.test.js` | — | ✅ Passed |
| `src/__tests__/services/checkoutService.test.js` | — | ✅ Passed |
| `src/__tests__/pages/Checkout.test.js` | — | ✅ Passed |
| `src/__tests__/pages/CheckoutSimplified.i18n.test.jsx` | — | ✅ Passed |
| `src/__tests__/pages/buyerOrdersRealtime.test.jsx` | — | ✅ Passed |
| `src/__tests__/integration/checkoutFlow.test.js` | — | ✅ Passed |
| `src/__tests__/supabase/paypalCheckout.schema.test.js` | — | ✅ Passed |
| `src/__tests__/utils/checkoutCleanup.test.js` | — | ✅ Passed |
| `src/__tests__/utils/cartQuantity.test.js` | — | ✅ Passed |
| `src/__tests__/stores/favoritesStore.test.js` | — | ✅ Passed |
| `src/features/checkout/__tests__/checkout.integration.test.js` | — | ✅ Passed |
| `src/features/orders/__tests__/orderFlow.integration.test.js` | — | ✅ Passed |
| `src/features/marketplace/__tests__/addToCart.integration.test.js` | — | ✅ Passed |
| `src/__tests__/snapshots/rtlComponents.test.jsx` | — | ✅ Passed |
| `src/__tests__/a11y/components.a11y.test.jsx` | — | ✅ Passed |
| **Total** | **243 passed, 9 snapshots** | **✅ 15 suites, all passed** |

### Final Checks
| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed (exit code 0) |
| `npm run type-check` | ✅ Passed (exit code 0) |
| `npm run build` | ✅ Passed (built in 2m 41s) |
| `npm run check:circular` | ✅ Passed (719 files, 0 circular dependencies) |

---

## 27. Is It Safe to Continue to Phase 6.30?

**Yes.** All verification checks pass. The migration is complete and safe:
- 4 files changed (2 app imports + 1 module-internal + 1 test mock, all import-path-only)
- 243 targeted tests pass
- 0 circular dependencies
- `@/services/minimumOrderService` stub remains working
- `@/modules/cart` root barrel remains lightweight

---

## 28. Recommended Phase 6.30 Candidates

Based on the Phase 6.23 audit and current status:

### Option A: Class C — `@/hooks/useCheckoutPricing` (medium risk)
- 1 app import (`CheckoutSimplified.jsx:28`)
- Needs verification that `@/modules/checkout` exports `useCheckoutPricing` and `calculatePricing`
- Checkout root barrel already exports these (confirmed in `src/modules/checkout/index.js:44`)
- Fewer consumers but in a high-risk file

### Option B: Class C — `@/store/cartStore` (highest risk)
- 1 app import (`OrderDetail.jsx:44`)
- 9 jest.mocks + 2 requires
- All 11 test references must be updated atomically
- Should be done last among Class C paths

**Recommendation:** Phase 6.30 should target `@/hooks/useCheckoutPricing` (Option A) as the natural next step. It shares `CheckoutSimplified.jsx` with this phase. `@/store/cartStore` should follow in Phase 6.31 as the final Class C migration.

---

## 29. Remaining Risks Before Touching `CheckoutSimplified.jsx`, `useCheckoutPricing`, or `cartStore`

### `CheckoutSimplified.jsx` (1696 lines — high-risk file)
1. **Still has 1 remaining legacy import:**
   - Line 28: `import { useCheckoutPricing } from '@/hooks/useCheckoutPricing'`
2. **This should be migrated in Phase 6.30** to keep changes minimal and verifiable
3. **The file is 1696 lines** — any change must be strictly import-path-only
4. **After Phase 6.30, `CheckoutSimplified.jsx` will have zero legacy imports** — all imports will be from module roots or non-stub service paths

### `@/hooks/useCheckoutPricing`
1. **1 app import** — `CheckoutSimplified.jsx:28`
2. **Checkout root barrel already exports** `useCheckoutPricing` and `calculatePricing` (confirmed in `src/modules/checkout/index.js:44`)
3. **Needs mock inspection** — check if any test mocks `@/hooks/useCheckoutPricing`
4. **Migration target:** `@/modules/checkout`

### `@/store/cartStore` (highest risk)
1. **9 jest.mocks + 2 requires** — highest mock count of any legacy path
2. **`OrderDetail.jsx` (1700 lines)** — imports `useCartStore` from `@/store/cartStore` (line 44)
3. **`buyer/Orders.jsx`** — also imports `useCartStore`
4. **All 11 test references must be updated atomically**
5. **5 test files already mock `@/modules/cart`** for `useFavoritesStore` (from Phase 6.27) and some now also mock `evaluateVendorMinimumOrders`/`buildMinimumOrderMessage` (from this phase) — merging `useCartStore` mock into those same mocks requires careful handling
6. **`rtlComponents.test.jsx`** already mocks `@/modules/cart` with `useCartStore`, `useFavoritesStore`, `evaluateVendorMinimumOrders`, `buildMinimumOrderMessage` — adding the real `useCartStore` mock from `@/store/cartStore` requires merging carefully

### Class D stub deletion
1. **Should NOT occur until Phase 7+** — after all Class B and C migrations are complete
2. **`@/services/apis/reviewsApi`** — has 1 indirect consumer (`src/services/api.js:22`) that must be updated first
3. **14 outdated documentation references** across 8 files need updating before stub deletion
