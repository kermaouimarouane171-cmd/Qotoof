# Phase 3.1 — Checkout Module Foundation Report

**Date:** 2026-06-22  
**Project:** Greenmarket / Qotoof  
**Phase:** Phase 3.1 — Checkout Module Foundation  
**Purpose:** Create `src/modules/checkout/` as a public module layer that exposes existing checkout functionality through a clean public API. No files moved. No behavior changed.

---

## 1. Confirmation: `.windsurfrules` Read and Followed

✅ `.windsurfrules` was read in full (614 lines, sections 0–45) and strictly followed throughout this phase.

Key rules respected:

- **Rule 1 (Minimal changes):** Only additive changes — 9 new files created (module structure). No files moved. No files deleted. No existing imports changed.
- **Rule 30 (Stop and ask):** No Supabase/RLS/Auth/Database/Payments/migrations touched.
- **Rule 9 (Payments):** No payment logic changed. No PayPal/CMI/commission/payout files modified.
- **Rule 10 (Orders):** No order creation logic changed. `checkoutService.js` only re-exported, not modified.
- **Rule 13 (Buyer):** No `buyerNeedsOnboarding` or `buyerPublicPaths` logic touched. Checkout route unchanged.
- **Rule 37 (Protected Zone):** No PaymentGuard, PayPal, CMI, commission, payout, or refund files modified.
- **No `any`, no `@ts-ignore`, no `@ts-expect-error`** — not needed.
- **No business logic changes.** All functions retain identical behavior.
- **No Supabase queries changed.** All query functions are unchanged.
- **No routes changed.** Checkout route remains at `/checkout` in `AppRouter.jsx`.
- **No circular dependencies** introduced (verified by `madge`).
- **No mass import rewriting.** All existing imports continue to work.
- **Rule 24 (Documentation):** Only the required report file created. Existing docs updated, not duplicated.

---

## 2. Current Checkout Architecture Summary

### Checkout Page

- **File:** `src/pages/CheckoutSimplified.jsx` (1696 lines)
- **Route:** `/checkout` — buyer-only, inside `ProtectedRoute` with `allowedRoles={[USER_ROLES.BUYER]}`
- **Lazy-loaded:** `const CheckoutPage = lazy(() => import('@/pages/CheckoutSimplified'))`
- **3-step flow:** Step 1 (Shipping/Address) → Step 2 (Delivery/Driver Selection) → Step 3 (Payment)

### Checkout Service

- **File:** `src/services/checkoutService.js` (178 lines)
- **Functions:** `calculateOrderTotals`, `calculateCheckoutPricing`, `createCheckoutOrder`
- **Backend:** Calls Supabase Edge Functions (`create-checkout-order`, `calculate-checkout-pricing`)
- **Cart consumption:** Reads cart items from `useCartStore.getState()` as fallback
- **Auth:** Reads user from `useAuthStore.getState()` as fallback

### Checkout Components

| Component | File | Size | Purpose |
|---|---|---|---|
| `AddressStep` | `src/components/checkout/AddressStep.jsx` | 40 lines | Address selection (saved + new) |
| `CheckoutAddressStep` | `src/components/checkout/CheckoutAddressStep.jsx` | 145 lines | Shipping form (name, phone, city, address, location, notes) |
| `CheckoutSummary` | `src/components/checkout/CheckoutSummary.jsx` | 48 lines | Wrapper for OrderSummary + place order button |
| `OrderSummary` | `src/components/checkout/OrderSummary.jsx` | 228 lines | Full order summary with coupon input |
| `PaymentStep` | `src/components/checkout/PaymentStep.jsx` | 93 lines | Payment method selection + PayPal inline |
| `PaymentTypeSelector` | `src/components/checkout/PaymentTypeSelector.jsx` | 376 lines | Payment type selector (full/split/COD + bank list) |
| `DriverSelectionStep` | `src/components/checkout/DriverSelectionStep.jsx` | 31 lines | Driver selection wrapper |

### Checkout Hook

- **File:** `src/hooks/useCheckoutPricing.ts` (145 lines)
- **Exports:** `useCheckoutPricing`, `calculatePricing`
- **Purpose:** Client-side pricing calculation (subtotal, shipping, bulk discount, coupon discount, platform fee, tax, total)

### Checkout Utility

- **File:** `src/utils/checkoutCleanup.js` (35 lines)
- **Exports:** `rollbackCheckoutRecords`
- **Purpose:** Rollback checkout records (orders, order_items, payments, payment_terms_acceptance, coupon_redemptions) on failed order creation

### Coupon Service (Used During Checkout)

- **File:** `src/services/coupons.js` (534 lines)
- **Exports:** `couponsApi`, `normalizeCoupon`, `isCouponCurrentlyActive`, `calculateCouponDiscountAmount`, `calculateBulkDiscountBreakdown`
- **Purpose:** Coupon fetching, redemption, discount calculation

### Minimum Order Service (Used During Checkout)

- **File:** `src/services/minimumOrderService.js`
- **Exports:** `buildMinimumOrderMessage`, `evaluateVendorMinimumOrders`
- **Purpose:** Validates vendor minimum order amounts in cart

### Cart Consumption in Checkout

- `CheckoutSimplified.jsx` imports `useCartStore` and reads: `items`, `checkoutVendorId`, `clearCart`, `clearCheckoutVendor`, `clearVendorItems`
- Cart items are filtered by `checkoutVendorId` if set (single-vendor checkout)
- After successful order creation: `clearCart()` or `clearVendorItems(checkoutVendorId)` is called
- This behavior is unchanged — checkout uses existing public cart actions

### Order Creation Flow

1. `CheckoutSimplified.jsx` calls `createCheckoutOrder(params)` from `checkoutService.js`
2. `checkoutService.js` builds payload via `buildCheckoutPayload()` and calls `supabase.functions.invoke('create-checkout-order')`
3. Edge Function creates orders, order_items, payments, delivery records
4. On success: cart is cleared, navigate to `/order-confirmation`
5. On PayPal pending: stays on page with inline PayPal buttons
6. On failure: error toast shown, no cart clearing

### Payment Method Selection

- Payment methods: PayPal, Bank Transfer, COD (Cash on Delivery)
- Payment types: full (full payment), split (split payment), cod (cash on delivery)
- Payment eligibility determined by `trustScoreService.resolveAvailablePaymentTypes()`
- PayPal inline payment via `@paypal/react-paypal-js` in `PaymentStep.jsx`
- Bank selection from `BANK_OPTIONS` constant in `PaymentTypeSelector.jsx`
- This behavior is unchanged

### Delivery Selection During Checkout

- Delivery options: self_pickup, own_driver, find_driver (determined by vendor store setup)
- Cargo size selection: small, medium, large
- Driver delivery payment method: cash, bank_transfer
- Delivery scheduling: date + slot selection via `deliveryScheduleService`
- Driver matching: via `deliveryMatchingService` (find_driver option)
- This behavior is unchanged

### Confirmation/Success Flow

- After successful order creation: `navigate('/order-confirmation', { state: { order, paymentMethod, paymentType, selectedBank } })`
- For PayPal pending: `navigate('/order-confirmation/${internalOrderId}?paypal=success')` after inline approval
- Confirmation email sent via `emailService.sendOrderConfirmation()` (deferred for PayPal)
- This behavior is unchanged

---

## 3. What Checkout Files Were Created

| File | Purpose |
|---|---|
| `src/modules/checkout/index.js` | Public API entry point — re-exports from all sub-layers |
| `src/modules/checkout/api/index.js` | Re-exports checkoutService, coupons, minimumOrderService |
| `src/modules/checkout/data/index.js` | Placeholder (no dedicated checkout repository yet) |
| `src/modules/checkout/domain/index.js` | Re-exports checkoutCleanup (rollback records) |
| `src/modules/checkout/ui/index.js` | Re-exports CheckoutSimplified + 7 checkout step components |
| `src/modules/checkout/hooks/index.js` | Re-exports useCheckoutPricing, calculatePricing |
| `src/modules/checkout/stores/index.js` | Placeholder (no dedicated checkout store yet) |
| `src/modules/checkout/utils/index.js` | Re-exports checkoutCleanup |
| `src/modules/checkout/README.md` | Module documentation — responsibility, public API, relationships, migration candidates |

**Total files created:** 9

---

## 4. What Files Were Moved

**None.** No files were moved. All original files remain in their current locations:
- `src/pages/CheckoutSimplified.jsx` — not moved (1696 lines, too risky)
- `src/services/checkoutService.js` — not moved (178 lines, migration candidate)
- `src/hooks/useCheckoutPricing.ts` — not moved (145 lines, safe to move later)
- `src/utils/checkoutCleanup.js` — not moved (35 lines, safe to move later)
- `src/components/checkout/*.jsx` — not moved (7 files, safe to move later)
- `src/services/coupons.js` — not moved (534 lines, may need own module)
- `src/services/minimumOrderService.js` — not moved (shared with cart)

---

## 5. What Files Were Only Re-exported/Wrapped

All checkout functionality is exposed through re-exports only:

| Source File | Re-exported Via | Exports |
|---|---|---|
| `src/pages/CheckoutSimplified.jsx` | `checkout/ui/index.js` → `checkout/index.js` | `CheckoutPage` (default) |
| `src/services/checkoutService.js` | `checkout/api/index.js` → `checkout/index.js` | `calculateOrderTotals`, `calculateCheckoutPricing`, `createCheckoutOrder` |
| `src/services/coupons.js` | `checkout/api/index.js` → `checkout/index.js` | `couponsApi`, `normalizeCoupon`, `isCouponCurrentlyActive`, `calculateCouponDiscountAmount`, `calculateBulkDiscountBreakdown` |
| `src/services/minimumOrderService.js` | `checkout/api/index.js` → `checkout/index.js` | `buildMinimumOrderMessage`, `evaluateVendorMinimumOrders` |
| `src/hooks/useCheckoutPricing.ts` | `checkout/hooks/index.js` → `checkout/index.js` | `useCheckoutPricing`, `calculatePricing` |
| `src/utils/checkoutCleanup.js` | `checkout/domain/index.js` + `checkout/utils/index.js` → `checkout/index.js` | `rollbackCheckoutRecords` (also as `rollbackCheckout`) |
| `src/components/checkout/CheckoutAddressStep.jsx` | `checkout/ui/index.js` → `checkout/index.js` | `CheckoutAddressStep` (default) |
| `src/components/checkout/CheckoutSummary.jsx` | `checkout/ui/index.js` → `checkout/index.js` | `CheckoutSummary` (default) |
| `src/components/checkout/PaymentStep.jsx` | `checkout/ui/index.js` → `checkout/index.js` | `PaymentStep` (default) |
| `src/components/checkout/PaymentTypeSelector.jsx` | `checkout/ui/index.js` → `checkout/index.js` | `PaymentTypeSelector` (default) |
| `src/components/checkout/OrderSummary.jsx` | `checkout/ui/index.js` → `checkout/index.js` | `OrderSummary` (default) |
| `src/components/checkout/AddressStep.jsx` | `checkout/ui/index.js` → `checkout/index.js` | `AddressStep` (default) |
| `src/components/checkout/DriverSelectionStep.jsx` | `checkout/ui/index.js` → `checkout/index.js` | `DriverSelectionStep` (default) |

---

## 6. Public API Exposed by `src/modules/checkout`

```js
import {
  // UI — Page
  CheckoutPage,
  // UI — Step components
  CheckoutAddressStep,
  CheckoutSummary,
  PaymentStep,
  PaymentTypeSelector,
  OrderSummary,
  AddressStep,
  DriverSelectionStep,
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

---

## 7. What Checkout Files Were Intentionally Not Moved and Why

| File | Reason |
|---|---|
| `CheckoutSimplified.jsx` | **High risk.** 1696 lines, 20+ imports, complex multi-step state management. Must decompose into smaller components before moving. Moving now would break the route lazy-load import. |
| `checkoutService.js` | **Medium risk.** 178 lines, calls Edge Functions. Should move after payments module is created to clarify boundary between checkout orchestration and payment processing. |
| `useCheckoutPricing.ts` | **Low risk but premature.** 145 lines, pure pricing calculation. Safe to move but no urgency — moving now would require updating the import in `CheckoutSimplified.jsx` which is not being modified. |
| `checkoutCleanup.js` | **Low risk but premature.** 35 lines, rollback utility. Safe to move but only used by `checkoutService.js` which is not being moved yet. |
| Checkout step components (7 files) | **Low-medium risk.** Safe to move individually but should move together with `CheckoutSimplified.jsx` after decomposition. |
| `coupons.js` | **Medium risk.** 534 lines, shared between checkout, buyer coupon pages, and vendor coupon management. May need its own `coupons` module (Phase 3.4) rather than being owned by checkout. |
| `minimumOrderService.js` | **Low risk but shared.** Used by both checkout and cart. May stay in shared or move to cart module. |
| `PaymentTypeSelector.jsx` | **Medium risk.** 376 lines, contains bank list constants and payment type logic. Closely coupled to payment eligibility logic. Should move after payments module is created. |

---

## 8. Whether Any Imports Were Changed

✅ **No existing imports were changed.**

All changes are additive — new module files were created that re-export existing functionality. No existing file had its imports modified. No existing file had its exports modified. The `AppRouter.jsx` still imports `CheckoutSimplified` directly from `@/pages/CheckoutSimplified`. All other consumers continue to import from their original paths.

---

## 9. Whether Checkout Page Behavior Is Unchanged

✅ **Yes — checkout page behavior is 100% unchanged.**

`CheckoutSimplified.jsx` was not modified. It continues to:
- Render 3 steps (shipping → delivery → payment)
- Consume cart items from `useCartStore`
- Call `createCheckoutOrder` from `@/services/checkoutService`
- Navigate to `/order-confirmation` on success
- Show PayPal inline buttons when PayPal payment is pending
- Clear cart on success via `clearCart()` / `clearVendorItems()`

---

## 10. Whether Cart Consumption Is Unchanged

✅ **Yes — cart consumption is unchanged.**

`CheckoutSimplified.jsx` still imports `useCartStore` from `@/store/cartStore` and reads `items`, `checkoutVendorId`, `clearCart`, `clearCheckoutVendor`, `clearVendorItems`. No changes to how cart is consumed.

---

## 11. Whether Order Creation Behavior Is Unchanged

✅ **Yes — order creation behavior is unchanged.**

`checkoutService.js` was not modified. `createCheckoutOrder` still:
- Builds payload via `buildCheckoutPayload()`
- Calls `supabase.functions.invoke('create-checkout-order')`
- Returns `{ data, error, orders, pricing }` or throws on failure
- Uses `idempotencyKey` for duplicate prevention

---

## 12. Whether Payment Method Selection Behavior Is Unchanged

✅ **Yes — payment method selection behavior is unchanged.**

`PaymentStep.jsx` and `PaymentTypeSelector.jsx` were not modified. Payment method selection still:
- Offers PayPal, Bank Transfer, COD
- Supports full/split payment types
- Shows bank list from `BANK_OPTIONS` constant
- Uses `trustScoreService` for eligibility
- Renders PayPal inline buttons via `@paypal/react-paypal-js`

---

## 13. Whether Delivery Selection Behavior Is Unchanged

✅ **Yes — delivery selection behavior is unchanged.**

Delivery selection in `CheckoutSimplified.jsx` was not modified. It still:
- Determines delivery strategy from vendor store setup
- Offers cargo size selection (small/medium/large)
- Shows driver selection for `find_driver` option
- Supports delivery scheduling via `deliveryScheduleService`
- Shows driver delivery payment method selection (cash/bank_transfer)

---

## 14. Whether Coupon Behavior Is Unchanged

✅ **Yes — coupon behavior is unchanged.**

`coupons.js` was not modified. `CheckoutSimplified.jsx` still imports `couponsApi` from `@/services/coupons` and uses it for:
- `validateCoupon(code)` — validates and applies coupon
- `calculateBulkDiscountBreakdown()` — calculates bulk discount offers

---

## 15. Whether Confirmation/Success Flow Is Unchanged

✅ **Yes — confirmation/success flow is unchanged.**

`CheckoutSimplified.jsx` still:
- Navigates to `/order-confirmation` with order state on success
- Defers confirmation email for PayPal until payment is approved
- Calls `emailService.sendOrderConfirmation()` for non-PayPal or after PayPal approval
- Shows success toast messages based on payment method/type

---

## 16. Whether Routes Are Unchanged

✅ **Yes — routes are unchanged.**

`AppRouter.jsx` was not modified. The checkout route remains:
```jsx
<Route element={<ProtectedRoute allowedRoles={[USER_ROLES.BUYER]} requiredRole={USER_ROLES.BUYER} />}>
  <Route path="checkout" element={<SuspenseRoute><CheckoutPage /></SuspenseRoute>} />
</Route>
```

The lazy import remains: `const CheckoutPage = lazy(() => import('@/pages/CheckoutSimplified'))`

---

## 17. Documentation Updates

### Documents Updated

| Document | What Was Updated |
|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | Updated status line to include Phase 3.1. Added Phase 3.1 achievement note with full details. |
| `ARCHITECTURE_GUIDE.md` | Added Phase 3.1 completion to TODO/status section. |
| `DEVELOPER_GUIDE.md` | Added `src/modules/checkout/` to project structure tree with full sub-layer descriptions. |

### Documents Checked But Not Changed

| Document | Reason |
|---|---|
| `src/modules/cart/README.md` | No changes — cart module unaffected by checkout module creation |
| `src/modules/orders/README.md` | No changes — orders module unaffected |
| `src/modules/delivery/README.md` | No changes — delivery module unaffected |
| `src/modules/catalog/README.md` | No changes — catalog module unaffected |
| `src/modules/marketplace/README.md` | No changes — marketplace module unaffected |
| `src/modules/users/README.md` | No changes — users module unaffected |
| `src/modules/shared/README.md` | No changes — shared module unaffected |
| `src/modules/auth/README.md` | No changes — auth module unaffected |
| `src/app/README.md` | No changes — app layer unaffected |
| `eslint.config.js` | No changes needed — `no-restricted-imports` rule already covers `@/modules/checkout/*` |
| `package.json` | No changes needed — no new scripts or dependencies |
| `SYSTEM_DESIGN.md` | No changes — describes runtime architecture, not file structure |
| Phase 1–2.6 reports | No changes — historical reports, not affected by Phase 3.1 |

### Outdated Documents Found

None. All documentation is consistent with the current codebase after updates.

### Documentation Still Needing Future Updates

| Document | What | When |
|---|---|---|
| `ARCHITECTURE_GUIDE.md` | Replace `src/features/` tree with `src/modules/` + `src/app/` tree | Phase 3+ (when first file moves) |
| `DEVELOPER_GUIDE.md` | Update "إضافة Feature جديدة" section to use module structure | Phase 3+ |
| `DEVELOPER_GUIDE.md` | Replace `src/features/` guide with `src/modules/` guide | Phase 3+ |
| `DEVELOPER_GUIDE.md` | Update Edge Functions section (Stripe/CMI retired, PayPal active) | Phase 3.2 (payments module) |
| `DEVELOPER_GUIDE.md` | Update Payment troubleshooting section | Phase 3.2 (payments module) |
| `checkout/README.md` | Update when files are moved into the module | Phase 3+ (file migration) |
| `checkout/README.md` | Update when checkout store is created | Phase 3+ |
| `checkout/README.md` | Update when checkout page is decomposed | Phase 3+ |
| `orders/README.md` | Update when checkout-to-orders event contract is designed | Phase 3+ |
| Event contract documentation | Document `order:payment_updated` and `order:delivery_updated` when implemented | Phase 3+ |

---

## 18. Command Results

| Command | Result | Details |
|---|---|---|
| `npm run lint` | ✅ **Passed** | `eslint . --max-warnings 1500` — 0 errors, exit code 0 |
| `npm run type-check` | ✅ **Passed** | `tsc --noEmit` — 0 errors, exit code 0 |
| `npm run build` | ✅ **Passed** | Built in 2m 47s, PWA generated (198 precache entries, 9748 KiB) |
| `npm run check:circular` | ✅ **Passed** | `madge --circular --extensions js,jsx,ts,tsx src/` — 622 files processed, 0 circular dependencies |

### Madge File Count Progression

| Phase | Files Tracked | Circular Deps |
|---|---|---|
| After Phase 2 Final Gate | 611 | 0 |
| After Phase 2.6 | 614 | 0 |
| **After Phase 3.1** | **622** (+8 module files) | **0** |

---

## 19. Whether It Is Safe to Continue to Phase 3.2 Payments Module

### ✅ Yes — It is safe to continue to Phase 3.2

**Justification:**

1. **All 4 verification commands pass** (lint, type-check, build, check:circular)
2. **0 circular dependencies** across 622 files
3. **No existing imports changed** — all changes are additive re-exports
4. **No behavior changed** — checkout flow, order creation, payment selection, delivery selection, coupon application, confirmation flow all unchanged
5. **No Supabase queries changed** — all database interactions unchanged
6. **No routes changed** — checkout route remains at `/checkout`
7. **No files moved** — all original files remain in their locations
8. **Documentation updated** — plan, architecture guide, and developer guide reflect Phase 3.1
9. **Module README created** — documents responsibility, public API, relationships, migration candidates

---

## 20. Whether an Intermediate Checkout/Orchestration Preparation Step Is Recommended Before Payments

### 🟡 Recommended but not blocking

**Rationale:**

The checkout module is now a clean re-export layer, but `CheckoutSimplified.jsx` (1696 lines) is a monolithic page that:
- Manages 30+ state variables
- Imports from 20+ different modules/services
- Contains inline Supabase queries (fetching vendor profiles, buyer profiles, order details)
- Handles PayPal inline payment flow
- Handles delivery scheduling, driver matching, cargo size, driver payment method
- Handles coupon validation and application
- Handles order creation, email sending, cart clearing, navigation

Before creating the payments module, it would be beneficial (but not blocking) to:
1. **Decompose `CheckoutSimplified.jsx`** into smaller step components with extracted hooks
2. **Create a checkout store** (Zustand) to manage the 30+ state variables
3. **Extract inline Supabase queries** into `checkoutService.js` or a dedicated repository
4. **Design the checkout→payments boundary** — what checkout owns vs what payments owns

However, the payments module can be created independently as a re-export layer (same pattern as checkout) without requiring checkout decomposition. The two modules can coexist as re-export layers until file migration begins.

**Recommendation:** Proceed to Phase 3.2 (payments module foundation) as a re-export layer. Schedule checkout decomposition as a parallel task or as part of Phase 3 file migration.

---

## 21. Phase 3.1 Summary

| Gate Check | Status |
|---|---|
| `src/modules/checkout/` created with full structure | ✅ |
| Public API exposes checkout functionality | ✅ |
| No files moved | ✅ |
| No files deleted | ✅ |
| No existing imports changed | ✅ |
| No business logic changes | ✅ |
| No Supabase query changes | ✅ |
| No database/RLS changes | ✅ |
| No routes changed | ✅ |
| No UI redesign | ✅ |
| No circular dependencies | ✅ |
| `npm run lint` passes | ✅ |
| `npm run type-check` passes | ✅ |
| `npm run build` passes | ✅ |
| `npm run check:circular` passes | ✅ |
| Documentation updated | ✅ |
| Module README created | ✅ |
| **Phase 3.1: PASSED** | ✅ |

---

## 22. Recommendation

### Phase 3.1: ✅ PASSED

**It is safe to proceed to Phase 3.2 — Payments Module Foundation.**

**Recommended Phase 3 path:**
1. **Phase 3.1** — checkout module foundation ✅ (completed)
2. **Phase 3.2** — payments module foundation (`src/modules/payments/`) as re-export layer
3. **Phase 3.3** — notifications module foundation (`src/modules/notifications/`)
4. **Phase 3.4** — coupons module foundation (`src/modules/coupons/`) (if needed)
5. **Phase 3 Final Gate** — verification before Phase 4

**Event contract design** (`order:payment_updated`, `order:delivery_updated`) should be documented as part of Phase 3.2 (payments) but NOT implemented until file migration begins.
