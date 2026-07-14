# Checkout Module

**Phase:** 3.1 — Checkout Module Foundation (re-export layer)  
**Status:** Wrapper/re-export foundation only. No files moved. No behavior changed.

---

## Module Responsibility

The checkout module owns:

- **Checkout flow** — the multi-step checkout page (address → delivery → payment)
- **Checkout page composition** — `CheckoutSimplified.jsx` and its step components
- **Checkout form state** — shipping info, payment method selection, delivery slot selection (currently local state in `CheckoutSimplified.jsx`)
- **Shipping/delivery method selection** — cargo size, driver selection, delivery scheduling
- **Coupon application during checkout** — applying coupon codes, bulk discount candidates
- **Checkout validation** — minimum order validation, shipping availability checks, payment method eligibility
- **Order payload preparation** — building checkout payload via `checkoutService.js`
- **Order creation calls** — calling `createCheckoutOrder` Edge Function
- **Payment method selection** — PayPal / bank transfer / COD selection (UI only, not provider internals)
- **Checkout pricing calculation** — subtotal, bulk discounts, coupon discounts, platform fees, shipping costs
- **Checkout cleanup/rollback** — rollback records on failed order creation

## What Does NOT Belong in Checkout

- **Cart state** — owned by `cart` module (`useCartStore`). Checkout consumes cart contents read-only.
- **Order lifecycle after creation** — owned by `orders` module. Checkout creates orders but does not manage status transitions.
- **Payment provider integration internals** — owned by `payments` module (future). Checkout selects payment method but does not implement PayPal/CMI logic.
- **Delivery tracking after checkout** — owned by `delivery` module. Checkout selects delivery options but does not track deliveries.
- **Product catalog ownership** — owned by `catalog` module. Checkout reads product snapshots from cart items.
- **Auth/session logic** — owned by `auth` module. Checkout reads user/profile from `authStore`.
- **User profile ownership** — owned by `users` module. Checkout reads profile data for pre-filling shipping info.
- **Notification delivery logic** — owned by `notifications` module (future). Checkout may trigger notifications but does not deliver them.
- **Admin dashboard composition** — not a checkout concern.

---

## Public API (Root Barrel — Lightweight)

The root barrel exports only lightweight non-UI symbols: API services, domain cleanup, hooks, and utils.

```js
import {
  // API — Service functions
  calculateOrderTotals,
  calculateCheckoutPricing,
  createCheckoutOrder,
  // API — Coupon functions
  couponsApi,
  normalizeCoupon,
  isCouponCurrentlyActive,
  calculateCouponDiscountAmount,
  calculateBulkDiscountBreakdown,
  // API — Minimum order validation
  buildMinimumOrderMessage,
  evaluateVendorMinimumOrders,
  // Domain — Cleanup
  rollbackCheckoutRecords,
  // Hooks
  useCheckoutPricing,
  calculatePricing,
  // Utils
  rollbackCheckout,
} from '@/modules/checkout'
```

### Intentionally NOT Exported from Root (Phase 6.17)

UI/page-level exports were removed from the root barrel to prevent eager loading of `CheckoutSimplified.jsx` (1696 lines) when importing lightweight symbols (APIs, hooks, utils).

| Symbol | Available Via |
|---|---|
| `CheckoutPage` | `lazy(() => import('@/pages/CheckoutSimplified'))` or `@/modules/checkout/ui` |
| `CheckoutAddressStep` | `@/components/checkout/CheckoutAddressStep` or `@/modules/checkout/ui` |
| `CheckoutSummary` | `@/components/checkout/CheckoutSummary` or `@/modules/checkout/ui` |
| `PaymentStep` | `@/components/checkout/PaymentStep` or `@/modules/checkout/ui` |
| `PaymentTypeSelector` | `@/components/checkout/PaymentTypeSelector` or `@/modules/checkout/ui` |
| `OrderSummary` | `@/components/checkout/OrderSummary` or `@/modules/checkout/ui` |
| `AddressStep` | `@/components/checkout/AddressStep` or `@/modules/checkout/ui` |
| `DriverSelectionStep` | `@/components/checkout/DriverSelectionStep` or `@/modules/checkout/ui` |

### UI / Page Import Policy

App code should import the checkout page via lazy import from original path:
```js
const CheckoutPage = lazy(() => import('@/pages/CheckoutSimplified'))
```

Checkout step components should be imported from their original component paths:
```js
import PaymentStep from '@/components/checkout/PaymentStep'
import DriverSelectionStep from '@/components/checkout/DriverSelectionStep'
```

UI exports remain available through `src/modules/checkout/ui/index.js` for intra-module use only.

---

## Module Structure

```
src/modules/checkout/
├── index.js          # Public API entry point
├── api/
│   └── index.js      # Re-exports checkoutService, coupons, minimumOrderService
├── data/
│   └── index.js      # Placeholder (no dedicated checkout repository yet)
├── domain/
│   └── index.js      # Re-exports checkoutCleanup (rollback records)
├── ui/
│   └── index.js      # Re-exports CheckoutSimplified + checkout step components
├── hooks/
│   └── index.js      # Re-exports useCheckoutPricing
├── stores/
│   └── index.js      # Placeholder (no dedicated checkout store yet)
├── utils/
│   └── index.js      # Re-exports checkoutCleanup
└── README.md         # This file
```

---

## Relationships

### Cart

- Checkout **consumes** cart contents (items, checkoutVendorId).
- Cart **owns** cart state and persistence (`useCartStore`).
- Checkout must **not** mutate cart internals except through existing public cart actions (`clearCart`, `clearCheckoutVendor`, `clearVendorItems`).

### Orders

- Checkout **may create** orders via `createCheckoutOrder` (calls Supabase Edge Function).
- Orders module **owns** lifecycle after creation (status transitions, tracking, deletion).
- Checkout does **not** own order status transitions after creation.

### Payments

- Checkout **may select** payment method (PayPal / bank transfer / COD) and initiate payment flow.
- Payments module (future) **owns** provider-specific payment logic (PayPal, CMI, bank transfer).
- Checkout must **not** own PayPal/CMI/provider internals.

### Delivery

- Checkout **may select** delivery options (cargo size, driver preference, delivery slot).
- Delivery module **owns** delivery state, tracking, and driver workflow.
- Checkout does **not** own delivery tracking after checkout.

### Users

- Checkout **reads** user profile (name, phone, address, location) for pre-filling shipping info.
- Users module **owns** profile data and address management.

### Coupons

- Checkout **applies** coupon codes during checkout flow.
- Coupon service (`coupons.js`) is re-exported from checkout API for convenience.
- A dedicated `coupons` module may be created in Phase 3.4.

---

## Allowed Dependencies

- `@/modules/shared` — shared utilities and constants
- `@/modules/cart` — cart public API (read cart items, clear cart after checkout)
- `@/modules/orders` — orders public API for order creation only
- `@/modules/delivery` — delivery public API for delivery option selection
- `@/modules/users` — users public API for addresses/profile info
- `@/modules/catalog` — catalog public API for product snapshot/read-only product info
- `@/utils` — utility functions (currency, logger, etc.)
- `@/config` / `@/lib/config` — configuration (PayPal client ID, etc.)
- `@/lib/supabase` — Supabase client (used by checkoutService)

## Forbidden Dependencies

- `@/modules/payments` — payment provider internals (owned by payments module, includes CMI)
- `@/modules/commissions` — payouts (owned by commissions module)
- `@/services/commissionService` — commission system (owned by future commissions module)
- `@/contexts/PaymentGuard` — payment guard logic (owned by auth/payments)
- Admin dashboard composition — not a checkout concern

---

## Migration Candidates (Future Sprints)

| File | Current Location | Migration Target | Risk | Notes |
|---|---|---|---|---|
| `CheckoutSimplified.jsx` | `src/pages/` | `src/modules/checkout/ui/` | **High** | 1696 lines, 20+ imports, complex state management. Must decompose first. |
| `checkoutService.js` | ~~`src/services/`~~ | `src/modules/checkout/api/` | ✅ Done (Phase 7.2) | 178 lines, calls Edge Functions. Moved to `src/modules/checkout/api/checkoutService.js`. Stub deleted (Phase 7.4). |
| `useCheckoutPricing.ts` | `src/hooks/` | `src/modules/checkout/hooks/` | **Low** | 145 lines, pure pricing calculation. Safe to move. |
| `checkoutCleanup.js` | `src/utils/` | `src/modules/checkout/utils/` or `domain/` | **Low** | 35 lines, rollback utility. Safe to move. |
| Checkout step components | `src/components/checkout/` | `src/modules/checkout/ui/` | **Low-Medium** | 7 files, 200–16K bytes each. Safe to move after page decomposition. |
| `coupons.js` | `src/services/` | `src/modules/coupons/` (Phase 3.4) or `src/modules/checkout/api/` | **Medium** | 534 lines, shared between checkout and vendor/buyer coupon pages. May need its own module. |
| `minimumOrderService.js` | `src/services/` | `src/modules/checkout/domain/` or `src/modules/orders/domain/` | **Low** | Used by both checkout and cart. May stay in shared. |

---

## Safety Notes

### Order Creation

- `createCheckoutOrder` calls the `create-checkout-order` Supabase Edge Function.
- The Edge Function handles order insertion, payment record creation, and delivery record creation.
- Checkout module **does not** replicate or modify this logic.
- The `idempotencyKey` parameter prevents duplicate order creation.

### Payment Initiation

- Checkout selects payment method (PayPal / bank transfer / COD) but does **not** implement payment processing.
- PayPal inline payment is handled via `@paypal/react-paypal-js` in `PaymentStep.jsx`.
- Payment eligibility is determined by `trustScoreService.resolveAvailablePaymentTypes()`.
- Payment guard logic (`PaymentGuard.jsx`) is owned by auth/payments, not checkout.

### Cart Clearing

- After successful order creation, checkout calls `clearCart()` / `clearVendorItems()` from `useCartStore`.
- This behavior is unchanged — checkout uses existing public cart actions.

---

## Current Status

- **Phase 3.1:** ✅ Foundation created as re-export layer.
- **Files created:** 9 (index.js + 7 sub-layer index.js + README.md)
- **Files moved:** 0
- **Files deleted:** 0
- **Imports changed:** 0
- **Behavior changed:** No
- **Supabase queries changed:** No
- **Routes changed:** No
