# Cart Module

## Purpose

The cart module encapsulates all cart and favorites state management:
- Cart state (add, remove, update quantity, clear cart)
- Cart totals (subtotal, tax, vendor count, item count)
- Cart validation against database (price changes, availability, stock)
- Cart persistence via Zustand `persist` middleware (localStorage + Capacitor)
- Checkout vendor selection (single-vendor checkout flow)
- Favorites/wishlist state (toggle, load, clear, count)
- Favorites API (Supabase queries for `favorites` table)
- Cart page and favorites page
- Cart quantity normalization utilities
- Minimum order service (vendor cart buckets + minimum order evaluation)

## Current Status: Partial File Movement

This module is a **re-export layer** with source files moved in:
- `src/store/favoritesStore.js` → `src/modules/cart/stores/favoritesStore.js` (Phase 6.8, stub deleted Phase 7.19)
- `src/services/favorites.js` → `src/modules/cart/api/favorites.js` (Phase 6.9 — favoritesApi only; other exports split to chat/orders/users modules)
- `src/store/cartStore.js` → `src/modules/cart/stores/cartStore.js` (Phase 6.11, stub deleted Phase 7.19)
- Old compatibility stubs have been deleted. All consumers should import from `@/modules/cart`.
- All other re-exports point to existing files in `src/store/`, `src/pages/`, `src/services/`,
  `src/utils/`.

## Public API (Root Barrel — Lightweight)

The root barrel exports only lightweight non-UI symbols: stores, hooks, API services, and domain utilities.

```js
import {
  // Stores
  useCartStore,
  useFavoritesStore,

  // Hooks
  useCartHydrated,

  // API / Services
  favoritesApi,
  buildVendorCartBuckets,
  evaluateVendorMinimumOrders,
  buildMinimumOrderMessage,

  // Domain / Utilities
  normalizeQuantity,
  formatQuantity,
  getQuantityStep,
  isDecimalQuantityUnit,
} from '@/modules/cart'
```

### Intentionally NOT Exported from Root (Phase 6.13)

UI/page-level exports were removed from the root barrel to prevent eager loading of `Cart.jsx`/`Favorites.jsx` → `Map.jsx` → Leaflet when consumers only need stores/api/domain/hooks/utils.

| Symbol | Available Via |
|---|---|
| `CartPage` | `lazy(() => import('@/pages/Cart'))` or `@/modules/cart/ui` |
| `FavoritesPage` | `lazy(() => import('@/pages/Favorites'))` or `@/modules/cart/ui` |

### UI / Page Import Policy

App code should import cart pages via lazy imports from original paths:
```js
const CartPage = lazy(() => import('@/pages/Cart'))
const FavoritesPage = lazy(() => import('@/pages/Favorites'))
```

UI exports remain available through `src/modules/cart/ui/index.js` for intra-module use only.

## Structure

```
src/modules/cart/
├── index.js          ← Public API entry point
├── api/
│   └── index.js      ← Favorites API, minimum order service
├── domain/
│   └── index.js      ← Cart quantity utilities
├── ui/
│   └── index.js      ← Cart page, Favorites page
├── hooks/
│   └── index.js      ← useCartHydrated
├── stores/
│   └── index.js      ← useCartStore, useFavoritesStore
├── utils/
│   └── index.js      ← Placeholder (future cart utilities)
└── README.md         ← This file
```

## What Belongs in Cart

- Cart state management (add, remove, update quantity, clear)
- Cart totals calculation (subtotal, tax, vendor count, item count)
- Cart validation against database (price changes, availability)
- Cart persistence (Zustand persist with `cart-storage` key)
- Checkout vendor selection (`checkoutVendorId`, `setCheckoutVendor`, `clearCheckoutVendor`)
- Favorites/wishlist state (toggle, load, clear, count)
- Favorites persistence (Zustand persist with `favorites-storage` key)
- Favorites API (Supabase queries for `favorites` table)
- Cart page and favorites page
- Cart quantity normalization utilities (`normalizeQuantity`, `formatQuantity`, `getQuantityStep`)
- Minimum order service (vendor cart buckets, minimum order evaluation)

## What Does NOT Belong in Cart

- Product CRUD (belongs in `catalog` module)
- Product approval/moderation (belongs in `catalog` module)
- Product image upload (belongs in `catalog` module)
- Marketplace browsing pages (belongs in `marketplace` module)
- Checkout/order creation flow (belongs in `checkout` module)
- Payments (belongs in `payments` module)
- Delivery (belongs in `delivery` module)
- Auth/session logic (belongs in `auth` module)
- User profile ownership (belongs in `users` module)
- Admin dashboard composition (belongs in `admin` or `app` module)
- ProductCard component (belongs in `catalog` module — uses cart actions but doesn't own them)
- ProductDetail page (complex, currently in catalog — uses cart actions)

## Relationship with Catalog

- **Cart consumes product identity, price, stock/availability** from catalog.
- `cartStore.addItem(product, quantity)` receives a product object from catalog data.
- `cartStore.validateCart()` queries `products` table directly via Supabase to validate cart items.
- `cartStore` imports `supabase` and `normalizeQuantity` — not catalog module internals.
- **Cart must not import deep files from catalog internals.** Future imports should use `@/modules/catalog`.

## Relationship with Marketplace

- **Marketplace uses cart actions in UI components** — `ProductCard` imports `useCartStore` for "Add to Cart".
- **Cart does not own marketplace page composition** — marketplace pages are in marketplace module.
- `ProductCard` (owned by catalog) has a coupling to `cartStore` — documented as migration candidate.

## Relationship with Checkout

- **Checkout consumes cart contents** — `CheckoutSimplified.jsx` imports `useCartStore`.
- `cartStore` provides `getCheckoutItems()` and `checkoutVendorId` for checkout flow.
- `checkoutService.js` imports `useCartStore` for order creation from cart.
- **Cart does not create orders** — it provides cart data to checkout.
- **Cart does not initiate payments** — payments are handled by checkout/payments module.

## Relationship with Auth/Users

- **Cart uses `supabase` directly** for vendor open check (`is_vendor_open` RPC) and cart validation.
- **Favorites store tracks `userId`** to prevent cross-user data leakage.
- **Favorites API requires `userId`** for all operations.
- `authActionsService.js` and `authSessionStore.js` call `clearCart` and `clearFavorites` on logout.
- Cart does not own auth logic — it only provides clear functions for auth to call.

## Allowed Dependencies

- `@/modules/shared` — shared UI, hooks, utils
- `@/modules/catalog` — catalog public API for product data (when needed)
- `@/modules/auth` — auth public API only if needed for user-specific cart behavior
- `@/modules/users` — users public API only if needed for user-owned preferences
- `@/services/supabase` — Supabase client (for cart validation and vendor open check)
- `@/utils/persistStorage` — cross-platform storage adapter
- `@/utils/currency` — currency formatting
- `@/utils/logger` — logging
- `@/lib/config` — app config
- `react-hot-toast` — toast notifications
- `zustand` — state management

## Forbidden Dependencies

- `@/modules/checkout` — checkout module
- `@/modules/orders` — orders module
- `@/modules/payments` — payments module
- `@/modules/delivery` — delivery module
- `@/modules/admin` — admin dashboard composition
- `@/modules/marketplace` — marketplace module (marketplace uses cart, not vice versa)

## Persisted State Keys

**IMPORTANT: Do NOT change persisted state keys or versions.**

| Store | Persist Key | Version | Storage | Partialized State |
|---|---|---|---|---|
| `useCartStore` | `cart-storage` | 4 | `persistStorage` (localStorage + Capacitor) | `items`, `lastValidated`, `checkoutVendorId` |
| `useFavoritesStore` | `favorites-storage` | (default) | localStorage (default) | `favoriteIds` (as Array), `userId` |

### Migration Notes

- `cart-storage` has a `migrate` function that handles v1 → v2 (full products → essential data only).
- `favorites-storage` uses `onRehydrateStorage` to convert `favoriteIds` Array back to Set.
- Changing these keys or versions would break existing user carts/favorites on app update.

## Migration Candidates for Future Sprints

| File | Current Location | Target | Sprint | Notes |
|---|---|---|---|---|
| `cartStore.js` | `@/modules/cart` | Already migrated | ✅ Done | Moved in Phase 6.11, stub deleted Phase 7.19 |
| `favoritesStore.js` | `@/modules/cart` | Already migrated | ✅ Done | Moved in Phase 6.8, stub deleted Phase 7.19 |
| `Cart.jsx` | `@/pages/Cart` | `@/modules/cart/ui/pages/` | 2.4+ | 1075 lines, uses cartStore + minimumOrderService + supabase |
| `Favorites.jsx` | `@/pages/Favorites` | `@/modules/cart/ui/pages/` | 2.4+ | Uses favoritesStore |
| `cartQuantity.js` | `@/modules/cart` | Already migrated | ✅ Done | Moved to domain, stub deleted Phase 7.19 |
| `favorites.js` | `@/services/favorites` (stub deleted Phase 6.33) | `@/modules/cart/api/` | 2.4+ | 373 lines, favorites API |
| `minimumOrderService.js` | `@/modules/cart` | Already migrated | ✅ Done | Moved to api, stub deleted Phase 7.19 |
| `persistStorage.js` | `@/utils/persistStorage` | `@/modules/shared/` or stay in utils | 2.4+ | Shared utility, not cart-specific |

## Intentionally NOT Exported (Candidates for Later)

| Item | Reason |
|---|---|
| `ProductCard.jsx` | Already exported by catalog module; has cart/favorites coupling |
| `ProductDetail.jsx` | Already in catalog; complex, imports cart/delivery/inventory/reviews/refund |
| `CheckoutSimplified.jsx` | Checkout concern, not cart |
| `checkoutService.js` | Checkout concern, not cart |
| `persistStorage.js` | Shared utility, not cart-specific |
| `currency.js` | Shared utility, not cart-specific |
| `authActionsService.js` | Auth concern, calls cart clear on logout |
| `authSessionStore.js` | Auth concern, calls cart clear on logout |

## Safety Notes

- **Cart store:** `cartStore.js` (539 lines) uses Zustand `persist` with `cart-storage` key (version 4). Has migration logic from v1 → v2. Uses `persistStorage` for cross-platform storage. No changes made.
- **Favorites store:** `favoritesStore.js` (206 lines) uses Zustand `persist` with `favorites-storage` key. Uses default localStorage. Has `onRehydrateStorage` to convert Array back to Set. No changes made.
- **Cart validation:** `cartStore.validateCart()` queries `products` table directly via Supabase. No changes made.
- **Vendor open check:** `cartStore` calls `supabase.rpc('is_vendor_open')` on add. No changes made.
- **Quantity normalization:** `cartQuantity.js` handles decimal-compatible units (kg, g, lb, ton, liter, meter). No changes made.
- **Minimum order service:** `minimumOrderService.js` builds vendor cart buckets and evaluates minimum order amounts. No changes made.
- **Favorites API:** `favorites.js` queries `favorites` table via Supabase with product joins. No changes made.
- **Routes:** `/cart` and `/favorites` routes remain unchanged.
