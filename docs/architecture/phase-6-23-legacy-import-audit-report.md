# Phase 6.23 — Legacy Import Audit Report

**Phase:** 6.23 — Legacy Import Audit (discovery and reporting only)
**Date:** 2026-06-25
**Status:** ✅ Completed — audit-only, 0 source files changed

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` was read in full (614 lines) and strictly followed throughout this phase.

Key rules respected:
- ✅ No file movement, no business logic/UI/auth/cart/checkout/order/payment/delivery behavior changes
- ✅ No Supabase query, React Query key, database/RLS, Edge Function, or route changes
- ✅ No legacy path deletion, no mass import rewriting
- ✅ No circular dependencies (verified — 719 files, 0 circular)
- ✅ No forbidden deep module imports, no `any`, `@ts-ignore`, `@ts-expect-error`
- ✅ Audit-only — 0 source files modified

---

## 2. Confirmation: This Phase Was Audit-Only

No source files were changed. No imports were migrated. No stubs were deleted. The sole output is this report and updates to `MODULAR_DEVELOPMENT_PLAN.md`.

---

## 3. Files Inspected

### Rules & Configuration
- `.windsurfrules` (614 lines — read in full)
- `eslint.config.js` — ESLint config with `no-restricted-imports` rule
- `package.json` — project dependencies and scripts

### Phase Reports Read
- `docs/architecture/phase-6-22-module-readme-public-api-documentation-report.md`
- `docs/architecture/phase-6-21-auth-users-payments-root-barrel-cleanup-report.md`
- `docs/architecture/phase-6-20-store-type-service-test-contract-fix-report.md`
- `docs/architecture/phase-6-19-catalog-marketplace-ui-import-decoupling-report.md`

### Main Documentation Read
- `MODULAR_DEVELOPMENT_PLAN.md`
- `ARCHITECTURE_GUIDE.md`
- `DEVELOPER_GUIDE.md`

### Compatibility Stubs Inspected (12)
1. `src/store/cartStore.js` → `@/modules/cart` (Phase 6.11)
2. `src/store/favoritesStore.js` → `@/modules/cart` (Phase 6.8)
3. `src/services/favorites.js` → deep module paths (Phase 6.9)
4. `src/services/loyalty.js` → `@/modules/loyalty` (Phase 6.7)
5. `src/services/coupons.js` → `@/modules/coupons` (Phase 6.1)
6. `src/services/reviewService.js` → `@/modules/reviews` (Phase 6.1)
7. `src/services/apis/reviewsApi.js` → `@/modules/reviews` (Phase 6.1)
8. `src/services/minimumOrderService.js` → `@/modules/cart` (Phase 6.2)
9. `src/utils/cartQuantity.js` → `@/modules/cart` (Phase 6.3)
10. `src/utils/checkoutCleanup.js` → `@/modules/checkout` (Phase 6.3)
11. `src/hooks/useCheckoutPricing.ts` → `@/modules/checkout` (Phase 6.3)
12. `src/hooks/queries/useReviewQueries.js` → `@/modules/reviews` (Phase 6.1)

### Legacy Aggregator (not a module-migration stub)
- `src/services/api.js` — Phase 4.7 re-export aggregator for split API files. Not part of this audit's migration scope.

---

## 4. Remaining Imports by Path

### 4.1 `@/store/cartStore`

**Stub:** `src/store/cartStore.js` → `@/modules/cart`

**App imports:**
- `src/pages/OrderDetail.jsx:44` — `import { useCartStore } from '@/store/cartStore'`

**Test imports:**
- `src/features/marketplace/__tests__/addToCart.integration.test.js:83` — `import { useCartStore } from '@/store/cartStore'`

**jest.mock():**
- `src/__tests__/integration/sessionManagement.test.js:85`
- `src/__tests__/pages/buyerOrdersRealtime.test.jsx:34`
- `src/__tests__/services/checkoutService.test.js:10`
- `src/__tests__/snapshots/rtlComponents.test.jsx:109`
- `src/__tests__/a11y/components.a11y.test.jsx:42`
- `src/store/__tests__/authStore.test.js:102`
- `src/features/orders/__tests__/orderFlow.integration.test.js:53`
- `src/__tests__/snapshots/darkMode.test.jsx:93`
- `src/features/checkout/__tests__/checkout.integration.test.js:89`

**require():**
- `src/features/orders/__tests__/orderFlow.integration.test.js:411`
- `src/features/marketplace/__tests__/useCart.test.js:60`

**Totals:** 1 app, 1 test, 9 mocks, 2 requires

---

### 4.2 `@/store/favoritesStore`

**Stub:** `src/store/favoritesStore.js` → `@/modules/cart`

**App imports:**
- `src/components/ui/ProductCard.jsx:6` — `import { useFavoritesStore } from '@/store/favoritesStore'`
- `src/store/authSessionStore.js:6` — `import { useFavoritesStore } from '@/store/favoritesStore'`
- `src/services/authActionsService.js:7` — `import { useFavoritesStore } from '@/store/favoritesStore'`
- `src/pages/Favorites.jsx:5` — `import { useFavoritesStore } from '@/store/favoritesStore'`

**jest.mock():**
- `src/__tests__/integration/sessionManagement.test.js:97`
- `src/store/__tests__/authStore.test.js:116`
- `src/__tests__/a11y/components.a11y.test.jsx:60`
- `src/__tests__/snapshots/rtlComponents.test.jsx:143`
- `src/__tests__/snapshots/darkMode.test.jsx:141`
- `src/features/marketplace/__tests__/addToCart.integration.test.js:59`

**Totals:** 4 app, 0 test, 6 mocks, 0 requires

---

### 4.3 `@/stores/cartStore` and `@/stores/favoritesStore`

**No stubs. No imports. No mocks. No requires.** These paths do not exist in the codebase.

---

### 4.4 `@/services/favorites`

**Stub:** `src/services/favorites.js` → deep module paths (with `eslint-disable`)

**Totals:** 0 app, 0 test, 0 mocks, 0 requires. **Stub has zero consumers.**

---

### 4.5 `@/services/loyalty`

**Stub:** `src/services/loyalty.js` → `@/modules/loyalty`

**Totals:** 0 app, 0 test, 0 mocks, 0 requires. **Stub has zero consumers.**

---

### 4.6 `@/services/coupons`

**Stub:** `src/services/coupons.js` → `@/modules/coupons`

**App imports:**
- `src/pages/CheckoutSimplified.jsx:16` — `import { couponsApi } from '@/services/coupons'`

**Module-internal imports:**
- `src/modules/checkout/api/index.js:23` — re-exports couponsApi, normalizeCoupon, etc.

**Totals:** 1 app + 1 module-internal, 0 test, 0 mocks, 0 requires

---

### 4.7 `@/services/reviewService`

**Stub:** `src/services/reviewService.js` → `@/modules/reviews`

**App imports:**
- `src/pages/OrderDetail.jsx:41` — `import reviewService from '@/services/reviewService'`
- `src/pages/vendor/Reviews.jsx:5` — `import reviewService from '@/services/reviewService'`
- `src/pages/buyer/Orders.jsx:21` — `import reviewService from '@/services/reviewService'`
- `src/pages/ProductDetail.jsx:9` — `import reviewService from '@/services/reviewService'`

**jest.mock():**
- `src/__tests__/pages/buyerOrdersRealtime.test.jsx:73`
- `src/features/orders/__tests__/orderFlow.integration.test.js:151`

**Totals:** 4 app, 0 test, 2 mocks, 0 requires

---

### 4.8 `@/services/apis/reviewsApi`

**Stub:** `src/services/apis/reviewsApi.js` → `@/modules/reviews`

**Totals:** 0 app, 0 test, 0 mocks, 0 requires. **Stub has zero direct consumers** (only accessed via `@/services/api` aggregator).

---

### 4.9 `@/services/minimumOrderService`

**Stub:** `src/services/minimumOrderService.js` → `@/modules/cart`

**App imports:**
- `src/pages/CheckoutSimplified.jsx:23` — `import { buildMinimumOrderMessage, evaluateVendorMinimumOrders } from '@/services/minimumOrderService'`
- `src/pages/Cart.jsx:22` — `import { buildMinimumOrderMessage, evaluateVendorMinimumOrders } from '@/services/minimumOrderService'`

**Module-internal imports:**
- `src/modules/checkout/api/index.js:29` — re-exports buildMinimumOrderMessage, evaluateVendorMinimumOrders

**jest.mock():**
- `src/__tests__/snapshots/rtlComponents.test.jsx:176`

**Totals:** 2 app + 1 module-internal, 0 test, 1 mock, 0 requires

---

### 4.10 `@/utils/cartQuantity`

**Stub:** `src/utils/cartQuantity.js` → `@/modules/cart`

**App imports:**
- `src/pages/Cart.jsx:28` — formatQuantity, getQuantityStep, isDecimalQuantityUnit, normalizeQuantity
- `src/pages/ProductDetail.jsx:14` — formatQuantity, getQuantityStep, normalizeQuantity

**require():**
- `src/__tests__/utils/cartQuantity.test.js:6`

**Totals:** 2 app, 0 test, 0 mocks, 1 require

---

### 4.11 `@/utils/checkoutCleanup`

**Stub:** `src/utils/checkoutCleanup.js` → `@/modules/checkout`

**Totals:** 0 app, 0 test, 0 mocks, 0 requires. **Stub has zero consumers.**

---

### 4.12 `@/hooks/useCheckoutPricing`

**Stub:** `src/hooks/useCheckoutPricing.ts` → `@/modules/checkout`

**App imports:**
- `src/pages/CheckoutSimplified.jsx:28` — `import { useCheckoutPricing } from '@/hooks/useCheckoutPricing'`

**Totals:** 1 app, 0 test, 0 mocks, 0 requires

---

### 4.13 `@/hooks/queries/useReviewQueries` (additional stub found)

**Stub:** `src/hooks/queries/useReviewQueries.js` → `@/modules/reviews`

**Totals:** 0 app, 0 test, 0 mocks, 0 requires. **Stub has zero consumers.**

---

## 5. Summary Table — Remaining Imports by Path

| Old Path | App | Test | Mock | Require | Dyn Import |
|---|---|---|---|---|---|
| `@/store/cartStore` | 1 | 1 | 9 | 2 | 0 |
| `@/store/favoritesStore` | 4 | 0 | 6 | 0 | 0 |
| `@/stores/cartStore` | 0 | 0 | 0 | 0 | 0 |
| `@/stores/favoritesStore` | 0 | 0 | 0 | 0 | 0 |
| `@/services/favorites` | 0 | 0 | 0 | 0 | 0 |
| `@/services/loyalty` | 0 | 0 | 0 | 0 | 0 |
| `@/services/coupons` | 1 | 0 | 0 | 0 | 0 |
| `@/services/reviewService` | 4 | 0 | 2 | 0 | 0 |
| `@/services/apis/reviewsApi` | 0 | 0 | 0 | 0 | 0 |
| `@/services/minimumOrderService` | 2 | 0 | 1 | 0 | 0 |
| `@/utils/cartQuantity` | 2 | 0 | 0 | 1 | 0 |
| `@/utils/checkoutCleanup` | 0 | 0 | 0 | 0 | 0 |
| `@/hooks/useCheckoutPricing` | 1 | 0 | 0 | 0 | 0 |
| `@/hooks/queries/useReviewQueries` | 0 | 0 | 0 | 0 | 0 |
| **Total** | **15** | **1** | **18** | **3** | **0** |

---

## 6. Risk Classification Table

| # | Old Path | New Path | App | Mock | Req | Class | Risk | Recommended Phase | Reason |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `@/store/cartStore` | `@/modules/cart` | 1 | 9 | 2 | **C** | High | 6.24+ | `OrderDetail.jsx` (1700 lines) imports `useCartStore` — high-risk page with payment/order/delivery interactions. 9 jest.mocks + 2 requires in tests make migration complex. |
| 2 | `@/store/favoritesStore` | `@/modules/cart` | 4 | 6 | 0 | **B** | Medium | 6.25 | 4 app imports (ProductCard, authSessionStore, authActionsService, Favorites). 6 jest.mocks rely on old path. `authSessionStore` and `authActionsService` are auth-adjacent — need care. Mocks must be updated atomically with app imports. |
| 3 | `@/services/favorites` | `@/modules/cart` + others | 0 | 0 | 0 | **D** | None | Future cleanup | Zero consumers. Stub can be removed in a future cleanup phase. |
| 4 | `@/services/loyalty` | `@/modules/loyalty` | 0 | 0 | 0 | **D** | None | Future cleanup | Zero consumers. Stub can be removed in a future cleanup phase. |
| 5 | `@/services/coupons` | `@/modules/coupons` | 1 | 0 | 0 | **C** | Medium-High | 6.26+ | `CheckoutSimplified.jsx` (1695 lines) imports `couponsApi`. Also `modules/checkout/api/index.js` re-exports from this stub. Checkout-adjacent = high behavioral risk. Must update both app and module-internal import together. |
| 6 | `@/services/reviewService` | `@/modules/reviews` | 4 | 2 | 0 | **A** | Low-Medium | 6.24 | 4 app imports in pages (OrderDetail, vendor/Reviews, buyer/Orders, ProductDetail). Simple import-path-only migration. 2 jest.mocks need updating. `OrderDetail.jsx` is high-risk but the `reviewService` import itself is simple (default import). |
| 7 | `@/services/apis/reviewsApi` | `@/modules/reviews` | 0 | 0 | 0 | **D** | None | Future cleanup | Zero direct consumers. Only accessed via `@/services/api` aggregator. Stub can be removed in a future cleanup phase. |
| 8 | `@/services/minimumOrderService` | `@/modules/cart` | 2 | 1 | 0 | **C** | Medium-High | 6.26+ | `CheckoutSimplified.jsx` (1695 lines) and `Cart.jsx` (1074 lines) import from this stub. Also `modules/checkout/api/index.js` re-exports from it. 1 jest.mock. Checkout/cart-adjacent = behavioral risk. |
| 9 | `@/utils/cartQuantity` | `@/modules/cart` | 2 | 0 | 1 | **A** | Low | 6.24 | 2 app imports (Cart.jsx, ProductDetail.jsx). Simple utility functions. 1 require in test. No mocks. Straightforward migration. |
| 10 | `@/utils/checkoutCleanup` | `@/modules/checkout` | 0 | 0 | 0 | **D** | None | Future cleanup | Zero consumers. Stub can be removed in a future cleanup phase. |
| 11 | `@/hooks/useCheckoutPricing` | `@/modules/checkout` | 1 | 0 | 0 | **C** | Medium-High | 6.26+ | `CheckoutSimplified.jsx` (1695 lines) imports `useCheckoutPricing`. Checkout-adjacent = behavioral risk. Only 1 import but in a high-risk file. |
| 12 | `@/hooks/queries/useReviewQueries` | `@/modules/reviews` | 0 | 0 | 0 | **D** | None | Future cleanup | Zero consumers. Stub can be removed in a future cleanup phase. |

---

## 7. Classification Summary

### Class A — Safe import adoption candidate (2 paths)
| Path | App imports | Mocks | Requires | Risk |
|---|---|---|---|---|
| `@/services/reviewService` | 4 | 2 | 0 | Low-Medium |
| `@/utils/cartQuantity` | 2 | 0 | 1 | Low |

**Total: 6 app imports, 2 mocks, 1 require** — simple import-path-only migration, low-risk files, tests easy to update.

### Class B — Keep temporarily (1 path)
| Path | App imports | Mocks | Risk |
|---|---|---|---|
| `@/store/favoritesStore` | 4 | 6 | Medium |

**Total: 4 app imports, 6 mocks** — Jest mocks still rely on old path. `authSessionStore` and `authActionsService` are auth-adjacent. Migration requires updating 6 mocks atomically.

### Class C — Needs dedicated analysis (4 paths)
| Path | App imports | Mocks | Requires | Risk |
|---|---|---|---|---|
| `@/store/cartStore` | 1 | 9 | 2 | High |
| `@/services/coupons` | 1 | 0 | 0 | Medium-High |
| `@/services/minimumOrderService` | 2 | 1 | 0 | Medium-High |
| `@/hooks/useCheckoutPricing` | 1 | 0 | 0 | Medium-High |

**Total: 5 app imports, 10 mocks, 2 requires** — `OrderDetail.jsx` (1700 lines) and `CheckoutSimplified.jsx` (1695 lines) are high-risk files. Checkout/order/payment interactions. Complex mocks. Need dedicated phases.

### Class D — Candidate for eventual legacy stub removal (5 paths)
| Path | Consumers | Risk |
|---|---|---|
| `@/services/favorites` | 0 | None |
| `@/services/loyalty` | 0 | None |
| `@/services/apis/reviewsApi` | 0 (only via aggregator) | None |
| `@/utils/checkoutCleanup` | 0 | None |
| `@/hooks/queries/useReviewQueries` | 0 | None |

**Total: 5 stubs with zero consumers** — candidates for future cleanup. Keep stubs for now.

---

## 8. Recommended Migration Order

### Phase 6.24 — Low-risk import adoption (Class A)
1. **`@/utils/cartQuantity`** → `@/modules/cart` — 2 app imports (Cart.jsx, ProductDetail.jsx), 1 test require. Simplest migration.
2. **`@/services/reviewService`** → `@/modules/reviews` — 4 app imports, 2 jest.mocks. Simple default import migration. Update mocks in `buyerOrdersRealtime.test.jsx` and `orderFlow.integration.test.js`.

### Phase 6.25 — favoritesStore import adoption (Class B)
3. **`@/store/favoritesStore`** → `@/modules/cart` — 4 app imports, 6 jest.mocks. Must update all 6 mocks atomically. Care with `authSessionStore.js` and `authActionsService.js` (auth-adjacent).

### Phase 6.26+ — Checkout-adjacent import adoption (Class C)
4. **`@/services/coupons`** → `@/modules/coupons` — 1 app import (CheckoutSimplified.jsx), 1 module-internal (checkout/api/index.js). Must update both together.
5. **`@/services/minimumOrderService`** → `@/modules/cart` — 2 app imports (CheckoutSimplified.jsx, Cart.jsx), 1 module-internal (checkout/api/index.js), 1 jest.mock.
6. **`@/hooks/useCheckoutPricing`** → `@/modules/checkout` — 1 app import (CheckoutSimplified.jsx). Only after coupons and minimumOrderService are migrated.

### Phase 6.27+ — OrderDetail.jsx cartStore migration (Class C — highest risk)
7. **`@/store/cartStore`** → `@/modules/cart` — 1 app import (OrderDetail.jsx, 1700 lines), 9 jest.mocks, 2 requires. Most complex migration. Must update all 11 test references atomically. Dedicated phase required.

### Future cleanup — Stub removal (Class D)
8. Remove stubs with zero consumers: `@/services/favorites`, `@/services/loyalty`, `@/services/apis/reviewsApi`, `@/utils/checkoutCleanup`, `@/hooks/queries/useReviewQueries`. Only after confirming no new consumers appear.

---

## 9. Which Imports Should NOT Be Migrated Yet

| Path | Reason |
|---|---|
| `@/store/cartStore` (in OrderDetail.jsx) | **High risk.** `OrderDetail.jsx` is 1700 lines with payment, order, delivery, review, invoice, and cancellation interactions. 9 jest.mocks + 2 requires depend on old path. Needs dedicated analysis phase. |
| `@/services/coupons` (in CheckoutSimplified.jsx) | **Medium-High risk.** `CheckoutSimplified.jsx` is 1695 lines with checkout/payment/delivery interactions. Also has module-internal dependency in `checkout/api/index.js`. |
| `@/services/minimumOrderService` (in CheckoutSimplified.jsx + Cart.jsx) | **Medium-High risk.** Both files are checkout/cart-adjacent. Module-internal dependency in `checkout/api/index.js`. 1 jest.mock. |
| `@/hooks/useCheckoutPricing` (in CheckoutSimplified.jsx) | **Medium-High risk.** Checkout-adjacent hook in a 1695-line file. Should be migrated together with other CheckoutSimplified.jsx legacy imports. |
| `@/store/favoritesStore` (in authSessionStore + authActionsService) | **Medium risk.** Auth-adjacent files. 6 jest.mocks must be updated atomically. Needs careful testing of auth/session flows. |

---

## 10. Legacy Stubs with Zero Remaining Imports

| # | Stub | Path | Consumers |
|---|---|---|---|
| 1 | `src/services/favorites.js` | `@/services/favorites` | 0 |
| 2 | `src/services/loyalty.js` | `@/services/loyalty` | 0 |
| 3 | `src/services/apis/reviewsApi.js` | `@/services/apis/reviewsApi` | 0 (only via `@/services/api` aggregator) |
| 4 | `src/utils/checkoutCleanup.js` | `@/utils/checkoutCleanup` | 0 |
| 5 | `src/hooks/queries/useReviewQueries.js` | `@/hooks/queries/useReviewQueries` | 0 |

**These 5 stubs are candidates for eventual removal. Keep them for now unless explicitly planned in a future cleanup phase.**

---

## 11. Legacy Stubs That Must Remain for Now

| # | Stub | Reason |
|---|---|---|
| 1 | `src/store/cartStore.js` | 1 app import + 9 mocks + 2 requires still depend on it |
| 2 | `src/store/favoritesStore.js` | 4 app imports + 6 mocks still depend on it |
| 3 | `src/services/coupons.js` | 1 app import + 1 module-internal import still depend on it |
| 4 | `src/services/reviewService.js` | 4 app imports + 2 mocks still depend on it |
| 5 | `src/services/minimumOrderService.js` | 2 app imports + 1 module-internal import + 1 mock still depend on it |
| 6 | `src/utils/cartQuantity.js` | 2 app imports + 1 require still depend on it |
| 7 | `src/hooks/useCheckoutPricing.ts` | 1 app import still depends on it |

---

## 12. Confirmation: No Source Files Were Changed

- **Source files modified:** 0
- **Files created:** 1 (this report)
- **Files modified:** 1 (`MODULAR_DEVELOPMENT_PLAN.md` — status update only)

---

## 13. Confirmation: No Files Were Moved

- **Files moved:** 0

---

## 14. Confirmation: No Legacy Paths Were Deleted

- **Stubs deleted:** 0
- **Legacy paths removed:** 0

---

## 15. Confirmation: No Behavior Changed

- No business logic, UI, auth/session, cart/favorites, checkout/order/payment/delivery behavior changes

---

## 16. Confirmation: No Supabase Queries Changed

No Supabase queries were modified.

---

## 17. Confirmation: No React Query Keys Changed

No React Query keys were modified.

---

## 18. Confirmation: Routes Are Unchanged

No routes were modified.

---

## 19. Confirmation: No Forbidden Deep Imports Introduced

No deep module imports were introduced. This was an audit-only phase with no code changes.

---

## 20. Confirmation: No Circular Dependencies Introduced

`npm run check:circular` — 719 files processed, 0 circular dependencies found.

---

## 21. Documentation Updates

### Documents Updated
1. `docs/architecture/phase-6-23-legacy-import-audit-report.md` — this report (created)
2. `MODULAR_DEVELOPMENT_PLAN.md` — Phase 6.23 completion note + status line update

### Documents Checked But Not Changed
1. `ARCHITECTURE_GUIDE.md` — already updated in Phase 6.22, no changes needed
2. `DEVELOPER_GUIDE.md` — no outdated references found
3. All module READMEs — already updated in Phase 6.22

### Documentation Still Needing Future Updates
- `ARCHITECTURE_GUIDE.md` — overall architecture description still references old `src/features/` structure. Full rewrite deferred to future phase.
- Module READMEs — may need updates after Phase 6.24+ migrations change import paths.

---

## 22. Verification Results

| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed (exit code 0) |
| `npm run type-check` | ✅ Passed (exit code 0) |
| `npm run build` | ✅ Passed (built in 2m 42s) |
| `npm run check:circular` | ✅ Passed (719 files, 0 circular dependencies) |

---

## 23. Is It Safe to Continue to Phase 6.24?

**Yes.** All verification checks pass. The audit is complete. No source code was changed. The recommended Phase 6.24 targets are low-risk Class A migrations (`@/utils/cartQuantity` and `@/services/reviewService`).

---

## 24. Recommended Phase 6.24 Candidates

1. **`@/utils/cartQuantity`** → `@/modules/cart` — 2 app imports (Cart.jsx:28, ProductDetail.jsx:14), 1 test require (cartQuantity.test.js:6). Simplest migration. No mocks. Low risk.

2. **`@/services/reviewService`** → `@/modules/reviews` — 4 app imports (OrderDetail.jsx:41, vendor/Reviews.jsx:5, buyer/Orders.jsx:21, ProductDetail.jsx:9), 2 jest.mocks (buyerOrdersRealtime.test.jsx:73, orderFlow.integration.test.js:151). Simple default import. Update 2 mocks.

**Recommended approach:** Migrate `@/utils/cartQuantity` first (simplest), then `@/services/reviewService`. Run targeted tests after each migration.

---

## 25. Remaining Risks Before Moving `checkoutService.js` or Larger Services

1. **`CheckoutSimplified.jsx` (1695 lines)** — Contains 4 legacy imports: `@/services/coupons`, `@/services/minimumOrderService`, `@/hooks/useCheckoutPricing`, plus `@/services/checkoutService`. Migrating these requires a coordinated phase. Recommend migrating all 4 in a single Phase 6.26 to avoid partial states.

2. **`OrderDetail.jsx` (1700 lines)** — Contains 2 legacy imports: `@/store/cartStore` and `@/services/reviewService`. The `reviewService` import is simple (Class A). The `cartStore` import is high-risk (Class C) with 9 mocks + 2 requires. Recommend migrating `reviewService` in Phase 6.24 and `cartStore` in a dedicated Phase 6.27.

3. **`modules/checkout/api/index.js`** — Re-exports from `@/services/coupons` and `@/services/minimumOrderService`. When migrating these, must update the module-internal imports to point to `@/modules/coupons` and `@/modules/cart` respectively. This creates a chain: app import + module-internal import must be updated together.

4. **`authSessionStore.js` and `authActionsService.js`** — Both import `@/store/favoritesStore`. These are auth-adjacent. Migration in Phase 6.25 must verify that auth/session flows are not broken. Run `sessionManagement.test.js` and `authStore.test.js` after migration.

5. **Test mock atomicity** — For `@/store/cartStore` (9 mocks) and `@/store/favoritesStore` (6 mocks), all mocks must be updated in the same commit as the app import changes. Partial updates will cause test failures.

6. **`@/services/favorites.js` stub** — Uses deep module paths with `eslint-disable` to avoid circular dependencies. The stub itself has zero consumers. Safe to remove in a future cleanup phase, but removal should be verified with `npm run check:circular`.
