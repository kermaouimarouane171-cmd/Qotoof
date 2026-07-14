# Catalog Module

## Purpose

The catalog module encapsulates all product and category functionality:
- Products (CRUD operations)
- Product images and image fallback/hydration logic
- Product categories and subcategories
- Product status and approval workflow (pending, published, rejected, suspended)
- Product search (Algolia + PostgREST fallback)
- Vendor product management
- Admin product moderation
- Product-related UI components (ProductCard, ProductForm, ImageUploader)
- Product-related React hooks

## Current Status: Re-export Foundation Only

This module is currently a **re-export layer**. No source files have been moved.
The re-exports point to existing files in `src/data/`, `src/api/`, `src/services/`,
`src/business/`, `src/constants/`, `src/components/`, `src/pages/`, and `src/hooks/`.

## Public API (Root Barrel — Lightweight)

The root barrel exports only lightweight non-UI symbols: data/repository, API services, domain/business logic, and hooks.

```js
import {
  // Data / Repository
  productSelects,
  listProducts,
  getProductById,
  insertProduct,
  updateProductById,
  listDeletedProducts,
  listPendingProducts,
  updateManyProducts,

  // API / Services
  fetchProducts,
  fetchProductById,
  fetchAvailableRegions,
  isProductImagesRelationError,
  mergeProductImages,
  hydrateProductsWithImages,
  runProductImageFallbackQuery,
  productSearchService,
  buildProductSearchFiltersFromParams,
  normalizeProductSearchFilters,
  normalizeSearchProduct,

  // Domain / Business Logic
  buildApprovalPayload,
  buildSuspensionPayload,
  buildRejectionPayload,
  buildSoftDeletePayload,
  buildRestorePayload,
  PRODUCT_CATEGORIES,
  MAIN_CATEGORIES,
  getSuggestedSubcategories,
  getCategoryById,
  getCategoryIds,
  getCategoryLabel,

  // Hooks
  useProducts,
  useAvailableRegions,
  useProductById,
  productsQueryKey,
  productQueryKey,
} from '@/modules/catalog'
```

### Intentionally NOT Exported from Root (Phase 6.19)

UI/page-level exports were removed from the root barrel to prevent eager loading of `ProductDetailPage` (1116 lines) and `ProductCard` (which imports cart/favorites stores) when importing lightweight symbols (APIs, domain helpers, hooks).

| Symbol | Available Via |
|---|---|
| `ProductCard` | `@/components/ui/ProductCard` or `@/modules/catalog/ui` |
| `ProductForm` | `@/components/vendor/ProductForm` or `@/modules/catalog/ui` |
| `ImageUploader` | `@/components/vendor/ProductForm` or `@/modules/catalog/ui` |
| `ProductDetailPage` | `lazy(() => import('@/pages/ProductDetail'))` or `@/modules/catalog/ui` |
| `VendorProductsPage` | `lazy(() => import('@/pages/vendor/Products'))` or `@/modules/catalog/ui` |
| `AdminProductsPage` | `lazy(() => import('@/pages/admin/Products'))` or `@/modules/catalog/ui` |

### UI / Page Import Policy

App code should import catalog UI components from their original paths:
```js
import ProductCard from '@/components/ui/ProductCard'
```

Catalog pages should be loaded via lazy imports:
```js
const ProductDetailPage = lazy(() => import('@/pages/ProductDetail'))
const VendorProductsPage = lazy(() => import('@/pages/vendor/Products'))
```

UI exports remain available through `src/modules/catalog/ui/index.js` for intra-module use only.

## Structure

```
src/modules/catalog/
├── index.js          ← Public API entry point
├── data/
│   └── index.js      ← Product repository re-exports
├── api/
│   └── index.js      ← Products API, image helpers, search service
├── domain/
│   └── index.js      ← Product business logic, categories
├── ui/
│   └── index.js      ← ProductCard, ProductForm, ImageUploader, pages
├── hooks/
│   └── index.js      ← useProducts, useProductById, useAvailableRegions
├── stores/
│   └── index.js      ← Placeholder (no catalog store yet)
├── utils/
│   └── index.js      ← Placeholder (future catalog utilities)
└── README.md         ← This file
```

## What Belongs in Catalog

- Product data access (productRepository, productsApi)
- Product images (upload, hydration, fallback)
- Product categories and subcategories
- Product status/approval workflow
- Product search (Algolia + PostgREST fallback)
- Product business logic (approval, suspension, rejection, soft delete)
- Product UI components (ProductCard, ProductForm, ImageUploader)
- Product pages (ProductDetail, VendorProducts, AdminProducts)
- Product-related React hooks
- Inventory fields on product (when present)
- Admin product moderation as a catalog capability

## What Does NOT Belong in Catalog

- Cart state (belongs in `cart` module)
- Checkout flow (belongs in `checkout` module)
- Orders lifecycle (belongs in `orders` module)
- Payments (belongs in `payments` module)
- Delivery (belongs in `delivery` module)
- Auth/session logic (belongs in `auth` module)
- User profile ownership (belongs in `users` module)
- Admin dashboard composition (belongs in `admin` or `app` module)
- Marketplace page composition (belongs in `marketplace` module, but consumes catalog exports)
- Favorites state (belongs in `favorites` or `marketplace` module)
- Reviews business logic (belongs in `reviews` or `marketplace` module)
- Refund policy (belongs in `payments` or `orders` module)

## Relationship with Marketplace

- **Marketplace consumes catalog public read APIs** — `fetchProducts`, `useProducts`, `ProductCard`.
- **Catalog does not own marketplace page composition** — `Marketplace.jsx` and `StoreDetail.jsx` remain in the marketplace layer.
- **Marketplace should not import catalog internals** — only import from `@/modules/catalog` public API.

## Relationship with Cart

- **Cart consumes product availability/price info from catalog** — e.g., `is_available`, `price_per_unit`, `min_order_quantity`.
- **Catalog does not own cart state** — `cartStore` remains separate.
- **ProductCard currently imports cartStore** — this creates a coupling. In a future sprint, ProductCard should accept `onAddToCart` as a prop, or a marketplace wrapper should handle cart actions.

## Relationship with Orders

- **Orders may consume product snapshot info** — e.g., product name, price, image at order creation time.
- **Catalog does not own order lifecycle** — orders module owns order creation, status, and history.

## Relationship with Users

- **Catalog may reference vendor/user id** — products have `vendor_id`.
- **Users owns profile details** — catalog should not query `profiles` table directly except through existing established joins (e.g., `vendor:profiles(...)` in product selects). In the future, vendor public profile reads should go through `@/modules/users` public API.

## Relationship with Admin

- **Admin product moderation is a catalog capability** — `AdminProductsPage` and `buildApprovalPayload`/`buildSuspensionPayload`/`buildRejectionPayload` belong here.
- **Admin dashboard composition is not catalog** — the admin dashboard layout and navigation remain in `admin` or `app`.

## Allowed Dependencies

- `@/modules/shared` — shared UI, hooks, utils
- `@/modules/auth` — for current user/vendor identity (read-only)
- `@/modules/users` — for safe public vendor profile reads (when needed)
- `@/services/supabase` — Supabase client
- `@/lib/config` — app config
- `@/utils/` — general utilities (currency, sanitization, logger)
- `@/types/database` — database type definitions

## Forbidden Dependencies

- `@/modules/cart` — cart module
- `@/modules/checkout` — checkout module
- `@/modules/orders` — orders module
- `@/modules/payments` — payments module
- `@/modules/delivery` — delivery module
- `@/modules/admin` — admin dashboard composition (catalog may export admin-moderation UIs, but not depend on admin)
- `@/modules/cart` direct import — avoid in catalog components; pass callbacks instead
- `@/modules/cart` direct import (favorites) — avoid in catalog components; pass callbacks instead

## Migration Candidates for Future Sprints

| File | Current Location | Target | Sprint | Notes |
|---|---|---|---|---|
| `productRepository.ts` | `@/data/productRepository` | `@/modules/catalog/data/` | 2.2+ | 163 lines, safe to move |
| `productsApi.ts` | `@/modules/catalog/api/productsApi` | `@/modules/catalog/api/` | 2.2+ | 61 lines, moved |
| `productImages.js` | `@/services/productImages` | `@/modules/catalog/api/` | 2.2+ | 148 lines, safe to move |
| `productSearchService.js` | `@/services/search/productSearchService` | `@/modules/catalog/api/` | 2.2+ | 421 lines, mixed with search infrastructure |
| `productSearchHelpers.js` | `@/services/search/productSearchHelpers` | `@/modules/catalog/utils/` | 2.2+ | Safe to move |
| `productLogic.ts` | `@/business/productLogic` | `@/modules/catalog/domain/` | 2.2+ | 26 lines, safe to move |
| `categories.js` | `@/constants/categories` | `@/modules/catalog/domain/` | 2.2+ | 47 lines, safe to move |
| `ProductCard.jsx` | `@/components/ui/ProductCard` | `@/modules/catalog/ui/` | 2.2+ | 265 lines, has cart/favorites coupling — decouple first |
| `ProductForm.jsx` + `ImageUploader` | `@/components/vendor/ProductForm` | `@/modules/catalog/ui/` | 2.2+ | 169 lines, safe to move |
| `ProductDetail.jsx` | `@/pages/ProductDetail` | `@/modules/catalog/ui/pages/` | 2.2+ | 1116 lines, imports cart, delivery, inventory, reviews, refund — complex |
| `vendor/Products.jsx` | `@/pages/vendor/Products` | `@/modules/catalog/ui/pages/` | 2.2+ | 1285 lines, imports PayPal eligibility — complex |
| `admin/Products.jsx` | `@/pages/admin/Products` | `@/modules/catalog/ui/pages/` | 2.2+ | 492 lines, uses `productsApi` from `@/services/api` |
| `useProducts.ts` | `@/hooks/useProducts` | `@/modules/catalog/hooks/` | 2.2+ | 33 lines, safe to move |
| `api.js` (product parts) | `@/services/api` | `@/modules/catalog/api/` | 2.3+ | Large mixed file — needs splitting first |
| `inventoryService.js` | `@/services/inventoryService` | `@/modules/catalog/` | 2.3+ | Depends on products and orders — needs boundary review |
| `reviewService.js` | `@/modules/reviews` | Already migrated | ✅ Done | Reviews migrated to reviews module, stub deleted Phase 7.19 |
| `refundPolicyService.js` | `@/modules/payments` | Already migrated | ✅ Done | Refunds are payments concern — migrated in Phase 7.14 |
| `deliveryEligibilityService.js` | `@/services/deliveryEligibilityService` | `@/modules/delivery/` | 2.3+ | Delivery concern |
| `StoreDetail.jsx`, `Stores.jsx` | `@/pages/` | `@/modules/marketplace/` | 2.3+ | Marketplace concern |

## Intentionally NOT Exported (Candidates for Later)

| Item | Reason |
|---|---|
| `api.js` product parts | File mixes vendors, products, reviews, admin ops — needs splitting first |
| `inventoryService.js` | Tightly coupled with products and orders; boundary not clear yet |
| `reviewService.js` | Reviews belong to reviews module — migrated, stub deleted Phase 7.19 |
| `refundPolicyService.js` | Refunds belong to payments module — migrated in Phase 7.14 |
| `deliveryEligibilityService.js` | Delivery belongs to delivery module |
| `Marketplace.jsx`, `StoreDetail.jsx`, `Stores.jsx` | Marketplace page composition, not catalog |
| `cartStore` / `favoritesStore` | Cart and favorites are separate concerns — migrated to `@/modules/cart`, stubs deleted Phase 7.19 |
| `useMarketplaceQueries.js` | Marketplace queries, not catalog queries |
| `productCondition.jsx` (orders) | Order-specific product condition, not catalog |

## Safety Notes

- **Product images:** `productImages.js` contains fallback logic for the `product_images` relation. This is preserved unchanged.
- **Approval status:** Product approval workflow constants (`pending`, `published`, `rejected`, `suspended`) are handled by `productLogic.ts` and pages. No changes made.
- **Soft delete:** `productRepository.ts` uses `deleted_at` for soft deletes. No changes made.
- **RLS:** Catalog queries rely on existing RLS policies. No RLS changes made.
- **Algolia:** `productSearchService.js` uses Algolia for search with PostgREST fallback. No changes made.
- **Couplings:** `ProductCard` currently imports `useCartStore` and `useFavoritesStore` from `@/modules/cart`. This is documented as a future decoupling item.
