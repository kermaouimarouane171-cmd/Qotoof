# Phase 7.33 — R-001 Behavior Analysis: checkOverdueCommissions Freeze Without Notification

**Phase:** 7.33 — R-001 Behavior Analysis
**Date:** 2026-06-26
**Status:** Complete — Analysis only, no code changed
**Risk:** R-001 — Analyzed, not fixed

---

## 1. `.windsurfrules` Compliance

✅ `.windsurfrules` read and followed. Section 37 — `commissionService.js` is a Protected Zone. Any modification requires: (1) separate analysis, (2) risk identification, (3) SQL/code verification, (4) clear test plan, (5) explicit user approval. This phase is analysis only — no code changes, no behavior changes, no files moved, no stubs created or deleted.

## 2. Phase Nature Confirmation

- ✅ This phase was behavior analysis only
- ✅ No production code changed
- ✅ No files were moved
- ✅ No stubs were created or deleted
- ✅ No commission logic changes
- ✅ No notification logic changes
- ✅ No account freeze behavior changes
- ✅ No Supabase query changes
- ✅ No Edge Function changes
- ✅ No React Query key changes
- ✅ No route changes
- ✅ No database/RLS changes

---

## 3. R-001 Summary

**R-001:** `checkOverdueCommissions` freezes a vendor account (`profiles.is_active = false`) even when the deduplication check (`insertCommissionNotificationIfMissing`) prevents sending the `accountFrozen` notification.

**Impact:** A vendor's account can be frozen (preventing new sales) without the vendor or admin receiving any notification explaining why.

---

## 4. Exact Current Flow Map

### `checkOverdueCommissions()` — Lines 313-407 of `commissionService.js`

**INPUT:** No arguments (processes all pending monthly sales)

**STEP 1: Supabase READ — `vendor_monthly_sales`**
- Query: `SELECT * FROM vendor_monthly_sales WHERE status = 'pending' AND due_date IS NOT NULL`
- Lines 315-319

**STEP 2: Initialize counters**
- `remindersSent = 0`, `dueTodaySent = 0`, `frozenAccounts = 0`
- Lines 324-326

**STEP 3: Loop through each pending row**

For each row, calculate `remainingDays = daysRemaining(row.due_date)` (line 329):

**Path A: `remainingDays === 3` (Reminder path)**
1. Call `insertCommissionNotificationIfMissing({vendorId, monthlySaleId, type: 'reminder_3days'})`
   - Supabase READ: `commission_notifications` WHERE `vendor_id`, `monthly_sale_id`, `type = 'reminder_3days'`
   - If exists: return `false` (dedup blocks)
   - If not exists: Supabase INSERT into `commission_notifications`, return `true`
2. If `createdReminder === true`:
   - Call `commissionNotifications.reminder3Days()` (in-app + email)
   - `remindersSent += 1`
3. `continue` (skip to next row)
- Lines 331-348

**Path B: `remainingDays === 0` (Due today path)**
1. Call `insertCommissionNotificationIfMissing({vendorId, monthlySaleId, type: 'due_today'})`
   - Same dedup pattern as above
2. If `createdDueTodayNotification === true`:
   - Call `commissionNotifications.dueToday()` (in-app + email)
   - `dueTodaySent += 1`
3. `continue` (skip to next row)
- Lines 350-366

**Path C: `remainingDays < 0` (Overdue/freeze path) — R-001 AFFECTED**
1. **Supabase WRITE: `vendor_monthly_sales`**
   - `UPDATE SET status = 'overdue' WHERE id = row.id`
   - Lines 369-372
   - **NO dedup check before this write**

2. **Supabase WRITE: `profiles`**
   - `UPDATE SET is_active = false WHERE id = row.vendor_id`
   - Lines 374-377
   - **NO dedup check before this write**
   - **ACCOUNT IS NOW FROZEN**

3. **Dedup check: `insertCommissionNotificationIfMissing({vendorId, monthlySaleId, type: 'account_frozen'})`**
   - Supabase READ: `commission_notifications` WHERE `vendor_id`, `monthly_sale_id`, `type = 'account_frozen'`
   - If exists: return `false` — **R-001 TRIGGER: dedup blocks notification**
   - If not exists: Supabase INSERT, return `true`
   - Lines 379-383

4. **IF `createdFrozenNotification === true`:**
   - Call `commissionNotifications.accountFrozen()` (in-app + email)
   - Lines 385-391

5. **IF `createdFrozenNotification === false` (dedup blocked):**
   - `commissionNotifications.accountFrozen()` is **NOT called**
   - No in-app notification created
   - No email sent
   - **Vendor is frozen without notification**

6. `frozenAccounts += 1` (incremented regardless of notification)
   - Line 393

**RETURN SHAPE:**
```js
{
  success: true,
  frozen_accounts: number,
  reminders_sent: number,
  due_today_sent: number
}
```
- Lines 397-402
- **No field indicates whether notification was skipped**

**ERROR HANDLING:**
- Any thrown error is caught, logged, and returned as `{ success: false, error: message }`
- Lines 403-406

---

## 5. Exact R-001 Trigger Conditions

R-001 occurs when **ALL** of the following conditions are true simultaneously:

| # | Condition | Source |
|---|---|---|
| 1 | A `vendor_monthly_sales` row exists with `status = 'pending'` | Line 318 |
| 2 | The row has a non-null `due_date` | Line 319 |
| 3 | `daysRemaining(due_date) < 0` (due date has passed) | Line 368 |
| 4 | A `commission_notifications` row already exists with the same `vendor_id`, `monthly_sale_id`, and `type = 'account_frozen'` | Lines 68-78 (`insertCommissionNotificationIfMissing` returning `false`) |

**When condition 4 is met:**
- The account is still frozen (conditions 1-3 guarantee the freeze writes at lines 369-377 execute before the dedup check)
- The `accountFrozen` notification is NOT sent
- `frozenAccounts` counter is still incremented
- The return value does NOT indicate the notification was skipped

**When condition 4 is NOT met (normal path):**
- A new `commission_notifications` row is inserted
- `commissionNotifications.accountFrozen()` is called (in-app + email)
- Vendor is notified

**Key observation:** The dedup check uses the composite key `(vendor_id, monthly_sale_id, type)`. The type is `'account_frozen'`. This means if `checkOverdueCommissions` runs twice for the same overdue monthly sale (e.g., cron job runs twice, or retry after error), the first run freezes + notifies, and the second run freezes (redundantly) + does NOT notify.

---

## 6. Supabase Data Impact Analysis

### Tables Affected in the R-001 Path (remainingDays < 0)

| Table | Operation | Fields Changed | Risk Level | Dedup Before Write? |
|---|---|---|---|---|
| `vendor_monthly_sales` | READ | — | Low | N/A |
| `vendor_monthly_sales` | UPDATE | `status` → `'overdue'` | Medium | ❌ No |
| `profiles` | UPDATE | `is_active` → `false` | **High** | ❌ No |
| `commission_notifications` | READ | — | Low | N/A (this IS the dedup check) |
| `commission_notifications` | INSERT (if not deduped) | `vendor_id`, `monthly_sale_id`, `type` | Low | ✅ Yes (this is the dedup) |

**Critical finding:** The two highest-impact writes (`vendor_monthly_sales.status` and `profiles.is_active`) happen **unconditionally** before the dedup check. The dedup only gates the notification, not the freeze.

### Additional Tables (via `commissionNotifications.accountFrozen`)

| Table | Operation | When | Risk |
|---|---|---|---|
| `notifications` | INSERT (via `notificationsApi.create`) | Only if dedup allows | Low |
| `profiles` | READ (for email lookup) | Only if dedup allows | Low |

---

## 7. Notification Impact Analysis

### `commissionNotifications.accountFrozen()` — Lines 89-97 of `commissionNotifications.js`

| Aspect | Value |
|---|---|
| Method name | `accountFrozen` |
| In-app notification | `notificationsApi.create()` with `type: 'commission'`, `data: { event: 'account_frozen', monthly_sale_id }` |
| Email notification | `emailService.sendEmail()` with template `'commission_notification'` |
| Recipient | Vendor (`vendorId`) |
| Dedup behavior | Controlled by `insertCommissionNotificationIfMissing` in `commissionService.js` — checks `commission_notifications` table for `(vendor_id, monthly_sale_id, type: 'account_frozen')` |
| Skipped behavior | When dedup returns `false`: no in-app notification, no email, no error thrown, no log warning |
| Error behavior | `sendInAppNotification` and `sendEmailNotification` are wrapped in `Promise.allSettled` — errors are swallowed |

**Critical finding:** When the notification is skipped due to dedup, there is:
- No log warning
- No error thrown
- No admin alert
- No audit trail
- Silent skip

---

## 8. Business Impact Analysis

### Can a vendor be frozen without knowing?

**Yes.** If `checkOverdueCommissions` runs more than once for the same overdue monthly sale (e.g., cron job retry, manual trigger, or the row remains pending across multiple runs), the second run will:
- Re-freeze the account (redundant but harmless — `is_active` is already `false`)
- NOT send the `accountFrozen` notification (dedup blocks it)

The vendor will discover the freeze only when they try to make a sale and see the error message "الحساب مجمّد ولا يمكن تسجيل مبيعات جديدة" (line 177).

### Can admin be unaware?

**Yes.** There is no admin notification for account freezing. The `accountFrozen` notification is sent only to the vendor. Admin has no separate alert. If the vendor doesn't receive the notification, admin may not know the vendor is unaware.

### Can this cause support disputes?

**Yes.** A vendor whose account is frozen without notification may contact support asking why their account is frozen. Support may not immediately know it's due to overdue commissions.

### Can payment/commission state become inconsistent?

**No.** The freeze writes (`status = 'overdue'` and `is_active = false`) are idempotent. Running the freeze twice doesn't create inconsistency — it's just redundant. The commission state remains correct; only the notification is missing.

### Can retry later send the missed notification?

**No.** The dedup is permanent — it checks for the existence of a `commission_notifications` row with `type = 'account_frozen'`. Once that row exists (inserted by the first run), all subsequent runs will skip the notification. The missed notification is never retried.

### Does dedup block notification forever or only for a window?

**Forever.** The `commission_notifications` table has no TTL or cleanup. The dedup row persists indefinitely. Once the `account_frozen` notification type is recorded for a `(vendor_id, monthly_sale_id)` pair, it can never be sent again for that pair.

### Could fixing this create duplicate notifications?

**Yes, potentially.** If the fix allows `accountFrozen` to be sent even when dedup exists, and the function runs multiple times, the vendor could receive multiple freeze notifications. This must be handled carefully.

---

## 9. Existing Test Coverage

### Tests for `checkOverdueCommissions` (lines 327-400 of test file)

| Test Name | Scenario | Covers R-001? |
|---|---|---|
| `succeeds with zero counts when no pending commissions` | Empty result | ❌ |
| `returns error when select fails` | DB error on initial select | ❌ |
| `sends 3-day reminder when dueDate is 3 days away` | Reminder path (remainingDays === 3) | ❌ |
| `sends due today alert when remainingDays is 0` | Due today path (remainingDays === 0) | ❌ |
| `freezes account when dueDate is past` | Freeze path (remainingDays < 0) — dedup allows notification | ❌ (tests normal path only) |
| `does not send notification when one already exists (dedup)` | Dedup blocks reminder_3days | ❌ (tests reminder dedup, not freeze dedup) |
| `checkOverdueCommissions touches commission_notifications table` | Table coverage | ❌ |

### Summary of Coverage

- ✅ Reminder path covered (with and without dedup)
- ✅ Due-today path covered
- ✅ Freeze path covered (normal — notification sent)
- ✅ Dedup behavior covered for reminders
- ❌ **Freeze path with dedup blocking notification — NOT TESTED (R-001 exact scenario)**
- ❌ **Account frozen without notification — NOT TESTED**
- ❌ **Return value when notification is skipped — NOT TESTED**
- ❌ **No test verifies that `frozenAccounts` increments even when notification is skipped**

---

## 10. Missing Test Coverage

| # | Test Name | Scenario | Mocked Setup | Expected Current Behavior | Expected Desired Behavior (if fixed) |
|---|---|---|---|---|---|
| 1 | `freezes account even when accountFrozen notification is deduped (R-001 characterization)` | Overdue row + existing `account_frozen` notification | `commission_notifications` returns existing row | Account frozen, `frozen_accounts = 1`, `accountFrozen` NOT called | Same (characterization test) OR notification sent (fix test) |
| 2 | `increments frozenAccounts even when notification is skipped` | Overdue row + dedup blocks | `commission_notifications` returns existing row | `frozen_accounts = 1` | Same |
| 3 | `return value does not indicate notification was skipped` | Overdue row + dedup blocks | `commission_notifications` returns existing row | Return has no `notifications_skipped` field | Return includes `notifications_skipped: 1` (if Option B implemented) |
| 4 | `freezes account redundantly on second run (idempotency)` | Overdue row already frozen + deduped | `vendor_monthly_sales` returns overdue row with past date, `commission_notifications` returns existing | Account re-frozen (idempotent), no notification | Same |
| 5 | `does not log warning when notification is skipped` | Overdue row + dedup blocks | `commission_notifications` returns existing row | `logger.warn` NOT called | `logger.warn` called (if fix adds logging) |

---

## 11. Fix Strategy Options

### Option A: If dedup says notification already exists, do not freeze

**Behavior:** Check dedup before freezing. If `account_frozen` notification already exists, skip the freeze.

| Aspect | Assessment |
|---|---|
| Behavior impact | Account would NOT be frozen on retry runs. But if the first run froze + notified, the account is already frozen. This only prevents redundant re-freezing. |
| Risk | **High** — If the first run failed after freezing but before inserting the dedup row, the account would be frozen without notification, and subsequent runs would NOT re-attempt notification. Also, if the freeze is somehow reverted (e.g., manual unfreeze), the account would NOT be re-frozen even though the commission is still overdue. |
| Test changes needed | Multiple new tests for conditional freeze behavior |
| Preserves existing semantics | ❌ No — changes when freezing occurs |
| Could create duplicate notifications | No |
| Affects money/account status safety | **Yes** — could prevent legitimate re-freezing |

**Verdict: ❌ Not recommended.** Too risky for account status safety.

### Option B: Freeze account, but return/report that notification was skipped

**Behavior:** Keep the freeze unconditional. Add a `notifications_skipped` counter to the return value. Optionally log a warning.

| Aspect | Assessment |
|---|---|
| Behavior impact | Freeze behavior unchanged. Return value enriched. Caller (admin/cron) can detect skipped notifications. |
| Risk | **Low** — No change to freeze logic. Only adds information. |
| Test changes needed | New tests for return value with skipped notifications |
| Preserves existing semantics | ✅ Yes — freeze still happens unconditionally |
| Could create duplicate notifications | No |
| Affects money/account status safety | No — freeze behavior unchanged |

**Verdict: ✅ Recommended as minimal safe fix.** Preserves all existing behavior, adds visibility.

### Option C: Freeze account, but allow `accountFrozen` notification even when dedup blocks

**Behavior:** Bypass the dedup check for `account_frozen` type. Always send the notification.

| Aspect | Assessment |
|---|---|
| Behavior impact | Vendor always receives freeze notification, even on retry runs. |
| Risk | **Medium** — Could send duplicate notifications if function runs multiple times. Vendor may receive multiple "account frozen" emails. |
| Test changes needed | Tests for duplicate notification behavior |
| Preserves existing semantics | ❌ No — changes notification dedup behavior |
| Could create duplicate notifications | **Yes** — every run sends a new notification |
| Affects money/account status safety | No — freeze behavior unchanged |

**Verdict: ⚠️ Acceptable but needs dedup window or rate limiting to prevent spam.**

### Option D: Use separate dedup keys per notification type, especially `accountFrozen`

**Behavior:** The dedup already uses `type` as part of the composite key. The issue is not the key — it's that the dedup blocks ALL subsequent notifications of the same type. This option would add a time-window or run-id to the dedup key.

| Aspect | Assessment |
|---|---|
| Behavior impact | Would allow re-sending notifications after a time window or on different runs. |
| Risk | **Medium** — Changes dedup semantics for all notification types, not just `account_frozen`. |
| Test changes needed | Extensive — all dedup tests need updating |
| Preserves existing semantics | ❌ No — changes dedup behavior globally |
| Could create duplicate notifications | **Yes** — within the window |
| Affects money/account status safety | No |

**Verdict: ⚠️ Over-engineered for this specific issue.** Better suited as a separate dedup refactor phase.

### Option E: Create admin audit event when freeze happens even if vendor notification is skipped

**Behavior:** When `createdFrozenNotification === false`, create an admin-facing notification or audit log entry.

| Aspect | Assessment |
|---|---|
| Behavior impact | Admin is alerted that a freeze happened without vendor notification. |
| Risk | **Low** — Additive only. No change to freeze or vendor notification behavior. |
| Test changes needed | Tests for admin audit event |
| Preserves existing semantics | ✅ Yes |
| Could create duplicate notifications | No (admin audit is separate from vendor notification) |
| Affects money/account status safety | No |

**Verdict: ✅ Recommended as complementary to Option B.** Adds admin visibility.

---

## 12. Recommended Option

**Option B + Option E (combined, in two phases):**

1. **Phase 7.34:** Add characterization tests only — document the current R-001 behavior without changing anything
2. **Phase 7.35:** Implement Option B (add `notifications_skipped` to return value + `logger.warn`) + Option E (admin audit event) — with explicit user approval per Protected Zone rules

**Rationale:**
- Option B preserves all existing freeze behavior (no risk to account status safety)
- Option E adds admin visibility (admin can manually notify vendor if needed)
- Both are additive (no behavior change, only new information)
- Splitting into characterization tests first ensures we lock down current behavior before any fix

---

## 13. Recommended Phase 7.34

**Add characterization tests for R-001 only.**

This is the safest next phase:
- No production code changes
- No behavior changes
- Only adds tests that document the current (suspicious) behavior
- Tests will serve as regression baseline when fix is implemented
- Follows Protected Zone rules (analysis → tests → fix with approval)

### Suggested Phase 7.34 Prompt Outline

```
Phase 7.34 — R-001 Characterization Tests for checkOverdueCommissions.

Goal: Add tests that document the current R-001 behavior without changing any production code.

Tests to add:
1. "R-001: freezes account even when accountFrozen notification is deduped"
   - Setup: overdue row + existing account_frozen notification in commission_notifications
   - Assert: profiles.is_active set to false (account frozen)
   - Assert: commissionNotifications.accountFrozen NOT called
   - Assert: frozen_accounts === 1

2. "R-001: return value does not indicate notification was skipped"
   - Same setup as above
   - Assert: result has no notifications_skipped field (current behavior)

3. "R-001: no logger.warn when notification is skipped"
   - Same setup
   - Assert: logger.warn NOT called (current behavior — silent skip)

4. "R-001: freeze is idempotent across multiple runs"
   - Setup: overdue row already has account_frozen notification
   - Assert: vendor_monthly_sales status set to overdue (redundant but idempotent)
   - Assert: profiles.is_active set to false (redundant but idempotent)

Do NOT change:
- Any production code
- Any existing test expectations
- Any behavior
- R-001 suspicious behavior
```

---

## 14. Verification Results

| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed |
| `npm run type-check` | ✅ Passed |
| `npm run build` | ✅ Passed |
| `npm run check:circular` | ✅ 711 files, 0 circular dependencies |
| Targeted tests (7 suites) | ✅ 134/134 passed |

### Targeted Test Breakdown

| Suite | Result |
|---|---|
| `commissionService.test.js` | ✅ Passed (61 tests) |
| `commissionNotifications.test.js` | ✅ Passed |
| `notifications.test.js` | ✅ Passed |
| `notificationsService.test.js` | ✅ Passed |
| `notificationFlow.test.js` | ✅ Passed |
| `AdminCommissionManagement.columns.test.jsx` | ✅ Passed |
| `AdminCommissions.columns.test.jsx` | ✅ Passed |

---

## 15. Files Inspected

- `.windsurfrules` (614 lines — Section 37 confirmed)
- `src/modules/commissions/api/commissionService.js` (696 lines — full trace)
- `src/modules/commissions/api/commissionNotifications.js` (111 lines — notification methods)
- `src/__tests__/services/commissionService.test.js` (707 lines — existing test coverage)
- `src/__tests__/services/commissionNotifications.test.js` (import audit)
- `src/__tests__/services/notifications.test.js` (import audit)
- `MODULAR_DEVELOPMENT_PLAN.md`
- `package.json`
- `eslint.config.js`
- `docs/architecture/phase-7-31-commissions-module-closure-and-next-risk-map.md`
- `docs/architecture/phase-7-30-commission-service-stub-deletion-report.md`
- `docs/architecture/phase-7-26-commission-notifications-stub-deletion-report.md`

## 16. Files Changed

| File | Change |
|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | **Updated** — Phase 7.33 status added, R-001 marked as analyzed |
| `docs/architecture/phase-7-33-r001-check-overdue-commissions-behavior-analysis.md` | **Created** — This report |

---

## 17. Answers to Analysis Questions

1. **Is this behavior intentional or likely a bug?** — Likely a bug. The freeze writes execute before the dedup check, suggesting the developer intended the freeze to be unconditional but didn't consider the notification gap when dedup blocks.

2. **Under what exact conditions does it happen?** — See Section 5: all four conditions must be true simultaneously.

3. **What database records are read or written before the freeze?** — `vendor_monthly_sales` SELECT (read pending rows), then `vendor_monthly_sales` UPDATE (set overdue), then `profiles` UPDATE (set is_active = false). No reads between the two writes.

4. **What database records are written during the freeze?** — `vendor_monthly_sales.status = 'overdue'` and `profiles.is_active = false`.

5. **What notification dedup check prevents `accountFrozen` notification?** — `insertCommissionNotificationIfMissing` checks `commission_notifications` table for `(vendor_id, monthly_sale_id, type = 'account_frozen')`. If a row exists, returns `false`, blocking the notification.

6. **Does the function still update vendor/account status even when notification is skipped?** — **Yes.** The freeze writes (lines 369-377) execute before the dedup check (line 379). The freeze is unconditional.

7. **Does the function return enough information to caller to know that a freeze happened without notification?** — **No.** The return value has `frozen_accounts` count but no field indicating whether notifications were sent or skipped.

8. **Is this risk vendor-facing, admin-facing, or both?** — **Both.** Vendor doesn't know they're frozen. Admin doesn't know the vendor wasn't notified.

9. **What is the safest fix strategy?** — Option B (add `notifications_skipped` to return value + log warning) + Option E (admin audit event). Both are additive, no behavior change.

10. **What tests must be added before any fix?** — See Section 10: 5 characterization tests documenting current behavior.
