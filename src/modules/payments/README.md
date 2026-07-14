# Payments Module

**Phase:** 3.2 — Payments Module Foundation (re-export layer)  
**Status:** Wrapper/re-export foundation only. No files moved. No behavior changed.

---

## Module Responsibility

The payments module owns:

- **Payment records** — CRUD operations on the `payments` table (insert, get, update, normalize, decorate)
- **Payment status display and helpers** — `PAYMENT_STATUS`, `PAYMENT_STATUS_BADGE`, `PAYMENT_STATUS_HEX`, `PAYMENT_STATUS_LABEL_AR`, `getPaymentStatusBadge`, `getPaymentStatusColor`
- **Payment method constants** — `PAYMENT_METHOD`, `PAYMENT_METHODS`, `getAvailablePaymentMethods`, `getPaymentMethodById`
- **PayPal service/API integration** — `processPayPalPayment`, `createPaymentIntent`, `confirmPayment`, `paymentGateway` singleton
- **Bank transfer payment support** — `confirmBankTransfer`, `processBankTransfer` (via `paymentGateway`)
- **COD payment support** — `processCodPayment` (via `paymentGateway`)
- **Refund-related payment helpers** — `refundPayment`, `refundPayPalPayment`, `refundCmiPayment` (via `paymentGateway`), `recordRefund` (via `paymentGateway`)
- **Payment guard** — `usePaymentGuard` hook for PayPal setup enforcement
- **PayPal eligibility** — `isPayPalSetupComplete`, `hasValidPayPalEmail`, `assertPayPalSetupOrThrow`, `getPayPalSetupRoute`, `getPayPalSetupBlockMessage`
- **Payment-related hooks** — `usePaymentHistory`, `usePaymentDetail`, `useCreatePayment`, `useConfirmPayment`, `paymentKeys`
- **Payment-related Edge Function clients** — calls to `create-paypal-order`, `capture-paypal-order`, `confirm-order-payment`, `confirm-bank-transfer`, `register-payment-receipt`, `refund-paypal-payment`, `refund-cmi-payment`, `process-manual-refund`, `verify-cmi-callback`, `get-bank-details`
- **Vendor refund policy management** — `DEFAULT_REFUND_POLICY`, `getVendorRefundPolicy`
- **Legacy CMI compatibility surface** — `initCMIPayment`, `verifyCMICallback`, `getCMIStatus` (all deprecated, CMI is retired)

## What Does NOT Belong in Payments

- **Checkout page composition** — owned by `checkout` module. Checkout selects payment method and initiates payment; payments owns provider-specific logic.
- **Cart state** — owned by `cart` module. Payments does not interact with cart.
- **Order lifecycle ownership** — owned by `orders` module. Payments owns payment status and provider results, not order status transitions.
- **Delivery state** — owned by `delivery` module. Payments does not manage delivery tracking.
- **Product catalog** — owned by `catalog` module.
- **Auth/session logic** — owned by `auth` module. Payments reads profile for PayPal eligibility only.
- **User profile ownership** — owned by `users` module. Payments reads `paypal_email` and `paypal_verified` from profile.
- **Notification delivery logic** — owned by `notifications` module (future). Payments may trigger notifications but does not deliver them.
- **Admin dashboard composition** — not a payments concern.
- **Commission/payout business logic** — `commissionService.js` (696 lines) and `payoutService.js` (22 lines, moved to `@/modules/commissions/api/` in Phase 7.21) are separate financial modules. Payments may expose payment facts (amount, method, status) but does not calculate commissions or process payouts.
- **Return requests** — `returns.js` (362 lines) handles product return requests. While it includes refund-adjacent logic (`processReturn` with `refund_issued` status), it is primarily an order/product concern. Documented as a migration candidate.

---

## Active Payment Methods

| Method | ID | Status | Description |
|---|---|---|---|
| **PayPal** | `paypal` | ✅ Active | Online payment via PayPal API. Uses `create-paypal-order` and `capture-paypal-order` Edge Functions. |
| **Bank Transfer** | `bank` | ✅ Active | Moroccan bank transfer. Uses `confirm-bank-transfer` and `get-bank-details` Edge Functions. |
| **COD** | `cod` | ✅ Active | Cash on Delivery. Payment record created as `pending`, paid on delivery. |

## Legacy/Deprecated Payment Code

| Method | ID | Status | Notes |
|---|---|---|---|
| **CMI** | `cmi` | ❌ Retired | `cmiPayment.js` throws errors for `initCMIPayment` and `verifyCMICallback`. `getCMIStatus` reads legacy records from DB only. `paymentGateway.processCmiPayment()` throws. CMI is kept for reading/refunding historical records only. |

---

## Public API (Root Barrel — Lightweight)

The root barrel exports only lightweight non-UI symbols: API services, domain constants, hooks, and utils.

```js
import {
  // API — paymentService (functional)
  createPaymentIntent,
  processPayPalPayment,
  processStripePayment,       // alias for processPayPalPayment (legacy)
  processCMIPayment,          // deprecated, throws
  confirmBankTransfer,
  createOrderPaymentRecord,
  getLatestOrderPaymentRecord,
  updateOrderPaymentRecord,
  registerPaymentReceipt,
  confirmOrderPayment,
  getPaymentStatus,
  refundPayment,
  // API — paymentGateway (singleton)
  paymentGateway,
  confirmPayment,
  // API — paymentRecords (CRUD)
  normalizePaymentMethod,
  getPaymentMethodCandidates,
  resolvePaymentMethod,
  decoratePaymentRecord,
  buildPaymentWritePayload,
  applyPaymentMethodFilter,
  insertPaymentRecord,
  getLatestPaymentRecordForOrder,
  getPaymentRecordById,
  updatePaymentRecordById,
  // API — cmiPayment (legacy/deprecated)
  initCMIPayment,
  verifyCMICallback,
  getCMIStatus,
  // API — refundPolicyService
  DEFAULT_REFUND_POLICY,
  getVendorRefundPolicy,
  // Domain — constants
  PAYMENT_METHOD,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  PAYMENT_STATUS_BADGE,
  PAYMENT_STATUS_HEX,
  PAYMENT_STATUS_LABEL_AR,
  getAvailablePaymentMethods,
  getPaymentMethodById,
  getPaymentStatusBadge,
  getPaymentStatusColor,
  // Domain — PayPal eligibility
  PAYPAL_REQUIRED_ROLES,
  hasValidPayPalEmail,
  isPayPalSetupComplete,
  getPayPalSetupRoute,
  getPayPalSetupBlockMessage,
  assertPayPalSetupOrThrow,
  // Hooks
  paymentKeys,
  usePaymentHistory,
  usePaymentDetail,
  useCreatePayment,
  useConfirmPayment,
} from '@/modules/payments'
```

### Intentionally NOT Exported from Root (Phase 6.21)

UI exports were removed from the root barrel. App code imports `usePaymentGuard` from `@/contexts/PaymentGuard` and payment components from their original component paths.

| Symbol | Available Via |
|---|---|
| `usePaymentGuard` | `@/contexts/PaymentGuard` or `@/modules/payments/ui` |
| `OrderPaymentSection` | `@/components/orders/OrderPaymentSection` or `@/modules/payments/ui` |
| `PaymentReceiptUpload` | `@/components/orders/PaymentReceiptUpload` or `@/modules/payments/ui` |
| `PaymentPolicySettings` | `@/components/vendor/PaymentPolicySettings` or `@/modules/payments/ui` |
| `RefundPolicySettings` | `@/components/vendor/RefundPolicySettings` or `@/modules/payments/ui` |
| `DeliveryPaymentPolicy` | `@/components/driver/DeliveryPaymentPolicy` or `@/modules/payments/ui` |

### UI / Page Import Policy

App code should import payment UI components from their original paths:
```js
import { usePaymentGuard } from '@/contexts/PaymentGuard'
import PaymentReceiptUpload from '@/components/orders/PaymentReceiptUpload'
import PaymentPolicySettings from '@/components/vendor/PaymentPolicySettings'
```

UI exports remain available through `src/modules/payments/ui/index.js` for intra-module use only.

---

## Module Structure

```
src/modules/payments/
├── index.js          # Public API entry point
├── api/
│   └── index.js      # Re-exports paymentService, paymentGateway, paymentRecords, cmiPayment, refundPolicyService
├── data/
│   └── index.js      # Placeholder (paymentRecords.js is closest to data layer)
├── domain/
│   └── index.js      # Re-exports payment constants, PayPal eligibility, existing domains/payments
├── ui/
│   └── index.js      # Re-exports PaymentGuard, OrderPaymentSection, PaymentReceiptUpload, PaymentPolicySettings, RefundPolicySettings, DeliveryPaymentPolicy
├── hooks/
│   └── index.js      # Re-exports paymentKeys, usePaymentHistory, usePaymentDetail, useCreatePayment, useConfirmPayment
├── stores/
│   └── index.js      # Placeholder (no dedicated payment store)
├── utils/
│   └── index.js      # Re-exports paypalEligibility utilities
└── README.md         # This file
```

---

## Relationships

### Checkout

- Checkout **selects** payment method (PayPal / bank transfer / COD) and may **initiate** payment.
- Payments **owns** provider-specific payment logic (PayPal order creation, bank transfer confirmation, COD record creation).
- Checkout must **consume** payments through public API in the future.
- Currently, `CheckoutSimplified.jsx` imports `getLatestOrderPaymentRecord` from `@/modules/payments` directly (migrated in Phase 7.9).

### Orders

- Orders **owns** order lifecycle (status transitions, tracking, deletion).
- Payments **owns** payment status and provider results.
- `confirmOrderPayment` Edge Function updates both order status and commission — it is called via `paymentService.confirmOrderPayment`.
- `getLatestOrderPaymentRecord` is used by both checkout and order detail pages to display payment status.
- Future synchronization should use documented event contract: `order:payment_updated` (not implemented in this sprint).

### Commissions/Payouts

- Commissions/payouts are **separate financial modules** (future).
- `commissionService.js` (696 lines) calculates monthly 3% commission, manages vendor monthly sales, and handles account freezing. It is **not** re-exported from payments.
- `payoutService.js` (22 lines) sends payouts via `send-payout` Edge Function. Moved to `@/modules/commissions/api/` in Phase 7.21. Not re-exported from payments.
- `paymentMethodStrategy.js` (35 lines) validates PayPal payout recipient eligibility. Moved to `@/modules/commissions/api/` in Phase 7.21. Not re-exported from payments.
- Payments may **expose payment facts** (amount, method, status) that commissions/payouts consume.
- Commissions/payouts **calculate** platform/vendor financial obligations.

### Refunds

- `refundPayment` in `paymentService.js` delegates to `paymentGateway.refundPayment` which handles PayPal refunds (via `refund-paypal-payment` Edge Function), CMI refunds (via `refund-cmi-payment` Edge Function), and manual refunds for COD/bank (via `process-manual-refund` Edge Function).
- `refundPolicyService.js` manages vendor refund policy configuration (return window, partial returns, shipping payer).
- `returns.js` (362 lines) handles product return requests with refund-adjacent logic (`processReturn` with `refund_issued` status). It is **not** re-exported from payments — it is primarily an order/product concern.

### Notifications

- Payments may **trigger** notifications (e.g., payment confirmed, refund issued) but does **not** deliver them.
- Notification delivery is owned by the `notifications` module (future).
- `commissionService.js` calls `commissionNotifications` and `notificationsApi` directly — this is a commission concern, not a payments concern.

---

## Event Contract (Future — Not Implemented)

```
order:payment_updated
payload: {
  orderId: string,
  paymentStatus: string,
  paymentId: string,
  amount: number,
  method: string,
  occurredAt: string (ISO 8601)
}
```

This event contract is **documented only** — it is not implemented in this sprint. It will be used for payments↔orders synchronization in a future phase.

---

## Allowed Dependencies

- `@/modules/shared` — shared utilities and constants
- `@/modules/auth` — auth public API (for profile/PayPal eligibility checks)
- `@/modules/users` — users public API (for profile data)
- `@/modules/orders` — orders public API (only for safe order references if already needed)
- `@/modules/checkout` — checkout public API (only if absolutely necessary and already existing)
- `@/utils` — utility functions (logger, withRetry, etc.)
- `@/config` / `@/lib/config` — configuration (PayPal client ID, settlement currency)
- `@/lib/supabase` — Supabase client (used by paymentGateway, paymentRecords)
- `@/constants/payment` — payment constants
- `@/services/supabase` — Supabase client (used by payment services)

## Forbidden Dependencies

- `@/modules/cart` — cart internals (owned by cart module)
- `@/services/deliveryMatchingService` — delivery internals (owned by delivery module)
- `@/services/deliveryScheduleService` — delivery internals (owned by delivery module)
- `@/services/driverLocationService` — delivery internals (owned by delivery module)
- Admin dashboard composition — not a payments concern

---

## Edge Functions (Payment-Related)

| Edge Function | Purpose | Status |
|---|---|---|
| `create-paypal-order` | Create PayPal order | ✅ Active |
| `capture-paypal-order` | Capture/confirm PayPal payment | ✅ Active |
| `refund-paypal-payment` | Refund PayPal payment | ✅ Active |
| `reconcile-paypal-payments` | Reconcile PayPal payment status | ✅ Active |
| `confirm-order-payment` | Confirm vendor-side payment receipt | ✅ Active |
| `confirm-bank-transfer` | Confirm bank transfer with receipt | ✅ Active |
| `get-bank-details` | Fetch bank transfer details | ✅ Active |
| `register-payment-receipt` | Register staged payment receipt | ✅ Active |
| `refund-cmi-payment` | Refund legacy CMI payment | ✅ Active (legacy) |
| `process-manual-refund` | Manual refund for COD/bank | ✅ Active |
| `verify-cmi-callback` | Verify CMI callback signature | ✅ Active (legacy) |
| `create-payment-intent` | Legacy payment intent creation | ⚠️ Legacy |
| `cmi-payment` | Legacy CMI payment initiation | ❌ Retired |
| `payment-status-write` | Direct payment status write | ⚠️ Legacy |
| `refund-payment` | Generic refund handler | ⚠️ Legacy |
| `send-payout` | Send vendor/driver payout | ✅ Active (payouts, not payments) |

**Note:** Edge Functions are not modified, moved, or touched in this phase. They are documented here for reference only.

---

## Migration Candidates (Future Sprints)

| File | Current Location | Migration Target | Risk | Notes |
|---|---|---|---|---|
| `paymentService.js` | `src/services/` | `src/modules/payments/api/` | **Low** | 296 lines, functional API wrapper. Safe to move. |
| `paymentGateway.js` | `src/services/` | `src/modules/payments/api/` or `domain/` | **High** | 700 lines, class-based gateway with PayPal/COD/Bank/CMI/refund logic. Tightly coupled to Edge Functions. Must verify all consumers. |
| `paymentRecords.js` | `src/services/` | `src/modules/payments/data/` | **Low** | 178 lines, pure CRUD. Safe to move. |
| `cmiPayment.js` | `src/services/` | `src/modules/payments/api/` (legacy) | **Low** | 45 lines, all functions throw or read-only. Safe to move. |
| `payment.js` (constants) | `src/constants/` | `src/modules/payments/domain/` | **Low** | 172 lines, pure constants. Safe to move. |
| `paypalEligibility.js` | `src/utils/` | `src/modules/payments/utils/` or `domain/` | **Low** | 35 lines, pure helpers. Safe to move. |
| `PaymentGuard.jsx` | `src/contexts/` | `src/modules/payments/ui/` | **Low-Medium** | 52 lines, uses authStore and location. Safe to move after verifying consumers. |
| `useCartPaymentQueries.js` | `src/hooks/queries/` | `src/modules/payments/hooks/` | **Medium** | 318 lines, mixed cart + payment hooks. Must split cart hooks from payment hooks before moving. |
| `refundPolicyService.js` | `src/services/` | `src/modules/payments/api/` | **Low** | 67 lines, vendor refund policy CRUD. Safe to move. |
| `OrderPaymentSection.jsx` | `src/components/orders/` | `src/modules/payments/ui/` | **Low** | 65 lines, order payment display. Safe to move. |
| `PaymentReceiptUpload.jsx` | `src/components/orders/` | `src/modules/payments/ui/` | **Medium** | 327 lines, handles file upload + notifications + email. Must verify all imports. |
| `PaymentPolicySettings.jsx` | `src/components/vendor/` | `src/modules/payments/ui/` | **Low** | 195 lines, vendor payment policy form. Safe to move. |
| `RefundPolicySettings.jsx` | `src/components/vendor/` | `src/modules/payments/ui/` | **Low** | 111 lines, vendor refund policy form. Safe to move. |
| `DeliveryPaymentPolicy.jsx` | `src/components/driver/` | `src/modules/payments/ui/` or `delivery/ui/` | **Low** | 71 lines, driver delivery payment form. May belong in delivery module. |
| `commissionService.js` | `src/services/` | `src/modules/commissions/` (Phase 4) | **High** | 696 lines, complex commission logic. Separate module. |
| `payoutService.js` | `@/modules/commissions/api/` | Already migrated | ✅ Done | Moved in Phase 7.21, stub deleted Phase 7.22. |
| `paymentMethodStrategy.js` | `@/modules/commissions/api/` | Already migrated | ✅ Done | Moved in Phase 7.21, stub deleted Phase 7.22. |
| `returns.js` | `src/services/` | `src/modules/orders/` or `src/modules/returns/` | **Medium** | 362 lines, return requests. Primarily order/product concern. |
| `domains/payments/` | `src/domains/` | Consolidate into `src/modules/payments/` | **Low** | 3 files, already re-exports paymentService. Can consolidate. |

---

## Safety Notes

### PayPal Behavior

- PayPal payment is processed via `create-paypal-order` and `capture-paypal-order` Edge Functions.
- PayPal client ID is read from `VITE_PAYPAL_CLIENT_ID` env var.
- PayPal secret is handled server-side only — never exposed to frontend.
- PayPal eligibility is checked via `paypalEligibility.js` (vendor/driver must have verified PayPal email).
- `PaymentGuard` enforces PayPal setup for vendor/driver roles with bypass paths for settings/onboarding/digital-contract.
- **No PayPal behavior changed in this phase.**

### Bank Transfer Behavior

- Bank transfer creates a payment record with `awaiting_transfer` status.
- Bank details (IBAN, BIC) are fetched from `get-bank-details` Edge Function (not hardcoded in frontend).
- Buyer uploads transfer receipt via `confirm-bank-transfer` Edge Function.
- **No bank transfer behavior changed in this phase.**

### COD Behavior

- COD creates a payment record with `pending` status.
- COD metadata (customer name, phone, amount) is stored in `orders.invoice_metadata.cod`.
- Payment is collected on delivery.
- **No COD behavior changed in this phase.**

### Legacy CMI Behavior

- `initCMIPayment` throws: "CMI لم يعد مسار دفع نشطاً"
- `verifyCMICallback` throws: "يجب تنفيذ التحقق من CMI callback داخل السيرفر فقط"
- `getCMIStatus` reads legacy payment records from DB (read-only fallback)
- `paymentGateway.processCmiPayment()` throws: "CMI is retired for marketplace checkout"
- `refundCmiPayment` still works via `refund-cmi-payment` Edge Function (for refunding historical CMI payments)
- **No CMI behavior changed in this phase.**

### Refund Behavior

- PayPal refunds via `refund-paypal-payment` Edge Function
- CMI refunds via `refund-cmi-payment` Edge Function
- COD/Bank manual refunds via `process-manual-refund` Edge Function
- Refund metadata stored in `orders.invoice_metadata` and `refunds` table (if available)
- **No refund behavior changed in this phase.**

### Edge Functions

- All Edge Functions remain unchanged and in their original locations.
- No Edge Function code modified, moved, or deleted.
- **No Edge Function behavior changed in this phase.**

---

## Current Status

- **Phase 3.2:** ✅ Foundation created as re-export layer.
- **Files created:** 9 (index.js + 7 sub-layer index.js + README.md)
- **Files moved:** 0
- **Files deleted:** 0
- **Imports changed:** 0
- **Behavior changed:** No
- **Supabase queries changed:** No
- **Edge Functions changed:** No
- **Routes changed:** No
- **PayPal behavior changed:** No
- **Bank Transfer behavior changed:** No
- **COD behavior changed:** No
- **CMI behavior changed:** No
- **Refund behavior changed:** No
- **Commission/payout behavior changed:** No
