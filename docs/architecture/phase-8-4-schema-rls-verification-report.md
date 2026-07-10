# Phase 8.4 — Schema/RLS Verification & Production Confidence Audit

**Date:** 2026-06-27  
**Phase:** 8.4  
**Type:** Schema/RLS Verification (audit + minimal fix)  
**Status:** ✅ Complete  

---

## 1. `.windsurfrules` Compliance

✅ `.windsurfrules` was read in full (614 lines) and strictly followed throughout this phase. Key rules adhered to:
- **Rule 2 (Analysis before execution):** All migrations, code, and types were read before any conclusions.
- **Rule 5 (Supabase):** No migrations were run. No secrets accessed.
- **Rule 6 (RLS):** RLS policies were analyzed but not modified (except the 034 audit trigger fix which is a Phase 8.3 compatibility bug).
- **Rule 21 (Build/Lint):** Lint and build were run only in the verification phase, not during analysis.
- **Rule 24 (Documentation):** This report was explicitly requested by the user.
- **Rule 36 (Database Schema Safety):** All schema claims verified against `database/migrations/` and `src/types/database.ts`.
- **Rule 37 (Protected Zone):** The 034 audit trigger fix is within the Supabase migrations protected zone, but it is a clear syntax/compatibility bug fix explicitly allowed by the user's prompt: "Minimal migration fix only if Phase 8.3 migration has a clear syntax/compatibility bug."

---

## 2. Production Code Changes

**Yes — one minimal migration fix applied.**

| File | Change | Justification |
|------|--------|---------------|
| `database/migrations/034-restore-missing-tables.sql` | Replaced broken `audit_payout_status_change()` trigger function with correct 021b logic using `log_financial_audit()` RPC | Phase 8.3 trigger used `'status_updated'` action value not in `financial_audit_log.action` CHECK constraint → would fail at runtime. Also used fallback UUID violating FK to `profiles`. |

**No other production code was changed.**

---

## 3. Test Changes

**No tests were changed.** All existing tests pass as-is.

---

## 4. Migration Ordering Analysis

### Migration Sequence (relevant)

| Order | File | Action |
|-------|------|--------|
| 1 | `021b-payouts-audit-trail.sql` | Creates `payouts`, `financial_audit_log`, `log_financial_audit()` RPC, `audit_payout_status_change()` trigger |
| 2 | `029-admin-payouts-rls.sql` | Adds admin RLS policies to `payouts` |
| 3 | `030-unified-schema.sql` | Defines canonical schema. `DROP TABLE IF EXISTS payouts` was **removed** in Phase 8.3. `financial_audit_log` defined with simpler schema (but `CREATE TABLE IF NOT EXISTS` → no-op if 021b already ran) |
| 4 | `034-restore-missing-tables.sql` | Ensures `payouts` exists, creates `fraud_reports` and `refunds`, restores audit trigger |

### Findings

1. ✅ **034 runs after 030** — filename ordering ensures correct sequence.
2. ✅ **Removing `DROP TABLE IF EXISTS payouts CASCADE` from 030 does not create duplicate-table risk** — 034 uses `CREATE TABLE IF NOT EXISTS`.
3. ✅ **034 uses `CREATE TABLE IF NOT EXISTS`** for all three tables — safe for fresh and existing installs.
4. ✅ **034 does not conflict with earlier migrations** — all `DROP POLICY IF EXISTS` before `CREATE POLICY` ensures idempotency.
5. ✅ **Indexes use `IF NOT EXISTS`** — no duplicate index names.
6. ✅ **Foreign keys target existing tables/columns** — `profiles(id)`, `orders(id)`, `deliveries(id)`, `payments(id)`, `bank_accounts(id)` all defined in 030 or earlier.
7. ⚠️ **`financial_audit_log` dual schema risk** — 030 defines a simpler schema (`user_id`, `action`, `amount`, `details`, `created_at`) while 021b defines the full schema (`entity_type`, `entity_id`, `performed_by`, etc.). Both use `CREATE TABLE IF NOT EXISTS`. If 021b runs first (expected), 030 is a no-op. **Risk:** If a fresh install skips 021b, the 034 trigger will fail because columns like `entity_type` don't exist in 030's schema. **Mitigation:** Ensure 021b is always in the migration sequence.

---

## 5. `payouts` Schema/RLS Verification

### Column Coverage

**034 schema vs. `database.ts` types:**

| Column | 034 Schema | database.ts | Match |
|--------|-----------|-------------|-------|
| `id` | UUID PK | string | ✅ |
| `vendor_id` | UUID NOT NULL FK→profiles | string | ✅ |
| `amount` | DECIMAL(10,2) NOT NULL | number | ✅ |
| `currency` | TEXT DEFAULT 'MAD' | string | ✅ |
| `status` | TEXT with CHECK | string | ✅ |
| `payout_method` | TEXT with CHECK | string | ✅ |
| `bank_account_id` | UUID FK→bank_accounts | string\|null | ✅ |
| `reference_number` | TEXT | string\|null | ✅ |
| `transaction_id` | TEXT | string\|null | ✅ |
| `gateway_response` | JSONB | Json\|null | ✅ |
| `requires_second_approval` | BOOLEAN DEFAULT false | boolean\|null | ✅ |
| `first_approved_by` | UUID FK→profiles | string\|null | ✅ |
| `first_approved_at` | TIMESTAMPTZ | string\|null | ✅ |
| `second_approved_by` | UUID FK→profiles | string\|null | ✅ |
| `second_approved_at` | TIMESTAMPTZ | string\|null | ✅ |
| `rejected_by` | UUID FK→profiles | string\|null | ✅ |
| `rejection_reason` | TEXT | string\|null | ✅ |
| `rejected_at` | TIMESTAMPTZ | string\|null | ✅ |
| `processed_by` | UUID FK→profiles | string\|null | ✅ |
| `processed_at` | TIMESTAMPTZ | string\|null | ✅ |
| `completed_at` | TIMESTAMPTZ | string\|null | ✅ |
| `failed_reason` | TEXT | string\|null | ✅ |
| `period_start` | DATE | string\|null | ✅ |
| `period_end` | DATE | string\|null | ✅ |
| `orders_count` | INTEGER DEFAULT 0 | number\|null | ✅ |
| `orders_ids` | UUID[] | string[]\|null | ✅ |
| `notes` | TEXT | string\|null | ✅ |
| `created_by` | UUID FK→profiles | string\|null | ✅ |
| `created_at` | TIMESTAMPTZ DEFAULT NOW() | string\|null | ✅ |
| `updated_at` | TIMESTAMPTZ DEFAULT NOW() | string\|null | ✅ |

**All 30 columns match.** ✅

### Code Coverage

**`adminPayouts.js` queries:**
- `getAdminPayouts()`: `SELECT *, user:profiles!payouts_user_id_fkey(...)` — ⚠️ Uses `payouts_user_id_fkey` FK name, but table has `vendor_id` (FK would be `payouts_vendor_id_fkey`). **Pre-existing issue, not introduced by Phase 8.3.**
- `updateAdminPayoutStatus()`: `UPDATE payouts SET status = ... WHERE id = ...` — ✅ Valid.
- `payout.user_id` reference in notification insert — ⚠️ Uses `user_id` but table has `vendor_id`. **Pre-existing issue.**

**`AdminPayouts.test.jsx`:** Mocks use `user_id` field. Tests pass because mocks don't validate against real schema. The `.windsurfrules` notes this test "depends on `user_id` schema (live DB confirmed)" — suggesting the production DB may have `user_id` instead of `vendor_id`. This needs live DB verification.

### RLS Policies

| Policy | Operation | Role | Condition | Status |
|--------|-----------|------|-----------|--------|
| "Vendors can view own payouts" | SELECT | authenticated | `vendor_id = auth.uid()` | ✅ |
| "Admins can view all payouts" | SELECT | authenticated | `is_current_user_admin()` | ✅ |
| "Admins can create payouts" | INSERT | authenticated | `is_current_user_admin()` | ✅ |
| "Admins can update payouts" | UPDATE | authenticated | `is_current_user_admin()` | ✅ |

**Missing:** No vendor INSERT policy. Payouts are created by admins (or system), not vendors directly. ✅ Acceptable.

### Audit Trigger

**Fixed in this phase.** The 034 trigger was replaced with the correct 021b logic:
- Uses `log_financial_audit()` RPC (SECURITY DEFINER) ✅
- Action values match `financial_audit_log.action` CHECK constraint ✅
- `performed_by` handled via `auth.uid()` inside the RPC ✅
- Status-specific actions: `approved`, `rejected`, `processing_started`, `completed`, `failed`, `created` ✅

### R-002 Observability

✅ Remains valid. `updateAdminPayoutStatus()` in `adminPayouts.js` still calls `log_financial_audit` RPC with `p_action: 'status_updated'`. **Note:** This RPC call uses `'status_updated'` which is not in the 021b CHECK constraint. This is a **pre-existing issue** — the RPC will fail with a CHECK violation. However, the R-002 observability (`logger.warn` + `side_effects_failed`) catches this error gracefully. The trigger (fixed in this phase) now uses correct action values.

---

## 6. `fraud_reports` Schema/RLS Verification

### Column Coverage

**034 schema vs. `database.ts` types:**

All 21 columns in `database.ts` match the 034 schema. ✅

**034 schema vs. `fraudReportService.js` code:**

| Code Reference | Column | Match |
|---------------|--------|-------|
| `createFraudReport()` INSERT | `order_id`, `delivery_id`, `reporter_id`, `reported_user_id`, `reporter_role`, `reported_user_role`, `report_type`, `description`, `priority`, `legal_recommendation`, `evidence_paths` | ✅ All exist |
| `FRAUD_SELECT` query | `*`, `order:orders(...)`, `reporter:profiles!fraud_reports_reporter_id_fkey(...)`, `reported_user:profiles!fraud_reports_reported_user_id_fkey(...)`, `reviewer:profiles!fraud_reports_reviewed_by_fkey(...)` | ✅ FK names match auto-generated names |
| `updateFraudReport()` UPDATE | `reviewed_by`, `reviewed_at`, `resolved_at`, `resolution`, `admin_notes`, `status`, `evidence_paths`, `awareness_notified_at` | ✅ All exist |

### RLS Policies

| Policy | Operation | Role | Condition | Status |
|--------|-----------|------|-----------|--------|
| `fraud_reports_reporter_select` | SELECT | authenticated | `reporter_id = auth.uid() OR reported_user_id = auth.uid() OR is_current_user_admin()` | ✅ |
| `fraud_reports_authenticated_insert` | INSERT | authenticated | `reporter_id = auth.uid()` | ✅ |
| `fraud_reports_admin_update` | UPDATE | authenticated | `is_current_user_admin()` | ✅ |

### Route Status

✅ Routes remain disabled in `AppRouter.jsx` (lines 172-174, 374-376). No route reactivation.

### Graceful Failure

The `fraudReportService.js` throws errors on Supabase failures (lines 123-126, 172-175, 187-190, 211-214). If called while the table doesn't exist, it would throw a PostgREST error. Since routes are disabled, this service should not be reachable from the UI. **Risk:** If imported by other code paths, it could throw. **Mitigation:** Routes disabled; service is not imported by any active component.

---

## 7. `refunds` Schema/RLS Verification

### Column Coverage

**034 schema vs. `paymentGateway.js` `recordRefund()` code:**

| Code Column | Schema Column | Match |
|-------------|--------------|-------|
| `payment_id` | `payment_id UUID NOT NULL REFERENCES payments(id)` | ✅ |
| `order_id` | `order_id UUID REFERENCES orders(id)` | ✅ |
| `amount` | `amount DECIMAL(10,2) NOT NULL CHECK (amount > 0)` | ✅ |
| `reason` | `reason TEXT` | ✅ |
| `status` | `status TEXT NOT NULL DEFAULT 'pending' CHECK (...)` | ✅ |
| `gateway_response` | `gateway_response JSONB` | ✅ |

### FK Validation

- `payment_id` → `payments(id)` ✅ (payments table defined in 030, line 511)
- `order_id` → `orders(id)` ✅ (orders table defined in 030, line 159)

### Amount CHECK

`CHECK (amount > 0)` — compatible with expected refund amounts (positive values only). ✅

### RLS Policies

| Policy | Operation | Role | Condition | Status |
|--------|-----------|------|-----------|--------|
| `refunds_admin_select` | SELECT | authenticated | `is_current_user_admin()` | ✅ |
| `refunds_admin_insert` | INSERT | authenticated | `is_current_user_admin()` | ✅ |
| `refunds_admin_update` | UPDATE | authenticated | `is_current_user_admin()` | ✅ |
| `refunds_buyer_vendor_select` | SELECT | authenticated | `EXISTS(SELECT 1 FROM orders WHERE id = refunds.order_id AND (buyer_id = auth.uid() OR vendor_id = auth.uid()))` | ✅ |

**Note:** No buyer/vendor INSERT or UPDATE policy. Refunds are created by admin/system only. ✅ Acceptable.

### Silent Failure Resolution

The `paymentGateway.js` PayPal refund flow (line 518-531) calls `recordRefund()` with a try/catch that warns if the table is unavailable. With migration 034 creating the `refunds` table, this warning should no longer trigger. ✅

---

## 8. `financial_audit_log` / Audit Trigger Compatibility

### Schema Conflict Analysis

| Source | Schema |
|--------|--------|
| **021b** (line 53-80) | Full schema: `entity_type` (CHECK), `entity_id`, `action` (CHECK), `previous_status`, `new_status`, `amount`, `performed_by` (NOT NULL FK→profiles), `performed_by_role`, `ip_address`, `user_agent`, `details`, `reason`, `created_at` |
| **030** (line 763-770) | Simple schema: `user_id`, `action` (no CHECK), `amount`, `details`, `created_at` |

**Both use `CREATE TABLE IF NOT EXISTS`.** In normal migration order (021b → 030), 021b's full schema prevails. 030 is a no-op.

### `log_financial_audit()` RPC

Defined in 021b (line 139-181) as `SECURITY DEFINER`. Inserts into `financial_audit_log` with `auth.uid()` as `performed_by`. ✅

### 034 Trigger Fix (Applied in This Phase)

**Before fix (broken):**
- Direct `INSERT INTO financial_audit_log` with `action = 'status_updated'` → ❌ Not in CHECK constraint
- `performed_by = COALESCE(NEW.processed_by, NEW.created_by, '00000000-...')` → ❌ Fallback UUID violates FK to profiles

**After fix (correct):**
- Uses `log_financial_audit()` RPC → ✅ CHECK constraint compliant
- `performed_by` handled by RPC via `auth.uid()` → ✅ FK compliant
- Status-specific actions: `approved`, `rejected`, `processing_started`, `completed`, `failed`, `created` → ✅ All in CHECK constraint

### `adminPayouts.js` RPC Call

`updateAdminPayoutStatus()` calls `supabase.rpc('log_financial_audit', { p_action: 'status_updated', ... })`. The action `'status_updated'` is **not** in the 021b CHECK constraint. This is a **pre-existing issue** (not introduced by Phase 8.3 or 8.4). The R-002 observability catches the error via `logger.warn` and `side_effects_failed`. **Recommendation for future phase:** Either add `'status_updated'` to the CHECK constraint or change the RPC call to use a valid action value.

---

## 9. `profiles.is_active` Removal Verification

### No Remaining References

✅ Verified: `commissionService.js` has zero references to `profiles.is_active`. The only `is_active` references are on `vendor_contracts` table (lines 155, 157), which is a legitimate column on a different table.

### `account_active` Logic Consistency

The `getCurrentMonthSummary()` function derives `account_active` from `monthly.status !== 'overdue'`:
- `vendor_monthly_sales.status` is `VARCHAR DEFAULT 'active'` (030, line 1205) ✅
- `checkOverdueCommissions()` sets `status = 'overdue'` ✅
- `confirmCommissionPayment()` sets `status = 'paid'` ✅
- `manuallyUnfreezeVendor()` sets `status = 'pending'` ✅
- All tests verify this logic correctly ✅

### PostgREST 400 Avoidance

✅ Confirmed: No query in `commissionService.js` selects or updates `is_active` on `profiles`. PostgREST 400 errors from this ghost column are eliminated.

### No Unexpected Behavior Change

The freeze/unfreeze mechanism via `vendor_monthly_sales.status` was already in place before Phase 8.3. The `profiles.is_active` update was a secondary, redundant mechanism that failed silently (PostgREST 400). Removing it does not change business logic — it removes a broken code path. ✅

---

## 10. Database Type/Schema Confidence

### `database.ts` Type Coverage

| Table | Types in `database.ts` | Matches 034 Schema | Status |
|-------|----------------------|-------------------|--------|
| `payouts` | ✅ Full (30 columns) | ✅ All match | ✅ Confident |
| `fraud_reports` | ✅ Full (21 columns) | ✅ All match | ✅ Confident |
| `refunds` | ❌ **Not defined** | N/A | ⚠️ **Gap** |

### `refunds` Type Gap

`database.ts` does not contain a `refunds` type definition. This means:
- TypeScript won't provide type safety for refund queries
- No compile-time validation of column names

**Recommendation:** Add `refunds` type definition to `database.ts` in a future phase, or generate types via `supabase gen types` after running migration 034 on a live DB.

### Type Generation

`database.ts` appears to be **manually maintained** (not auto-generated). It contains hand-written `TableDef<T>` interfaces. Adding `refunds` types should follow the existing pattern. **Do not auto-generate** unless project convention changes.

---

## 11. Test and Check Results

| Check | Command | Result |
|-------|---------|--------|
| Type-check | `npm run type-check` | ✅ Pass (0 errors) |
| Lint | `npm run lint` | ✅ Pass (0 errors, within --max-warnings 1500) |
| Build | `npm run build` | ✅ Pass (built in 2m 48s) |
| Circular deps | `npm run check:circular` | ✅ Pass (0 circular dependencies) |
| Full test suite | `npx jest --no-coverage` | ✅ 150 suites, 1622 passed, 2 todo, 0 failed |

### Targeted Test Results

| Test File | Tests | Result |
|-----------|-------|--------|
| `commissionService.test.js` | 71 | ✅ All pass |
| `AdminPayouts.test.jsx` | 4 | ✅ All pass |
| `AdminCommissionManagement.columns.test.jsx` | 6 | ✅ All pass |
| `reportService.columns.test.js` | (in full suite) | ✅ Pass |

### Migration/Schema Test Tooling

**No SQL/migration test tooling exists in the project.** There is no `pgTAP`, `supabase test`, or similar tooling. Schema verification is done manually by reading migration files and comparing with code/types. **This is a production gap** — recommended for future phase.

---

## 12. Remaining Risks

| # | Risk | Severity | Likelihood | Introduced By | Mitigation |
|---|------|----------|-----------|---------------|------------|
| R-011 | `adminPayouts.js` uses `payouts_user_id_fkey` FK name but table has `vendor_id` → FK name is `payouts_vendor_id_fkey` | High | Medium | Pre-existing | Live DB may have `user_id` column (per `.windsurfrules` note). Needs live DB verification. |
| R-012 | `adminPayouts.js` uses `payout.user_id` for notifications but table has `vendor_id` | High | Medium | Pre-existing | Same as R-011. If live DB has `user_id`, code is correct. If not, notifications fail silently. |
| R-013 | `adminPayouts.js` RPC `log_financial_audit` uses `p_action: 'status_updated'` not in CHECK constraint | Medium | High | Pre-existing | R-002 observability catches the error. Fix: add `'status_updated'` to CHECK or use valid action. |
| R-014 | `financial_audit_log` dual schema (030 vs 021b) | Medium | Low | Pre-existing | 021b runs before 030 in normal sequence. Risk only if 021b is skipped. |
| R-015 | `refunds` table has no TypeScript type definition in `database.ts` | Low | N/A | Phase 8.3 | Add type definition in future phase or generate via `supabase gen types`. |
| R-016 | No SQL/migration test tooling | Medium | N/A | Pre-existing | Add `pgTAP` or `supabase test` in future phase. |
| R-017 | `fraud_reports` routes still disabled | Expected | N/A | By design | Re-enable in future phase after live DB migration. |
| R-002 | Payout write chain non-transactional | High | Medium | Pre-existing | Observability (Option B) in place. Transactional RPC (Option E) deferred. |

---

## 13. Updated Production Readiness Score

**Phase 8.2 score:** 42/100  
**Phase 8.3 fixes:** PB-001 to PB-004 resolved  
**Phase 8.4 verification:** Confirmed fixes correct, found and fixed 1 critical bug (audit trigger), verified all schemas/RLS  

**Estimated score after Phase 8.4: 52/100**

| Area | Before (8.2) | After (8.4) | Notes |
|------|-------------|-------------|-------|
| Schema integrity | 5/20 | 14/20 | PB-001 to PB-004 fixed. Audit trigger fixed. `refunds` type gap remains. |
| RLS/Auth | 8/15 | 12/15 | RLS policies verified for all 3 tables. `is_current_user_admin()` confirmed. |
| Payment safety | 5/15 | 7/15 | R-002 observability in place. Transactional fix still needed. `adminPayouts.js` FK mismatch (R-011/R-012). |
| Code quality | 10/15 | 12/15 | Ghost column removed. Tests pass. Type-check passes. |
| Test coverage | 8/15 | 8/15 | No new tests (verification phase). Migration test tooling gap. |
| Feature completeness | 4/10 | 5/10 | `fraud_reports` and `refunds` tables created. Routes still disabled. |
| Deploy readiness | 2/10 | 4/10 | Migrations ready but not run on production. No migration test tooling. |

---

## 14. Recommended Phase 8.5

Based on the findings, the most critical remaining risks are:

1. **R-011/R-012:** `adminPayouts.js` uses `user_id` but schema has `vendor_id` — this could break admin payouts at runtime if the live DB matches the migration schema.
2. **R-013:** `log_financial_audit` RPC call uses invalid action value.
3. **R-002:** Payout write chain is non-transactional.

**Recommended Phase 8.5: Checkout/Payments Hardening**

This phase should:
1. Verify `adminPayouts.js` column names against live DB (R-011/R-012)
2. Fix `log_financial_audit` RPC action value (R-013)
3. Assess and design R-002 transactional fix (Option E)
4. Verify PayPal idempotency (PB-007 from Phase 8.2)
5. Verify `CheckoutSimplified.jsx` direct Supabase usage (PB-006)

This directly addresses the highest-severity remaining risks in the payment domain.

---

## 15. Files Changed in Phase 8.4

| File | Change Type | Description |
|------|------------|-------------|
| `database/migrations/034-restore-missing-tables.sql` | Edit | Fixed audit trigger function: replaced broken direct INSERT with correct `log_financial_audit()` RPC calls using valid action values |
| `docs/architecture/phase-8-4-schema-rls-verification-report.md` | New | This report |
| `MODULAR_DEVELOPMENT_PLAN.md` | Edit | Phase 8.4 status entry |
