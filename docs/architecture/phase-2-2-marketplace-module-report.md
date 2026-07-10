# Phase 2.2 — Marketplace Module Foundation Report

**Date:** 2026-06-22  
**Project:** Greenmarket / Qotoof  
**Phase:** 2.2 — Marketplace Module Foundation  
**Purpose:** Create `src/modules/marketplace/` as the public marketplace browsing module layer using re-exports only.

---

## 1. Confirmation: `.windsurfrules` Read and Followed

✅ `.windsurfrules` was read in full during Phase 0.5 and re-consulted before this phase.

Key rules respected:

- **Rule 1 (Minimal changes):** 8 new files created, 0 files moved, 0 files deleted, 0 imports changed.
- **Rule 30 (Stop and ask):** No Supabase/RLS/Auth/Database/Payments/migrations touched.
- **No `any`, no `@ts-ignore`, no `@ts-expect-error`** — not needed.
- **No business logic changes.** No UI redesign. No route changes. No mass import rewriting.
- **No circular dependencies** introduced (verified by `madge`).

---

## 2. Current Marketplace Architecture Summary

### Product Listing (Marketplace Page)
- **`Marketplace.jsx`** (481 lines, `src/pages/`) — Main marketplace browsing page. Uses `useProducts` from `@/hooks/useProducts` (catalog), `SearchBar` component, `ProductCard` from `@/components/ui`, `PRODUCT_CATEGORIES` from `@/constants/categories`. Filters via URL search params. Pagination at 12 items/page.

### Store Listing
- **`Stores.jsx`** (303 lines, `src/pages/`) — Store/vendor listing page. Queries `profilesService` and `supabase` directly for vendor profiles. Uses `public_profiles` indirectly via `profilesService`. Has own filter/sort/pagination (10 items/page). Moroccan cities filter, category filter, sort by rating/newest/most_orders.

### Store Detail
- **`StoreDetail.jsx`** (1288 lines, `src/pages/`) — Vendor storefront page. Imports: `supabase`, `runProductImageFallbackQuery` (catalog), `storeTypeService`, `ProductCard` (catalog), `authStore`, `publicVisibility`, `sanitizePostgRESTFilter`. Shows vendor info + products + reviews. Complex page with many cross-concern imports.

### Product Detail
- **`ProductDetail.jsx`** (1116 lines, `src/pages/`) — Product detail browsing page. Imports: `cartStore`, `authStore`, `supabase`, `runProductImageFallbackQuery`, `inventoryService`, `reviewService`, `refundPolicyService`, `checkDeliveryEligibility`, `getCategoryLabel`. **Very complex** — imports cart, delivery, inventory, reviews, refund concerns. NOT re-exported from marketplace (documented as migration candidate).

### Search
- **`SearchResults.jsx`** (388 lines, `src/pages/`) — Search results page. Uses `productSearchService` (catalog), `SearchBar`, `ProductCard`, `PRODUCT_CATEGORIES`. Algolia-based search with PostgREST fallback.
- **`SearchBar.jsx`** (182 lines, `src/components/Search/`) — Reusable search bar with autocomplete suggestions. Uses `algoliaService` for suggestions.

### Seasonal Calendar
- **`Seasonal.jsx`** (325 lines, `src/pages/`) — Morocco seasonal agricultural calendar page. Uses `seasonalCalendar` constants and `PRODUCT_CATEGORIES`. Public browsing page.

### Marketplace Query Hooks
- **`useMarketplaceQueries.js`** (315 lines, `src/hooks/queries/`) — **MIXED file**: contains product queries, order queries, and review queries. Uses `productsApi`, `ordersApi`, `reviewsApi` from `@/services/api`. Only product and review hooks re-exported here; order hooks excluded (belong to orders module).

### Store Type Service
- **`storeTypeService.js`** (328 lines, `src/services/`) — Store classification rules (small/medium/enterprise) and delivery option metadata. Used by `StoreDetail.jsx`.

### Search Services
- **`algoliaService.js`** (43 lines, `src/services/search/`) — Thin wrapper around `productSearchService`. Used by `SearchBar.jsx`.
- **`productSearchService.js`** (421 lines, `src/services/search/`) — Already re-exported by catalog module.

### Public Visibility
- **`publicVisibility.js`** (65 lines, `src/utils/`) — Filters experimental/demo vendors and products from public view. `isPublicVendorVisible`, `isPublicProductVisible`. Used by `StoreDetail.jsx` and `productSearchService.js`.

### Routes
- `/marketplace` → MarketplacePage
- `/product/:id` and `/products/:id` → ProductDetailPage
- `/stores` → StoresPage
- `/stores/:id` → StoreDetailPage
- `/search` → SearchResultsPage
- `/marketplace/seasonal` → SeasonalPage

### Mock Data
- No mock marketplace data found. All data comes from Supabase or Algolia.

---

## 3. What Marketplace Files Were Created

```
src/modules/marketplace/
├── index.js              ← Public API entry point
├── api/
│   └── index.js          ← Algolia service, store type service
├── domain/
│   └── index.js          ← Seasonal calendar, public visibility helpers
├── ui/
│   └── index.js          ← Marketplace, Stores, StoreDetail, SearchResults, Seasonal, SearchBar
├── hooks/
│   └── index.js          ← Product and review query hooks
├── stores/
│   └── index.js          ← Placeholder (no marketplace store yet)
├── utils/
│   └── index.js          ← Placeholder (future marketplace utilities)
└── README.md             ← Module documentation
```

**8 new files created.**

---

## 4. Files Moved

**None.** No files were moved. This is an additive, re-export-only step.

---

## 5. Files Re-Exported/Wrapped

### API / Services
| Export | Source |
|---|---|
| `algoliaService` | `@/services/search/algoliaService` |
| `storeTypeService` (default) | `@/services/storeTypeService` |
| `STORE_TYPE_RULES` | `@/services/storeTypeService` |
| `DELIVERY_OPTION_META` | `@/services/storeTypeService` |

### Domain / Constants
| Export | Source |
|---|---|
| `MOROCCAN_SEASONS` | `@/constants/seasonalCalendar` |
| `ARABIC_MONTHS` | `@/constants/seasonalCalendar` |
| `getProductsInMonth` | `@/constants/seasonalCalendar` |
| `getPeakProducts` | `@/constants/seasonalCalendar` |
| `getAvailabilityStatus` | `@/constants/seasonalCalendar` |
| `isPublicVendorVisible` | `@/utils/publicVisibility` |
| `isPublicProductVisible` | `@/utils/publicVisibility` |

### UI / Pages
| Export | Source |
|---|---|
| `MarketplacePage` | `@/pages/Marketplace` |
| `StoresPage` | `@/pages/Stores` |
| `StoreDetailPage` | `@/pages/StoreDetail` |
| `SearchResultsPage` | `@/pages/SearchResults` |
| `SeasonalPage` | `@/pages/Seasonal` |
| `SearchBar` | `@/components/Search/SearchBar` |

### Hooks
| Export | Source |
|---|---|
| `productKeys` | `@/hooks/queries/useMarketplaceQueries` |
| `reviewKeys` | `@/hooks/queries/useMarketplaceQueries` |
| `useProducts` | `@/hooks/queries/useMarketplaceQueries` |
| `useProduct` | `@/hooks/queries/useMarketplaceQueries` |
| `usePendingProducts` | `@/hooks/queries/useMarketplaceQueries` |
| `useDeletedProducts` | `@/hooks/queries/useMarketplaceQueries` |
| `useInfiniteProducts` | `@/hooks/queries/useMarketplaceQueries` |
| `useCreateProduct` | `@/hooks/queries/useMarketplaceQueries` |
| `useUpdateProduct` | `@/hooks/queries/useMarketplaceQueries` |
| `useDeleteProduct` | `@/hooks/queries/useMarketplaceQueries` |
| `useRestoreProduct` | `@/hooks/queries/useMarketplaceQueries` |
| `useApproveProduct` | `@/hooks/queries/useMarketplaceQueries` |
| `useRejectProduct` | `@/hooks/queries/useMarketplaceQueries` |
| `useBulkApproveProducts` | `@/hooks/queries/useMarketplaceQueries` |
| `useBulkRejectProducts` | `@/hooks/queries/useMarketplaceQueries` |
| `useVendorReviews` | `@/hooks/queries/useMarketplaceQueries` |
| `useDeletedReviews` | `@/hooks/queries/useMarketplaceQueries` |
| `useCreateReview` | `@/hooks/queries/useMarketplaceQueries` |
| `useDeleteReview` | `@/hooks/queries/useMarketplaceQueries` |
| `useRestoreReview` | `@/hooks/queries/useMarketplaceQueries` |

---

## 6. Public API Exposed by `src/modules/marketplace`

```js
import {
  // API / Services
  algoliaService, storeTypeService, STORE_TYPE_RULES, DELIVERY_OPTION_META,

  // Domain / Constants
  MOROCCAN_SEASONS, ARABIC_MONTHS, getProductsInMonth, getPeakProducts,
  getAvailabilityStatus, isPublicVendorVisible, isPublicProductVisible,

  // UI / Pages
  MarketplacePage, StoresPage, StoreDetailPage,
  SearchResultsPage, SeasonalPage, SearchBar,

  // Hooks
  productKeys, reviewKeys,
  useProducts, useProduct, usePendingProducts, useDeletedProducts,
  useInfiniteProducts, useCreateProduct, useUpdateProduct,
  useDeleteProduct, useRestoreProduct, useApproveProduct,
  useRejectProduct, useBulkApproveProducts, useBulkRejectProducts,
  useVendorReviews, useDeletedReviews, useCreateReview,
  useDeleteReview, useRestoreReview,
} from '@/modules/marketplace'
```

---

## 7. Marketplace Files Intentionally NOT Moved

| File | Reason |
|---|---|
| `Marketplace.jsx` (481 lines) | Safe to move but deferred to keep Phase 2.2 additive-only |
| `Stores.jsx` (303 lines) | Safe to move but deferred |
| `StoreDetail.jsx` (1288 lines) | Complex — imports productImages, storeTypeService, authStore, publicVisibility. Needs decomposition first. |
| `SearchResults.jsx` (388 lines) | Safe to move but deferred |
| `Seasonal.jsx` (325 lines) | Safe to move but deferred |
| `SearchBar.jsx` (182 lines) | Safe to move but deferred |
| `useMarketplaceQueries.js` (315 lines) | MIXED — contains product, order, AND review hooks. Needs splitting first. |
| `storeTypeService.js` (328 lines) | Safe to move but deferred |
| `algoliaService.js` (43 lines) | Safe to move but deferred |
| `seasonalCalendar.js` | Safe to move but deferred |
| `publicVisibility.js` (65 lines) | Safe to move but deferred |
| `ProductDetail.jsx` (1116 lines) | VERY complex — imports cart, delivery, inventory, reviews, refund. NOT re-exported. |
| `ProductCard.jsx` | Already exported by catalog module |
| `productSearchService.js` | Already exported by catalog module |
| `api.js` (vendor/store parts) | Large mixed file — needs splitting first |
| `reviewService.js` | Needs boundary review — may belong in reviews module |
| `cartStore` / `favoritesStore` | Cart and favorites are separate concerns |
| Order hooks from `useMarketplaceQueries.js` | Order queries belong to orders module |

---

## 8. Imports Changed

**None.** No existing imports were changed. All existing code continues to import from original locations. The marketplace module is purely additive.

---

## 9. Behavior Verification

| Check | Status | Details |
|---|---|---|
| Product listing behavior unchanged | ✅ | `Marketplace.jsx` not modified |
| Store listing behavior unchanged | ✅ | `Stores.jsx` not modified |
| ProductDetail behavior unchanged | ✅ | `ProductDetail.jsx` not modified, NOT re-exported |
| StoreDetail behavior unchanged | ✅ | `StoreDetail.jsx` not modified |
| Search/filter/sort behavior unchanged | ✅ | `SearchResults.jsx`, `SearchBar.jsx`, `productSearchService.js` not modified |
| Cart/favorites behavior unchanged | ✅ | `cartStore.js`, `favoritesStore.js` not touched |
| Marketplace routes unchanged | ✅ | All routes remain as-is in `AppRouter.jsx` |
| Store type service unchanged | ✅ | `storeTypeService.js` not modified |
| Seasonal calendar unchanged | ✅ | `Seasonal.jsx`, `seasonalCalendar.js` not modified |
| Public visibility unchanged | ✅ | `publicVisibility.js` not modified |
| Supabase queries unchanged | ✅ | No Supabase queries modified |
| RLS/database unchanged | ✅ | No database changes |

---

## 10. Verification Results

| Command | Result | Details |
|---|---|---|
| `npm run lint` | ✅ **Passed** | 0 errors, 0 warnings |
| `npm run type-check` | ✅ **Passed** | 0 errors (tsc --noEmit) |
| `npm run build` | ✅ **Passed** | Built in 2m 43s, PWA generated (198 precache entries) |
| `npm run check:circular` | ✅ **Passed** | 588 files (was 581 — 7 new files), **zero circular dependencies** |

### madge File Count Change

- Before: 581 files
- After: 588 files (+7 new files in `src/modules/marketplace/`)
- Circular dependencies: 0 (unchanged)

---

## 11. Documentation Updates

### Documents Updated (3)

| Document | Change |
|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | Status line updated to include Phase 2.2. Sprint 2.2 row updated with ✅. Added Phase 2.2 achievement note. |
| `DEVELOPER_GUIDE.md` | Added `src/modules/marketplace/` to project structure tree. |
| `ARCHITECTURE_GUIDE.md` | Updated TODO section to include Phase 2.2 completion. |

### Documents Checked But Not Changed (5)

| Document | Reason |
|---|---|
| `SYSTEM_DESIGN.md` | Describes runtime architecture, not file structure. No changes needed. |
| `eslint.config.js` | Already contains `no-restricted-imports` rule. No changes needed. |
| `package.json` | No scripts or dependencies changed. No changes needed. |
| `src/modules/catalog/README.md` | Catalog module not affected by marketplace module. No changes needed. |
| `src/modules/shared/README.md`, `auth/README.md`, `users/README.md`, `app/README.md` | Not affected. No changes needed. |

### Outdated Documents Found

None new. The existing TODOs in `ARCHITECTURE_GUIDE.md` and `DEVELOPER_GUIDE.md` remain valid and were updated with Phase 2.2 status.

### Documentation Still Needing Future Updates

| Document | What | When |
|---|---|---|
| `ARCHITECTURE_GUIDE.md` | Replace `src/features/` tree with `src/modules/` + `src/app/` tree | Phase 2+ (when first file moves) |
| `DEVELOPER_GUIDE.md` | Update Edge Functions table (remove Stripe/CMI) | Phase 3 |
| `DEVELOPER_GUIDE.md` | Replace `src/features/` guide with `src/modules/` guide | Phase 2+ (when first file moves) |
| `src/modules/marketplace/README.md` | Update migration candidates as files are moved | Sprint 2.3+ |

---

## 12. Files Modified/Created

| File | Action |
|---|---|
| `src/modules/marketplace/index.js` | Created — public API entry point |
| `src/modules/marketplace/api/index.js` | Created — Algolia service, store type service |
| `src/modules/marketplace/domain/index.js` | Created — seasonal calendar, public visibility |
| `src/modules/marketplace/ui/index.js` | Created — marketplace pages, SearchBar |
| `src/modules/marketplace/hooks/index.js` | Created — product and review query hooks |
| `src/modules/marketplace/stores/index.js` | Created — marketplace store placeholder |
| `src/modules/marketplace/utils/index.js` | Created — marketplace utils placeholder |
| `src/modules/marketplace/README.md` | Created — module documentation |
| `MODULAR_DEVELOPMENT_PLAN.md` | Modified — status + Sprint 2.2 table + achievement note |
| `DEVELOPER_GUIDE.md` | Modified — project structure tree |
| `ARCHITECTURE_GUIDE.md` | Modified — TODO section updated |
| `docs/architecture/phase-2-2-marketplace-module-report.md` | Created — this report |

**Total: 9 new files created. 3 files modified. 0 files deleted. 0 files moved.**

---

## 13. Safety Assessment

| Check | Status |
|---|---|
| No business logic changes | ✅ |
| No auth behavior changes | ✅ |
| No Supabase query changes | ✅ |
| No database/RLS changes | ✅ |
| No UI redesign | ✅ |
| No route changes | ✅ |
| No mass import rewriting | ✅ (0 imports changed) |
| No files deleted | ✅ |
| No files moved | ✅ |
| No circular dependencies | ✅ |
| No `any` / `@ts-ignore` / `@ts-expect-error` | ✅ |
| All 4 commands pass | ✅ |
| Behavior preserved | ✅ |

---

## 14. Remaining Risks

| Risk | Severity | Mitigation |
|---|---|---|
| `useMarketplaceQueries.js` mixes product, order, and review hooks | Medium | Documented. Needs splitting: product/review → marketplace, order → orders. |
| `StoreDetail.jsx` (1288 lines) has many cross-concern imports | Medium | Documented as migration candidate. Needs decomposition. |
| `ProductDetail.jsx` (1116 lines) NOT re-exported — very complex | Medium | Documented. Imports cart/delivery/inventory/reviews/refund. Needs decomposition. |
| `Stores.jsx` queries `profilesService` directly instead of through users module | Low | Documented. Should use `@/modules/users` in future. |
| `api.js` mixes vendors, products, reviews, orders | Medium | Documented. Needs splitting. |
| `ProductCard` has cart/favorites coupling | Medium | Documented in catalog README. Decouple via props in future sprint. |
| `reviewService.js` boundary unclear | Low | Documented. May belong in reviews module or marketplace. |
| `storeTypeService.js` contains delivery option rules | Low | Delivery options overlap with delivery module. Documented. |

---

## 15. Whether It Is Safe to Continue to Phase 2.3

### ✅ Yes — Safe to continue to Phase 2.3 (cart module)

Phase 2.2 marketplace module foundation is complete and verified:
- `src/modules/marketplace/` exists as a pure re-export layer with 8 files.
- All 4 verification commands pass (lint, type-check, build, check:circular).
- 0 circular dependencies across 588 files.
- 0 imports changed, 0 files moved, 0 files deleted.
- 100% behavior preserved.
- Module boundaries documented with allowed/forbidden dependencies.
- No circular dependencies between catalog and marketplace (marketplace imports from catalog; catalog does NOT import from marketplace).

### Recommended Phase 2.3 approach (cart module):

1. **Inspect** cart-related files: `cartStore.js`, `cartStore.test.js`, cart components, cart pages
2. **Create** `src/modules/cart/` with re-export layer (same pattern)
3. **Re-export** cart store, cart page, cart components
4. **Do NOT move** any files in Sprint 2.3 — re-export only
5. **Run** all 4 verification commands
6. **Create** `docs/architecture/phase-2-3-cart-module-report.md`

### Files to inspect first for Sprint 2.3:

| File | Location | Reason |
|---|---|---|
| `cartStore.js` | `@/store/cartStore` | Primary cart state management |
| `Cart.jsx` | `@/pages/` | Cart page |
| `favoritesStore.js` | `@/store/favoritesStore` | Favorites state (may belong in cart or separate module) |
| Cart-related components | `@/components/` | Cart UI components |
| `cartQuantity.js` | `@/utils/` | Quantity normalization utilities |
| `api.js` (cart parts) | `@/services/api` | Cart API if any |

### Files that must NOT be moved in Sprint 2.3:

| File | Reason |
|---|---|
| `productRepository.ts` | Catalog module concern |
| `ProductCard.jsx` | Catalog module concern |
| `Marketplace.jsx` | Marketplace module concern |
| `StoreDetail.jsx` | Marketplace module concern |
| Any file in `src/modules/catalog/` | Catalog module is stable |
| Any file in `src/modules/marketplace/` | Marketplace module is stable |
| Any file in `src/modules/shared/` | Shared module is stable |
| Any file in `src/modules/auth/` | Auth module is stable |
| Any file in `src/modules/users/` | Users module is stable |
| Database migrations | No database changes |
| RLS policies | No RLS changes |
