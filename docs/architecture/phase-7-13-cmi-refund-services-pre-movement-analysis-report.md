# Phase 7.13 — CMI & Refund Services Pre-Movement Analysis Report

**Phase:** 7.13 — Pre-Movement Analysis for `cmiPayment.js` and `refundPolicyService.js`
**Date:** 2026-06-25
**Status:** ✅ Analysis Complete — No code changed, no files moved

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` was read in full (614 lines) and strictly followed throughout this phase.

Key rules respected:
- ✅ Analysis only — no files moved, no imports rewritten, no stubs deleted
- ✅ No production code changed
- ✅ No payment/CMI/refund/checkout/order behavior changes
- ✅ No Supabase query, Edge Function call, React Query key, database/RLS, or route changes
- ✅ No circular dependencies (verified — 714 files, 0 circular)
- ✅ No `any`, `@ts-ignore`, `@ts-expect-error`

---

## 2. Confirmation: This Phase Was Analysis Only

✅ No source behavior changed. No files moved. No imports rewritten. No stubs deleted. No production code modified.

---

## 3. Target Files Inspected

| # | File | Lines | Exports | Status |
|---|---|---|---|---|
| 1 | `src/services/cmiPayment.js` | 45 | 3 named | Legacy tombstone — CMI retired from checkout |
| 2 | `src/services/refundPolicyService.js` | 67 | 2 named + 1 default | Active — vendor refund policy CRUD |

---

## 4. File 1: `src/services/cmiPayment.js` — Full Analysis

### 4.1 Overview

CMI (Centre Monétique Interbancaire) is Morocco's national interbank payment network. CMI is **retired** from active marketplace checkout — `initCMIPayment` and `verifyCMICallback` are tombstone functions that throw errors. Only `getCMIStatus` remains functional for reading legacy payment records.

### 4.2 Export Audit

| # | Export Name | Type | Responsibility | Consumers | Belongs To | Can Move Unchanged | Risk |
|---|---|---|---|---|---|---|---|
| 1 | `initCMIPayment` | named async | Tombstone — throws "CMI retired" error | payments barrel re-export, test | payments | ✅ Yes | Low |
| 2 | `verifyCMICallback` | named async | Tombstone — throws "server-only" error | payments barrel re-export, test | payments | ✅ Yes | Low |
| 3 | `getCMIStatus` | named async | Reads latest CMI payment record from `payments` table via `getLatestPaymentRecordForOrder` | payments barrel re-export, test | payments | ✅ Yes | Low |

### 4.3 Dependency Audit

| # | Dependency | Type | Source | Notes |
|---|---|---|---|---|
| 1 | `getLatestPaymentRecordForOrder` | import | `@/modules/payments` | Already migrated — uses payments module public API |

**No other dependencies.** No direct Supabase import, no Edge Function calls, no constants, no utils.

### 4.4 Supabase & Edge Function Analysis

| # | Call Type | Table/Function | Operation | Risk |
|---|---|---|---|---|
| 1 | Indirect (via `getLatestPaymentRecordForOrder`) | `payments` | SELECT | Low — read-only, filtered by `order_id` and `payment_method='cmi'` |

**No direct Supabase calls.** No Edge Function calls. No RPC calls. No storage calls. No auth calls.

### 4.5 CMI Flow Map

```
initCMIPayment(order)
  → throws Error('CMI لم يعد مسار دفع نشطاً')
  → DEAD END (tombstone)

verifyCMICallback()
  → throws Error('يجب تنفيذ التحقق من CMI callback داخل السيرفر فقط')
  → DEAD END (tombstone)

getCMIStatus(orderId)
  → getLatestPaymentRecordForOrder({ orderId, paymentMethod: 'cmi', allowMissing: true })
  → Returns payment record or { status: 'unknown' }
```

**CMI is fully retired.** No active payment flow uses CMI. The `paymentGateway.js` has `processCmiPayment()` which also throws, and `refundCmiPayment()` which delegates to Edge Function. The `cmiWebhook.js` file in `src/services/webhooks/` is a separate legacy reference module (not imported by `cmiPayment.js`).

### 4.6 Security & Money-Risk Analysis

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Duplicate CMI payment confirmation | None | CMI is retired — `initCMIPayment` throws |
| 2 | Forged CMI callback | None | `verifyCMICallback` throws — server-side only |
| 3 | Incorrect CMI status | Low | `getCMIStatus` is read-only, uses existing `getLatestPaymentRecordForOrder` |
| 4 | Client-side trust | None | All CMI functions either throw or read-only |
| 5 | Race condition | None | No write operations |
| 6 | Missing idempotency | None | No write operations |

**Overall risk: LOW.** CMI is a legacy tombstone with no active payment flow.

### 4.7 Circular Dependency Risk

| # | Potential Cycle | Risk |
|---|---|---|
| 1 | `cmiPayment.js` → `@/modules/payments` → `./api` → `cmiPayment.js` | **YES — if moved to `src/modules/payments/api/`** |

**Critical finding:** `cmiPayment.js` imports from `@/modules/payments`, and the payments API barrel (`src/modules/payments/api/index.js`) re-exports from `@/services/cmiPayment`. If `cmiPayment.js` is moved into `src/modules/payments/api/`, the import must change from `@/modules/payments` to `./paymentRecords` (local import) to avoid a circular dependency.

### 4.8 Test Coverage

| # | Test File | Coverage | Mock Impact |
|---|---|---|---|
| 1 | `src/services/__tests__/paymentGateway.test.js:499-510` | Tests `initCMIPayment` throws, `verifyCMICallback` throws, `getCMIStatus` fallback | Imports directly from `@/services/cmiPayment` — would need path update after move |

No `fs.readFileSync` schema tests on `cmiPayment.js`.

---

## 5. File 2: `src/services/refundPolicyService.js` — Full Analysis

### 5.1 Overview

Active service for vendor refund policy management. Provides CRUD operations on the `refund_policies` Supabase table. Used by vendor Settings page and ProductDetail page.

### 5.2 Export Audit

| # | Export Name | Type | Responsibility | Consumers | Belongs To | Can Move Unchanged | Risk |
|---|---|---|---|---|---|---|---|
| 1 | `DEFAULT_REFUND_POLICY` | named const | Default refund policy values (7-day window, buyer pays shipping) | payments barrel, vendor Settings, ProductDetail | payments | ✅ Yes | Low |
| 2 | `refundPolicyService` | named object | `{ getVendorRefundPolicy, upsertVendorRefundPolicy, normalizePolicy }` | vendor Settings, ProductDetail, test | payments | ✅ Yes | Low |
| 3 | `default` (refundPolicyService) | default export | Same as #2 | vendor Settings, ProductDetail | payments | ✅ Yes | Low |

**Internal (non-exported) functions:**
- `normalizePolicy(policy)` — normalizes policy fields (exported via `refundPolicyService.normalizePolicy`)
- `getVendorRefundPolicy(vendorId)` — reads from `refund_policies` table (exported via `refundPolicyService`)
- `upsertVendorRefundPolicy({ vendorId, policy })` — upserts to `refund_policies` table (exported via `refundPolicyService`)

### 5.3 Dependency Audit

| # | Dependency | Type | Source | Notes |
|---|---|---|---|---|
| 1 | `supabase` | import | `@/services/supabase` | Direct Supabase client import |

**No other dependencies.** No Edge Functions, no payment records, no payment gateway, no orders, no checkout, no notifications, no auth.

### 5.4 Supabase & Edge Function Analysis

| # | Call Type | Table/Function | Operation | Code | Risk |
|---|---|---|---|---|---|
| 1 | `supabase.from('refund_policies')` | `refund_policies` | SELECT * .eq('vendor_id').maybeSingle() | Line 22-26 | Low — read-only |
| 2 | `supabase.from('refund_policies')` | `refund_policies` | UPSERT { vendor_id, ...normalized } .select('*').single() | Line 42-52 | Medium — write operation |

**No Edge Function calls.** No RPC calls. No storage calls. No auth calls.

**Affected tables:** `refund_policies` only.

### 5.5 Refund Flow Map

```
Vendor Settings Page (src/pages/vendor/Settings.jsx)
  → onLoad: refundPolicyService.getVendorRefundPolicy(user.id)
    → supabase.from('refund_policies').select('*').eq('vendor_id', vendorId).maybeSingle()
    → Returns normalized policy or DEFAULT_REFUND_POLICY
  → onSave: refundPolicyService.upsertVendorRefundPolicy({ vendorId, policy })
    → normalizePolicy(policy)
    → supabase.from('refund_policies').upsert({...}, { onConflict: 'vendor_id' }).select('*').single()
    → Returns normalized policy

ProductDetail Page (src/pages/ProductDetail.jsx)
  → onLoad: refundPolicyService.getVendorRefundPolicy(product.vendor_id)
    → Same as above
    → Displays refund policy to buyer
```

**Refund policy is read-only for buyers.** Only vendors can create/update policies. No actual refund processing happens here — this is policy metadata only.

### 5.6 Security & Money-Risk Analysis

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Double refund | None | This service manages policy metadata, not refund execution |
| 2 | Refund amount mismatch | None | No amount calculation here |
| 3 | Inconsistent order/payment status | None | No order/payment status changes |
| 4 | Race condition on upsert | Low | Supabase upsert with `onConflict: 'vendor_id'` is atomic |
| 5 | User role/permission risk | Low | RLS on `refund_policies` table should enforce vendor-only writes |
| 6 | RLS dependency | Medium | Depends on Supabase RLS to prevent non-vendors from writing policies |

**Overall risk: LOW.** This is policy metadata management, not refund execution. The actual refund processing is in `paymentGateway.js` (`refundPayPalPayment`, `refundCmiPayment`, manual refund via Edge Function).

### 5.7 Circular Dependency Risk

| # | Potential Cycle | Risk |
|---|---|---|
| 1 | `refundPolicyService.js` → `@/services/supabase` | None — supabase is a leaf dependency |
| 2 | `refundPolicyService.js` → `@/modules/payments` → `./api` → `refundPolicyService.js` | **YES — if moved to `src/modules/payments/api/`** |

**Critical finding:** The payments API barrel (`src/modules/payments/api/index.js:60-63`) re-exports from `@/services/refundPolicyService`. If moved into `src/modules/payments/api/`, the barrel import must change from `@/services/refundPolicyService` to `./refundPolicyService` (local import). No circular dependency would be introduced because `refundPolicyService.js` only imports from `@/services/supabase` (not from `@/modules/payments`).

### 5.8 Test Coverage

| # | Test File | Coverage | Mock Impact |
|---|---|---|---|
| 1 | `src/__tests__/integration/vendorSettings.test.js` | Tests `getVendorRefundPolicy` and `upsertVendorRefundPolicy` in vendor Settings flow | `jest.mock('@/services/refundPolicyService')` — would need path update after move |

No `fs.readFileSync` schema tests on `refundPolicyService.js`.

---

## 6. Consumer Table (All References)

### 6.1 `cmiPayment.js` Consumers

| # | File | Import Type | Import Path | Would Need Update? |
|---|---|---|---|---|
| 1 | `src/modules/payments/api/index.js:53-57` | Re-export | `from '@/services/cmiPayment'` | Yes → `from './cmiPayment'` |
| 2 | `src/modules/payments/index.js:62-65` | Re-export (via `./api`) | Indirect | No (re-exports from `./api`) |
| 3 | `src/services/__tests__/paymentGateway.test.js:118-121` | Direct import | `from '@/services/cmiPayment'` | Yes → `from '@/modules/payments'` |
| 4 | `src/services/webhooks/cmiWebhook.js` | Separate file | Not imported by `cmiPayment.js` | No (independent) |
| 5 | `src/modules/payments/README.md` | Documentation | References `cmiPayment` | Yes (doc update) |
| 6 | `src/modules/payments/api/paymentGateway.js:127,425,540` | Internal method | `processCmiPayment`, `refundCmiPayment` | No (internal methods, not imports) |
| 7 | `src/modules/payments/api/paymentService.js:110-121` | Internal wrapper | `processCMIPayment` wrapper | No (internal function, not import) |

### 6.2 `refundPolicyService.js` Consumers

| # | File | Import Type | Import Path | Would Need Update? |
|---|---|---|---|---|
| 1 | `src/modules/payments/api/index.js:60-63` | Re-export | `from '@/services/refundPolicyService'` | Yes → `from './refundPolicyService'` |
| 2 | `src/modules/payments/index.js:66-68` | Re-export (via `./api`) | Indirect | No (re-exports from `./api`) |
| 3 | `src/pages/vendor/Settings.jsx:16` | Direct import | `from '@/services/refundPolicyService'` | Yes → `from '@/modules/payments'` |
| 4 | `src/pages/ProductDetail.jsx:10` | Direct import (default) | `from '@/services/refundPolicyService'` | Yes → `from '@/modules/payments'` |
| 5 | `src/__tests__/integration/vendorSettings.test.js:122` | jest.mock | `jest.mock('@/services/refundPolicyService')` | Yes → `jest.mock('@/modules/payments')` |
| 6 | `src/modules/payments/README.md` | Documentation | References `refundPolicyService` | Yes (doc update) |
| 7 | `src/modules/catalog/README.md` | Documentation | References `refundPolicyService` | Yes (doc update) |
| 8 | `src/modules/marketplace/README.md` | Documentation | References `refundPolicyService` | Yes (doc update) |

---

## 7. Dependency Table

### 7.1 `cmiPayment.js` Dependencies

| # | Dependency | Import Path | Type | After Move |
|---|---|---|---|---|
| 1 | `getLatestPaymentRecordForOrder` | `@/modules/payments` | Function | Change to `./paymentRecords` (local) |

### 7.2 `refundPolicyService.js` Dependencies

| # | Dependency | Import Path | Type | After Move |
|---|---|---|---|---|
| 1 | `supabase` | `@/services/supabase` | Supabase client | No change needed (or use dynamic import like `paymentRecords.js`) |

---

## 8. Mock Impact Map

| # | Test File | Current Mock Path | After Move Mock Path | Impact |
|---|---|---|---|---|
| 1 | `paymentGateway.test.js` | `from '@/services/cmiPayment'` | `from '@/modules/payments'` | Low — 3 imports to update |
| 2 | `vendorSettings.test.js` | `jest.mock('@/services/refundPolicyService')` | `jest.mock('@/modules/payments')` | Medium — mock structure must match new barrel exports |

---

## 9. Circular Dependency Risk Analysis

### 9.1 `cmiPayment.js` Move to `src/modules/payments/api/cmiPayment.js`

| # | Cycle Risk | Details |
|---|---|---|
| 1 | `cmiPayment.js` → `@/modules/payments` → `./api` → `cmiPayment.js` | **YES** — must change import to `./paymentRecords` |
| 2 | After fix: `cmiPayment.js` → `./paymentRecords` → `@/services/supabase` | No cycle |

**Verdict:** Safe to move IF import changes from `@/modules/payments` to `./paymentRecords`.

### 9.2 `refundPolicyService.js` Move to `src/modules/payments/api/refundPolicyService.js`

| # | Cycle Risk | Details |
|---|---|---|
| 1 | `refundPolicyService.js` → `@/services/supabase` | No cycle — supabase is a leaf |
| 2 | Payments barrel → `./refundPolicyService` → `@/services/supabase` | No cycle |

**Verdict:** Safe to move. No circular dependency risk. Import can stay as `@/services/supabase` or switch to dynamic import like `paymentRecords.js` does.

### 9.3 Cross-Module Cycle Check

| # | Module | Cycle Risk |
|---|---|---|
| 1 | `@/modules/checkout` | None — neither file imports from checkout |
| 2 | `@/modules/orders` | None |
| 3 | `@/modules/cart` | None |
| 4 | `@/modules/admin` | None |
| 5 | `@/modules/notifications` | None |
| 6 | `@/services/api.js` | None |

---

## 10. Recommended Ownership Decision

| # | File | Recommended Owner | Recommended Target Path | Reason |
|---|---|---|---|---|
| 1 | `cmiPayment.js` | `payments` module | `src/modules/payments/api/cmiPayment.js` | Legacy CMI payment functions belong to payments domain |
| 2 | `refundPolicyService.js` | `payments` module | `src/modules/payments/api/refundPolicyService.js` | Refund policy is a payments domain concern |

### Alternative: `refundPolicyService.js` in `payments/domain/`

If a `domain/` subdirectory is created later for business logic (vs API calls), `refundPolicyService.js` could go to `src/modules/payments/domain/refundPolicy.js`. However, since the current module structure uses `api/` for all service files, `api/` is the consistent choice.

---

## 11. Whether Compatibility Stubs Should Remain

**Yes.** Both files should get compatibility stubs after moving, following the proven pattern from Phases 7.6–7.8:

```js
// src/services/cmiPayment.js (stub)
export { initCMIPayment, verifyCMICallback, getCMIStatus } from '@/modules/payments'
```

```js
// src/services/refundPolicyService.js (stub)
export { DEFAULT_REFUND_POLICY, refundPolicyService, default } from '@/modules/payments'
```

Stubs should be deleted in a later phase after consumer import adoption.

---

## 12. Whether `src/services/api.js` Would Need Changes

**No.** Neither `cmiPayment.js` nor `refundPolicyService.js` is imported by `src/services/api.js`. No changes needed.

---

## 13. Whether Consumers Would Need Import-Only Changes

| # | Consumer | Current Path | New Path | Change Type |
|---|---|---|---|---|
| 1 | `paymentGateway.test.js` | `@/services/cmiPayment` | `@/modules/payments` | Import path only |
| 2 | `vendor/Settings.jsx` | `@/services/refundPolicyService` | `@/modules/payments` | Import path only |
| 3 | `ProductDetail.jsx` | `@/services/refundPolicyService` | `@/modules/payments` | Import path only |
| 4 | `vendorSettings.test.js` | `jest.mock('@/services/refundPolicyService')` | `jest.mock('@/modules/payments')` | Mock path only |
| 5 | `payments/api/index.js` | `@/services/cmiPayment` | `./cmiPayment` | Barrel re-export path |
| 6 | `payments/api/index.js` | `@/services/refundPolicyService` | `./refundPolicyService` | Barrel re-export path |

All changes are import-path-only. No logic changes needed.

---

## 14. Risk Rating Per File

| # | File | Risk Level | Reason |
|---|---|---|---|
| 1 | `cmiPayment.js` | **LOW** | Legacy tombstone — 2/3 functions throw errors, 1 read-only. No write operations. No Edge Functions. |
| 2 | `refundPolicyService.js` | **LOW** | Policy metadata CRUD only. No refund execution. No payment processing. Simple Supabase read/upsert on single table. |

---

## 15. Go / No-Go Recommendation for Phase 7.14

### `refundPolicyService.js`: ✅ GO

- Low risk — policy metadata only, no money flow
- No circular dependency risk
- Only 2 app consumers + 1 test mock
- Clean dependency (only `@/services/supabase`)
- Tests exist for the main consumer flow

### `cmiPayment.js`: ✅ GO (with caution)

- Low risk — legacy tombstone, no active payment flow
- Must change import from `@/modules/payments` to `./paymentRecords` to avoid circular dependency
- Only 1 test consumer
- No `fs.readFileSync` schema tests

### Recommended: Move `refundPolicyService.js` first (Phase 7.14), then `cmiPayment.js` (Phase 7.15)

**Rationale:** Smaller phases are safer for money-related code. `refundPolicyService.js` is simpler (no circular dependency risk, fewer consumers). `cmiPayment.js` requires an internal import change. Moving them separately allows targeted testing after each move.

---

## 16. Suggested Phase 7.14 Prompt Outline

```
Phase 7.14 — Move refundPolicyService.js to payments module

1. Move src/services/refundPolicyService.js → src/modules/payments/api/refundPolicyService.js
2. Create compatibility stub at src/services/refundPolicyService.js
3. Update src/modules/payments/api/index.js: @/services/refundPolicyService → ./refundPolicyService
4. Do NOT change consumer imports yet (stubs handle backward compat)
5. Run lint, type-check, targeted tests, build, check:circular
6. Create phase-7-14 report
```

**Phase 7.15 (after 7.14):**
```
Phase 7.15 — Move cmiPayment.js to payments module

1. Move src/services/cmiPayment.js → src/modules/payments/api/cmiPayment.js
2. Change import: @/modules/payments → ./paymentRecords (avoid circular dependency)
3. Create compatibility stub at src/services/cmiPayment.js
4. Update src/modules/payments/api/index.js: @/services/cmiPayment → ./cmiPayment
5. Run lint, type-check, targeted tests, build, check:circular
6. Create phase-7-15 report
```

**Phase 7.16 (after 7.15):**
```
Phase 7.16 — Consumer import adoption for cmiPayment + refundPolicyService

1. Migrate all consumers from @/services/cmiPayment and @/services/refundPolicyService to @/modules/payments
2. Update jest.mock paths
3. Run lint, type-check, targeted tests, build, check:circular
4. Create phase-7-16 report
```

**Phase 7.17 (after 7.16):**
```
Phase 7.17 — Stub deletion for cmiPayment + refundPolicyService

1. Confirm zero active consumers
2. Delete stubs
3. Run lint, type-check, targeted tests, build, check:circular
4. Create phase-7-17 report
```

---

## 17. Verification Results

### Smoke Tests

| Test Suite | Tests | Result |
|---|---|---|
| `paymentGateway.test.js` (services) | 18 | ✅ All pass |
| `paymentGateway.test.js` (__tests__) | 11 | ✅ All pass |
| `paymentRecords.test.js` | 8 | ✅ All pass |
| `paymentRecords.schema.test.js` | 5 | ✅ All pass |
| `codBankPayment.schema.test.js` | — | ✅ All pass |
| `refundPayPal.schema.test.js` | — | ✅ All pass |
| `checkoutService.test.js` | 18 | ✅ All pass |
| `checkout.integration.test.js` | — | ✅ All pass |
| `orderFlow.integration.test.js` | 36 | ✅ All pass |
| `addToCart.integration.test.js` | — | ✅ All pass |
| `buyerOrdersRealtime.test.jsx` | — | ✅ All pass |
| `vendorSettings.test.js` | — | ✅ All pass |
| `VendorSettings.payload.test.js` | — | ✅ All pass |

**Total: 195 passed, 0 failed**

### Final Checks

| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed (exit code 0) |
| `npm run type-check` | ✅ Passed (exit code 0) |
| `npm run build` | ✅ Passed |
| `npm run check:circular` | ✅ Passed (714 files, 0 circular dependencies) |

---

## 18. Summary

| Metric | Value |
|---|---|
| Files analyzed | 2 |
| Total exports | 5 (3 cmiPayment + 2 refundPolicyService + 1 default) |
| Total consumers | 7 (3 cmiPayment + 4 refundPolicyService) |
| Test mocks | 2 |
| Supabase tables | 2 (`payments` indirect, `refund_policies` direct) |
| Edge Functions | 0 (in target files) |
| Circular dependency risk | 1 (cmiPayment — fixable with local import) |
| Overall risk | LOW |
| Go/No-Go | ✅ GO for both (move separately) |
| Recommended phases | 7.14 (refundPolicy), 7.15 (cmiPayment), 7.16 (adoption), 7.17 (deletion) |
