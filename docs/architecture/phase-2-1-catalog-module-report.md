# Phase 2.1 — Catalog Module Foundation Report

**Date:** 2026-06-22  
**Project:** Greenmarket / Qotoof  
**Phase:** 2.1 — Catalog Module Foundation  
**Purpose:** Create `src/modules/catalog/` as the public catalog module layer using re-exports only.

---

## 1. Confirmation: `.windsurfrules` Read and Followed

✅ `.windsurfrules` was read in full during Phase 0.5 and re-consulted before this phase.

Key rules respected:

- **Rule 1 (Minimal changes):** 9 new files created, 0 files moved, 0 files deleted, 0 imports changed.
- **Rule 30 (Stop and ask):** No Supabase/RLS/Auth/Database/Payments/migrations touched.
- **No `any`, no `@ts-ignore`, no `@ts-expect-error`** — not needed.
- **No business logic changes.** No UI redesign. No mass import rewriting.
- **No circular dependencies** introduced (verified by `madge`).

---

## 2. Current Catalog/Product Architecture Summary

### Product Reads
- **`productRepository.ts`** (163 lines, `src/data/`) — `listProducts`, `getProductById`, `listPendingProducts`, `listDeletedProducts` with Supabase queries. Exports `productSelects` object with reusable select clauses.
- **`productsApi.ts`** (61 lines, `src/api/`) — `fetchProducts` (delegates to `productSearchService`), `fetchProductById` (uses `runProductImageFallbackQuery`), `fetchAvailableRegions`.
- **`productSearchService.js`** (421 lines, `src/services/search/`) — Algolia-based search with PostgREST fallback. Uses `hydrateProductsWithImages` for image handling.
- **`useProducts.ts`** (33 lines, `src/hooks/`) — React Query hooks: `useProducts`, `useProductById`, `useAvailableRegions`.

### Product Creates/Updates/Deletes
- **`productRepository.ts`** — `insertProduct`, `updateProductById`, `updateManyProducts` (Supabase queries).
- **`vendor/Products.jsx`** (1285 lines, `src/pages/vendor/`) — Full vendor product management page with inline Supabase queries for product CRUD, image upload, bulk DOCX upload, location setup.

### Product Images
- **`productImages.js`** (148 lines, `src/services/`) — `mergeProductImages`, `hydrateProductsWithImages`, `runProductImageFallbackQuery`, `isProductImagesRelationError`. Handles the `product_images` relation with fallback hydration.
- **`ProductForm.jsx`** (169 lines, `src/components/vendor/`) — `ImageUploader` component for drag & drop image upload with preview, max 5 images, JPG/PNG/WebP.

### Categories
- **`categories.js`** (47 lines, `src/constants/`) — `PRODUCT_CATEGORIES`, `MAIN_CATEGORIES`, `SUBCATEGORIES`, helper functions (`getSuggestedSubcategories`, `getCategoryById`, `getCategoryIds`, `getCategoryLabel`).

### Approval Status / Published Status
- **`productLogic.ts`** (26 lines, `src/business/`) — `buildApprovalPayload`, `buildSuspensionPayload`, `buildRejectionPayload`, `buildSoftDeletePayload`, `buildRestorePayload`.
- Status values: `pending`, `published`, `rejected`, `suspended`.
- Handled in: `vendor/Products.jsx`, `admin/Products.jsx`, `productRepository.ts`, `productSearchService.js`.

### Product Cards / Components
- **`ProductCard.jsx`** (265 lines, `src/components/ui/`) — Product card with cart add, favorite toggle, report abuse, prefetch. **Coupling:** imports `cartStore`, `favoritesStore`, `authStore`.

### Admin Product Moderation
- **`admin/Products.jsx`** (492 lines, `src/pages/admin/`) — Admin product moderation page. Uses `productsApi.getAll` from `@/services/api` (not from `@/api/productsApi`). Supports approve, reject, suspend, bulk actions.

### Product Detail
- **`ProductDetail.jsx`** (1116 lines, `src/pages/`) — Product detail page. Imports cart, auth, inventory, reviews, refund policy, delivery eligibility. Complex page with many cross-concern imports.

### Mock Product Data
- No mock product data found in the codebase. All product data comes from Supabase or Algolia.

---

## 3. What Catalog Files Were Created

```
src/modules/catalog/
├── index.js              ← Public API entry point
├── data/
│   └── index.js          ← Product repository re-exports
├── api/
│   └── index.js          ← Products API, image helpers, search service
├── domain/
│   └── index.js          ← Product business logic, categories
├── ui/
│   └── index.js          ← ProductCard, ProductForm, ImageUploader, pages
├── hooks/
│   └── index.js          ← useProducts, useProductById, useAvailableRegions
├── stores/
│   └── index.js          ← Placeholder (no catalog store yet)
├── utils/
│   └── index.js          ← Placeholder (future catalog utilities)
└── README.md             ← Module documentation
```

**9 new files created.**

---

## 4. Files Moved

**None.** No files were moved. This is an additive, re-export-only step.

---

## 5. Files Re-Exported/Wrapped

### Data / Repository
| Export | Source |
|---|---|
| `productSelects` | `@/data/productRepository` |
| `listProducts` | `@/data/productRepository` |
| `getProductById` | `@/data/productRepository` |
| `insertProduct` | `@/data/productRepository` |
| `updateProductById` | `@/data/productRepository` |
| `listDeletedProducts` | `@/data/productRepository` |
| `listPendingProducts` | `@/data/productRepository` |
| `updateManyProducts` | `@/data/productRepository` |

### API / Services
| Export | Source |
|---|---|
| `fetchProducts` | `@/api/productsApi` |
| `fetchProductById` | `@/api/productsApi` |
| `fetchAvailableRegions` | `@/api/productsApi` |
| `isProductImagesRelationError` | `@/services/productImages` |
| `mergeProductImages` | `@/services/productImages` |
| `hydrateProductsWithImages` | `@/services/productImages` |
| `runProductImageFallbackQuery` | `@/services/productImages` |
| `productSearchService` (default) | `@/services/search/productSearchService` |
| `buildProductSearchFiltersFromParams` | `@/services/search/productSearchService` |
| `normalizeProductSearchFilters` | `@/services/search/productSearchService` |
| `normalizeSearchProduct` | `@/services/search/productSearchService` |

### Domain / Business Logic
| Export | Source |
|---|---|
| `buildApprovalPayload` | `@/business/productLogic` |
| `buildSuspensionPayload` | `@/business/productLogic` |
| `buildRejectionPayload` | `@/business/productLogic` |
| `buildSoftDeletePayload` | `@/business/productLogic` |
| `buildRestorePayload` | `@/business/productLogic` |
| `PRODUCT_CATEGORIES` | `@/constants/categories` |
| `MAIN_CATEGORIES` | `@/constants/categories` |
| `getSuggestedSubcategories` | `@/constants/categories` |
| `getCategoryById` | `@/constants/categories` |
| `getCategoryIds` | `@/constants/categories` |
| `getCategoryLabel` | `@/constants/categories` |

### UI / Components / Pages
| Export | Source |
|---|---|
| `ProductCard` | `@/components/ui/ProductCard` |
| `ProductForm` | `@/components/vendor/ProductForm` |
| `ImageUploader` | `@/components/vendor/ProductForm` |
| `ProductDetailPage` | `@/pages/ProductDetail` |
| `VendorProductsPage` | `@/pages/vendor/Products` |
| `AdminProductsPage` | `@/pages/admin/Products` |

### Hooks
| Export | Source |
|---|---|
| `useProducts` | `@/hooks/useProducts` |
| `useAvailableRegions` | `@/hooks/useProducts` |
| `useProductById` | `@/hooks/useProducts` |
| `productsQueryKey` | `@/hooks/useProducts` |
| `productQueryKey` | `@/hooks/useProducts` |

---

## 6. Public API Exposed by `src/modules/catalog`

```js
import {
  // Data / Repository
  productSelects, listProducts, getProductById,
  insertProduct, updateProductById, listDeletedProducts,
  listPendingProducts, updateManyProducts,

  // API / Services
  fetchProducts, fetchProductById, fetchAvailableRegions,
  isProductImagesRelationError, mergeProductImages,
  hydrateProductsWithImages, runProductImageFallbackQuery,
  productSearchService, buildProductSearchFiltersFromParams,
  normalizeProductSearchFilters, normalizeSearchProduct,

  // Domain / Business Logic
  buildApprovalPayload, buildSuspensionPayload, buildRejectionPayload,
  buildSoftDeletePayload, buildRestorePayload,
  PRODUCT_CATEGORIES, MAIN_CATEGORIES,
  getSuggestedSubcategories, getCategoryById, getCategoryIds, getCategoryLabel,

  // UI / Components / Pages
  ProductCard, ProductForm, ImageUploader,
  ProductDetailPage, VendorProductsPage, AdminProductsPage,

  // Hooks
  useProducts, useAvailableRegions, useProductById,
  productsQueryKey, productQueryKey,
} from '@/modules/catalog'
```

---

## 7. Catalog/Product Files Intentionally NOT Moved

| File | Reason |
|---|---|
| `productRepository.ts` (163 lines) | Safe to move but deferred to keep Phase 2.1 additive-only |
| `productsApi.ts` (61 lines) | Safe to move but deferred |
| `productImages.js` (148 lines) | Safe to move but deferred |
| `productSearchService.js` (421 lines) | Mixed with search infrastructure — needs careful extraction |
| `productSearchHelpers.js` | Safe to move but deferred |
| `productLogic.ts` (26 lines) | Safe to move but deferred |
| `categories.js` (47 lines) | Safe to move but deferred |
| `ProductCard.jsx` (265 lines) | Has cart/favorites coupling — decouple first |
| `ProductForm.jsx` (169 lines) | Safe to move but deferred |
| `ProductDetail.jsx` (1116 lines) | Complex — imports cart, delivery, inventory, reviews, refund |
| `vendor/Products.jsx` (1285 lines) | Complex — imports PayPal eligibility, inline Supabase queries |
| `admin/Products.jsx` (492 lines) | Uses `productsApi` from `@/services/api` (not `@/api/productsApi`) |
| `useProducts.ts` (33 lines) | Safe to move but deferred |
| `api.js` (product parts) | Large mixed file — needs splitting first |
| `inventoryService.js` | Tightly coupled with products and orders |
| `reviewService.js` | Reviews belong to marketplace/reviews module |
| `refundPolicyService.js` | Refunds belong to payments module |
| `deliveryEligibilityService.js` | Delivery belongs to delivery module |
| `Marketplace.jsx`, `StoreDetail.jsx`, `Stores.jsx` | Marketplace page composition, not catalog |
| `useMarketplaceQueries.js` | Marketplace queries, not catalog queries |
| `cartStore` / `favoritesStore` | Cart and favorites are separate concerns |

---

## 8. Imports Changed

**None.** No existing imports were changed. All existing code continues to import from original locations. The catalog module is purely additive.

---

## 9. Behavior Verification

| Check | Status | Details |
|---|---|---|
| Product read behavior unchanged | ✅ | `productRepository.ts`, `productsApi.ts`, `productSearchService.js` not modified |
| Product create/update/delete behavior unchanged | ✅ | `insertProduct`, `updateProductById`, `updateManyProducts` not modified |
| Product image behavior unchanged | ✅ | `productImages.js` not modified, only re-exported |
| Category behavior unchanged | ✅ | `categories.js` not modified |
| Approval status/published behavior unchanged | ✅ | `productLogic.ts` not modified |
| Marketplace behavior unchanged | ✅ | `Marketplace.jsx`, `StoreDetail.jsx`, `Stores.jsx` not touched |
| Vendor product management behavior unchanged | ✅ | `vendor/Products.jsx` not modified |
| Admin product moderation behavior unchanged | ✅ | `admin/Products.jsx` not modified |
| Cart behavior unchanged | ✅ | `cartStore.js` not touched |
| Auth behavior unchanged | ✅ | No auth files modified |
| Supabase queries unchanged | ✅ | No Supabase queries modified |
| RLS/database unchanged | ✅ | No database changes |

---

## 10. Verification Results

| Command | Result | Details |
|---|---|---|
| `npm run lint` | ✅ **Passed** | 0 errors, 0 warnings |
| `npm run type-check` | ✅ **Passed** | 0 errors (tsc --noEmit) |
| `npm run build` | ✅ **Passed** | Built in 2m 57s, PWA generated (198 precache entries) |
| `npm run check:circular` | ✅ **Passed** | 581 files (was 573 — 8 new files), **zero circular dependencies** |

### madge File Count Change

- Before: 573 files
- After: 581 files (+8 new files in `src/modules/catalog/`)
- Circular dependencies: 0 (unchanged)

---

## 11. Documentation Updates

### Documents Updated (3)

| Document | Change |
|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | Status line updated to include Phase 2.1. Sprint 2.1 row updated with ✅. Added Phase 2.1 achievement note. |
| `DEVELOPER_GUIDE.md` | Added `src/modules/catalog/` to project structure tree. |
| `ARCHITECTURE_GUIDE.md` | Updated TODO section to include Phase 2.1 completion. |

### Documents Checked But Not Changed (4)

| Document | Reason |
|---|---|
| `SYSTEM_DESIGN.md` | Describes runtime architecture, not file structure. No changes needed. |
| `eslint.config.js` | Already contains `no-restricted-imports` rule. No changes needed. |
| `package.json` | No scripts or dependencies changed. No changes needed. |
| `src/modules/shared/README.md` | Shared module not affected by catalog module. No changes needed. |
| `src/modules/auth/README.md` | Auth module not affected. No changes needed. |
| `src/modules/users/README.md` | Users module not affected. No changes needed. |
| `src/app/README.md` | App layer not affected. No changes needed. |

### Outdated Documents Found

None new. The existing TODOs in `ARCHITECTURE_GUIDE.md` and `DEVELOPER_GUIDE.md` remain valid and were updated with Phase 2.1 status.

### Documentation Still Needing Future Updates

| Document | What | When |
|---|---|---|
| `ARCHITECTURE_GUIDE.md` | Replace `src/features/` tree with `src/modules/` + `src/app/` tree | Phase 2+ (when first file moves) |
| `DEVELOPER_GUIDE.md` | Update Edge Functions table (remove Stripe/CMI) | Phase 3 |
| `DEVELOPER_GUIDE.md` | Replace `src/features/` guide with `src/modules/` guide | Phase 2+ (when first file moves) |
| `src/modules/catalog/README.md` | Update migration candidates as files are moved | Sprint 2.2+ |

---

## 12. Files Modified/Created

| File | Action |
|---|---|
| `src/modules/catalog/index.js` | Created — public API entry point |
| `src/modules/catalog/data/index.js` | Created — product repository re-exports |
| `src/modules/catalog/api/index.js` | Created — products API, image helpers, search service |
| `src/modules/catalog/domain/index.js` | Created — product business logic, categories |
| `src/modules/catalog/ui/index.js` | Created — ProductCard, ProductForm, product pages |
| `src/modules/catalog/hooks/index.js` | Created — useProducts, useProductById, useAvailableRegions |
| `src/modules/catalog/stores/index.js` | Created — catalog store placeholder |
| `src/modules/catalog/utils/index.js` | Created — catalog utils placeholder |
| `src/modules/catalog/README.md` | Created — module documentation |
| `MODULAR_DEVELOPMENT_PLAN.md` | Modified — status + Sprint 2.1 table + achievement note |
| `DEVELOPER_GUIDE.md` | Modified — project structure tree |
| `ARCHITECTURE_GUIDE.md` | Modified — TODO section updated |
| `docs/architecture/phase-2-1-catalog-module-report.md` | Created — this report |

**Total: 10 new files created. 3 files modified. 0 files deleted. 0 files moved.**

---

## 13. Safety Assessment

| Check | Status |
|---|---|
| No business logic changes | ✅ |
| No auth behavior changes | ✅ |
| No Supabase query changes | ✅ |
| No database/RLS changes | ✅ |
| No UI redesign | ✅ |
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
| `ProductCard.jsx` imports `cartStore` and `favoritesStore` | Medium | Documented in README. Decouple by passing `onAddToCart` / `onToggleFavorite` as props in a future sprint. |
| `ProductDetail.jsx` (1116 lines) imports cart, delivery, inventory, reviews, refund | Medium | Documented as migration candidate. Needs decomposition before moving. |
| `vendor/Products.jsx` (1285 lines) has inline Supabase queries + PayPal eligibility | Medium | Documented as migration candidate. Needs service extraction first. |
| `admin/Products.jsx` uses `productsApi` from `@/services/api` (not `@/api/productsApi`) | Low | Two different product APIs exist. Should be consolidated in a future sprint. |
| `productSearchService.js` (421 lines) mixes Algolia + PostgREST fallback | Low | Documented as migration candidate. Needs careful extraction. |
| `api.js` mixes vendors, products, reviews, admin ops | Medium | Documented. Needs splitting before catalog can use its product parts. |
| `inventoryService.js` coupled with products and orders | Low | Documented. Boundary review needed in Sprint 2.4+. |
| No dedicated catalog store | Low | Product state managed by React Query. Catalog store placeholder ready. |

---

## 15. Whether It Is Safe to Continue to Phase 2.2

### ✅ Yes — Safe to continue to Phase 2.2 (marketplace module)

Phase 2.1 catalog module foundation is complete and verified:
- `src/modules/catalog/` exists as a pure re-export layer with 9 files.
- All 4 verification commands pass (lint, type-check, build, check:circular).
- 0 circular dependencies across 581 files.
- 0 imports changed, 0 files moved, 0 files deleted.
- 100% behavior preserved.
- Module boundaries documented with allowed/forbidden dependencies.
- Migration candidates documented for Sprint 2.2+.

### Recommended Phase 2.2 approach (marketplace module):

1. **Inspect** marketplace-related files: `Marketplace.jsx`, `StoreDetail.jsx`, `Stores.jsx`, `useMarketplaceQueries.js`, `features/marketplace/` tests
2. **Create** `src/modules/marketplace/` with re-export layer (same pattern)
3. **Re-export** marketplace pages, hooks, and components that consume catalog public API
4. **Do NOT move** any files in Sprint 2.2 — re-export only
5. **Run** all 4 verification commands
6. **Create** `docs/architecture/phase-2-2-marketplace-module-report.md`

### Files to inspect first for Sprint 2.2:

| File | Location | Reason |
|---|---|---|
| `Marketplace.jsx` | `@/pages/` | Main marketplace page |
| `StoreDetail.jsx` | `@/pages/` | Store/vendor detail page |
| `Stores.jsx` | `@/pages/` | Stores listing page |
| `useMarketplaceQueries.js` | `@/hooks/queries/` | Marketplace React Query hooks |
| `features/marketplace/` tests | `@/features/marketplace/__tests__/` | Integration tests for cart/marketplace |

### Files that must NOT be moved in Sprint 2.2:

| File | Reason |
|---|---|
| `cartStore.js` | Cart module concern (Sprint 2.3) |
| `favoritesStore.js` | Favorites state, not marketplace |
| `productRepository.ts` | Catalog module concern |
| `ProductCard.jsx` | Catalog module concern |
| Any file in `src/modules/catalog/` | Catalog module is stable |
| Any file in `src/modules/shared/` | Shared module is stable |
| Any file in `src/modules/auth/` | Auth module is stable |
| Any file in `src/modules/users/` | Users module is stable |
| Database migrations | No database changes |
| RLS policies | No RLS changes |
