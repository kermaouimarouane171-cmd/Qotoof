# Marketplace Module

## Purpose

The marketplace module encapsulates all public browsing experience for products and stores:
- Marketplace product listing page (browsing, filtering, sorting)
- Stores listing page
- Store detail page (vendor storefront with products)
- Search results page
- Seasonal agricultural calendar page
- Search bar component (reusable marketplace search widget)
- Store type service (store classification and delivery options)
- Seasonal calendar constants
- Public visibility helpers (filtering experimental vendors/products)
- Marketplace React Query hooks (product and review queries)

## Current Status: Re-export Foundation Only

This module is currently a **re-export layer**. No source files have been moved.
The re-exports point to existing files in `src/pages/`, `src/components/`,
`src/services/`, `src/constants/`, `src/utils/`, and `src/hooks/`.

## Public API (Root Barrel — Lightweight)

The root barrel exports only lightweight non-UI symbols: API services, domain/constants, and hooks.

```js
import {
  // API / Services
  algoliaService,
  storeTypeService,
  STORE_TYPE_RULES,
  DELIVERY_OPTION_META,

  // Domain / Constants
  MOROCCAN_SEASONS,
  ARABIC_MONTHS,
  getProductsInMonth,
  getPeakProducts,
  getAvailabilityStatus,
  isPublicVendorVisible,
  isPublicProductVisible,

  // Hooks
  productKeys,
  reviewKeys,
  useProducts,
  useProduct,
  usePendingProducts,
  useDeletedProducts,
  useInfiniteProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useRestoreProduct,
  useApproveProduct,
  useRejectProduct,
  useBulkApproveProducts,
  useBulkRejectProducts,
  useVendorReviews,
  useDeletedReviews,
  useCreateReview,
  useDeleteReview,
  useRestoreReview,
} from '@/modules/marketplace'
```

### Intentionally NOT Exported from Root (Phase 6.19)

UI/page-level exports were removed from the root barrel to prevent eager loading of `MarketplacePage`, `StoreDetailPage` (1288 lines), and other heavy pages when importing lightweight symbols (APIs, domain helpers, hooks).

| Symbol | Available Via |
|---|---|
| `MarketplacePage` | `lazy(() => import('@/pages/Marketplace'))` or `@/modules/marketplace/ui` |
| `StoresPage` | `lazy(() => import('@/pages/Stores'))` or `@/modules/marketplace/ui` |
| `StoreDetailPage` | `lazy(() => import('@/pages/StoreDetail'))` or `@/modules/marketplace/ui` |
| `SearchResultsPage` | `lazy(() => import('@/pages/SearchResults'))` or `@/modules/marketplace/ui` |
| `SeasonalPage` | `lazy(() => import('@/pages/Seasonal'))` or `@/modules/marketplace/ui` |
| `SearchBar` | `@/components/Search/SearchBar` or `@/modules/marketplace/ui` |

### UI / Page Import Policy

App code should import marketplace pages via lazy imports from original paths:
```js
const MarketplacePage = lazy(() => import('@/pages/Marketplace'))
const StoreDetailPage = lazy(() => import('@/pages/StoreDetail'))
```

Marketplace UI components should be imported from their original paths:
```js
import SearchBar from '@/components/Search/SearchBar'
```

UI exports remain available through `src/modules/marketplace/ui/index.js` for intra-module use only.

## Structure

```
src/modules/marketplace/
├── index.js          ← Public API entry point
├── api/
│   └── index.js      ← Algolia service, store type service
├── domain/
│   └── index.js      ← Seasonal calendar, public visibility helpers
├── ui/
│   └── index.js      ← Marketplace, Stores, StoreDetail, SearchResults, Seasonal, SearchBar
├── hooks/
│   └── index.js      ← Product and review query hooks
├── stores/
│   └── index.js      ← Placeholder (no marketplace store yet)
├── utils/
│   └── index.js      ← Placeholder (future marketplace utilities)
└── README.md         ← This file
```

## What Belongs in Marketplace

- Public marketplace browsing pages (Marketplace, Stores, StoreDetail, SearchResults, Seasonal)
- Search bar component (reusable browsing widget)
- Store type service and rules (store classification, delivery options)
- Seasonal calendar constants and helpers
- Public visibility helpers (filtering experimental/demo vendors and products)
- Marketplace React Query hooks for product browsing and reviews
- Marketplace filter/sort/pagination URL param handling (currently inline in pages)

## What Does NOT Belong in Marketplace

- Product CRUD (belongs in `catalog` module)
- Product approval/moderation (belongs in `catalog` module)
- Product image upload management (belongs in `catalog` module)
- Product repository and data access (belongs in `catalog` module)
- Inventory write logic (belongs in `catalog` or `orders` module)
- Cart state (belongs in `cart` module)
- Checkout flow (belongs in `checkout` module)
- Orders lifecycle (belongs in `orders` module)
- Payments (belongs in `payments` module)
- Delivery (belongs in `delivery` module)
- Auth/session logic (belongs in `auth` module)
- User profile ownership (belongs in `users` module)
- Admin dashboard composition (belongs in `admin` or `app` module)
- Product detail page (complex, currently in catalog — see migration candidates)

## Relationship with Catalog

- **Marketplace consumes catalog public read APIs** — `useProducts`, `ProductCard`, `fetchProducts`, `productSearchService`.
- **Catalog owns product data and product management capabilities** — CRUD, approval, images.
- **Marketplace owns browsing/page composition** — listing pages, search UI, filters, sorting.
- **No circular dependencies** — marketplace imports from catalog; catalog does NOT import from marketplace.

## Relationship with Users / Public Vendor Profiles

- **Marketplace references vendor/user data** — store listings query `profilesService` and `public_profiles` view.
- **Users owns profile details** — marketplace should eventually use `@/modules/users` for public profile reads.
- **Currently** `Stores.jsx` and `StoreDetail.jsx` import `profilesService` directly. This is documented as a migration candidate.

## Relationship with Cart / Favorites

- **Marketplace pages use ProductCard which imports cartStore and favoritesStore** — this coupling exists but is not owned by marketplace.
- **Cart state is owned by cart module** — marketplace only triggers cart actions via ProductCard.
- **Favorites state** — similar coupling via ProductCard.
- **Future decoupling:** ProductCard should accept `onAddToCart` / `onToggleFavorite` as props.

## Relationship with Reviews

- **Marketplace displays reviews** — `useVendorReviews` hook is re-exported here.
- **Review service** (`reviewService.js`) is in `@/modules/reviews` — re-exported here for marketplace browsing context.
- **Review queries** in `useMarketplaceQueries.js` are re-exported here.
- **Review CRUD mutations** (`useCreateReview`, `useDeleteReview`, `useRestoreReview`) are re-exported here as they are used in browsing context.

## Allowed Dependencies

- `@/modules/shared` — shared UI, hooks, utils
- `@/modules/catalog` — catalog public API for product reads, ProductCard, search
- `@/modules/users` — for public vendor profile reads (when needed)
- `@/modules/auth` — for current user identity (read-only, e.g., in StoreDetail)
- `@/services/supabase` — Supabase client
- `@/services/profilesService` — vendor profile reads (until users module adoption)
- `@/lib/config` — app config
- `@/utils/` — general utilities (currency, logger, sanitization, error handling)
- `@/constants/` — categories, seasonal calendar, api endpoints

## Forbidden Dependencies

- `@/modules/cart` — cart module (cart state is separate)
- `@/modules/checkout` — checkout module
- `@/modules/orders` — orders module (order queries in useMarketplaceQueries are NOT re-exported)
- `@/modules/payments` — payments module
- `@/modules/delivery` — delivery module
- `@/modules/admin` — admin dashboard composition

## Migration Candidates for Future Sprints

| File | Current Location | Target | Sprint | Notes |
|---|---|---|---|---|
| `Marketplace.jsx` | `@/pages/Marketplace` | `@/modules/marketplace/ui/pages/` | 2.3+ | 481 lines, uses catalog hooks + SearchBar |
| `Stores.jsx` | `@/pages/Stores` | `@/modules/marketplace/ui/pages/` | 2.3+ | 303 lines, uses profilesService directly |
| `StoreDetail.jsx` | `@/pages/StoreDetail` | `@/modules/marketplace/ui/pages/` | 2.3+ | 1288 lines, complex — imports productImages, storeTypeService, authStore, publicVisibility |
| `SearchResults.jsx` | `@/pages/SearchResults` | `@/modules/marketplace/ui/pages/` | 2.3+ | 388 lines, uses productSearchService, SearchBar |
| `Seasonal.jsx` | `@/pages/Seasonal` | `@/modules/marketplace/ui/pages/` | 2.3+ | 325 lines, uses seasonalCalendar constants |
| `SearchBar.jsx` | `@/components/Search/SearchBar` | `@/modules/marketplace/ui/components/` | 2.3+ | 182 lines, uses algoliaService |
| `useMarketplaceQueries.js` | `@/hooks/queries/` | `@/modules/marketplace/hooks/` | 2.3+ | 315 lines, MIXED — needs splitting: product/review hooks → marketplace, order hooks → orders |
| `storeTypeService.js` | `@/services/storeTypeService` | `@/modules/marketplace/api/` | 2.3+ | 328 lines, store classification |
| `algoliaService.js` | `@/services/search/algoliaService` | `@/modules/marketplace/api/` | 2.3+ | 43 lines, thin wrapper |
| `seasonalCalendar.js` | `@/constants/seasonalCalendar` | `@/modules/marketplace/domain/` | 2.3+ | Safe to move |
| `publicVisibility.js` | `@/utils/publicVisibility` | `@/modules/marketplace/utils/` | 2.3+ | 65 lines, safe to move |
| `ProductDetail.jsx` | `@/pages/ProductDetail` | `@/modules/marketplace/ui/pages/` or `catalog` | 2.3+ | 1116 lines, VERY complex — imports cart, delivery, inventory, reviews, refund. Needs decomposition first. |
| `reviewService.js` | `@/modules/reviews` | Already migrated | ✅ Done | Migrated to reviews module, stub deleted Phase 7.19 |
| `api.js` (vendor/store parts) | `@/services/api` | `@/modules/marketplace/api/` | 2.3+ | Large mixed file — needs splitting |

## Intentionally NOT Exported (Candidates for Later)

| Item | Reason |
|---|---|
| `ProductDetail.jsx` | 1116 lines, imports cart/delivery/inventory/reviews/refund — too complex, needs decomposition |
| `ProductCard.jsx` | Already exported by catalog module; has cart/favorites coupling |
| `productSearchService.js` | Already exported by catalog module |
| `productRepository.ts` | Already exported by catalog module |
| `productsApi.ts` | Already exported by catalog module |
| `useProducts.ts` (from `@/hooks/useProducts`) | Already exported by catalog module |
| Order hooks from `useMarketplaceQueries.js` | Order queries belong to orders module, not marketplace |
| `orderKeys`, `useOrders`, `useOrder`, `useCreateOrder`, etc. | Order hooks — belong to orders module |
| `cartStore` / `favoritesStore` | Cart and favorites are separate concerns |
| `api.js` (entire file) | Large mixed file — needs splitting first |
| `reviewService.js` | Migrated to reviews module — stub deleted Phase 7.19 |
| `refundPolicyService.js` | Refunds belong to payments module |
| `deliveryEligibilityService.js` | Delivery belongs to delivery module |
| `inventoryService.js` | Inventory belongs to catalog or orders module |

## Safety Notes

- **Marketplace browsing:** `Marketplace.jsx` uses `useProducts` from catalog and `SearchBar` for browsing. No changes made.
- **Store listings:** `Stores.jsx` queries `profilesService` and `supabase` directly for vendor listings. No changes made.
- **Store detail:** `StoreDetail.jsx` is 1288 lines with many imports (productImages, storeTypeService, authStore, publicVisibility, ProductCard). No changes made.
- **Search:** `SearchResults.jsx` uses `productSearchService` and `algoliaService` for search. No changes made.
- **Seasonal:** `Seasonal.jsx` uses `seasonalCalendar` constants. No changes made.
- **Public visibility:** `publicVisibility.js` filters experimental/demo vendors and products from public view. No changes made.
- **useMarketplaceQueries.js:** This file mixes product, order, and review hooks. Only product and review hooks are re-exported here. Order hooks are intentionally excluded as they belong to the orders module.
- **Routes:** All marketplace routes (`/marketplace`, `/product/:id`, `/stores`, `/stores/:id`, `/search`, `/marketplace/seasonal`) remain unchanged.
