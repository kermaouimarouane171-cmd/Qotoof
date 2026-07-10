# Phase 6.26 — Class D Stub Removal Readiness Audit Report

**Phase:** 6.26 — Class D Stub Removal Readiness Audit (audit-only)
**Date:** 2026-06-25
**Status:** ✅ Completed — 0 files changed, 0 stubs deleted, 0 behavior changes

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` was read in full (614 lines) and strictly followed throughout this phase.

Key rules respected:
- ✅ No file movement
- ✅ No stub deletion
- ✅ No import rewriting
- ✅ No business logic, UI, behavior changes
- ✅ No Supabase query, React Query key, database/RLS, Edge Function, or route changes
- ✅ No circular dependencies (verified — 719 files, 0 circular)
- ✅ No forbidden deep module imports introduced
- ✅ No `any`, `@ts-ignore`, `@ts-expect-error`
- ✅ Audit-only — zero source files modified

---

## 2. Confirmation: No Stubs Were Deleted

- **Stubs deleted:** 0
- All 5 Class D stub files remain intact and unchanged.

---

## 3. Confirmation: No Files Were Moved

- **Files moved:** 0

---

## 4. Stub Files Inspected

### 4.1 `src/services/favorites.js`

| Property | Value |
|---|---|
| **Old path** | `@/services/favorites` |
| **Preferred new paths** | `@/modules/cart` (favoritesApi), `@/modules/chat` (messagesApi), `@/modules/orders` (orderTimelineApi), `@/modules/users` (verificationApi) |
| **Export shape** | Named exports only: `favoritesApi`, `messagesApi`, `orderTimelineApi`, `verificationApi` |
| **Default export** | No |
| **Re-export source** | Deep module paths (with `eslint-disable-next-line no-restricted-imports`) to avoid circular evaluation |
| **Stub created** | Phase 6.9 |
| **Comment note** | Explains deep paths are intentional to prevent circular module evaluation |

### 4.2 `src/services/loyalty.js`

| Property | Value |
|---|---|
| **Old path** | `@/services/loyalty` |
| **Preferred new path** | `@/modules/loyalty` |
| **Export shape** | Named exports: `loyaltyApi`, `LOYALTY_TIERS`, `REFERRAL_REWARD_POINTS`, `calculateLoyaltyPointsForOrder`, `calculateRewardDiscountAmount`, `addLoyaltyPoints`, `generateReferralCode`, `processReferral` |
| **Default export** | Yes — `export { default } from '@/modules/loyalty'` |
| **Re-export source** | `@/modules/loyalty` (root barrel) |
| **Stub created** | Phase 6.7 |

### 4.3 `src/services/apis/reviewsApi.js`

| Property | Value |
|---|---|
| **Old path** | `@/services/apis/reviewsApi` |
| **Preferred new path** | `@/modules/reviews` |
| **Export shape** | Named export: `reviewsApi` |
| **Default export** | No |
| **Re-export source** | `@/modules/reviews` (root barrel) |
| **Stub created** | Phase 6.1 |
| **Note** | `src/services/api.js` re-exports `reviewsApi` from this stub via `export { reviewsApi } from './apis/reviewsApi'` |

### 4.4 `src/utils/checkoutCleanup.js`

| Property | Value |
|---|---|
| **Old path** | `@/utils/checkoutCleanup` |
| **Preferred new path** | `@/modules/checkout` |
| **Export shape** | Named export: `rollbackCheckoutRecords` |
| **Default export** | No |
| **Re-export source** | `@/modules/checkout` (root barrel) |
| **Stub created** | Phase 6.3 |

### 4.5 `src/hooks/queries/useReviewQueries.js`

| Property | Value |
|---|---|
| **Old path** | `@/hooks/queries/useReviewQueries` |
| **Preferred new path** | `@/modules/reviews` |
| **Export shape** | Named exports: `reviewKeys`, `useVendorReviews`, `useDeletedReviews`, `useCreateReview`, `useDeleteReview`, `useRestoreReview` |
| **Default export** | No |
| **Re-export source** | `@/modules/reviews` (root barrel) |
| **Stub created** | Phase 6.2 |

---

## 5. Legacy Paths Searched

The following searches were performed across the entire `src/` directory:

| Search Type | Paths Searched |
|---|---|
| Static imports (`from '...'`) | `@/services/favorites`, `@/services/loyalty`, `@/services/apis/reviewsApi`, `@/utils/checkoutCleanup`, `@/hooks/queries/useReviewQueries` |
| `require()` | All 5 paths |
| `jest.mock()` | All 5 paths |
| `vi.mock()` | All 5 paths (none found — Vitest not used) |
| Dynamic `import()` | All 5 paths |
| Relative imports | `../services/favorites`, `../../services/favorites`, `../services/loyalty`, `../../services/loyalty`, `../services/apis/reviewsApi`, `../../services/apis/reviewsApi`, `../utils/checkoutCleanup`, `../../utils/checkoutCleanup`, `../hooks/queries/useReviewQueries`, `../../hooks/queries/useReviewQueries` |
| Relative import (`./apis/reviewsApi`) | Found in `src/services/api.js:22` |
| Test setup files | Searched — no references found |
| Config files (vite, jest, tsconfig, babel) | Searched — no references found |
| `coverage-baseline.json` | Contains stale coverage data for old source files (not active consumers) |

---

## 6. Active Consumers Found or Confirmed Zero

### 6.1 `@/services/favorites`

| Consumer Type | Count | Details |
|---|---|---|
| App imports (`from '@/services/favorites'`) | 0 | None found |
| `require()` | 0 | None found |
| `jest.mock()` | 0 | None found |
| Dynamic `import()` | 0 | None found |
| Relative imports | 0 | None found |
| **Total active consumers** | **0** | ✅ Confirmed zero |

### 6.2 `@/services/loyalty`

| Consumer Type | Count | Details |
|---|---|---|
| App imports (`from '@/services/loyalty'`) | 0 | None found |
| `require()` | 0 | None found |
| `jest.mock()` | 0 | None found |
| Dynamic `import()` | 0 | None found |
| Relative imports | 0 | None found |
| **Total active consumers** | **0** | ✅ Confirmed zero |

### 6.3 `@/services/apis/reviewsApi`

| Consumer Type | Count | Details |
|---|---|---|
| App imports (`from '@/services/apis/reviewsApi'`) | 0 | None found |
| `require()` | 0 | None found |
| `jest.mock()` | 0 | None found |
| Dynamic `import()` | 0 | None found |
| Relative imports | **1** | `src/services/api.js:22` — `export { reviewsApi } from './apis/reviewsApi'` |
| **Total active consumers** | **1 (indirect)** | ⚠️ `src/services/api.js` re-exports `reviewsApi` from this stub. `@/services/api` has 8+ active consumers. |

**Analysis:** `src/services/api.js` is an internal aggregator that re-exports from `./apis/reviewsApi` (the stub). If the stub is deleted, `services/api.js` would break. To delete this stub, `services/api.js` must first be updated to re-export `reviewsApi` from `@/modules/reviews` directly.

### 6.4 `@/utils/checkoutCleanup`

| Consumer Type | Count | Details |
|---|---|---|
| App imports (`from '@/utils/checkoutCleanup'`) | 0 | None found |
| `require()` | 0 | None found |
| `jest.mock()` | 0 | None found |
| Dynamic `import()` | 0 | None found |
| Relative imports | 0 | None found (note: `src/modules/checkout/domain/index.js:9` uses `../utils/checkoutCleanup` — this is an intra-module relative path within `src/modules/checkout/`, NOT the legacy stub) |
| **Total active consumers** | **0** | ✅ Confirmed zero |

### 6.5 `@/hooks/queries/useReviewQueries`

| Consumer Type | Count | Details |
|---|---|---|
| App imports (`from '@/hooks/queries/useReviewQueries'`) | 0 | None found |
| `require()` | 0 | None found |
| `jest.mock()` | 0 | None found |
| Dynamic `import()` | 0 | None found |
| Relative imports | 0 | None found |
| **Total active consumers** | **0** | ✅ Confirmed zero |

---

## 7. Documentation References Found

### 7.1 Historical Reports (Should Remain Unchanged)

These are phase reports documenting what happened at each phase. They are historical records and should NOT be modified:

| # | File | Matches | Nature |
|---|---|---|---|
| 1 | `docs/architecture/phase-6-6-loyalty-import-adoption-report.md` | 35 | Historical — documents Phase 6.6 loyalty import adoption |
| 2 | `docs/architecture/phase-6-23-legacy-import-audit-report.md` | 27 | Historical — documents Phase 6.23 audit findings |
| 3 | `docs/architecture/phase-6-9-favorites-service-split-report.md` | 21 | Historical — documents Phase 6.9 favorites split |
| 4 | `docs/architecture/phase-6-5-loyalty-module-foundation-report.md` | 18 | Historical — documents Phase 6.5 loyalty foundation |
| 5 | `docs/architecture/phase-6-10-favorites-import-adoption-report.md` | 17 | Historical — documents Phase 6.10 favorites adoption |
| 6 | `docs/architecture/phase-6-7-loyalty-file-movement-report.md` | 11 | Historical — documents Phase 6.7 loyalty movement |
| 7 | `docs/architecture/phase-5-1-safe-import-adoption-report.md` | 9 | Historical — documents Phase 5.1 adoption |
| 8 | `docs/architecture/phase-5-4-notifications-cart-import-adoption-report.md` | 9 | Historical — documents Phase 5.4 adoption |
| 9 | `docs/architecture/phase-5-7-checkout-payments-import-adoption-report.md` | 4 | Historical |
| 10 | `docs/architecture/phase-5-8-admin-chat-import-adoption-report.md` | 4 | Historical |
| 11 | `docs/architecture/phase-6-3-cart-checkout-utils-file-movement-report.md` | 4 | Historical |
| 12 | `docs/architecture/phase-6-4-loyalty-file-movement-report.md` | 4 | Historical |
| 13 | `docs/architecture/phase-6-8-favorites-store-file-movement-report.md` | 4 | Historical |
| 14 | `docs/architecture/phase-6-1-coupons-reviews-file-movement-report.md` | 3 | Historical |
| 15 | `docs/architecture/phase-6-2-reviews-cart-file-movement-report.md` | 3 | Historical |
| 16 | `docs/architecture/phase-4-2-reviews-module-report.md` | 2 | Historical |
| 17 | `docs/architecture/phase-4-3-chat-module-report.md` | 2 | Historical |
| 18 | `docs/architecture/phase-4-7-pre-migration-split-report.md` | 2 | Historical |
| 19 | `docs/architecture/phase-2-3-cart-module-report.md` | 1 | Historical |
| 20 | `docs/architecture/phase-2-6-critical-flow-preparation-report.md` | 1 | Historical |
| 21 | `docs/architecture/phase-6-11-cart-store-file-movement-report.md` | 1 | Historical |
| 22 | `docs/architecture/phase-6-12-cart-store-import-adoption-report.md` | 1 | Historical |
| 23 | `docs/architecture/phase-6-13-cart-barrel-safety-report.md` | 1 | Historical |

### 7.2 Current Docs That Need Updates (Outdated References)

| # | File | Reference | Issue | Recommended Fix |
|---|---|---|---|---|
| 1 | `src/modules/loyalty/domain/index.js:9` | "Currently, domain logic is embedded in src/services/loyalty.js" | **Outdated** — source has moved to `src/modules/loyalty/api/loyalty.js` | Update comment to reflect new location |
| 2 | `src/modules/loyalty/utils/index.js:9` | "Currently, utility functions are embedded in src/services/loyalty.js" | **Outdated** — source has moved | Update comment to reflect new location |
| 3 | `src/modules/chat/README.md:21` | "src/services/favorites.js (lines 113–169) — messagesApi" | **Outdated** — `favorites.js` is now a stub; actual source is `src/modules/chat/api/messagesApi.js` | Update source file reference |
| 4 | `src/modules/chat/README.md:58` | "messagesApi Methods (from src/services/favorites.js)" | **Outdated** | Update source reference |
| 5 | `src/modules/chat/README.md:183` | "messagesApi in src/services/favorites.js (lines 113–169)" | **Outdated** | Update migration candidate reference |
| 6 | `src/modules/chat/README.md:211` | "messagesApi in src/services/favorites.js" | **Outdated** | Update inconsistency note |
| 7 | `src/modules/chat/README.md:221–223` | "messagesApi Lives in favorites.js" section | **Outdated** | Update or remove this section |
| 8 | `src/modules/cart/README.md:21` | "src/services/favorites.js → src/modules/cart/api/favorites.js" | **Outdated** — `favorites.js` is now a stub, not the source | Update to reflect stub status |
| 9 | `src/modules/cart/README.md:199` | "favorites.js | @/services/favorites | @/modules/cart/api/" | **Outdated** — migration candidate table still lists old path as current location | Update to reflect stub status |
| 10 | `src/modules/reviews/README.md:17–23` | "Source files: src/services/api.js, src/services/reviewService.js, src/hooks/queries/useReviewQueries.js" | **Outdated** — all three are now stubs; actual sources are in `src/modules/reviews/` | Update source file references |
| 11 | `src/modules/reviews/README.md:62` | "Hooks (from src/hooks/queries/useReviewQueries.js)" | **Outdated** | Update source reference |
| 12 | `src/modules/reviews/README.md:107` | "Marketplace currently re-exports review hooks from @/hooks/queries/useReviewQueries" | **Outdated** — the stub re-exports from `@/modules/reviews` | Update to reflect stub status |
| 13 | `src/modules/reviews/README.md:191` | "MC3 | src/hooks/queries/useReviewQueries.js (73 lines)" | **Outdated** — file is now a 13-line stub | Update migration candidate |
| 14 | `src/modules/shared/README.md:124` | "checkoutCleanup | @/utils/checkoutCleanup | Checkout-specific" | **Outdated** — file is now a 6-line stub | Update to reflect it has moved to `@/modules/checkout` |

### 7.3 MODULAR_DEVELOPMENT_PLAN.md References

| # | Lines | Nature | Action |
|---|---|---|---|
| 1 | 783–808 | Phase 6.23 completion note listing Class D stubs | Historical — should remain unchanged |
| 2 | 832–838 | Phase 6.25 completion note | Historical — should remain unchanged |

### 7.4 Other Non-Code References

| # | File | Reference | Nature |
|---|---|---|---|
| 1 | `coverage-baseline.json:283` | `src/services/favorites.js` coverage data | Stale coverage baseline — not an active consumer |
| 2 | `coverage-baseline.json:292` | `src/services/loyalty.js` coverage data | Stale coverage baseline |
| 3 | `coverage-baseline.json:341` | `src/utils/checkoutCleanup.js` coverage data | Stale coverage baseline |
| 4 | `lint-report.json` | Various references | Generated report — not active consumers |

---

## 8. Export Shape of Each Stub

| # | Stub | Named Exports | Default Export | Re-export Source |
|---|---|---|---|---|
| 1 | `src/services/favorites.js` | `favoritesApi`, `messagesApi`, `orderTimelineApi`, `verificationApi` | No | Deep module paths (4 different modules) |
| 2 | `src/services/loyalty.js` | 8 named exports (loyaltyApi, LOYALTY_TIERS, etc.) | Yes (`export { default } from '@/modules/loyalty'`) | `@/modules/loyalty` (root barrel) |
| 3 | `src/services/apis/reviewsApi.js` | `reviewsApi` | No | `@/modules/reviews` (root barrel) |
| 4 | `src/utils/checkoutCleanup.js` | `rollbackCheckoutRecords` | No | `@/modules/checkout` (root barrel) |
| 5 | `src/hooks/queries/useReviewQueries.js` | 6 named exports (reviewKeys, useVendorReviews, etc.) | No | `@/modules/reviews` (root barrel) |

---

## 9. Preferred Module Path for Each Stub

| # | Old Path | Preferred New Path | Notes |
|---|---|---|---|
| 1 | `@/services/favorites` | `@/modules/cart` (favoritesApi), `@/modules/chat` (messagesApi), `@/modules/orders` (orderTimelineApi), `@/modules/users` (verificationApi) | Split across 4 modules |
| 2 | `@/services/loyalty` | `@/modules/loyalty` | Single module |
| 3 | `@/services/apis/reviewsApi` | `@/modules/reviews` | Single module |
| 4 | `@/utils/checkoutCleanup` | `@/modules/checkout` | Single module |
| 5 | `@/hooks/queries/useReviewQueries` | `@/modules/reviews` | Single module |

---

## 10. Future Deletion Readiness Classification

| # | Stub | Active App Imports | Active Test Imports | Active Mocks | Dynamic Imports | Indirect Consumers | Docs Refs | Status | Future Deletion Risk | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `@/services/favorites` | 0 | 0 | 0 | 0 | 0 | 6 outdated | **Eligible for future deletion** | Low — zero consumers. Deep-path re-exports with eslint-disable may confuse, but no code depends on the stub. | Delete in Phase 7+ after doc cleanup |
| 2 | `@/services/loyalty` | 0 | 0 | 0 | 0 | 0 | 2 outdated comments | **Eligible for future deletion** | Low — zero consumers. Has default export, but no code uses it. | Delete in Phase 7+ after doc cleanup |
| 3 | `@/services/apis/reviewsApi` | 0 | 0 | 0 | 0 | **1** (`src/services/api.js:22`) | 0 | **Do not delete yet** | Medium — `services/api.js` re-exports from this stub. Must update `services/api.js` first. | Update `services/api.js` to import from `@/modules/reviews`, then delete stub in Phase 7+ |
| 4 | `@/utils/checkoutCleanup` | 0 | 0 | 0 | 0 | 0 | 1 outdated | **Eligible for future deletion** | Low — zero consumers. | Delete in Phase 7+ after doc cleanup |
| 5 | `@/hooks/queries/useReviewQueries` | 0 | 0 | 0 | 0 | 0 | 4 outdated | **Eligible for future deletion** | Low — zero consumers. | Delete in Phase 7+ after doc cleanup |

---

## 11. Risk if Deleted Now

| # | Stub | Risk if Deleted Now | Impact |
|---|---|---|---|
| 1 | `@/services/favorites` | **None** — zero active consumers | No breakage |
| 2 | `@/services/loyalty` | **None** — zero active consumers | No breakage |
| 3 | `@/services/apis/reviewsApi` | **Medium** — `src/services/api.js:22` would break | `reviewsApi` would no longer be re-exported from `@/services/api`, affecting 8+ consumers of `@/services/api` that import `reviewsApi` (though none currently import `reviewsApi` from `@/services/api` — all use `@/modules/reviews` directly). **However**, the re-export chain `services/api.js → ./apis/reviewsApi → @/modules/reviews` would break at the `services/api.js` level. |
| 4 | `@/utils/checkoutCleanup` | **None** — zero active consumers | No breakage |
| 5 | `@/hooks/queries/useReviewQueries` | **None** — zero active consumers | No breakage |

---

## 12. Recommended Deletion Order (If Approved in Later Phase)

If stub deletion is approved in Phase 7 or later:

| Order | Stub | Prerequisite | Risk |
|---|---|---|---|
| 1st | `@/utils/checkoutCleanup` | None — zero consumers | Lowest risk |
| 2nd | `@/hooks/queries/useReviewQueries` | None — zero consumers | Low risk |
| 3rd | `@/services/favorites` | None — zero consumers | Low risk (but 4 deep-path re-exports with eslint-disable need careful removal) |
| 4th | `@/services/loyalty` | None — zero consumers | Low risk (has default export, verify no hidden consumers) |
| 5th | `@/services/apis/reviewsApi` | **Must update `src/services/api.js:22`** first to `export { reviewsApi } from '@/modules/reviews'` | Medium risk — requires coordinated update |

---

## 13. Recommendation: Keep All Stubs Until Phase 7 or Later

**Recommendation:** Keep all 5 Class D stubs until Phase 7 (or later).

**Rationale:**
1. **Phase 6 is still in progress** — Class B and Class C paths have not been migrated yet. Keeping stubs until all legacy paths are resolved reduces risk of partial states.
2. **Documentation cleanup needed first** — 14 outdated documentation references across 6 module READMEs and 2 placeholder files need updating before stubs are removed, to avoid confusing future developers.
3. **`@/services/apis/reviewsApi` has an indirect consumer** — `src/services/api.js` must be updated before this stub can be safely deleted.
4. **Low cost of keeping stubs** — Each stub is 6–29 lines of pure re-export code. The overhead of maintaining them is negligible.
5. **Phase 7 could be a "cleanup phase"** — All Class D stubs could be deleted together after doc updates, with a single verification cycle.

---

## 14. Confirmation: No Behavior Changed

✅ This was an audit-only phase. Zero source files were modified. No behavior changes of any kind.

---

## 15. Confirmation: No Supabase Queries Changed

✅ No Supabase queries were modified.

---

## 16. Confirmation: No React Query Keys Changed

✅ No React Query keys were modified.

---

## 17. Confirmation: Routes Are Unchanged

✅ No routes were modified.

---

## 18. Confirmation: No Forbidden Deep Imports Were Introduced

✅ No code changes were made. No deep imports introduced.

---

## 19. Confirmation: No Circular Dependencies Were Introduced

✅ `npm run check:circular` — 719 files processed, 0 circular dependencies found.

---

## 20. Documentation Updates

### Documents Updated
1. `docs/architecture/phase-6-26-class-d-stub-removal-readiness-audit-report.md` — this report (created)
2. `MODULAR_DEVELOPMENT_PLAN.md` — Phase 6.26 completion note + status line update

### Documents Checked But Not Changed
1. `ARCHITECTURE_GUIDE.md` — no references to Class D paths found
2. `DEVELOPER_GUIDE.md` — no references to Class D paths found
3. `eslint.config.js` — no references to Class D paths found
4. `package.json` — no references to Class D paths found
5. All 23 historical phase reports in `docs/architecture/` — should remain unchanged as historical records

### Documentation Still Needing Future Updates
14 outdated references across 8 files (listed in Section 7.2). These should be updated in a future documentation cleanup phase before or alongside stub deletion:
1. `src/modules/loyalty/domain/index.js:9` — outdated comment
2. `src/modules/loyalty/utils/index.js:9` — outdated comment
3. `src/modules/chat/README.md:21,58,183,211,221–223` — 6 outdated references
4. `src/modules/cart/README.md:21,199` — 2 outdated references
5. `src/modules/reviews/README.md:17–23,62,107,191` — 4 outdated references
6. `src/modules/shared/README.md:124` — 1 outdated reference

---

## 21. Verification Results

| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed (exit code 0) |
| `npm run type-check` | ✅ Passed (exit code 0) |
| `npm run build` | ✅ Passed (built in 2m 46s) |
| `npm run check:circular` | ✅ Passed (719 files, 0 circular dependencies) |

---

## 22. Is It Safe to Continue to Phase 6.27?

**Yes.** All verification checks pass. This was an audit-only phase with zero code changes. The project remains in a clean state.

---

## 23. Recommended Phase 6.27 Candidates

Based on the Phase 6.23 audit and current status:

### Option A: Class B — `@/store/favoritesStore` (medium risk)
- 4 app imports (ProductCard, authSessionStore, authActionsService, Favorites)
- 6 jest.mocks must be updated atomically
- Auth-adjacent files (authSessionStore, authActionsService) require careful testing
- Migration: `import { useFavoritesStore } from '@/store/favoritesStore'` → `import { useFavoritesStore } from '@/modules/cart'`
- Named → named import (simpler than Phase 6.25's default → named)

### Option B: Class C — `@/services/coupons` (medium-high risk)
- 1 app import (CheckoutSimplified.jsx:16)
- 1 module-internal (checkout/api/index.js:23)
- Requires updating both app and module-internal imports

### Option C: Class C — `@/services/minimumOrderService` (medium-high risk)
- 2 app imports (CheckoutSimplified.jsx:23, Cart.jsx:22)
- 1 module-internal (checkout/api/index.js:29)
- 1 jest.mock
- Requires coordinated update

**Recommendation:** Phase 6.27 should target Class B (`@/store/favoritesStore`) as the natural next step in risk progression. Class C should follow in Phase 6.28+.

---

## 24. Remaining Risks Before Migrating Class B or Class C Paths

### Class B: `@/store/favoritesStore`
1. **6 jest.mocks** must be updated atomically — all in the same commit as the 4 app import changes
2. **Auth-adjacent files** — `authSessionStore` and `authActionsService` import `useFavoritesStore`; must verify no auth/session behavior changes
3. **Named → named import** — simpler than Phase 6.25's default → named conversion, but still requires mock structure updates

### Class C: `@/store/cartStore`
1. **9 jest.mocks + 2 requires** — highest mock count of any legacy path
2. **`OrderDetail.jsx` (1700 lines)** — imports `useCartStore` from `@/store/cartStore` (line 44)
3. **`buyer/Orders.jsx`** — also imports `useCartStore` (tested by `buyerOrdersRealtime.test.jsx` and `orderFlow.integration.test.js`)
4. **All 11 test references must be updated atomically**

### Class C: `@/services/coupons` + `@/services/minimumOrderService` + `@/hooks/useCheckoutPricing`
1. **`CheckoutSimplified.jsx` (1695 lines)** — contains 3 legacy imports that should be migrated together
2. **`checkout/api/index.js`** — has module-internal re-exports from `@/services/coupons` and `@/services/minimumOrderService` that must be updated
3. **`Cart.jsx`** — also imports `@/services/minimumOrderService` (already touched in Phase 6.24 for cartQuantity)
4. **1 jest.mock for minimumOrderService** — in `rtlComponents.test.jsx`

### General risks
1. **Test mock atomicity** — For `@/store/cartStore` (9 mocks) and `@/store/favoritesStore` (6 mocks), all mocks must be updated in the same commit as app import changes
2. **`checkout/api/index.js`** — Re-exports from `@/services/coupons` and `@/services/minimumOrderService`. When migrating these, must update module-internal imports to point to `@/modules/coupons` and `@/modules/cart` respectively
3. **`CheckoutSimplified.jsx`** — 3 legacy imports should be migrated together in a single coordinated phase
4. **Class D stub deletion** — Should NOT occur until Phase 7+ after all Class B and C migrations are complete and documentation is updated
