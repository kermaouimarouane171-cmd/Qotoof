# Phase 4.7 — Pre-Migration Split Preparation Report

**Phase:** 4.7 — Pre-Migration Split Preparation  
**Date:** 2026-06-24  
**Status:** ✅ Completed  
**Approach:** Additive-first, backward-compatible split — no behavior changes, no import migration, no file movement

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` was read in full (614 lines) and strictly followed throughout this phase.

Key rules respected:

- ✅ **Rule 1 (Minimal changes):** Only additive changes — new split files created, old files converted to re-exports. No files moved. No files deleted. No business logic changed.
- ✅ **Rule 30 (Stop and ask):** No Supabase/RLS/Auth/Database/Payments/migrations touched.
- ✅ **No `any`, no `@ts-ignore`, no `@ts-expect-error`** — not needed.
- ✅ **No business logic changes.** All API methods, Supabase queries, retry logic, and return shapes preserved exactly.
- ✅ **No Supabase queries changed.** All queries copied verbatim to split files.
- ✅ **No React Query behavior changes.** All query keys, caching, staleTime, invalidation preserved exactly.
- ✅ **No query key changes.** `vendorKeys` and `adminKeys` objects preserved identically.
- ✅ **No route changes.**
- ✅ **No UI redesign.**
- ✅ **No mass import rewriting.** All existing imports continue to work.
- ✅ **No deleting legacy files.** `api.js` and `useVendorAdminQueries.js` kept as re-exports.
- ✅ **No circular dependencies** (verified by `madge`).

---

## 2. What Was Inspected

### H1 — `src/services/api.js` (713 lines)

- **Full file read** (713 lines)
- **6 exported APIs identified:**
  - `productsApi` (lines 90-276) — 13 methods
  - `ordersApi` (lines 279-419) — 7 methods
  - `reviewsApi` (lines 422-502) — 5 methods
  - `vendorsApi` (lines 505-557) — 3 methods
  - `usersApi` (lines 560-630) — 6 methods
  - `analyticsApi` (lines 633-712) — 2 methods
- **Shared helpers identified:**
  - `getCurrentUserProfile` — used only by `productsApi.create`
  - `ORDER_DETAIL_SELECT` / `ORDER_DETAIL_SELECT_WITHOUT_IMAGES` — used only by `ordersApi.getById`
  - Product select constants — used only by `productsApi`
- **12 consumer files identified** importing from `@/services/api`:
  - `src/domains/catalog/queries.js` — `productsApi`
  - `src/domains/catalog/commands.js` — `productsApi`
  - `src/domains/ordering/queries.js` — `ordersApi`
  - `src/domains/ordering/commands.js` — `ordersApi`
  - `src/hooks/queries/useOrderQueries.js` — `ordersApi`
  - `src/hooks/queries/useProductQueries.js` — `productsApi`
  - `src/hooks/queries/useReviewQueries.js` — `reviewsApi`
  - `src/hooks/queries/useVendorAdminQueries.js` — `vendorsApi`, `usersApi`, `analyticsApi`
  - `src/modules/analytics/api/index.js` — `analyticsApi`
  - `src/modules/orders/api/index.js` — `ordersApi`
  - `src/modules/reviews/api/index.js` — `reviewsApi`
  - `src/pages/admin/Products.jsx` — `productsApi`

### H2 — `src/hooks/queries/useVendorAdminQueries.js` (157 lines)

- **Full file read** (157 lines)
- **Vendor hooks identified:**
  - `vendorKeys` — query key factory
  - `useVendors(filters, options)` — list vendors
  - `useVendor(id, options)` — single vendor
  - `useVendorStats(vendorId, options)` — vendor stats (uses `analyticsApi`)
  - `useUpdateVendor()` — update mutation
- **Admin hooks identified:**
  - `adminKeys` — query key factory
  - `useAdminUsers(filters, options)` — list users
  - `useAdminUser(id, options)` — single user
  - `useDeletedUsers(options)` — deleted users
  - `useAdminStats(options)` — admin stats (uses `analyticsApi`)
  - `useUpdateUser()` — update user mutation
  - `useDeleteUser()` — delete user mutation
  - `useRestoreUser()` — restore user mutation
- **2 consumer modules identified:**
  - `src/modules/admin/hooks/index.js` — admin hooks
  - `src/modules/analytics/hooks/index.js` — `useVendorStats`, `useAdminStats`
- **1 barrel file:**
  - `src/hooks/queries/index.js` — re-exports all vendor + admin hooks

---

## 3. What Was Changed

### H1 — Split `src/services/api.js` ✅ Fully Fixed

**Action:** Split the 713-line monolith into 7 new files under `src/services/apis/`, then converted `api.js` to a 26-line backward-compatible re-export.

**Strategy:**
- Each API was extracted to its own file with all imports, constants, and helpers it needs
- `getCurrentUserProfile` was moved to `productsApi.js` (only consumer)
- `ORDER_DETAIL_SELECT` / `ORDER_DETAIL_SELECT_WITHOUT_IMAGES` were moved to `ordersApi.js` (only consumer)
- Product select constants were moved to `productsApi.js` (only consumer)
- `api.js` now re-exports all 6 APIs from the split files
- All Supabase queries, retry logic, error handling, and return shapes preserved exactly

### H2 — Split `src/hooks/queries/useVendorAdminQueries.js` ✅ Fully Fixed

**Action:** Split the 157-line file into 2 new files, then converted `useVendorAdminQueries.js` to a 35-line backward-compatible re-export.

**Strategy:**
- Vendor hooks + `vendorKeys` extracted to `useVendorQueries.js`
- Admin hooks + `adminKeys` extracted to `useAdminQueries.js`
- `useVendorAdminQueries.js` now re-exports from both split files
- All React Query keys, caching, staleTime, invalidation, and mutation behavior preserved exactly

### Module Re-exports Updated

- `src/modules/orders/api/index.js` — `ordersApi` now re-exported from `@/services/apis/ordersApi`
- `src/modules/analytics/api/index.js` — `analyticsApi` now re-exported from `@/services/apis/analyticsApi`
- `src/modules/reviews/api/index.js` — `reviewsApi` now re-exported from `@/services/apis/reviewsApi`
- `src/modules/admin/hooks/index.js` — admin hooks now re-exported from `@/hooks/queries/useAdminQueries`
- `src/modules/analytics/hooks/index.js` — `useVendorStats` from `useVendorQueries`, `useAdminStats` from `useAdminQueries`
- `src/hooks/queries/index.js` — barrel now re-exports from split files instead of monolith

---

## 4. H1 Status: ✅ Fully Fixed

| Aspect | Status |
|---|---|
| `productsApi` extracted | ✅ `src/services/apis/productsApi.js` |
| `ordersApi` extracted | ✅ `src/services/apis/ordersApi.js` |
| `reviewsApi` extracted | ✅ `src/services/apis/reviewsApi.js` |
| `vendorsApi` extracted | ✅ `src/services/apis/vendorsApi.js` |
| `usersApi` extracted | ✅ `src/services/apis/usersApi.js` |
| `analyticsApi` extracted | ✅ `src/services/apis/analyticsApi.js` |
| Barrel `index.js` created | ✅ `src/services/apis/index.js` |
| `api.js` backward-compatible | ✅ Re-exports all 6 APIs |
| Existing imports work | ✅ All 12 consumers unchanged |
| Supabase queries unchanged | ✅ Copied verbatim |
| Behavior preserved | ✅ No logic changes |

---

## 5. H2 Status: ✅ Fully Fixed

| Aspect | Status |
|---|---|
| Vendor hooks extracted | ✅ `src/hooks/queries/useVendorQueries.js` |
| Admin hooks extracted | ✅ `src/hooks/queries/useAdminQueries.js` |
| `useVendorAdminQueries.js` backward-compatible | ✅ Re-exports from both split files |
| Existing imports work | ✅ All consumers unchanged |
| Query keys unchanged | ✅ `vendorKeys` and `adminKeys` identical |
| React Query behavior unchanged | ✅ staleTime, cacheTime, invalidation identical |
| Mutation behavior unchanged | ✅ All mutationFn and onSuccess handlers identical |

---

## 6. Files Created

| # | File | Lines | Purpose |
|---|---|---|---|
| 1 | `src/services/apis/productsApi.js` | 188 | Products API (13 methods) |
| 2 | `src/services/apis/ordersApi.js` | 148 | Orders API (7 methods) |
| 3 | `src/services/apis/reviewsApi.js` | 84 | Reviews API (5 methods) |
| 4 | `src/services/apis/vendorsApi.js` | 66 | Vendors API (3 methods) |
| 5 | `src/services/apis/usersApi.js` | 87 | Users API (6 methods) |
| 6 | `src/services/apis/analyticsApi.js` | 84 | Analytics API (2 methods) |
| 7 | `src/services/apis/index.js` | 22 | APIs barrel re-export |
| 8 | `src/hooks/queries/useVendorQueries.js` | 73 | Vendor hooks + vendorKeys |
| 9 | `src/hooks/queries/useAdminQueries.js` | 97 | Admin hooks + adminKeys |

**Total: 9 new files, 749 lines**

---

## 7. Files Modified

| # | File | Change | Lines Before | Lines After |
|---|---|---|---|---|
| 1 | `src/services/api.js` | Converted to re-export | 713 | 26 |
| 2 | `src/hooks/queries/useVendorAdminQueries.js` | Converted to re-export | 157 | 35 |
| 3 | `src/hooks/queries/index.js` | Updated barrel to use split files | 123 | 131 |
| 4 | `src/modules/orders/api/index.js` | Re-export from split file | 41 | 41 |
| 5 | `src/modules/analytics/api/index.js` | Re-export from split file | 97 | 97 |
| 6 | `src/modules/reviews/api/index.js` | Re-export from split file | 24 | 24 |
| 7 | `src/modules/admin/hooks/index.js` | Re-export from split file | 26 | 27 |
| 8 | `src/modules/analytics/hooks/index.js` | Re-export from split files | 14 | 15 |

**Total: 8 files modified**

---

## 8. Imports Changed

**Consumer imports:** 0 changed. All existing imports from `@/services/api` and `@/hooks/queries/useVendorAdminQueries` continue to work unchanged.

**Module re-export imports:** 6 updated to point to new split files (internal re-export paths only, no consumer-facing changes).

---

## 9. Backward Compatibility Verification

| Question | Answer |
|---|---|
| Does `@/services/api` remain backward-compatible? | ✅ Yes — re-exports all 6 APIs |
| Does `useVendorAdminQueries.js` remain backward-compatible? | ✅ Yes — re-exports all hooks + keys |
| Are Supabase queries unchanged? | ✅ Yes — copied verbatim |
| Are React Query keys unchanged? | ✅ Yes — `vendorKeys` and `adminKeys` identical |
| Is behavior preserved? | ✅ Yes — no logic changes |
| Are routes unchanged? | ✅ Yes — no route changes |
| Do all existing imports work? | ✅ Yes — 0 consumer imports changed |

---

## 10. Documentation Updates

### Documents Updated

| Document | Update | Details |
|---|---|---|
| `src/modules/orders/api/index.js` | Comment updated | Now references `@/services/apis/ordersApi` instead of `@/services/api` |
| `src/modules/analytics/api/index.js` | Comment updated | Now references `@/services/apis/analyticsApi` |
| `src/modules/reviews/api/index.js` | Comment updated | Now references `@/services/apis/reviewsApi` |
| `src/modules/admin/hooks/index.js` | Comment updated | Now references `@/hooks/queries/useAdminQueries` |
| `src/modules/analytics/hooks/index.js` | Comment updated | Now references split files |
| `src/hooks/queries/index.js` | Comment updated | Notes Phase 4.7 split |
| `src/services/api.js` | Header comment updated | Documents Phase 4.7 split and backward compatibility |
| `src/hooks/queries/useVendorAdminQueries.js` | Header comment updated | Documents Phase 4.7 split and backward compatibility |

### Documents Checked But Not Changed

| Document | Status | Notes |
|---|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | ✅ Current | No update needed — Phase 4.7 is a preparation step, not a new module |
| `ARCHITECTURE_GUIDE.md` | ✅ Current | No update needed — split is internal refactoring |
| `DEVELOPER_GUIDE.md` | ✅ Current | No update needed — import paths unchanged for consumers |
| `eslint.config.js` | ✅ Current | No update needed — `no-restricted-imports` rule still applies |
| `package.json` | ✅ Current | No new scripts or dependencies |
| All 18 module READMEs | ✅ Current | No changes — module public APIs unchanged |
| `docs/architecture/phase-4-final-gate-report.md` | ✅ Current | Historical record — H1 and H2 risks now resolved |

### Outdated Documents Found

None. All documentation is current.

### Documentation Still Needing Future Updates

| Document | Update Needed | Target Phase |
|---|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | Add Phase 4.7 completion to status line | Phase 5 start |
| `DEVELOPER_GUIDE.md` | Document `src/services/apis/` directory in project structure tree | Phase 5 |
| Module READMEs | Update migration candidates now that H1/H2 are resolved | Phase 5 |

---

## 11. Command Results

| Command | Result | Details |
|---|---|---|
| `npm run lint` | ✅ Exit code 0 | `eslint . --max-warnings 1500` — 0 errors, 0 warnings |
| `npm run type-check` | ✅ Exit code 0 | `tsc --noEmit` — no type errors |
| `npm run build` | ✅ Exit code 0 | `vite build` — built successfully |
| `npm run check:circular` | ✅ Exit code 0 | `madge --circular` — 697 files, 0 circular dependencies |

### madge File Count Progression

| Phase | Files Tracked | Circular Deps |
|---|---|---|
| Phase 4 Final Gate | 688 | 0 |
| **Phase 4.7** | **697** | **0** |

**+9 files** (7 new API files + 2 new hook files), 0 circular dependencies.

---

## 12. Whether It Is Safe to Start Phase 5.1 Import Adoption

### ✅ Yes — It is safe to start Phase 5.1 import adoption

**Justification:**

1. **H1 fully resolved** — `api.js` monolith split into 6 individual API files + barrel
2. **H2 fully resolved** — `useVendorAdminQueries.js` split into vendor and admin hook files
3. **All 4 verification commands pass** (lint, type-check, build, check:circular)
4. **0 circular dependencies** across 697 files
5. **Full backward compatibility** — all existing imports work unchanged
6. **No behavior changes** — all Supabase queries, React Query keys, and logic preserved
7. **Module re-exports updated** — orders, analytics, reviews, admin modules now point to split files
8. **No blocking risks remaining** from Phase 4 Final Gate

---

## 13. Recommended First Phase 5.1 Import Adoption Module

### Recommendation: `shared` module

**Rationale:**
- Lowest risk — no business logic, pure UI component and utility re-exports
- No Supabase queries
- No React Query hooks
- Clear boundaries already established
- Most widely imported module (UI components used everywhere)

**Second choice:** `auth` module — well-isolated, clear boundaries, ProtectedRoute stays in place.

---

## 14. Remaining Risks Before File Movement

| # | Risk | Severity | Description | Recommended Action |
|---|---|---|---|---|
| R1 | `ProtectedRoute.jsx` contains 5 layouts | High | AdminLayout, VendorLayout, DriverLayout, BuyerLayout, MainLayout all in one file | Split layouts before moving admin module files |
| R2 | `chatService.jsx` is a `.jsx` file | Medium | Contains both service and React component | Split `ChatComponent` into separate UI file before moving |
| R3 | `CheckoutSimplified.jsx` imports from 15+ services | High | Most coupled page in the app | Adopt checkout module imports before moving checkout files |
| R4 | `OrderDetail.jsx` imports from 10+ services | High | Highly coupled order page | Adopt orders module imports before moving order files |
| R5 | `paymentGateway.js` is 700 lines | High | Large payment monolith | Do not move until payments module is well-tested |
| R6 | 8 admin pages use Supabase directly | Medium | Direct `supabase.from(...)` calls | Document queries before moving admin pages |
| R7 | `ProductDetail.jsx` and `StoreDetail.jsx` use Supabase directly | Medium | Direct `supabase.from(...)` calls | Document queries before moving catalog/marketplace pages |
| R8 | `vendor/Products.jsx` uses Supabase directly | Medium | Direct `supabase.from(...)` calls | Document queries before moving catalog pages |
| R9 | `vendor/Coupons.jsx` uses Supabase directly | Medium | Direct `supabase.from(...)` calls | Document queries before moving coupons pages |
| R10 | `commissionService.js` cross-module dependency | Medium | Imports from `notifications` and `commissionNotifications` | Preserve cross-module import via public API when moving |

---

## 15. Files That Must Not Be Moved Yet

| File | Reason | When to Move |
|---|---|---|
| `src/components/ProtectedRoute.jsx` | Contains 5 layouts + role enforcement | Phase 5+ after splitting layouts |
| `src/services/paymentGateway.js` | 700-line payment monolith | Phase 5+ after payments module well-tested |
| `src/services/paymentService.js` | Critical payment service | Phase 5+ after payments module well-tested |
| `src/services/commissionService.js` | Critical commission service with cross-module deps | Phase 5+ after commissions module well-tested |
| `src/services/checkoutService.js` | Critical checkout service | Phase 5+ after checkout module well-tested |
| `src/pages/CheckoutSimplified.jsx` | Most coupled page | Phase 5+ after checkout imports adopted |
| `src/pages/OrderDetail.jsx` | Highly coupled | Phase 5+ after orders imports adopted |
| `src/services/chatService.jsx` | `.jsx` file with React component | Phase 5+ after splitting component |
| `src/services/realtime.js` | Depends on `realtimeManager.js` | Phase 5+ — move together |
| `src/services/realtimeManager.js` | Paired with `realtime.js` | Phase 5+ — move together |

---

## 16. Conclusion

### Phase 4.7: ✅ Completed

**Summary:**
- H1 (`api.js` monolith): ✅ Fully fixed — split into 7 files under `src/services/apis/`
- H2 (`useVendorAdminQueries.js` mixed hooks): ✅ Fully fixed — split into `useVendorQueries.js` + `useAdminQueries.js`
- 9 new files created, 8 files modified
- 0 consumer imports changed
- 0 behavior changes
- 0 Supabase query changes
- 0 React Query key changes
- 0 circular dependencies (697 files)
- All 4 verification commands pass
- Module re-exports updated to point to split files
- Full backward compatibility maintained

**It is safe to start Phase 5.1 import adoption.**

**Recommended first module:** `shared` (lowest risk, no business logic, no Supabase queries).
