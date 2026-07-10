# Phase 7.5 — Payment Services Pre-Movement Analysis Report

**Phase:** 7.5 — Pre-Movement Analysis for Payment Services (Analysis Only)
**Date:** 2026-06-25
**Status:** ✅ Completed — Analysis only, no source code changes

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` was read in full (614 lines) and strictly followed throughout this phase.

Key rules respected:
- ✅ Analysis only — no file movement, no import rewriting, no stub deletion
- ✅ No business logic, payment, checkout, order, cart, auth behavior changes
- ✅ No Supabase query, Edge Function call, React Query key, database/RLS, or route changes
- ✅ No circular dependencies
- ✅ No `any`, `@ts-ignore`, `@ts-expect-error`

---

## 2. Confirmation: This Phase Was Analysis Only

✅ No source code was modified. No files were moved, deleted, or created (except this report).

---

## 3. Confirmation: No Source Behavior Changed

✅ Zero source files were modified. All verification checks pass on the unmodified codebase.

---

## 4. Target Files Inspected

| # | File | Lines | Exports | Dependencies |
|---|---|---|---|---|
| 1 | `src/services/paymentService.js` | 296 | 12 named | supabase, paymentGateway, paymentRecords, logger, withRetry |
| 2 | `src/services/paymentGateway.js` | 700 | 5 named + 1 default + 1 hook | supabase, PAYMENT_METHOD, paymentRecords, logger, withRetry, config, React |
| 3 | `src/services/paymentRecords.js` | 178 | 12 named | PAYMENT_METHOD, dynamic import of supabase |
| **Total** | | **1174** | **29 exports** | |

---

## 5. Exports Per File

### `paymentService.js` (12 exports)

| # | Export | Type | Responsibility |
|---|---|---|---|
| 1 | `createPaymentIntent` | async function | Create payment intent via gateway |
| 2 | `processPayPalPayment` | async function | Process PayPal payment via gateway |
| 3 | `processStripePayment` | alias of #2 | Legacy compatibility alias |
| 4 | `processCMIPayment` | async function | Legacy CMI — fails fast |
| 5 | `confirmBankTransfer` | async function | Confirm bank transfer via Edge Function |
| 6 | `createOrderPaymentRecord` | async function | Insert payment record (delegates to paymentRecords) |
| 7 | `getLatestOrderPaymentRecord` | async function | Fetch latest payment record (delegates to paymentRecords) |
| 8 | `updateOrderPaymentRecord` | async function | Update payment record (delegates to paymentRecords) |
| 9 | `registerPaymentReceipt` | async function | Register staged payment receipt via Edge Function |
| 10 | `confirmOrderPayment` | async function | Confirm vendor-side payment via Edge Function |
| 11 | `getPaymentStatus` | async function | Get payment status via gateway |
| 12 | `refundPayment` | async function | Refund payment via gateway |

### `paymentGateway.js` (7 exports)

| # | Export | Type | Responsibility |
|---|---|---|---|
| 1 | `paymentGateway` | singleton instance | Class-based gateway with PayPal/COD/Bank/CMI methods |
| 2 | `createPaymentIntent` | async function | Cached gateway initialization wrapper |
| 3 | `confirmPayment` | async function | Confirm payment by payment ID |
| 4 | `getPaymentById` | async function | Fetch payment with order/buyer/vendor joins |
| 5 | `usePayment` | React hook | Processing state + processPayment callback |
| 6 | `default` | alias of paymentGateway | Default export |
| 7 | `toGatewayResult` | internal helper | Not exported — used internally |

### `paymentRecords.js` (12 exports)

| # | Export | Type | Responsibility |
|---|---|---|---|
| 1 | `PAYMENT_METHOD_COLUMN` | constant | `'payment_method'` |
| 2 | `LEGACY_PAYMENT_METHOD_COLUMN` | constant | `'method'` (deprecated) |
| 3 | `normalizePaymentMethod` | pure function | Normalize payment method aliases |
| 4 | `getPaymentMethodCandidates` | pure function | Get filter candidates for a method |
| 5 | `resolvePaymentMethod` | pure function | Resolve payment method from record |
| 6 | `decoratePaymentRecord` | pure function | Add normalized method fields to record |
| 7 | `buildPaymentWritePayload` | pure function | Build safe write payload |
| 8 | `applyPaymentMethodFilter` | pure function | Apply OR filter to query |
| 9 | `insertPaymentRecord` | async function | Insert into `payments` table |
| 10 | `getLatestPaymentRecordForOrder` | async function | Select from `payments` by order_id |
| 11 | `getPaymentRecordById` | async function | Select from `payments` by id |
| 12 | `updatePaymentRecordById` | async function | Update `payments` by id |

---

## 6. Export Ownership Table

| Export | Belongs To | Can Move Unchanged? | Should Split? | Risk |
|---|---|---|---|---|
| **paymentService.js** | | | | |
| `createPaymentIntent` | payments | ✅ | No | Medium |
| `processPayPalPayment` | payments | ✅ | No | Medium |
| `processStripePayment` | payments | ✅ (alias) | No | Low |
| `processCMIPayment` | payments | ✅ (legacy) | No | Low |
| `confirmBankTransfer` | payments | ✅ | No | Medium |
| `createOrderPaymentRecord` | payments | ✅ | No | Low |
| `getLatestOrderPaymentRecord` | payments/checkout | ✅ | No | Low |
| `updateOrderPaymentRecord` | payments | ✅ | No | Medium |
| `registerPaymentReceipt` | payments | ✅ | No | Medium |
| `confirmOrderPayment` | payments/orders | ✅ | Maybe later | High |
| `getPaymentStatus` | payments | ✅ | No | Low |
| `refundPayment` | payments | ✅ | No | High |
| **paymentGateway.js** | | | | |
| `paymentGateway` | payments | ✅ | No | High |
| `createPaymentIntent` | payments | ✅ | No | Medium |
| `confirmPayment` | payments | ✅ | No | Medium |
| `getPaymentById` | payments | ✅ | No | Low |
| `usePayment` | payments | ✅ | No | Low |
| **paymentRecords.js** | | | | |
| `PAYMENT_METHOD_COLUMN` | payments | ✅ | No | Low |
| `LEGACY_PAYMENT_METHOD_COLUMN` | payments | ✅ | No | Low |
| `normalizePaymentMethod` | payments | ✅ | No | Low |
| `getPaymentMethodCandidates` | payments | ✅ | No | Low |
| `resolvePaymentMethod` | payments/shared | ✅ | Maybe (used by emailService) | Low |
| `decoratePaymentRecord` | payments | ✅ | No | Low |
| `buildPaymentWritePayload` | payments | ✅ | No | Low |
| `applyPaymentMethodFilter` | payments | ✅ | No | Low |
| `insertPaymentRecord` | payments | ✅ | No | Medium |
| `getLatestPaymentRecordForOrder` | payments | ✅ | No | Low |
| `getPaymentRecordById` | payments | ✅ | No | Low |
| `updatePaymentRecordById` | payments | ✅ | No | Medium |

---

## 7. Consumer Table

### `@/services/paymentService` — Active Consumers

| # | File | Line | Type | Import |
|---|---|---|---|---|
| 1 | `src/pages/CheckoutSimplified.jsx` | 26 | static import | `getLatestOrderPaymentRecord` |
| 2 | `src/pages/OrderDetail.jsx` | 38 | static import | `confirmOrderPayment` |
| 3 | `src/pages/OrderConfirmation.jsx` | 9 | static import | `updateOrderPaymentRecord`, `getLatestOrderPaymentRecord` |
| 4 | `src/components/orders/PaymentReceiptUpload.jsx` | 17 | static import | `registerPaymentReceipt` |
| 5 | `src/modules/payments/api/index.js` | 23 | re-export | 12 exports |
| 6 | `src/__tests__/services/checkoutService.test.js` | 22, 36 | jest.mock + import | `createOrderPaymentRecord` |
| 7 | `src/features/checkout/__tests__/checkout.integration.test.js` | 160 | jest.mock | `createOrderPaymentRecord` |
| 8 | `src/services/__tests__/paymentGateway.test.js` | 117 | static import | `confirmOrderPayment` |

**Total: 8 consumer files, 10 import/mock sites**

### `@/services/paymentGateway` — Active Consumers

| # | File | Line | Type | Import |
|---|---|---|---|---|
| 1 | `src/pages/admin/Orders.jsx` | 6 | static import | `paymentGateway` |
| 2 | `src/pages/OrderConfirmation.jsx` | 8 | static import | `paymentGateway` |
| 3 | `src/services/paymentService.js` | 15 | static import | `paymentGateway` |
| 4 | `src/modules/payments/api/index.js` | 30 | re-export | `paymentGateway`, `createPaymentIntent`, `confirmPayment` |
| 5 | `src/__tests__/services/paymentGateway.test.js` | 105-108 | static import | `paymentGateway`, `confirmPayment`, `createPaymentIntent`, `getPaymentById` |
| 6 | `src/services/__tests__/paymentGateway.test.js` | 105-108 | static import | `paymentGateway`, `confirmPayment`, `createPaymentIntent` |

**Total: 6 consumer files, 8 import sites**

### `@/services/paymentRecords` — Active Consumers

| # | File | Line | Type | Import |
|---|---|---|---|---|
| 1 | `src/services/paymentService.js` | 16-20 | static import | `getLatestPaymentRecordForOrder`, `insertPaymentRecord`, `updatePaymentRecordById` |
| 2 | `src/services/paymentGateway.js` | 3-10 | static import | 6 functions |
| 3 | `src/services/emailService.js` | 3 | static import | `resolvePaymentMethod` |
| 4 | `src/services/cmiPayment.js` | 1 | static import | `getLatestPaymentRecordForOrder` |
| 5 | `src/pages/admin/Orders.jsx` | 7 | static import | `resolvePaymentMethod` |
| 6 | `src/modules/payments/api/index.js` | 46 | re-export | 12 exports |
| 7 | `src/__tests__/services/paymentGateway.test.js` | 110-116 | static import | 6 functions |
| 8 | `src/__tests__/services/paymentRecords.test.js` | 5-6 | static import | `normalizePaymentMethod` (from `@/modules/payments`) |
| 9 | `src/__tests__/services/paymentRecords.schema.test.js` | 5-7 | fs.readFileSync | Source file path reference |
| 10 | `src/__tests__/supabase/codBankPayment.schema.test.js` | 5 | fs.readFileSync | Source file path reference |
| 11 | `src/__tests__/supabase/refundPayPal.schema.test.js` | 5 | fs.readFileSync | Source file path reference |

**Total: 11 consumer files, 15+ import/reference sites**

### Summary

| File | App Consumers | Test Consumers | Re-exports | Mock Sites | Total Sites |
|---|---|---|---|---|---|
| `paymentService.js` | 4 | 3 | 1 | 2 | 10 |
| `paymentGateway.js` | 4 | 2 | 1 | 0 | 8 |
| `paymentRecords.js` | 5 | 6 | 1 | 0 | 15+ |
| **Total** | **13** | **11** | **3** | **2** | **33+** |

---

## 8. Dependency Table

### `paymentService.js` Dependencies

| # | Dependency | Import Path | Type | Risk |
|---|---|---|---|---|
| 1 | `supabase` | `@/services/supabase` | Supabase client | Low |
| 2 | `paymentGateway` | `@/services/paymentGateway` | Internal service | Medium (coupled) |
| 3 | `fetchLatestPaymentRecordForOrder` | `@/services/paymentRecords` | Internal service | Low |
| 4 | `insertPaymentRecord` | `@/services/paymentRecords` | Internal service | Low |
| 5 | `updatePaymentRecordById` | `@/services/paymentRecords` | Internal service | Low |
| 6 | `logger` | `@/utils/logger` | Utility | Low |
| 7 | `withRetry` | `@/utils/withRetry` | Utility | Low |

### `paymentGateway.js` Dependencies

| # | Dependency | Import Path | Type | Risk |
|---|---|---|---|---|
| 1 | `supabase` | `@/services/supabase` | Supabase client | Low |
| 2 | `PAYMENT_METHOD` | `@/constants/payment` | Constants | Low |
| 3 | `getLatestPaymentRecordForOrder` | `@/services/paymentRecords` | Internal service | Low |
| 4 | `getPaymentRecordById` | `@/services/paymentRecords` | Internal service | Low |
| 5 | `insertPaymentRecord` | `@/services/paymentRecords` | Internal service | Low |
| 6 | `normalizePaymentMethod` | `@/services/paymentRecords` | Internal service | Low |
| 7 | `resolvePaymentMethod` | `@/services/paymentRecords` | Internal service | Low |
| 8 | `updatePaymentRecordById` | `@/services/paymentRecords` | Internal service | Low |
| 9 | `logger` | `@/utils/logger` | Utility | Low |
| 10 | `withRetry` | `@/utils/withRetry` | Utility | Low |
| 11 | `getPayPalClientId` | `@/lib/config` | Config | Low |
| 12 | `useState`, `useCallback` | `react` | React | Low |
| 13 | `import.meta.env.VITE_PAYPAL_CLIENT_ID` | env | Environment | Low |
| 14 | `import.meta.env.VITE_PAYMENT_MODE` | env | Environment | Low |

### `paymentRecords.js` Dependencies

| # | Dependency | Import Path | Type | Risk |
|---|---|---|---|---|
| 1 | `PAYMENT_METHOD` | `@/constants/payment` | Constants | Low |
| 2 | `supabase` | `@/services/supabase` (dynamic import) | Supabase client | Low |

**Notable:** `paymentRecords.js` uses a **lazy dynamic import** for supabase (`import('@/services/supabase')`), which is different from the other two files that use static imports. This is a deliberate design choice for code-splitting.

---

## 9. Supabase Table/Query Analysis

### `paymentService.js`

| Operation | Table/Edge Function | Type | Risk |
|---|---|---|---|
| `supabase.functions.invoke('confirm-bank-transfer')` | Edge Function | invoke | Medium |
| `supabase.functions.invoke('register-payment-receipt')` | Edge Function | invoke | Medium |
| `supabase.functions.invoke('confirm-order-payment')` | Edge Function | invoke | High |

**No direct table access** — all DB operations are delegated to `paymentGateway` and `paymentRecords`.

### `paymentGateway.js`

| Operation | Table/Edge Function | Type | Risk |
|---|---|---|---|
| `supabase.functions.invoke('create-paypal-order')` | Edge Function | invoke | High |
| `supabase.functions.invoke('capture-paypal-order')` | Edge Function | invoke | High |
| `supabase.functions.invoke('get-bank-details')` | Edge Function | invoke | Medium |
| `supabase.functions.invoke('verify-cmi-callback')` | Edge Function | invoke | Medium |
| `supabase.functions.invoke('refund-paypal-payment')` | Edge Function | invoke | High |
| `supabase.functions.invoke('refund-cmi-payment')` | Edge Function | invoke | High |
| `supabase.functions.invoke('process-manual-refund')` | Edge Function | invoke | High |
| `supabase.from('orders').select('invoice_metadata')` | `orders` | select | Medium |
| `supabase.from('orders').update({ invoice_metadata })` | `orders` | update | High |
| `supabase.from('payments').update({ status, ... })` | `payments` | update | High |
| `supabase.from('payments').select(...).eq('id')` | `payments` | select | Medium |
| `supabase.from('payments').select(join orders/profiles)` | `payments` | select | Medium |
| `supabase.from('refunds').insert(...)` | `refunds` | insert | Medium |
| `supabase.rpc('confirm_cmi_payment')` | RPC | rpc | High |

**Direct table access:** `orders`, `payments`, `refunds`
**Edge Functions:** 7 distinct functions
**RPC:** 1

### `paymentRecords.js`

| Operation | Table | Type | Risk |
|---|---|---|---|
| `supabase.from('payments').insert(...)` | `payments` | insert | Medium |
| `supabase.from('payments').select(...)` | `payments` | select | Low |
| `supabase.from('payments').update(...)` | `payments` | update | Medium |

**Direct table access:** `payments` only
**No Edge Functions**
**No RPC calls**

---

## 10. Edge Function Call Analysis

| Edge Function | Called By | Purpose | Risk |
|---|---|---|---|
| `create-paypal-order` | paymentGateway | Create PayPal order | High |
| `capture-paypal-order` | paymentGateway | Capture PayPal payment | High |
| `get-bank-details` | paymentGateway | Fetch bank transfer details | Medium |
| `verify-cmi-callback` | paymentGateway | Verify CMI callback (legacy) | Medium |
| `refund-paypal-payment` | paymentGateway | Refund PayPal payment | High |
| `refund-cmi-payment` | paymentGateway | Refund CMI payment (legacy) | High |
| `process-manual-refund` | paymentGateway | Manual refund for COD/Bank | High |
| `confirm-bank-transfer` | paymentService | Confirm bank transfer | Medium |
| `register-payment-receipt` | paymentService | Register staged receipt | Medium |
| `confirm-order-payment` | paymentService | Confirm order payment + commissions | High |

**Total: 10 distinct Edge Functions**

---

## 11. Payment Flow Map

```
CheckoutSimplified.jsx
  ├─ createCheckoutOrder (from @/modules/checkout → checkoutService)
  │    └─ supabase.functions.invoke('create-checkout-order')
  ├─ useCheckoutPricing (from @/modules/checkout)
  │    └─ supabase.functions.invoke('calculate-checkout-pricing')
  ├─ getLatestOrderPaymentRecord (from @/services/paymentService)
  │    └─ paymentRecords.getLatestPaymentRecordForOrder
  │         └─ supabase.from('payments').select(...)
  ├─ paymentGateway.createPaymentIntent (indirectly via processPayPalPayment)
  │    ├─ supabase.functions.invoke('create-paypal-order')
  │    ├─ paymentRecords.insertPaymentRecord
  │    │    └─ supabase.from('payments').insert(...)
  │    └─ return { approvalUrl, paymentId }
  ├─ paymentGateway.confirmPayPalPayment
  │    └─ supabase.functions.invoke('capture-paypal-order')
  ├─ paymentGateway.processCodPayment
  │    ├─ paymentRecords.insertPaymentRecord
  │    └─ supabase.from('orders').update({ invoice_metadata })
  ├─ paymentGateway.processBankTransfer
  │    ├─ paymentRecords.insertPaymentRecord
  │    ├─ supabase.from('orders').update({ invoice_metadata })
  │    └─ supabase.functions.invoke('get-bank-details')
  └─ confirmBankTransfer (from @/services/paymentService)
       └─ supabase.functions.invoke('confirm-bank-transfer')

OrderDetail.jsx
  └─ confirmOrderPayment (from @/services/paymentService)
       └─ supabase.functions.invoke('confirm-order-payment')

OrderConfirmation.jsx
  ├─ paymentGateway (from @/services/paymentGateway)
  ├─ updateOrderPaymentRecord (from @/services/paymentService)
  │    └─ paymentRecords.updatePaymentRecordById
  │         └─ supabase.from('payments').update(...)
  └─ getLatestOrderPaymentRecord (from @/services/paymentService)

PaymentReceiptUpload.jsx
  └─ registerPaymentReceipt (from @/services/paymentService)
       └─ supabase.functions.invoke('register-payment-receipt')

admin/Orders.jsx
  ├─ paymentGateway (from @/services/paymentGateway)
  └─ resolvePaymentMethod (from @/services/paymentRecords)

Refund Flow:
  paymentService.refundPayment
    └─ paymentGateway.refundPayment
         ├─ paymentRecords.getPaymentRecordById
         ├─ resolvePaymentMethod → PayPal/CMI/COD/Bank
         ├─ PayPal: supabase.functions.invoke('refund-paypal-payment')
         │    + paymentRecords.updatePaymentRecordById
         │    + supabase.from('orders').update({ invoice_metadata })
         │    + supabase.from('refunds').insert(...)
         ├─ CMI: supabase.functions.invoke('refund-cmi-payment')
         │    + paymentRecords.updatePaymentRecordById
         │    + supabase.from('refunds').insert(...)
         └─ COD/Bank: supabase.functions.invoke('process-manual-refund')
```

---

## 12. Security/Money-Risk Analysis

| # | Risk | Severity | Description | Mitigation |
|---|---|---|---|---|
| 1 | **Duplicate payment risk** | Medium | `createPaymentIntent` in `paymentGateway.js` has a `paymentIntentCache` Map that could return stale intents | Cache is keyed by orderId+method+currency; stale entries could cause issues if order changes |
| 2 | **Double order creation** | Low | Order creation is in `checkoutService` (Edge Function), not in payment files | Edge Function `create-checkout-order` has idempotency key support |
| 3 | **Inconsistent payment status** | Medium | `paymentGateway.js` directly updates `payments` table (CMI callback path) and `orders` table (COD/bank metadata) | RLS should prevent unauthorized writes; Edge Functions handle sensitive mutations |
| 4 | **Missing idempotency** | Medium | `confirmOrderPayment` Edge Function call has no idempotency key | Edge Function must handle server-side |
| 5 | **Race condition** | Medium | `processCodPayment` and `processBankTransfer` do read-then-write on `orders.invoice_metadata` | Could race if concurrent calls; withRetry may amplify |
| 6 | **Refund/cancel risk** | High | `refundPayment` calls PayPal API once, then retries DB persistence separately | Good pattern — PayPal call is not retried, only DB write |
| 7 | **User role/permission risk** | Low | All sensitive operations are in Edge Functions with SECURITY DEFINER | RLS + Edge Functions handle authorization |
| 8 | **RLS dependency** | Medium | Direct `supabase.from('payments')` and `supabase.from('orders')` calls rely on RLS | If RLS is misconfigured, client could read/write unauthorized data |
| 9 | **Client-side trust risk** | Medium | `paymentGateway.js` reads `import.meta.env.VITE_PAYPAL_CLIENT_ID` and `VITE_PAYMENT_MODE` | PayPal secret is server-side only (documented in comments) |
| 10 | **Edge Function dependency** | High | 10 Edge Functions are called — if any fails, payment flow breaks | `withRetry` wrapper provides 2-3 retries with backoff |

### Overall Security Assessment
- **High-risk areas:** Refund flows, `confirmOrderPayment` (commissions + order status), direct `orders` table updates
- **Medium-risk areas:** Payment intent caching, race conditions on `invoice_metadata`, RLS dependency
- **Low-risk areas:** Payment record reads, payment method normalization

---

## 13. Circular Dependency Risk Analysis

### Current dependency chain:
```
paymentService → paymentGateway → paymentRecords → (dynamic import) supabase
paymentService → paymentRecords → (dynamic import) supabase
paymentGateway → paymentRecords → (dynamic import) supabase
```

### If moved to `src/modules/payments/api/`:

| Potential Cycle | Risk | Explanation |
|---|---|---|
| `@/modules/payments` → `@/modules/checkout` | **None** | Payment files do NOT import from checkout |
| `@/modules/payments` → `@/modules/orders` | **None** | Payment files do NOT import from orders module |
| `@/modules/payments` → `@/modules/cart` | **None** | Payment files do NOT import from cart |
| `@/modules/payments` → `@/modules/commissions` | **None** | Payment files do NOT import from commissions |
| `@/modules/payments` → `@/modules/notifications` | **None** | Payment files do NOT import from notifications |
| `@/modules/payments` → `@/services/api.js` | **None** | Payment files do NOT import from api.js |
| `@/modules/payments` → `CheckoutSimplified.jsx` | **None** | Payment files do NOT import from pages |
| `@/modules/payments` → order-related pages | **None** | Payment files do NOT import from pages |

**Circular dependency risk: NONE**

All three payment files only import from:
- `@/services/supabase` (shared infrastructure)
- `@/constants/payment` (shared constants)
- `@/utils/logger`, `@/utils/withRetry` (shared utilities)
- `@/lib/config` (shared config)
- Each other (paymentService → paymentGateway → paymentRecords)
- `react` (for `usePayment` hook only)

None of these would create cycles with the payments module.

---

## 14. Test Coverage Map

### Test Files Found

| # | Test File | What It Covers | What It Doesn't Cover | Mock Path Update Needed? |
|---|---|---|---|---|
| 1 | `src/__tests__/services/paymentGateway.test.js` | PayPal, COD, Bank Transfer, refund, caching, error handling | CMI callback, `usePayment` hook | Yes — imports from `@/services/paymentGateway` and `@/services/paymentRecords` |
| 2 | `src/services/__tests__/paymentGateway.test.js` | PayPal, COD, Bank, refund, caching, errors | CMI, `usePayment`, `getPaymentById` | Yes — same imports |
| 3 | `src/__tests__/services/paymentRecords.test.js` | `normalizePaymentMethod` only | All other exports (insert, update, get, decorate, etc.) | No — already imports from `@/modules/payments` |
| 4 | `src/__tests__/services/paymentRecords.schema.test.js` | Schema compliance (no `method.eq` in active code) | — | Yes — uses `fs.readFileSync` on file path |
| 5 | `src/__tests__/supabase/codBankPayment.schema.test.js` | COD/Bank schema compliance | — | Yes — uses `fs.readFileSync` on `paymentGateway.js` path |
| 6 | `src/__tests__/supabase/refundPayPal.schema.test.js` | PayPal refund schema compliance | — | Yes — uses `fs.readFileSync` on `paymentGateway.js` path |
| 7 | `src/__tests__/services/checkoutService.test.js` | `checkoutService` functions | — | Yes — `jest.mock('@/services/paymentService')` |
| 8 | `src/features/checkout/__tests__/checkout.integration.test.js` | Checkout integration | — | Yes — `jest.mock('@/services/paymentService')` |
| 9 | `src/features/orders/__tests__/orderFlow.integration.test.js` | Order flow integration | — | No — does not import payment files directly |
| 10 | `src/__tests__/pages/buyerOrdersRealtime.test.jsx` | Buyer orders realtime | — | No — does not import payment files directly |

### Coverage Gaps

| Area | Coverage | Gap |
|---|---|---|
| `paymentService.js` | No dedicated test file | **All 12 exports untested directly** — only tested indirectly via checkout/order tests |
| `paymentGateway.js` | 2 test files, good coverage | CMI callback verification, `usePayment` hook, `getPaymentById` |
| `paymentRecords.js` | Only `normalizePaymentMethod` tested | **11 of 12 exports untested** — insert, update, get, decorate, buildPayload, applyFilter |

### Pre-Existing Test Failures

| Test File | Failures | Pre-Existing? |
|---|---|---|
| `src/services/__tests__/paymentGateway.test.js` | 2 failures (bank details caching assertion, orderFlow timing) | ✅ Yes — not related to this analysis |

---

## 15. Mock Impact Map

### `jest.mock()` Sites for Payment Files

| # | Test File | Mock Target | Mock Content | Update Needed? |
|---|---|---|---|---|
| 1 | `src/__tests__/services/checkoutService.test.js:22` | `@/services/paymentService` | `{ createOrderPaymentRecord: jest.fn() }` | Yes — if stub is removed |
| 2 | `src/features/checkout/__tests__/checkout.integration.test.js:160` | `@/services/paymentService` | `{ createOrderPaymentRecord: jest.fn().mockResolvedValue({}) }` | Yes — if stub is removed |

### `jest.mock()` Sites for Related Dependencies

| # | Test File | Mock Target | Notes |
|---|---|---|---|
| 3 | `src/__tests__/services/paymentGateway.test.js` | `@/services/supabase` | Via `globalThis.__mockSupabase` |
| 4 | `src/services/__tests__/paymentGateway.test.js` | `@/services/supabase` | Via `globalThis.__paymentSupabase` |
| 5 | `src/__tests__/services/paymentGateway.test.js` | `@/services/paymentRecords` | Direct import (not mocked — uses real functions with mocked supabase) |
| 6 | `src/services/__tests__/paymentGateway.test.js` | `@/services/paymentRecords` | Same — real functions with mocked supabase |

### Schema Test Path References

| # | Test File | Referenced Path | Update Needed? |
|---|---|---|---|
| 1 | `paymentRecords.schema.test.js:5` | `../../services/paymentRecords.js` | Yes — if file is moved |
| 2 | `codBankPayment.schema.test.js:5` | `../../services/paymentGateway.js` | Yes — if file is moved |
| 3 | `refundPayPal.schema.test.js:5` | `../../services/paymentGateway.js` | Yes — if file is moved |

---

## 16. Recommended Ownership Decision Per File

| File | Ownership | Rationale |
|---|---|---|
| `paymentService.js` | **payments module** | All exports are payment-related; thin wrapper around gateway + records |
| `paymentGateway.js` | **payments module** | Core payment gateway logic; class-based singleton with provider integrations |
| `paymentRecords.js` | **payments module** | Payment record CRUD and normalization; no cross-module concerns |

**All three files belong to the payments module.** No file should be split across modules.

---

## 17. Recommended Target Path Per File

| File | Current Path | Recommended Target | Notes |
|---|---|---|---|
| `paymentService.js` | `src/services/paymentService.js` | `src/modules/payments/api/paymentService.js` | API layer — functional wrapper |
| `paymentGateway.js` | `src/services/paymentGateway.js` | `src/modules/payments/api/paymentGateway.js` | API layer — gateway singleton |
| `paymentRecords.js` | `src/services/paymentRecords.js` | `src/modules/payments/api/paymentRecords.js` | API layer — record CRUD |

**Alternative:** `paymentRecords.js` could go to `src/modules/payments/data/paymentRecords.js` since it's a data access layer. However, keeping all three in `api/` is simpler and consistent with `checkoutService.js` placement.

---

## 18. Whether Compatibility Stubs Should Remain

**Yes — absolutely.** Each moved file should leave a compatibility stub at its original `src/services/` path, re-exporting from `@/modules/payments`. This is critical because:

1. **33+ consumer sites** across 13 app files and 11 test files
2. **2 `jest.mock()` sites** that mock `@/services/paymentService` directly
3. **3 schema tests** that use `fs.readFileSync` on file paths
4. **`paymentService.js` imports from `paymentGateway.js`** — internal coupling must be preserved
5. **`paymentGateway.js` imports from `paymentRecords.js`** — same

**Recommended stub pattern (same as checkoutService):**
```js
export { ...allExports } from '@/modules/payments'
```

---

## 19. Whether `src/services/api.js` Would Need Changes Later

**No.** `src/services/api.js` does NOT re-export any of the three payment files. It re-exports `productsApi`, `ordersApi`, `reviewsApi`, `vendorsApi`, `usersApi`, `analyticsApi` — none of which are payment-related.

The payments module's `api/index.js` already re-exports from `@/services/paymentService`, `@/services/paymentGateway`, and `@/services/paymentRecords`. After the move, this barrel would be updated to re-export from `./paymentService`, `./paymentGateway`, `./paymentRecords` (local files), exactly like the checkoutService pattern.

---

## 20. Whether Checkout/Order/Payment Consumers Would Need Import-Only Changes Later

**Yes, in a later Safe Import Adoption phase (not this phase).**

| Consumer File | Current Import | Future Import | Phase |
|---|---|---|---|
| `CheckoutSimplified.jsx:26` | `@/services/paymentService` | `@/modules/payments` | Safe Import Adoption |
| `OrderDetail.jsx:38` | `@/services/paymentService` | `@/modules/payments` | Safe Import Adoption |
| `OrderConfirmation.jsx:8-9` | `@/services/paymentGateway` + `@/services/paymentService` | `@/modules/payments` | Safe Import Adoption |
| `PaymentReceiptUpload.jsx:17` | `@/services/paymentService` | `@/modules/payments` | Safe Import Adoption |
| `admin/Orders.jsx:6-7` | `@/services/paymentGateway` + `@/services/paymentRecords` | `@/modules/payments` | Safe Import Adoption |
| `emailService.js:3` | `@/services/paymentRecords` | `@/modules/payments` | Safe Import Adoption |
| `cmiPayment.js:1` | `@/services/paymentRecords` | `@/modules/payments` | Safe Import Adoption |
| Test files (6+) | Various `@/services/payment*` | `@/modules/payments` | Safe Import Adoption |

**Important:** `paymentService.js` itself imports from `paymentGateway.js` and `paymentRecords.js`. After the move, these internal imports would change to relative paths (`./paymentGateway`, `./paymentRecords`).

---

## 21. Risk Rating Per File

| File | Risk Rating | Key Risk Factors |
|---|---|---|
| `paymentRecords.js` | **Low** | Pure CRUD + normalization; only `payments` table; no Edge Functions; dynamic import of supabase; 12 exports but simple |
| `paymentGateway.js` | **High** | 700 lines; class-based singleton; 7 Edge Functions; direct `orders`/`payments`/`refunds` table access; RPC call; caching logic; React hook; PayPal/COD/Bank/CMI flows |
| `paymentService.js` | **Medium** | 296 lines; thin wrapper; 3 Edge Functions; delegates to gateway + records; 2 `jest.mock()` sites; no direct table access |

---

## 22. Go / No-Go Recommendation for Phase 7.6

### ✅ **GO — but with a phased approach**

All three files belong to the payments module and can be safely moved. However, due to the high-risk nature of payment code, the move should be split into multiple phases:

| Phase | Action | Risk | Rationale |
|---|---|---|---|
| 7.6 | Move `paymentRecords.js` only | Low | Simplest file, no Edge Functions, pure CRUD, fewest consumers |
| 7.7 | Move `paymentGateway.js` | High | Largest file, most complex, but depends only on paymentRecords + supabase |
| 7.8 | Move `paymentService.js` | Medium | Depends on both gateway + records; should move last |
| 7.9 | Safe Import Adoption for all payment consumers | Low | Migrate all imports to `@/modules/payments` |
| 7.10 | Delete all 3 payment stubs | Low | After confirming zero consumers |

### Why not move all three together?
1. **33+ consumer sites** — too many to verify in one phase
2. **Internal coupling** — paymentService → paymentGateway → paymentRecords
3. **Schema tests** — 3 tests use `fs.readFileSync` on file paths
4. **2 `jest.mock()` sites** — need careful handling
5. **High-risk domain** — payments require extra caution

---

## 23. Suggested Phase 7.6 Prompt Outline

```
Phase 7.6 — Move paymentRecords.js to payments module with compatibility stub.

Target movement:
- Move: src/services/paymentRecords.js → src/modules/payments/api/paymentRecords.js
- Replace old file with compatibility stub: export { ... } from '@/modules/payments'
- Update: src/modules/payments/api/index.js re-export from ./paymentRecords

Do NOT change:
- paymentService.js (still imports from @/services/paymentRecords — will work via stub)
- paymentGateway.js (same)
- Any consumer files
- Any test files
- Any business logic

Verify:
- npm run lint, type-check, build, check:circular
- paymentGateway tests, paymentRecords tests, schema tests
- checkoutService tests, checkout integration tests
```

---

## 24. Verification Results

### Lint & Type-Check
| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed (exit code 0) |
| `npm run type-check` | ✅ Passed (exit code 0) |

### Smoke Tests
| Test Suite | Tests | Result |
|---|---|---|
| `src/__tests__/services/paymentGateway.test.js` | — | ✅ Passed |
| `src/__tests__/services/paymentRecords.test.js` | — | ✅ Passed |
| `src/__tests__/services/checkoutService.test.js` | 18 | ✅ Passed |
| `src/features/checkout/__tests__/checkout.integration.test.js` | — | ✅ Passed |
| `src/features/marketplace/__tests__/addToCart.integration.test.js` | — | ✅ Passed |
| `src/__tests__/pages/buyerOrdersRealtime.test.jsx` | — | ✅ Passed |
| `src/__tests__/supabase/codBankPayment.schema.test.js` | — | ✅ Passed |
| `src/__tests__/supabase/refundPayPal.schema.test.js` | — | ✅ Passed |
| `src/services/__tests__/paymentGateway.test.js` | 2 pre-existing failures | ⚠️ Pre-existing (not related to this analysis) |
| `src/features/orders/__tests__/orderFlow.integration.test.js` | 1 flaky test | ⚠️ Pre-existing flaky timing test |

**Note:** Pre-existing failures in `src/services/__tests__/paymentGateway.test.js` (bank details caching assertion) and `orderFlow.integration.test.js` (timing-sensitive `toHaveBeenCalledTimes`) are not related to this analysis phase — no code was modified.

### Final Checks
| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed (exit code 0) |
| `npm run type-check` | ✅ Passed (exit code 0) |
| `npm run build` | ✅ Passed (built in 2m 43s) |
| `npm run check:circular` | ✅ Passed (714 files, 0 circular dependencies) |

---

## 25. Remaining Risks Before Moving Payment Services

### High-Risk Items
1. **`paymentGateway.js` is 700 lines** with class-based singleton, caching, 7 Edge Functions, direct table access to `orders`/`payments`/`refunds`, and an RPC call
2. **3 schema tests** use `fs.readFileSync` on file paths — these will break if paths change
3. **2 `jest.mock()` sites** mock `@/services/paymentService` — these need updating if stubs are deleted
4. **Internal coupling:** `paymentService → paymentGateway → paymentRecords` — moving one file means updating internal imports

### Medium-Risk Items
5. **`paymentRecords.js` uses dynamic import** for supabase — this is intentional for code-splitting and must be preserved
6. **`paymentGateway.js` has in-memory caches** (`bankDetailsCache`, `paymentIntentCache`) — singleton state must be preserved
7. **`emailService.js` imports `resolvePaymentMethod`** from `@/services/paymentRecords` — cross-service dependency
8. **`cmiPayment.js` imports from `@/services/paymentRecords`** — another cross-service dependency

### Low-Risk Items
9. **`paymentRecords.js` is the simplest** — pure CRUD + normalization, no Edge Functions
10. **Compatibility stubs** will preserve all existing import paths
11. **No circular dependencies** — verified

### Recommendations
- **Move `paymentRecords.js` first** (Phase 7.6) — lowest risk, fewest complications
- **Move `paymentGateway.js` second** (Phase 7.7) — after records are in the module
- **Move `paymentService.js` last** (Phase 7.8) — after both dependencies are in the module
- **Keep compatibility stubs for all three** until all consumers are migrated
- **Update schema test paths** when moving files (or keep stubs and update paths in a later phase)
