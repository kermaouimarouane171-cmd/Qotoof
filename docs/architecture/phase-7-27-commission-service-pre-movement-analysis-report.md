# Phase 7.27 — Commission Service Pre-Movement Analysis Report

**Phase:** 7.27 — Pre-Movement Analysis for `commissionService.js`
**Date:** 2026-06-26
**Status:** ✅ Analysis complete — No code changes made

---

## 1. Confirmation: `.windsurfrules` Was Read and Followed

✅ `.windsurfrules` (614 lines) was read in full and strictly followed.

- ✅ **Section 37 — Protected Zone:** `commissionService.js` is listed as Protected Zone. This phase was analysis-only — no modifications were made.
- ✅ No `any`, `@ts-ignore`, `@ts-expect-error`.

---

## 2. Confirmation: This Phase Was Analysis Only

✅ No files were modified, moved, created, or deleted. No imports were rewritten. No stubs were created or deleted. No production code was changed.

---

## 3. Confirmation: `commissionService.js` Was Not Modified

✅ `src/services/commissionService.js` (696 lines) was read and analyzed but NOT modified.

---

## 4. Protected Zone Requirements

### Why `commissionService.js` Is Protected

Per `.windsurfrules` Section 37, the commission system (`src/services/commissionService.js`) is a Protected Zone because:

1. **Financial risk** — handles 3% commission calculation on all vendor sales
2. **Money flow** — manages commission lifecycle (active → pending → paid / overdue)
3. **Account freezing** — can freeze/unfreeze vendor accounts (`profiles.is_active`)
4. **Payment tracking** — records payment notices and confirms payments
5. **Notification triggers** — sends commission notifications to vendors and admins

### What Changes Are Forbidden Without Explicit Approval

- Commission calculation logic (COMMISSION_RATE = 0.03)
- Commission status transitions (active → pending → paid / overdue)
- Vendor account freezing/unfreezing logic
- Payment notice submission logic
- Commission payment confirmation logic
- Supabase queries (table names, columns, filters)
- Notification payload shapes
- Return shapes from any method

### What Future Movement Would Require

1. **Separate analysis phase** (this phase — 7.27)
2. **Comprehensive tests added before movement** (Phase 7.28)
3. **Explicit user approval** for movement (Phase 7.29)
4. **Compatibility stub** at old path after movement
5. **Import adoption** for all consumers (Phase 7.30)
6. **Stub deletion** after zero-consumer search (Phase 7.31)

### Whether Explicit Approval Will Be Needed in Phase 7.28+

**Yes.** Any phase that modifies `commissionService.js` (including file movement) requires explicit user approval per Section 37.

---

## 5. Target File Overview

| Property | Value |
|---|---|
| File | `src/services/commissionService.js` |
| Lines | 696 |
| Exports | 10 named + 1 default |
| Complexity | High — financial logic, multi-table Supabase operations, notification triggers |
| Test coverage | **Zero** — no dedicated test file exists |

### Internal Helpers (not exported)

| Helper | Lines | Responsibility |
|---|---|---|
| `getMonthYear(date)` | 15–18 | Returns `{ month, year }` from date |
| `getMonthNameAr(month, year)` | 20–23 | Returns Arabic month name + year string |
| `buildMonthLabel(month, year)` | 25 | Alias for `getMonthNameAr` |
| `daysRemaining(dueDate)` | 27–31 | Calculates days remaining until due date |
| `ensureMonthlySale(vendorId, month, year)` | 33–65 | Gets or creates `vendor_monthly_sales` record |
| `insertCommissionNotificationIfMissing(...)` | 67–90 | Dedup guard for `commission_notifications` table |
| `getAdminUsers()` | 92–101 | Fetches active admin profiles |

### Constants (not exported)

| Constant | Value | Purpose |
|---|---|---|
| `COMMISSION_RATE` | 0.03 | 3% commission rate |
| `PAYMENT_DEADLINE_DAYS` | 7 | Days to pay after month-end |
| `MANUAL_UNFREEZE_GRACE_DAYS` | 3 | Grace days after manual unfreeze |

### Complexity Hotspots

1. **`confirmSaleAndCalculate`** (lines 105–240, 136 lines) — Largest method. Multi-table: orders, confirmed_transactions, vendor_contracts, profiles, vendor_monthly_sales. Duplicate detection, contract validation, account freeze check, commission calculation, notification trigger.
2. **`checkOverdueCommissions`** (lines 313–407, 95 lines) — Iterates pending commissions, sends reminders/due-today/freeze notifications, freezes accounts.
3. **`closeMonthAndNotify`** (lines 243–310, 68 lines) — Closes previous month, sets status/due_date, sends month-end summaries, creates new month records.

### Money-Sensitive Areas

| Area | Risk |
|---|---|
| Commission calculation (`parsedAmount * COMMISSION_RATE`) | Incorrect amount → financial loss |
| `commission_due` / `commission_paid` updates | Wrong status → wrong payment expectation |
| Account freezing (`profiles.is_active = false`) | Wrong freeze → vendor cannot sell |
| Account unfreezing (`profiles.is_active = true`) | Wrong unfreeze → vendor sells without paying |
| Payment confirmation (`status = 'paid'`) | Wrong confirmation → vendor thinks paid when not |
| Duplicate transaction detection | Missing dedup → double commission |

---

## 6. Exports Table

| # | Export Name | Type | Responsibility | Supabase Tables | Edge Functions | Triggers Notifications | Triggers Payouts | Changes Commission Status | Risk | Test Coverage | Can Move Unchanged | Should Split Before Movement |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `commissionService` (object) | Named | Main service object with all 8 methods | All below | None | Yes (via commissionNotifications + notificationsApi) | No | Yes | **High** | **None** | Yes | No (object pattern) |
| 2 | `confirmSaleAndCalculate` | Named (wrapper) | Confirm sale, calculate 3% commission, record transaction | orders, confirmed_transactions, vendor_contracts, profiles, vendor_monthly_sales | None | Yes (commissionNotifications.afterConfirmedSale) | No | Yes (active) | **High** | **None** | Yes | No |
| 3 | `closeMonthAndNotify` | Named (wrapper) | Close previous month, set status/due_date, send summaries | vendor_monthly_sales, commission_notifications | None | Yes (commissionNotifications.monthEndSummary) | No | Yes (active→pending/paid) | **High** | **None** | Yes | No |
| 4 | `checkOverdueCommissions` | Named (wrapper) | Check pending commissions, send reminders, freeze overdue | vendor_monthly_sales, profiles, commission_notifications | None | Yes (commissionNotifications.reminder3Days/dueToday/accountFrozen) | No | Yes (pending→overdue) | **High** | **None** | Yes | No |
| 5 | `submitPaymentNotice` | Named (wrapper) | Vendor submits payment notice to admin | vendor_monthly_sales, commission_notifications | None | Yes (notificationsApi.create to admins) | No | No | **Medium** | **None** | Yes | No |
| 6 | `confirmCommissionPayment` | Named (wrapper) | Admin confirms commission payment, unfreeze account | vendor_monthly_sales, profiles, commission_notifications | None | Yes (commissionNotifications.paymentConfirmed) | No | Yes (pending→paid) | **High** | **None** | Yes | No |
| 7 | `getCurrentMonthSummary` | Named (wrapper) | Get current month commission summary for vendor | profiles, vendor_monthly_sales, confirmed_transactions | None | No | No | No | **Low** | **None** | Yes | No |
| 8 | `getVendorCommissionHistory` | Named (wrapper) | Get full commission history for vendor | vendor_monthly_sales | None | No | No | No | **Low** | **None** | Yes | No |
| 9 | `manuallyUnfreezeVendor` | Named (wrapper) | Admin manually unfreezes vendor with grace period | vendor_monthly_sales, profiles, commission_notifications | None | Yes (notificationsApi.create to vendor) | No | Yes (overdue→pending) | **High** | **None** | Yes | No |
| 10 | `default` | Default | Same as `commissionService` object | All above | None | Yes | No | Yes | **High** | **None** | Yes | No |

---

## 7. Consumer Table

| # | Consumer File | Import Path | Symbols Used | Role/Domain | Import-Only Migration Safe? | Mock Updates Required? |
|---|---|---|---|---|---|---|
| 1 | `src/modules/commissions/api/index.js` | `@/services/commissionService` | `commissionService`, all 8 wrappers, `default` | Commissions barrel re-export | ✅ Yes — change to `./commissionService` | No |
| 2 | `src/pages/admin/CommissionManagement.jsx` | `@/modules/commissions` | `commissionService` (confirmCommissionPayment, manuallyUnfreezeVendor) | Admin UI | ✅ Yes — already uses module barrel | No |
| 3 | `src/components/vendor/CommissionDashboard.jsx` | `@/modules/commissions` | `commissionService` (getCurrentMonthSummary, getVendorCommissionHistory, submitPaymentNotice) | Vendor UI | ✅ Yes — already uses module barrel | No |

### Consumers NOT Using commissionService Directly (Doc/Placeholder Only)

| File | Reference Type | Notes |
|---|---|---|
| `src/modules/commissions/data/index.js` | Comment | Placeholder — no import |
| `src/modules/commissions/domain/index.js` | Comment | Placeholder — no import |
| `src/modules/commissions/utils/index.js` | Comment | Placeholder — no import |
| `src/modules/commissions/hooks/index.js` | Comment | Placeholder — no import |
| `src/modules/commissions/stores/index.js` | Comment | Placeholder — no import |
| `src/modules/commissions/README.md` | Documentation | 25 matches — all doc references |
| `src/modules/notifications/README.md` | Documentation | 4 matches — relationship docs |
| `src/modules/payments/README.md` | Documentation | 4 matches — relationship docs |
| `src/modules/admin/README.md` | Documentation | 2 matches — relationship docs |
| `src/modules/checkout/README.md` | Documentation | 1 match — forbidden dependency list |

### Key Finding

**Only 1 consumer imports from `@/services/commissionService` directly:** `src/modules/commissions/api/index.js` (the barrel). The 2 UI components already import from `@/modules/commissions`. This means:

- **Movement impact is minimal** — only the barrel needs updating
- **Import adoption for UI components is already done** — they use `@/modules/commissions`
- **No test mocks to update** — zero test files reference `commissionService`

---

## 8. Dependency Table

| # | Dependency | Import Path | Module Owner | Risk | Future Movement Impact |
|---|---|---|---|---|---|
| 1 | `supabase` | `@/services/supabase` | Shared infrastructure | Low | No change needed — shared service |
| 2 | `notificationsApi` | `@/services/notifications` | Notifications (not yet moved) | Low | If notifications.js moves later, import path would need adoption |
| 3 | `commissionNotifications` | `@/modules/commissions` | Commissions module (moved Phase 7.24) | **Medium** | **Circular dependency risk** — see Section 14 |
| 4 | `logger` | `@/utils/logger` | Shared utilities | Low | No change needed |

### Critical Circular Dependency Risk

**`commissionService.js` imports `commissionNotifications` from `@/modules/commissions`** (line 8).

If `commissionService.js` moves to `src/modules/commissions/api/commissionService.js`, then:
- `commissions/api/index.js` would import from `./commissionService` (local)
- `commissionService.js` would import `commissionNotifications` from `@/modules/commissions` (the barrel)
- `commissions/index.js` re-exports from `./api`
- `commissions/api/index.js` re-exports from `./commissionNotifications` and `./commissionService`

**This creates a potential circular dependency:**
```
commissions/index.js → commissions/api/index.js → commissionService.js → @/modules/commissions (index.js) → ...
```

**Mitigation:** After movement, `commissionService.js` should import `commissionNotifications` from `./commissionNotifications` (local relative import) instead of `@/modules/commissions` (barrel). This is the same pattern used in Phase 7.24 for the barrel update.

---

## 9. Supabase Table/Query Analysis

| # | Table | Operations | Methods Using It | Read/Write | Money/Status Risk | RLS Dependency | Idempotency |
|---|---|---|---|---|---|---|---|
| 1 | `vendor_monthly_sales` | select, insert, update | All 8 methods | Read + Write | **High** — commission_due, commission_paid, status, due_date | Yes — vendor sees own, admin sees all | `ensureMonthlySale` has get-or-create pattern |
| 2 | `confirmed_transactions` | select, insert | confirmSaleAndCalculate, getCurrentMonthSummary | Read + Write | **High** — commission_amount, sale_amount | Yes — vendor sees own | Duplicate check via `order_id` lookup |
| 3 | `orders` | select | confirmSaleAndCalculate | Read-only | Low — read for validation | Yes | N/A |
| 4 | `vendor_contracts` | select | confirmSaleAndCalculate | Read-only | Low — contract validation | Yes | N/A |
| 5 | `profiles` | select, update | confirmSaleAndCalculate, checkOverdueCommissions, confirmCommissionPayment, manuallyUnfreezeVendor, getCurrentMonthSummary, getAdminUsers | Read + Write | **High** — `is_active` flag controls vendor freeze | Yes | N/A |
| 6 | `commission_notifications` | select, insert | closeMonthAndNotify, checkOverdueCommissions, submitPaymentNotice, confirmCommissionPayment, manuallyUnfreezeVendor | Read + Write | Medium — dedup guard | Yes | `insertCommissionNotificationIfMissing` — check before insert |

### RPC Calls

**None.** `commissionService.js` does not use any Supabase RPC functions.

---

## 10. Edge Function/RPC Analysis

**No Edge Functions are called directly by `commissionService.js`.**

- `payoutService.sendPayout()` calls `send-payout` Edge Function, but `commissionService.js` does not import or call `payoutService`.
- `emailService.sendEmail()` calls `send-email` Edge Function, but `commissionService.js` does not import or call `emailService` directly (it goes through `commissionNotifications`).

---

## 11. Commission Flow Map

### Commission Creation Flow
```
Order confirmed → commissionService.confirmSaleAndCalculate(orderId, vendorId, saleAmount)
  → Validate order exists (orders table)
  → Check duplicate (confirmed_transactions by order_id)
  → Check active contract (vendor_contracts)
  → Check account not frozen (profiles.is_active)
  → Get/create monthly sale (vendor_monthly_sales)
  → Insert confirmed_transaction
  → Update monthly totals (total_sales, commission_due)
  → Trigger commissionNotifications.afterConfirmedSale()
```

### Month-End Closing Flow
```
commissionService.closeMonthAndNotify()
  → Find previous month's vendor_monthly_sales with total_sales > 0
  → For each: calculate commission_due, set status (paid/pending), set due_date
  → If unpaid: insert commission_notifications (month_end), trigger commissionNotifications.monthEndSummary()
  → Create new month records (ensureMonthlySale)
```

### Overdue Check Flow
```
commissionService.checkOverdueCommissions()
  → Find pending vendor_monthly_sales with due_date
  → For each: calculate daysRemaining
    → 3 days remaining: insert notification, trigger reminder3Days
    → 0 days remaining: insert notification, trigger dueToday
    → < 0 days (overdue): set status='overdue', freeze profile, insert notification, trigger accountFrozen
```

### Payment Notice Flow
```
Vendor submits payment → commissionService.submitPaymentNotice(vendorId, monthlySaleId, method, reference, note)
  → Validate inputs
  → Update vendor_monthly_sales (payment_method, payment_reference)
  → Insert commission_notifications (vendor_payment_notice)
  → Notify all admins via notificationsApi.create()
```

### Payment Confirmation Flow
```
Admin confirms payment → commissionService.confirmCommissionPayment(vendorId, month, year, method, reference)
  → Fetch vendor_monthly_sales
  → Check if already paid (idempotency)
  → Update: commission_paid, status='paid', paid_at, payment_method, payment_reference
  → Unfreeze profile (is_active = true)
  → Insert commission_notifications (paid_confirmed)
  → Trigger commissionNotifications.paymentConfirmed()
```

### Manual Unfreeze Flow
```
Admin unfreezes → commissionService.manuallyUnfreezeVendor(vendorId, monthlySaleId, note, graceDays)
  → Validate note required
  → Set new due_date (now + graceDays)
  → Update vendor_monthly_sales: status='pending', due_date
  → Update profiles: is_active = true
  → Insert commission_notifications (manual_unfreeze)
  → Notify vendor via notificationsApi.create()
```

---

## 12. Payout/Payment Interaction Map

| Interaction | Direction | Details |
|---|---|---|
| `commissionService` → `payoutService` | **None** | `commissionService` does NOT import or call `payoutService` |
| `commissionService` → payments module | **None** | No direct import from `@/modules/payments` |
| `commissionService` → PayPal/CMI | **None** | No payment provider integration |
| `payoutService` → `commissionService` | **None** | `payoutService` does not import `commissionService` |

**Key finding:** `commissionService` is financially focused on commission calculation and tracking, NOT on payout execution. Payouts are handled separately by `payoutService`.

---

## 13. Notification/Email Interaction Map

| Trigger | Notification Channel | Recipient | Method |
|---|---|---|---|
| Sale confirmed | In-app + Email | Vendor | `commissionNotifications.afterConfirmedSale()` |
| Month-end summary | In-app + Email | Vendor | `commissionNotifications.monthEndSummary()` |
| 3-day reminder | In-app + Email | Vendor | `commissionNotifications.reminder3Days()` |
| Due today | In-app + Email | Vendor | `commissionNotifications.dueToday()` |
| Account frozen | In-app + Email | Vendor | `commissionNotifications.accountFrozen()` |
| Payment confirmed | In-app + Email | Vendor | `commissionNotifications.paymentConfirmed()` |
| Payment notice submitted | In-app only | Admin(s) | `notificationsApi.create()` directly |
| Manual unfreeze | In-app only | Vendor | `notificationsApi.create()` directly |

**Key finding:** `commissionService` uses two notification channels:
1. `commissionNotifications.*()` — for vendor-facing commission lifecycle notifications (in-app + email)
2. `notificationsApi.create()` — for admin notifications (payment notice) and vendor manual unfreeze notification (in-app only)

---

## 14. Circular Dependency Risk Analysis

### Current State (Before Movement)

```
commissionService.js (src/services/)
  → imports commissionNotifications from @/modules/commissions
    → commissions/index.js → commissions/api/index.js → ./commissionNotifications

commissions/api/index.js
  → imports commissionService from @/services/commissionService
  → imports commissionNotifications from ./commissionNotifications
```

**Current circular check:** No cycle. `commissionService.js` is in `src/services/`, not inside the module.

### After Hypothetical Movement

If `commissionService.js` moves to `src/modules/commissions/api/commissionService.js`:

```
Scenario A (naive — keep barrel import):
  commissions/index.js → commissions/api/index.js → ./commissionService
    → commissionService.js imports @/modules/commissions (index.js) → CYCLE!

Scenario B (fix — use local import):
  commissions/api/index.js → ./commissionService
    → commissionService.js imports ./commissionNotifications (local)
  commissions/api/index.js → ./commissionNotifications
  No cycle.
```

**Mitigation:** After movement, change `commissionService.js` line 8 from:
```js
import { commissionNotifications } from '@/modules/commissions'
```
to:
```js
import { commissionNotifications } from './commissionNotifications'
```

This is the same pattern used in Phase 7.24 when `commissionNotifications.js` was moved.

### Risk with Other Modules

| Module | Circular Risk? | Explanation |
|---|---|---|
| `@/modules/payments` | No | `commissionService` does not import from payments |
| `@/modules/notifications` | No | `commissionService` imports `notificationsApi` from `@/services/notifications`, not from notifications module |
| `@/modules/admin` | No | No import relationship |
| `@/modules/users` | No | No import relationship |
| `@/modules/orders` | No | `commissionService` reads `orders` table directly via Supabase, does not import orders module |
| `@/services/api.js` | No | Not imported by `commissionService` |
| Admin/vendor pages | No | Pages import from `@/modules/commissions`, not from `commissionService` directly |

---

## 15. Test Coverage Map

| Test File | Behavior Covered | Behavior Not Covered | Enough Before Movement? | Mocks Use Old Paths? |
|---|---|---|---|---|
| **None — no commissionService tests exist** | N/A | All 8 methods + 7 helpers + 3 constants | ❌ **No — tests must be added first** | N/A |
| `commissionNotifications.test.js` (21 tests) | All 6 commissionNotifications methods | Does not test commissionService methods | N/A (tests commissionNotifications, not commissionService) | No — imports from `@/modules/commissions` |
| `payoutService.test.js` | sendPayout | Does not test commissionService | N/A | No |
| `paymentMethodStrategy.test.js` | getPayoutStrategy, validateRecipient | Does not test commissionService | N/A | No |
| `AdminCommissionManagement.columns.test.jsx` | Column rendering | Does not test commissionService logic | N/A | No |
| `AdminPayouts.test.jsx` | Payout page rendering | Does not test commissionService | N/A | No |
| `checkout.integration.test.js` | Checkout flow | Does not test commissionService | N/A | No |
| `orderFlow.integration.test.js` | Order flow | Does not test commissionService | N/A | No |

### Test Coverage Gap Analysis

**Critical: Zero test coverage for `commissionService.js`.** This is a 696-line Protected Zone file with 8 methods handling financial logic. Tests MUST be added before any movement.

### Recommended Test Plan for Phase 7.28

| Method | Recommended Tests | Key Scenarios |
|---|---|---|
| `confirmSaleAndCalculate` | 8–10 | Valid sale, invalid inputs, duplicate detection, missing contract, frozen account, order not found, Supabase error, commission calculation accuracy |
| `closeMonthAndNotify` | 5–7 | Normal close, all paid, all pending, mixed, empty month, Supabase error, notification dedup |
| `checkOverdueCommissions` | 6–8 | 3-day reminder, due today, overdue freeze, no pending, multiple vendors, notification dedup, Supabase error |
| `submitPaymentNotice` | 4–5 | Valid notice, missing fields, monthly sale not found, admin notification, Supabase error |
| `confirmCommissionPayment` | 5–6 | Normal confirm, already paid (idempotency), account unfreeze, notification trigger, Supabase error |
| `getCurrentMonthSummary` | 3–4 | Normal summary, no monthly sale (auto-create), frozen account, Supabase error |
| `getVendorCommissionHistory` | 2–3 | Normal history, empty history, Supabase error |
| `manuallyUnfreezeVendor` | 4–5 | Valid unfreeze, missing note, monthly sale not found, account reactivation, Supabase error |
| Internal helpers | 3–5 | `ensureMonthlySale` create vs get, `insertCommissionNotificationIfMissing` dedup, `getAdminUsers`, `daysRemaining`, `getMonthNameAr` |
| Default export | 1 | Identity check |
| **Total** | **~41–54 tests** | |

---

## 16. Mock Impact Map

| Mock Target | Current Path | Tests Using It | After Movement |
|---|---|---|---|
| `@/services/supabase` | `@/services/supabase` | Future tests | No change needed |
| `@/services/notifications` | `@/services/notifications` | Future tests | No change needed (notifications.js not yet moved) |
| `@/modules/commissions` | `@/modules/commissions` | Future tests for `commissionNotifications` | After movement, mock `./commissionNotifications` locally |
| `@/utils/logger` | `@/utils/logger` | Future tests | No change needed |

**No existing test mocks need updating** because no commissionService tests exist yet.

---

## 17. Recommended Ownership Decision

**Recommendation: Move `commissionService.js` to `src/modules/commissions/api/commissionService.js` — but ONLY after comprehensive tests are added first.**

Rationale:
- ✅ Only 1 direct consumer (`commissions/api/index.js` barrel) — minimal migration impact
- ✅ UI components already use `@/modules/commissions` — no import adoption needed for them
- ✅ No test mocks to update — no commissionService tests exist yet
- ✅ No Edge Functions called directly
- ✅ No RPC calls
- ✅ Circular dependency risk is mitigable (use local import for `commissionNotifications`)
- ❌ **Zero test coverage** — MUST add tests first (Phase 7.28)
- ❌ **Protected Zone** — requires explicit approval for movement

---

## 18. Recommended Target Path If Moved Later

```
src/modules/commissions/api/commissionService.js
```

Same directory as `commissionNotifications.js`, `payoutService.js`, and `paymentMethodStrategy.js`.

---

## 19. Whether Compatibility Stub Should Be Created Later

**Yes.** A compatibility stub should be created at `src/services/commissionService.js` after movement, re-exporting from `@/modules/commissions`. This follows the established pattern (Phases 7.21, 7.24).

The stub would be:
```js
export {
  commissionService,
  confirmSaleAndCalculate,
  closeMonthAndNotify,
  checkOverdueCommissions,
  submitPaymentNotice,
  confirmCommissionPayment,
  getCurrentMonthSummary,
  getVendorCommissionHistory,
  manuallyUnfreezeVendor,
  commissionServiceDefault as default,
} from '@/modules/commissions'
```

---

## 20. Whether `src/services/api.js` Would Need Changes Later

**No.** `commissionService.js` is not imported by `src/services/api.js` (if it exists). The only direct consumer is `src/modules/commissions/api/index.js`.

---

## 21. Whether Admin/Vendor/Commission Consumers Would Need Import-Only Changes Later

| Consumer | Current Import | Needs Change? |
|---|---|---|
| `src/modules/commissions/api/index.js` | `@/services/commissionService` | ✅ Yes — change to `./commissionService` |
| `src/pages/admin/CommissionManagement.jsx` | `@/modules/commissions` | ❌ No — already uses module barrel |
| `src/components/vendor/CommissionDashboard.jsx` | `@/modules/commissions` | ❌ No — already uses module barrel |

**Only 1 file needs import update during movement.**

---

## 22. Risk Rating

| Category | Rating | Notes |
|---|---|---|
| Overall movement risk | **Medium-High** | Protected Zone, 696 lines, financial logic, zero tests |
| Complexity risk | **High** | 8 methods, 7 helpers, 3 constants, 6 Supabase tables |
| Circular dependency risk | **Low** (mitigable) | Fix: use local import for commissionNotifications |
| Consumer migration risk | **Low** | Only 1 barrel to update |
| Test coverage risk | **Critical** | Zero tests — must add before movement |
| Notification risk | **Medium** | 8 notification trigger points |
| Account freeze risk | **High** | 3 methods can freeze/unfreeze accounts |
| Financial calculation risk | **High** | Commission calculation, payment tracking |

---

## 23. Go / No-Go Recommendation for Phase 7.28

### **GO — with conditions**

Phase 7.28 should be: **Add comprehensive tests for `commissionService.js` (all 8 methods + internal helpers).**

Conditions:
1. Tests must be added BEFORE any movement
2. Tests must mock `supabase`, `notificationsApi`, `commissionNotifications`, and `logger`
3. Tests must cover all money-sensitive paths (commission calculation, account freeze/unfreeze, payment confirmation, duplicate detection)
4. Tests must cover error paths (Supabase errors, missing records, invalid inputs)
5. Estimated 41–54 tests needed
6. No movement in Phase 7.28 — tests only

### **NO-GO for direct movement in Phase 7.28**

Direct movement without tests is NOT recommended because:
- 696-line Protected Zone file with zero test coverage
- Financial logic with 8 money-sensitive methods
- Account freezing/unfreezing capability
- Multi-table Supabase operations

---

## 24. Suggested Phase 7.28 Prompt Outline

```
Phase 7.28 — Add comprehensive tests for commissionService.js

1. Read .windsurfrules (Section 37 — Protected Zone)
2. Read src/services/commissionService.js (696 lines)
3. Create src/__tests__/services/commissionService.test.js
4. Mock: @/services/supabase, @/services/notifications, @/modules/commissions, @/utils/logger
5. Test all 8 public methods:
   - confirmSaleAndCalculate (8-10 tests)
   - closeMonthAndNotify (5-7 tests)
   - checkOverdueCommissions (6-8 tests)
   - submitPaymentNotice (4-5 tests)
   - confirmCommissionPayment (5-6 tests)
   - getCurrentMonthSummary (3-4 tests)
   - getVendorCommissionHistory (2-3 tests)
   - manuallyUnfreezeVendor (4-5 tests)
6. Test internal helpers: ensureMonthlySale, insertCommissionNotificationIfMissing, getAdminUsers, daysRemaining, getMonthNameAr
7. Test default export identity
8. Test error resilience for all methods
9. Run targeted tests
10. Run: lint, type-check, build, check:circular
11. Run full test suite
12. Create phase-7-28 report
13. Update MODULAR_DEVELOPMENT_PLAN.md
14. Do NOT move commissionService.js
15. Do NOT create stub
16. Do NOT modify commissionService.js
```

---

## 25. Suggested Future Phase Plan

| Phase | Action | Risk | Tests First? |
|---|---|---|---|
| 7.28 | Add comprehensive tests for commissionService.js (41–54 tests) | Low — test-only | N/A |
| 7.29 | Move commissionService.js to commissions/api/ + stub + fix commissionNotifications import to local | High — Protected Zone | ✅ (7.28) |
| 7.30 | Import adoption — update commissions/api/index.js barrel (only consumer) | Low | ✅ |
| 7.31 | Delete commissionService.js stub after zero-consumer search | Low | ✅ |
| 7.32+ | Next candidate: notifications.js (669 lines) or emailService.js (353 lines) | Medium | TBD |

---

## 26. Verification Results

| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed (exit code 0) |
| `npm run type-check` | ✅ Passed (exit code 0) |
| `npm run build` | ✅ Passed (built in 2m 42s, 4190 modules) |
| `npm run check:circular` | ✅ Passed (710 files, 0 circular dependencies) |
| Targeted smoke tests (22 suites) | ✅ 285/285 passed, 0 failures |

---

## 27. Remaining Risks Before Moving Additional Services

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Zero test coverage for `commissionService.js` | **Critical** | Phase 7.28: Add 41–54 tests before any movement |
| 2 | Protected Zone — explicit approval required | High | Phase 7.29 must request explicit approval |
| 3 | Circular dependency risk with `@/modules/commissions` | Medium | Fix: use `./commissionNotifications` local import after movement |
| 4 | `notificationsApi` imported from `@/services/notifications` | Low | If notifications.js moves later, import adoption needed |
| 5 | 3 constants not exported (COMMISSION_RATE, PAYMENT_DEADLINE_DAYS, MANUAL_UNFREEZE_GRACE_DAYS) | Low | Could be extracted to domain layer in future (MC9) |
| 6 | 7 internal helpers not exported | Low | Could be extracted to utils layer in future |
| 7 | No React Query hooks for commission data | Low | MC10 — future enhancement |
