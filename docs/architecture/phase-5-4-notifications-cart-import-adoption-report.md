# Phase 5.4 — Safe Import Adoption Report (notifications, cart)

**Phase:** 5.4 — Safe Import Adoption (notifications, cart)
**Date:** 2026-06-24
**Status:** ✅ Completed
**Approach:** Small, safe, reversible import-path migration — no behavior changes, no file movement, no legacy path deletion

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` was read in full and strictly followed throughout this phase.

Key rules respected:

- ✅ **Rule 1 (Minimal changes):** Only import-path changes — no files moved, no files deleted, no business logic changed.
- ✅ **No `any`, no `@ts-ignore`, no `@ts-expect-error`** — not needed.
- ✅ **No notification behavior changes** — notification creation, read, mark-as-read, badge all unchanged.
- ✅ **No notification preference behavior changes** — preferences, quiet hours all unchanged.
- ✅ **No realtime behavior changes** — realtime subscriptions unchanged.
- ✅ **No cart behavior changes** — cart add/remove/update, persistence, validation all unchanged.
- ✅ **No favorites behavior changes** — favorites toggle, persistence all unchanged.
- ✅ **No checkout behavior changes** — checkout flow untouched.
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
| `@/modules/notifications` | `src/modules/notifications/index.js` | `notificationsApi`, `notificationEvents`, `dispatchNotificationBadgeUpdate`, `dispatchNotificationPreferencesUpdated`, `createOrderNotification`, `createProductApprovalNotification`, `DEFAULT_NOTIFICATION_PREFERENCES`, `NOTIFICATION_CATEGORY_OPTIONS`, `NOTIFICATION_PREFERENCE_FIELDS`, `normalizeNotificationPreferences`, `commissionNotifications`, `emailService`, `useEmail`, `normalizeNotificationCategory`, `getNotificationPreferenceKey`, `isNotificationRead`, `resolveNotificationLink`, `resolveNotificationActionLabel`, `normalizeNotification`, `isWithinQuietHours`, `shouldMuteNotificationPreview`, `NotificationLink`, `NotificationsPage`, `notificationKeys`, `useNotifications`, `useUnreadCount`, `useMarkAsRead`, `useMarkAllAsRead`, `useNotificationPreferences`, `useSaveNotificationPreferences`, `useRealtimeNotifications` |
| `@/modules/cart` | `src/modules/cart/index.js` | `useCartStore`, `useFavoritesStore`, `useCartHydrated`, `CartPage`, `FavoritesPage`, `favoritesApi`, `buildVendorCartBuckets`, `evaluateVendorMinimumOrders`, `buildMinimumOrderMessage`, `normalizeQuantity`, `formatQuantity`, `getQuantityStep`, `isDecimalQuantityUnit` |

### Current Imports Surveyed

| Import Pattern | Files Found | Migration Candidates |
|---|---|---|
| `from '@/store/cartStore'` | 14 files | 5 safe (Navbar, MainLayout, buyer/Dashboard, buyer/Orders, buyer/ShoppingLists) — skipped high-risk (CheckoutSimplified, ProductDetail, Cart, OrderDetail, checkoutService, authActionsService, authSessionStore, ProductCard, checkoutService.test, addToCart.integration.test) and internal re-exports (cart/stores, cart/hooks) |
| `from '@/store/favoritesStore'` | 7 files | 1 safe (MainLayout) — skipped high-risk (ProductCard, Favorites, authActionsService, authSessionStore) and internal re-export (cart/stores) |
| `from '@/utils/cartQuantity'` | 4 files | 0 migrated — Cart.jsx (high-risk, uses Supabase directly), ProductDetail.jsx (forbidden), cartStore.js (internal), cart/domain (internal re-export) |
| `from '@/services/favorites'` | 6 files | 0 migrated — OrderTimeline (uses `orderTimelineApi`, not `favoritesApi`), ChatComponent (uses `messagesApi`, not `favoritesApi`), favoritesStore (internal), Favorites.jsx (high-risk, uses Supabase directly), cart/api (internal), chat/api (internal) |
| `from '@/services/notifications'` | 14 files | 1 safe (notifications.test.js) — skipped high-risk (NotificationLink.jsx, NotificationsPage, commissionService, fraudAwarenessService, disputeService, partnershipService, PaymentReceiptUpload, notificationsService.test.js) and internal re-exports (notifications/api, notifications/domain, notifications/utils, users/api, notifications.js itself, useNotificationQueries) |
| `from '@/services/notificationPreferences'` | 3 files | 0 migrated — all internal module re-exports (notifications/api, notifications/domain, users/api) |
| `from '@/components/notifications/NotificationLink'` | 4 files | 2 safe (Navbar, DashboardLayout) — skipped ProtectedRoute (forbidden), notifications/ui (internal re-export), notificationsService.test.js (complex test with many mocks) |
| `from '@/services/minimumOrderService'` | 5 files | 1 safe (test) — skipped CheckoutSimplified (forbidden), Cart.jsx (high-risk), checkout/api (internal), cart/api (internal) |
| `from '@/hooks/queries/useNotificationQueries'` | 1 file | 0 — only notifications/hooks internal re-export |
| `from '@/services/emailService'` | 4 files | 0 migrated — all high-risk (PaymentReceiptUpload, commissionNotifications, authActionsService, notificationsService.test.js) or internal re-export (notifications/api) |

### Files Inspected But Intentionally Skipped

| File | Reason Skipped |
|---|---|
| `src/pages/CheckoutSimplified.jsx` | High-risk — explicitly forbidden in task scope |
| `src/services/checkoutService.js` | High-risk — explicitly forbidden in task scope |
| `src/pages/OrderDetail.jsx` | High-risk — explicitly forbidden in task scope |
| `src/services/paymentGateway.js` | High-risk — explicitly forbidden in task scope |
| `src/services/paymentService.js` | High-risk — explicitly forbidden in task scope |
| `src/services/commissionService.js` | High-risk — explicitly forbidden in task scope |
| `src/services/realtime.js` | High-risk — explicitly forbidden in task scope |
| `src/pages/ProductDetail.jsx` | High-risk — explicitly forbidden in task scope |
| `src/pages/StoreDetail.jsx` | High-risk — explicitly forbidden in task scope |
| `src/components/ProtectedRoute.jsx` | High-risk — explicitly forbidden in task scope |
| `src/pages/admin/*` | High-risk — explicitly forbidden in task scope |
| `src/components/ui/ProductCard.jsx` | High-risk — has cart/favorites/auth coupling, complex component |
| `src/pages/Cart.jsx` | High-risk — 1075 lines, uses Supabase directly, imports cartStore + minimumOrderService + cartQuantity |
| `src/pages/Favorites.jsx` | High-risk — uses favoritesStore + favoritesApi + cartStore + Supabase directly |
| `src/pages/Notifications.jsx` | High-risk — 838 lines, imports many notification helpers from `@/services/notifications` directly |
| `src/components/notifications/NotificationLink.jsx` | High-risk — notification component itself, uses authStore + notificationsApi + realtime |
| `src/services/notifications.js` | Internal — notification service source file, not a consumer |
| `src/services/commissionNotifications.js` | Internal — commission notification source file |
| `src/services/fraudAwarenessService.js` | High-risk — uses notificationsApi, not a simple import change |
| `src/services/disputeService.js` | High-risk — uses notificationsApi, not a simple import change |
| `src/services/partnershipService.js` | High-risk — uses notificationsApi, not a simple import change |
| `src/components/orders/PaymentReceiptUpload.jsx` | High-risk — uses notificationsApi + emailService, order-related component |
| `src/store/cartStore.js` | Internal — cart store source file, not a consumer |
| `src/store/favoritesStore.js` | Internal — favorites store source file, not a consumer |
| `src/services/authActionsService.js` | High-risk — auth service, imports cartStore + favoritesStore for logout cleanup |
| `src/store/authSessionStore.js` | High-risk — session store, imports cartStore + favoritesStore for session cleanup |
| `src/services/checkoutService.js` | High-risk — checkout service, imports cartStore |
| `src/services/__tests__/notificationsService.test.js` | Complex test (525 lines) with many mocks — skipped to stay safe within 8-file limit |
| `src/__tests__/services/checkoutService.test.js` | Uses `jest.mock('@/store/cartStore')` — changing import would break mock |
| `src/features/marketplace/__tests__/addToCart.integration.test.js` | Uses `useCartStore` from `@/store/cartStore` in test — changing import may break test |
| `src/components/ui/OrderTimeline.jsx` | Imports `orderTimelineApi` from `@/services/favorites` — NOT `favoritesApi`, so not exported from `@/modules/cart` |
| `src/components/ui/ChatComponent.jsx` | Imports `messagesApi` from `@/services/favorites` — NOT `favoritesApi`, so not exported from `@/modules/cart` |
| `src/modules/notifications/api/index.js` | Internal module re-export |
| `src/modules/notifications/domain/index.js` | Internal module re-export |
| `src/modules/notifications/hooks/index.js` | Internal module re-export |
| `src/modules/notifications/ui/index.js` | Internal module re-export |
| `src/modules/notifications/utils/index.js` | Internal module re-export |
| `src/modules/cart/stores/index.js` | Internal module re-export |
| `src/modules/cart/api/index.js` | Internal module re-export |
| `src/modules/cart/domain/index.js` | Internal module re-export |
| `src/modules/cart/hooks/index.js` | Internal module re-export |
| `src/modules/users/api/index.js` | Internal module re-export |

---

## 3. Files Migrated (8 files)

| # | File | Old Imports | New Imports | Module |
|---|---|---|---|---|
| 1 | `src/__tests__/services/notifications.test.js` | `from '@/services/notifications'` | `from '@/modules/notifications'` | notifications |
| 2 | `src/__tests__/services/minimumOrderService.test.js` | `from '@/services/minimumOrderService'` | `from '@/modules/cart'` | cart |
| 3 | `src/components/Navbar.jsx` | `from '@/store/cartStore'`, `from '@/components/notifications/NotificationLink'` | `from '@/modules/cart'` (useCartStore), `from '@/modules/notifications'` (NotificationLink) | cart + notifications |
| 4 | `src/layouts/DashboardLayout.jsx` | `from '@/components/notifications/NotificationLink'` | `from '@/modules/notifications'` (NotificationLink) | notifications |
| 5 | `src/layouts/MainLayout.jsx` | `from '@/store/cartStore'`, `from '@/store/favoritesStore'` | `from '@/modules/cart'` (useCartStore, useFavoritesStore) | cart |
| 6 | `src/pages/buyer/Dashboard.jsx` | `from '@/store/cartStore'` | `from '@/modules/cart'` (useCartStore) | cart |
| 7 | `src/pages/buyer/Orders.jsx` | `from '@/store/cartStore'` | `from '@/modules/cart'` (useCartStore) | cart |
| 8 | `src/pages/buyer/ShoppingLists.jsx` | `from '@/store/cartStore'` | `from '@/modules/cart'` (useCartStore) | cart |

### Additional Fix: `src/modules/notifications/index.js`

A pre-existing bug was discovered and fixed during this phase:

```diff
- export { default as NotificationLink } from './ui'
- export { default as NotificationsPage } from './ui'
+ export { NotificationLink } from './ui'
+ export { NotificationsPage } from './ui'
```

**Explanation:** The `ui/index.js` file exports `NotificationLink` and `NotificationsPage` as named exports (via `export { default as NotificationLink } from '...'`), not as default exports. The `index.js` was incorrectly trying to import `default` from `./ui`, which doesn't exist. This bug was never caught before because no build-critical code imported from `@/modules/notifications` until this phase. The fix changes the re-export to use named imports, which matches the actual export shape of `ui/index.js`.

This is a **re-export layer fix**, not a behavior change. The exported values remain identical.

---

## 4. Imports Changed (Detailed)

### File 1: `src/__tests__/services/notifications.test.js`

```diff
- import {
-   DEFAULT_NOTIFICATION_PREFERENCES,
-   getNotificationPreferenceKey,
-   isWithinQuietHours,
-   normalizeNotification,
-   normalizeNotificationCategory,
-   normalizeNotificationPreferences,
-   notificationsApi,
-   resolveNotificationLink,
-   shouldMuteNotificationPreview,
- } from '@/services/notifications'
+ import {
+   DEFAULT_NOTIFICATION_PREFERENCES,
+   getNotificationPreferenceKey,
+   isWithinQuietHours,
+   normalizeNotification,
+   normalizeNotificationCategory,
+   normalizeNotificationPreferences,
+   notificationsApi,
+   resolveNotificationLink,
+   shouldMuteNotificationPreview,
+ } from '@/modules/notifications'
```

### File 2: `src/__tests__/services/minimumOrderService.test.js`

```diff
- import {
-   buildMinimumOrderMessage,
-   buildVendorCartBuckets,
-   evaluateVendorMinimumOrders,
- } from '@/services/minimumOrderService'
+ import {
+   buildMinimumOrderMessage,
+   buildVendorCartBuckets,
+   evaluateVendorMinimumOrders,
+ } from '@/modules/cart'
```

### File 3: `src/components/Navbar.jsx`

```diff
- import { useCartStore } from '@/store/cartStore'
+ import { useCartStore } from '@/modules/cart'
...
- import NotificationLink from '@/components/notifications/NotificationLink'
+ import { NotificationLink } from '@/modules/notifications'
```

**Note:** `NotificationLink` was a default import from `@/components/notifications/NotificationLink` and is a named export from `@/modules/notifications`. Usage in the file (`<NotificationLink />`) remains identical.

### File 4: `src/layouts/DashboardLayout.jsx`

```diff
- import NotificationLink from '@/components/notifications/NotificationLink'
+ import { NotificationLink } from '@/modules/notifications'
```

### File 5: `src/layouts/MainLayout.jsx`

```diff
- import { useCartStore } from '@/store/cartStore'
+ import { useCartStore } from '@/modules/cart'
...
- import { useFavoritesStore } from '@/store/favoritesStore'
+ import { useFavoritesStore } from '@/modules/cart'
```

### File 6: `src/pages/buyer/Dashboard.jsx`

```diff
- import { useCartStore } from '@/store/cartStore'
+ import { useCartStore } from '@/modules/cart'
```

### File 7: `src/pages/buyer/Orders.jsx`

```diff
- import { useCartStore } from '@/store/cartStore'
+ import { useCartStore } from '@/modules/cart'
```

### File 8: `src/pages/buyer/ShoppingLists.jsx`

```diff
- import { useCartStore } from '@/store/cartStore'
+ import { useCartStore } from '@/modules/cart'
```

---

## 5. Files Intentionally Skipped and Why

| # | File | Skip Reason |
|---|---|---|
| 1 | `src/pages/CheckoutSimplified.jsx` | Explicitly forbidden — high-risk |
| 2 | `src/services/checkoutService.js` | Explicitly forbidden — high-risk |
| 3 | `src/pages/OrderDetail.jsx` | Explicitly forbidden — high-risk |
| 4 | `src/services/paymentGateway.js` | Explicitly forbidden — high-risk |
| 5 | `src/services/paymentService.js` | Explicitly forbidden — high-risk |
| 6 | `src/services/commissionService.js` | Explicitly forbidden — high-risk |
| 7 | `src/services/realtime.js` | Explicitly forbidden — high-risk |
| 8 | `src/pages/ProductDetail.jsx` | Explicitly forbidden — high-risk |
| 9 | `src/pages/StoreDetail.jsx` | Explicitly forbidden — high-risk |
| 10 | `src/components/ProtectedRoute.jsx` | Explicitly forbidden — high-risk |
| 11 | `src/pages/admin/*` | Explicitly forbidden — admin pages |
| 12 | `src/components/ui/ProductCard.jsx` | High-risk — cart/favorites/auth coupling |
| 13 | `src/pages/Cart.jsx` | High-risk — 1075 lines, uses Supabase directly |
| 14 | `src/pages/Favorites.jsx` | High-risk — uses Supabase directly |
| 15 | `src/pages/Notifications.jsx` | High-risk — 838 lines, many direct notification imports |
| 16 | `src/components/notifications/NotificationLink.jsx` | High-risk — notification component itself |
| 17 | `src/services/notifications.js` | Internal — source file, not a consumer |
| 18 | `src/services/commissionNotifications.js` | Internal — source file |
| 19 | `src/services/fraudAwarenessService.js` | High-risk — uses notificationsApi |
| 20 | `src/services/disputeService.js` | High-risk — uses notificationsApi |
| 21 | `src/services/partnershipService.js` | High-risk — uses notificationsApi |
| 22 | `src/components/orders/PaymentReceiptUpload.jsx` | High-risk — uses notificationsApi + emailService |
| 23 | `src/store/cartStore.js` | Internal — cart store source file |
| 24 | `src/store/favoritesStore.js` | Internal — favorites store source file |
| 25 | `src/services/authActionsService.js` | High-risk — auth service, imports cart/favorites for logout |
| 26 | `src/store/authSessionStore.js` | High-risk — session store, imports cart/favorites for cleanup |
| 27 | `src/services/__tests__/notificationsService.test.js` | Complex test (525 lines) with many mocks — skipped for safety |
| 28 | `src/__tests__/services/checkoutService.test.js` | Uses `jest.mock('@/store/cartStore')` — changing import breaks mock |
| 29 | `src/features/marketplace/__tests__/addToCart.integration.test.js` | Uses `useCartStore` from `@/store/cartStore` in test |
| 30 | `src/components/ui/OrderTimeline.jsx` | Imports `orderTimelineApi` from `@/services/favorites` — NOT `favoritesApi` |
| 31 | `src/components/ui/ChatComponent.jsx` | Imports `messagesApi` from `@/services/favorites` — NOT `favoritesApi` |
| 32 | All internal module re-exports | `notifications/api`, `notifications/domain`, `notifications/hooks`, `notifications/ui`, `notifications/utils`, `cart/stores`, `cart/api`, `cart/domain`, `cart/hooks`, `users/api` |

---

## 6. Backward Compatibility Verification

| Question | Answer |
|---|---|
| Do old imports still work? | ✅ Yes — `@/store/cartStore`, `@/store/favoritesStore`, `@/utils/cartQuantity`, `@/services/favorites`, `@/services/notifications`, `@/services/notificationPreferences`, `@/services/minimumOrderService`, `@/components/notifications/NotificationLink`, `@/services/emailService` all remain unchanged |
| Were any files moved? | ✅ No — no files moved |
| Were any legacy paths deleted? | ✅ No — all old service files and import paths remain |
| Did notification behavior change? | ✅ No — only import paths replaced, same exported values |
| Did notification preference behavior change? | ✅ No — preference helpers unchanged |
| Did realtime behavior change? | ✅ No — realtime subscriptions unchanged |
| Did cart behavior change? | ✅ No — cart store, persistence, validation all unchanged |
| Did favorites behavior change? | ✅ No — favorites store, persistence all unchanged |
| Did checkout behavior change? | ✅ No — checkout flow untouched |
| Are Supabase queries unchanged? | ✅ Yes — no queries touched |
| Are routes unchanged? | ✅ Yes — no route changes |
| Were any deep module imports introduced? | ✅ No — verified by grep, no `@/modules/<name>/<subdir>` patterns found |

---

## 7. No Deep Module Imports Verification

A grep search for `from '@/modules/(notifications|cart)/` across all `src/**/*.{js,jsx,ts,tsx}` files returned **0 results**. All module imports use the public API root only (`@/modules/notifications`, `@/modules/cart`).

---

## 8. Documentation Updates

### Documents Updated

| Document | Update | Details |
|---|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | Status line updated | Added Phase 5.4 completion to status line |
| `MODULAR_DEVELOPMENT_PLAN.md` | Phase 5.4 completion note added | Added after Phase 5.3 note, documenting 8 files migrated, notifications index.js fix, and verification results |

### Documents Checked But Not Changed

| Document | Status | Notes |
|---|---|---|
| `ARCHITECTURE_GUIDE.md` | ✅ Current | No update needed — import adoption is internal refactoring |
| `DEVELOPER_GUIDE.md` | ✅ Current | No update needed — consumer-facing import paths are optional |
| `eslint.config.js` | ✅ Current | `no-restricted-imports` rule already enforces module boundaries |
| `package.json` | ✅ Current | No new scripts or dependencies |
| `src/modules/notifications/README.md` | ✅ Current | Public API unchanged — still re-exports same api/domain/ui/hooks |
| `src/modules/cart/README.md` | ✅ Current | Public API unchanged — still re-exports same stores/api/domain/ui/hooks |
| `src/modules/checkout/README.md` | ✅ Current | Not relevant to this phase |
| `src/modules/orders/README.md` | ✅ Current | Not relevant to this phase |
| `src/modules/shared/README.md` | ✅ Current | Not relevant to this phase |
| `.windsurfrules` | ✅ Current | No rules need updating |

### Outdated Documents Found

None. All documentation is current.

### Documentation Still Needing Future Updates

| Document | Update Needed | Target Phase |
|---|---|---|
| `src/modules/notifications/README.md` | Update migration status — 3 files now import from `@/modules/notifications` | Phase 5.5+ |
| `src/modules/cart/README.md` | Update migration status — 5 files now import from `@/modules/cart` | Phase 5.5+ |
| `DEVELOPER_GUIDE.md` | Document `src/services/apis/` directory in project structure tree | Phase 5.5+ |

---

## 9. Command Results

| Command | Result | Details |
|---|---|---|
| `npm run lint` | ✅ Exit code 0 | `eslint . --max-warnings 1500` — 0 errors, 0 warnings |
| `npm run type-check` | ✅ Exit code 0 | `tsc --noEmit` — no type errors |
| `npm run build` | ✅ Exit code 0 | `vite build` — built successfully in 1m 13s |
| `npm run check:circular` | ✅ Exit code 0 | `madge --circular` — 0 circular dependencies |

### madge File Count

| Phase | Files Tracked | Circular Deps |
|---|---|---|
| Phase 5.3 | 697 | 0 |
| **Phase 5.4** | **697** | **0** |

No new files created — only import paths changed in existing files. File count unchanged.

### Build Fix Applied

During the first build attempt, a pre-existing bug in `src/modules/notifications/index.js` was discovered:
- **Bug:** `export { default as NotificationLink } from './ui'` tried to import a non-existent default export from `./ui/index.js`
- **Root cause:** `ui/index.js` uses `export { default as NotificationLink } from '...'` (named re-export), so `NotificationLink` is a named export, not a default export of `ui/index.js`
- **Fix:** Changed to `export { NotificationLink } from './ui'` (named re-export)
- **Impact:** No behavior change — same exported values, just correct re-export syntax
- **Why it was never caught before:** No build-critical code imported from `@/modules/notifications` until Phase 5.4

---

## 10. Whether It Is Safe to Continue to Phase 5.5

### ✅ Yes — It is safe to continue to Phase 5.5 import adoption

**Justification:**

1. **8 files successfully migrated** with only import-path changes
2. **All 4 verification commands pass** (lint, type-check, build, check:circular)
3. **0 circular dependencies** across 697 files
4. **Full backward compatibility** — all old import paths remain working
5. **No behavior changes** — same exported values, same Supabase queries, same React Query keys
6. **No deep module imports** introduced (verified by grep)
7. **No files moved or deleted**
8. **Notification-critical files untouched** — NotificationLink.jsx, NotificationsPage, notifications.js all unchanged
9. **Cart-critical files untouched** — cartStore.js, favoritesStore.js, Cart.jsx, Favorites.jsx all unchanged
10. **Pre-existing notifications module bug fixed** — `index.js` re-export syntax corrected for NotificationLink and NotificationsPage
11. **Layout components now import from module public APIs** — Navbar, DashboardLayout, MainLayout all use `@/modules/notifications` and `@/modules/cart`
12. **Buyer pages now import from module public APIs** — buyer/Dashboard, buyer/Orders, buyer/ShoppingLists all use `@/modules/cart`

---

## 11. Recommended Phase 5.5 Import Adoption Modules

### Primary recommendation: `orders` + `delivery`

**Rationale:**
- `orders` module re-exports ordersService, ordersApi, orderLogic, order hooks, order pages
- `delivery` module re-exports deliveriesApi, delivery services, driver pages
- Order-related pages and delivery-related components are good candidates
- Medium risk — some pages use Supabase directly but those are explicitly forbidden
- `buyer/Orders.jsx` already imports `useCartStore` from `@/modules/cart` (migrated in this phase) — good foundation

### Secondary recommendation: `checkout` + `payments`

**Rationale:**
- `checkout` module re-exports checkoutService, checkout pages, checkout components
- `payments` module re-exports paymentGateway, paymentService, invoiceService
- Checkout and payment imports are mostly in high-risk files — limited candidates
- Low number of safe migration candidates

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
| R11 | `Notifications.jsx` is 838 lines | High | Large notification page with many direct imports | Decompose before moving |
| R12 | `NotificationLink.jsx` is 167 lines | Medium | Self-contained but uses authStore + notificationsApi + realtime | Migrate imports in future phase |
| R13 | `Cart.jsx` is 1075 lines | High | Uses Supabase directly, imports cartStore + minimumOrderService + cartQuantity | Decompose before moving |
| R14 | `favoritesStore.js` imports from `@/services/favorites` | Medium | Internal coupling between store and API | Document before moving |
| R15 | `notifications/index.js` had pre-existing re-export bug | Low | Fixed in this phase — `default` → named re-export for UI components | ✅ Resolved |
| R16 | `OrderTimeline.jsx` imports `orderTimelineApi` from `@/services/favorites` | Low | `orderTimelineApi` not exported from `@/modules/cart` — `favorites.js` is a mixed file | Split `favorites.js` before moving |
| R17 | `ChatComponent.jsx` imports `messagesApi` from `@/services/favorites` | Low | `messagesApi` not exported from `@/modules/cart` — `favorites.js` is a mixed file | Split `favorites.js` before moving |
| R18 | Internal module re-exports still point to old paths | Low | `notifications/api`, `notifications/domain`, `cart/stores`, `cart/api`, `cart/domain` all import from old paths | Update internal re-exports in Phase 5.5+ |
| R19 | Test files use `jest.mock` with old paths | Low | `checkoutService.test.js` mocks `@/store/cartStore`; `notificationsService.test.js` imports from `@/services/notifications` | Update mock paths when migrating test files |
| R20 | `notificationsService.test.js` is 525 lines with complex mocks | Low | Complex test — skipped for safety | Migrate in future phase with careful mock path updates |

---

## 13. Conclusion

### Phase 5.4: ✅ Completed

**Summary:**
- 8 files migrated to use `@/modules/notifications` and `@/modules/cart`
- 1 pre-existing bug fixed in `src/modules/notifications/index.js` (re-export syntax)
- 0 files moved
- 0 files deleted
- 0 behavior changes
- 0 notification behavior changes
- 0 notification preference behavior changes
- 0 realtime behavior changes
- 0 cart behavior changes
- 0 favorites behavior changes
- 0 checkout behavior changes
- 0 Supabase query changes
- 0 React Query key changes
- 0 circular dependencies (697 files)
- 0 deep module imports introduced
- All 4 verification commands pass
- Full backward compatibility maintained
- All old import paths remain working

**It is safe to continue to Phase 5.5.**

**Recommended Phase 5.5 modules:** `orders` + `delivery` (primary), `checkout` + `payments` (secondary).
