# Phase 7.43 — Payouts.jsx Read-Only Query Extraction

**Phase:** 7.43 — Extract read-only queries from Payouts.jsx into commissions module API
**Date:** 2026-06-26
**Status:** Complete — Read-only extraction, no write flow changes
**Previous:** Phase 7.42 (Payouts.jsx Behavior Tests)
**Next:** Phase 7.44 (Focused write-flow tests for `handleUpdateStatus`)

---

## 1. `.windsurfrules` Compliance

✅ `.windsurfrules` was read and strictly followed.

## 2. Read-Only Extraction Confirmation

✅ This was a **read-only extraction only**.
✅ No write flow was extracted.
✅ `payouts.update({ status })` remains unchanged — still called directly via `supabase` in `Payouts.jsx`.
✅ `rpc('log_financial_audit')` remains unchanged — still called directly via `supabase` in `Payouts.jsx`.
✅ `notifications.insert(...)` remains unchanged — still called directly via `supabase` in `Payouts.jsx`.
✅ Toast success/error behavior unchanged.
✅ Processing state unchanged.
✅ Non-transactional write behavior NOT fixed (pre-existing, documented in Phase 7.41/7.42).
✅ R-001 logic NOT touched.
✅ `commissionService` logic NOT changed.
✅ `payoutService` logic NOT changed.
✅ No schema/RLS changes.
✅ No Edge Function changes.
✅ No route changes.
✅ No React Query key changes.

---

## 3. Files Inspected

| File | Purpose |
|---|---|
| `.windsurfrules` | Project rules |
| `docs/architecture/phase-7-41-payouts-page-deep-analysis.md` | Deep analysis report |
| `docs/architecture/phase-7-42-payouts-page-behavior-tests-report.md` | Behavior tests report |
| `src/pages/admin/Payouts.jsx` | Main component (652 lines) |
| `src/__tests__/pages/AdminPayouts.behavior.test.jsx` | Behavior tests (19 tests) |
| `src/modules/commissions/api/index.js` | API barrel exports |
| `src/modules/commissions/index.js` | Module public API |
| `src/modules/commissions/api/adminCommissions.js` | Existing admin API (pattern reference) |
| `src/__tests__/modules/commissions/adminCommissions.test.js` | Existing API tests (pattern reference) |
| `MODULAR_DEVELOPMENT_PLAN.md` | Development plan |

## 4. Files Changed

| File | Change |
|---|---|
| `src/modules/commissions/api/adminPayouts.js` | **Created** — `getAdminPayouts` and `getPayoutFinancialAuditLogs` |
| `src/modules/commissions/api/index.js` | **Updated** — Added exports for `getAdminPayouts` and `getPayoutFinancialAuditLogs` |
| `src/modules/commissions/index.js` | **Updated** — Added exports for `getAdminPayouts` and `getPayoutFinancialAuditLogs` |
| `src/pages/admin/Payouts.jsx` | **Updated** — Replaced read queries with API calls; removed unused `subDays` import; kept `supabase` import for writes |
| `src/__tests__/pages/AdminPayouts.behavior.test.jsx` | **Updated** — Mock `@/modules/commissions` for reads; keep `@/services/supabase` for writes |
| `src/__tests__/modules/commissions/adminPayouts.test.js` | **Created** — 21 API tests |
| `docs/architecture/phase-7-43-payouts-page-read-query-extraction-report.md` | **Created** — This report |
| `MODULAR_DEVELOPMENT_PLAN.md` | **Updated** — Phase 7.43 status |

---

## 5. New API Functions

### `getAdminPayouts({ dateRange, statusFilter })`

**Location:** `src/modules/commissions/api/adminPayouts.js`

**Parameters:**
- `dateRange` (string, default `'30d'`) — One of `'7d'`, `'30d'`, `'3m'`, `'6m'`, `'all'`
- `statusFilter` (string, default `'all'`) — One of `'all'`, `'pending'`, `'processing'`, `'completed'`, `'failed'`

**Behavior:**
- Queries `payouts` table with `profiles` join via `payouts_user_id_fkey`
- Selects `*` and `user:profiles!payouts_user_id_fkey(id, first_name, last_name, email, store_name, phone)`
- Orders by `created_at` descending
- Applies `gte('created_at', startDate)` when `dateRange !== 'all'`
- Applies `eq('status', statusFilter)` when `statusFilter !== 'all'`
- Returns `{ data, error }`

### `getPayoutFinancialAuditLogs({ payoutId })`

**Location:** `src/modules/commissions/api/adminPayouts.js`

**Parameters:**
- `payoutId` (string, required) — The payout ID to fetch audit logs for

**Behavior:**
- Queries `financial_audit_log` table with `profiles` join via `financial_audit_log_performed_by_fkey`
- Selects `*` and `performed_by_profile:profiles!financial_audit_log_performed_by_fkey(first_name, last_name, role)`
- Filters by `eq('entity_type', 'payout')` and `eq('entity_id', payoutId)`
- Orders by `created_at` ascending
- Returns `{ data, error }`

---

## 6. Old vs New Read Query Locations

### Payouts List Query

**Old:** `src/pages/admin/Payouts.jsx` → `loadPayouts` callback (lines 66–95)
- Direct `supabase.from('payouts').select(...).order(...).gte(...).eq(...)` 

**New:** `src/modules/commissions/api/adminPayouts.js` → `getAdminPayouts()`
- Same query, same columns, same filters, same ordering
- Called from `Payouts.jsx` as `await getAdminPayouts({ dateRange: selectedRange, statusFilter: filter })`

### Financial Audit Log Query

**Old:** `src/pages/admin/Payouts.jsx` → `loadAuditLogs` function (lines 127–138)
- Direct `supabase.from('financial_audit_log').select(...).eq(...).eq(...).order(...)`

**New:** `src/modules/commissions/api/adminPayouts.js` → `getPayoutFinancialAuditLogs()`
- Same query, same columns, same filters, same ordering
- Called from `Payouts.jsx` as `await getPayoutFinancialAuditLogs({ payoutId })`

---

## 7. Supabase Query Equivalence

### Payouts Select

| Aspect | Old (Payouts.jsx) | New (adminPayouts.js) |
|---|---|---|
| Table | `payouts` | `payouts` |
| Select | `*, user:profiles!payouts_user_id_fkey(id, first_name, last_name, email, store_name, phone)` | `*, user:profiles!payouts_user_id_fkey(id, first_name, last_name, email, store_name, phone)` |
| Order | `created_at` descending | `created_at` descending |
| Date filter | `gte('created_at', startDate.toISOString())` when range ≠ 'all' | `gte('created_at', startDate)` when dateRange ≠ 'all' |
| Status filter | `eq('status', filter)` when filter ≠ 'all' | `eq('status', statusFilter)` when statusFilter ≠ 'all' |
| Limit | None | None |
| Return shape | `{ data, error }` | `{ data, error }` |

### Financial Audit Log Select

| Aspect | Old (Payouts.jsx) | New (adminPayouts.js) |
|---|---|---|
| Table | `financial_audit_log` | `financial_audit_log` |
| Select | `*, performed_by_profile:profiles!financial_audit_log_performed_by_fkey(first_name, last_name, role)` | `*, performed_by_profile:profiles!financial_audit_log_performed_by_fkey(first_name, last_name, role)` |
| Filter 1 | `eq('entity_type', 'payout')` | `eq('entity_type', 'payout')` |
| Filter 2 | `eq('entity_id', payoutId)` | `eq('entity_id', payoutId)` |
| Order | `created_at` ascending | `created_at` ascending |
| Limit | None | None |
| Return shape | `{ data, error }` | `{ data, error }` |

---

## 8. Barrels Updated

### `src/modules/commissions/api/index.js`

Added:
```js
export {
  getAdminPayouts,
  getPayoutFinancialAuditLogs,
} from './adminPayouts'
```

### `src/modules/commissions/index.js`

Added:
```js
  // adminPayouts — read-only admin payout queries (created in Phase 7.43)
  getAdminPayouts,
  getPayoutFinancialAuditLogs,
```

---

## 9. Page Update Summary

### `src/pages/admin/Payouts.jsx`

**Changes:**
1. Added import: `import { getAdminPayouts, getPayoutFinancialAuditLogs } from '@/modules/commissions'`
2. Replaced `loadPayouts` query logic with `await getAdminPayouts({ dateRange: selectedRange, statusFilter: filter })`
3. Replaced `loadAuditLogs` query logic with `await getPayoutFinancialAuditLogs({ payoutId })`
4. Removed unused `subDays` import from `date-fns` (date range logic moved to API)
5. Kept `import { supabase } from '@/services/supabase'` — still needed for write operations

**NOT changed:**
- `handleUpdateStatus` write chain (update → audit RPC → notification insert)
- Toast behavior
- Processing state
- CSV/PDF export logic
- UI layout, fields, formatting
- Filter/date behavior
- Routes

---

## 10. Tests Updated

### `src/__tests__/pages/AdminPayouts.behavior.test.jsx`

**Changes:**
- Added `jest.mock('@/modules/commissions', () => ({ getAdminPayouts: jest.fn(), getPayoutFinancialAuditLogs: jest.fn() }))`
- Removed `payouts` and `financial_audit_log` from `resolveQuery` (reads now via API mock)
- Kept `payouts` (update) and `notifications` (insert) in `resolveQuery` (writes still via supabase mock)
- Updated test 5: checks `commissions.getAdminPayouts` called instead of `fromCalls` containing `'payouts'`
- Updated test 6: checks `commissions.getAdminPayouts.mock.calls.length` for reload instead of `fromCalls`
- Updated test 7: same pattern for date range reload
- Updated test 19: checks `commissions.getPayoutFinancialAuditLogs` called instead of `fromCalls` containing `'financial_audit_log'`
- Tests 8–13 (write flow): still verify `fromCalls` and `rpcCalls` via supabase mock (unchanged)

**All 19 behavior tests preserved. No tests weakened.**

## 11. Tests Added

### `src/__tests__/modules/commissions/adminPayouts.test.js` (21 tests)

**`getAdminPayouts` tests (13):**
1. calls supabase.from with payouts table
2. selects the expected columns including user join
3. orders by created_at descending
4. applies gte filter on created_at when dateRange is not "all"
5. does not apply gte filter when dateRange is "all"
6. applies eq filter on status when statusFilter is not "all"
7. does not apply eq filter when statusFilter is "all"
8. computes correct date range for 7d
9. computes correct date range for 3m (90d)
10. defaults to 30d when no dateRange provided
11. returns { data, error } shape
12. returns error when query fails
13. does not perform Supabase write operations

**`getPayoutFinancialAuditLogs` tests (8):**
14. calls supabase.from with financial_audit_log table
15. selects the expected columns including performed_by_profile join
16. filters by entity_type = payout
17. filters by entity_id = payoutId
18. orders by created_at ascending
19. returns { data, error } shape
20. returns error when query fails
21. does not perform Supabase write operations

---

## 12. Confirmations

- ✅ UI behavior is unchanged
- ✅ No writes were introduced by the new API
- ✅ No RPC/Edge Function calls were introduced by the new API
- ✅ Known non-transactional write behavior was NOT changed
- ✅ R-001 was NOT touched
- ✅ Payout/payment behavior is unchanged except read access location (now via API functions)
- ✅ Routes are unchanged
- ✅ Schema/RLS are unchanged
- ✅ No circular dependencies were introduced

---

## 13. Verification Results

### New API Tests

| Check | Result |
|---|---|
| `adminPayouts.test.js` | ✅ 21/21 passed |

### Page Behavior Tests

| Check | Result |
|---|---|
| `AdminPayouts.behavior.test.jsx` | ✅ 19/19 passed |
| `AdminPayouts.test.jsx` (schema compatibility) | ✅ 4/4 passed |

### Related Targeted Tests

| Check | Result |
|---|---|
| Targeted tests (14 suites: payout, commission, paymentMethod, notification, AdminPayout, AdminCommission, adminCommissions, adminPayouts) | ✅ 232/232 passed |

### Full Test Suite

| Check | Result |
|---|---|
| Full suite (149 suites) | ✅ 1591/1591 passed (2 todo, 0 failures) |

### Final Checks

| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed |
| `npm run type-check` | ✅ Passed |
| `npm run build` | ✅ Passed |
| `npm run check:circular` | ✅ 714 files, 0 circular dependencies |

---

## 14. Safety Assessment

**Safe to continue to Phase 7.44.**

- Read-only queries extracted successfully
- All 19 behavior tests preserved and passing
- 21 new API tests provide query shape and no-writes coverage
- Write flow remains unchanged in `Payouts.jsx`
- All final checks pass (lint, type-check, build, check:circular)
- Full test suite: 149 suites, 1591 tests, 0 failures

---

## 15. Recommended Phase 7.44

**Focused write-flow tests for `handleUpdateStatus`.**

- Add dedicated tests for the non-transactional write chain (update → audit → notify)
- Test partial failure scenarios in detail (update succeeds, audit fails, notification fails)
- Test concurrent status updates
- Test processing state transitions
- **No extraction yet** — wait until tests show sufficient coverage
- After Phase 7.44, Phase 7.45 can safely extract the write flow into API functions
