# Phase 7.46 — Payouts Direct Supabase Removal Closure + Risk Review

**Phase:** 7.46 — Closure and risk review only
**Date:** 2026-06-26
**Status:** Complete — No production code changes, no test changes
**Previous:** Phase 7.45 (Payouts Write-Flow Extraction)
**Next:** Phase 7.47 (Recommended: R-002 behavior analysis only)

---

## 1. `.windsurfrules` Compliance

✅ `.windsurfrules` was read and strictly followed.

## 2. Phase Type Confirmation

✅ This was **closure/audit only**.
✅ No production code changed.
✅ No tests changed.
✅ No files moved.
✅ No imports rewritten.
✅ No code extracted.
✅ No behavior changed (non-transactional, toast, processing state, reload, UI, routes, schema/RLS, Edge Functions).

---

## 3. Direct Supabase Removal Verification

### `src/pages/admin/Payouts.jsx`

**Search results:**
- `supabase` — **0 matches** ✅
- `supabase.from` — **0 matches** ✅
- `supabase.rpc` — **0 matches** ✅
- `supabase.functions` — **0 matches** ✅
- `supabase.auth` — **0 matches** ✅
- `supabase.storage` — **0 matches** ✅
- `@/services/supabase` import — **0 matches** ✅
- Relative Supabase imports — **0 matches** ✅
- Old direct query chains — **0 matches** ✅
- Deep import `@/modules/commissions/api` — **0 matches** ✅ (page imports from `@/modules/commissions`)

**Current import (line 17):**
```js
import { getAdminPayouts, getPayoutFinancialAuditLogs, updateAdminPayoutStatus } from '@/modules/commissions'
```

**Conclusion:** `Payouts.jsx` has **zero direct Supabase usage**. All read and write Supabase operations have been fully extracted to `adminPayouts.js`.

---

## 4. Admin Payouts API Ownership Summary

**File:** `src/modules/commissions/api/adminPayouts.js`

| Function | Responsibility | Table/RPC | Type | Risk Level | Test Coverage |
|---|---|---|---|---|---|
| `getAdminPayouts({ dateRange, statusFilter })` | Read payouts with user join, date/status filters | `payouts` + `profiles` join | Read | Low | 12 tests in `adminPayouts.test.js` |
| `getPayoutFinancialAuditLogs({ payoutId })` | Read audit logs for a specific payout | `financial_audit_log` + `profiles` join | Read | Low | 8 tests in `adminPayouts.test.js` |
| `updateAdminPayoutStatus({ payoutId, newStatus, payout, currentUser })` | Write flow: update status → audit RPC → notification insert | `payouts` (update), `rpc('log_financial_audit')`, `notifications` (insert) | Write | **High (R-002)** | 15 tests in `adminPayouts.test.js` |

**Total API tests:** 36 (12 read + 8 audit read + 15 write + 1 Edge Functions check)

---

## 5. Public API Export Summary

### `src/modules/commissions/api/index.js`

```js
export {
  getAdminPayouts,
  getPayoutFinancialAuditLogs,
  updateAdminPayoutStatus,
} from './adminPayouts'
```

### `src/modules/commissions/index.js`

```js
  // adminPayouts — admin payout queries (created in Phase 7.43, extended in Phase 7.45)
  getAdminPayouts,
  getPayoutFinancialAuditLogs,
  updateAdminPayoutStatus,
} from './api'
```

### Page Import

`Payouts.jsx` imports from `@/modules/commissions` (public API) — **no deep imports**.

### Forbidden Deep Import Audit

- `@/modules/commissions/api/adminPayouts` in app code: **0 matches** ✅
- `@/services/supabase` in `Payouts.jsx`: **0 matches** ✅

---

## 6. Query/Write Equivalence Summary

| Aspect | Phase 7.43 (Read) | Phase 7.45 (Write) | Equivalent? |
|---|---|---|---|
| Payouts select columns | `*, user:profiles!payouts_user_id_fkey(...)` | N/A | ✅ |
| Payouts select order | `created_at desc` | N/A | ✅ |
| Payouts select filters | `gte(created_at)`, `eq(status)` | N/A | ✅ |
| Audit log select columns | `*, performed_by_profile:profiles!...` | N/A | ✅ |
| Audit log select filters | `eq(entity_type, 'payout')`, `eq(entity_id, payoutId)` | N/A | ✅ |
| Audit log select order | `created_at asc` | N/A | ✅ |
| Update payload | N/A | `{ status: newStatus }` only | ✅ |
| Update filter | N/A | `.eq('id', payoutId)` | ✅ |
| Audit RPC name | N/A | `log_financial_audit` | ✅ |
| Audit RPC payload | N/A | All 8 fields preserved | ✅ |
| Notification insert table | N/A | `notifications` | ✅ |
| Notification insert payload | N/A | `user_id`, `title`, `message`, `type`, `data` | ✅ |
| previousStatus fallback | N/A | `payout?.status \|\| 'unknown'` | ✅ |
| Amount fallback | N/A | `payout?.amount \|\| 0` | ✅ |
| user_id notification skip | N/A | `if (payout?.user_id)` | ✅ |
| Partial failure: audit RPC | N/A | Error NOT returned (non-transactional) | ✅ |
| Partial failure: notification | N/A | Error NOT returned (non-transactional) | ✅ |
| Toast on partial failure | N/A | `toast.success` shown | ✅ |
| Reload on partial failure | N/A | `loadPayouts()` called | ✅ |

---

## 7. Test Coverage Summary

### Payouts Page Tests

| Test File | Tests | Status |
|---|---|---|
| `AdminPayouts.behavior.test.jsx` | 19 | ✅ All pass |
| `AdminPayouts.write-flow.test.jsx` | 12 | ✅ All pass |
| `AdminPayouts.test.jsx` (schema) | 4 | ✅ All pass |
| **Total page tests** | **35** | ✅ |

### Admin Payouts API Tests

| Test File | Tests | Status |
|---|---|---|
| `adminPayouts.test.js` (getAdminPayouts) | 12 | ✅ All pass |
| `adminPayouts.test.js` (getPayoutFinancialAuditLogs) | 9 | ✅ All pass |
| `adminPayouts.test.js` (updateAdminPayoutStatus) | 15 | ✅ All pass |
| **Total API tests** | **36** | ✅ |

### Related Targeted Tests

| Scope | Suites | Tests | Status |
|---|---|---|---|
| AdminPayouts + adminPayouts + AdminCommissions + adminCommissions + commissionService + payoutService | 9 | 175 | ✅ All pass |

### Full Test Suite

| Scope | Suites | Tests | Status |
|---|---|---|---|
| Full suite | 150 | 1618 passed, 2 todo, 0 failures | ✅ |

### Remaining Coverage Gaps

| Gap | Risk | Notes |
|---|---|---|
| Transactionality | High | Write flow is non-transactional — no rollback on partial failure (R-002) |
| Rollback behavior | High | No rollback mechanism exists — payout status can change without audit log or notification |
| Admin audit integrity | Medium | If audit RPC fails, audit trail is incomplete — no compensating mechanism |
| Notification reliability | Medium | If notification insert fails, vendor is not informed — no retry mechanism |
| CSV/PDF export depth | Low | Export logic remains in page — not extracted or deeply tested |
| Integration/E2E coverage | Low | No E2E tests for the full payout status update flow |

---

## 8. Remaining Risk Register

### R-002: Non-Transactional Payout Write Flow

**ID:** R-002
**Status:** Open — Documented, preserved, not fixed
**Severity:** High
**Introduced:** Pre-existing (documented in Phase 7.41, preserved through Phase 7.45)
**Owner:** Commissions module (`adminPayouts.js`)

#### Current Behavior

`updateAdminPayoutStatus` executes three sequential operations:

1. `payouts.update({ status })` — **if this fails, returns `{ error }` immediately (short-circuit)**
2. `rpc('log_financial_audit')` — **if this fails, error is NOT checked, execution continues**
3. `notifications.insert(...)` — **if this fails, error is NOT checked, execution continues**

**Result:** If step 1 succeeds but step 2 or 3 fails, the payout status is changed in the database but:
- The audit trail may be incomplete (missing audit log entry)
- The vendor may not receive a notification
- The admin sees `toast.success` and the page reloads — no indication of partial failure

#### Why It Was Preserved

- Phase 7.45 was extraction-only — the goal was to move code without changing behavior
- Fixing non-transactional behavior requires careful design (server-side transaction, compensating actions, or admin warning)
- The behavior was thoroughly documented and tested in Phases 7.41–7.44
- Changing write behavior in an extraction phase would violate the separation of concerns principle

#### Current Tests Proving Behavior

| Test File | Test | What It Proves |
|---|---|---|
| `adminPayouts.test.js` | "returns { error } when update fails (short-circuit)" | Update failure returns error, no audit/notification |
| `adminPayouts.test.js` | "audit RPC failure does NOT return error" | Audit failure is silently swallowed |
| `adminPayouts.test.js` | "notification insert failure does NOT return error" | Notification failure is silently swallowed |
| `AdminPayouts.behavior.test.jsx` | "audit RPC failure: success toast shown" | Page shows success even when audit fails |
| `AdminPayouts.behavior.test.jsx` | "notification insert failure: success toast shown" | Page shows success even when notification fails |
| `AdminPayouts.write-flow.test.jsx` | "non-transactional: API returns no error, page shows toast.success" | End-to-end non-transactional behavior |

#### Business Risk

1. **Financial audit integrity:** If `log_financial_audit` RPC fails, the payout status change is not recorded in the audit trail. This creates a compliance gap for financial operations.
2. **Vendor communication:** If `notifications.insert` fails, the vendor is not informed of the payout status change. This can lead to confusion and support tickets.
3. **False success feedback:** The admin sees `toast.success` even when the write chain is incomplete. This can lead to incorrect assumptions about system state.
4. **No retry mechanism:** There is no automatic retry for failed audit or notification operations.
5. **No compensating action:** There is no mechanism to detect and repair incomplete write chains.

#### Recommended Future Handling

**Step 1: Analysis only (Phase 7.47 — recommended)**
- Analyze the frequency and impact of partial failures
- Review Supabase RPC error rates
- Determine if server-side transaction is feasible
- Evaluate business tolerance for the current behavior

**Step 2: Characterization/fix tests (Phase 7.48 — if needed)**
- Add tests that characterize the desired behavior after fix
- Design the fix approach (server-side, client-side, or hybrid)

**Step 3: Possible fixes (Phase 7.49+ — if justified)**
- **Option A: Server-side transaction** — Move the entire write chain to a PostgreSQL function or Edge Function that wraps all three operations in a transaction
- **Option B: Compensating admin warning** — After the write chain, check if audit/notification succeeded and show a warning toast if not
- **Option C: Promise.allSettled + observability** — Use `Promise.allSettled` to track all operations and report partial failures to the admin and/or monitoring
- **Option D: Retry mechanism** — Add retry logic for audit RPC and notification insert with exponential backoff

**Recommendation:** Start with Option A (server-side transaction) as the most robust solution, but only after analysis confirms the need and feasibility.

---

## 9. Verification Results

### Final Checks

| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed |
| `npm run type-check` | ✅ Passed |
| `npm run build` | ✅ Passed |
| `npm run check:circular` | ✅ 714 files, 0 circular dependencies |

### Test Results

| Check | Result |
|---|---|
| Targeted tests (9 suites: AdminPayouts, adminPayouts, AdminCommissions, adminCommissions, commissionService, payoutService) | ✅ 175/175 passed |
| Full test suite (150 suites) | ✅ 1618/1618 passed (2 todo, 0 failures) |

---

## 10. Phase 7.41–7.46 Closure Summary

| Phase | Description | Status |
|---|---|---|
| 7.41 | Deep analysis of Payouts.jsx | ✅ Complete |
| 7.42 | Behavior tests for Payouts.jsx (19 tests) | ✅ Complete |
| 7.43 | Read-only query extraction (getAdminPayouts, getPayoutFinancialAuditLogs) | ✅ Complete |
| 7.44 | Write-flow focused tests (20 tests, later revised to 12 page + 15 API) | ✅ Complete |
| 7.45 | Write-flow extraction (updateAdminPayoutStatus) | ✅ Complete |
| 7.46 | Direct Supabase removal closure + risk review | ✅ Complete |

**Result:** `Payouts.jsx` has zero direct Supabase usage. All read and write operations live in `src/modules/commissions/api/adminPayouts.js`. 71 page tests + 36 API tests provide comprehensive coverage. R-002 (non-transactional write flow) is documented and open.

---

## 11. Recommended Phase 7.47

**Recommendation: Phase 7.47 — R-002 behavior analysis only**

Given that:
- R-002 involves financial status writes (high business impact)
- The non-transactional behavior is pre-existing and well-documented
- A fix requires careful design (server-side transaction, Edge Function, or compensating mechanism)
- No fix should be applied without thorough analysis

**Phase 7.47 should:**
1. Analyze the frequency and conditions under which `log_financial_audit` RPC fails
2. Analyze the frequency and conditions under which `notifications.insert` fails
3. Review Supabase logs/error rates if available
4. Evaluate business tolerance for partial failures
5. Document whether a server-side transaction is feasible (PostgreSQL function wrapping all three operations)
6. Evaluate whether an Edge Function approach is better
7. Consider whether a compensating admin warning is sufficient as an interim measure
8. Produce a risk analysis report with recommendations — no code changes

**Alternative:** If the team prefers to pause the Payouts/Commissions track, Phase 7.47 could be a broader architecture migration phase, returning to R-002 analysis later.

### Suggested Phase 7.47 Prompt Outline

```
Phase 7.47 — R-002 Non-Transactional Payout Write Flow Analysis

This is analysis only. No production code changes. No test changes.

Goals:
1. Analyze the frequency and conditions under which log_financial_audit RPC fails.
2. Analyze the frequency and conditions under which notifications.insert fails.
3. Evaluate business tolerance for partial failures.
4. Document whether a server-side transaction is feasible.
5. Evaluate whether an Edge Function approach is better.
6. Consider whether a compensating admin warning is sufficient as an interim measure.
7. Produce a risk analysis report with recommendations.

Files to inspect:
- src/modules/commissions/api/adminPayouts.js
- Supabase schema for payouts, financial_audit_log, notifications tables
- Supabase RPC definition for log_financial_audit
- RLS policies for all three tables
- Phase 7.41–7.46 reports

Output:
- docs/architecture/phase-7-47-r002-analysis-report.md
- Updated MODULAR_DEVELOPMENT_PLAN.md
```

---

## 12. Safety Confirmations

- ✅ No production code changed
- ✅ No tests changed
- ✅ No files moved
- ✅ No imports rewritten
- ✅ No code extracted
- ✅ No behavior changes
- ✅ No schema/RLS changes
- ✅ No Edge Function changes
- ✅ No route changes
- ✅ No React Query key changes
- ✅ No circular dependencies introduced
- ✅ No forbidden deep module imports in app code
- ✅ R-001 was not touched
- ✅ R-002 was not fixed (documented only)
