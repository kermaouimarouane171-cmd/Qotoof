# Phase 6.31 — Cart Store Final Import Adoption Report

**Phase:** 6.31 — Safe Import Adoption for `@/store/cartStore` (Final Class C)
**Date:** 2026-06-25
**Status:** ✅ Completed — 13 files changed (1 app import + 1 test import + 2 requires + 9 jest.mocks), 0 behavior changes

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` was read in full (614 lines) and strictly followed throughout this phase.

Key rules respected:
- ✅ No file movement
- ✅ No business logic, UI, cart/order/checkout/payment/auth/session/persistence/hydration behavior changes
- ✅ No Supabase query, React Query key, database/RLS, Edge Function, or route changes
- ✅ No legacy stub deletion
- ✅ No mass import rewriting (only 13 targeted files)
- ✅ No circular dependencies (verified — 719 files, 0 circular)
- ✅ No forbidden deep module imports introduced
- ✅ No `any`, `@ts-ignore`, `@ts-expect-error`
- ✅ Cart, order detail, checkout, payment, auth/session/logout, persistence, hydration behavior unchanged

---

## 2. Confirmation: This Phase Only Targeted `@/store/cartStore`

✅ Only `@/store/cartStore` was migrated. No other paths were touched:
- ❌ Not touched: Any Class D stubs
- ❌ Not touched: Any other legacy paths

---

## 3. Files Inspected

### Rules & Configuration
- `.windsurfrules` (614 lines — read in full)
- `eslint.config.js` — ESLint config with `no-restricted-imports` rule
- `package.json` — project dependencies and scripts

### Phase Reports Read
- `docs/architecture/phase-6-30-checkout-pricing-import-adoption-report.md`
- `docs/architecture/phase-6-29-minimum-order-service-import-adoption-report.md`
- `docs/architecture/phase-6-27-favorites-store-import-adoption-report.md`
- `docs/architecture/phase-6-23-legacy-import-audit-report.md`

### Cart Module Files Inspected
- `src/store/cartStore.js` — compatibility stub (re-exports `useCartStore`, `useCartHydrated` from `@/modules/cart`)
- `src/modules/cart/stores/index.js` — stores barrel (exports `useCartStore`, `useCartHydrated`, `useFavoritesStore`)
- `src/modules/cart/index.js` — root barrel (exports `* from './api'`, `./domain`, `./hooks`, `./stores`, `./utils`)
- `src/modules/cart/README.md` — module documentation

### Importing Files Inspected
- `src/pages/OrderDetail.jsx` — line 44, named import `useCartStore` (1700 lines, high-risk file)
- `src/features/marketplace/__tests__/addToCart.integration.test.js` — line 87, named import `useCartStore`

### Test Files with require() Inspected
- `src/features/orders/__tests__/orderFlow.integration.test.js` — line 410, `require('@/store/cartStore')`
- `src/features/marketplace/__tests__/useCart.test.js` — line 60, `require('@/store/cartStore').useCartStore`

### Test Files with jest.mock() Inspected (9 files)
1. `src/__tests__/services/checkoutService.test.js` — mocks both `@/store/cartStore` and `@/modules/cart`
2. `src/__tests__/integration/sessionManagement.test.js` — mocks both
3. `src/__tests__/pages/buyerOrdersRealtime.test.jsx` — mocks only `@/store/cartStore`
4. `src/__tests__/a11y/components.a11y.test.jsx` — mocks both
5. `src/__tests__/snapshots/darkMode.test.jsx` — mocks both
6. `src/__tests__/snapshots/rtlComponents.test.jsx` — mocks both
7. `src/store/__tests__/authStore.test.js` — mocks both
8. `src/features/orders/__tests__/orderFlow.integration.test.js` — mocks only `@/store/cartStore`
9. `src/features/checkout/__tests__/checkout.integration.test.js` — mocks both

### Main Documentation Read
- `MODULAR_DEVELOPMENT_PLAN.md`
- `ARCHITECTURE_GUIDE.md`
- `DEVELOPER_GUIDE.md`

---

## 4. Files Changed

| # | File | Line(s) | Change |
|---|---|---|---|
| 1 | `src/pages/OrderDetail.jsx` | 44 | `import { useCartStore } from '@/store/cartStore'` → `from '@/modules/cart'` |
| 2 | `src/features/marketplace/__tests__/addToCart.integration.test.js` | 87 | Same import migration |
| 3 | `src/features/orders/__tests__/orderFlow.integration.test.js` | 410 | `require('@/store/cartStore')` → `require('@/modules/cart')` |
| 4 | `src/features/marketplace/__tests__/useCart.test.js` | 60 | `require('@/store/cartStore').useCartStore` → `require('@/modules/cart').useCartStore` |
| 5 | `src/__tests__/services/checkoutService.test.js` | 10–14 | Removed `@/store/cartStore` mock (identical `@/modules/cart` mock already exists) |
| 6 | `src/__tests__/integration/sessionManagement.test.js` | 85–89 | Removed `@/store/cartStore` mock (identical `@/modules/cart` mock already exists) |
| 7 | `src/__tests__/pages/buyerOrdersRealtime.test.jsx` | 34–36 | Changed `@/store/cartStore` mock to `@/modules/cart` (no existing `@/modules/cart` mock) |
| 8 | `src/__tests__/a11y/components.a11y.test.jsx` | 42–49 | Removed `@/store/cartStore` mock (identical `@/modules/cart` mock already exists) |
| 9 | `src/__tests__/snapshots/darkMode.test.jsx` | 93–98 | Removed `@/store/cartStore` mock (identical `@/modules/cart` mock already exists) |
| 10 | `src/__tests__/snapshots/rtlComponents.test.jsx` | 109–116 | Removed `@/store/cartStore` mock (identical `@/modules/cart` mock already exists) |
| 11 | `src/store/__tests__/authStore.test.js` | 102–107 | Removed `@/store/cartStore` mock (identical `@/modules/cart` mock already exists) |
| 12 | `src/features/orders/__tests__/orderFlow.integration.test.js` | 53–55 | Changed `@/store/cartStore` mock to `@/modules/cart` (no existing `@/modules/cart` mock) |
| 13 | `src/features/checkout/__tests__/checkout.integration.test.js` | 89–104 | Removed `@/store/cartStore` mock (identical `@/modules/cart` mock already exists) |

**Total: 13 files changed, all import-path/mock-path-only.**

---

## 5. Imports Migrated

| # | File | Old Import | New Import | Notes |
|---|---|---|---|---|
| 1 | `src/pages/OrderDetail.jsx:44` | `import { useCartStore } from '@/store/cartStore'` | `import { useCartStore } from '@/modules/cart'` | Named → named. High-risk file (1700 lines) — strictly import-path-only. |
| 2 | `src/features/marketplace/__tests__/addToCart.integration.test.js:87` | Same | Same | Test file. Uses `jest.requireActual('@/modules/cart')` in mock — real `useCartStore` preserved. |

---

## 6. require() Calls Migrated

| # | File | Old require | New require | Notes |
|---|---|---|---|---|
| 1 | `src/features/orders/__tests__/orderFlow.integration.test.js:410` | `require('@/store/cartStore')` | `require('@/modules/cart')` | Inside `describe('BuyerOrders')` block |
| 2 | `src/features/marketplace/__tests__/useCart.test.js:60` | `require('@/store/cartStore').useCartStore` | `require('@/modules/cart').useCartStore` | Inside `jest.isolateModules()` — tests real cart store behavior with fresh localStorage |

---

## 7. Jest Mocks Inspected

| # | Test File | Had `@/store/cartStore` mock? | Had `@/modules/cart` mock? | Mock shapes identical? |
|---|---|---|---|---|
| 1 | `checkoutService.test.js` | ✅ | ✅ | ✅ (both: `{ useCartStore: { getState: jest.fn() } }`) |
| 2 | `sessionManagement.test.js` | ✅ | ✅ | ✅ (both: `{ useCartStore: { setState: ... } }`) |
| 3 | `buyerOrdersRealtime.test.jsx` | ✅ | ❌ | N/A — only old mock existed |
| 4 | `components.a11y.test.jsx` | ✅ | ✅ | ✅ (both: `useCartStore: jest.fn((selector) => ...)`) |
| 5 | `darkMode.test.jsx` | ✅ | ✅ | ✅ (both: `useCartStore: jest.fn((selector) => ...)`) |
| 6 | `rtlComponents.test.jsx` | ✅ | ✅ | ✅ (both: `useCartStore: jest.fn((selector) => ...)`) |
| 7 | `authStore.test.js` | ✅ | ✅ | ✅ (both: `{ useCartStore: { getState, setState } }`) |
| 8 | `orderFlow.integration.test.js` | ✅ | ❌ | N/A — only old mock existed |
| 9 | `checkout.integration.test.js` | ✅ | ✅ | ✅ (both: `Object.assign(jest.fn(), { getState, setState })`) |

---

## 8. Jest Mocks Updated

| # | Test File | Action | Details |
|---|---|---|---|
| 1 | `checkoutService.test.js` | Removed `@/store/cartStore` mock | `@/modules/cart` mock already had identical `useCartStore` shape |
| 2 | `sessionManagement.test.js` | Removed `@/store/cartStore` mock | `@/modules/cart` mock already had identical `useCartStore` shape |
| 3 | `buyerOrdersRealtime.test.jsx` | Changed mock path | `jest.mock('@/store/cartStore', ...)` → `jest.mock('@/modules/cart', ...)` (no existing `@/modules/cart` mock) |
| 4 | `components.a11y.test.jsx` | Removed `@/store/cartStore` mock | `@/modules/cart` mock already had identical `useCartStore` shape |
| 5 | `darkMode.test.jsx` | Removed `@/store/cartStore` mock | `@/modules/cart` mock already had identical `useCartStore` shape |
| 6 | `rtlComponents.test.jsx` | Removed `@/store/cartStore` mock | `@/modules/cart` mock already had identical `useCartStore` shape |
| 7 | `authStore.test.js` | Removed `@/store/cartStore` mock | `@/modules/cart` mock already had identical `useCartStore` shape |
| 8 | `orderFlow.integration.test.js` | Changed mock path | `jest.mock('@/store/cartStore', ...)` → `jest.mock('@/modules/cart', ...)` (no existing `@/modules/cart` mock) |
| 9 | `checkout.integration.test.js` | Removed `@/store/cartStore` mock | `@/modules/cart` mock already had identical `useCartStore` shape |

---

## 9. Jest Mocks Intentionally Kept and Why

**None.** All 9 `@/store/cartStore` mocks were either removed (7 files where `@/modules/cart` mock already existed) or changed to `@/modules/cart` (2 files where no `@/modules/cart` mock existed). No test still needs `@/store/cartStore` mock because no app/test code imports from `@/store/cartStore` anymore.

---

## 10. Imports Intentionally Skipped

| # | Location | Reason |
|---|---|---|
| 1 | `src/store/cartStore.js` (stub itself) | Intentionally kept unchanged — compatibility stub must remain |

**No other imports of `@/store/cartStore` were found.** All consumers were migrated.

---

## 11. Confirmation: `@/store/cartStore` Still Works as Compatibility Stub

✅ `src/store/cartStore.js` was NOT modified. It remains a compatibility re-export stub:
```js
export { useCartStore, useCartHydrated } from '@/modules/cart'
```

---

## 12. Confirmation: `@/modules/cart` Exports the Needed Cart Symbols

✅ The cart module root barrel exports via `* from './stores'`:
- `useCartStore` — via `./stores` → `./cartStore`
- `useCartHydrated` — via `./stores` → `./cartStore`
- `useFavoritesStore` — via `./stores` → `./favoritesStore`

Plus API symbols (`favoritesApi`, `buildVendorCartBuckets`, `evaluateVendorMinimumOrders`, `buildMinimumOrderMessage`), domain symbols, hooks, and utils.

All symbols needed by `OrderDetail.jsx` (`useCartStore`) and all test files are available from `@/modules/cart`.

---

## 13. Confirmation: `@/modules/cart` Remains Lightweight

✅ The cart root barrel exports only from `./api`, `./domain`, `./hooks`, `./stores`, `./utils`. No UI exports. No eager loading of heavy components.

---

## 14. Confirmation: No Files Were Moved

- **Files moved:** 0

---

## 15. Confirmation: No Legacy Stubs Were Deleted

- **Stubs deleted:** 0
- `src/store/cartStore.js` remains intact and unchanged.

---

## 16. Confirmation: No Behavior Changed

- No business logic, UI, cart/order/checkout/payment/auth/session/persistence/hydration behavior changes
- Import-path and mock-path-only changes — same `useCartStore` Zustand store, same persist config, same hydration logic
- Mock structures unchanged — only the mock path (`@/store/cartStore` → `@/modules/cart`) was updated or the duplicate old mock was removed

---

## 17. Confirmation: Cart Behavior Is Unchanged

✅ The `useCartStore` is the exact same Zustand store from `src/modules/cart/stores/cartStore.js`. Only the import path changed. No cart implementation was modified. All cart actions (`addItem`, `removeItem`, `updateQuantity`, `clearCart`, `setCheckoutVendor`, `clearCheckoutVendor`, `clearVendorItems`, `getCheckoutItems`, `validateCart`) and getters (`getItemCount`, `getTotalQuantity`, `getSubtotal`, `getTotal`, `getTax`, `getVendorCount`) are unchanged.

---

## 18. Confirmation: Order Detail Behavior Is Unchanged

✅ `OrderDetail.jsx` (1700 lines) — only the import path on line 44 was changed. No logic inside the file was modified.

---

## 19. Confirmation: Checkout Behavior Is Unchanged

✅ No checkout-related code was modified beyond mock paths in test files.

---

## 20. Confirmation: Payment Behavior Is Unchanged

✅ No payment-related code was modified.

---

## 21. Confirmation: Auth/Session/Logout Behavior Is Unchanged

✅ No auth/session/logout code was modified. `authStore.test.js` and `sessionManagement.test.js` mock structures were preserved — only the mock path was updated.

---

## 22. Confirmation: Persistence Behavior Is Unchanged

✅ No Zustand persist configuration was modified. Persist key (`cart-storage`), version (4), and migration logic are unchanged.

---

## 23. Confirmation: Hydration Behavior Is Unchanged

✅ No hydration logic was modified. `useCartHydrated` is the exact same hook from the same source.

---

## 24. Confirmation: Supabase Queries Are Unchanged

✅ No Supabase queries were modified.

---

## 25. Confirmation: React Query Keys Are Unchanged

✅ No React Query keys were modified.

---

## 26. Confirmation: Routes Are Unchanged

✅ No routes were modified.

---

## 27. Confirmation: No Forbidden Deep Imports Were Introduced

✅ All new imports use `@/modules/cart` (root barrel). No deep imports like `@/modules/cart/stores/cartStore` were introduced in app code.

---

## 28. Confirmation: No Circular Dependencies Were Introduced

✅ `npm run check:circular` — 719 files processed, 0 circular dependencies found.

---

## 29. Documentation Updates

### Documents Updated
1. `docs/architecture/phase-6-31-cart-store-final-import-adoption-report.md` — this report (created)
2. `MODULAR_DEVELOPMENT_PLAN.md` — Phase 6.31 completion note + status line update

### Documents Checked But Not Changed
1. `ARCHITECTURE_GUIDE.md` — no references to `@/store/cartStore` found
2. `DEVELOPER_GUIDE.md` — no references to `@/store/cartStore` found
3. `src/modules/cart/README.md` — documents `cartStore.js` as cart module file; accurate, no change needed
4. `eslint.config.js` — no changes needed
5. `package.json` — no changes needed

### Documentation Still Needing Future Updates
- 14 outdated references from Phase 6.26 audit still remain across 8 module READMEs/placeholder files
- `src/modules/cart/README.md` still references `@/store/favoritesStore` in migration candidate table (noted in Phase 6.27)
- These should be addressed in a future documentation cleanup phase

---

## 30. Verification Results

### Lint & Type-Check
| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed (exit code 0) |
| `npm run type-check` | ✅ Passed (exit code 0) |

### Targeted Tests
| Test Suite | Tests | Result |
|---|---|---|
| `src/__tests__/stores/cartStore.test.js` | — | ✅ Passed |
| `src/features/marketplace/__tests__/useCart.test.js` | — | ✅ Passed |
| `src/store/__tests__/authStore.test.js` | — | ✅ Passed |
| `src/__tests__/stores/authStore.test.js` | — | ✅ Passed |
| `src/__tests__/integration/sessionManagement.test.js` | — | ✅ Passed |
| `src/__tests__/services/checkoutService.test.js` | — | ✅ Passed |
| `src/__tests__/pages/buyerOrdersRealtime.test.jsx` | — | ✅ Passed |
| `src/__tests__/pages/Checkout.test.js` | — | ✅ Passed |
| `src/__tests__/pages/CheckoutSimplified.i18n.test.jsx` | — | ✅ Passed |
| `src/__tests__/integration/checkoutFlow.test.js` | — | ✅ Passed |
| `src/__tests__/supabase/paypalCheckout.schema.test.js` | — | ✅ Passed |
| `src/__tests__/utils/checkoutCleanup.test.js` | — | ✅ Passed |
| `src/__tests__/hooks/useDarkMode.test.js` | — | ✅ Passed |
| `src/features/orders/__tests__/orderFlow.integration.test.js` | — | ✅ Passed |
| `src/features/marketplace/__tests__/addToCart.integration.test.js` | — | ✅ Passed |
| `src/features/checkout/__tests__/checkout.integration.test.js` | — | ✅ Passed |
| `src/__tests__/snapshots/darkMode.test.jsx` | — | ✅ Passed |
| `src/__tests__/snapshots/rtlComponents.test.jsx` | — | ✅ Passed |
| `src/__tests__/a11y/components.a11y.test.jsx` | — | ✅ Passed |
| **Total** | **294 passed, 2 todo, 9 snapshots** | **✅ 19 suites, all passed** |

### Final Checks
| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed (exit code 0) |
| `npm run type-check` | ✅ Passed (exit code 0) |
| `npm run build` | ✅ Passed (built in 2m 42s) |
| `npm run check:circular` | ✅ Passed (719 files, 0 circular dependencies) |

---

## 31. Whether All Class A/B/C Legacy Imports Are Now Migrated

✅ **YES — All Class A, B, and C legacy imports are now fully migrated.**

| Class | Path | Phase | Status |
|---|---|---|---|
| Class A | `@/utils/cartQuantity` | Phase 6.24 | ✅ Migrated |
| Class A | `@/services/reviewService` | Phase 6.25 | ✅ Migrated |
| Class B | `@/store/favoritesStore` | Phase 6.27 | ✅ Migrated |
| Class C | `@/services/coupons` | Phase 6.28 | ✅ Migrated |
| Class C | `@/services/minimumOrderService` | Phase 6.29 | ✅ Migrated |
| Class C | `@/hooks/useCheckoutPricing` | Phase 6.30 | ✅ Migrated |
| Class C | `@/store/cartStore` | Phase 6.31 | ✅ Migrated |

**Remaining legacy paths:** Only Class D stubs (5 paths with 0 active consumers, documented in Phase 6.26 audit).

---

## 32. Whether It Is Safe to Continue to Phase 6.32

**Yes.** All verification checks pass. The migration is complete and safe:
- 13 files changed (1 app import + 1 test import + 2 requires + 9 jest.mocks, all import-path/mock-path-only)
- 294 targeted tests pass
- 0 circular dependencies
- `@/store/cartStore` stub remains working
- `@/modules/cart` root barrel remains lightweight
- All Class A/B/C legacy imports are now fully migrated

---

## 33. Recommended Phase 6.32 Candidates

### Option A: Class D Stub Cleanup (low risk)
- 5 Class D stubs with 0 active consumers (documented in Phase 6.26):
  - `@/services/favorites` — 0 consumers
  - `@/services/loyalty` — 0 consumers
  - `@/services/apis/reviewsApi` — 1 indirect consumer (`src/services/api.js:22`)
  - `@/utils/checkoutCleanup` — 0 consumers
  - `@/hooks/queries/useReviewQueries` — 0 consumers
- Phase 6.32 could safely delete the 4 stubs with 0 consumers
- `@/services/apis/reviewsApi` requires updating `src/services/api.js:22` first

### Option B: Documentation Cleanup (low risk)
- 14 outdated references across 8 module READMEs/placeholder files
- `src/modules/cart/README.md` migration candidate table still references old paths
- Could update all documentation to reflect completed migrations

### Option C: `@/services/checkoutService` Inspection (medium risk)
- `CheckoutSimplified.jsx:27` imports `createCheckoutOrder` from `@/services/checkoutService`
- `checkout/api/index.js:14` re-exports from `@/services/checkoutService`
- This was NOT in the Phase 6.23 audit as a legacy stub — it may be a real service file
- Needs inspection to determine if it's a stub or a real implementation

**Recommendation:** Phase 6.32 should target Class D Stub Cleanup (Option A) — delete the 4 stubs with 0 consumers, update `src/services/api.js:22` for `reviewsApi`, and then update documentation (Option B).

---

## 34. Remaining Risks Before Deleting Stubs or Moving `checkoutService.js`

### Class D Stub Deletion
1. **`@/services/apis/reviewsApi`** — has 1 indirect consumer (`src/services/api.js:22`) that must be updated first
2. **14 outdated documentation references** across 8 files should be updated before or during stub deletion
3. **All Class A/B/C stubs** (`cartStore.js`, `favoritesStore.js`, `coupons.js`, `minimumOrderService.js`, `useCheckoutPricing.ts`, `cartQuantity.js`, `reviewService.js`) should NOT be deleted yet — they still serve as compatibility layers for any external code or future imports

### `@/services/checkoutService`
1. **NOT a legacy stub** — this is likely a real service file, not a compatibility re-export
2. `CheckoutSimplified.jsx:27` imports `createCheckoutOrder` from it
3. `checkout/api/index.js:14` re-exports from it
4. Should be inspected in a future phase to determine if migration to `@/modules/checkout` is appropriate
5. **Do NOT move or delete** without full inspection

### `CheckoutSimplified.jsx` (1696 lines)
1. ✅ **Zero legacy stub imports remain** (completed in Phase 6.30)
2. Still imports from non-stub service paths: `@/services/supabase`, `@/services/deliveryScheduleService`, `@/services/platformSettings`, `@/services/deliveryMatchingService`, `@/services/storeTypeService`, `@/services/trustScoreService`, `@/services/emailService`, `@/services/paymentService`, `@/services/checkoutService`
3. These are real service files, not legacy stubs — no migration needed unless a future phase targets them

### `OrderDetail.jsx` (1700 lines)
1. ✅ **Zero legacy stub imports remain** after this phase
2. Still imports from non-stub paths: `@/store/authStore`, `@/services/invoiceService`, `@/services/deliveries`, `@/services/ordersService`, `@/services/paymentService`, `@/services/driverLocationService`, `@/services/cancellationService`
3. These are real service files, not legacy stubs — no migration needed unless a future phase targets them
