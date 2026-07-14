# Orders Module

## Purpose

The orders module encapsulates all order lifecycle management:
- Order data access (read orders, order details, order items)
- Order creation (via `ordersApi.create`)
- Order status updates (via `updateOrderStatus` with transition validation)
- Order status constants, colors, labels, and lifecycle groups
- Order business logic (allowed transitions, payload builders)
- Order repository (low-level Supabase queries)
- Order notifications (inserted on status change)
- Order realtime subscriptions (vendor orders, single order)
- Buyer order list and detail pages
- Vendor order list and detail pages
- Admin order list, detail, and moderation pages
- Order tracking page
- Order confirmation page
- Order-specific UI components (timeline, actions panel, items list, payment section)
- Order query hooks (React Query)
- Return request submission

## Current Status: Re-export Foundation Only

This module is currently a **re-export layer**. No source files have been moved.
The re-exports point to existing files in `src/services/`, `src/business/`, `src/constants/`,
`src/data/`, `src/pages/`, `src/components/`, `src/hooks/`.

## Public API (Root Barrel — Lightweight)

The root barrel exports only lightweight non-UI symbols: API services, data/repository, domain/constants, and hooks.

```js
import {
  // API / Services
  fetchVendorOrders, fetchBuyerOrders, fetchBuyerOrdersAll,
  fetchAdminOrders, fetchOrderById, updateOrderStatus,
  subscribeToVendorOrders, subscribeToOrderById,
  submitReturnRequest, ordersService,
  ordersApi,
  // Vendor order actions (legacy — currently in deliveries.js, will move in Phase 3)
  vendorOrderActionsApi,
  acceptOrder, rejectOrder,
  subscribeToOrder, subscribeToBuyerOrders,

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

  // Hooks
  useOrderView,
  orderKeys, useOrders, useOrder, useDeletedOrders,
  useCreateOrder, useUpdateOrderStatus, useDeleteOrder, useRestoreOrder,
} from '@/modules/orders'
```

### Intentionally NOT Exported from Root (Phase 6.15)

UI/page-level exports were removed from the root barrel to prevent eager loading of `OrderDetail.jsx` → `RouteMap.jsx` → Leaflet when importing lightweight symbols (constants, APIs, hooks).

| Symbol | Available Via |
|---|---|
| `OrderDetailPage` | `lazy(() => import('@/pages/OrderDetail'))` or `@/modules/orders/ui` |
| `OrderConfirmationPage` | `lazy(() => import('@/pages/OrderConfirmation'))` or `@/modules/orders/ui` |
| `OrderTrackingPage` | `lazy(() => import('@/pages/OrderTracking'))` or `@/modules/orders/ui` |
| `BuyerOrdersPage` | `lazy(() => import('@/pages/buyer/Orders'))` or `@/modules/orders/ui` |
| `VendorOrdersPage` | `lazy(() => import('@/pages/vendor/Orders'))` or `@/modules/orders/ui` |
| `AdminOrdersPage` | `lazy(() => import('@/pages/admin/Orders'))` or `@/modules/orders/ui` |
| `OrderStatusTimeline` | `@/components/orders/OrderStatusTimeline` or `@/modules/orders/ui` |
| `OrderActionsPanel` | `@/components/orders/OrderActionsPanel` or `@/modules/orders/ui` |
| `OrderItemsList` | `@/components/orders/OrderItemsList` or `@/modules/orders/ui` |
| `OrderPaymentSection` | `@/components/orders/OrderPaymentSection` or `@/modules/orders/ui` |
| `OrderProgressTimeline` | `@/components/orders/OrderProgressTimeline` or `@/modules/orders/ui` |
| `OrderTimeline` | `@/components/ui/OrderTimeline` or `@/modules/orders/ui` |
| `BuyerOrderCard` | `@/components/orders/BuyerOrderCard` or `@/modules/orders/ui` |
| `AdvancedFiltersPanel` | `@/components/orders/AdvancedFiltersPanel` or `@/modules/orders/ui` |
| `PaymentReceiptUpload` | `@/components/orders/PaymentReceiptUpload` or `@/modules/orders/ui` |

### UI / Page Import Policy

App code should import order pages via lazy imports from original paths:
```js
const OrderDetailPage = lazy(() => import('@/pages/OrderDetail'))
const BuyerOrdersPage = lazy(() => import('@/pages/buyer/Orders'))
```

Order components should be imported from their original component paths:
```js
import OrderStatusTimeline from '@/components/orders/OrderStatusTimeline'
import PaymentReceiptUpload from '@/components/orders/PaymentReceiptUpload'
```

UI exports remain available through `src/modules/orders/ui/index.js` for intra-module use only.

## Structure

```
src/modules/orders/
├── index.js          ← Public API entry point
├── api/
│   └── index.js      ← ordersService, ordersApi (from api.js)
├── data/
│   └── index.js      ← orderRepository (fetchOrderStatusContext, updateOrderById, insertOrderNotification)
├── domain/
│   └── index.js      ← orderLogic, orderStatuses constants
├── ui/
│   └── index.js      ← Order pages + order components
├── hooks/
│   └── index.js      ← useOrderView, order query keys/hooks
├── stores/
│   └── index.js      ← Placeholder (no dedicated order store yet)
├── utils/
│   └── index.js      ← Placeholder (future order utilities)
└── README.md         ← This file
```

## What Belongs in Orders

- Order data access (read, create, update status, soft delete, restore)
- Order lifecycle management (status transitions, validation)
- Order status constants (keys, colors, labels, groups)
- Order business logic (allowed transitions, payload builders)
- Order repository (low-level Supabase queries on orders table)
- Order notifications (inserted on status change via `insertOrderNotification`)
- Order realtime subscriptions (vendor orders, single order updates)
- Buyer order list and detail pages
- Vendor order list and detail pages
- Admin order list, detail, and moderation pages
- Order tracking page
- Order confirmation page
- Order-specific UI components (timeline, actions panel, items list, payment section)
- Order query hooks (React Query: useOrders, useOrder, useCreateOrder, etc.)
- Return request submission
- Order invoice generation (currently in `invoiceService.js` — migration candidate)

## What Does NOT Belong in Orders

- Cart state (belongs in `cart` module)
- Checkout form/process orchestration (belongs in `checkout` module)
- Payment provider integration (belongs in `payments` module)
- Delivery assignment/tracking implementation (belongs in `delivery` module)
- Product CRUD (belongs in `catalog` module)
- Product catalog browsing (belongs in `marketplace` module)
- Auth/session logic (belongs in `auth` module)
- User profile ownership (belongs in `users` module)
- Admin dashboard composition (belongs in `admin` or `app` module)
- Notification delivery implementation (belongs in `notifications` module)

## Relationship with Cart

- **Cart provides cart contents to checkout, which creates orders.**
- Orders does not directly import cart state.
- `checkoutService.js` imports `useCartStore` and calls `ordersApi.create` — this is checkout's responsibility.
- Orders module does NOT import from cart module.

## Relationship with Checkout

- **Checkout creates orders** — `checkoutService.js` and `CheckoutSimplified.jsx` call `ordersApi.create`.
- **Orders owns order lifecycle after creation** — status transitions, notifications, tracking.
- Checkout may consume cart and call order creation APIs.
- Orders does not own cart state or checkout UI.

## Relationship with Payments

- **Payments owns payment records and provider integrations.**
- `OrderDetail.jsx` imports `confirmOrderPayment` from `paymentService` — this is a cross-concern coupling.
- `OrderConfirmation.jsx` imports `paymentGateway`, `updateOrderPaymentRecord`, `getLatestOrderPaymentRecord`.
- `admin/Orders.jsx` imports `paymentGateway`, `resolvePaymentMethod`.
- Orders must not directly import payments internals in the future.
- **Future synchronization should use documented event contract:**
  ```
  order:payment_updated
  payload: { orderId, paymentStatus, paymentId, amount, method, occurredAt }
  ```
- **Do not implement this event system in this sprint.**

## Relationship with Delivery

- **Delivery owns delivery state and driver assignment/tracking.**
- `OrderDetail.jsx` imports `ordersApi, deliveriesApi` from `@/services/deliveries`.
- `buyer/Orders.jsx` imports `ordersApi, deliveriesApi` from `@/services/deliveries`.
- `vendor/Orders.jsx` imports `ordersApi, deliveriesApi` from `@/services/deliveries`.
- `deliveries.js` also exports an `ordersApi` object with `acceptOrder`, `rejectOrder`, `subscribeToOrder`, `subscribeToBuyerOrders` — this is a naming conflict documented as migration candidate.
- Orders must not directly import delivery internals in the future.
- **Future synchronization should use documented event contract:**
  ```
  order:delivery_updated
  payload: { orderId, deliveryStatus, deliveryId, driverId, occurredAt }
  ```
- **Do not implement this event system in this sprint.**

## Relationship with Notifications

- **Orders may request notifications through public notification APIs in the future.**
- Currently, `orderRepository.ts` → `insertOrderNotification` inserts directly into `notifications` table via Supabase.
- This is a tight coupling that should be decoupled in the future.
- Orders must not own notification delivery logic.

## Relationship with Catalog

- **Orders references product snapshots** — order_items contain product_id, product name (at time of order).
- `ordersService.ts` imports `hydrateRowsWithProductItems` from `@/services/productImages` (catalog concern).
- `ordersService.ts` imports `isProductImagesRelationError` from `@/services/productImages`.
- Future imports from catalog should use `@/modules/catalog` public API only.

## Relationship with Users

- **Orders reference buyer_id, vendor_id, driver_id** — all pointing to profiles table.
- Order queries join `profiles` table for buyer/vendor/driver information.
- Future imports from users should use `@/modules/users` public API only.

## Event Contracts (Future — Not Implemented in This Sprint)

### order:payment_updated
```
payload: {
  orderId: string,
  paymentStatus: string,
  paymentId: string,
  amount: number,
  method: string,
  occurredAt: string (ISO 8601)
}
```

### order:delivery_updated
```
payload: {
  orderId: string,
  deliveryStatus: string,
  deliveryId: string,
  driverId: string,
  occurredAt: string (ISO 8601)
}
```

## Allowed Dependencies

- `@/modules/shared` — shared UI, hooks, utils
- `@/modules/auth` — auth public API for current user/role
- `@/modules/users` — users public API for participant profile info
- `@/modules/catalog` — catalog public API for product snapshots/read-only product info
- `@/services/supabase` — Supabase client
- `@/utils/` — general utilities (currency, logger, sanitization)
- `@/lib/config` — app config
- `@/constants/` — shared constants

## Forbidden Dependencies

- `@/modules/checkout` — checkout module (checkout creates orders; orders does not import checkout)
- `@/modules/payments` — payments module (use event contract instead)
- `@/modules/delivery` — delivery module (use event contract instead)
- `@/modules/admin` — admin dashboard composition
- `@/modules/marketplace` — marketplace module
- `@/modules/cart` — cart module

## Migration Candidates for Future Sprints

| File | Current Location | Target | Sprint | Notes |
|---|---|---|---|---|
| `ordersService.ts` | `@/services/ordersService` | `@/modules/orders/api/` | 2.5+ | 704 lines, safe to move |
| `orderLogic.ts` | `@/business/orderLogic` | `@/modules/orders/domain/` | 2.5+ | 55 lines, safe to move |
| `orderStatuses.ts` | `@/constants/orderStatuses` | `@/modules/orders/domain/` | 2.5+ | 465 lines, safe to move |
| `orderRepository.ts` | `@/data/orderRepository` | `@/modules/orders/data/` | 2.5+ | 73 lines, safe to move |
| `OrderDetail.jsx` | `@/pages/OrderDetail` | `@/modules/orders/ui/pages/` | 2.5+ | 1701 lines, VERY complex — imports cart, delivery, payment, reviews, refund, cancellation, invoice, driver location |
| `OrderConfirmation.jsx` | `@/pages/OrderConfirmation` | `@/modules/orders/ui/pages/` | 2.5+ | 366 lines, imports paymentGateway, paymentService |
| `OrderTracking.jsx` | `@/pages/OrderTracking` | `@/modules/orders/ui/pages/` | 2.5+ | 493 lines, imports supabase, driverLocationService |
| `buyer/Orders.jsx` | `@/pages/buyer/Orders` | `@/modules/orders/ui/pages/` | 2.5+ | 804 lines, imports ordersService, deliveries, reviewService, invoiceService, loyalty |
| `vendor/Orders.jsx` | `@/pages/vendor/Orders` | `@/modules/orders/ui/pages/` | 2.5+ | 662 lines, imports ordersService, deliveries |
| `admin/Orders.jsx` | `@/pages/admin/Orders` | `@/modules/orders/ui/pages/` | 2.5+ | 1269 lines, imports paymentGateway, paymentRecords, auditLogger |
| `api.js` (order parts) | `@/services/api` | `@/modules/orders/api/` | 2.5+ | Large mixed file — needs splitting |
| `deliveries.js` (ordersApi) | `@/services/deliveries` | `@/modules/orders/api/` or `@/modules/delivery/` | 2.5+ | Naming conflict: both api.js and deliveries.js export `ordersApi` |
| `useMarketplaceQueries.js` (order hooks) | `@/hooks/queries/` | `@/modules/orders/hooks/` | 2.5+ | MIXED file — needs splitting: product/review → marketplace, order → orders |
| `useOrderView.ts` | `@/hooks/useOrderView` | `@/modules/orders/hooks/` | 2.5+ | 61 lines, safe to move |
| Order components | `@/components/orders/` | `@/modules/orders/ui/components/` | 2.5+ | 10 files, safe to move |
| `checkoutService.js` | ~~`@/services/checkoutService`~~ | `@/modules/checkout` | ✅ Done (Phase 7.2) | 178 lines, moved to `src/modules/checkout/api/checkoutService.js` |
| `cancellationService.js` | `@/services/cancellationService` | `@/modules/orders/api/` or `checkout/` | 2.5+ | Cancellation policy logic |
| `invoiceService.js` | `@/services/invoiceService` | `@/modules/orders/api/` or `invoices/` | 2.5+ | Invoice generation |

## Intentionally NOT Exported (Candidates for Later)

| Item | Reason |
|---|---|
| `ordersApi` from `deliveries.js` | Naming conflict with `ordersApi` from `api.js`. Contains vendor accept/reject + subscriptions. Will be resolved when delivery module is created. |
| `checkoutService.js` | Checkout concern, not orders. Creates orders from cart. |
| `paymentService.js` | Payments concern. `confirmOrderPayment`, `updateOrderPaymentRecord`, `getLatestOrderPaymentRecord`. |
| `paymentGateway.js` | Payments concern. Payment provider integration. |
| `paymentRecords.js` | Payments concern. `resolvePaymentMethod`. |
| `deliveriesApi` from `deliveries.js` | Delivery concern, not orders. |
| `driverLocationService.js` | Delivery concern. |
| `reviewService.js` | Reviews concern. May belong in reviews module or marketplace. |
| `invoiceService.js` | Invoice concern. May belong in orders or separate invoices module. |
| `cancellationService.js` | Cancellation policy. May belong in orders or checkout. |
| `auditLogger.js` | Audit concern. |
| `loyaltyApi` | Loyalty concern. |
| `orderTimelineApi` from `favorites.js` | Misplaced in favorites.js — needs investigation. |
| `domains/ordering/` | Existing domain layer — will be consolidated with module. |

## Safety Notes

- **Order status lifecycle:** `orderLogic.ts` defines `ALLOWED_STATUS_TRANSITIONS` — a finite state machine. No changes made.
- **Order status constants:** `orderStatuses.ts` is the canonical source of truth for status keys, colors, labels. No changes made.
- **Order status updates:** `updateOrderStatus` in `ordersService.ts` validates transitions, builds payload, updates DB, and inserts notification. No changes made.
- **Order notifications:** `insertOrderNotification` in `orderRepository.ts` inserts into `notifications` table. No changes made.
- **Order realtime:** `subscribeToVendorOrders` and `subscribeToOrderById` use Supabase Realtime. No changes made.
- **Naming conflict:** Both `api.js` and `deliveries.js` export `ordersApi`. Only the `api.js` version is re-exported here. The `deliveries.js` version (vendor accept/reject) is documented as a migration candidate.
- **Routes:** All order routes (`/orders`, `/orders/:id`, `/order-confirmation`, `/order-confirmation/:id`, `/tracking/:id`, `/buyer/orders`, `/vendor/orders`, `/admin/orders`) remain unchanged.
- **Mixed file:** `useMarketplaceQueries.js` contains product, order, AND review hooks. Only order hooks are re-exported here. Product and review hooks are re-exported from the marketplace module.
- **Complex pages:** `OrderDetail.jsx` (1701 lines) imports cart, delivery, payment, reviews, refund, cancellation, invoice, driver location — very complex, needs decomposition before moving.
