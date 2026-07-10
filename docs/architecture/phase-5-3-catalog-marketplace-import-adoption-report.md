# Phase 5.3 — Safe Import Adoption Report (catalog, marketplace)

**Phase:** 5.3 — Safe Import Adoption (catalog, marketplace)
**Date:** 2026-06-24
**Status:** ✅ Completed
**Approach:** Small, safe, reversible import-path migration — no behavior changes, no file movement, no legacy path deletion

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` was read in full and strictly followed throughout this phase.

Key rules respected:

- ✅ **Rule 1 (Minimal changes):** Only import-path changes — no files moved, no files deleted, no business logic changed.
- ✅ **No `any`, no `@ts-ignore`, no `@ts-expect-error`** — not needed.
- ✅ **No product behavior changes** — product CRUD, approval, images, search all unchanged.
- ✅ **No marketplace behavior changes** — browsing, filtering, sorting all unchanged.
- ✅ **No store/vendor behavior changes** — store type service, visibility helpers unchanged.
- ✅ **No search/filter behavior changes** — search service, algolia service unchanged.
- ✅ **No ProductDetail/StoreDetail behavior changes** — both files untouched.
- ✅ **No Supabase queries changed.**
- ✅ **No React Query keys changed.**
- ✅ **No route changes.**
- ✅ **No UI redesign.**
- ✅ **No mass import rewriting.** Only 8 files in a controlled batch.
- ✅ **No deleting legacy files.** All old service files remain in place.
- ✅ **No circular dependencies** (verified by `madge`).
- ✅ **No deep module imports** (verified by grep — no `@/modules/<name>/<subdir>` patterns found).

---

## 2. What Was Inspected

### Module Public APIs

| Module | Public API File | Key Exports Verified |
|---|---|---|
| `@/modules/catalog` | `src/modules/catalog/index.js` | `productSelects`, `listProducts`, `getProductById`, `insertProduct`, `updateProductById`, `listDeletedProducts`, `listPendingProducts`, `updateManyProducts`, `fetchProducts`, `fetchProductById`, `fetchAvailableRegions`, `isProductImagesRelationError`, `mergeProductImages`, `hydrateProductsWithImages`, `runProductImageFallbackQuery`, `productSearchService`, `buildProductSearchFiltersFromParams`, `normalizeProductSearchFilters`, `normalizeSearchProduct`, `buildApprovalPayload`, `buildSuspensionPayload`, `buildRejectionPayload`, `buildSoftDeletePayload`, `buildRestorePayload`, `PRODUCT_CATEGORIES`, `MAIN_CATEGORIES`, `getSuggestedSubcategories`, `getCategoryById`, `getCategoryIds`, `getCategoryLabel`, `ProductCard`, `ProductForm`, `ImageUploader`, `ProductDetailPage`, `VendorProductsPage`, `AdminProductsPage`, `useProducts`, `useAvailableRegions`, `useProductById`, `productsQueryKey`, `productQueryKey` |
| `@/modules/marketplace` | `src/modules/marketplace/index.js` | `algoliaService`, `storeTypeService`, `STORE_TYPE_RULES`, `DELIVERY_OPTION_META`, `MOROCCAN_SEASONS`, `ARABIC_MONTHS`, `getProductsInMonth`, `getPeakProducts`, `getAvailabilityStatus`, `isPublicVendorVisible`, `isPublicProductVisible`, `MarketplacePage`, `StoresPage`, `StoreDetailPage`, `SearchResultsPage`, `SeasonalPage`, `SearchBar`, `productKeys`, `reviewKeys`, `useProducts`, `useProduct`, `usePendingProducts`, `useDeletedProducts`, `useInfiniteProducts`, `useCreateProduct`, `useUpdateProduct`, `useDeleteProduct`, `useRestoreProduct`, `useApproveProduct`, `useRejectProduct`, `useBulkApproveProducts`, `useBulkRejectProducts`, `useVendorReviews`, `useDeletedReviews`, `useCreateReview`, `useDeleteReview`, `useRestoreReview` |

### Current Imports Surveyed

| Import Pattern | Files Found | Migration Candidates |
|---|---|---|
| `from '@/constants/categories'` | 7 files | 5 safe (Seasonal, SearchResults, Marketplace, vendor/RFQs, buyer/RFQ) — skipped ProductDetail (high-risk), vendor/Products (high-risk), catalog/domain re-export (internal) |
| `from '@/constants/seasonalCalendar'` | 2 files | 1 safe (Seasonal.jsx) — skipped marketplace/domain re-export (internal) |
| `from '@/business/productLogic'` | 3 files | 1 safe (test) — skipped catalog/domain re-export (internal), services/apis/productsApi (internal) |
| `from '@/hooks/useProducts'` | 2 files | 1 safe (Marketplace.jsx) — skipped catalog/hooks re-export (internal) |
| `from '@/services/storeTypeService'` | 7 files | 1 safe (test) — skipped high-risk files (StoreDetail, CheckoutSimplified, vendor/Settings, vendor/DeliveryOptionSetup, vendor/VendorProfile, StoreEvolutionNotification) and marketplace/api re-export (internal) |
| `from '@/services/search/algoliaService'` | 2 files | 1 safe (SearchBar.jsx) — skipped marketplace/api re-export (internal) |
| `from '@/services/search/productSearchService'` | 3 files | 1 safe (SearchResults.jsx) — skipped catalog/api re-export (internal), productSearchService itself (uses publicVisibility internally) |
| `from '@/utils/publicVisibility'` | 5 files | 0 safe — test imports `filterPublicProducts`/`filterPublicVendors` (NOT exported from marketplace); others are high-risk or internal |
| `from '@/components/Search/SearchBar'` | 3 files | 2 safe (SearchResults, Marketplace) — skipped marketplace/ui re-export (internal) |
| `from '@/hooks/queries/useProductQueries'` | 1 file | 0 — only marketplace/hooks re-export (internal), already imports from useProductQueries |
| `from '@/services/apis/productsApi'` | 0 files | None found |

### Files Inspected But Intentionally Skipped

| File | Reason Skipped |
|---|---|
| `src/pages/ProductDetail.jsx` | High-risk — explicitly forbidden in task scope |
| `src/pages/StoreDetail.jsx` | High-risk — explicitly forbidden in task scope |
| `src/pages/vendor/Products.jsx` | High-risk — explicitly forbidden in task scope |
| `src/pages/admin/Products.jsx` | High-risk — admin page, explicitly forbidden |
| `src/pages/CheckoutSimplified.jsx` | High-risk — explicitly forbidden in task scope |
| `src/pages/OrderDetail.jsx` | High-risk — explicitly forbidden in task scope |
| `src/components/ProtectedRoute.jsx` | High-risk — explicitly forbidden in task scope |
| `src/services/paymentGateway.js` | High-risk — explicitly forbidden in task scope |
| `src/services/paymentService.js` | High-risk — explicitly forbidden in task scope |
| `src/services/commissionService.js` | High-risk — explicitly forbidden in task scope |
| `src/services/checkoutService.js` | High-risk — explicitly forbidden in task scope |
| `src/services/notifications.js` | High-risk — explicitly forbidden in task scope |
| `src/services/realtime.js` | High-risk — explicitly forbidden in task scope |
| `src/pages/admin/*` | High-risk — explicitly forbidden in task scope |
| `src/components/vendor/StoreEvolutionNotification.jsx` | Uses `storeTypeService` default import + `useAuthStore` — not trivial, skipped to stay within 8-file limit |
| `src/pages/vendor/DeliveryOptionSetup.jsx` | Uses `storeTypeService` + `DELIVERY_OPTION_META` — vendor page, medium-risk |
| `src/pages/vendor/VendorProfile.jsx` | Uses `storeTypeService` + `isPublicVendorVisible` — vendor page, medium-risk |
| `src/pages/vendor/Settings.jsx` | Uses `storeTypeService` — vendor settings, medium-risk |
| `src/__tests__/utils/publicVisibility.test.js` | Imports `filterPublicProducts` and `filterPublicVendors` which are NOT exported from `@/modules/marketplace` — would require adding exports |
| `src/services/search/productSearchService.js` | Internal — imports `publicVisibility` helpers, not a consumer migration |
| `src/modules/catalog/domain/index.js` | Internal module re-export |
| `src/modules/catalog/api/index.js` | Internal module re-export |
| `src/modules/catalog/hooks/index.js` | Internal module re-export |
| `src/modules/marketplace/domain/index.js` | Internal module re-export |
| `src/modules/marketplace/api/index.js` | Internal module re-export |
| `src/modules/marketplace/hooks/index.js` | Internal module re-export — already updated in Phase 5.1 |
| `src/services/apis/productsApi.js` | Internal — imports from `@/business/productLogic`, not a consumer |

---

## 3. Files Migrated (8 files)

| # | File | Old Imports | New Imports | Module |
|---|---|---|---|---|
| 1 | `src/__tests__/business/productLogic.test.ts` | `from '@/business/productLogic'` | `from '@/modules/catalog'` | catalog |
| 2 | `src/__tests__/services/storeTypeService.test.js` | `from '@/services/storeTypeService'` | `from '@/modules/marketplace'` | marketplace |
| 3 | `src/pages/Seasonal.jsx` | `from '@/constants/seasonalCalendar'`, `from '@/constants/categories'` | `from '@/modules/marketplace'` (seasonal), `from '@/modules/catalog'` (PRODUCT_CATEGORIES) | marketplace + catalog |
| 4 | `src/pages/SearchResults.jsx` | `from '@/components/Search/SearchBar'`, `from '@/components/ui'` (ProductCard), `from '@/constants/categories'`, `from '@/services/search/productSearchService'` | `from '@/modules/marketplace'` (SearchBar), `from '@/modules/catalog'` (ProductCard, PRODUCT_CATEGORIES, getCategoryLabel, getSuggestedSubcategories, productSearchService) | catalog + marketplace |
| 5 | `src/pages/Marketplace.jsx` | `from '@/components/ui'` (ProductCard), `from '@/components/Search/SearchBar'`, `from '@/constants/categories'`, `from '@/hooks/useProducts'` | `from '@/modules/catalog'` (ProductCard, PRODUCT_CATEGORIES, getCategoryLabel, getSuggestedSubcategories, useAvailableRegions, useProducts), `from '@/modules/marketplace'` (SearchBar) | catalog + marketplace |
| 6 | `src/pages/vendor/RFQs.jsx` | `from '@/constants/categories'` | `from '@/modules/catalog'` | catalog |
| 7 | `src/pages/buyer/RFQ.jsx` | `from '@/constants/categories'` | `from '@/modules/catalog'` | catalog |
| 8 | `src/components/Search/SearchBar.jsx` | `from '@/services/search/algoliaService'` | `from '@/modules/marketplace'` | marketplace |

---

## 4. Imports Changed (Detailed)

### File 1: `src/__tests__/business/productLogic.test.ts`

```diff
- import {
-   buildApprovalPayload,
-   buildRejectionPayload,
-   buildRestorePayload,
-   buildSoftDeletePayload,
-   buildSuspensionPayload,
- } from '@/business/productLogic'
+ import {
+   buildApprovalPayload,
+   buildRejectionPayload,
+   buildRestorePayload,
+   buildSoftDeletePayload,
+   buildSuspensionPayload,
+ } from '@/modules/catalog'
```

### File 2: `src/__tests__/services/storeTypeService.test.js`

```diff
- import {
-   decorateStoreProfile,
-   resolveOrderDeliveryStrategy,
- } from '@/services/storeTypeService'
+ import {
+   decorateStoreProfile,
+   resolveOrderDeliveryStrategy,
+ } from '@/modules/marketplace'
```

### File 3: `src/pages/Seasonal.jsx`

```diff
- import {
-   MOROCCAN_SEASONS,
-   ARABIC_MONTHS,
-   getProductsInMonth,
-   getPeakProducts,
-   getAvailabilityStatus,
- } from '@/constants/seasonalCalendar'
- import { PRODUCT_CATEGORIES } from '@/constants/categories'
+ import {
+   MOROCCAN_SEASONS,
+   ARABIC_MONTHS,
+   getProductsInMonth,
+   getPeakProducts,
+   getAvailabilityStatus,
+ } from '@/modules/marketplace'
+ import { PRODUCT_CATEGORIES } from '@/modules/catalog'
```

### File 4: `src/pages/SearchResults.jsx`

```diff
- import SearchBar from '@/components/Search/SearchBar'
- import { ProductCard } from '@/components/ui'
- import { PRODUCT_CATEGORIES, getCategoryLabel, getSuggestedSubcategories } from '@/constants/categories'
- import productSearchService from '@/services/search/productSearchService'
+ import { SearchBar } from '@/modules/marketplace'
+ import { ProductCard, PRODUCT_CATEGORIES, getCategoryLabel, getSuggestedSubcategories, productSearchService } from '@/modules/catalog'
```

**Note:** `SearchBar` was a default import from `@/components/Search/SearchBar` and is a named export from `@/modules/marketplace`. `productSearchService` was a default import from `@/services/search/productSearchService` and is a named export from `@/modules/catalog`. Usage in the file remains identical.

### File 5: `src/pages/Marketplace.jsx`

```diff
- import { ProductCard, EmptyState, StateSkeleton as Skeleton } from '@/components/ui'
- import ErrorBoundary from '@/components/ErrorBoundary'
- import SearchBar from '@/components/Search/SearchBar'
- import { PRODUCT_CATEGORIES, getCategoryLabel, getSuggestedSubcategories } from '@/constants/categories'
- import { getDisplayErrorMessage } from '@/utils/errorHandler'
- import { useAvailableRegions, useProducts } from '@/hooks/useProducts'
+ import { ProductCard, PRODUCT_CATEGORIES, getCategoryLabel, getSuggestedSubcategories, useAvailableRegions, useProducts } from '@/modules/catalog'
+ import { EmptyState, StateSkeleton as Skeleton } from '@/components/ui'
+ import ErrorBoundary from '@/components/ErrorBoundary'
+ import { SearchBar } from '@/modules/marketplace'
+ import { getDisplayErrorMessage } from '@/utils/errorHandler'
```

**Note:** `ProductCard` was imported from `@/components/ui` and is exported from `@/modules/catalog`. `EmptyState` and `StateSkeleton` remain from `@/components/ui` as they are shared UI components (available via `@/modules/shared` but not migrated in this phase to keep changes minimal). `SearchBar` changed from default to named import.

### File 6: `src/pages/vendor/RFQs.jsx`

```diff
- import { PRODUCT_CATEGORIES } from '@/constants/categories'
+ import { PRODUCT_CATEGORIES } from '@/modules/catalog'
```

### File 7: `src/pages/buyer/RFQ.jsx`

```diff
- import { PRODUCT_CATEGORIES } from '@/constants/categories'
+ import { PRODUCT_CATEGORIES } from '@/modules/catalog'
```

### File 8: `src/components/Search/SearchBar.jsx`

```diff
- import { algoliaService } from '@/services/search/algoliaService'
+ import { algoliaService } from '@/modules/marketplace'
```

---

## 5. Files Intentionally Skipped and Why

| # | File | Skip Reason |
|---|---|---|
| 1 | `src/pages/ProductDetail.jsx` | Explicitly forbidden — high-risk |
| 2 | `src/pages/StoreDetail.jsx` | Explicitly forbidden — high-risk |
| 3 | `src/pages/vendor/Products.jsx` | Explicitly forbidden — high-risk |
| 4 | `src/pages/admin/Products.jsx` | Explicitly forbidden — admin page |
| 5 | `src/pages/CheckoutSimplified.jsx` | Explicitly forbidden — high-risk |
| 6 | `src/pages/OrderDetail.jsx` | Explicitly forbidden — high-risk |
| 7 | `src/components/ProtectedRoute.jsx` | Explicitly forbidden — high-risk |
| 8 | `src/services/paymentGateway.js` | Explicitly forbidden — high-risk |
| 9 | `src/services/paymentService.js` | Explicitly forbidden — high-risk |
| 10 | `src/services/commissionService.js` | Explicitly forbidden — high-risk |
| 11 | `src/services/checkoutService.js` | Explicitly forbidden — high-risk |
| 12 | `src/services/notifications.js` | Explicitly forbidden — high-risk |
| 13 | `src/services/realtime.js` | Explicitly forbidden — high-risk |
| 14 | `src/pages/admin/*` | Explicitly forbidden — admin pages |
| 15 | `src/components/vendor/StoreEvolutionNotification.jsx` | Uses `storeTypeService` default import + `useAuthStore` — not trivial enough for this batch |
| 16 | `src/pages/vendor/DeliveryOptionSetup.jsx` | Uses `storeTypeService` + `DELIVERY_OPTION_META` — vendor page, medium-risk |
| 17 | `src/pages/vendor/VendorProfile.jsx` | Uses `storeTypeService` + `isPublicVendorVisible` — vendor page, medium-risk |
| 18 | `src/pages/vendor/Settings.jsx` | Uses `storeTypeService` — vendor settings, medium-risk |
| 19 | `src/__tests__/utils/publicVisibility.test.js` | Imports `filterPublicProducts`/`filterPublicVendors` NOT exported from `@/modules/marketplace` — would require adding exports |
| 20 | `src/services/search/productSearchService.js` | Internal — imports publicVisibility helpers, not a consumer |
| 21 | `src/modules/catalog/domain/index.js` | Internal module re-export |
| 22 | `src/modules/catalog/api/index.js` | Internal module re-export |
| 23 | `src/modules/catalog/hooks/index.js` | Internal module re-export |
| 24 | `src/modules/marketplace/domain/index.js` | Internal module re-export |
| 25 | `src/modules/marketplace/api/index.js` | Internal module re-export |
| 26 | `src/modules/marketplace/hooks/index.js` | Internal module re-export — already updated in Phase 5.1 |
| 27 | `src/services/apis/productsApi.js` | Internal — imports from `@/business/productLogic`, not a consumer |

---

## 6. Backward Compatibility Verification

| Question | Answer |
|---|---|
| Do old imports still work? | ✅ Yes — `@/constants/categories`, `@/constants/seasonalCalendar`, `@/business/productLogic`, `@/hooks/useProducts`, `@/services/search/productSearchService`, `@/services/search/algoliaService`, `@/services/storeTypeService`, `@/components/Search/SearchBar`, `@/components/ui` (ProductCard) all remain unchanged |
| Were any files moved? | ✅ No — no files moved |
| Were any legacy paths deleted? | ✅ No — all old service files and import paths remain |
| Did product behavior change? | ✅ No — only import paths replaced, same exported values |
| Did marketplace behavior change? | ✅ No — browsing, filtering, sorting all unchanged |
| Did store/vendor behavior change? | ✅ No — storeTypeService, visibility helpers unchanged |
| Did search/filter behavior change? | ✅ No — search service, algolia service unchanged |
| Did ProductDetail/StoreDetail behavior change? | ✅ No — both files untouched |
| Are Supabase queries unchanged? | ✅ Yes — no queries touched |
| Are routes unchanged? | ✅ Yes — no route changes |
| Were any deep module imports introduced? | ✅ No — verified by grep, no `@/modules/<name>/<subdir>` patterns found |

---

## 7. No Deep Module Imports Verification

A grep search for `from '@/modules/(catalog|marketplace)/` across all `src/**/*.{js,jsx,ts,tsx}` files returned **0 results**. All module imports use the public API root only (`@/modules/catalog`, `@/modules/marketplace`).

---

## 8. Documentation Updates

### Documents Updated

| Document | Update | Details |
|---|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | Status line updated | Added Phase 5.3 completion to status line |
| `MODULAR_DEVELOPMENT_PLAN.md` | Phase 5.3 completion note added | Added after Phase 5.2 note, documenting 8 files migrated and verification results |

### Documents Checked But Not Changed

| Document | Status | Notes |
|---|---|---|
| `ARCHITECTURE_GUIDE.md` | ✅ Current | No update needed — import adoption is internal refactoring |
| `DEVELOPER_GUIDE.md` | ✅ Current | No update needed — consumer-facing import paths are optional |
| `eslint.config.js` | ✅ Current | `no-restricted-imports` rule already enforces module boundaries |
| `package.json` | ✅ Current | No new scripts or dependencies |
| `src/modules/catalog/README.md` | ✅ Current | Public API unchanged — still re-exports same data/api/domain/ui/hooks |
| `src/modules/marketplace/README.md` | ✅ Current | Public API unchanged — still re-exports same api/domain/ui/hooks |
| `src/modules/shared/README.md` | ✅ Current | Not relevant to this phase |
| `src/modules/reviews/README.md` | ✅ Current | Not relevant to this phase |
| `src/modules/cart/README.md` | ✅ Current | Not relevant to this phase |
| `.windsurfrules` | ✅ Current | No rules need updating |

### Outdated Documents Found

None. All documentation is current.

### Documentation Still Needing Future Updates

| Document | Update Needed | Target Phase |
|---|---|---|
| `src/modules/catalog/README.md` | Update migration status — 6 files now import from `@/modules/catalog` | Phase 5.4+ |
| `src/modules/marketplace/README.md` | Update migration status — 4 files now import from `@/modules/marketplace` | Phase 5.4+ |
| `DEVELOPER_GUIDE.md` | Document `src/services/apis/` directory in project structure tree | Phase 5.4+ |

---

## 9. Command Results

| Command | Result | Details |
|---|---|---|
| `npm run lint` | ✅ Exit code 0 | `eslint . --max-warnings 1500` — 0 errors, 0 warnings |
| `npm run type-check` | ✅ Exit code 0 | `tsc --noEmit` — no type errors |
| `npm run build` | ✅ Exit code 0 | `vite build` — built successfully in 1m 57s |
| `npm run check:circular` | ✅ Exit code 0 | `madge --circular` — 0 circular dependencies |

### madge File Count

| Phase | Files Tracked | Circular Deps |
|---|---|---|
| Phase 5.2 | 697 | 0 |
| **Phase 5.3** | **697** | **0** |

No new files created — only import paths changed in existing files. File count unchanged.

---

## 10. Whether It Is Safe to Continue to Phase 5.4

### ✅ Yes — It is safe to continue to Phase 5.4 import adoption

**Justification:**

1. **8 files successfully migrated** with only import-path changes
2. **All 4 verification commands pass** (lint, type-check, build, check:circular)
3. **0 circular dependencies** across 697 files
4. **Full backward compatibility** — all old import paths remain working
5. **No behavior changes** — same exported values, same Supabase queries, same React Query keys
6. **No deep module imports** introduced (verified by grep)
7. **No files moved or deleted**
8. **Product-critical files untouched** — ProductDetail, StoreDetail, vendor/Products all unchanged
9. **Marketplace pages now import from module public APIs** — Marketplace.jsx, SearchResults.jsx, Seasonal.jsx all use `@/modules/catalog` and `@/modules/marketplace`
10. **SearchBar component** now imports `algoliaService` from `@/modules/marketplace` — demonstrates marketplace module adoption works correctly in component-level code
11. **Default-to-named import conversions** (SearchBar, productSearchService, storeTypeService) all work correctly — same exported values, different import style

---

## 11. Recommended Phase 5.4 Import Adoption Modules

### Primary recommendation: `notifications` + `cart`

**Rationale:**
- `notifications` module re-exports notification API, hooks, components, and preference helpers
- `cart` module re-exports cartStore, favoritesStore, Cart, Favorites, cartQuantity, favoritesApi
- Notification-related components (NotificationLink) and cart-related components are good candidates
- Low risk — notification and cart imports are mostly isolated
- `NotificationLink.jsx` already imports `useAuthStore` (migrated in Phase 5.2) and `DEFAULT_NOTIFICATION_PREFERENCES` from `@/services/notificationPreferences`

### Secondary recommendation: `orders` + `delivery`

**Rationale:**
- `orders` module re-exports ordersService, orderLogic, ordersApi, order hooks, order pages
- `delivery` module re-exports deliveriesApi, delivery services, driver pages
- Order-related pages and delivery-related components are candidates
- Medium risk — some pages use Supabase directly

---

## 12. Remaining Risks Before File Movement

| # | Risk | Severity | Description | Recommended Action |
|---|---|---|---|---|
| R1 | `ProtectedRoute.jsx` contains 5 layouts | High | AdminLayout, VendorLayout, DriverLayout, BuyerLayout, MainLayout all in one file | Split layouts before moving auth module files |
| R2 | `authStore.js` imports from 4+ services | High | Auth store imports phoneOtpService, authRedirects, supabase | Decouple auth store before moving |
| R3 | `authSessionStore.js` is 577 lines | High | Complex session management with cart/favorites coupling | Split and decouple before moving |
| R4 | `authActionsService.js` is 755 lines | High | Has cart/favorites coupling for logout cleanup | Move cleanup to orchestrator before moving |
| R5 | `CheckoutSimplified.jsx` imports from 15+ services | High | Most coupled page in the app | Adopt checkout module imports before moving |
| R6 | `OrderDetail.jsx` imports from 10+ services | High | Highly coupled order page | Adopt orders module imports before moving |
| R7 | `paymentGateway.js` is 700 lines | High | Large payment monolith | Do not move until payments module is well-tested |
| R8 | `ProductDetail.jsx` is 1116 lines | High | Very complex — imports cart, delivery, inventory, reviews, refund | Decompose before moving |
| R9 | `StoreDetail.jsx` is 1288 lines | High | Very complex — imports productImages, storeTypeService, authStore, publicVisibility | Decompose before moving |
| R10 | `vendor/Products.jsx` is 1285 lines | High | Complex — imports PayPal eligibility, product CRUD | Decompose before moving |
| R11 | 8 admin pages use Supabase directly | Medium | Direct `supabase.from(...)` calls | Document queries before moving admin pages |
| R12 | `vendor/Coupons.jsx` uses Supabase directly | Medium | Direct `supabase.from(...)` calls | Document queries before moving coupons pages |
| R13 | `commissionService.js` cross-module dependency | Medium | Imports from `notifications` and `commissionNotifications` | Preserve cross-module import via public API when moving |
| R14 | Internal module re-exports still point to old paths | Low | `src/modules/catalog/domain/index.js` still imports from `@/constants/categories`; `src/modules/marketplace/domain/index.js` still imports from `@/constants/seasonalCalendar` | Update internal re-exports in Phase 5.4+ to point to split files |
| R15 | `publicVisibility.test.js` imports non-exported helpers | Low | `filterPublicProducts`/`filterPublicVendors` not exported from `@/modules/marketplace` | Add missing exports to marketplace module public API in future phase |
| R16 | `StoreEvolutionNotification.jsx` uses storeTypeService | Low | Default import from `@/services/storeTypeService` — can be migrated in next batch | Migrate in Phase 5.4 |
| R17 | `vendor/DeliveryOptionSetup.jsx` uses storeTypeService + DELIVERY_OPTION_META | Low | Can be migrated in next batch | Migrate in Phase 5.4 |
| R18 | `vendor/VendorProfile.jsx` uses storeTypeService + isPublicVendorVisible | Low | Can be migrated in next batch — but `isPublicVendorVisible` is exported from marketplace | Migrate in Phase 5.4 |
| R19 | `vendor/Settings.jsx` uses storeTypeService | Low | Can be migrated in next batch | Migrate in Phase 5.4 |
| R20 | `productSearchService.js` imports publicVisibility internally | Low | Internal coupling between catalog search and marketplace visibility | Document and resolve in future phase |

---

## 13. Conclusion

### Phase 5.3: ✅ Completed

**Summary:**
- 8 files migrated to use `@/modules/catalog` and `@/modules/marketplace`
- 0 files moved
- 0 files deleted
- 0 behavior changes
- 0 product behavior changes
- 0 marketplace behavior changes
- 0 store/vendor behavior changes
- 0 search/filter behavior changes
- 0 ProductDetail/StoreDetail behavior changes
- 0 Supabase query changes
- 0 React Query key changes
- 0 circular dependencies (697 files)
- 0 deep module imports introduced
- All 4 verification commands pass
- Full backward compatibility maintained
- All old import paths remain working

**It is safe to continue to Phase 5.4.**

**Recommended Phase 5.4 modules:** `notifications` + `cart` (primary), `orders` + `delivery` (secondary).
