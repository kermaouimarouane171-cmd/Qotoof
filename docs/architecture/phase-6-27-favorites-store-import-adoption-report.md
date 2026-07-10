# Phase 6.27 — Favorites Store Import Adoption Report

**Phase:** 6.27 — Safe Import Adoption for `@/store/favoritesStore` (Class B)
**Date:** 2026-06-25
**Status:** ✅ Completed — 10 files changed (4 app imports + 6 test mock updates), 0 behavior changes

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` was read in full (614 lines) and strictly followed throughout this phase.

Key rules respected:
- ✅ No file movement
- ✅ No business logic, UI, favorites/cart/auth/session behavior changes
- ✅ No Supabase query, React Query key, database/RLS, Edge Function, or route changes
- ✅ No legacy stub deletion
- ✅ No mass import rewriting (only 10 targeted files)
- ✅ No circular dependencies (verified — 719 files, 0 circular)
- ✅ No forbidden deep module imports introduced
- ✅ No `any`, `@ts-ignore`, `@ts-expect-error`
- ✅ Favorites, cart, auth/session/logout, persistence, hydration behavior unchanged

---

## 2. Confirmation: This Phase Only Targeted `@/store/favoritesStore`

✅ Only `@/store/favoritesStore` was migrated. No other paths were touched:
- ❌ Not touched: `@/store/cartStore`
- ❌ Not touched: `@/services/coupons`
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
- `docs/architecture/phase-6-26-class-d-stub-removal-readiness-audit-report.md`
- `docs/architecture/phase-6-23-legacy-import-audit-report.md`
- `docs/architecture/phase-6-8-favorites-store-file-movement-report.md`

### Cart Module Files Inspected
- `src/store/favoritesStore.js` — compatibility stub (re-exports `useFavoritesStore` from `@/modules/cart`)
- `src/modules/cart/stores/favoritesStore.js` — actual implementation (206 lines, Zustand + persist)
- `src/modules/cart/stores/index.js` — stores barrel (exports `useCartStore`, `useCartHydrated`, `useFavoritesStore`)
- `src/modules/cart/index.js` — root barrel (exports `* from './api'`, `./domain`, `./hooks`, `./stores`, `./utils`)
- `src/modules/cart/README.md` — module documentation

### Importing Files Inspected
- `src/pages/Favorites.jsx` — line 5, named import `useFavoritesStore`
- `src/components/ui/ProductCard.jsx` — line 6, named import `useFavoritesStore`
- `src/store/authSessionStore.js` — line 6, named import `useFavoritesStore`
- `src/services/authActionsService.js` — line 7, named import `useFavoritesStore`

### Test Files with Mocks Inspected
- `src/__tests__/a11y/components.a11y.test.jsx` — mocks both `@/modules/cart` and `@/store/favoritesStore`
- `src/__tests__/snapshots/rtlComponents.test.jsx` — mocks both `@/modules/cart` and `@/store/favoritesStore`
- `src/__tests__/snapshots/darkMode.test.jsx` — mocks both `@/modules/cart` and `@/store/favoritesStore`
- `src/__tests__/integration/sessionManagement.test.js` — mocks both `@/modules/cart` and `@/store/favoritesStore`
- `src/store/__tests__/authStore.test.js` — mocks both `@/modules/cart` and `@/store/favoritesStore`
- `src/features/marketplace/__tests__/addToCart.integration.test.js` — mocks only `@/store/favoritesStore` (uses real cartStore)

### Main Documentation Read
- `MODULAR_DEVELOPMENT_PLAN.md`
- `ARCHITECTURE_GUIDE.md`
- `DEVELOPER_GUIDE.md`

---

## 4. Files Changed

| # | File | Line(s) | Change |
|---|---|---|---|
| 1 | `src/pages/Favorites.jsx` | 5 | `import { useFavoritesStore } from '@/store/favoritesStore'` → `import { useFavoritesStore } from '@/modules/cart'` |
| 2 | `src/components/ui/ProductCard.jsx` | 6 | Same change |
| 3 | `src/store/authSessionStore.js` | 6 | Same change |
| 4 | `src/services/authActionsService.js` | 7 | Same change |
| 5 | `src/__tests__/a11y/components.a11y.test.jsx` | 51–62 | Merged `useFavoritesStore` mock into `@/modules/cart` mock; removed `@/store/favoritesStore` mock |
| 6 | `src/__tests__/snapshots/rtlComponents.test.jsx` | 118–148 | Merged `useFavoritesStore` mock into `@/modules/cart` mock; removed `@/store/favoritesStore` mock |
| 7 | `src/__tests__/snapshots/darkMode.test.jsx` | 100–146 | Merged `useFavoritesStore` mock into `@/modules/cart` mock; removed `@/store/favoritesStore` mock |
| 8 | `src/__tests__/integration/sessionManagement.test.js` | 91–101 | Merged `useFavoritesStore` mock into `@/modules/cart` mock; removed `@/store/favoritesStore` mock |
| 9 | `src/store/__tests__/authStore.test.js` | 109–121 | Merged `useFavoritesStore` mock into `@/modules/cart` mock; removed `@/store/favoritesStore` mock |
| 10 | `src/features/marketplace/__tests__/addToCart.integration.test.js` | 58–72 | Changed mock from `@/store/favoritesStore` to `@/modules/cart` with `jest.requireActual` to preserve real `useCartStore` |

**Total: 10 files changed (4 app imports + 6 test mock updates), all import-path-only.**

---

## 5. Imports Migrated

| # | File | Old Import | New Import | Notes |
|---|---|---|---|---|
| 1 | `src/pages/Favorites.jsx:5` | `import { useFavoritesStore } from '@/store/favoritesStore'` | `import { useFavoritesStore } from '@/modules/cart'` | Named → named (same shape) |
| 2 | `src/components/ui/ProductCard.jsx:6` | `import { useFavoritesStore } from '@/store/favoritesStore'` | `import { useFavoritesStore } from '@/modules/cart'` | Named → named |
| 3 | `src/store/authSessionStore.js:6` | `import { useFavoritesStore } from '@/store/favoritesStore'` | `import { useFavoritesStore } from '@/modules/cart'` | Named → named |
| 4 | `src/services/authActionsService.js:7` | `import { useFavoritesStore } from '@/store/favoritesStore'` | `import { useFavoritesStore } from '@/modules/cart'` | Named → named |

---

## 6. Imports Intentionally Skipped

| # | Location | Reason |
|---|---|---|
| 1 | `src/store/favoritesStore.js` (stub itself) | Intentionally kept unchanged — compatibility stub must remain |

**No other imports of `@/store/favoritesStore` were found.** All 4 app imports were migrated.

---

## 7. Jest Mocks Inspected

| # | File | Old Mock Path | Mock Shape | Also Mocks `@/modules/cart`? |
|---|---|---|---|---|
| 1 | `components.a11y.test.jsx:60` | `@/store/favoritesStore` | `{ useFavoritesStore: jest.fn(() => mockFavoritesState) }` | Yes (line 51) |
| 2 | `rtlComponents.test.jsx:143` | `@/store/favoritesStore` | `{ useFavoritesStore: () => ({ toggleProduct, isFavorited }) }` | Yes (line 118) |
| 3 | `darkMode.test.jsx:141` | `@/store/favoritesStore` | `{ useFavoritesStore: () => ({ toggleProduct, isFavorited }) }` | Yes (line 100) |
| 4 | `sessionManagement.test.js:97` | `@/store/favoritesStore` | `{ useFavoritesStore: { setState } }` | Yes (line 91) |
| 5 | `authStore.test.js:116` | `@/store/favoritesStore` | `{ useFavoritesStore: { getState, setState } }` | Yes (line 109) |
| 6 | `addToCart.integration.test.js:59` | `@/store/favoritesStore` | `{ useFavoritesStore: jest.fn((selector) => ...) }` | No (uses real cartStore) |

---

## 8. Jest Mocks Updated

| # | File | Change | Reason |
|---|---|---|---|
| 1 | `components.a11y.test.jsx` | Merged `useFavoritesStore: jest.fn(() => mockFavoritesState)` into `@/modules/cart` mock; removed `@/store/favoritesStore` mock | App imports now use `@/modules/cart` — mock must intercept the new path |
| 2 | `rtlComponents.test.jsx` | Merged `useFavoritesStore: () => ({ toggleProduct, isFavorited })` into `@/modules/cart` mock; removed `@/store/favoritesStore` mock | Same |
| 3 | `darkMode.test.jsx` | Merged `useFavoritesStore: () => ({ toggleProduct, isFavorited })` into `@/modules/cart` mock; removed `@/store/favoritesStore` mock | Same |
| 4 | `sessionManagement.test.js` | Merged `useFavoritesStore: { setState }` into `@/modules/cart` mock; removed `@/store/favoritesStore` mock | Same |
| 5 | `authStore.test.js` | Merged `useFavoritesStore: { getState, setState }` into `@/modules/cart` mock; removed `@/store/favoritesStore` mock | Same |
| 6 | `addToCart.integration.test.js` | Changed mock path from `@/store/favoritesStore` to `@/modules/cart` using `jest.requireActual` to preserve real `useCartStore` while overriding `useFavoritesStore` | Test uses real cartStore — `requireActual` preserves all real exports except `useFavoritesStore` |

---

## 9. Jest Mocks Intentionally Kept and Why

**No `@/store/favoritesStore` mocks were kept.** All 6 were updated because all 4 app files that import `useFavoritesStore` were migrated to `@/modules/cart`. No old-path consumers remain, so no old-path mocks are needed.

---

## 10. Whether Any Tests/Mocks Were Updated

Yes — 6 test files were updated:
- 5 files: `useFavoritesStore` mock merged into existing `@/modules/cart` mock, `@/store/favoritesStore` mock removed
- 1 file (`addToCart.integration.test.js`): mock path changed with `jest.requireActual` pattern

**No test expectations were changed.** Only mock interception paths and structures were updated.

---

## 11. Confirmation: `@/store/favoritesStore` Still Works as Compatibility Stub

✅ `src/store/favoritesStore.js` was NOT modified. It remains a compatibility re-export stub:
```js
export { useFavoritesStore } from '@/modules/cart'
```

Any remaining code that still imports from `@/store/favoritesStore` will continue to work.

---

## 12. Confirmation: `@/modules/cart` Exports the Needed Favorites Symbols

✅ The cart module root barrel (`src/modules/cart/index.js`) exports `* from './stores'`, which exports:
- `useCartStore` ✅
- `useCartHydrated` ✅
- `useFavoritesStore` ✅

The `useFavoritesStore` export chain: `@/modules/cart` → `./stores` → `./favoritesStore` → `useFavoritesStore`

---

## 13. Confirmation: `@/modules/cart` Remains Lightweight

✅ The cart root barrel exports only: `./api`, `./domain`, `./hooks`, `./stores`, `./utils`. No UI exports. No `export * from './ui'`. No eager loading of Cart.jsx/Favorites.jsx → Map.jsx → Leaflet.

---

## 14. Confirmation: No Files Were Moved

- **Files moved:** 0

---

## 15. Confirmation: No Legacy Stubs Were Deleted

- **Stubs deleted:** 0
- `src/store/favoritesStore.js` remains intact and unchanged.

---

## 16. Confirmation: No Behavior Changed

- No business logic, UI, favorites/cart/auth/session behavior changes
- Import-path-only changes — same `useFavoritesStore` Zustand store, same persist config, same methods
- Mock structure changes only affect test interception, not test expectations

---

## 17. Confirmation: Favorites Behavior Is Unchanged

✅ The `useFavoritesStore` is the exact same Zustand store from `src/modules/cart/stores/favoritesStore.js`. Only the import path changed. No store implementation was modified. All favorites operations (`loadFavorites`, `toggleProduct`, `isFavorited`, `getFavoriteProducts`, `getFavoriteVendors`, `getCount`, `clearFavorites`) are unchanged.

---

## 18. Confirmation: Cart Behavior Is Unchanged

✅ No cart-related code was modified. `useCartStore` imports were not touched.

---

## 19. Confirmation: Auth/Session/Logout Behavior Is Unchanged

✅ `authSessionStore.js` and `authActionsService.js` had only their `useFavoritesStore` import path changed. The `clearFavorites()` call on logout is the same function from the same store. No auth/session/logout logic was modified.

---

## 20. Confirmation: Persistence Behavior Is Unchanged

✅ The Zustand `persist` middleware configuration is unchanged:
- Persist key: `'favorites-storage'` — unchanged
- `partialize`: serializes `favoriteIds` (as Array) and `userId` — unchanged
- `onRehydrateStorage`: converts `favoriteIds` Array back to Set — unchanged

---

## 21. Confirmation: Hydration Behavior Is Unchanged

✅ The `onRehydrateStorage` callback that converts `favoriteIds` from Array to Set on rehydration is unchanged.

---

## 22. Confirmation: Supabase Queries Are Unchanged

✅ No Supabase queries were modified.

---

## 23. Confirmation: React Query Keys Are Unchanged

✅ No React Query keys were modified.

---

## 24. Confirmation: Routes Are Unchanged

✅ No routes were modified.

---

## 25. Confirmation: No Forbidden Deep Imports Were Introduced

✅ All new imports use `@/modules/cart` (root barrel). No deep imports like `@/modules/cart/stores/favoritesStore` were introduced in app code.

---

## 26. Confirmation: No Circular Dependencies Were Introduced

✅ `npm run check:circular` — 719 files processed, 0 circular dependencies found.

---

## 27. Documentation Updates

### Documents Updated
1. `docs/architecture/phase-6-27-favorites-store-import-adoption-report.md` — this report (created)
2. `MODULAR_DEVELOPMENT_PLAN.md` — Phase 6.27 completion note + status line update

### Documents Checked But Not Changed
1. `ARCHITECTURE_GUIDE.md` — no references to `@/store/favoritesStore` found
2. `DEVELOPER_GUIDE.md` — no references to `@/store/favoritesStore` found
3. `src/modules/cart/README.md` — contains migration candidate table with `@/store/favoritesStore` reference; historical, no change needed
4. `eslint.config.js` — no changes needed
5. `package.json` — no changes needed

### Documentation Still Needing Future Updates
- `src/modules/cart/README.md:20` — still references `src/store/favoritesStore.js` in source files list. Could be updated to reflect stub status. Low priority.
- 14 outdated references from Phase 6.26 audit still remain across 8 module READMEs/placeholder files. These should be addressed in a future documentation cleanup phase.

---

## 28. Verification Results

### Lint & Type-Check
| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed (exit code 0) |
| `npm run type-check` | ✅ Passed (exit code 0) |

### Targeted Tests
| Test Suite | Tests | Result |
|---|---|---|
| `src/__tests__/stores/favoritesStore.test.js` | — | ✅ Passed |
| `src/__tests__/stores/authStore.test.js` | — | ✅ Passed |
| `src/store/__tests__/authStore.test.js` | — | ✅ Passed |
| `src/__tests__/integration/sessionManagement.test.js` | — | ✅ Passed |
| `src/__tests__/snapshots/darkMode.test.jsx` | — | ✅ Passed |
| `src/__tests__/snapshots/rtlComponents.test.jsx` | — | ✅ Passed |
| `src/__tests__/a11y/components.a11y.test.jsx` | — | ✅ Passed |
| `src/features/marketplace/__tests__/addToCart.integration.test.js` | — | ✅ Passed |
| `src/features/checkout/__tests__/checkout.integration.test.js` | — | ✅ Passed |
| `src/__tests__/hooks/useDarkMode.test.js` | — | ✅ Passed |
| **Total** | **176 passed, 2 todo** | **✅ 10 suites, all passed** |

### Final Checks
| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed (exit code 0) |
| `npm run type-check` | ✅ Passed (exit code 0) |
| `npm run build` | ✅ Passed (built in 2m 41s) |
| `npm run check:circular` | ✅ Passed (719 files, 0 circular dependencies) |

---

## 29. Is It Safe to Continue to Phase 6.28?

**Yes.** All verification checks pass. The migration is complete and safe:
- 10 files changed (4 app imports + 6 test mock updates, all import-path-only)
- 176 targeted tests pass
- 0 circular dependencies
- `@/store/favoritesStore` stub remains working
- `@/modules/cart` root barrel remains lightweight

---

## 30. Recommended Phase 6.28 Candidates

Based on the Phase 6.23 audit and current status:

### Option A: Class C — `@/services/coupons` (medium-high risk)
- 1 app import (CheckoutSimplified.jsx:16)
- 1 module-internal (checkout/api/index.js:23)
- Requires updating both app and module-internal imports
- Migration: `import { couponsApi } from '@/services/coupons'` → `import { couponsApi } from '@/modules/coupons'`

### Option B: Class C — `@/services/minimumOrderService` (medium-high risk)
- 2 app imports (CheckoutSimplified.jsx:23, Cart.jsx:22)
- 1 module-internal (checkout/api/index.js:29)
- 1 jest.mock (rtlComponents.test.jsx)
- Requires coordinated update

### Option C: Class C — `@/store/cartStore` (highest risk)
- 1 app import (OrderDetail.jsx:44)
- 9 jest.mocks + 2 requires
- All 11 test references must be updated atomically
- `buyer/Orders.jsx` also imports `useCartStore` (tested by multiple test files)

**Recommendation:** Phase 6.28 should target `@/services/coupons` (Option A) as it has the fewest consumers and lowest risk among Class C paths. `@/services/minimumOrderService` should follow in Phase 6.29, and `@/store/cartStore` in Phase 6.30.

---

## 31. Remaining Risks Before Touching Class C Paths or Deleting Class D Stubs

### Class C: `@/store/cartStore` (highest risk)
1. **9 jest.mocks + 2 requires** — highest mock count of any legacy path
2. **`OrderDetail.jsx` (1700 lines)** — imports `useCartStore` from `@/store/cartStore` (line 44)
3. **`buyer/Orders.jsx`** — also imports `useCartStore` (tested by `buyerOrdersRealtime.test.jsx` and `orderFlow.integration.test.js`)
4. **All 11 test references must be updated atomically**
5. **5 test files already mock `@/modules/cart`** for `useFavoritesStore` (from this phase) — merging `useCartStore` mock into those same mocks requires careful handling

### Class C: `@/services/coupons` + `@/services/minimumOrderService` + `@/hooks/useCheckoutPricing`
1. **`CheckoutSimplified.jsx` (1695 lines)** — contains 3 legacy imports that should be migrated together
2. **`checkout/api/index.js`** — has module-internal re-exports from `@/services/coupons` and `@/services/minimumOrderService`
3. **`Cart.jsx`** — also imports `@/services/minimumOrderService`
4. **1 jest.mock for minimumOrderService** — in `rtlComponents.test.jsx`

### Class D stub deletion
1. **Should NOT occur until Phase 7+** — after all Class B and C migrations are complete
2. **`@/services/apis/reviewsApi`** — has 1 indirect consumer (`src/services/api.js:22`) that must be updated first
3. **14 outdated documentation references** across 8 files need updating before stub deletion
4. **All 5 Class D stubs should be deleted together** in a single cleanup phase

### General risks
1. **Test mock atomicity** — For `@/store/cartStore` (9 mocks + 2 requires), all 11 references must be updated in the same commit
2. **`checkout/api/index.js`** — Re-exports from `@/services/coupons` and `@/services/minimumOrderService`. When migrating these, must update module-internal imports to point to `@/modules/coupons` and `@/modules/cart` respectively
3. **`CheckoutSimplified.jsx`** — 3 legacy imports should be migrated together in a single coordinated phase
4. **Duplicate imports** — `Favorites.jsx` and `ProductCard.jsx` now have two separate import lines from `@/modules/cart` (one for `useCartStore`/`favoritesApi`, one for `useFavoritesStore`). These could be consolidated but were left as-is to keep changes truly minimal (import-path-only). ESLint does not flag this as an error.
