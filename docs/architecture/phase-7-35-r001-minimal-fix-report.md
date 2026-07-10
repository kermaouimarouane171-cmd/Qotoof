# Phase 7.35 — R-001 Minimal Fix (Option B): `notifications_skipped` + `logger.warn`

**Phase:** 7.35 — R-001 Minimal Fix (Option B)
**Date:** 2026-06-26
**Status:** Complete — Protected Zone minimal fix applied
**Risk:** R-001 — Minimally fixed (observability), not fully closed (admin audit pending)

---

## 1. `.windsurfrules` Compliance

✅ `.windsurfrules` read and followed. Section 37 — `commissionService.js` is a Protected Zone. This phase was granted explicit approval to modify only the minimal R-001 fix inside `checkOverdueCommissions`. Changes were limited to adding observability metadata (`notifications_skipped`) and a warning log. No freeze conditions, dedup conditions, notification payloads, or business logic were changed.

## 2. Protected Zone Confirmation

- ✅ This was a Protected Zone minimal fix
- ✅ Changes limited to `checkOverdueCommissions` function only
- ✅ No schema or RLS changes
- ✅ No Edge Function changes
- ✅ No new tables
- ✅ Explicit approval documented

---

## 3. Files Inspected

- `.windsurfrules` (614 lines — Section 37 confirmed)
- `docs/architecture/phase-7-33-r001-check-overdue-commissions-behavior-analysis.md`
- `docs/architecture/phase-7-34-r001-characterization-tests-report.md`
- `src/modules/commissions/api/commissionService.js` (696 lines → 710 lines)
- `src/modules/commissions/api/commissionNotifications.js` (111 lines — NOT modified)
- `src/__tests__/services/commissionService.test.js` (796 lines → 806 lines)
- `MODULAR_DEVELOPMENT_PLAN.md`
- `package.json`
- `eslint.config.js`

## 4. Files Changed

| File | Change |
|---|---|
| `src/modules/commissions/api/commissionService.js` | **Modified** — `checkOverdueCommissions`: added `notificationsSkipped` array, `logger.warn` on dedup skip, `notifications_skipped` in return |
| `src/__tests__/services/commissionService.test.js` | **Modified** — Updated 5 R-001 characterization tests → regression tests, added 1 new test (no-freeze path) |
| `MODULAR_DEVELOPMENT_PLAN.md` | **Updated** — Phase 7.35 status added, R-001 marked as minimally fixed |
| `docs/architecture/phase-7-35-r001-minimal-fix-report.md` | **Created** — This report |

---

## 5. Production Code Changed

### Exact Changed Function

`checkOverdueCommissions` in `src/modules/commissions/api/commissionService.js`

### Changes Made

**1. Added `notificationsSkipped` array initialization (line 327):**
```js
const notificationsSkipped = []
```

**2. Added `else` branch when `createdFrozenNotification === false` (lines 392-405):**
```js
} else {
  logger.warn('Account frozen but accountFrozen notification skipped due to dedup', {
    vendor_id: row.vendor_id,
    notification_type: 'account_frozen',
    reason: 'dedup',
    monthly_sale_id: row.id,
  })
  notificationsSkipped.push({
    vendor_id: row.vendor_id,
    notification_type: 'account_frozen',
    reason: 'dedup',
    monthly_sale_id: row.id,
  })
}
```

**3. Added `notifications_skipped` to return shape (line 416):**
```js
return {
  success: true,
  frozen_accounts: frozenAccounts,
  reminders_sent: remindersSent,
  due_today_sent: dueTodaySent,
  notifications_skipped: notificationsSkipped,
}
```

---

## 6. Old Behavior vs New Behavior

### Old Behavior (Phase 7.34 and earlier)

| Aspect | Behavior |
|---|---|
| Account freeze | Happens unconditionally before dedup |
| Notification | Silently skipped when dedup blocks |
| Return value | `{ success, frozen_accounts, reminders_sent, due_today_sent }` — no visibility into skipped notifications |
| Logging | No warning emitted for skipped freeze notification |
| Caller visibility | Caller cannot know notification was skipped |

### New Behavior (Phase 7.35)

| Aspect | Behavior |
|---|---|
| Account freeze | **Unchanged** — still happens unconditionally before dedup |
| Notification | **Unchanged** — still skipped when dedup blocks |
| Return value | `{ success, frozen_accounts, reminders_sent, due_today_sent, notifications_skipped }` — `notifications_skipped` is an array of skipped notification objects |
| Logging | `logger.warn` emitted with context when freeze notification is skipped |
| Caller visibility | Caller can now inspect `notifications_skipped` array to detect skipped freeze notifications |

---

## 7. Confirmations

- ✅ Account freeze conditions are **unchanged** — `remainingDays < 0` still triggers freeze
- ✅ Dedup behavior is **unchanged** — `insertCommissionNotificationIfMissing` still blocks on existing `account_frozen` row
- ✅ Notification payloads are **unchanged** — `commissionNotifications.accountFrozen()` call signature unchanged
- ✅ Normal `accountFrozen` notification path is **unchanged** — when dedup allows, notification is sent as before
- ✅ Only observability/return metadata changed — no business logic, no freeze logic, no dedup logic changed
- ✅ Option E (admin audit event) was **NOT** implemented in this phase
- ✅ No database schema changes
- ✅ No RLS changes
- ✅ No Edge Function changes
- ✅ No route changes
- ✅ No React Query key changes

---

## 8. `notifications_skipped` Return Shape

```js
notifications_skipped: [
  {
    vendor_id: string,          // e.g. 'v1'
    notification_type: string,  // 'account_frozen'
    reason: string,             // 'dedup'
    monthly_sale_id: string,    // e.g. 'ms1'
  }
]
```

- When no notifications are skipped: `notifications_skipped: []` (empty array, always present)
- When one or more freeze notifications are skipped: array contains one entry per skipped notification

### Backward Compatibility

The new field is **additive** — existing callers that destructure `{ success, frozen_accounts, reminders_sent, due_today_sent }` will continue to work. The new `notifications_skipped` field is always present (as an empty array when no skips occur), so callers can optionally check it.

---

## 9. `logger.warn` Context

```js
logger.warn('Account frozen but accountFrozen notification skipped due to dedup', {
  vendor_id: row.vendor_id,
  notification_type: 'account_frozen',
  reason: 'dedup',
  monthly_sale_id: row.id,
})
```

- Uses existing `logger` import already present in the file
- No new logging dependency introduced
- `logger.warn` is called **only** in the skipped freeze notification case
- No sensitive data exposed (no payment details, no PII beyond vendor_id)

---

## 10. Tests Updated

### R-001 Characterization Tests → Regression Tests

| # | Old Test Name (Phase 7.34) | New Test Name (Phase 7.35) | Change |
|---|---|---|---|
| 1 | `characterizes R-001: freezes vendor even when accountFrozen dedup skips notification` | `R-001 regression: freezes vendor even when accountFrozen dedup skips notification` | Kept — freeze still happens |
| 2 | `characterizes R-001: does not expose notifications_skipped` | `R-001 regression: exposes notifications_skipped when freeze notification is skipped` | **Flipped** — now asserts `notifications_skipped` IS present with correct shape |
| 3 | `characterizes R-001: does not warn when freeze notification is skipped` | `R-001 regression: emits logger.warn when freeze notification is skipped` | **Flipped** — now asserts `logger.warn` IS called with context |
| 4 | `characterizes R-001: dedup blocks notification but not freeze` | `R-001 regression: dedup blocks notification but not freeze` | Kept — dedup still blocks notification, not freeze |
| 5 | `characterizes normal freeze path: sends accountFrozen when dedup allows` | `R-001 regression: normal freeze path sends accountFrozen when dedup allows` | Kept + added `logger.warn` NOT called assertion |

### New Test Added

| # | Test Name | Scenario |
|---|---|---|
| 6 | `R-001 regression: no freeze path produces no skipped notifications or warnings` | Reminder path (remainingDays === 3) — no freeze, no skipped notifications, no warnings |

### Total Test Count

- `commissionService.test.js`: 61 (original) + 6 (R-001 regression) = **67 tests**
- Full suite: 1527 passed, 2 todo, 0 failures

---

## 11. Test Results

### `commissionService.test.js` only

| Metric | Result |
|---|---|
| Test suites | 1 passed, 1 total |
| Tests | 67 passed, 67 total |
| Time | ~3.6s |

### Targeted tests (commission + payout + paymentMethod + notification)

| Metric | Result |
|---|---|
| Test suites | 10 passed, 10 total |
| Tests | 168 passed, 168 total |
| Time | ~11s |

### Full test suite

| Metric | Result |
|---|---|
| Test suites | 145 passed, 145 total |
| Tests | 2 todo, 1527 passed, 1529 total |
| Snapshots | 9 passed, 9 total |
| Time | ~35s |

---

## 12. Verification Results

| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed |
| `npm run type-check` | ✅ Passed |
| `npm run build` | ✅ Passed |
| `npm run check:circular` | ✅ 711 files, 0 circular dependencies |
| `commissionService.test.js` | ✅ 67/67 passed |
| Targeted tests (10 suites) | ✅ 168/168 passed |
| Full test suite (145 suites) | ✅ 1527/1529 passed (2 todo), 0 failures |

---

## 13. Remaining Risk

| Risk | Status |
|---|---|
| Vendor frozen without notification | **Still possible** — dedup still blocks notification. But now caller can detect via `notifications_skipped` and `logger.warn` is emitted. |
| Admin unaware of freeze without notification | **Still possible** — no admin audit event (Option E not implemented). Admin must check logs or return value. |
| Dedup blocks notification forever | **Still true** — no TTL or cleanup for `commission_notifications`. |
| Duplicate notifications if fix bypasses dedup | **Not applicable** — this fix does NOT bypass dedup. Dedup behavior is unchanged. |

---

## 14. Recommended Phase 7.36

**Option E — Admin audit event for skipped freeze notifications.**

Now that the caller can detect skipped notifications (Phase 7.35), the next phase can add admin visibility:

### Suggested Phase 7.36 Scope

```
Phase 7.36 — R-001 Option E: Admin audit event for skipped freeze notifications.

Goal: When accountFrozen notification is skipped by dedup, create an admin-facing
notification so admins are aware that a vendor was frozen without notification.

Changes to commissionService.js:
1. When createdFrozenNotification === false, after logger.warn, call notificationsApi.create()
   for all admin users with a notification about the skipped freeze notification.

Changes to tests:
1. Add test for admin audit event when freeze notification is skipped.
2. Preserve all existing tests.

Requires: Explicit user approval per Protected Zone Section 37.
```

**Alternative:** If the team considers the observability fix (Option B) sufficient and the admin audit event is not urgently needed, Phase 7.36 can move to the next architectural candidate from the Phase 7.31 risk map.

**R-001 status:** Minimally fixed (observability). Fully closable when Option E is implemented or when the team decides observability is sufficient.
