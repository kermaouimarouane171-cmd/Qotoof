# Phase 7.47 — R-002 Payout Partial Failure Behavior Analysis

**Phase:** 7.47 — Analysis only
**Date:** 2026-06-26
**Status:** Complete — No production code changes, no test changes
**Previous:** Phase 7.46 (Payouts Direct Supabase Removal Closure + Risk Review)
**Next:** Phase 7.48 (Recommended: R-002 characterization + desired-behavior tests)

---

## 1. `.windsurfrules` Compliance

✅ `.windsurfrules` was read and strictly followed.

## 2. Phase Type Confirmation

✅ This was **analysis only**.
✅ No production code changed.
✅ No tests changed.
✅ No files moved.
✅ No imports rewritten.
✅ No behavior changes.
✅ No schema/RLS changes.
✅ No Edge Function changes.
✅ No direct R-002 fix implemented.

---

## 3. R-002 Summary

**ID:** R-002
**Status:** Analyzed, not fixed
**Severity:** High (financial status writes)
**Owner:** `src/modules/commissions/api/adminPayouts.js` → `updateAdminPayoutStatus`

`updateAdminPayoutStatus` performs three sequential operations non-transactionally:

1. `payouts.update({ status })` — **error checked, short-circuits**
2. `rpc('log_financial_audit')` — **error NOT checked**
3. `notifications.insert(...)` — **error NOT checked, only if `payout?.user_id`**

A partial failure can leave the system in a state where payout status changed but audit or notification side effects failed.

---

## 4. Current Flow Map

### `updateAdminPayoutStatus({ payoutId, newStatus, payout, currentUser })`

```
┌─────────────────────────────────────────────────────────┐
│  1. payouts.update({ status: newStatus })               │
│     .eq('id', payoutId)                                 │
│                                                         │
│     IF error → return { error }  ← SHORT-CIRCUIT        │
│     IF success → continue                               │
├─────────────────────────────────────────────────────────┤
│  2. rpc('log_financial_audit', { ... })                 │
│                                                         │
│     IF error → IGNORED (non-transactional)              │
│     IF success → continue                               │
├─────────────────────────────────────────────────────────┤
│  3. if (payout?.user_id):                               │
│       notifications.insert({ ... })                     │
│                                                         │
│     IF error → IGNORED (non-transactional)              │
│     IF success → continue                               │
│     IF no user_id → SKIPPED                             │
├─────────────────────────────────────────────────────────┤
│  return { error: null }                                 │
└─────────────────────────────────────────────────────────┘
```

### `Payouts.jsx` → `handleUpdateStatus(payoutId, newStatus)`

```
┌─────────────────────────────────────────────────────────┐
│  setProcessing(payoutId)                                │
│  payout = payouts.find(p => p.id === payoutId)          │
│  { error } = await updateAdminPayoutStatus({...})       │
│                                                         │
│  IF error → throw error                                 │
│    → catch: logger.error, toast.error                   │
│    → finally: setProcessing(null)                       │
│    → NO reload                                          │
│                                                         │
│  IF success:                                            │
│    → toast.success('Status updated')                    │
│    → loadPayouts() (reload)                             │
│    → finally: setProcessing(null)                       │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Exact Failure Mode Table

| Scenario | Update | Audit RPC | Notification | API Returns | Page Toast | Page Reload | Processing State |
|---|---|---|---|---|---|---|---|
| Full success | ✅ | ✅ | ✅ | `{ error: null }` | `toast.success` | ✅ Yes | Cleared |
| Update fails | ❌ | Not called | Not called | `{ error }` | `toast.error` | ❌ No | Cleared |
| Audit fails | ✅ | ❌ | ✅ Attempted | `{ error: null }` | `toast.success` | ✅ Yes | Cleared |
| Notification fails | ✅ | ✅ | ❌ | `{ error: null }` | `toast.success` | ✅ Yes | Cleared |
| Audit + Notification fail | ✅ | ❌ | ❌ | `{ error: null }` | `toast.success` | ✅ Yes | Cleared |
| No user_id (notification skipped) | ✅ | ✅ | Skipped | `{ error: null }` | `toast.success` | ✅ Yes | Cleared |

### Key Observations:

- **Update failure is the only case that returns an error** — the page shows `toast.error` and does not reload.
- **Audit RPC failure is silently swallowed** — the page shows `toast.success` and reloads as if everything succeeded.
- **Notification failure is silently swallowed** — same behavior as audit failure.
- **The admin has no visibility into partial failures** — no warning, no log in the UI.

---

## 6. Data Consistency Impact

| Question | Answer | Risk |
|---|---|---|
| Can payout status change without audit? | **Yes** — if `rpc('log_financial_audit')` fails | **High** — compliance gap |
| Can payout status change without notification? | **Yes** — if `notifications.insert` fails or `user_id` is null | **Medium** — vendor not informed |
| Can audit exist without notification? | **Yes** — if notification fails after audit succeeds | **Low** — audit trail intact |
| Can notification exist without audit? | **Yes** — if audit fails but notification succeeds | **Medium** — misleading notification |
| Is there any retry mechanism? | **No** | **High** — no recovery for transient failures |
| Is there any compensating log? | **No** | **High** — no record of partial failure |
| Is there any admin visibility for failed audit/notification? | **No** | **High** — admin cannot detect or repair |

### Critical Finding: Database Trigger

**Migration `021b-payouts-audit-trail.sql` defines a trigger `audit_payout_status_change`** that fires `AFTER UPDATE ON payouts` and automatically calls `log_financial_audit` with status-specific action names (`processing_started`, `completed`, `failed`).

**However, migration `030-unified-schema.sql` drops the `payouts` table** (`DROP TABLE IF EXISTS payouts CASCADE;`), which would also drop the trigger. The `payouts` table is not recreated in `030` or any later migration.

**Additionally, the `financial_audit_log` table in `030` has a different, simpler schema** (`user_id`, `action`, `amount`, `details`, `created_at`) compared to `021b` (`entity_type`, `entity_id`, `action`, `previous_status`, `new_status`, `amount`, `performed_by`, `performed_by_role`, `ip_address`, `user_agent`, `details`, `reason`, `created_at`).

**The application code uses `user_id` on the `payouts` table** (not `vendor_id` as in `021b`), suggesting schema evolution.

**Conclusion:** The trigger may or may not be active in production, depending on which migrations have been applied. The client-side `rpc('log_financial_audit')` call is the **verified, known** audit mechanism. If the trigger is active, it provides an additional safety net, but with different action names (`processing_started`/`completed`/`failed` vs `status_updated`), creating potential duplicate audit entries.

---

## 7. Supabase/RPC/Schema/RLS Analysis

### `log_financial_audit` RPC Function

**Defined in:** `database/migrations/021b-payouts-audit-trail.sql:139-181`

```sql
CREATE OR REPLACE FUNCTION log_financial_audit(
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT,
  p_previous_status TEXT,
  p_new_status TEXT,
  p_amount DECIMAL,
  p_details JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  v_user_id := auth.uid();
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  INSERT INTO financial_audit_log (...) VALUES (...);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Key properties:**
- `SECURITY DEFINER` — runs with elevated privileges, bypasses RLS
- Uses `auth.uid()` to get the current user
- Inserts into `financial_audit_log`
- Returns `VOID` (no result)

### Database Trigger: `audit_payout_status_change`

**Defined in:** `database/migrations/021b-payouts-audit-trail.sql:184-251`

- Fires `AFTER UPDATE ON payouts` for each row
- Calls `log_financial_audit` with status-specific action names
- **May not be active** if `030-unified-schema.sql` was applied (drops `payouts` table)

### `financial_audit_log` Table

**Two schemas exist across migrations:**

| Field | `021b` schema | `030` schema |
|---|---|---|
| `entity_type` | ✅ | ❌ |
| `entity_id` | ✅ | ❌ |
| `action` | ✅ | ✅ |
| `previous_status` | ✅ | ❌ |
| `new_status` | ✅ | ❌ |
| `amount` | ✅ | ✅ |
| `performed_by` | ✅ | ❌ |
| `performed_by_role` | ✅ | ❌ |
| `user_id` | ❌ | ✅ |
| `details` | ✅ | ✅ |
| `reason` | ✅ | ❌ |
| `ip_address` | ✅ | ❌ |
| `user_agent` | ✅ | ❌ |

**The `log_financial_audit` RPC expects the `021b` schema** (entity_type, entity_id, performed_by, etc.). If the `030` schema is active, the RPC would fail.

### `payouts` Table

**`021b` schema:** Uses `vendor_id` (UUID REFERENCES profiles(id))
**Application code:** Uses `user_id` (per `Payouts.jsx` and `adminPayouts.js`)

This suggests the `payouts` table was recreated with `user_id` instead of `vendor_id` at some point, or the application was updated to use a different column name.

### RLS Policies

**`029-admin-payouts-rls.sql`** (latest RLS for payouts):
- Admin SELECT: `public.is_current_user_admin()`
- Admin UPDATE: `public.is_current_user_admin()`

**`021b` RLS policies** (may be superseded by `029`):
- Vendors can view own payouts: `vendor_id = auth.uid()`
- Admins can view all: `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`
- Admins can create: same admin check
- Admins can update: same admin check
- System can insert audit log: `WITH CHECK (true)` — anyone can insert

### Edge Function: `process-vendor-payout`

**File:** `supabase/functions/process-vendor-payout/index.ts`

- Handles `approve`, `reject`, `process`, `complete` actions
- Uses server-side admin role enforcement
- Calls `log_financial_audit` via `db.rpc()` — **also non-transactional** (line 291: "Ignore audit failures — they must not roll back the main operation")
- Does NOT insert notifications (unlike the client-side flow)
- Uses different status transitions than the admin UI (`pending → approved → processing → completed` vs `pending → processing → completed/failed`)
- **Not currently used by `Payouts.jsx`**

### SQL Functions: `process_payout_bank_transfer` and `complete_payout`

**Defined in:** `021b-payouts-audit-trail.sql:264-358`

- `process_payout_bank_transfer`: Updates payout status AND inserts notification in one function
- `complete_payout`: Updates payout status AND inserts notification in one function
- Both are `SECURITY DEFINER`
- **Not called by the current admin UI** — the admin UI uses direct `payouts.update` + client-side notification insert

### Could `log_financial_audit` also update payout status transactionally?

**No** — the current RPC only inserts into `financial_audit_log`. A new RPC would be needed to combine the update + audit in one transaction.

### Would a new RPC be needed?

**Yes** — to achieve transactional behavior, a new RPC like `update_payout_status_with_audit` would need to:
1. `UPDATE payouts SET status = $1 WHERE id = $2`
2. Call `log_financial_audit(...)` inside the same transaction
3. Optionally insert notification
4. Return `{ success, error }`

### Would schema changes be required?

**Possibly** — the `financial_audit_log` table schema is ambiguous across migrations. A schema verification would be needed before implementing any server-side transaction.

### Would RLS allow the needed writes?

**Yes** — the `log_financial_audit` function is `SECURITY DEFINER`, so it bypasses RLS. The admin UPDATE policy on `payouts` allows admin updates. A new `SECURITY DEFINER` RPC would bypass RLS entirely.

---

## 8. Existing Test Coverage

### API Tests (`adminPayouts.test.js`)

| Test | What It Covers | Partial Failure? |
|---|---|---|
| calls supabase.from with payouts table for update | Update table name | No |
| update payload contains only { status: newStatus } | Update payload shape | No |
| update filters by .eq("id", payoutId) | Update filter | No |
| calls rpc("log_financial_audit") with complete payload | Audit RPC payload | No |
| inserts notification with correct payload | Notification payload | No |
| skips notification insert when payout has no user_id | user_id skip | No |
| returns { error: null } on full success | Success return | No |
| **returns { error } when update fails (short-circuit)** | **Update failure** | **Yes** |
| **audit RPC failure does NOT return error** | **Audit failure** | **Yes** |
| **notification insert failure does NOT return error** | **Notification failure** | **Yes** |
| uses "unknown" as previous status when payout is missing | Fallback | No |
| uses actual previous status from payout | Fallback | No |
| uses amount 0 when payout is missing | Fallback | No |
| write chain order: update → RPC → notification | Ordering | No |
| does not call Edge Functions | Edge Functions | No |

### Page Behavior Tests (`AdminPayouts.behavior.test.jsx`)

| Test | What It Covers | Partial Failure? |
|---|---|---|
| status update success: calls updateAdminPayoutStatus | Success path | No |
| status update calls updateAdminPayoutStatus with correct parameters | Parameters | No |
| **payout update failure: shows error toast** | **Update failure** | **Yes** |
| **audit RPC failure: success toast shown** | **Audit failure** | **Yes** |
| **notification insert failure: success toast shown** | **Notification failure** | **Yes** |
| processing state shows Processing text | Processing state | No |

### Page Write-Flow Tests (`AdminPayouts.write-flow.test.jsx`)

| Test | What It Covers | Partial Failure? |
|---|---|---|
| clicking Start Processing calls updateAdminPayoutStatus | Parameters | No |
| processing state cleared after success | Processing state | No |
| **processing state cleared after error** | **Update failure** | **Yes** |
| **processing state cleared when API returns no error** | **Non-transactional** | **Yes** |
| **updateAdminPayoutStatus error: toast.error shown** | **Update failure** | **Yes** |
| updateAdminPayoutStatus success: toast.success shown | Success | No |
| **non-transactional: API returns no error, page shows toast.success** | **Non-transactional** | **Yes** |
| successful write chain triggers reload | Reload | No |
| **update failure does not trigger reload** | **No reload on failure** | **Yes** |
| Mark Completed button calls updateAdminPayoutStatus with "completed" | Button mapping | No |
| Mark Failed button calls updateAdminPayoutStatus with "failed" | Button mapping | No |
| page does not call supabase directly for writes | No direct supabase | No |

### Coverage Summary

| Path | API Tests | Page Tests | Total |
|---|---|---|---|
| Full success | ✅ | ✅ | 2 |
| Update failure | ✅ | ✅ | 2 |
| Audit RPC failure | ✅ | ✅ | 2 |
| Notification failure | ✅ | ✅ | 2 |
| No user_id (notification skip) | ✅ | ❌ | 1 |
| Fallback: previous status | ✅ | ❌ | 1 |
| Fallback: amount | ✅ | ❌ | 1 |
| Write chain order | ✅ | ❌ | 1 |
| No Edge Functions | ✅ | ❌ | 1 |

---

## 9. Missing Test Coverage

| Gap | Risk | Notes |
|---|---|---|
| **Transactionality** | High | No test verifies that all operations succeed or fail together |
| **Rollback behavior** | High | No test verifies that a failed audit/notification rolls back the status change |
| **Admin audit integrity** | High | No test verifies that audit log entry matches the actual status change |
| **Notification reliability** | Medium | No test verifies that notification is actually delivered to the vendor |
| **Database trigger interaction** | Medium | No test verifies whether the `audit_payout_status_change` trigger is active and creates duplicate entries |
| **Edge Function integration** | Low | Edge Function exists but is not used; no test verifies it |
| **Concurrent status updates** | Medium | No test for race conditions if two admins update the same payout simultaneously |
| **Network timeout scenarios** | Medium | No test for what happens when RPC or insert times out (vs explicit error) |
| **CSV/PDF export depth** | Low | Export logic remains in page, not deeply tested |
| **Integration/E2E coverage** | Low | No E2E tests for the full payout status update flow |

---

## 10. Fix Option Comparison

### Option A — Keep Current Behavior (Do Nothing)

| Aspect | Assessment |
|---|---|
| Behavior impact | None — no changes |
| Schema/RLS impact | None |
| Test impact | None |
| UI impact | None |
| Financial correctness | **Risk remains** — audit gaps possible |
| Admin visibility | **None** — admin cannot detect partial failures |
| Implementation risk | None |
| **Recommendation** | **Not recommended** — financial audit integrity is important |

### Option B — Observability Only (Minimal Fix)

Add `logger.warn` for audit/notification failures. Return `side_effects_failed` metadata. Do not change success/failure behavior.

| Aspect | Assessment |
|---|---|
| Behavior impact | Minimal — `logger.warn` added, return shape gains optional field |
| Schema/RLS impact | None |
| Test impact | New tests for `logger.warn` calls and `side_effects_failed` field |
| UI impact | None (or optional: show warning toast) |
| Financial correctness | **Same risk** — audit gaps still possible, but now logged |
| Admin visibility | **Improved** — `logger.warn` creates a record; optional UI warning |
| Implementation risk | Low — additive only, no behavior change |
| **Recommendation** | **Recommended as interim measure** — similar to R-001 Option B |

### Option C — Fail on Audit/Notification Failure

Throw or return error if audit or notification fails.

| Aspect | Assessment |
|---|---|
| Behavior impact | **Major** — `toast.success` becomes `toast.error` for partial failures |
| Schema/RLS impact | None |
| Test impact | Many tests need updating — current tests assert `toast.success` for partial failures |
| UI impact | Admin sees error toast for partial failures — may be confusing since status already changed |
| Financial correctness | **Paradox** — status already changed, showing error doesn't undo it |
| Admin visibility | **Improved** — admin knows something went wrong |
| Implementation risk | **High** — changes established behavior, may confuse admins |
| **Recommendation** | **Not recommended** — showing error after successful update is misleading |

### Option D — Audit Required, Notification Best-Effort

If audit fails, return error. If notification fails, warn only.

| Aspect | Assessment |
|---|---|
| Behavior impact | **Moderate** — audit failure now returns error (but status already changed) |
| Schema/RLS impact | None |
| Test impact | Tests for audit failure need updating |
| UI impact | Admin sees error for audit failure, success for notification failure |
| Financial correctness | **Paradox** — same as Option C for audit failures |
| Admin visibility | **Improved for audit** — admin knows audit failed |
| Implementation risk | **Medium** — changes behavior for audit failure case |
| **Recommendation** | **Not recommended alone** — same paradox as Option C |

### Option E — Server-Side Transactional RPC

Create a new RPC that updates payout status and logs audit in one database transaction. Notification remains best-effort after transaction.

| Aspect | Assessment |
|---|---|
| Behavior impact | **Positive** — audit is guaranteed if status update succeeds |
| Schema/RLS impact | New RPC function needed (migration) |
| Test impact | API tests need updating to call new RPC; page tests may need mock updates |
| UI impact | None — same toast/reload behavior |
| Financial correctness | **Strong** — update + audit are atomic |
| Admin visibility | Same for notification; audit is now guaranteed |
| Implementation risk | **Medium** — requires migration, RPC testing, and careful rollout |
| **Recommendation** | **Recommended as long-term solution** — best financial correctness |

### Option F — Full Server-Side Workflow (Edge Function)

Edge Function handles status update, audit, and notification. Client only calls the Edge Function.

| Aspect | Assessment |
|---|---|
| Behavior impact | **Positive** — all operations server-side |
| Schema/RLS impact | May need migration for Edge Function support |
| Test impact | Major — API function changes to call Edge Function |
| UI impact | None — same toast/reload behavior |
| Financial correctness | **Strongest** — full server-side control |
| Admin visibility | Best — server can return detailed status |
| Implementation risk | **High** — complex, requires Edge Function deployment, testing, rollout |
| **Recommendation** | **Overkill for now** — Option E is simpler and sufficient |

### Option G — Use Existing `process_payout_bank_transfer` / `complete_payout` SQL Functions

The migration already defines SQL functions that update status AND insert notification in one call.

| Aspect | Assessment |
|---|---|
| Behavior impact | **Positive** — status + notification in one SQL function |
| Schema/RLS impact | Functions already exist (if migration is applied) |
| Test impact | Major — API function changes to call SQL functions |
| UI impact | None — same toast/reload behavior |
| Financial correctness | **Good** — but audit is still via trigger (may not be active) |
| Admin visibility | Same |
| Implementation risk | **Medium** — functions may not match current schema (`vendor_id` vs `user_id`) |
| **Recommendation** | **Not recommended** — schema mismatch risk, functions may not be compatible |

---

## 11. Recommended Option

### Short-term: Option B (Observability Only)

**Phase 7.48:** Add `logger.warn` for audit/notification failures in `updateAdminPayoutStatus`. Return optional `side_effects_failed` metadata. Do not change success/failure behavior. Add characterization tests for the new observability.

**Rationale:**
- Lowest risk — additive only, no behavior change
- Similar to R-001 Option B pattern
- Provides visibility into partial failures without changing UI behavior
- Can be safely rolled back

### Long-term: Option E (Server-Side Transactional RPC)

**Future phase (after schema verification):** Create a new RPC `update_payout_status_with_audit` that combines the status update and audit log in one transaction. Notification remains best-effort.

**Rationale:**
- Best financial correctness
- Requires schema verification first (due to migration conflicts)
- Should be designed carefully with proper testing

---

## 12. Recommended Phase 7.48

**Phase 7.48: R-002 characterization + minimal observability fix (Option B)**

This phase should:
1. Add characterization tests for the desired observability behavior (before implementation)
2. Add `logger.warn` for audit RPC failures in `updateAdminPayoutStatus`
3. Add `logger.warn` for notification insert failures in `updateAdminPayoutStatus`
4. Return optional `side_effects_failed` array in the return shape (e.g., `{ error: null, side_effects_failed: ['audit'] }`)
5. Do NOT change `toast.success`/`toast.error` behavior
6. Do NOT change reload behavior
7. Do NOT change processing state behavior
8. Update API tests to verify `logger.warn` calls and `side_effects_failed` field
9. Update page tests to verify behavior is unchanged (toast, reload, processing state)
10. Run all tests and final checks

### Suggested Phase 7.48 Prompt Outline

```
Phase 7.48 — R-002 Minimal Observability Fix (Option B)

This is a minimal additive fix. No behavior changes.

Goals:
1. Add logger.warn for audit RPC failures in updateAdminPayoutStatus.
2. Add logger.warn for notification insert failures in updateAdminPayoutStatus.
3. Return optional side_effects_failed array in the return shape.
4. Do NOT change toast.success/toast.error behavior.
5. Do NOT change reload behavior.
6. Do NOT change processing state behavior.
7. Add characterization tests for the new observability.
8. Verify all existing tests still pass.

Files to modify:
- src/modules/commissions/api/adminPayouts.js
- src/__tests__/modules/commissions/adminPayouts.test.js
- src/__tests__/pages/AdminPayouts.behavior.test.jsx (verify no behavior change)
- src/__tests__/pages/AdminPayouts.write-flow.test.jsx (verify no behavior change)

Forbidden:
- No toast behavior changes
- No reload behavior changes
- No processing state changes
- No UI changes
- No schema/RLS changes
- No Edge Function changes
- No transaction wrapping
- No rollback mechanism
```

---

## 13. Verification Results

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
| Payouts tests (4 suites) | ✅ 71/71 passed |
| Full test suite (150 suites) | ✅ 1618/1618 passed (2 todo, 0 failures) |

---

## 14. Safety Confirmations

- ✅ No production code changed
- ✅ No tests changed
- ✅ No behavior changes
- ✅ No schema/RLS changes
- ✅ No Edge Function changes
- ✅ No file movement
- ✅ No import rewriting
- ✅ No direct R-002 fix implemented
- ✅ R-002 is analyzed, not fixed
- ✅ No circular dependencies introduced
- ✅ No `any`, `@ts-ignore`, or `@ts-expect-error` introduced

---

## 15. Key Findings Summary

1. **Database trigger `audit_payout_status_change` exists in migration `021b`** but may not be active due to `030-unified-schema.sql` dropping the `payouts` table. Schema verification is needed.

2. **The `log_financial_audit` RPC is `SECURITY DEFINER`** and bypasses RLS, making it reliable for audit logging if the function and table schema are compatible with the current database.

3. **An Edge Function `process-vendor-payout` exists** but is not used by the admin UI. It also has non-transactional audit logging.

4. **SQL functions `process_payout_bank_transfer` and `complete_payout`** combine status update + notification in one function, but they use `vendor_id` (not `user_id`) and may not be compatible with the current schema.

5. **The `financial_audit_log` table has conflicting schemas** across migrations (`021b` vs `030`), which must be resolved before any server-side transaction implementation.

6. **R-002 risk is real but mitigated** if the database trigger is active. However, the trigger uses different action names, creating potential duplicate audit entries.

7. **The safest next step is Option B (observability only)** — add `logger.warn` and `side_effects_failed` metadata without changing behavior. This provides visibility into partial failures with minimal risk.

8. **The long-term solution is Option E (server-side transactional RPC)** — but this requires schema verification and migration first.
