# Coupons Module

## Purpose

The coupons module encapsulates all coupon-related functionality:
- Coupon records CRUD (buyer, vendor, admin operations)
- Coupon validation (code validation, eligibility checks)
- Coupon normalization (field defaults, type coercion)
- Coupon active/expired status checks
- Coupon discount calculation (percentage and fixed)
- Bulk discount calculation (vendor-level quantity-based discounts)
- Coupon redemption tracking and history
- Coupon realtime subscriptions (vendor redemption alerts)

## Current Status: Re-export Foundation Only

This module is currently a **re-export layer**. No source files have been moved.
The re-exports point to existing files in `src/services/`.

**Source file:** `src/services/coupons.js` (534 lines)

## Public API

```js
import {
  // API — Service functions
  couponsApi,
  subscribeToVendorCouponRedemptions,

  // Domain — Normalization, validation, calculation
  normalizeCoupon,
  isCouponCurrentlyActive,
  calculateCouponDiscountAmount,
  calculateBulkDiscountBreakdown,

  // Utils — Same as domain (aliased)
  utilsNormalizeCoupon,
  utilsIsCouponCurrentlyActive,
  utilsCalculateCouponDiscountAmount,
  utilsCalculateBulkDiscountBreakdown,
} from '@/modules/coupons'
```

### `couponsApi` Methods

**Buyer-facing:**
- `getAvailableCoupons(userId, filters)` — get active coupons available to a buyer
- `validateCoupon(couponCode, userId, orderAmount)` — validate a coupon code without redeeming
- `redeemCoupon(couponCode, userId, orderId, orderAmount)` — validate and redeem a coupon
- `getUserRedemptions(userId)` — get user's redeemed coupons with usage history

**Vendor-facing:**
- `getVendorCoupons(vendorId)` — get vendor's coupons with redemption counts
- `getBulkDiscountCandidates(vendorIds)` — get active bulk discount coupons for vendors
- `createCoupon(coupon)` — create a new coupon (vendor only)
- `updateCoupon(couponId, updates)` — update a coupon
- `deactivateCoupon(couponId)` — soft-delete a coupon (set `is_active = false`)
- `getCouponStats(couponId)` — get coupon usage statistics

**Admin-facing:**
- `getAllCoupons(filters)` — get all coupons across all vendors with pagination

### Domain Helpers

- `normalizeCoupon(coupon)` — normalizes coupon fields with defaults
- `isCouponCurrentlyActive(coupon, now)` — checks if coupon is active and within date range
- `calculateCouponDiscountAmount({ coupon, subtotal })` — calculates discount amount for a single coupon
- `calculateBulkDiscountBreakdown({ coupons, items, now })` — calculates best bulk discount per vendor

## What Belongs in Coupons

- Coupon CRUD operations (create, read, update, deactivate)
- Coupon validation logic (code lookup, eligibility, usage limits)
- Coupon normalization (field defaults, type coercion)
- Coupon active/expired checks
- Coupon discount calculation (percentage, fixed, bulk)
- Coupon redemption tracking
- Coupon realtime subscriptions
- Coupon statistics and analytics

## What Does NOT Belong in Coupons

- **Checkout page composition** — owned by `checkout` module. Checkout consumes coupons via `couponsApi` and `calculateCouponDiscountAmount`.
- **Cart state** — owned by `cart` module. Cart items are inputs to bulk discount calculation but cart state is not managed here.
- **Order lifecycle** — owned by `orders` module. Orders store coupon/discount facts after checkout but do not own coupon logic.
- **Payment provider logic** — owned by `payments` module. Coupons affect payable amount but do not change payment provider behavior.
- **Delivery logic** — owned by `delivery` module.
- **Product catalog ownership** — owned by `catalog` module.
- **Auth/session logic** — owned by `auth` module. Coupons reads user identity from `useAuthStore`.
- **User profile ownership** — owned by `users` module.
- **Notification delivery logic** — owned by `notifications` module.
- **Admin dashboard composition** — not a coupons concern.

---

## Relationship with Checkout

- Checkout **consumes** coupons via `couponsApi.validateCoupon()`, `couponsApi.redeemCoupon()`, and `calculateCouponDiscountAmount()`.
- Coupons **owns** coupon validation and discount calculation.
- Checkout **should not own** coupon business rules long-term.
- `src/modules/checkout/api/index.js` re-exports coupon functions from `@/modules/coupons` for backward compatibility.
- Checkout consumers can import from either `@/modules/checkout` or `@/modules/coupons`.
- The old `@/services/coupons` stub has been deleted (Phase 7.19). All imports should use `@/modules/coupons`.

## Relationship with Cart

- Cart items (vendor_id, price_per_unit, quantity) are **inputs** to `calculateBulkDiscountBreakdown`.
- Cart state is **not** managed by the coupons module.
- Cart does not directly call coupon functions — checkout orchestrates the interaction.

## Relationship with Orders

- Orders **store** coupon/discount facts after checkout (e.g., `coupon_id`, `discount_amount` in order records).
- Coupons does **not** own order lifecycle or order status transitions.
- `couponsApi.redeemCoupon()` accepts an `orderId` to link redemption to an order.

## Relationship with Payments

- Coupons **affect** the payable amount by reducing the subtotal.
- Payments **owns** payment provider behavior (PayPal, CMI, Bank Transfer, COD).
- Coupons must **not** change payment provider logic or payment processing flow.
- Checkout calculates the final total (subtotal - coupon discount + shipping + fees) and passes it to payment.

## Relationship with Users

- Coupons reads `user.id` from `useAuthStore` to determine which coupons are available to a buyer.
- Coupons can be assigned to specific users via `metadata.assigned_user_id`.
- `isAssignedToUser()` helper checks assignment eligibility.

## Relationship with Vendor Pages

- `src/pages/vendor/Coupons.jsx` (588 lines) — vendor coupon management page.
- This page uses **Supabase directly** (not `couponsApi`) for CRUD operations.
- This is a known inconsistency — the page should eventually use `couponsApi` methods.
- **Do not move this page** in this phase. It is a migration candidate for a future sprint.

## Relationship with Buyer Pages

- `src/pages/buyer/Coupons.jsx` — buyer coupon list page.
- This page uses `couponsApi.getAvailableCoupons()` to fetch available coupons.
- **Do not move this page** in this phase.

## Relationship with Admin

- `couponsApi.getAllCoupons()` provides admin-facing coupon listing with pagination.
- No admin coupon page exists yet — admin coupon management would be added in a future phase.

---

## Module Structure

```
src/modules/coupons/
├── index.js          # Public API entry point
├── api/
│   └── index.js      # couponsApi, subscribeToVendorCouponRedemptions
├── data/
│   └── index.js      # Placeholder (couponsApi is closest to data layer)
├── domain/
│   └── index.js      # normalizeCoupon, isCouponCurrentlyActive, calculateCouponDiscountAmount, calculateBulkDiscountBreakdown
├── ui/
│   └── index.js      # Placeholder (no coupon-specific UI components yet)
├── hooks/
│   └── index.js      # Placeholder (no coupon-specific hooks yet)
├── stores/
│   └── index.js      # Placeholder (no dedicated coupon store)
├── utils/
│   └── index.js      # Coupon formatting and calculation helpers
└── README.md         # This file
```

---

## Allowed Dependencies

- `shared` — shared utilities and components
- `auth` — public API only (for current user identity)
- `users` — public API only (for user profile data if needed)
- `utils` — utility functions (currency formatting, etc.)
- `config` — configuration constants
- `lib/supabase` — Supabase client

## Forbidden Dependencies

- `cart` internals — cart state is not a coupons concern
- `payments` internals — payment provider logic is not a coupons concern
- `delivery` internals — delivery logic is not a coupons concern
- `orders` internals — order lifecycle is not a coupons concern
- `admin` dashboard composition — not a coupons concern

---

## Migration Candidates for Future Sprints

| # | Item | Current Location | Target | Risk | Recommended Phase |
|---|---|---|---|---|---|
| MC1 | `src/services/coupons.js` | `src/services/` | `src/modules/coupons/api/` | Medium — 534 lines, used by checkout and pages | Phase 4.2+ |
| MC2 | `src/pages/buyer/Coupons.jsx` | `src/pages/buyer/` | `src/modules/coupons/ui/` | Medium — uses couponsApi, relatively decoupled | Phase 4.2+ |
| MC3 | `src/pages/vendor/Coupons.jsx` | `src/pages/vendor/` | `src/modules/coupons/ui/` | High — uses Supabase directly, 588 lines, tightly coupled to vendor context | Phase 4.3+ |
| MC4 | Coupon hooks (`useCoupons`, `useVendorCoupons`, `useCouponValidation`) | Does not exist yet | `src/modules/coupons/hooks/` | Low — create new | Phase 4.2+ |
| MC5 | Remove coupon re-exports from checkout module | `src/modules/checkout/api/index.js` | Remove re-export, consumers import from `@/modules/coupons` | Low — but requires updating all consumers | Phase 4.2+ |

---

## Safety Notes

### Discount Calculation

- `calculateCouponDiscountAmount` and `calculateBulkDiscountBreakdown` are **unchanged**.
- These functions are critical for checkout totals and payment amounts.
- Any change to these functions could affect payment processing and order totals.
- **Do not modify discount formulas** without thorough testing of checkout flow.

### Checkout Integration

- `CheckoutSimplified.jsx` imports `couponsApi` from `@/modules/coupons`.
- `src/modules/checkout/api/index.js` re-exports coupon functions from `@/modules/coupons`.
- The old `@/services/coupons` stub has been deleted (Phase 7.19).

### Vendor Coupon Page

- `src/pages/vendor/Coupons.jsx` uses Supabase directly instead of `couponsApi`.
- This is a known inconsistency but **do not change it** in this phase.
- The page works correctly — it just bypasses the service layer.

### Supabase Tables

- `coupons` table — stores coupon records
- `coupon_redemptions` table — tracks coupon usage history
- Both tables are defined in database migrations and `src/types/database.ts`
- **Do not modify schema or RLS policies.**
