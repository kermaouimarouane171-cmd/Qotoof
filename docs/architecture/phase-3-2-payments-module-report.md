# Phase 3.2 — Payments Module Foundation Report

**Phase:** 3.2 — Payments Module Foundation  
**Date:** 2026-06-22  
**Status:** ✅ Completed  
**Approach:** Additive-first, behavior-preserving re-export layer

---

## 1. Summary

Phase 3.2 creates `src/modules/payments/` as a public module layer that exposes existing payment functionality through a clean public API. This is a **re-export/wrapper layer only** — no files were moved, no behavior was changed, no imports were rewritten, and no Edge Functions were modified.

The payments module is the second module in Phase 3 (Operations Modules), following the checkout module (Phase 3.1).

---

## 2. Rules Followed

- ✅ No files moved
- ✅ No payment behavior changed
- ✅ No checkout behavior changed
- ✅ No order behavior changed
- ✅ No refund behavior changed
- ✅ No `order:payment_updated` event implemented
- ✅ No payment provider integrations changed
- ✅ No Edge Functions changed
- ✅ No routes changed
- ✅ No UI redesigned
- ✅ No mass import rewriting
- ✅ No Supabase queries changed
- ✅ No database schema or RLS changes
- ✅ No `any` types introduced
- ✅ No `@ts-ignore` or `@ts-expect-error` used
- ✅ No circular dependencies introduced
- ✅ Deprecated CMI code re-exported as legacy only (not revived)
- ✅ Lint passes
- ✅ Type-check passes
- ✅ Build succeeds
- ✅ `check:circular` = zero circular dependencies

---

## 3. Architecture — Payments Architecture Identified

### 3.1 Payment-Related Files Inspected

| File | Location | Lines | Role | Re-exported? |
|---|---|---|---|---|
| `paymentService.js` | `src/services/` | 296 | Functional API wrapper around paymentGateway | ✅ Yes (api) |
| `paymentGateway.js` | `src/services/` | 700 | Class-based gateway: PayPal, COD, Bank, CMI (retired), refunds | ✅ Yes (api) |
| `paymentRecords.js` | `src/services/` | 178 | Payment record CRUD, normalization, decoration | ✅ Yes (api) |
| `cmiPayment.js` | `src/services/` | 45 | Legacy CMI — all functions throw or read-only | ✅ Yes (api, legacy) |
| `refundPolicyService.js` | `src/services/` | 67 | Vendor refund policy CRUD | ✅ Yes (api) |
| `payment.js` (constants) | `src/constants/` | 172 | PAYMENT_METHOD, PAYMENT_STATUS, colors, labels, helpers | ✅ Yes (domain) |
| `paypalEligibility.js` | `src/utils/` | 35 | PayPal setup validation helpers | ✅ Yes (domain + utils) |
| `PaymentGuard.jsx` | `src/contexts/` | 52 | PayPal setup guard hook | ✅ Yes (ui) |
| `useCartPaymentQueries.js` | `src/hooks/queries/` | 318 | Payment query keys, hooks, mutations | ✅ Yes (hooks, payment-only exports) |
| `OrderPaymentSection.jsx` | `src/components/orders/` | 65 | Order detail payment section | ✅ Yes (ui) |
| `PaymentReceiptUpload.jsx` | `src/components/orders/` | 327 | Payment receipt upload component | ✅ Yes (ui) |
| `PaymentPolicySettings.jsx` | `src/components/vendor/` | 195 | Vendor payment policy settings | ✅ Yes (ui) |
| `RefundPolicySettings.jsx` | `src/components/vendor/` | 111 | Vendor refund policy settings | ✅ Yes (ui) |
| `DeliveryPaymentPolicy.jsx` | `src/components/driver/` | 71 | Driver delivery payment policy | ✅ Yes (ui) |
| `domains/payments/index.js` | `src/domains/payments/` | 9 | Existing domain re-exports | ✅ Yes (domain) |
| `domains/payments/commands.js` | `src/domains/payments/` | 13 | Domain commands re-export | ✅ Yes (domain) |
| `domains/payments/queries.js` | `src/domains/payments/` | 10 | Domain queries re-export | ✅ Yes (domain) |

### 3.2 Files NOT Re-exported (Belong to Other Modules)

| File | Location | Lines | Reason |
|---|---|---|---|
| `commissionService.js` | `src/services/` | 696 | Commission logic — separate financial module (Phase 4) |
| `payoutService.js` | `src/services/` | 22 | Payout logic — separate financial module (Phase 4) |
| `paymentMethodStrategy.js` | `src/services/` | 35 | Payout strategy — belongs with payouts |
| `returns.js` | `src/services/` | 362 | Return requests — primarily order/product concern |
| `PaymentStep.jsx` | `src/components/checkout/` | 93 | Checkout step component — owned by checkout module |
| `PaymentTypeSelector.jsx` | `src/components/checkout/` | 376 | Checkout step component — owned by checkout module |

### 3.3 Edge Functions (Documented, Not Modified)

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
| `send-payout` | Send vendor/driver payout | ✅ Active (payouts) |

### 3.4 Payment Records Architecture

- **Table:** `payments`
- **Columns:** `id`, `order_id`, `amount`, `payment_method`, `status`, `transaction_id`, `gateway_response`, `auth_code`, `confirmed_at`, `refund_amount`, `refund_reason`, `refunded_at`, `updated_at`, `created_at`
- **Legacy column:** `method` (deprecated, all new writes use `payment_method` only)
- **Normalization:** `normalizePaymentMethod()` handles aliases (`bank` → `bank`, `cod` → `cod`, `cash` → `cod`, `cash_on_delivery` → `cod`, etc.)
- **Decoration:** `decoratePaymentRecord()` ensures both `payment_method` and `method` fields are set on read
- **Write payload builder:** `buildPaymentWritePayload()` strips `paymentMethod` and `method` keys, normalizes `payment_method`

### 3.5 Payment Methods

| Method | ID | Active | Provider | Edge Functions |
|---|---|---|---|---|
| PayPal | `paypal` | ✅ | PayPal API | `create-paypal-order`, `capture-paypal-order`, `refund-paypal-payment`, `reconcile-paypal-payments` |
| Bank Transfer | `bank` | ✅ | Moroccan banks | `confirm-bank-transfer`, `get-bank-details` |
| COD | `cod` | ✅ | N/A (cash on delivery) | None (payment record only) |
| CMI | `cmi` | ❌ Retired | N/A | `refund-cmi-payment`, `verify-cmi-callback` (legacy only) |

---

## 4. Files Created

| File | Purpose |
|---|---|
| `src/modules/payments/index.js` | Main public API entry point |
| `src/modules/payments/api/index.js` | Re-exports paymentService, paymentGateway, paymentRecords, cmiPayment, refundPolicyService |
| `src/modules/payments/data/index.js` | Placeholder (paymentRecords.js is closest to data layer) |
| `src/modules/payments/domain/index.js` | Re-exports payment constants, PayPal eligibility, existing domains/payments |
| `src/modules/payments/ui/index.js` | Re-exports PaymentGuard, OrderPaymentSection, PaymentReceiptUpload, PaymentPolicySettings, RefundPolicySettings, DeliveryPaymentPolicy |
| `src/modules/payments/hooks/index.js` | Re-exports paymentKeys, usePaymentHistory, usePaymentDetail, useCreatePayment, useConfirmPayment |
| `src/modules/payments/stores/index.js` | Placeholder (no dedicated payment store) |
| `src/modules/payments/utils/index.js` | Re-exports paypalEligibility utilities |
| `src/modules/payments/README.md` | Comprehensive module documentation |

**Total files created:** 9  
**Total files moved:** 0  
**Total files deleted:** 0

---

## 5. Public API

### From API Layer

```js
// paymentService — functional API
createPaymentIntent, processPayPalPayment, processStripePayment,
processCMIPayment (deprecated), confirmBankTransfer,
createOrderPaymentRecord, getLatestOrderPaymentRecord,
updateOrderPaymentRecord, registerPaymentReceipt,
confirmOrderPayment, getPaymentStatus, refundPayment

// paymentGateway — singleton
paymentGateway, confirmPayment

// paymentRecords — CRUD
PAYMENT_METHOD_COLUMN, LEGACY_PAYMENT_METHOD_COLUMN,
normalizePaymentMethod, getPaymentMethodCandidates,
resolvePaymentMethod, decoratePaymentRecord,
buildPaymentWritePayload, applyPaymentMethodFilter,
insertPaymentRecord, getLatestPaymentRecordForOrder,
getPaymentRecordById, updatePaymentRecordById

// cmiPayment — legacy/deprecated
initCMIPayment, verifyCMICallback, getCMIStatus

// refundPolicyService
DEFAULT_REFUND_POLICY, getVendorRefundPolicy
```

### From Domain Layer

```js
// Payment constants
PAYMENT_METHOD, PAYMENT_METHODS, PAYMENT_STATUS,
PAYMENT_STATUS_BADGE, PAYMENT_STATUS_HEX, PAYMENT_STATUS_LABEL_AR,
getAvailablePaymentMethods, getPaymentMethodById,
getPaymentStatusBadge, getPaymentStatusColor

// PayPal eligibility
PAYPAL_REQUIRED_ROLES, hasValidPayPalEmail,
isPayPalSetupComplete, getPayPalSetupRoute,
getPayPalSetupBlockMessage, assertPayPalSetupOrThrow
```

### From UI Layer

```js
usePaymentGuard
OrderPaymentSection (default export)
PaymentReceiptUpload (default export)
PaymentPolicySettings (default export)
RefundPolicySettings (default export)
DeliveryPaymentPolicy (default export)
```

### From Hooks Layer

```js
paymentKeys, usePaymentHistory, usePaymentDetail,
useCreatePayment, useConfirmPayment
```

### From Utils Layer

```js
hasValidPayPalEmail, isPayPalSetupComplete, assertPayPalSetupOrThrow
```

---

## 6. Unchanged Behaviors

| Behavior | Status |
|---|---|
| PayPal payment processing | ✅ Unchanged |
| Bank transfer payment processing | ✅ Unchanged |
| COD payment processing | ✅ Unchanged |
| CMI legacy handling (throws on init, reads on status) | ✅ Unchanged |
| Refund processing (PayPal, CMI, manual) | ✅ Unchanged |
| Payment record CRUD | ✅ Unchanged |
| Payment status display | ✅ Unchanged |
| PaymentGuard enforcement | ✅ Unchanged |
| PayPal eligibility checks | ✅ Unchanged |
| Vendor refund policy management | ✅ Unchanged |
| Commission calculation | ✅ Unchanged (not re-exported) |
| Payout processing | ✅ Unchanged (not re-exported) |
| Return requests | ✅ Unchanged (not re-exported) |
| Edge Functions | ✅ Unchanged |
| Supabase queries | ✅ Unchanged |
| Database schema / RLS | ✅ Unchanged |
| Routes | ✅ Unchanged |
| Existing imports | ✅ Unchanged |

---

## 7. Documentation Updated

| File | Changes |
|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | Updated status line to include Phase 3.2 completion; added Phase 3.2 achievement note |
| `ARCHITECTURE_GUIDE.md` | Added Phase 3.2 completion status to progress section |
| `DEVELOPER_GUIDE.md` | Added payments module to project structure tree with sub-layer details |
| `src/modules/payments/README.md` | Created comprehensive module documentation |

---

## 8. Verification Results

| Check | Command | Result |
|---|---|---|
| Lint | `npm run lint` | ✅ Exit code 0, no errors |
| Type-check | `npm run type-check` | ✅ Exit code 0, no errors |
| Build | `npm run build` | ✅ Exit code 0, built successfully |
| Circular dependencies | `npm run check:circular` | ✅ No circular dependency found (630 files processed) |

---

## 9. Module Boundaries

### What Payments Owns

- Payment records CRUD (insert, get, update, normalize, decorate)
- Payment status constants and helpers
- Payment method constants and configuration
- PayPal service/API integration (via Edge Functions)
- Bank transfer payment support (via Edge Functions)
- COD payment support
- Refund-related payment helpers (PayPal, CMI, manual)
- Payment guard (PayPal setup enforcement)
- PayPal eligibility utilities
- Payment-related React Query hooks
- Vendor refund policy management
- Legacy CMI compatibility surface (deprecated)

### What Payments Does NOT Own

- Checkout page composition (owned by `checkout`)
- Cart state (owned by `cart`)
- Order lifecycle (owned by `orders`)
- Delivery state (owned by `delivery`)
- Commission calculation (future `commissions` module)
- Payout processing (future `payouts` module)
- Return requests (primarily `orders` concern)
- Notification delivery (owned by `notifications`)
- Auth/session (owned by `auth`)
- User profile ownership (owned by `users`)

---

## 10. Migration Candidates for Future Sprints

| File | Risk | Notes |
|---|---|---|
| `paymentService.js` | Low | 296 lines, functional wrapper |
| `paymentGateway.js` | High | 700 lines, tightly coupled to Edge Functions |
| `paymentRecords.js` | Low | 178 lines, pure CRUD |
| `cmiPayment.js` | Low | 45 lines, all throw/read-only |
| `payment.js` (constants) | Low | 172 lines, pure constants |
| `paypalEligibility.js` | Low | 35 lines, pure helpers |
| `PaymentGuard.jsx` | Low-Medium | 52 lines, uses authStore |
| `useCartPaymentQueries.js` | Medium | 318 lines, mixed cart+payment hooks |
| `refundPolicyService.js` | Low | 67 lines, vendor policy CRUD |
| `OrderPaymentSection.jsx` | Low | 65 lines |
| `PaymentReceiptUpload.jsx` | Medium | 327 lines, handles upload+notifications |
| `PaymentPolicySettings.jsx` | Low | 195 lines |
| `RefundPolicySettings.jsx` | Low | 111 lines |
| `DeliveryPaymentPolicy.jsx` | Low | 71 lines (may belong in delivery) |
| `commissionService.js` | High | 696 lines, separate module (Phase 4) |
| `payoutService.js` | Low | 22 lines, separate module (Phase 4) |
| `paymentMethodStrategy.js` | Low | 35 lines, belongs with payouts |
| `returns.js` | Medium | 362 lines, primarily order/product concern |
| `domains/payments/` | Low | 3 files, can consolidate into module |

---

## 11. Event Contract (Documented — Not Implemented)

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

This event contract is **documented only** — it will be implemented in a future phase for payments↔orders synchronization.

---

## 12. Conclusion

Phase 3.2 successfully creates the payments module foundation as a re-export layer. All existing payment functionality is now accessible through `src/modules/payments/` without any behavior changes, file moves, or import rewrites. The module provides a clean public API with clear boundaries, comprehensive documentation, and full verification (lint, type-check, build, circular dependencies all pass).
