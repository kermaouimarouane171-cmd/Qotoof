# Phase 2.4 — Orders Module Foundation Report

**Date:** 2026-06-22  
**Project:** Greenmarket / Qotoof  
**Phase:** 2.4 — Orders Module Foundation  
**Purpose:** Create `src/modules/orders/` as the public orders module layer using re-exports only.

---

## 1. Confirmation: `.windsurfrules` Read and Followed

✅ `.windsurfrules` was read in full during Phase 0.5 and re-consulted before this phase.

Key rules respected:

- **Rule 1 (Minimal changes):** 9 new files created, 0 files moved, 0 files deleted, 0 imports changed.
- **Rule 30 (Stop and ask):** No Supabase/RLS/Auth/Database/Payments/migrations touched.
- **No `any`, no `@ts-ignore`, no `@ts-expect-error`** — not needed.
- **No business logic changes.** No order lifecycle changes. No order status changes.
- **No circular dependencies** introduced (verified by `madge`).

---

## 2. Current Orders Architecture Summary

### Orders Service
- **`ordersService.ts`** (704 lines, `src/services/`) — Centralised Supabase queries on `orders` table.
  - **Functions:** `fetchVendorOrders`, `fetchBuyerOrders`, `fetchBuyerOrdersAll`, `fetchAdminOrders`, `fetchOrderById`, `updateOrderStatus`, `subscribeToVendorOrders`, `subscribeToOrderById`, `submitReturnRequest`.
  - **Aggregated export:** `ordersService` object + default export.
  - **Dependencies:** `supabase`, `productImages` (catalog concern), `sanitization`, `orderLogic`, `orderRepository`.
  - **Select clauses:** VENDOR_ORDERS_SELECT, BUYER_ORDERS_SELECT, ADMIN_ORDERS_SELECT, ORDER_BY_ID_SELECT (with fallback no-images versions).
  - **Status update flow:** Load current status → validate transition → build payload → persist → insert notification.
  - **Return requests:** Queries `return_requests` table.

### Order Logic
- **`orderLogic.ts`** (55 lines, `src/business/`) — Pure business logic.
  - `ALLOWED_STATUS_TRANSITIONS` — finite state machine for order status transitions.
  - `isAllowedOrderStatusTransition(currentStatus, nextStatus)` — validates transitions.
  - `buildOrderStatusUpdatePayload(status, metadata)` — builds update payload with timestamps.

### Order Status Constants
- **`orderStatuses.ts`** (465 lines, `src/constants/`) — Canonical source of truth.
  - `ORDER_STATUS_VALUES`, `ORDER_STATUS_ENUM` — status key constants.
  - `ORDER_STATUSES`, `ORDER_STATUSES_ARRAY` — flat arrays.
  - `ORDER_STATUS_COLORS` — Tailwind CSS class tokens per status.
  - `ORDER_STATUS_COLORS_FALLBACK` — fallback for unknown statuses.
  - `ORDER_STATUS_LABELS_EN` — English labels.
  - `STATUS_I18N_KEYS` — i18n key map.
  - `ACTIVE_ORDER_STATUSES` — statuses representing in-progress orders.
  - `PAYMENT_CONFIRMATION_ELIGIBLE_STATUSES` — statuses eligible for payment receipt upload.
  - `BUYER_CANCELLABLE_STATUSES` — statuses a buyer can cancel from.
  - `TERMINAL_ORDER_STATUSES` — statuses from which order cannot change.
  - `getOrderStatusLabel(status, t)` — i18n-aware label function.
  - `getOrderStatusConfig(status, t)` — full display configuration.
  - `getOrderStatusColors(status)` — color tokens for a status.

### Order Repository
- **`orderRepository.ts`** (73 lines, `src/data/`) — Low-level Supabase queries.
  - `fetchOrderStatusContext(orderId)` — fetch order status, buyer_id, vendor_id, order_number.
  - `updateOrderById(orderId, updatePayload)` — update order row.
  - `insertOrderNotification({ userId, orderId, orderNumber, previousStatus, status, metadata })` — insert into `notifications` table.

### Orders API (from api.js)
- **`ordersApi`** in `api.js` (lines 279-418) — CRUD operations with retry logic.
  - `getAll(filters)` — fetch orders with pagination, filtering by buyer/vendor/status.
  - `getById(id)` — fetch single order with full joins (buyer, vendor, items, deliveries).
  - `create(order)` — insert new order.
  - `updateStatus(id, status)` — update order status.
  - `delete(id)` — soft delete (sets `deleted_at`).
  - `restore(id)` — restore soft-deleted order.
  - `getDeleted()` — fetch soft-deleted orders.

### Orders API (from deliveries.js) — NAMING CONFLICT
- **`ordersApi`** in `deliveries.js` (lines 439-533) — Extended operations.
  - `acceptOrder(orderId)` — vendor accept via Edge Function.
  - `rejectOrder(orderId, reason)` — vendor reject via Edge Function.
  - `subscribeToOrder(orderId, callback)` — realtime subscription.
  - `subscribeToBuyerOrders(buyerId, callback)` — realtime subscription.
  - **WARNING:** Both `api.js` and `deliveries.js` export an object named `ordersApi`. Only the `api.js` version is re-exported from the orders module. The `deliveries.js` version is documented as a migration candidate.

### Order Hooks
- **`useOrderView.ts`** (61 lines, `src/hooks/`) — Fetches unified order view via `get_order_view` RPC.
  - Returns `{ order, loading, error, refetch, data, isLoading }`.
- **`useMarketplaceQueries.js`** (315 lines, `src/hooks/queries/`) — MIXED file containing product, order, AND review hooks.
  - Order hooks: `useOrders`, `useOrder`, `useDeletedOrders`, `useCreateOrder`, `useUpdateOrderStatus`, `useDeleteOrder`, `useRestoreOrder`.
  - Order query keys: `orderKeys` (all, lists, list, details, detail, deleted).
  - Product hooks: `useProducts`, `useAvailableRegions`, `useProductById`, etc. (re-exported from marketplace module).
  - Review hooks: `useVendorReviews`, `useProductReviews`, etc. (re-exported from marketplace module).

### Order Pages
- **`OrderDetail.jsx`** (1701 lines, `src/pages/`) — VERY complex order detail page.
  - Imports: `ordersApi` + `deliveriesApi` from `@/services/deliveries`, `submitReturnRequest` from `ordersService`, `orderTimelineApi` from `favorites.js` (misplaced), `confirmOrderPayment` from `paymentService`, `cancellationService`, `reviewService`, `invoiceService`, `useAuthStore`, `useCartStore`, `useOrderView`, `getOrderStatusColors`.
  - Components: `OrderStatusTimeline`, `OrderPaymentSection`, `OrderActionsPanel`, `OrderItemsList`, `LiveDriverMap`, `RouteMap`, `ChatComponent`, `FraudReportButton`.
- **`OrderConfirmation.jsx`** (366 lines) — Order confirmation page with PayPal handling.
  - Imports: `paymentGateway`, `updateOrderPaymentRecord`, `getLatestOrderPaymentRecord` from `paymentService`, `useOrderView`, `PaymentReceiptUpload`.
- **`OrderTracking.jsx`** (493 lines) — Order tracking page with realtime updates.
  - Imports: `supabase`, `LiveDriverMap`.
- **`buyer/Orders.jsx`** (804 lines) — Buyer order list page.
  - Imports: `ordersApi` + `deliveriesApi` from `@/services/deliveries`, `fetchBuyerOrders` from `ordersService`, `reviewService`, `invoiceService`, `loyaltyApi`, `OrderCard`, `ReviewModal`, `OrderFilters`.
- **`vendor/Orders.jsx`** (662 lines) — Vendor order management page.
  - Imports: `fetchVendorOrders`, `subscribeToVendorOrders` from `ordersService`, `ordersApi` + `deliveriesApi` from `@/services/deliveries`, `OrderTimeline`, `LiveDriverMap`.
- **`admin/Orders.jsx`** (1269 lines) — Admin order moderation page.
  - Imports: `paymentGateway`, `resolvePaymentMethod` from `paymentRecords`, `auditLogger`, `getOrderStatusConfig`, `ACTIVE_ORDER_STATUSES`.

### Order Components
- **`src/components/orders/`** — 10 files:
  - `OrderStatusTimeline.jsx` (327 bytes) — re-exports from `OrderProgressTimeline`.
  - `OrderActionsPanel.jsx` (4.8 KB) — order action buttons.
  - `OrderItemsList.jsx` (9.4 KB) — order items display.
  - `OrderPaymentSection.jsx` (2.6 KB) — payment info display.
  - `OrderProgressTimeline.jsx` (7.1 KB) — progress timeline visualization.
  - `OrderTimeline.jsx` (1.7 KB) — timeline component.
  - `BuyerOrderCard.jsx` (13.3 KB) — buyer order card.
  - `AdvancedFiltersPanel.jsx` (5.2 KB) — advanced filter panel.
  - `PaymentReceiptUpload.jsx` (12.1 KB) — payment receipt upload.
  - `ReviewModal.jsx` (4.2 KB) — review modal.

### Existing Domain Layer
- **`src/domains/ordering/`** — Existing domain layer (pre-modular architecture).
  - `index.js` — re-exports commands and queries.
  - `queries.js` — `getAllOrders`, `getOrderById`, re-exports `useOrderView`.
  - `commands.js` — `createOrder`, `cancelOrder`, `updateOrder`.
  - These wrap `ordersApi` from `api.js`.

### Checkout → Orders
- **`checkoutService.js`** (178 lines, `src/services/`) — Creates orders from cart.
  - Imports: `supabase`, `useCartStore`, `useAuthStore`.
  - Calls `supabase.from('orders').insert()` directly (not via ordersApi).
  - This is checkout's responsibility — not re-exported from orders module.

### Routes
- `/orders` — order list
- `/orders/:id` — order detail
- `/order-confirmation` — order confirmation
- `/order-confirmation/:id` — order confirmation with ID
- `/tracking/:id` — order tracking
- `/buyer/orders` — buyer orders
- `/vendor/orders` — vendor orders
- `/admin/orders` — admin orders

---

## 3. What Orders Files Were Created

```
src/modules/orders/
├── index.js              ← Public API entry point
├── api/
│   └── index.js          ← ordersService functions + ordersApi from api.js
├── data/
│   └── index.js          ← orderRepository (fetchOrderStatusContext, updateOrderById, insertOrderNotification)
├── domain/
│   └── index.js          ← orderLogic + orderStatuses constants
├── ui/
│   └── index.js          ← Order pages + order components
├── hooks/
│   └── index.js          ← useOrderView + order query keys/hooks
├── stores/
│   └── index.js          ← Placeholder (no dedicated order store)
├── utils/
│   └── index.js          ← Placeholder (future order utilities)
└── README.md             ← Module documentation
```

**9 new files created.**

---

## 4. Files Moved

**None.** No files were moved. This is an additive, re-export-only step.

---

## 5. Files Re-Exported/Wrapped

### API / Services
| Export | Source |
|---|---|
| `fetchVendorOrders` | `@/services/ordersService` |
| `subscribeToVendorOrders` | `@/services/ordersService` |
| `fetchBuyerOrders` | `@/services/ordersService` |
| `fetchBuyerOrdersAll` | `@/services/ordersService` |
| `fetchAdminOrders` | `@/services/ordersService` |
| `fetchOrderById` | `@/services/ordersService` |
| `updateOrderStatus` | `@/services/ordersService` |
| `subscribeToOrderById` | `@/services/ordersService` |
| `submitReturnRequest` | `@/services/ordersService` |
| `ordersService` | `@/services/ordersService` |
| `default` (ordersService) | `@/services/ordersService` |
| `ordersApi` | `@/services/api` |

### Data / Repository
| Export | Source |
|---|---|
| `fetchOrderStatusContext` | `@/data/orderRepository` |
| `updateOrderById` | `@/data/orderRepository` |
| `insertOrderNotification` | `@/data/orderRepository` |

### Domain / Business Logic
| Export | Source |
|---|---|
| `ALLOWED_STATUS_TRANSITIONS` | `@/business/orderLogic` |
| `isAllowedOrderStatusTransition` | `@/business/orderLogic` |
| `buildOrderStatusUpdatePayload` | `@/business/orderLogic` |

### Domain / Constants
| Export | Source |
|---|---|
| `ORDER_STATUS_VALUES` | `@/constants/orderStatuses` |
| `ORDER_STATUS_ENUM` | `@/constants/orderStatuses` |
| `ORDER_STATUSES` | `@/constants/orderStatuses` |
| `ORDER_STATUSES_ARRAY` | `@/constants/orderStatuses` |
| `ORDER_STATUS_COLORS` | `@/constants/orderStatuses` |
| `ORDER_STATUS_COLORS_FALLBACK` | `@/constants/orderStatuses` |
| `ORDER_STATUS_LABELS_EN` | `@/constants/orderStatuses` |
| `STATUS_I18N_KEYS` | `@/constants/orderStatuses` |
| `ACTIVE_ORDER_STATUSES` | `@/constants/orderStatuses` |
| `PAYMENT_CONFIRMATION_ELIGIBLE_STATUSES` | `@/constants/orderStatuses` |
| `BUYER_CANCELLABLE_STATUSES` | `@/constants/orderStatuses` |
| `TERMINAL_ORDER_STATUSES` | `@/constants/orderStatuses` |
| `getOrderStatusLabel` | `@/constants/orderStatuses` |
| `getOrderStatusConfig` | `@/constants/orderStatuses` |
| `getOrderStatusColors` | `@/constants/orderStatuses` |

### UI / Pages
| Export | Source |
|---|---|
| `OrderDetailPage` (default) | `@/pages/OrderDetail` |
| `OrderConfirmationPage` (default) | `@/pages/OrderConfirmation` |
| `OrderTrackingPage` (default) | `@/pages/OrderTracking` |
| `BuyerOrdersPage` (default) | `@/pages/buyer/Orders` |
| `VendorOrdersPage` (default) | `@/pages/vendor/Orders` |
| `AdminOrdersPage` (default) | `@/pages/admin/Orders` |

### UI / Components
| Export | Source |
|---|---|
| `OrderStatusTimeline` (default) | `@/components/orders/OrderStatusTimeline` |
| `OrderActionsPanel` (default) | `@/components/orders/OrderActionsPanel` |
| `OrderItemsList` (default) | `@/components/orders/OrderItemsList` |
| `OrderPaymentSection` (default) | `@/components/orders/OrderPaymentSection` |
| `OrderProgressTimeline` (default) | `@/components/orders/OrderProgressTimeline` |
| `OrderTimeline` (default) | `@/components/orders/OrderTimeline` |
| `BuyerOrderCard` (default) | `@/components/orders/BuyerOrderCard` |
| `AdvancedFiltersPanel` (default) | `@/components/orders/AdvancedFiltersPanel` |
| `PaymentReceiptUpload` (default) | `@/components/orders/PaymentReceiptUpload` |

### Hooks
| Export | Source |
|---|---|
| `useOrderView` | `@/hooks/useOrderView` |
| `orderKeys` | `@/hooks/queries/useMarketplaceQueries` |
| `useOrders` | `@/hooks/queries/useMarketplaceQueries` |
| `useOrder` | `@/hooks/queries/useMarketplaceQueries` |
| `useDeletedOrders` | `@/hooks/queries/useMarketplaceQueries` |
| `useCreateOrder` | `@/hooks/queries/useMarketplaceQueries` |
| `useUpdateOrderStatus` | `@/hooks/queries/useMarketplaceQueries` |
| `useDeleteOrder` | `@/hooks/queries/useMarketplaceQueries` |
| `useRestoreOrder` | `@/hooks/queries/useMarketplaceQueries` |

---

## 6. Public API Exposed by `src/modules/orders`

```js
import {
  // API / Services
  fetchVendorOrders, fetchBuyerOrders, fetchBuyerOrdersAll,
  fetchAdminOrders, fetchOrderById, updateOrderStatus,
  subscribeToVendorOrders, subscribeToOrderById,
  submitReturnRequest, ordersService, ordersApi,

  // Data / Repository
  fetchOrderStatusContext, updateOrderById, insertOrderNotification,

  // Domain / Business Logic
  ALLOWED_STATUS_TRANSITIONS, isAllowedOrderStatusTransition,
  buildOrderStatusUpdatePayload,

  // Domain / Constants
  ORDER_STATUS_VALUES, ORDER_STATUS_ENUM, ORDER_STATUSES,
  ORDER_STATUS_COLORS, ORDER_STATUS_COLORS_FALLBACK,
  ORDER_STATUS_LABELS_EN, STATUS_I18N_KEYS,
  ACTIVE_ORDER_STATUSES, PAYMENT_CONFIRMATION_ELIGIBLE_STATUSES,
  BUYER_CANCELLABLE_STATUSES, TERMINAL_ORDER_STATUSES,
  getOrderStatusLabel, getOrderStatusConfig, getOrderStatusColors,

  // UI / Pages
  OrderDetailPage, OrderConfirmationPage, OrderTrackingPage,
  BuyerOrdersPage, VendorOrdersPage, AdminOrdersPage,

  // UI / Components
  OrderStatusTimeline, OrderActionsPanel, OrderItemsList,
  OrderPaymentSection, OrderProgressTimeline, OrderTimeline,
  BuyerOrderCard, AdvancedFiltersPanel, PaymentReceiptUpload,

  // Hooks
  useOrderView,
  orderKeys, useOrders, useOrder, useDeletedOrders,
  useCreateOrder, useUpdateOrderStatus, useDeleteOrder, useRestoreOrder,
} from '@/modules/orders'
```

---

## 7. Order Files Intentionally NOT Moved

| File | Reason |
|---|---|
| `ordersService.ts` (704 lines) | Safe to move but deferred to keep Phase 2.4 additive-only. |
| `orderLogic.ts` (55 lines) | Safe to move but deferred. |
| `orderStatuses.ts` (465 lines) | Safe to move but deferred. |
| `orderRepository.ts` (73 lines) | Safe to move but deferred. |
| `OrderDetail.jsx` (1701 lines) | VERY complex — imports cart, delivery, payment, reviews, refund, cancellation, invoice, driver location. Needs decomposition before moving. |
| `OrderConfirmation.jsx` (366 lines) | Imports paymentGateway, paymentService. Needs payment decoupling first. |
| `OrderTracking.jsx` (493 lines) | Imports supabase, driverLocationService. Needs delivery decoupling. |
| `buyer/Orders.jsx` (804 lines) | Imports ordersService, deliveries, reviewService, invoiceService, loyalty. Complex. |
| `vendor/Orders.jsx` (662 lines) | Imports ordersService, deliveries. Complex. |
| `admin/Orders.jsx` (1269 lines) | Imports paymentGateway, paymentRecords, auditLogger. Complex. |
| `api.js` (order parts) | Large mixed file — needs splitting. |
| `deliveries.js` (ordersApi) | Naming conflict with api.js ordersApi. Will be resolved when delivery module is created. |
| `useMarketplaceQueries.js` | MIXED file — needs splitting: product/review → marketplace, order → orders. |
| `useOrderView.ts` (61 lines) | Safe to move but deferred. |
| Order components (10 files) | Safe to move but deferred. |
| `checkoutService.js` | Checkout concern, not orders. |
| `paymentService.js` | Payments concern. |
| `paymentGateway.js` | Payments concern. |
| `paymentRecords.js` | Payments concern. |
| `deliveriesApi` from `deliveries.js` | Delivery concern. |
| `driverLocationService.js` | Delivery concern. |
| `reviewService.js` | Reviews concern. |
| `invoiceService.js` | Invoice concern — may belong in orders or separate module. |
| `cancellationService.js` | Cancellation policy — may belong in orders or checkout. |
| `auditLogger.js` | Audit concern. |
| `loyaltyApi` | Loyalty concern. |
| `orderTimelineApi` from `favorites.js` | Misplaced in favorites.js — needs investigation. |
| `domains/ordering/` | Existing domain layer — will be consolidated with module. |

---

## 8. Imports Changed

**None.** No existing imports were changed. All existing code continues to import from original locations. The orders module is purely additive.

---

## 9. Behavior Verification

| Check | Status | Details |
|---|---|---|
| Order read behavior unchanged | ✅ | `ordersService.ts`, `api.js`, `orderRepository.ts` not modified |
| Order detail behavior unchanged | ✅ | `OrderDetail.jsx`, `useOrderView.ts` not modified |
| Order create behavior unchanged | ✅ | `ordersApi.create` in `api.js` not modified |
| Order status update behavior unchanged | ✅ | `updateOrderStatus` in `ordersService.ts` not modified |
| Order status lifecycle unchanged | ✅ | `ALLOWED_STATUS_TRANSITIONS` in `orderLogic.ts` not modified |
| Order status constants unchanged | ✅ | `orderStatuses.ts` not modified |
| Buyer order pages unchanged | ✅ | `buyer/Orders.jsx` not modified |
| Vendor order pages unchanged | ✅ | `vendor/Orders.jsx` not modified |
| Admin order pages unchanged | ✅ | `admin/Orders.jsx` not modified |
| Checkout/order behavior unchanged | ✅ | `checkoutService.js`, `CheckoutSimplified.jsx` not modified |
| Payment/order behavior unchanged | ✅ | `paymentService.js`, `paymentGateway.js`, `paymentRecords.js` not modified |
| Delivery/order behavior unchanged | ✅ | `deliveries.js` not modified |
| Notification/order behavior unchanged | ✅ | `insertOrderNotification` in `orderRepository.ts` not modified |
| Routes unchanged | ✅ | All order routes remain as-is |
| Supabase queries unchanged | ✅ | No Supabase queries modified |
| RLS/database unchanged | ✅ | No database changes |
| Order realtime subscriptions unchanged | ✅ | `subscribeToVendorOrders`, `subscribeToOrderById` not modified |
| Return request behavior unchanged | ✅ | `submitReturnRequest` not modified |

---

## 10. Verification Results

| Command | Result | Details |
|---|---|---|
| `npm run lint` | ✅ **Passed** | 0 errors, 0 warnings |
| `npm run type-check` | ✅ **Passed** | 0 errors (tsc --noEmit) |
| `npm run build` | ✅ **Passed** | Built in 2m 46s, PWA generated (198 precache entries) |
| `npm run check:circular` | ✅ **Passed** | 603 files (was 595 — 8 new files), **zero circular dependencies** |

### madge File Count Change

- Before: 595 files
- After: 603 files (+8 new files in `src/modules/orders/`)
- Circular dependencies: 0 (unchanged)

---

## 11. Documentation Updates

### Documents Updated (3)

| Document | Change |
|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | Status line updated to include Phase 2.4. Sprint 2.4 row updated with ✅. Added Phase 2.4 achievement note. |
| `DEVELOPER_GUIDE.md` | Added `src/modules/orders/` to project structure tree. |
| `ARCHITECTURE_GUIDE.md` | Updated TODO section to include Phase 2.4 completion. |

### Documents Checked But Not Changed (7)

| Document | Reason |
|---|---|
| `SYSTEM_DESIGN.md` | Describes runtime architecture, not file structure. No changes needed. |
| `eslint.config.js` | Already contains `no-restricted-imports` rule. No changes needed. |
| `package.json` | No scripts or dependencies changed. No changes needed. |
| `src/modules/catalog/README.md` | Catalog module not affected by orders module. No changes needed. |
| `src/modules/marketplace/README.md` | Marketplace module not affected. No changes needed. |
| `src/modules/cart/README.md` | Cart module not affected. No changes needed. |
| `src/modules/shared/README.md`, `auth/README.md`, `users/README.md`, `app/README.md` | Not affected. No changes needed. |

### Outdated Documents Found

None new. The existing TODOs in `ARCHITECTURE_GUIDE.md` and `DEVELOPER_GUIDE.md` remain valid and were updated with Phase 2.4 status.

### Documentation Still Needing Future Updates

| Document | What | When |
|---|---|---|
| `ARCHITECTURE_GUIDE.md` | Replace `src/features/` tree with `src/modules/` + `src/app/` tree | Phase 2+ (when first file moves) |
| `DEVELOPER_GUIDE.md` | Update Edge Functions table (remove Stripe/CMI) | Phase 3 |
| `DEVELOPER_GUIDE.md` | Replace `src/features/` guide with `src/modules/` guide | Phase 2+ (when first file moves) |
| `src/modules/orders/README.md` | Update migration candidates as files are moved | Sprint 2.5+ |
| Order lifecycle documentation | Document event contracts when implemented | Phase 3 |

---

## 12. Files Modified/Created

| File | Action |
|---|---|
| `src/modules/orders/index.js` | Created — public API entry point |
| `src/modules/orders/api/index.js` | Created — ordersService + ordersApi |
| `src/modules/orders/data/index.js` | Created — orderRepository |
| `src/modules/orders/domain/index.js` | Created — orderLogic + orderStatuses |
| `src/modules/orders/ui/index.js` | Created — order pages + order components |
| `src/modules/orders/hooks/index.js` | Created — useOrderView + order query hooks |
| `src/modules/orders/stores/index.js` | Created — placeholder |
| `src/modules/orders/utils/index.js` | Created — placeholder |
| `src/modules/orders/README.md` | Created — module documentation |
| `MODULAR_DEVELOPMENT_PLAN.md` | Modified — status + Sprint 2.4 table + achievement note |
| `DEVELOPER_GUIDE.md` | Modified — project structure tree |
| `ARCHITECTURE_GUIDE.md` | Modified — TODO section updated |
| `docs/architecture/phase-2-4-orders-module-report.md` | Created — this report |

**Total: 10 new files created. 3 files modified. 0 files deleted. 0 files moved.**

---

## 13. Safety Assessment

| Check | Status |
|---|---|
| No business logic changes | ✅ |
| No order lifecycle changes | ✅ |
| No order status changes | ✅ |
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
| `OrderDetail.jsx` (1701 lines) imports cart, delivery, payment, reviews, refund, cancellation, invoice, driver location | High | Needs decomposition before moving. Most complex file in the codebase. |
| `ordersApi` naming conflict between `api.js` and `deliveries.js` | Medium | Only `api.js` version re-exported. `deliveries.js` version documented as migration candidate. Resolve when delivery module is created. |
| `useMarketplaceQueries.js` is a MIXED file (product + order + review hooks) | Medium | Only order hooks re-exported from orders module. File needs splitting in future sprint. |
| `ordersService.ts` imports `productImages` from catalog (hydrateRowsWithProductItems, isProductImagesRelationError) | Medium | Cross-concern coupling. Should use catalog public API in future. |
| `orderRepository.ts` inserts directly into `notifications` table | Medium | Tight coupling with notifications. Should use notification public API in future. |
| `OrderDetail.jsx` imports `orderTimelineApi` from `favorites.js` | Medium | Misplaced export. Needs investigation and relocation. |
| `buyer/Orders.jsx` imports `ordersApi` + `deliveriesApi` from `@/services/deliveries` | Medium | Cross-concern coupling with delivery. Should use orders + delivery public APIs. |
| `admin/Orders.jsx` imports `paymentGateway`, `resolvePaymentMethod` | Medium | Cross-concern coupling with payments. Should use event contract in future. |
| `OrderConfirmation.jsx` imports `paymentGateway`, `paymentService` | Medium | Cross-concern coupling with payments. |
| `checkoutService.js` creates orders directly via `supabase.from('orders').insert()` | Low | Checkout concern. Should use orders public API in future. |
| `domains/ordering/` existing domain layer duplicates orders module | Low | Will be consolidated when files are moved. |

---

## 15. Whether It Is Safe to Continue to Phase 2.5 (Delivery Module)

### ✅ Yes — Safe to continue to Phase 2.5 (delivery module)

Phase 2.4 orders module foundation is complete and verified:
- `src/modules/orders/` exists as a pure re-export layer with 9 files.
- All 4 verification commands pass (lint, type-check, build, check:circular).
- 0 circular dependencies across 603 files.
- 0 imports changed, 0 files moved, 0 files deleted.
- 100% behavior preserved.
- No order lifecycle or status changes.
- Module boundaries documented with allowed/forbidden dependencies.
- Event contracts documented (`order:payment_updated`, `order:delivery_updated`) but NOT implemented.

### Whether an Intermediate Event-Contract/Orchestrator Preparation Step Is Recommended Before Delivery

**Yes — an intermediate preparation step is recommended before Phase 2.5.**

Before creating the delivery module, the following should be addressed:

1. **Resolve `ordersApi` naming conflict:** Both `api.js` and `deliveries.js` export `ordersApi`. The `deliveries.js` version (vendor accept/reject + subscriptions) should be renamed or merged with the orders module's API before delivery module creation.

2. **Document event contracts formally:** The `order:delivery_updated` and `order:payment_updated` event contracts should be formally documented in architecture guides before delivery module creation, so the delivery module can reference them from day one.

3. **Split `useMarketplaceQueries.js`:** This mixed file contains product, order, AND review hooks. It should be split into separate files before more modules are created, to prevent further entanglement.

4. **Plan `OrderDetail.jsx` decomposition:** This 1701-line file imports from 8+ different concerns (cart, delivery, payment, reviews, refund, cancellation, invoice, driver location). It needs a decomposition plan before any file moves.

However, **these preparation steps are NOT blocking** for Phase 2.5. The delivery module can be created as a re-export layer (same pattern as all previous phases) without resolving these issues first. The issues should be resolved when files are actually moved (Sprint 2.5+ or Phase 3).

### Recommended Phase 2.5 approach (delivery module):

1. **Inspect** delivery-related files: `deliveries.js`, `deliveriesApi`, `driverLocationService.js`, driver pages, delivery components
2. **Create** `src/modules/delivery/` with re-export layer (same pattern)
3. **Re-export** delivery service, delivery API, driver pages, delivery components, driver location service
4. **Do NOT move** any files in Sprint 2.5 — re-export only
5. **Run** all 4 verification commands
6. **Create** `docs/architecture/phase-2-5-delivery-module-report.md`

### Files to inspect first for Sprint 2.5:

| File | Location | Reason |
|---|---|---|
| `deliveries.js` | `@/services/deliveries` | Delivery service + `ordersApi` (extended) + `deliveriesApi` |
| `driverLocationService.js` | `@/services/` | Driver location tracking |
| `driver/Active.jsx` | `@/pages/driver/` | Driver active delivery page |
| `driver/Available.jsx` | `@/pages/driver/` | Driver available deliveries page |
| `driver/Dashboard.jsx` | `@/pages/driver/` | Driver dashboard |
| `driver/DeliveryComplete.jsx` | `@/pages/driver/` | Delivery completion page |
| `driver/DeliveryPickup.jsx` | `@/pages/driver/` | Delivery pickup page |
| `driver/DeliveryTracking.jsx` | `@/pages/driver/` | Delivery tracking page |
| `LiveDriverMap.jsx` | `@/components/maps/` | Live driver map component |
| `RouteMap.jsx` | `@/components/ui/` | Route map component |
| `DeliveryRequestCard.jsx` | `@/components/ui/` | Delivery request card |
| `domains/delivery/` | `@/domains/delivery/` | Existing domain layer |
