# Phase 7.11 — Pre-Existing Test Failures Stabilization Report

**Phase:** 7.11 — Fix or Classify Known Pre-Existing Test Failures
**Date:** 2026-06-25
**Status:** ✅ Completed — 3/3 failures fixed, 183/183 tests pass, 0 pre-existing failures remain

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` was read in full (614 lines) and strictly followed throughout this phase.

Key rules respected:
- ✅ Only test files were modified — no production code changed
- ✅ No files moved, no stubs deleted, no services refactored
- ✅ No payment/checkout/order business logic changes
- ✅ No Supabase query, Edge Function call, React Query key, database/RLS, or route changes
- ✅ No circular dependencies (verified — 714 files, 0 circular)
- ✅ No `any`, `@ts-ignore`, `@ts-expect-error`
- ✅ Test expectations updated only with justification from source inspection
- ✅ No tests were weakened — all fixes make tests more accurate or more robust

---

## 2. Confirmation: This Phase Targeted Only Pre-Existing Test Failures

✅ Only 3 test files were modified. No production code was changed. No files were moved or deleted.

---

## 3. Failures Investigated

### Failure 1: `paymentGateway.test.js:177` — `mockSupabase.from` call count

**File:** `src/services/__tests__/paymentGateway.test.js:177`
**Test:** `createPaymentIntent uses cache for same input key`
**Failing since:** Phase 7.5

**Before fix:**
```
Expected number of calls: 1
Received number of calls: 3
```

**Root cause:**
The test called `createPaymentIntent` twice with the same params and asserted `mockSupabase.from` was called exactly once. However, `processCodPayment` (the COD path) makes 3 `supabase.from()` calls per invocation:
1. `insertPaymentRecord` → `activeClient.from('payments').insert(...)` (via `paymentRecords.js:102`)
2. `supabase.from('orders').select('invoice_metadata')` (via `paymentGateway.js:154`)
3. `supabase.from('orders').update({...})` (via `paymentGateway.js:163`)

The cache correctly prevents the second `createPaymentIntent` call from making any additional `from()` calls. The test's assertion of `toHaveBeenCalledTimes(1)` was wrong — it should have verified that the second call doesn't increase the `from()` call count, not that the total is 1.

**Fix applied:**
```js
// Before:
const first = await createPaymentIntent(params)
const second = await createPaymentIntent(params)
expect(mockSupabase.from).toHaveBeenCalledTimes(1)

// After:
const first = await createPaymentIntent(params)
const callsAfterFirst = mockSupabase.from.mock.calls.length
const second = await createPaymentIntent(params)
expect(mockSupabase.from.mock.calls.length).toBe(callsAfterFirst)
```

**Justification:** The test's intent was to verify that the cache prevents duplicate Supabase calls. The new assertion captures the call count after the first call and verifies the second (cached) call doesn't increase it. This is more robust than hardcoding a count, as it adapts to any number of internal `from()` calls.

**Production code changed:** No
**Test code changed:** Yes — `src/services/__tests__/paymentGateway.test.js:172-178`

---

### Failure 2: `paymentRecords.schema.test.js:52` — `transaction_id` expectation in CheckoutSimplified

**File:** `src/__tests__/services/paymentRecords.schema.test.js:52`
**Test:** `CheckoutSimplified.jsx still updates transaction_id on payments`
**Failing since:** Phase 7.6

**Before fix:**
```
expect(checkoutSource).toContain('transaction_id: paypalInit.orderId')
```
Expected string `transaction_id: paypalInit.orderId` not found in `CheckoutSimplified.jsx`.

**Root cause:**
`CheckoutSimplified.jsx` no longer writes `transaction_id` directly to the payments table. The current code stores the PayPal order ID as `paypalOrderId` in the pending checkout state object:
```js
// CheckoutSimplified.jsx:972-977
pendingPaypalOrder = {
  internalOrderId: primaryOrder.id,
  paypalOrderId: paypalInit.orderId,
  amount: paypalAmount,
  createdAt: new Date().toISOString(),
}
```

The `transaction_id` is written by `paymentGateway.js:104` in `processPayPalPayment`:
```js
transaction_id: paypalOrder?.orderId || null,
```

The schema test was outdated — it expected a direct `transaction_id` write in CheckoutSimplified that no longer exists. The test's intent was to verify that CheckoutSimplified properly captures the PayPal order ID from `paypalInit`, which it does via `paypalOrderId: paypalInit.orderId`.

**Fix applied:**
```js
// Before:
test('CheckoutSimplified.jsx still updates transaction_id on payments', () => {
  expect(checkoutSource).toContain('transaction_id: paypalInit.orderId')
})

// After:
test('CheckoutSimplified.jsx still captures PayPal order ID from paypalInit', () => {
  expect(checkoutSource).toContain('paypalOrderId: paypalInit.orderId')
})
```

**Justification:** The test's intent was to verify CheckoutSimplified captures the PayPal order ID. The current code does this via `paypalOrderId: paypalInit.orderId` (line 974). The `transaction_id` is now handled by the payment gateway, not the checkout page. The updated assertion matches the actual code pattern.

**Production code changed:** No
**Test code changed:** Yes — `src/__tests__/services/paymentRecords.schema.test.js:51-53`

---

### Failure 3: `orderFlow.integration.test.js:498` — Intermittent `fetchBuyerOrders` timing

**File:** `src/features/orders/__tests__/orderFlow.integration.test.js:493-499`
**Test:** `clicking filter tab refetches with new status`
**Failing since:** Phase 7.5 (intermittent)

**Before fix:**
```
Expected number of calls: 1 (after adding waitFor for toHaveBeenCalledTimes(1))
Received number of calls: 120
```

**Root cause (two issues):**

1. **Unstable `t` function reference:** The `jest.mock('react-i18next')` created a new `t` function on every render. The `OrdersPage` component has a `useCallback` (`loadOrders`) that depends on `t`. Since `t` was new on every render, `loadOrders` was recreated on every render, triggering the `useEffect` that calls `loadOrders(1)`, which called `fetchBuyerOrders`, which resolved and caused a state update, which caused a re-render, creating a new `t`... resulting in an infinite loop (120+ calls).

2. **Missing synchronization:** The original test didn't wait for the initial `fetchBuyerOrders` call to complete before clicking the filter button, making `toHaveBeenCalledTimes(2)` unreliable.

**Fix applied (two changes):**

1. Stabilized `t` function reference in mock:
```js
// Before:
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'en' },
  }),
}))

// After:
jest.mock('react-i18next', () => {
  const t = (key, fallback) => (typeof fallback === 'string' ? fallback : key)
  return {
    useTranslation: () => ({ t, i18n: { language: 'en' } }),
  }
})
```

2. Added `waitFor` for initial fetch before clicking filter:
```js
// Added before filter button query:
await waitFor(() => expect(fetchBuyerOrders).toHaveBeenCalledTimes(1))
```

**Justification:**
- The `t` function stabilization is a test-only fix that prevents the infinite re-render loop. The mock was creating a new function reference on every render, which is not how `react-i18next` works in production (the `t` function is stable across renders when the language doesn't change).
- The `waitFor` for the initial fetch ensures the mount call has completed before clicking the filter, making `toHaveBeenCalledTimes(2)` reliable.

**Production code changed:** No
**Test code changed:** Yes — `src/features/orders/__tests__/orderFlow.integration.test.js:23-28` (mock stabilization) and `:493` (waitFor addition)

---

## 4. Files Changed

| # | File | Lines Changed | Change Type | Description |
|---|---|---|---|---|
| 1 | `src/services/__tests__/paymentGateway.test.js` | 172-178 | **Test fix** | Cache test: assert call count doesn't increase instead of asserting exact count |
| 2 | `src/__tests__/services/paymentRecords.schema.test.js` | 51-53 | **Test fix** | Schema test: update assertion to match current `paypalOrderId` pattern |
| 3 | `src/features/orders/__tests__/orderFlow.integration.test.js` | 23-28, 493 | **Test fix** | Stabilize `t` mock + add waitFor for initial fetch |

**Total: 3 test files modified. 0 production files modified. 0 files moved. 0 stubs deleted.**

---

## 5. Justification for Every Test Expectation Update

### 1. `paymentGateway.test.js` — `toHaveBeenCalledTimes(1)` → `toBe(callsAfterFirst)`
- **Why:** `processCodPayment` makes 3 `from()` calls (1x payments + 2x orders), not 1. The cache correctly prevents duplicate calls on the second invocation. The old assertion was wrong about the internal call count.
- **What changed:** Instead of hardcoding `1`, we capture the count after the first call and assert the second call doesn't increase it. This verifies the cache behavior without coupling to internal implementation details.

### 2. `paymentRecords.schema.test.js` — `transaction_id: paypalInit.orderId` → `paypalOrderId: paypalInit.orderId`
- **Why:** `CheckoutSimplified.jsx` no longer writes `transaction_id` directly. It stores `paypalOrderId: paypalInit.orderId` in pending checkout state. The `transaction_id` is written by `paymentGateway.processPayPalPayment` (line 104).
- **What changed:** The assertion now checks for the actual pattern used in the current code. The test's intent (verify PayPal order ID capture) is preserved.

### 3. `orderFlow.integration.test.js` — Mock stabilization + waitFor
- **Why:** The `t` function mock created a new reference on every render, causing an infinite loop in `useCallback`/`useEffect` dependencies. The test also lacked synchronization with the initial fetch.
- **What changed:** The `t` function is now defined once outside the `useTranslation` return, making it stable. A `waitFor` was added to ensure the initial `fetchBuyerOrders` completes before clicking the filter.

---

## 6. Behavioral Confirmations

| Confirmation | Status |
|---|---|
| Payment behavior unchanged | ✅ No production code modified |
| Checkout behavior unchanged | ✅ No production code modified |
| Order behavior unchanged | ✅ No production code modified |
| Supabase queries unchanged | ✅ No production code modified |
| Edge Function calls unchanged | ✅ No production code modified |
| React Query keys unchanged | ✅ No production code modified |
| Routes unchanged | ✅ No production code modified |
| No files moved | ✅ |
| No stubs deleted | ✅ |
| No forbidden deep imports introduced | ✅ |
| No circular dependencies introduced | ✅ (714 files, 0 circular) |

---

## 7. Results: Targeted Failing Suites Before/After

### Before (Phase 7.10)

| Test Suite | Tests Passed | Tests Failed | Status |
|---|---|---|---|
| `services/__tests__/paymentGateway.test.js` | 17 | 1 | ❌ FAIL |
| `__tests__/services/paymentRecords.schema.test.js` | 4 | 1 | ❌ FAIL |
| `features/orders/__tests__/orderFlow.integration.test.js` | 35-36 | 0-1 | ⚠️ Flaky |

### After (Phase 7.11)

| Test Suite | Tests Passed | Tests Failed | Status |
|---|---|---|---|
| `services/__tests__/paymentGateway.test.js` | 18 | 0 | ✅ PASS |
| `__tests__/services/paymentRecords.schema.test.js` | 5 | 0 | ✅ PASS |
| `features/orders/__tests__/orderFlow.integration.test.js` | 36 | 0 | ✅ PASS (3/3 runs) |

---

## 8. Results: Broader Smoke Tests

| Test Suite | Tests | Result |
|---|---|---|
| `src/__tests__/services/paymentGateway.test.js` | 11 | ✅ All pass |
| `src/__tests__/services/paymentRecords.test.js` | 8 | ✅ All pass |
| `src/__tests__/supabase/codBankPayment.schema.test.js` | — | ✅ All pass |
| `src/__tests__/supabase/refundPayPal.schema.test.js` | — | ✅ All pass |
| `src/__tests__/services/checkoutService.test.js` | 18 | ✅ All pass |
| `src/features/checkout/__tests__/checkout.integration.test.js` | — | ✅ All pass |
| `src/features/marketplace/__tests__/addToCart.integration.test.js` | — | ✅ All pass |
| `src/__tests__/pages/buyerOrdersRealtime.test.jsx` | — | ✅ All pass |
| `src/features/orders/__tests__/orderFlow.integration.test.js` | 36 | ✅ All pass |
| `src/services/__tests__/paymentGateway.test.js` | 18 | ✅ All pass |
| `src/__tests__/services/paymentRecords.schema.test.js` | 5 | ✅ All pass |

**Total: 183 passed, 0 failed — ALL pre-existing failures resolved.**

---

## 9. Final Checks

| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed (exit code 0) |
| `npm run type-check` | ✅ Passed (exit code 0) |
| `npm run build` | ✅ Passed (built in 2m 44s) |
| `npm run check:circular` | ✅ Passed (714 files, 0 circular dependencies) |

---

## 10. Pre-Existing Unrelated Test Failures

**None.** All 3 pre-existing failures have been resolved in this phase. The targeted test suite now shows 183/183 passing.

---

## 11. Whether It Is Safe to Continue to Phase 7.12

**Yes.** All verification checks pass. The test suite is now clean — 183/183 tests pass with 0 pre-existing failures. The project is in a stable state for the next migration cycle.

---

## 12. Recommended Phase 7.12 Candidates

### Option A: Next service migration cycle (cmiPayment.js + refundPolicyService.js)

The payments module barrel (`src/modules/payments/api/index.js`) still re-exports from `@/services/cmiPayment` and `@/services/refundPolicyService`. These could be moved into `src/modules/payments/api/` following the same cycle:
- 7.12: Pre-movement analysis
- 7.13: Move files + create stubs
- 7.14: Consumer import adoption
- 7.15: Stub deletion

### Option B: Remaining compatibility stubs deletion cycle

7 unrelated stubs remain:
1. `src/store/cartStore.js`
2. `src/store/favoritesStore.js`
3. `src/services/coupons.js`
4. `src/services/reviewService.js`
5. `src/services/minimumOrderService.js`
6. `src/utils/cartQuantity.js`
7. `src/hooks/useCheckoutPricing.ts`

Each needs consumer search → import adoption → stub deletion.

### Option C: Broader test suite audit

Run the full test suite (not just targeted) to identify any other pre-existing failures before starting the next migration cycle.

---

## 13. Remaining Risks

### Resolved risks:
- ✅ All 3 pre-existing test failures fixed
- ✅ `orderFlow.integration.test.js` flakiness resolved (root cause: unstable mock)
- ✅ 183/183 targeted tests pass consistently
- ✅ 714 files, 0 circular dependencies

### Remaining risks for future phases:
1. **`cmiPayment.js` and `refundPolicyService.js`** still live in `src/services/` — candidates for next migration cycle
2. **7 unrelated stubs** remain — each needs its own adoption + deletion cycle
3. **Full test suite** has not been run — only targeted tests were verified in this phase
4. **`emailService.js`** imports from `@/modules/payments` — cross-service dependency through module public API (correct pattern, but should be monitored)
