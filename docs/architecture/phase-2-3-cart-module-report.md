# Phase 2.3 — Cart Module Foundation Report

**Date:** 2026-06-22  
**Project:** Greenmarket / Qotoof  
**Phase:** 2.3 — Cart Module Foundation  
**Purpose:** Create `src/modules/cart/` as the public cart and favorites module layer using re-exports only.

---

## 1. Confirmation: `.windsurfrules` Read and Followed

✅ `.windsurfrules` was read in full during Phase 0.5 and re-consulted before this phase.

Key rules respected:

- **Rule 1 (Minimal changes):** 8 new files created, 0 files moved, 0 files deleted, 0 imports changed.
- **Rule 30 (Stop and ask):** No Supabase/RLS/Auth/Database/Payments/migrations touched.
- **No `any`, no `@ts-ignore`, no `@ts-expect-error`** — not needed.
- **No business logic changes.** No Zustand behavior changes. No persisted state key changes.
- **No circular dependencies** introduced (verified by `madge`).

---

## 2. Current Cart/Favorites Architecture Summary

### Cart Store
- **`cartStore.js`** (539 lines, `src/store/`) — Zustand store with `persist` middleware.
  - **Persist key:** `cart-storage` (version 4), uses `persistStorage` (localStorage + Capacitor Preferences).
  - **State:** `items`, `lastValidated`, `checkoutVendorId`, `_hasHydrated`.
  - **Actions:** `addItem`, `removeItem`, `updateQuantity`, `clearCart`, `setCheckoutVendor`, `clearCheckoutVendor`, `clearVendorItems`, `getCheckoutItems`, `validateCart`.
  - **Getters:** `getItemCount`, `getTotalQuantity`, `getSubtotal`, `getTotal` (alias), `getTax` (0% for agricultural products), `getVendorCount`.
  - **Validation:** `validateCart()` queries `products` table via Supabase — checks existence, availability, price changes, quantity adjustments.
  - **Vendor open check:** `warnWhenVendorClosed()` calls `supabase.rpc('is_vendor_open')` on add.
  - **Migration:** v1 → v2 migration (full products → essential data only).
  - **Exports:** `useCartStore`, `useCartHydrated`.
  - **Dependencies:** `zustand`, `persistStorage`, `supabase`, `normalizeQuantity` (cartQuantity), `toast`, `logger`.

### Favorites Store
- **`favoritesStore.js`** (206 lines, `src/store/`) — Zustand store with `persist` middleware.
  - **Persist key:** `favorites-storage`, uses default localStorage.
  - **State:** `favorites`, `loading`, `error`, `favoriteIds` (Set), `userId`.
  - **Actions:** `loadFavorites`, `toggleProduct` (optimistic updates), `isFavorited`, `getFavoriteProducts`, `getFavoriteVendors`, `getCount`, `clearFavorites`.
  - **Cross-user protection:** Clears favorites if `userId` changes.
  - **onRehydrateStorage:** Converts `favoriteIds` Array back to Set.
  - **Exports:** `useFavoritesStore`.
  - **Dependencies:** `zustand`, `favoritesApi`, `toast`, `logger`.

### Cart Page
- **`Cart.jsx`** (1075 lines, `src/pages/`) — Cart page with quantity controls, vendor grouping, minimum order validation, checkout link.
  - Imports: `useCartStore`, `supabase`, `minimumOrderService`, `cartQuantity` utils, `currency` utils.

### Favorites Page
- **`Favorites.jsx`** (`src/pages/`) — Favorites page displaying favorited products.

### Cart Quantity Utilities
- **`cartQuantity.js`** (63 lines, `src/utils/`) — `normalizeQuantity`, `formatQuantity`, `getQuantityStep`, `isDecimalQuantityUnit`. Handles decimal-compatible units (kg, g, lb, ton, liter, meter).

### Favorites API
- **`favorites.js`** (373 lines, `src/services/`) — `favoritesApi` with Supabase queries: `getUserFavorites`, `isProductFavorited`, `addProduct`, `addVendor`, `remove`.

### Minimum Order Service
- **`minimumOrderService.js`** (57 lines, `src/services/`) — `buildVendorCartBuckets`, `evaluateVendorMinimumOrders`, `buildMinimumOrderMessage`. Groups cart items by vendor and checks minimum order amounts.

### Persist Storage
- **`persistStorage.js`** (71 lines, `src/utils/`) — Cross-platform storage adapter for Zustand persist. Supports localStorage + Capacitor Preferences for native platforms. **Shared utility, not cart-specific — not re-exported from cart module.**

### Cart Consumers (26 files)
- `ProductCard.jsx` — uses `useCartStore` for "Add to Cart"
- `ProductDetail.jsx` — uses `useCartStore` for "Add to Cart"
- `Cart.jsx` — uses `useCartStore` for cart page
- `CheckoutSimplified.jsx` — uses `useCartStore` for checkout
- `Navbar.jsx` — uses `useCartStore` for cart badge
- `MainLayout.jsx` — uses `useCartStore` for cart badge
- `Favorites.jsx` — uses `useFavoritesStore`
- `buyer/Dashboard.jsx`, `buyer/Orders.jsx`, `buyer/ShoppingLists.jsx` — use `useCartStore`
- `OrderDetail.jsx` — uses `useCartStore`
- `checkoutService.js` — uses `useCartStore` for order creation
- `authActionsService.js`, `authSessionStore.js` — call `clearCart`/`clearFavorites` on logout
- Tests: `useCart.test.js`, `addToCart.integration.test.js`, `checkout.integration.test.js`, etc.

### Routes
- `/cart` → CartPage
- `/favorites` → FavoritesPage

---

## 3. What Cart Files Were Created

```
src/modules/cart/
├── index.js              ← Public API entry point
├── api/
│   └── index.js          ← Favorites API, minimum order service
├── domain/
│   └── index.js          ← Cart quantity utilities
├── ui/
│   └── index.js          ← Cart page, Favorites page
├── hooks/
│   └── index.js          ← useCartHydrated
├── stores/
│   └── index.js          ← useCartStore, useFavoritesStore
├── utils/
│   └── index.js          ← Placeholder (future cart utilities)
└── README.md             ← Module documentation
```

**8 new files created.**

---

## 4. Files Moved

**None.** No files were moved. This is an additive, re-export-only step.

---

## 5. Files Re-Exported/Wrapped

### Stores
| Export | Source |
|---|---|
| `useCartStore` | `@/store/cartStore` |
| `useFavoritesStore` | `@/store/favoritesStore` |

### Hooks
| Export | Source |
|---|---|
| `useCartHydrated` | `@/store/cartStore` |

### UI / Pages
| Export | Source |
|---|---|
| `CartPage` (default) | `@/pages/Cart` |
| `FavoritesPage` (default) | `@/pages/Favorites` |

### API / Services
| Export | Source |
|---|---|
| `favoritesApi` | `@/services/favorites` |
| `buildVendorCartBuckets` | `@/services/minimumOrderService` |
| `evaluateVendorMinimumOrders` | `@/services/minimumOrderService` |
| `buildMinimumOrderMessage` | `@/services/minimumOrderService` |

### Domain / Utilities
| Export | Source |
|---|---|
| `normalizeQuantity` | `@/utils/cartQuantity` |
| `formatQuantity` | `@/utils/cartQuantity` |
| `getQuantityStep` | `@/utils/cartQuantity` |
| `isDecimalQuantityUnit` | `@/utils/cartQuantity` |

---

## 6. Public API Exposed by `src/modules/cart`

```js
import {
  // Stores
  useCartStore, useFavoritesStore,

  // Hooks
  useCartHydrated,

  // UI / Pages
  CartPage, FavoritesPage,

  // API / Services
  favoritesApi,
  buildVendorCartBuckets, evaluateVendorMinimumOrders, buildMinimumOrderMessage,

  // Domain / Utilities
  normalizeQuantity, formatQuantity, getQuantityStep, isDecimalQuantityUnit,
} from '@/modules/cart'
```

---

## 7. Cart/Favorites Files Intentionally NOT Moved

| File | Reason |
|---|---|
| `cartStore.js` (539 lines) | Safe to move but deferred to keep Phase 2.3 additive-only. Has Supabase imports and migration logic. |
| `favoritesStore.js` (206 lines) | Safe to move but deferred. |
| `Cart.jsx` (1075 lines) | Safe to move but deferred. Uses cartStore + minimumOrderService + supabase. |
| `Favorites.jsx` | Safe to move but deferred. Uses favoritesStore. |
| `cartQuantity.js` (63 lines) | Safe to move but deferred. |
| `favorites.js` (373 lines) | Safe to move but deferred. |
| `minimumOrderService.js` (57 lines) | Safe to move but deferred. |
| `persistStorage.js` (71 lines) | Shared utility, not cart-specific. Should go to shared module. |
| `ProductCard.jsx` | Already exported by catalog module. Uses cart actions but doesn't own them. |
| `ProductDetail.jsx` | Already in catalog. Complex, imports cart/delivery/inventory/reviews/refund. |
| `CheckoutSimplified.jsx` | Checkout concern, not cart. |
| `checkoutService.js` | Checkout concern, not cart. |
| `authActionsService.js` | Auth concern, calls cart clear on logout. |
| `authSessionStore.js` | Auth concern, calls cart clear on logout. |
| `currency.js` | Shared utility, not cart-specific. |

---

## 8. Imports Changed

**None.** No existing imports were changed. All existing code continues to import from original locations. The cart module is purely additive.

---

## 9. Behavior Verification

| Check | Status | Details |
|---|---|---|
| Cart add/remove/update behavior unchanged | ✅ | `cartStore.js` not modified |
| Cart totals behavior unchanged | ✅ | `getSubtotal`, `getTotal`, `getTax`, `getVendorCount` not modified |
| Cart persistence behavior unchanged | ✅ | `cart-storage` key (v4), `persistStorage`, `partialize`, `migrate` not modified |
| Favorites behavior unchanged | ✅ | `favoritesStore.js` not modified |
| Favorites persistence unchanged | ✅ | `favorites-storage` key, `onRehydrateStorage` not modified |
| ProductCard behavior unchanged | ✅ | `ProductCard.jsx` not modified |
| ProductDetail behavior unchanged | ✅ | `ProductDetail.jsx` not modified |
| Checkout cart consumption unchanged | ✅ | `CheckoutSimplified.jsx`, `checkoutService.js` not modified |
| Routes unchanged | ✅ | `/cart`, `/favorites` routes remain as-is |
| Cart validation behavior unchanged | ✅ | `validateCart()` not modified |
| Vendor open check unchanged | ✅ | `warnWhenVendorClosed()` not modified |
| Minimum order validation unchanged | ✅ | `minimumOrderService.js` not modified |
| Quantity normalization unchanged | ✅ | `cartQuantity.js` not modified |
| Supabase queries unchanged | ✅ | No Supabase queries modified |
| RLS/database unchanged | ✅ | No database changes |

---

## 10. Verification Results

| Command | Result | Details |
|---|---|---|
| `npm run lint` | ✅ **Passed** | 0 errors, 0 warnings |
| `npm run type-check` | ✅ **Passed** | 0 errors (tsc --noEmit) |
| `npm run build` | ✅ **Passed** | Built in 2m 44s, PWA generated (198 precache entries) |
| `npm run check:circular` | ✅ **Passed** | 595 files (was 588 — 7 new files), **zero circular dependencies** |

### madge File Count Change

- Before: 588 files
- After: 595 files (+7 new files in `src/modules/cart/`)
- Circular dependencies: 0 (unchanged)

---

## 11. Documentation Updates

### Documents Updated (3)

| Document | Change |
|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | Status line updated to include Phase 2.3. Sprint 2.3 row updated with ✅. Added Phase 2.3 achievement note. |
| `DEVELOPER_GUIDE.md` | Added `src/modules/cart/` to project structure tree. |
| `ARCHITECTURE_GUIDE.md` | Updated TODO section to include Phase 2.3 completion. |

### Documents Checked But Not Changed (5)

| Document | Reason |
|---|---|
| `SYSTEM_DESIGN.md` | Describes runtime architecture, not file structure. No changes needed. |
| `eslint.config.js` | Already contains `no-restricted-imports` rule. No changes needed. |
| `package.json` | No scripts or dependencies changed. No changes needed. |
| `src/modules/catalog/README.md` | Catalog module not affected by cart module. No changes needed. |
| `src/modules/marketplace/README.md` | Marketplace module not affected. No changes needed. |
| `src/modules/shared/README.md`, `auth/README.md`, `users/README.md`, `app/README.md` | Not affected. No changes needed. |

### Outdated Documents Found

None new. The existing TODOs in `ARCHITECTURE_GUIDE.md` and `DEVELOPER_GUIDE.md` remain valid and were updated with Phase 2.3 status.

### Documentation Still Needing Future Updates

| Document | What | When |
|---|---|---|
| `ARCHITECTURE_GUIDE.md` | Replace `src/features/` tree with `src/modules/` + `src/app/` tree | Phase 2+ (when first file moves) |
| `DEVELOPER_GUIDE.md` | Update Edge Functions table (remove Stripe/CMI) | Phase 3 |
| `DEVELOPER_GUIDE.md` | Replace `src/features/` guide with `src/modules/` guide | Phase 2+ (when first file moves) |
| `src/modules/cart/README.md` | Update migration candidates as files are moved | Sprint 2.4+ |

---

## 12. Files Modified/Created

| File | Action |
|---|---|
| `src/modules/cart/index.js` | Created — public API entry point |
| `src/modules/cart/api/index.js` | Created — favorites API, minimum order service |
| `src/modules/cart/domain/index.js` | Created — cart quantity utilities |
| `src/modules/cart/ui/index.js` | Created — cart page, favorites page |
| `src/modules/cart/hooks/index.js` | Created — useCartHydrated |
| `src/modules/cart/stores/index.js` | Created — useCartStore, useFavoritesStore |
| `src/modules/cart/utils/index.js` | Created — cart utils placeholder |
| `src/modules/cart/README.md` | Created — module documentation |
| `MODULAR_DEVELOPMENT_PLAN.md` | Modified — status + Sprint 2.3 table + achievement note |
| `DEVELOPER_GUIDE.md` | Modified — project structure tree |
| `ARCHITECTURE_GUIDE.md` | Modified — TODO section updated |
| `docs/architecture/phase-2-3-cart-module-report.md` | Created — this report |

**Total: 9 new files created. 3 files modified. 0 files deleted. 0 files moved.**

---

## 13. Safety Assessment

| Check | Status |
|---|---|
| No business logic changes | ✅ |
| No Zustand behavior changes | ✅ |
| No persisted state key changes | ✅ |
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
| `ProductCard.jsx` imports `useCartStore` directly (catalog → cart coupling) | Medium | Documented in catalog README. Decouple via props in future sprint. |
| `ProductDetail.jsx` imports `useCartStore` directly | Medium | Documented. Complex page, needs decomposition. |
| `cartStore.js` queries `supabase` directly for validation and vendor open check | Low | Acceptable — cart needs database validation. Will use catalog public API in future. |
| `checkoutService.js` imports `useCartStore` for order creation | Low | Documented. Checkout consumes cart — correct direction. |
| `authActionsService.js` calls `clearCart`/`clearFavorites` on logout | Low | Documented. Auth calls cart clear — acceptable cross-module communication. |
| `cartStore.js` has v1 → v2 migration logic | Low | Documented. Migration logic must be preserved when file is moved. |
| `favoritesStore.js` uses default localStorage (not `persistStorage`) | Low | Documented. Inconsistency with cartStore — should be unified in future. |
| `useMarketplaceQueries.js` has order hooks that use `ordersApi` | Low | Order hooks not re-exported from cart. Will be in orders module. |

---

## 15. Whether It Is Safe to Continue to Phase 2.4

### ✅ Yes — Safe to continue to Phase 2.4 (orders module)

Phase 2.3 cart module foundation is complete and verified:
- `src/modules/cart/` exists as a pure re-export layer with 8 files.
- All 4 verification commands pass (lint, type-check, build, check:circular).
- 0 circular dependencies across 595 files.
- 0 imports changed, 0 files moved, 0 files deleted.
- 100% behavior preserved.
- No persisted state keys changed.
- Module boundaries documented with allowed/forbidden dependencies.
- No circular dependencies between cart and other modules (cart is consumed by marketplace/checkout/auth; cart does not import from them).

### Recommended Phase 2.4 approach (orders module):

1. **Inspect** order-related files: `ordersService.ts`, `orderLogic.ts`, `ordersApi` in `api.js`, order pages, order hooks in `useMarketplaceQueries.js`
2. **Create** `src/modules/orders/` with re-export layer (same pattern)
3. **Re-export** order store, order pages, order hooks, order service, order logic
4. **Do NOT move** any files in Sprint 2.4 — re-export only
5. **Run** all 4 verification commands
6. **Create** `docs/architecture/phase-2-4-orders-module-report.md`

### Files to inspect first for Sprint 2.4:

| File | Location | Reason |
|---|---|---|
| `ordersService.ts` | `@/services/` or `@/data/` | Order data access |
| `orderLogic.ts` | `@/business/` | Order business logic |
| `api.js` (order parts) | `@/services/api` | `ordersApi` — getOrder, getAll, create, updateStatus, delete, restore |
| `useMarketplaceQueries.js` (order hooks) | `@/hooks/queries/` | `useOrders`, `useOrder`, `useCreateOrder`, `useUpdateOrderStatus`, etc. |
| Order pages | `@/pages/` | Order listing, order detail, buyer orders, vendor orders |
| `checkoutService.js` | `@/services/` | Creates orders from cart |

### Files that must NOT be moved in Sprint 2.4:

| File | Reason |
|---|---|
| `cartStore.js` | Cart module concern |
| `favoritesStore.js` | Cart module concern |
| `Marketplace.jsx` | Marketplace module concern |
| `ProductCard.jsx` | Catalog module concern |
| Any file in `src/modules/cart/` | Cart module is stable |
| Any file in `src/modules/marketplace/` | Marketplace module is stable |
| Any file in `src/modules/catalog/` | Catalog module is stable |
| Any file in `src/modules/shared/` | Shared module is stable |
| Any file in `src/modules/auth/` | Auth module is stable |
| Any file in `src/modules/users/` | Users module is stable |
| Database migrations | No database changes |
| RLS policies | No RLS changes |
