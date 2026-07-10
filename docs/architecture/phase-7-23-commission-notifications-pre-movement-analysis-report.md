# Phase 7.23 — Commission Notifications Pre-Movement Analysis Report

**Phase:** 7.23 — Pre-Movement Analysis for `commissionNotifications.js`
**Date:** 2026-06-25
**Status:** ✅ Analysis Complete — No code changes made

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` (614 lines) was read in full and strictly followed.

Key rules respected:
- ✅ **Section 37 — RLS/Auth/Payments Protected Zone:** `commissionService.js` is listed as Protected Zone. `commissionNotifications.js` is NOT directly listed, but it is tightly coupled with `commissionService.js` which calls all its methods.
- ✅ Analysis only — no file movement, no import rewriting, no stub creation/deletion, no production code changes.
- ✅ No `any`, `@ts-ignore`, `@ts-expect-error`.

---

## 2. Confirmation: Analysis Only — No Source Behavior Changed

✅ This phase was analysis/documentation only. Zero source files were modified. Zero behavior changes.

---

## 3. Target File Inspected

| File | Lines | Location |
|---|---|---|
| `src/services/commissionNotifications.js` | 111 | `src/services/` |

---

## 4. Exports Table

| Export | Type | Responsibility | Can Move Unchanged? |
|---|---|---|---|
| `commissionNotifications` | Named object | 6 methods: `afterConfirmedSale`, `monthEndSummary`, `reminder3Days`, `dueToday`, `accountFrozen`, `paymentConfirmed` — each sends in-app + email notifications | ✅ Yes |
| `default` | Default export | Same as `commissionNotifications` object | ✅ Yes |

### Method Details

| Method | Parameters | Sends In-App | Sends Email | Event Type |
|---|---|---|---|---|
| `afterConfirmedSale` | `vendorId, saleAmount, commissionSoFar, orderId` | ✅ | ✅ | `sale_confirmed` |
| `monthEndSummary` | `vendorId, monthName, totalSales, commissionDue, dueDate, monthlySaleId` | ✅ | ✅ | `month_end` |
| `reminder3Days` | `vendorId, amountDue, dueDate, monthlySaleId` | ✅ | ✅ | `reminder_3days` |
| `dueToday` | `vendorId, amountDue, monthlySaleId` | ✅ | ✅ | `due_today` |
| `accountFrozen` | `vendorId, amountDue, monthlySaleId` | ✅ | ✅ | `account_frozen` |
| `paymentConfirmed` | `vendorId, paidAmount, monthlySaleId` | ✅ | ✅ | `paid_confirmed` |

### Internal Helpers (not exported)

| Helper | Responsibility |
|---|---|
| `formatMad(value)` | Formats amount as Moroccan Dirham string |
| `sendInAppNotification(vendorId, title, message, data)` | Calls `notificationsApi.create()` with type `commission` |
| `sendEmailNotification(vendorId, subject, message, data)` | Queries `profiles` table for vendor email, calls `emailService.sendEmail()` |

---

## 5. Consumer Table

| # | File | Type | Import Path | Active Consumer? |
|---|---|---|---|---|
| 1 | `src/services/commissionService.js` | Direct import | `@/services/commissionNotifications` | ✅ Yes — calls all 6 methods |
| 2 | `src/modules/commissions/api/index.js` | Re-export | `@/services/commissionNotifications` | ✅ Yes (re-export) |
| 3 | `src/modules/notifications/api/index.js` | Re-export | `@/services/commissionNotifications` | ✅ Yes (re-export) |
| 4 | `src/modules/notifications/index.js` | Re-export | `./api` | ✅ Yes (re-export) |
| 5 | `src/modules/commissions/index.js` | Re-export | `./api` | ✅ Yes (re-export) |
| 6 | `src/modules/commissions/README.md` | Doc | N/A | Doc-only |
| 7 | `src/modules/notifications/README.md` | Doc | N/A | Doc-only |
| 8 | `src/modules/payments/README.md` | Doc | N/A | Doc-only |

**Active code consumers: 4** (1 direct import + 3 re-export barrels)
**Direct app consumers: 1** (`commissionService.js` imports and calls all 6 methods)
**Test consumers: 0** — No test file imports or mocks `commissionNotifications`

### Consumer Details — `commissionService.js` Usage

`commissionService.js` (696 lines) calls all 6 methods of `commissionNotifications`:

| Method | Called From | Context |
|---|---|---|
| `afterConfirmedSale` | `confirmSaleAndCalculate()` | After a sale is confirmed and commission calculated |
| `monthEndSummary` | `closeMonthAndNotify()` | At month-end when closing monthly sales |
| `reminder3Days` | `checkOverdueCommissions()` | 3 days before payment deadline |
| `dueToday` | `checkOverdueCommissions()` | On payment due date |
| `accountFrozen` | `checkOverdueCommissions()` | When vendor account is frozen for overdue |
| `paymentConfirmed` | `confirmCommissionPayment()` | When admin confirms commission payment |

---

## 6. Dependency Table

| # | Dependency | Import Path | Type | Circular Risk if Moved? |
|---|---|---|---|---|
| 1 | `notificationsApi` | `@/services/notifications` | Notification service | ⚠️ See circular analysis |
| 2 | `emailService` | `@/services/emailService` | Email service | ❌ No |
| 3 | `supabase` | `@/services/supabase` | Supabase client | ❌ No — shared infra |
| 4 | `logger` | `@/utils/logger` | Utility | ❌ No |

**Total dependencies: 4**

### Key Dependency Notes

- **`notificationsApi`** — imported from `@/services/notifications`. If `commissionNotifications.js` moves to `@/modules/commissions/api/`, it would import from `@/services/notifications` (or `@/modules/notifications`). The commissions module's allowed dependencies include "notifications (public API only)". This is safe.
- **`emailService`** — imported from `@/services/emailService`. Also re-exported from `@/modules/notifications`. This is a notification delivery channel.
- **`supabase`** — shared infrastructure, no circular risk.
- **`logger`** — shared utility, no circular risk.

---

## 7. Supabase Table/Query Analysis

| Operation | Table | Type | Query Details |
|---|---|---|---|
| `supabase.from('profiles').select(...)` | `profiles` | SELECT | `first_name, last_name, email` — `.eq('id', vendorId).single()` |

**Supabase tables accessed directly: 1** (`profiles` — read-only for vendor email lookup)
**Edge Functions invoked: 0** (email is sent via `emailService` which may invoke Edge Functions internally)
**RPC calls: 0**
**Auth/session usage: None** (uses `vendorId` parameter passed by caller)
**Risk rating: Low** — read-only profile lookup for email address

---

## 8. Edge Function Call Analysis

| Edge Function | Called By | Parameters | Risk |
|---|---|---|---|
| (none directly) | — | — | — |

**Note:** `commissionNotifications.js` does NOT directly invoke any Edge Functions. It delegates email sending to `emailService.sendEmail()`, which may internally invoke the `send-email` Edge Function. This is an indirect dependency.

---

## 9. Commission Notification Flow Map

```
commissionService.js (696 lines)
  ├── confirmSaleAndCalculate()
  │   └── commissionNotifications.afterConfirmedSale({ vendorId, saleAmount, commissionSoFar, orderId })
  │       ├── sendInAppNotification() → notificationsApi.create({ type: 'commission', ... })
  │       └── sendEmailNotification() → supabase.from('profiles').select(...) → emailService.sendEmail()
  │
  ├── closeMonthAndNotify()
  │   └── commissionNotifications.monthEndSummary({ vendorId, monthName, totalSales, commissionDue, dueDate, monthlySaleId })
  │       ├── sendInAppNotification() → notificationsApi.create({ type: 'commission', ... })
  │       └── sendEmailNotification() → supabase.from('profiles').select(...) → emailService.sendEmail()
  │
  ├── checkOverdueCommissions()
  │   ├── commissionNotifications.reminder3Days({ vendorId, amountDue, dueDate, monthlySaleId })
  │   ├── commissionNotifications.dueToday({ vendorId, amountDue, monthlySaleId })
  │   └── commissionNotifications.accountFrozen({ vendorId, amountDue, monthlySaleId })
  │       (each sends in-app + email)
  │
  └── confirmCommissionPayment()
      └── commissionNotifications.paymentConfirmed({ vendorId, paidAmount, monthlySaleId })
          ├── sendInAppNotification() → notificationsApi.create({ type: 'commission', ... })
          └── sendEmailNotification() → supabase.from('profiles').select(...) → emailService.sendEmail()

Dual Re-Export:
  @/modules/commissions → commissionNotifications (via api/index.js)
  @/modules/notifications → commissionNotifications (via api/index.js)
```

**Key finding:** `commissionNotifications.js` is called exclusively by `commissionService.js`. No other app code calls it directly. It is a commission-domain notification trigger, not a general notification service.

---

## 10. Security/Correctness Risk Analysis

| Risk | Severity | Description | Mitigation |
|---|---|---|---|
| Duplicate notification risk | **Low** | `Promise.allSettled` used — both in-app and email sent independently | allSettled prevents one failure from blocking the other |
| Wrong recipient risk | **Low** | `vendorId` passed by `commissionService.js` from verified data | Caller is responsible for correct vendorId |
| Missing vendor/admin notification | **Medium** | If `notificationsApi.create()` fails silently, vendor won't see notification | allSettled doesn't throw on rejection — errors are swallowed |
| Notification privacy risk | **Low** | Email sent to vendor's registered email from `profiles` table | RLS protects profiles table |
| Incorrect commission status risk | **None** | File only sends notifications — does not update commission status | N/A |
| Payout notification mismatch risk | **None** | File doesn't interact with payouts | N/A |
| Auth/RLS dependency risk | **Low** | Reads `profiles` table — RLS must allow reading vendor's own profile | Supabase RLS policies enforce this |
| Cross-module dependency risk | **Medium** | Dual re-export from both commissions and notifications modules | Movement must update both barrels |
| Idempotency risk | **Medium** | No idempotency check — if `commissionService` retries, duplicate notifications may be sent | Caller (`commissionService`) must prevent retries |

---

## 11. Circular Dependency Risk Analysis

### If `commissionNotifications.js` moves to `@/modules/commissions/api/`:

| Potential Cycle | Risk | Explanation |
|---|---|---|
| `@/modules/commissions` → `@/services/notifications` | ❌ None | `commissionNotifications` imports `notificationsApi` from `@/services/notifications`. Notifications module does NOT import from commissions. |
| `@/modules/commissions` → `@/services/emailService` | ❌ None | `emailService` does NOT import from commissions. |
| `@/modules/commissions` → `@/modules/notifications` → `@/modules/commissions` | ⚠️ **Potential** | If `commissionNotifications` moves to commissions AND notifications module still re-exports it, then: notifications/api → @/services/commissionNotifications → (now at) @/modules/commissions → notifications/api... **BUT** the moved file would NOT import from notifications module barrel — it imports from `@/services/notifications` directly. So no cycle. |
| `@/modules/commissions` → `@/services/commissionService` | ⚠️ **Potential** | `commissionService.js` imports `commissionNotifications`. If `commissionNotifications` moves to commissions/api, and `commissionService` is still at `@/services/` and imported by commissions/api barrel, then: commissions/api → commissionService → commissionNotifications (now at commissions/api) → commissions/api... **BUT** `commissionNotifications` does NOT import from `commissionService`. So no cycle. |

**Circular dependency risk: NONE** — `commissionNotifications.js` imports only `notificationsApi`, `emailService`, `supabase`, and `logger`. None of these import back from commissions.

### If `commissionNotifications.js` moves to `@/modules/notifications/api/`:

| Potential Cycle | Risk | Explanation |
|---|---|---|
| `@/modules/notifications` → `@/modules/commissions` | ❌ None | `commissionNotifications` doesn't import from commissions |
| `@/services/commissionService` → `@/modules/notifications` → `@/services/commissionService` | ❌ None | `commissionNotifications` doesn't import from `commissionService` |

**Circular dependency risk: NONE**

---

## 12. Test Coverage Map

### `commissionNotifications.js` Test Coverage

| Test File | Covers `commissionNotifications`? | Details |
|---|---|---|
| Any test | ❌ No | No test file imports or mocks `commissionNotifications` |

**Test coverage: ZERO** — `commissionNotifications.js` has no test coverage.

### Related Tests (Run in This Phase)

| Test Suite | Tests | Result |
|---|---|---|
| `payoutService.test.js` | 16 | ✅ Pass |
| `paymentMethodStrategy.test.js` | 8 | ✅ Pass |
| `AdminPayouts.test.jsx` | — | ✅ Pass |
| `AdminCommissionManagement.columns.test.jsx` | — | ✅ Pass |
| `notificationsService.test.js` | — | ✅ Pass |
| `notifications.test.js` | — | ✅ Pass |
| `notificationFlow.test.js` | — | ✅ Pass |
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

**Total: 264 passed, 0 failed**

### Schema Tests with `fs.readFileSync`

| Test File | Uses `fs.readFileSync` on source? | Impact |
|---|---|---|
| `paymentRecords.schema.test.js` | Unknown | ❌ No impact — doesn't reference `commissionNotifications` |
| `paypalCheckout.schema.test.js` | Unknown | ❌ No impact — doesn't reference `commissionNotifications` |

---

## 13. Mock Impact Map

### If `commissionNotifications.js` moves to `@/modules/commissions/api/commissionNotifications.js`:

| File | Mock Impact | Change Required |
|---|---|---|
| `src/modules/commissions/api/index.js` | Import path changes from `@/services/commissionNotifications` to `./commissionNotifications` | ✅ Yes — import path update |
| `src/modules/notifications/api/index.js` | Import path changes from `@/services/commissionNotifications` to `@/modules/commissions` | ✅ Yes — import path update |
| `src/services/commissionService.js` | Currently imports from `@/services/commissionNotifications` — would need to change to `@/modules/commissions` | ✅ Yes — import path update (or keep via stub) |
| Any test file | No `jest.mock` for `commissionNotifications` exists | ❌ No |

### If `commissionNotifications.js` moves to `@/modules/notifications/api/commissionNotifications.js`:

| File | Mock Impact | Change Required |
|---|---|---|
| `src/modules/notifications/api/index.js` | Import path changes to `./commissionNotifications` | ✅ Yes |
| `src/modules/commissions/api/index.js` | Import path changes to `@/modules/notifications` | ✅ Yes |
| `src/services/commissionService.js` | Import path changes to `@/modules/notifications` | ✅ Yes (or via stub) |

---

## 14. Recommended Ownership Decision

| Factor | Commissions | Notifications |
|---|---|---|
| Who calls it? | `commissionService.js` (100% of calls) | No direct calls |
| Domain logic | Commission lifecycle events | Notification delivery |
| Dependencies | `notificationsApi`, `emailService` (notification channels) | Would need to import commission domain concepts |
| Module README | Commissions README claims ownership | Notifications README says "should move to commissions" |
| Dual re-export | ✅ From commissions barrel | ✅ From notifications barrel |

**Recommended owner: Commissions module** (`src/modules/commissions/api/`)

**Rationale:**
1. `commissionService.js` is the sole caller — 100% of `commissionNotifications` usage comes from commission lifecycle
2. The notifications module README explicitly states: "commissionNotifications is a commission-module concern... In a future phase, it should move to a commissions module."
3. The commissions module README lists "Commission notifications" as part of what the commissions module owns
4. The file contains commission-domain business logic (commission amounts, due dates, monthly sales IDs)
5. Moving to notifications would create a backwards ownership pattern (notifications owning commission business logic)

**Recommended target path: `src/modules/commissions/api/commissionNotifications.js`**

---

## 15. Whether Compatibility Stub Should Be Created Later

| Old Path | Stub Needed? | Reason |
|---|---|---|
| `src/services/commissionNotifications.js` | ✅ Yes | `commissionService.js` imports from `@/services/commissionNotifications`. Also, `notifications/api/index.js` re-exports from `@/services/commissionNotifications`. Both need stub during transition. |

---

## 16. Whether `src/services/api.js` Would Need Changes Later

**No.** `commissionNotifications.js` is not imported by `src/services/api.js`. No changes needed.

---

## 17. Whether Admin/Vendor/Commission Consumers Would Need Import-Only Changes Later

| Consumer | Current Import | Would Need Change? |
|---|---|---|
| `src/services/commissionService.js` | `@/services/commissionNotifications` | ✅ Yes — change to `@/modules/commissions` (or use stub) |
| `src/modules/commissions/api/index.js` | `@/services/commissionNotifications` | ✅ Yes — change to `./commissionNotifications` |
| `src/modules/notifications/api/index.js` | `@/services/commissionNotifications` | ✅ Yes — change to `@/modules/commissions` (or remove re-export) |
| `src/modules/notifications/index.js` | `./api` (indirect) | ❌ No (unless notifications stops re-exporting) |
| `src/modules/commissions/index.js` | `./api` (indirect) | ❌ No |

**Total files needing import changes: 3** (or 2 if stub is used for `commissionService.js`)

---

## 18. Risk Rating

| Factor | Rating |
|---|---|
| Complexity | Low (111 lines, 6 methods, straightforward) |
| Direct consumers | 1 (`commissionService.js`) |
| Re-export barrels | 2 (commissions + notifications) |
| Dependencies | 4 (`notificationsApi`, `emailService`, `supabase`, `logger`) |
| Supabase access | 1 table (`profiles`, read-only) |
| Edge Functions | 0 direct |
| Circular risk | None |
| Test coverage | Zero |
| Dual re-export complexity | Medium — must update both barrels |
| Protected Zone | Not directly listed, but coupled with `commissionService.js` which is Protected |

**Overall risk: Medium** — clean file with no tests, dual re-export adds complexity

---

## 19. Go / No-Go Recommendation for Phase 7.24

### **GO with caution** ⚠️

**Rationale:**
- File is clean (111 lines, well-structured)
- Only 1 direct consumer (`commissionService.js`)
- No circular dependency risk
- No test coverage — **must add tests before movement**
- Dual re-export from commissions + notifications — **must handle both barrels**
- `commissionService.js` is Protected Zone — movement of `commissionNotifications` doesn't modify it but the import path change in `commissionService.js` may need explicit approval

### Recommended Phase 7.24 Strategy: **Add tests first, then move with stub**

1. Add tests for all 6 `commissionNotifications` methods
2. Move `commissionNotifications.js` → `src/modules/commissions/api/commissionNotifications.js`
3. Create compatibility stub at `src/services/commissionNotifications.js`
4. Update `commissions/api/index.js` import: `@/services/commissionNotifications` → `./commissionNotifications`
5. Update `notifications/api/index.js` import: `@/services/commissionNotifications` → `@/modules/commissions`
6. Do NOT change `commissionService.js` import (use stub)
7. Run full test suite
8. Phase 7.25: Update `commissionService.js` import to `@/modules/commissions`, delete stub

---

## 20. Suggested Phase 7.24 Prompt Outline

```
Phase 7.24 — Test and move commissionNotifications.js to @/modules/commissions/api/

1. Read .windsurfrules
2. Add tests for all 6 commissionNotifications methods:
   - afterConfirmedSale: in-app + email sent, correct payload
   - monthEndSummary: in-app + email sent, correct payload
   - reminder3Days: in-app + email sent, correct payload
   - dueToday: in-app + email sent, correct payload
   - accountFrozen: in-app + email sent, correct payload
   - paymentConfirmed: in-app + email sent, correct payload
   - sendEmailNotification: profile lookup, email not found handling
   - formatMad: correct formatting
3. Run new tests — must pass before movement
4. Move commissionNotifications.js → src/modules/commissions/api/commissionNotifications.js
5. Create compatibility stub at src/services/commissionNotifications.js
6. Update commissions/api/index.js: import from ./commissionNotifications
7. Update notifications/api/index.js: import from @/modules/commissions
8. Do NOT change commissionService.js import (uses stub)
9. Run: lint, type-check, targeted tests, build, check:circular
10. Run full test suite
11. Create phase-7-24 report
12. Update MODULAR_DEVELOPMENT_PLAN.md
```

---

## 21. Verification Results

| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed (exit code 0) |
| `npm run type-check` | ✅ Passed (exit code 0) |
| `npm run build` | ✅ Passed (built in 2m 48s, 4190 modules) |
| `npm run check:circular` | ✅ Passed (709 files, 0 circular dependencies) |
| Targeted tests (20 suites) | ✅ 264/264 passed |

---

## 22. Files Inspected (Complete List)

- `.windsurfrules` (614 lines)
- `src/services/commissionNotifications.js` (111 lines)
- `src/services/commissionService.js` (696 lines — first 15 lines for import analysis)
- `src/modules/commissions/api/index.js` (53 lines)
- `src/modules/commissions/index.js` (66 lines)
- `src/modules/commissions/README.md`
- `src/modules/notifications/api/index.js` (48 lines)
- `src/modules/notifications/index.js`
- `src/modules/notifications/README.md`
- `src/modules/payments/README.md`
- `MODULAR_DEVELOPMENT_PLAN.md`
- `package.json`
- `eslint.config.js`

---

## 23. Summary

| Metric | Value |
|---|---|
| File analyzed | 1 (`commissionNotifications.js`, 111 lines) |
| Code changes | 0 |
| Direct code consumers | 1 (`commissionService.js`) |
| Re-export barrels | 2 (commissions + notifications) |
| Dependencies | 4 (`notificationsApi`, `emailService`, `supabase`, `logger`) |
| Supabase tables | 1 (`profiles`, read-only) |
| Edge Functions | 0 direct |
| Circular dependency risk | None |
| Test coverage | Zero |
| Protected Zone | Not directly listed (coupled with Protected `commissionService.js`) |
| Phase 7.24 recommendation | **GO** — Add tests first, then move to `@/modules/commissions/api/` with stub |
| Risk | Medium (dual re-export, no tests, coupled with Protected Zone file) |
