# Phase 7.41 — Payouts.jsx Deep Analysis

**Phase:** 7.41 — Payouts.jsx Deep Pre-Movement Analysis
**Date:** 2026-06-26
**Status:** Complete — Analysis only, no code changed
**R-001:** Closed (Phase 7.37)

---

## 1. `.windsurfrules` Compliance

✅ `.windsurfrules` read and followed. This phase was analysis only — no production code modified, no tests changed, no file movement, no import rewriting, no service extraction, no stub creation/deletion.

## 2. Analysis-Only Confirmation

- ✅ No production code changed
- ✅ No test code changed
- ✅ `Payouts.jsx` was NOT modified
- ✅ `Commissions.jsx` was NOT modified
- ✅ No behavior changes
- ✅ No file movement
- ✅ No API extraction
- ✅ No import rewriting
- ✅ No Supabase query changes
- ✅ No schema/RLS changes
- ✅ No Edge Function changes
- ✅ No route changes
- ✅ No React Query key changes

---

## 3. File Overview

### `src/pages/admin/Payouts.jsx`

| Property | Value |
|---|---|
| Lines | 652 |
| Component | `AdminPayouts` (default export) |
| Route | `/admin/payouts` |
| Access | Admin-only (behind `ProtectedRoute`) |
| Role assumption | Admin (uses `useAuthStore` for `currentUser.id` in audit logging) |

### Imports

| Import | Source | Purpose |
|---|---|---|
| `useState, useEffect, useCallback` | `react` | React hooks |
| `useTranslation` | `react-i18next` | i18n |
| `Card, LoadingSpinner` | `@/components/ui` | UI components |
| `formatPrice` | `@/utils/currency` | Money formatting |
| Heroicons (10 icons) | `@heroicons/react/24/outline` | UI icons |
| `supabase` | `@/services/supabase` | **Direct Supabase** |
| `useAuthStore` | `@/store/authStore` | Current admin user |
| `toast` | `react-hot-toast` | Toast notifications |
| `logger` | `@/utils/logger` | Error logging |
| `subDays, format` | `date-fns` | Date utilities |
| `@react-pdf/renderer` | Dynamic import inside `handleExportPDF` | PDF export (643 kB, on-demand) |

### Local State Variables

| Variable | Type | Initial | Purpose |
|---|---|---|---|
| `loading` | boolean | `true` | Page loading state |
| `exporting` | boolean | `false` | CSV/PDF export in progress |
| `processing` | string\|null | `null` | Payout ID being status-updated |
| `selectedRange` | string | `'30d'` | Date range filter (7d/30d/3m/6m/all) |
| `filter` | string | `'pending'` | Status filter (pending/processing/completed/failed/all) |
| `payouts` | array | `[]` | Loaded payout records |
| `auditLogs` | array | `[]` | Audit logs for selected payout |
| `selectedPayout` | object\|null | `null` | Payout selected for audit modal |
| `showAuditModal` | boolean | `false` | Audit trail modal visibility |
| `summary` | object | `{totalAmount:0, totalCount:0, pendingAmount:0, pendingCount:0, completedAmount:0, completedCount:0}` | Summary statistics |

### Helper Functions

| Function | Lines | Purpose |
|---|---|---|
| `getStatusBadge(status)` | 384–398 | Returns colored badge JSX for status |

### Action Handlers

| Handler | Lines | Calls Supabase? | Purpose |
|---|---|---|---|
| `loadPayouts` | 66–118 | ✅ `payouts.select` | Load payouts with filters |
| `loadAuditLogs` | 127–144 | ✅ `financial_audit_log.select` | Load audit trail for a payout |
| `handleUpdateStatus` | 149–193 | ✅ `payouts.update` + `rpc` + `notifications.insert` | Update payout status, log audit, notify user |
| `handleProcessPayout` | 198–200 | Delegates to `handleUpdateStatus` | Set status to `processing` |
| `handleCompletePayout` | 205–207 | Delegates to `handleUpdateStatus` | Set status to `completed` |
| `handleExportCSV` | 212–282 | ❌ (uses `payouts` state) | Export payouts to CSV |
| `handleExportPDF` | 287–370 | ❌ (uses `payouts` state) | Export payouts to PDF (dynamic import) |
| `handleViewAudit` | 375–379 | Delegates to `loadAuditLogs` | Open audit modal |

### Modals/Dialogs

| Modal | Trigger | Content |
|---|---|---|
| Audit Trail Modal | `handleViewAudit` → `showAuditModal` | Shows `selectedPayout` info + `auditLogs` list |

### Export Features

| Feature | Handler | Data Source | Format |
|---|---|---|---|
| CSV Export | `handleExportCSV` | `payouts` state | CSV with headers + summary row |
| PDF Export | `handleExportPDF` | `payouts` + `summary` state | PDF via `@react-pdf/renderer` (dynamic import) |

### Toast Notifications

| Toast | Trigger | Type |
|---|---|---|
| `toast.error` — "Failed to load payouts" | `loadPayouts` catch | Error |
| `toast.success` — "Status updated" | `handleUpdateStatus` success | Success |
| `toast.error` — "Failed to update status" | `handleUpdateStatus` catch | Error |
| `toast.error` — "No data to export" | `handleExportCSV`/`handleExportPDF` with empty data | Error |
| `toast.success` — "Payouts exported as CSV!" | `handleExportCSV` success | Success |
| `toast.error` — "Failed to export CSV" | `handleExportCSV` catch | Error |
| `toast.success` — "Payouts exported as PDF!" | `handleExportPDF` success | Success |
| `toast.error` — "Failed to export PDF" | `handleExportPDF` catch | Error |

### Loading/Processing States

| State | Variable | UI Effect |
|---|---|---|
| Page loading | `loading` | Shows `<LoadingSpinner size="lg" />` |
| Export in progress | `exporting` | Disables export buttons |
| Status update in progress | `processing === payout.id` | Disables action buttons, shows "Processing..." |

---

## 4. Supabase Operation Map

### Operation 1: `payouts.select` — Load Payouts

| Property | Value |
|---|---|
| Location | Lines 79–95 |
| Table | `payouts` |
| Type | Read |
| Columns | `*, user:profiles!payouts_user_id_fkey(id, first_name, last_name, email, store_name, phone)` |
| Filters | `.order('created_at', { ascending: false })` + optional `.gte('created_at', startDate)` + optional `.eq('status', filter)` |
| Error handling | `throw error` → caught by `catch` → `logger.error` + `toast.error` |
| Success behavior | `setPayouts(data)`, `setSummary(...)`, `setLoading(false)` |
| UI state affected | `payouts`, `summary`, `loading` |
| Reload behavior | `useEffect` on `loadPayouts` (depends on `filter`, `selectedRange`) |
| Risk level | **Medium** — read-only, but financial data with admin RLS |

### Operation 2: `financial_audit_log.select` — Load Audit Logs

| Property | Value |
|---|---|
| Location | Lines 129–137 |
| Table | `financial_audit_log` |
| Type | Read |
| Columns | `*, performed_by_profile:profiles!financial_audit_log_performed_by_fkey(first_name, last_name, role)` |
| Filters | `.eq('entity_type', 'payout').eq('entity_id', payoutId).order('created_at', { ascending: true })` |
| Error handling | `throw error` → caught by `catch` → `logger.error` only (no toast) |
| Success behavior | `setAuditLogs(data)` |
| UI state affected | `auditLogs` |
| Risk level | **Low** — read-only audit trail |

### Operation 3: `payouts.update` — Update Payout Status

| Property | Value |
|---|---|
| Location | Lines 155–158 |
| Table | `payouts` |
| Type | **Write (update)** |
| Fields | `{ status: newStatus }` |
| Filter | `.eq('id', payoutId)` |
| Error handling | `throw error` → caught by outer `catch` → `logger.error` + `toast.error` |
| Success behavior | Proceeds to audit logging, then notification, then `toast.success` + `loadPayouts()` |
| UI state affected | `processing` (set to `payoutId` before, `null` after) |
| Risk level | **High** — financial write, changes vendor payout status |

### Operation 4: `rpc('log_financial_audit')` — Audit Log Write

| Property | Value |
|---|---|
| Location | Lines 163–172 |
| RPC | `log_financial_audit` |
| Type | **Write (RPC)** |
| Parameters | `p_entity_type: 'payout'`, `p_entity_id: payoutId`, `p_action: 'status_updated'`, `p_previous_status: previousStatus`, `p_new_status: newStatus`, `p_amount: payout?.amount \|\| 0`, `p_details: { updated_by: currentUser?.id, new_status: newStatus }`, `p_reason: null` |
| Error handling | **None — no try/catch around RPC call**. If RPC fails, error propagates to outer `catch` → `toast.error` shown, but **payout status is already updated** |
| Success behavior | Proceeds to notification insert |
| UI state affected | None directly |
| Risk level | **High** — audit integrity, no individual error handling |

### Operation 5: `notifications.insert` — User Notification

| Property | Value |
|---|---|
| Location | Lines 176–182 |
| Table | `notifications` |
| Type | **Write (insert)** |
| Fields | `user_id: payout.user_id`, `title: "Payout {Status}"`, `message: "Your payout of {amount} has been updated to {status}."`, `type: 'payout'`, `data: { payout_id, amount, status }` |
| Filter | None |
| Error handling | **None — no try/catch around insert**. If insert fails, error propagates to outer `catch` → `toast.error` shown, but **payout status is already updated and audit is already logged** |
| Success behavior | `toast.success` + `loadPayouts()` |
| UI state affected | None directly |
| Risk level | **Medium** — notification delivery, no individual error handling |

---

## 5. Financial Write Flow Map

### `handleUpdateStatus(payoutId, newStatus)` — Full Flow

```
1. User clicks action button (Start Processing / Mark Completed / Mark Failed)
   ↓
2. setProcessing(payoutId) — disables buttons, shows "Processing..."
   ↓
3. Find payout in local state: const payout = payouts.find(p => p.id === payoutId)
   ↓
4. Record previousStatus: payout?.status || 'unknown'
   ↓
5. ┌─ supabase.from('payouts').update({ status: newStatus }).eq('id', payoutId)
   │  └─ If error → throw → catch → toast.error → setProcessing(null) → STOP
   │  └─ If success → continue
   ↓
6. ┌─ supabase.rpc('log_financial_audit', { ... })
   │  └─ If error → throw → catch → toast.error → setProcessing(null) → STOP
   │  └─ BUT: payout status is ALREADY updated in DB (no rollback)
   │  └─ If success → continue
   ↓
7. ┌─ if (payout?.user_id):
   │  └─ supabase.from('notifications').insert({ ... })
   │     └─ If error → throw → catch → toast.error → setProcessing(null) → STOP
   │     └─ BUT: payout status is ALREADY updated AND audit is ALREADY logged (no rollback)
   │     └─ If success → continue
   ↓
8. toast.success("Status updated")
   ↓
9. loadPayouts() — reloads payouts list
   ↓
10. finally: setProcessing(null) — re-enables buttons
```

### Operation Characteristics

| Characteristic | Assessment |
|---|---|
| Sequential | ✅ — operations execute one after another |
| Partially failure-tolerant | ❌ — no individual try/catch around RPC or notification |
| All-or-nothing | ❌ — **NOT transactional**. Payout update succeeds independently. |
| Non-transactional | ✅ — no database transaction wrapping all three operations |

### Critical Finding

**The status update flow is non-transactional.** If the payout update succeeds but the audit RPC fails:
- The payout status IS changed in the database
- No audit record is created
- The admin sees a `toast.error` ("Failed to update status")
- The payouts list is NOT reloaded (error path skips `loadPayouts()`)
- The admin may not realize the status was actually updated

**This is a pre-existing issue, not introduced by any phase.** It should be documented but NOT fixed in this analysis phase.

---

## 6. Failure Mode Analysis

### Failure 1: Payout update succeeds, audit RPC fails

| Aspect | Detail |
|---|---|
| Current UI result | `toast.error("Failed to update status")`, `processing` reset to `null`, payouts list NOT reloaded |
| Data consistency risk | **High** — payout status changed but no audit record. Financial audit trail has a gap. |
| Admin visibility risk | **High** — admin sees error toast, may retry, creating duplicate status update. Admin doesn't know status was actually changed. |
| Recommended future test | "audit RPC failure: payout status is updated but error toast is shown" |

### Failure 2: Payout update succeeds, audit succeeds, notification insert fails

| Aspect | Detail |
|---|---|
| Current UI result | `toast.error("Failed to update status")`, `processing` reset to `null`, payouts list NOT reloaded |
| Data consistency risk | **Medium** — payout status changed + audit logged, but vendor not notified |
| Admin visibility risk | **Medium** — admin sees error toast, doesn't know status was actually changed and audit was logged |
| Recommended future test | "notification insert failure: payout status and audit are persisted but error toast is shown" |

### Failure 3: Audit succeeds, notification fails (same as Failure 2)

Already covered above.

### Failure 4: Payout update fails

| Aspect | Detail |
|---|---|
| Current UI result | `toast.error("Failed to update status")`, `processing` reset to `null` |
| Data consistency risk | **None** — no changes made |
| Admin visibility risk | **Low** — error is clearly shown |
| Recommended future test | "payout update failure: error toast shown, no audit or notification" |

### Failure 5: Reload fails after successful status update

| Aspect | Detail |
|---|---|
| Current UI result | `toast.success` already shown, then `loadPayouts()` fails → `toast.error("Failed to load payouts")` |
| Data consistency risk | **None** — data is consistent, UI is stale |
| Admin visibility risk | **Low** — admin sees both success and error toasts |
| Recommended future test | "reload failure after status update: success toast then error toast" |

### Failure 6: Current user/admin context is missing

| Aspect | Detail |
|---|---|
| Current UI result | `currentUser?.id` is `undefined` → `p_details: { updated_by: undefined, new_status }` — audit log records `undefined` as `updated_by` |
| Data consistency risk | **Low** — audit record is created but with missing `updated_by` |
| Admin visibility risk | **Low** — unlikely scenario since page is admin-only |
| Recommended future test | "missing admin context: audit log records undefined updated_by" |

### Failure 7: Payout record is missing (not found in local state)

| Aspect | Detail |
|---|---|
| Current UI result | `payout` is `undefined`, `previousStatus` is `'unknown'`, `payout?.amount` is `0`, `payout?.user_id` is `undefined` → notification is skipped (guard: `if (payout?.user_id)`) |
| Data consistency risk | **Medium** — status update proceeds with `previousStatus: 'unknown'` and `amount: 0` in audit log |
| Admin visibility risk | **Low** — unlikely scenario since payout must exist in loaded list |
| Recommended future test | "missing payout in local state: status update proceeds with unknown previous status" |

### Failure 8: Status is invalid (not in supported set)

| Aspect | Detail |
|---|---|
| Current UI result | No validation — any string is passed to `supabase.from('payouts').update({ status: newStatus })`. If RLS or DB constraint rejects, error is caught. |
| Data consistency risk | **Low** — DB constraints should reject invalid statuses |
| Admin visibility risk | **Low** — error toast shown |
| Recommended future test | "invalid status: DB error caught, error toast shown" |

---

## 7. Ownership Recommendation

### Option A: `src/modules/commissions/api/adminPayouts.js`

| Criterion | Assessment |
|---|---|
| Domain fit | **Good** — commissions module already owns `payoutService` and `financial_audit_log` is listed in commissions README |
| Circular dependency risk | **Low** — commissions module doesn't import from admin or payments |
| Testability | **Good** — can follow same pattern as `adminCommissions.js` |
| Financial risk | **Medium** — write operations need careful extraction |
| Consistency with previous phases | **High** — Phase 7.40 put `adminCommissions.js` in commissions module |
| Future maintainability | **Good** — keeps all financial operations in one module |

### Option B: `src/modules/payments/api/adminPayouts.js`

| Criterion | Assessment |
|---|---|
| Domain fit | **Poor** — payments module handles checkout/CMI/PayPal, not payout management |
| Circular dependency risk | **Low** |
| Testability | **Good** |
| Financial risk | **Medium** |
| Consistency with previous phases | **Low** — payouts have always been in commissions module |
| Future maintainability | **Poor** — splits payout logic across modules |

### Option C: `src/modules/admin/api/payouts.js`

| Criterion | Assessment |
|---|---|
| Domain fit | **Medium** — admin UI concern, but financial logic belongs in domain module |
| Circular dependency risk | **Medium** — admin module would need to import from commissions/notifications |
| Testability | **Good** |
| Financial risk | **Medium** |
| Consistency with previous phases | **Low** — no financial APIs in admin module currently |
| Future maintainability | **Medium** — separates admin concerns but creates cross-module dependency |

### Option D: Split read APIs and write APIs across modules

| Criterion | Assessment |
|---|---|
| Domain fit | **Poor** — splits cohesive payout logic artificially |
| Circular dependency risk | **Low** |
| Testability | **Medium** — more complex test setup |
| Financial risk | **High** — write flow is tightly coupled (update + audit + notification) |
| Consistency with previous phases | **Low** |
| Future maintainability | **Poor** — hard to find logic spread across modules |

### Option E: Keep page direct Supabase temporarily

| Criterion | Assessment |
|---|---|
| Domain fit | N/A |
| Circular dependency risk | **None** |
| Testability | **Poor** — can't test Supabase calls in isolation |
| Financial risk | **None** (no change) |
| Consistency with previous phases | **Low** — Phase 7.40 started extraction pattern |
| Future maintainability | **Poor** — direct Supabase in pages is the pattern being eliminated |

### **Recommendation: Option A — `src/modules/commissions/api/adminPayouts.js`**

**Rationale:**
1. Commissions module already owns `payoutService` and `financial_audit_log` is documented in commissions README
2. Phase 7.40 established the pattern with `adminCommissions.js` in the same module
3. No circular dependency risk
4. Keeps all financial operations (commissions + payouts) in one cohesive module
5. The `notifications.insert` call can be replaced with `notificationsApi.create()` from `@/modules/notifications` — this is a consumer relationship, not ownership

---

## 8. Existing API Overlap

### Payouts.jsx Operations vs Existing APIs

| Operation | Covered by `payoutService`? | Covered by `commissionService`? | Covered by payments API? | Covered by notifications API? | Classification |
|---|---|---|---|---|---|
| `payouts.select(...)` | ❌ No — `payoutService` only has `sendPayout` | ❌ No | ❌ No | N/A | **Should be new API** |
| `financial_audit_log.select(...)` | ❌ No | ❌ No | ❌ No | N/A | **Should be new API** |
| `payouts.update({ status })` | ❌ No — `payoutService` only has `sendPayout` | ❌ No | ❌ No | N/A | **Should be new API** |
| `rpc('log_financial_audit')` | ❌ No | ❌ No — `commissionService` uses `confirmed_transactions` and `vendor_monthly_sales`, not `log_financial_audit` | ❌ No | N/A | **Should be new API** |
| `notifications.insert(...)` | ❌ No | ❌ No | ❌ No | ✅ **`notificationsApi.create()` exists** — same pattern used by `commissionService` and `disputeService` | **Should use existing `notificationsApi.create()`** |

### Key Findings

1. **`payoutService` is minimal** — only covers `sendPayout` (Edge Function). All admin payout management is NOT covered.
2. **`notificationsApi.create()`** is the existing pattern for creating notifications. `Payouts.jsx` uses raw `supabase.from('notifications').insert()` instead. This should be replaced with `notificationsApi.create()` during extraction.
3. **`log_financial_audit` RPC** is not wrapped in any service. It's used directly in `Payouts.jsx` and referenced in `AdminPayouts.test.jsx` source inspection. Should be wrapped in a new API function.
4. **No existing API covers payout listing or status management.** All five operations need new API surface.

---

## 9. Test Coverage Audit

### Existing Tests

| Test File | Tests | Coverage | Mocks | Gaps |
|---|---|---|---|---|
| `src/__tests__/pages/AdminPayouts.test.jsx` | 4 | (1) Renders payouts list with `user_id` schema, (2) No deprecated `vendor_id`/approval columns, (3) Shows only supported statuses, (4) Source inspection: audit RPC + notification insert present | Mocked Supabase (`createBuilder`), i18next, toast, logger, authStore, UI components, heroicons | **No behavioral tests for:** loading state, empty state, error handling, status update flow, audit modal, CSV/PDF export, processing state, toast verification, filter changes |
| `src/__tests__/services/payoutService.test.js` | Tests | `payoutService.sendPayout` only | Mocked Supabase functions | Does NOT test `Payouts.jsx` |
| `src/__tests__/services/commissionService.test.js` | 71 | Full `commissionService` coverage | Mocked Supabase, notifications | Does NOT test `Payouts.jsx` |

### Coverage Gap Summary

| Area | Covered? | Gap Severity |
|---|---|---|
| Initial loading state | ❌ | **High** |
| Successful payouts list render | ✅ (partial — test 1) | Low |
| Empty payouts state | ❌ | **High** |
| Payouts select error | ❌ | **High** |
| Financial audit modal/list render | ❌ | **High** |
| Status update success path | ❌ | **Critical** |
| Status update failure (payout update fails) | ❌ | **Critical** |
| Audit RPC failure behavior | ❌ | **Critical** |
| Notification insert failure behavior | ❌ | **Critical** |
| Processing state | ❌ | **High** |
| Toast behavior | ❌ | **High** |
| CSV export | ❌ | Medium |
| PDF export | ❌ | Medium |
| Filter/date range changes | ❌ | Medium |
| No unintended extra writes | ❌ | **High** |

### Future Migration Mock Impact

| Current Mock Pattern | Migration Impact |
|---|---|
| `jest.mock('@/services/supabase')` with `createBuilder` | If queries move to a service, tests would need to mock the service instead. Existing `fromCalls` assertions would break. Source inspection test (test 4) would need to read from new API file. |
| `supabase.rpc` mocked as `jest.fn().mockResolvedValue({ data: null, error: null })` | If RPC is wrapped in a service, tests would mock the service function instead. |

---

## 10. Recommended Phase 7.42 Test Plan

### Goal

Add behavioral tests for `Payouts.jsx` before any API extraction. Follow the pattern established in Phase 7.39 for `Commissions.jsx`.

### Target File

`src/__tests__/pages/AdminPayouts.behavior.test.jsx` (new)

### Recommended Tests (15–18 tests)

| # | Test | Coverage Area |
|---|---|---|
| 1 | renders loading spinner initially | Loading state |
| 2 | renders payouts list after successful load | Success state — list |
| 3 | renders summary cards with correct values | Success state — stats |
| 4 | renders empty state when no payouts exist | Empty state |
| 5 | handles payouts load error gracefully | Error state — load |
| 6 | calls supabase.from with payouts table | Query shape |
| 7 | status filter change triggers reload | Filter behavior |
| 8 | date range change triggers reload | Filter behavior |
| 9 | handleUpdateStatus calls payouts.update with correct status | Write flow — update |
| 10 | handleUpdateStatus calls rpc log_financial_audit | Write flow — audit |
| 11 | handleUpdateStatus calls notifications.insert | Write flow — notification |
| 12 | handleUpdateStatus shows success toast on success | Toast behavior |
| 13 | handleUpdateStatus shows error toast on payout update failure | Error handling — write |
| 14 | handleUpdateStatus shows error toast on audit RPC failure | Error handling — audit |
| 15 | handleUpdateStatus shows error toast on notification insert failure | Error handling — notification |
| 16 | processing state is set during status update | Processing state |
| 17 | audit modal opens with audit logs | Audit modal |
| 18 | audit modal shows "No audit logs found" when empty | Audit modal — empty |

### Mock Pattern

Follow `AdminPayouts.test.jsx` existing pattern:
- Mock `@/services/supabase` with `createBuilder` + `fromCalls`
- Mock `react-i18next`, `react-hot-toast`, `@/utils/logger`, `@/store/authStore`, `@/components/ui`, `@heroicons/react/24/outline`
- Mock `date-fns` if needed
- Mock `@react-pdf/renderer` (already mocked in `jest.setup.js`)

---

## 11. Recommended Extraction Sequence

### Phase 7.42 — Add behavior tests for Payouts.jsx

**Goal:** Add 15–18 behavioral tests covering loading, success, empty, error, write flow, audit, notifications, processing state, toasts, and modal.

**No production code changes. Test file only.**

### Phase 7.43 — Extract read-only queries from Payouts.jsx

**Goal:** Extract `payouts.select(...)` and `financial_audit_log.select(...)` into `src/modules/commissions/api/adminPayouts.js`.

**New API functions:**
- `getAdminPayouts({ dateRange, statusFilter })` — read-only payouts query
- `getPayoutAuditLogs(payoutId)` — read-only audit log query

**Changes:**
- `Payouts.jsx` imports new API functions instead of using `supabase` directly for reads
- Update page tests to mock new API functions
- Add API tests for query shape verification
- **No write operations extracted in this phase**

### Phase 7.44 — Add focused tests for status update write flow

**Goal:** Add detailed tests for `handleUpdateStatus` covering all failure modes identified in Section 6.

**Tests:**
- Payout update succeeds, audit RPC fails → verify error toast, verify no reload
- Payout update succeeds, audit succeeds, notification fails → verify error toast
- Payout update fails → verify error toast, no audit, no notification
- Missing admin context → verify audit log records undefined `updated_by`
- All operations succeed → verify success toast, reload triggered

### Phase 7.45 — Extract payout status update flow into API

**Goal:** Extract `handleUpdateStatus` write operations into `src/modules/commissions/api/adminPayouts.js`.

**New API function:**
- `updatePayoutStatus({ payoutId, newStatus, previousStatus, payout, currentUser })` — wraps: payout update + audit RPC + notification insert

**Changes:**
- `Payouts.jsx` calls `updatePayoutStatus(...)` instead of direct Supabase writes
- Replace `supabase.from('notifications').insert(...)` with `notificationsApi.create()` from `@/modules/notifications`
- Remove `import { supabase }` from `Payouts.jsx`
- Update tests to mock new API function
- Add API tests for write flow

**Risk mitigation:**
- Preserve exact same operation sequence (update → audit → notify)
- Preserve exact same error handling (no individual try/catch — same as current)
- Do NOT add transaction wrapping (that would be a behavior change)
- Do NOT add individual error handling for RPC/notification (that would be a behavior change)

### Phase 7.46 — Cleanup and direct Supabase removal report

**Goal:** Verify `Payouts.jsx` no longer imports `supabase` directly. Create closure report.

---

## 12. Risk Rating

| Risk Area | Rating | Justification |
|---|---|---|
| **Overall risk** | **High** | Financial writes + audit + notifications + complex UI state |
| **Read extraction risk** | **Low** | Read-only queries, same pattern as Phase 7.40 |
| **Write extraction risk** | **High** | Financial status update, non-transactional, no individual error handling |
| **Audit RPC risk** | **High** | Audit integrity, no individual error handling, RPC parameters must be preserved exactly |
| **Notification insert risk** | **Medium** | Can use existing `notificationsApi.create()`, but must preserve notification payload exactly |
| **UI behavior risk** | **High** | Processing state, toast notifications, reload after update, audit modal, CSV/PDF export |
| **Testing difficulty** | **High** | 5 Supabase operations, 3 write operations with failure modes, complex mock setup |

---

## 13. Verification Results

| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed |
| `npm run type-check` | ✅ Passed |
| `npm run build` | ✅ Passed |
| `npm run check:circular` | ✅ 714 files, 0 circular dependencies |
| Targeted tests (12 suites) | ✅ 192/192 passed |

---

## 14. Files Inspected

- `.windsurfrules` (614 lines — Section 37 confirmed)
- `docs/architecture/phase-7-38-direct-supabase-usage-commissions-payouts-analysis.md`
- `docs/architecture/phase-7-39-commissions-page-behavior-tests-report.md`
- `docs/architecture/phase-7-40-commissions-page-read-query-extraction-report.md`
- `src/pages/admin/Payouts.jsx` (652 lines — NOT modified)
- `src/pages/admin/Commissions.jsx` (NOT modified)
- `src/modules/commissions/api/payoutService.js` (22 lines — NOT modified)
- `src/modules/commissions/api/commissionService.js` (NOT modified)
- `src/modules/commissions/api/index.js` (NOT modified)
- `src/modules/commissions/index.js` (NOT modified)
- `src/modules/commissions/README.md` (NOT modified)
- `src/modules/payments/api/index.js` (NOT modified)
- `src/modules/notifications/api/index.js` (NOT modified)
- `src/modules/notifications/README.md` (NOT modified)
- `src/services/notifications.js` (NOT modified — `notificationsApi.create()` pattern reference)
- `src/__tests__/pages/AdminPayouts.test.jsx` (217 lines — NOT modified)
- `MODULAR_DEVELOPMENT_PLAN.md`
- `package.json`
- `eslint.config.js`
- `jest.config.js`
- `jest.setup.js`

## 15. Files Changed

| File | Change |
|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | **Updated** — Phase 7.41 status added |
| `docs/architecture/phase-7-41-payouts-page-deep-analysis.md` | **Created** — This report |

**No production files were modified. No test files were modified.**

---

## 16. Suggested Phase 7.42 Prompt Outline

```
Phase 7.42 — Add behavior tests for Payouts.jsx.

Goal: Add behavioral tests for src/pages/admin/Payouts.jsx before any
API extraction. Follow the pattern from Phase 7.39 (AdminCommissions.behavior.test.jsx).

Target file: src/pages/admin/Payouts.jsx (652 lines — DO NOT MODIFY)
Test file: src/__tests__/pages/AdminPayouts.behavior.test.jsx (new)

Tests to add (15–18):
1. renders loading spinner initially
2. renders payouts list after successful load
3. renders summary cards with correct values
4. renders empty state when no payouts exist
5. handles payouts load error gracefully
6. calls supabase.from with payouts table
7. status filter change triggers reload
8. date range change triggers reload
9. handleUpdateStatus calls payouts.update with correct status
10. handleUpdateStatus calls rpc log_financial_audit
11. handleUpdateStatus calls notifications.insert
12. handleUpdateStatus shows success toast on success
13. handleUpdateStatus shows error toast on payout update failure
14. handleUpdateStatus shows error toast on audit RPC failure
15. handleUpdateStatus shows error toast on notification insert failure
16. processing state is set during status update
17. audit modal opens with audit logs
18. audit modal shows "No audit logs found" when empty

Mock pattern: Follow AdminPayouts.test.jsx — mock @/services/supabase
with createBuilder, fromCalls, rpc mock. Mock react-i18next, toast,
logger, authStore, UI components, heroicons. Mock date-fns if needed.

No production code changes. No behavior changes. Test file only.

Requires: Explicit user approval per .windsurfrules if any Protected
Zone interaction.
```
