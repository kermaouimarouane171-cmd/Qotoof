# Phase 2.6 — Critical Flow Preparation Report

**Date:** 2026-06-22  
**Project:** Greenmarket / Qotoof  
**Phase:** Phase 2.6 — Critical Flow Preparation before Phase 3  
**Purpose:** Resolve high-priority architectural risks (H1, H2, H3) identified in the Phase 2 Final Gate Report before starting Phase 3 module creation.

---

## 1. Confirmation: `.windsurfrules` Read and Followed

✅ `.windsurfrules` was read in full (614 lines, sections 0–45) and strictly followed throughout this phase.

Key rules respected:

- **Rule 1 (Minimal changes):** Only additive changes — new files created, existing files modified with backward-compatible re-exports and aliases. No files moved. No files deleted.
- **Rule 30 (Stop and ask):** No Supabase/RLS/Auth/Database/Payments/migrations touched.
- **No `any`, no `@ts-ignore`, no `@ts-expect-error`** — not needed.
- **No business logic changes.** All functions retain identical behavior.
- **No Supabase queries changed.** All query functions are unchanged.
- **No routes changed.**
- **No circular dependencies** introduced (verified by `madge`).
- **No mass import rewriting.** All existing imports continue to work via backward-compatible aliases and re-exports.

---

## 2. What Was Inspected

### Source Files Inspected (Read-Only)

| File | Lines | Purpose |
|---|---|---|
| `src/services/api.js` | 713 | Contains `ordersApi` (CRUD), `productsApi`, `reviewsApi`, `vendorsApi`, `usersApi`, `analyticsApi` |
| `src/services/deliveries.js` | 533→546 | Contains `deliveriesApi` + misplaced `ordersApi` (vendor accept/reject + subscriptions) |
| `src/hooks/queries/useMarketplaceQueries.js` | 315 | Mixed product, order, and review React Query hooks |
| `src/modules/orders/api/index.js` | 36→41 | Orders module API re-exports |
| `src/modules/orders/hooks/index.js` | 24→21 | Orders module hooks re-exports |
| `src/modules/delivery/api/index.js` | 73→75 | Delivery module API re-exports |
| `src/modules/marketplace/hooks/index.js` | 33→34 | Marketplace module hooks re-exports |

### Importers Identified

**Importers of `ordersApi` from `services/api.js`:**
- `src/domains/ordering/queries.js` — uses `ordersApi.getAll`
- `src/domains/ordering/commands.js` — uses `ordersApi` for order creation
- `src/hooks/queries/useMarketplaceQueries.js` — uses `ordersApi` for order query hooks

**Importers of `ordersApi` from `services/deliveries.js`:**
- `src/pages/OrderDetail.jsx` — uses `ordersApi.subscribeToOrder`, `ordersApi.acceptOrder`, `ordersApi.rejectOrder`
- `src/pages/buyer/Orders.jsx` — uses `ordersApi.subscribeToBuyerOrders`
- `src/pages/vendor/Dashboard.jsx` — uses `ordersApi.acceptOrder`, `ordersApi.rejectOrder`
- `src/pages/vendor/Orders.jsx` — uses `ordersApi.acceptOrder`, `ordersApi.rejectOrder`

**Importers of `useMarketplaceQueries.js`:**
- No direct imports found from pages or components (all consumption is via module re-exports)
- `src/modules/marketplace/hooks/index.js` — re-exported product + review hooks
- `src/modules/orders/hooks/index.js` — re-exported order hooks

---

## 3. What Was Changed

### H1 — `ordersApi` Naming Conflict: ✅ Fixed

**Problem:** Two different objects named `ordersApi` existed:
1. `src/services/api.js` → `ordersApi` (CRUD: getAll, getById, create, updateStatus, delete, restore, getDeleted)
2. `src/services/deliveries.js` → `ordersApi` (vendor accept/reject + realtime subscriptions)

**Resolution:**
- Renamed the `ordersApi` object in `deliveries.js` to `vendorOrderActionsApi` (canonical name)
- Exported a backward-compatible alias: `export { vendorOrderActionsApi as ordersApi }`
- All existing imports of `ordersApi` from `deliveries.js` continue to work unchanged
- The `ordersApi` in `api.js` is the primary CRUD API — no changes needed there
- Updated `src/modules/orders/api/index.js` to re-export `vendorOrderActionsApi` and individual functions
- Updated `src/modules/delivery/api/index.js` to document the renamed export

**Status:** ✅ Fixed — naming conflict resolved with full backward compatibility.

### H2 — Split `useMarketplaceQueries.js`: ✅ Fixed

**Problem:** `useMarketplaceQueries.js` (315 lines) mixed product, order, and review hooks in a single file, creating unclear ownership across catalog/marketplace/orders modules.

**Resolution:**
- Created `src/hooks/queries/useProductQueries.js` — product keys, queries, and mutations (14 exports)
- Created `src/hooks/queries/useOrderQueries.js` — order keys, queries, and mutations (8 exports)
- Created `src/hooks/queries/useReviewQueries.js` — review keys, queries, and mutations (6 exports)
- Converted `useMarketplaceQueries.js` to a backward-compatible aggregate that re-exports from all three new files
- Updated `src/modules/marketplace/hooks/index.js` to re-export from `useProductQueries` and `useReviewQueries`
- Updated `src/modules/orders/hooks/index.js` to re-export from `useOrderQueries`
- All existing imports via `useMarketplaceQueries.js` or module public APIs continue to work unchanged

**Status:** ✅ Fixed — hooks split with full backward compatibility.

### H3 — Order Functions Inside `deliveries.js`: ✅ Fixed

**Problem:** Five order-related functions lived inside `deliveries.js` as methods of the `ordersApi` object:
- `acceptOrder` — vendor accepts an order (calls Supabase Edge Function)
- `rejectOrder` — vendor rejects an order (calls Supabase Edge Function)
- `subscribeToOrder` — realtime subscription to a single order
- `subscribeToBuyerOrders` — realtime subscription to buyer's orders
- `subscribeToVendorOrders` — realtime subscription to vendor's orders

**Resolution:**
- Extracted all 5 functions as individual named exports from `deliveries.js`
- Created `vendorOrderActionsApi` grouped object containing all 5 functions
- Kept backward-compatible `ordersApi` alias pointing to `vendorOrderActionsApi`
- Updated `src/modules/orders/api/index.js` to re-export `vendorOrderActionsApi`, `acceptOrder`, `rejectOrder`, `subscribeToOrder`, `subscribeToBuyerOrders` from `deliveries.js`
- Did NOT re-export `subscribeToVendorOrders` from `deliveries.js` as a named export because `ordersService.ts` already exports a function with the same name (would cause duplicate export error). The deliveries.js version is accessible via `vendorOrderActionsApi.subscribeToVendorOrders`.
- Documented migration target: move to `ordersService.ts` or new `vendorOrderService.ts` in Phase 3
- Updated `src/modules/delivery/api/index.js` to document that these functions are legacy misplaced and re-exported from orders module, not delivery module

**Status:** ✅ Fixed — functions isolated as named exports with clear ownership documentation. No behavior changes. No files moved.

---

## 4. Files Created

| File | Purpose |
|---|---|
| `src/hooks/queries/useProductQueries.js` | Product React Query hooks (keys, queries, mutations) — split from useMarketplaceQueries.js |
| `src/hooks/queries/useOrderQueries.js` | Order React Query hooks (keys, queries, mutations) — split from useMarketplaceQueries.js |
| `src/hooks/queries/useReviewQueries.js` | Review React Query hooks (keys, queries, mutations) — split from useMarketplaceQueries.js |
| `docs/architecture/phase-2-6-critical-flow-preparation-report.md` | This report |

**Total files created:** 4 (3 hook files + 1 report)

---

## 5. Files Modified

| File | Changes |
|---|---|
| `src/services/deliveries.js` | Restructured `ordersApi` object: extracted 5 functions as named exports, created `vendorOrderActionsApi` grouped object, kept backward-compatible `ordersApi` alias. No behavior changes. |
| `src/hooks/queries/useMarketplaceQueries.js` | Replaced 315 lines of inline hook definitions with backward-compatible re-exports from `useProductQueries.js`, `useOrderQueries.js`, `useReviewQueries.js`. |
| `src/modules/orders/api/index.js` | Added re-exports for `vendorOrderActionsApi`, `acceptOrder`, `rejectOrder`, `subscribeToOrder`, `subscribeToBuyerOrders` from `deliveries.js`. Updated comments. |
| `src/modules/orders/hooks/index.js` | Changed re-export source from `useMarketplaceQueries` to `useOrderQueries`. Updated comments. |
| `src/modules/delivery/api/index.js` | Updated comments to document that order-related functions are legacy misplaced and re-exported from orders module. |
| `src/modules/marketplace/hooks/index.js` | Changed re-export sources from `useMarketplaceQueries` to `useProductQueries` and `useReviewQueries`. Updated comments. |
| `src/modules/orders/README.md` | Added `vendorOrderActionsApi`, `acceptOrder`, `rejectOrder`, `subscribeToOrder`, `subscribeToBuyerOrders` to public API example. |
| `MODULAR_DEVELOPMENT_PLAN.md` | Added Phase 2.6 sprint row, status line, and achievement note. |
| `ARCHITECTURE_GUIDE.md` | Added Phase 2.6 completion to TODO section. |

**Total files modified:** 9

---

## 6. Imports Changed

**No existing imports were changed.** All changes are additive:

- `deliveries.js` now exports `vendorOrderActionsApi` as the canonical name, with `ordersApi` as a backward-compatible alias. Existing imports of `ordersApi` from `deliveries.js` continue to work.
- `useMarketplaceQueries.js` now re-exports from the three new split files. Existing imports from `useMarketplaceQueries.js` continue to work.
- Module re-export files (`orders/hooks`, `marketplace/hooks`, `orders/api`, `delivery/api`) updated their source paths but the public API surface (what consumers import from `@/modules/<name>`) is unchanged or extended.

**New imports added (internal to re-export layers):**
- `useMarketplaceQueries.js` → imports from `./useProductQueries`, `./useOrderQueries`, `./useReviewQueries`
- `orders/hooks/index.js` → imports from `@/hooks/queries/useOrderQueries`
- `marketplace/hooks/index.js` → imports from `@/hooks/queries/useProductQueries`, `@/hooks/queries/useReviewQueries`
- `orders/api/index.js` → imports `vendorOrderActionsApi` etc. from `@/services/deliveries`

---

## 7. Whether Existing Imports Remain Working

✅ **Yes — all existing imports remain working.**

| Import Pattern | Status |
|---|---|
| `import { ordersApi } from '@/services/api'` | ✅ Unchanged |
| `import { ordersApi } from '@/services/deliveries'` | ✅ Works via backward-compatible alias |
| `import { ... } from '@/hooks/queries/useMarketplaceQueries'` | ✅ Works via re-exports |
| `import { ... } from '@/modules/orders'` | ✅ Works, now includes `vendorOrderActionsApi` |
| `import { ... } from '@/modules/marketplace'` | ✅ Works, hooks now sourced from split files |
| `import { ... } from '@/modules/delivery'` | ✅ Works, no API surface changes |

---

## 8. Whether Behavior Was Preserved

✅ **Yes — behavior is 100% preserved.**

- All function implementations are identical — no logic changes.
- `vendorOrderActionsApi` contains the same 5 methods with the same implementations as the old `ordersApi` in `deliveries.js`.
- The `ordersApi` alias points to `vendorOrderActionsApi`, so `ordersApi.acceptOrder()` calls the exact same function.
- The split hook files contain the same hook implementations as the original `useMarketplaceQueries.js`.
- The re-export from `useMarketplaceQueries.js` ensures all hooks work identically.

---

## 9. Whether Supabase Queries Are Unchanged

✅ **Yes — all Supabase queries are unchanged.**

No Supabase query was modified, added, or removed. All `supabase.from()`, `supabase.functions.invoke()`, `supabase.channel()` calls are identical to the original code.

---

## 10. Whether Routes Are Unchanged

✅ **Yes — routes are unchanged.**

No route files were touched. No `AppRouter` or route configuration was modified.

---

## 11. Documentation Updates

### Documents Updated

| Document | What Was Updated |
|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | Added Phase 2.6 sprint row to table, updated status line to include Phase 2.6, added Phase 2.6 achievement note |
| `ARCHITECTURE_GUIDE.md` | Added Phase 2.6 completion to TODO section |
| `src/modules/orders/README.md` | Added `vendorOrderActionsApi`, `acceptOrder`, `rejectOrder`, `subscribeToOrder`, `subscribeToBuyerOrders` to public API example |
| `src/modules/marketplace/hooks/index.js` | Updated comments to reference split files |
| `src/modules/orders/hooks/index.js` | Updated comments to reference split file |
| `src/modules/orders/api/index.js` | Updated comments to document vendor order actions and migration target |
| `src/modules/delivery/api/index.js` | Updated comments to document legacy misplaced functions |

### Documents Checked But Not Changed

| Document | Reason |
|---|---|
| `src/modules/catalog/README.md` | No changes — catalog module unaffected by Phase 2.6 |
| `src/modules/cart/README.md` | No changes — cart module unaffected |
| `src/modules/delivery/README.md` | No changes needed — public API unchanged (order functions not re-exported from delivery) |
| `src/modules/marketplace/README.md` | No changes needed — public API surface unchanged (same hooks, just sourced from split files) |
| `src/modules/shared/README.md` | No changes — shared module unaffected |
| `src/modules/auth/README.md` | No changes — auth module unaffected |
| `src/modules/users/README.md` | No changes — users module unaffected |
| `src/app/README.md` | No changes — app layer unaffected |
| `DEVELOPER_GUIDE.md` | No changes needed — no new directories created under `src/modules/` |
| `eslint.config.js` | No changes needed — `no-restricted-imports` rule already covers all modules |
| `package.json` | No changes needed — no new scripts or dependencies |
| `SYSTEM_DESIGN.md` | No changes — describes runtime architecture, not file structure |
| Phase 2.1–2.5 reports | No changes — historical reports, not affected by Phase 2.6 |
| Phase 2 Final Gate report | No changes — risks H1/H2/H3 documented there; this report documents their resolution |

### Outdated Documents Found

None. All documentation is consistent with the current codebase after updates.

### Documentation Still Needing Future Updates

| Document | What | When |
|---|---|---|
| `ARCHITECTURE_GUIDE.md` | Replace `src/features/` tree with `src/modules/` + `src/app/` tree | Phase 3+ (when first file moves) |
| `DEVELOPER_GUIDE.md` | Update "إضافة Feature جديدة" section to use module structure | Phase 3+ |
| `DEVELOPER_GUIDE.md` | Replace `src/features/` guide with `src/modules/` guide | Phase 3+ |
| Module READMEs | Update migration candidates as files are moved | Phase 3+ |
| `orders/README.md` | Update when `vendorOrderActionsApi` functions are moved to `ordersService.ts` | Phase 3 |
| `delivery/README.md` | Update when order functions are removed from `deliveries.js` | Phase 3 |
| Event contract documentation | Document `order:payment_updated` and `order:delivery_updated` when implemented | Phase 3 |

---

## 12. Command Results

| Command | Result | Details |
|---|---|---|
| `npm run lint` | ✅ **Passed** | `eslint . --max-warnings 1500` — 0 errors, exit code 0 |
| `npm run type-check` | ✅ **Passed** | `tsc --noEmit` — 0 errors, exit code 0 |
| `npm run build` | ✅ **Passed** | Built in 2m 52s, PWA generated (198 precache entries, 9748 KiB) |
| `npm run check:circular` | ✅ **Passed** | `madge --circular --extensions js,jsx,ts,tsx src/` — 614 files processed, 0 circular dependencies |

### Madge File Count Progression

| Phase | Files Tracked | Circular Deps |
|---|---|---|
| After Phase 2 Final Gate | 611 | 0 |
| After Phase 2.6 | 614 (+3 new hook files) | 0 |

---

## 13. Whether It Is Safe to Start Phase 3.1 Checkout Module Foundation

### ✅ Yes — It is safe to start Phase 3.1

**Justification:**

1. **All 4 verification commands pass** (lint, type-check, build, check:circular)
2. **0 circular dependencies** across 614 files
3. **H1 resolved** — `ordersApi` naming conflict eliminated with `vendorOrderActionsApi` canonical name
4. **H2 resolved** — `useMarketplaceQueries.js` split into 3 focused files with clear ownership
5. **H3 resolved** — Order functions in `deliveries.js` isolated as named exports with clear migration path
6. **All existing imports continue to work** — backward-compatible aliases and re-exports
7. **No behavior changes** — all function implementations identical
8. **No Supabase queries changed** — all database interactions unchanged
9. **No routes changed** — all routing unchanged
10. **Documentation updated** — plan, architecture guide, and module READMEs reflect Phase 2.6

---

## 14. Remaining Risks Before Checkout

### 🟠 Medium Priority

| # | Risk | Impact | Recommendation |
|---|---|---|---|
| M1 | `ProductCard.jsx` couples catalog/marketplace UI with `cartStore`/`favoritesStore` | 265-line component imports from 3 modules. Will complicate file migration. | Document only. Fix during Phase 3 when catalog files move. |
| M2 | `ProductDetail.jsx` (1116 lines) imports cart/delivery/inventory/reviews/refund concerns | Very large page with 8+ cross-concern imports. | Document only. Needs careful decomposition in Phase 3+. |
| M3 | `StoreDetail.jsx` (1288 lines) mixes marketplace/catalog/users/auth concerns | Very large page with cross-concern imports. | Document only. Needs decomposition in Phase 3+. |
| M4 | `OrderDetail.jsx` is very large and imports 8+ concerns | Cross-concern coupling. | Document only. Needs decomposition in Phase 3+. |
| M5 | `vendor/Products.jsx` (1285 lines) includes product management plus other concerns | Large page with inline Supabase queries. | Document only. Needs decomposition in Phase 3+. |
| M6 | `notifications.js` mixes notification delivery with user-owned preference management | Two concerns in one service. | Fix during Phase 3 notifications module creation. |
| M7 | `authActionsService.js` directly clears cart/favorites during logout | Auth module reaches into cart module. | Fix during Phase 3 — use event contract or callback. |
| M8 | `checkoutService.js` creates orders directly from cart | Checkout reaches into orders. | Fix during Phase 3 checkout module creation. |
| M9 | `driver/Earnings.jsx` and `driver/History.jsx` import `supabase` directly | Should use delivery API/hooks. | Fix during Phase 3 when delivery files move. |
| M10 | `driver/Settings.jsx` imports `profilesService`, `auditLogger`, `paypalEligibility` | Cross-concern couplings. | Fix during Phase 3. |
| M11 | `buyer/Orders.jsx` and `vendor/Orders.jsx` import `deliveriesApi` from `@/services/deliveries` | Cross-concern coupling. | Fix during Phase 3. |

### 🟢 Can Wait

| # | Risk | Impact | Recommendation |
|---|---|---|---|
| W1 | Event contracts `order:payment_updated` and `order:delivery_updated` documented but not implemented | No event system exists yet. Modules communicate via direct imports. | Implement during Phase 3 after checkout/payments modules are created. |
| W2 | `driver.service.js` uses Express `db`, not Supabase | May be legacy/dead code. | Investigate during Phase 3. May remove. |
| W3 | `gpsTracking.js` references non-existent `driverMatching.js` | May be legacy. | Investigate during Phase 3. |
| W4 | `legalCameraService.js` used by delivery pickup/complete pages | Legal/compliance concern. | May need separate legal module in Phase 3+. |
| W5 | `partnershipService.js` used by FindDriver/FindVendor pages | Partnership concern. | May need separate partnerships module in Phase 3+. |
| W6 | `realtimeService.js` used by driver dashboard | Realtime infrastructure. | May belong in shared. |
| W7 | `storeTypeService.js` used by both marketplace and delivery | Cross-module service. | Assign to one module or shared during Phase 3. |
| W8 | `driver/Security.jsx` is mostly an auth concern (MFA, sessions) | Misclassified in driver pages. | May move to auth module in Phase 3+. |
| W9 | `components/checkout/DriverSelectionStep.jsx` is a checkout concern using delivery matching | Cross-module component. | Will be resolved when checkout module is created. |
| W10 | Express backend (`src/api/`) uses `seller` role instead of `vendor` | Known inconsistency. | Documented in `.windsurfrules` section 43. Do not unify until Express is fully deprecated. |
| W11 | `subscribeToVendorOrders` exists in both `ordersService.ts` and `deliveries.js` with different implementations | Potential confusion. The ordersService version is the primary one. The deliveries.js version is accessible via `vendorOrderActionsApi.subscribeToVendorOrders`. | Resolve during Phase 3 when moving vendor order actions to orders domain. |

---

## 15. Files That Must NOT Be Moved Yet

| File | Reason |
|---|---|
| `src/services/deliveries.js` | Order functions now isolated as named exports but still physically in deliveries.js. Move in Phase 3. |
| `src/hooks/queries/useMarketplaceQueries.js` | Now a backward-compatible aggregate. Can be removed in Phase 3+ after all consumers migrate to split files or module APIs. |
| `src/pages/CheckoutSimplified.jsx` | Large checkout page. Must create checkout module foundation first. |
| `src/services/checkoutService.js` | Creates orders from cart. Must design event contract before moving. |
| `src/services/paymentService.js` | Payment records. Must create payments module foundation first. |
| `src/services/paymentGateway.js` | Payment provider abstraction. Must create payments module first. |
| `src/contexts/PaymentGuard.jsx` | Payment access control. Protected zone in `.windsurfrules` section 37. |
| `src/services/cmiPayment.js` | CMI integration. Protected zone in `.windsurfrules` section 37. |
| `src/services/commissionService.js` | Commission system. Protected zone in `.windsurfrules` section 37. |
| `src/services/payoutService.js` | Payouts. Protected zone in `.windsurfrules` section 37. |
| `src/services/notifications.js` | Mixed notification delivery + preference management. Must separate concerns first. |
| `src/services/authActionsService.js` | Directly clears cart/favorites. Must design event contract before moving. |
| `src/pages/ProductDetail.jsx` (1116 lines) | Very large, 8+ cross-concern imports. Needs decomposition. |
| `src/pages/StoreDetail.jsx` (1288 lines) | Very large, cross-concern imports. Needs decomposition. |
| `src/pages/OrderDetail.jsx` | Very large, 8+ concerns. Needs decomposition. |
| `src/pages/vendor/Products.jsx` (1285 lines) | Large, inline Supabase queries. Needs decomposition. |
| `src/services/driver.service.js` | Uses Express `db`, not Supabase. May be legacy. Needs investigation. |
| `src/services/gpsTracking.js` | References non-existent `driverMatching.js`. May be legacy. |
| All files in `src/api/` (Express backend) | Deprecated. Do not move. Will be removed eventually. |

---

## 16. Phase 2.6 Summary

| Gate Check | Status |
|---|---|
| H1: `ordersApi` naming conflict resolved | ✅ Fixed |
| H2: `useMarketplaceQueries.js` split | ✅ Fixed |
| H3: Order functions in `deliveries.js` isolated | ✅ Fixed |
| No business logic changes | ✅ |
| No Supabase query changes | ✅ |
| No database/RLS changes | ✅ |
| No routes changed | ✅ |
| No files moved | ✅ |
| No files deleted | ✅ |
| No circular dependencies | ✅ |
| Existing imports remain working | ✅ |
| `npm run lint` passes | ✅ |
| `npm run type-check` passes | ✅ |
| `npm run build` passes | ✅ |
| `npm run check:circular` passes | ✅ |
| Documentation updated | ✅ |
| **Phase 2.6: PASSED** | ✅ |

---

## 17. Recommendation

### Phase 2.6: ✅ PASSED

**It is safe to proceed to Phase 3.1 — Checkout Module Foundation.**

**Recommended Phase 3 path:**
1. **Phase 3.1** — checkout module foundation (`src/modules/checkout/`) as re-export layer
2. **Phase 3.2** — payments module foundation (`src/modules/payments/`)
3. **Phase 3.3** — notifications module foundation (`src/modules/notifications/`)
4. **Phase 3.4** — coupons module foundation (if needed)
5. **Phase 3 Final Gate** — verification before Phase 4

**Event contract design** (`order:payment_updated`, `order:delivery_updated`) should be documented as part of Phase 3.1 (checkout) but NOT implemented until file migration begins.
