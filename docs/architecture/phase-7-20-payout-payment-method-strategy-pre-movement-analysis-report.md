# Phase 7.20 — Payout Service & Payment Method Strategy Pre-Movement Analysis Report

**Phase:** 7.20 — Pre-Movement Analysis for `payoutService.js` and `paymentMethodStrategy.js`
**Date:** 2026-06-25
**Status:** ✅ Analysis Complete — No code changes made

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` (614 lines) was read in full and strictly followed.

Key rules respected:
- ✅ **Section 37 — RLS/Auth/Payments Protected Zone:** `payoutService.js` is explicitly listed as a Protected Zone file. This analysis does NOT modify it. Any future movement requires explicit user approval.
- ✅ **Section 9 — Payments:** `payoutService.js` is listed as a payment-related file requiring analysis and testing before any modification.
- ✅ Analysis only — no file movement, no import rewriting, no stub creation/deletion, no production code changes.
- ✅ No `any`, `@ts-ignore`, `@ts-expect-error`.

---

## 2. Confirmation: Analysis Only — No Source Behavior Changed

✅ This phase was analysis/documentation only. Zero source files were modified. Zero behavior changes.

---

## 3. Target Files Inspected

| # | File | Lines | Created In |
|---|---|---|---|
| 1 | `src/services/payoutService.js` | 22 | Original project |
| 2 | `src/services/paymentMethodStrategy.js` | 35 | Original project |

---

## 4. Exports Per File

### 4.1 `payoutService.js` (22 lines)

| Export | Type | Responsibility |
|---|---|---|
| `payoutService` | Named object | Contains `sendPayout()` method |
| `default` | Default export | Same as `payoutService` object |

**`sendPayout({ userId, amount, currency, source })`:**
- Invokes `supabase.functions.invoke('send-payout', ...)` Edge Function
- Parameters: `user_id`, `amount`, `currency` (default EUR), `source` (default 'manual')
- Returns `data` on success
- Throws on `error` or `!data?.success`

### 4.2 `paymentMethodStrategy.js` (35 lines)

| Export | Type | Responsibility |
|---|---|---|
| `getPayoutStrategy` | Named function | Returns payout strategy object for a given method |
| `paypalPayoutStrategy` | Internal const (not exported) | PayPal-specific validation strategy |

**`getPayoutStrategy(method = 'paypal')`:**
- Normalizes method string (lowercase)
- Looks up strategy in `STRATEGIES` map
- Currently only supports `'paypal'`
- Throws `Unsupported payout method` for unknown methods

**`paypalPayoutStrategy.validateRecipient({ profile })`:**
- Validates `profile.paypal_email` exists and is non-empty
- Validates `profile.paypal_verified === true`
- Returns `{ recipientType: 'EMAIL', recipientValue: email }`
- Throws `PAYPAL_EMAIL_REQUIRED` or `PAYPAL_VERIFICATION_REQUIRED` on failure

---

## 5. Export Ownership Table

| Export | Current Location | Owner Module | Can Move Unchanged? | Target Layer | Risk |
|---|---|---|---|---|---|
| `payoutService` | `src/services/payoutService.js` | **Commissions** (currently re-exported from `@/modules/commissions`) or future **Payouts** module | ✅ Yes — no internal deps except `supabase` | `api` | Medium |
| `payoutServiceDefault` | Same | Same | ✅ Yes | `api` | Medium |
| `getPayoutStrategy` | `src/services/paymentMethodStrategy.js` | **Payouts** (currently not re-exported from any module) | ✅ Yes — zero external deps | `domain` | Low |

### Ownership Decision

| File | Recommended Owner | Rationale |
|---|---|---|
| `payoutService.js` | **`@/modules/commissions`** (already re-exported) or future **`@/modules/payouts`** | Already re-exported from commissions. Tightly coupled with financial domain. `.windsurfrules` Section 37 classifies it as Protected Zone. |
| `paymentMethodStrategy.js` | Future **`@/modules/payouts`** or **`@/modules/payments/domain`** | Pure validation logic for payout recipient. Zero external deps. Zero active consumers. Could belong with payouts or payments. |

**Key finding:** Both files are payout-related, not payment-processing-related. The payments module README explicitly states: "payoutService.js is **not** re-exported from payments" and "paymentMethodStrategy.js is **not** re-exported from payments."

**Recommended target:** `@/modules/commissions/api/` for `payoutService.js` (since it's already re-exported from there). `paymentMethodStrategy.js` should move alongside `payoutService.js` since it provides payout strategy validation.

---

## 6. Consumer Table

### 6.1 `payoutService` Consumers

| # | File | Type | Import Path | Active Consumer? |
|---|---|---|---|---|
| 1 | `src/modules/commissions/api/index.js` | Re-export | `@/services/payoutService` | ✅ Yes (re-export) |
| 2 | `src/modules/commissions/index.js` | Re-export | `./api` | ✅ Yes (re-export) |
| 3 | `src/modules/commissions/README.md` | Doc | N/A | Doc-only |
| 4 | `src/modules/payments/README.md` | Doc | N/A | Doc-only |
| 5 | `src/modules/checkout/README.md` | Doc | N/A | Doc-only |
| 6 | `src/services/payoutService.js` | Self | N/A | Self |

**Active code consumers: 1** (`commissions/api/index.js` re-export)
**Direct app consumers: 0** — No page, component, or test imports `payoutService` directly.
**Note:** `src/pages/admin/Payouts.jsx` (652 lines) uses Supabase directly, NOT `payoutService`.

### 6.2 `paymentMethodStrategy` Consumers

| # | File | Type | Import Path | Active Consumer? |
|---|---|---|---|---|
| 1 | `src/services/paymentMethodStrategy.js` | Self | N/A | Self |
| 2 | `src/modules/payments/README.md` | Doc | N/A | Doc-only |

**Active code consumers: 0**
**This file has zero active code consumers.** It is not imported by any file in the codebase.

### 6.3 `getPayoutStrategy` Consumers

| # | File | Type | Active Consumer? |
|---|---|---|---|
| 1 | `src/services/paymentMethodStrategy.js` | Self (export definition) | Self |

**Active code consumers: 0**

### 6.4 `sendPayout` Consumers

| # | File | Type | Active Consumer? |
|---|---|---|---|
| 1 | `src/services/payoutService.js` | Self (method definition) | Self |
| 2 | `src/modules/commissions/api/index.js` | Re-export comment | Doc-only |
| 3 | `src/modules/commissions/README.md` | Doc | Doc-only |

**Active code consumers: 0** (beyond the re-export in commissions/api)

---

## 7. Dependency Table

### 7.1 `payoutService.js` Dependencies

| # | Dependency | Import Path | Type | Circular Risk if Moved? |
|---|---|---|---|---|
| 1 | `supabase` | `@/services/supabase` | Supabase client | ❌ No — shared infra |

**Total dependencies: 1** (only `supabase`)

### 7.2 `paymentMethodStrategy.js` Dependencies

| # | Dependency | Import Path | Type | Circular Risk if Moved? |
|---|---|---|---|---|
| — | (none) | — | — | — |

**Total dependencies: 0** — This file has zero imports. It is completely self-contained.

---

## 8. Supabase Table/Query Analysis

### 8.1 `payoutService.js`

| Operation | Table/Function | Type | Details |
|---|---|---|---|
| `supabase.functions.invoke('send-payout', ...)` | `send-payout` Edge Function | Edge Function invoke | Body: `{ user_id, amount, currency, source }` |

**Supabase tables accessed directly:** 0 (uses Edge Function only)
**Edge Functions invoked:** 1 (`send-payout`)
**RPC calls:** 0
**Risk rating:** Medium — invokes a money-sending Edge Function

### 8.2 `paymentMethodStrategy.js`

| Operation | Table/Function | Type | Details |
|---|---|---|---|
| — | — | — | No Supabase access |

**Supabase tables accessed:** 0
**Edge Functions invoked:** 0
**RPC calls:** 0
**Risk rating:** Low — pure validation logic, no database access

---

## 9. Edge Function Call Analysis

| Edge Function | Called By | Parameters | Risk |
|---|---|---|---|
| `send-payout` | `payoutService.sendPayout()` | `{ user_id, amount, currency, source }` | **High** — sends actual money |

**`paymentMethodStrategy.js`:** No Edge Function calls.

---

## 10. Payout Flow Map

```
Admin Payouts Page (src/pages/admin/Payouts.jsx, 652 lines)
  └── Uses supabase directly (NOT payoutService)
      ├── Lists payouts from `payouts` table
      ├── Updates payout status
      └── Reads `financial_audit_log`

payoutService.sendPayout()
  └── supabase.functions.invoke('send-payout', { user_id, amount, currency, source })
      └── Edge Function handles actual payout

paymentMethodStrategy.getPayoutStrategy('paypal')
  └── paypalPayoutStrategy.validateRecipient({ profile })
      ├── Checks profile.paypal_email
      └── Checks profile.paypal_verified

Commissions Module (re-export)
  └── payoutService → @/services/payoutService
```

**Key finding:** `payoutService.sendPayout()` is re-exported from `@/modules/commissions` but has **zero direct app consumers**. The admin Payouts page bypasses `payoutService` entirely and uses Supabase directly.

---

## 11. Payment Method Strategy Flow Map

```
paymentMethodStrategy.js
  └── getPayoutStrategy(method)
      └── STRATEGIES['paypal'] = paypalPayoutStrategy
          └── validateRecipient({ profile })
              ├── Validates paypal_email exists
              └── Validates paypal_verified === true

Consumers: ZERO
```

**Key finding:** `paymentMethodStrategy.js` is completely orphaned code. It has zero consumers anywhere in the codebase. It may have been written for future use or is leftover from a previous implementation.

---

## 12. Security/Money-Risk Analysis

### 12.1 `payoutService.js`

| Risk | Severity | Description | Mitigation |
|---|---|---|---|
| Incorrect payout amount | **High** | `amount` parameter passed directly to Edge Function | Edge Function should validate — not in frontend scope |
| Duplicate payout | **Medium** | No idempotency key in `sendPayout()` | Edge Function should handle idempotency |
| Unauthorized payout access | **Low** | Frontend only sends request — RLS/Edge Function should enforce auth | Supabase RLS + Edge Function auth |
| Wrong vendor payout | **Medium** | `userId` parameter — if wrong ID passed, wrong vendor gets paid | Caller must verify — admin page uses Supabase directly |
| Payout status mismatch | **Low** | `sendPayout` only sends — doesn't update status | Admin Payouts page handles status separately |
| Missing idempotency | **Medium** | No idempotency key in API | Edge Function should enforce |

### 12.2 `paymentMethodStrategy.js`

| Risk | Severity | Description | Mitigation |
|---|---|---|---|
| Payment method mismatch | **Low** | Only supports PayPal — throws for others | Add strategies for other methods when needed |
| Checkout method mismatch | **Low** | Not used in checkout flow | N/A — file is orphaned |
| RLS dependency risk | **None** | No Supabase access | N/A |
| Admin/vendor permission risk | **None** | No permission checks in file | N/A |

---

## 13. Circular Dependency Risk Analysis

### If `payoutService.js` moves to `@/modules/commissions/api/`:

| Potential Cycle | Risk | Explanation |
|---|---|---|
| `@/modules/payments` → `@/modules/commissions` | ❌ None | `payoutService.js` doesn't import from payments |
| `@/modules/orders` → `@/modules/commissions` | ❌ None | `payoutService.js` doesn't import from orders |
| `@/modules/admin` → `@/modules/commissions` | ❌ None | Admin pages import from commissions, not reverse |
| `@/modules/checkout` → `@/modules/commissions` | ❌ None | `payoutService.js` doesn't import from checkout |
| `@/services/api.js` → `@/modules/commissions` | ❌ None | `payoutService.js` doesn't import from `api.js` |

**Circular dependency risk: NONE** — `payoutService.js` only imports `@/services/supabase`.

### If `paymentMethodStrategy.js` moves to `@/modules/commissions/api/` or `@/modules/payments/domain/`:

| Potential Cycle | Risk | Explanation |
|---|---|---|
| Any module → `paymentMethodStrategy` | ❌ None | File has zero imports — cannot create cycles |

**Circular dependency risk: NONE** — `paymentMethodStrategy.js` has zero imports.

---

## 14. Test Coverage Map

### 14.1 `payoutService.js` Test Coverage

| Test File | Covers `payoutService`? | Covers `sendPayout`? | Details |
|---|---|---|---|
| `AdminPayouts.test.jsx` (217 lines) | ❌ No | ❌ No | Tests admin Payouts page which uses Supabase directly, not `payoutService` |
| Any other test | ❌ No | ❌ No | No test file imports or mocks `payoutService` |

**Test coverage: ZERO** — `payoutService.js` has no test coverage.

### 14.2 `paymentMethodStrategy.js` Test Coverage

| Test File | Covers `paymentMethodStrategy`? | Covers `getPayoutStrategy`? | Details |
|---|---|---|---|
| Any test | ❌ No | ❌ No | No test file imports or mocks `paymentMethodStrategy` |

**Test coverage: ZERO** — `paymentMethodStrategy.js` has no test coverage.

### 14.3 Related Tests (Run in This Phase)

| Test Suite | Tests | Result |
|---|---|---|
| `AdminPayouts.test.jsx` | — | ✅ Pass |
| `AdminCommissionManagement.columns.test.jsx` | — | ✅ Pass |
| `paymentGateway.test.js` (both) | — | ✅ Pass |
| `paymentRecords.test.js` | — | ✅ Pass |
| `paymentRecords.schema.test.js` | — | ✅ Pass |
| `checkoutService.test.js` | — | ✅ Pass |
| `checkout.integration.test.js` | — | ✅ Pass |
| `checkoutFlow.test.js` | — | ✅ Pass |
| `Checkout.test.js` | — | ✅ Pass |
| `CheckoutSimplified.i18n.test.jsx` | — | ✅ Pass |
| `orderFlow.integration.test.js` | — | ✅ Pass |
| `vendorSettings.test.js` | — | ✅ Pass |
| `VendorSettings.payload.test.js` | — | ✅ Pass |
| `paypalCheckout.schema.test.js` | — | ✅ Pass |
| `checkoutCleanup.test.js` | — | ✅ Pass |

**Total: 200 passed, 0 failed**

---

## 15. Mock Impact Map

### If `payoutService.js` moves to `@/modules/commissions/api/payoutService.js`:

| File | Mock Impact | Change Required |
|---|---|---|
| `src/modules/commissions/api/index.js` | Re-export path changes from `@/services/payoutService` to `./payoutService` | ✅ Yes — import path update |
| `src/modules/commissions/index.js` | No change (imports from `./api`) | ❌ No |
| Any test file | No `jest.mock` for `payoutService` exists | ❌ No |
| `src/pages/admin/Payouts.jsx` | Doesn't import `payoutService` | ❌ No |

### If `paymentMethodStrategy.js` moves:

| File | Mock Impact | Change Required |
|---|---|---|
| Any file | Zero consumers, zero mocks | ❌ No |

### Schema Tests with `fs.readFileSync`

| Test File | Uses `fs.readFileSync` on source? | Impact |
|---|---|---|
| `AdminPayouts.test.jsx` | Yes — reads `Payouts.jsx` source | ❌ No impact — doesn't read `payoutService.js` |
| `paypalCheckout.schema.test.js` | Unknown | ❌ No impact — doesn't reference payout files |

---

## 16. Recommended Ownership Decision Per File

| File | Recommended Owner | Recommended Path | Rationale |
|---|---|---|---|
| `payoutService.js` | **Commissions module** | `src/modules/commissions/api/payoutService.js` | Already re-exported from commissions. Only 1 consumer (commissions re-export). Only 1 dependency (`supabase`). No circular risk. |
| `paymentMethodStrategy.js` | **Commissions module** (alongside payoutService) | `src/modules/commissions/api/paymentMethodStrategy.js` | Payout strategy validation. Zero consumers. Zero deps. Should live with payout logic. |

**Alternative:** Create a dedicated `@/modules/payouts/` module for both files. However, given the tiny size (22 + 35 = 57 lines total) and zero direct app consumers, a separate module may be over-engineering.

**Payments module is NOT recommended** — the payments README explicitly excludes both files from the payments module's scope.

---

## 17. Whether Compatibility Stubs Should Be Created Later

| File | Stub Needed? | Reason |
|---|---|---|
| `payoutService.js` | ✅ Yes | `commissions/api/index.js` imports from `@/services/payoutService` — stub needed during transition |
| `paymentMethodStrategy.js` | ❌ No | Zero consumers — can be moved directly without stub |

---

## 18. Whether `src/services/api.js` Would Need Changes Later

**No.** Neither `payoutService.js` nor `paymentMethodStrategy.js` is imported by `src/services/api.js`. No changes needed.

---

## 19. Whether Checkout/Order/Admin/Vendor Consumers Would Need Import-Only Changes Later

| Consumer | Current Import | Would Need Change? |
|---|---|---|
| `src/modules/commissions/api/index.js` | `@/services/payoutService` | ✅ Yes — change to `./payoutService` (in same phase as move) |
| `src/pages/admin/Payouts.jsx` | Uses Supabase directly | ❌ No |
| `src/components/vendor/CommissionDashboard.jsx` | `@/modules/commissions` (for `commissionService`) | ❌ No (doesn't use `payoutService`) |
| `src/pages/admin/CommissionManagement.jsx` | `@/modules/commissions` (for `commissionService`) | ❌ No (doesn't use `payoutService`) |
| Any checkout/order page | None import `payoutService` | ❌ No |

**Total files needing import changes: 1** (`commissions/api/index.js`)

---

## 20. Risk Rating Per File

| File | Complexity | Consumers | Dependencies | Supabase Access | Edge Functions | Test Coverage | Overall Risk |
|---|---|---|---|---|---|---|---|
| `payoutService.js` | Low (22 lines) | 1 (re-export only) | 1 (`supabase`) | 0 tables | 1 (`send-payout`) | None | **Medium** (money flow, no tests, Protected Zone) |
| `paymentMethodStrategy.js` | Low (35 lines) | 0 | 0 | 0 | 0 | None | **Very Low** (orphaned code, pure validation) |

---

## 21. Go / No-Go Recommendation for Phase 7.21

### `paymentMethodStrategy.js`: **GO** ✅
- Zero consumers
- Zero dependencies
- Zero Supabase access
- Zero Edge Function calls
- Zero circular risk
- Can be moved directly without stub
- **Risk: Very Low**

### `payoutService.js`: **GO with caution** ⚠️
- 1 consumer (commissions re-export) — needs stub or direct path update
- 1 dependency (`supabase`) — no circular risk
- 1 Edge Function (`send-payout`) — money flow, Protected Zone
- Zero test coverage — **add tests before movement**
- `.windsurfrules` Section 37: Protected Zone — **requires explicit user approval**
- **Risk: Medium**

### Recommended Phase 7.21 Strategy: **Move both together**

**Rationale:**
1. Both files are tiny (22 + 35 = 57 lines)
2. Both are payout-related
3. `paymentMethodStrategy.js` has zero consumers — trivial move
4. `payoutService.js` has 1 consumer (commissions re-export) — simple path update
5. Moving together keeps payout logic consolidated

**But:** `.windsurfrules` Section 37 requires explicit user approval before modifying `payoutService.js`. The movement phase must include:
1. User approval
2. Creating a compatibility stub for `payoutService.js`
3. Updating `commissions/api/index.js` import path
4. Adding test coverage for `payoutService.sendPayout()`
5. Adding test coverage for `paymentMethodStrategy.getPayoutStrategy()`
6. Running full test suite

---

## 22. Suggested Phase 7.21 Prompt Outline

```
Phase 7.21 — Move payoutService.js and paymentMethodStrategy.js to @/modules/commissions/api/

1. Read .windsurfrules (Section 37 — Protected Zone)
2. Create test coverage for payoutService.sendPayout() and paymentMethodStrategy.getPayoutStrategy()
3. Move payoutService.js → src/modules/commissions/api/payoutService.js
4. Move paymentMethodStrategy.js → src/modules/commissions/api/paymentMethodStrategy.js
5. Create compatibility stub at src/services/payoutService.js (re-export from @/modules/commissions)
6. Update commissions/api/index.js import path: @/services/payoutService → ./payoutService
7. Update commissions/api/index.js to re-export paymentMethodStrategy exports
8. Update commissions/index.js to export getPayoutStrategy
9. Update README docs (commissions, payments, checkout)
10. Run: lint, type-check, targeted tests, build, check:circular
11. Run full test suite
12. Create phase-7-21 report
13. Update MODULAR_DEVELOPMENT_PLAN.md
```

---

## 23. Verification Results

| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed (exit code 0) |
| `npm run type-check` | ✅ Passed (exit code 0) |
| `npm run build` | ✅ Passed (built in 2m 50s, 4189 modules) |
| `npm run check:circular` | ✅ Passed (707 files, 0 circular dependencies) |
| Targeted tests (15 suites) | ✅ 200/200 passed |

---

## 24. Remaining Risks Before Moving Additional `src/services/` Files

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | `payoutService.js` is a Protected Zone file (`.windsurfrules` Section 37) | High | Requires explicit user approval before movement |
| 2 | Zero test coverage for both files | Medium | Add tests before movement in Phase 7.21 |
| 3 | `send-payout` Edge Function is money-flow | High | Movement doesn't change Edge Function call — only file location |
| 4 | `paymentMethodStrategy.js` is orphaned code | Low | Consider whether it should be deleted instead of moved |
| 5 | Commissions module README suggests future `@/modules/payouts/` module | Low | Decision needed: separate payouts module vs. keeping in commissions |

---

## 25. Files Inspected (Complete List)

- `.windsurfrules` (614 lines)
- `src/services/payoutService.js` (22 lines)
- `src/services/paymentMethodStrategy.js` (35 lines)
- `src/modules/payments/index.js` (108 lines)
- `src/modules/payments/api/index.js` (65 lines)
- `src/modules/payments/README.md` (payment strategy references)
- `src/modules/commissions/index.js` (payoutService re-export)
- `src/modules/commissions/api/index.js` (payoutService import + re-export)
- `src/modules/commissions/README.md` (payout documentation)
- `src/modules/checkout/README.md` (forbidden deps reference)
- `src/pages/admin/Payouts.jsx` (verified: uses Supabase directly, not payoutService)
- `src/__tests__/pages/AdminPayouts.test.jsx` (verified: doesn't mock payoutService)
- `src/components/vendor/CommissionDashboard.jsx` (verified: imports commissionService, not payoutService)
- `src/pages/admin/CommissionManagement.jsx` (verified: imports commissionService, not payoutService)
- `MODULAR_DEVELOPMENT_PLAN.md`
- `package.json`
- `eslint.config.js`

---

## 26. Summary

| Metric | Value |
|---|---|
| Files analyzed | 2 |
| Code changes | 0 |
| `payoutService.js` active code consumers | 1 (commissions re-export only) |
| `paymentMethodStrategy.js` active code consumers | 0 (orphaned) |
| `payoutService.js` dependencies | 1 (`supabase`) |
| `paymentMethodStrategy.js` dependencies | 0 |
| Supabase tables accessed | 0 (Edge Function only) |
| Edge Functions invoked | 1 (`send-payout`) |
| Circular dependency risk | None |
| Test coverage | Zero for both files |
| Protected Zone | `payoutService.js` is Protected (`.windsurfrules` Section 37) |
| Phase 7.21 recommendation | **GO** — Move both to `@/modules/commissions/api/` with tests + stub |
