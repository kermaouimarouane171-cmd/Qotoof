# Phase 8.3 — Critical Production Blockers Triage Report

**Date:** 2026-01-XX  
**Phase:** 8.3  
**Objective:** Triage and remediate PB-001 through PB-004 with minimal safe changes  
**Status:** ✅ Complete  

---

## Executive Summary

All four critical production blockers (PB-001 through PB-004) have been investigated, remediated, and verified. The fixes are minimal, targeted, and do not introduce broad refactoring or unrelated changes.

| Blocker | Title | Severity | Status | Fix Type |
|---------|-------|----------|--------|----------|
| PB-001 | payouts table dropped by migration 030 | Critical | ✅ Resolved | Migration fix + new migration 034 |
| PB-002 | fraud_reports table missing from schema | Critical | ✅ Resolved | New migration 034 |
| PB-003 | refunds table missing from schema | High | ✅ Resolved | New migration 034 |
| PB-004 | profiles.is_active ghost column | High | ✅ Resolved | Code fix (remove ghost column references) |

---

## PB-001: payouts table dropped by migration 030

### Evidence

- **Migration 030** (`030-unified-schema.sql`, line 1440) contained `DROP TABLE IF EXISTS payouts CASCADE;`
- **Migration 021b** (`021b-payouts-audit-trail.sql`) originally created the `payouts` table with full schema, RLS, indexes, and audit triggers
- **Migration 029** (`029-admin-payouts-rls.sql`) added admin RLS policies for `payouts`
- **No later migration** recreates the `payouts` table after 030 drops it
- **Active code references:**
  - `src/modules/commissions/api/adminPayouts.js` — `getAdminPayouts()` queries `payouts` table with `*, user:profiles!payouts_user_id_fkey(...)` join
  - `src/modules/commissions/api/adminPayouts.js` — `updateAdminPayoutStatus()` updates `payouts` table
  - `src/pages/admin/Payouts.jsx` — admin payouts management page

### Runtime Impact

**Critical — Runtime-breaking.** If migration 030 runs on a database where `payouts` exists, the table is dropped. All admin payout management queries return PostgREST 404/400 errors. The admin payouts page is completely non-functional.

### Remediation

1. **Removed** the `DROP TABLE IF EXISTS payouts CASCADE;` line from `030-unified-schema.sql` (replaced with explanatory comment)
2. **Created migration 034** (`034-restore-missing-tables.sql`) which includes `CREATE TABLE IF NOT EXISTS payouts (...)` with the full schema from 021b, plus:
   - All indexes (idempotent)
   - RLS enable + all policies (vendor SELECT, admin SELECT/INSERT/UPDATE)
   - Audit trigger restoration (`audit_payout_status_change`)
   - Table comment

### Files Changed

- `database/migrations/030-unified-schema.sql` — removed DROP line
- `database/migrations/034-restore-missing-tables.sql` — new migration (ensures payouts exists)

---

## PB-002: fraud_reports table missing from schema

### Evidence

- **No migration** in the entire `database/migrations/` directory creates a `fraud_reports` table
- **TypeScript types** (`src/types/database.ts`, line 1743) define `fraud_reports` with full column shape
- **Service code** (`src/services/fraudReportService.js`) actively queries `fraud_reports` table:
  - `createFraudReport()` — INSERT + SELECT
  - `listFraudReportsForAdmin()` — SELECT
  - `getFraudReportById()` — SELECT
  - `updateFraudReport()` — UPDATE
- **Router** (`src/router/AppRouter.jsx`, lines 172-174, 374-376) — routes are **commented out** with note: `TEMPORARILY DISABLED: payment_disputes and fraud_reports tables do not exist in DB schema`
- **ProtectedRoute** (`src/components/ProtectedRoute.jsx`) — references fraud reports in disabled pages check

### Runtime Impact

**Moderate — Not currently runtime-breaking** (routes are disabled). However, the `fraudReportService.js` is importable and could be called from other code paths. If called, it would produce PostgREST 400 errors.

### Remediation

1. **Created migration 034** which includes `CREATE TABLE IF NOT EXISTS fraud_reports (...)` with:
   - All columns matching `database.ts` type definitions and `fraudReportService.js` usage
   - FK references to `orders`, `deliveries`, `profiles`
   - CHECK constraints on `report_type`, `priority`, `status` enums
   - Indexes on reporter, reported_user, status, order, created_at
   - RLS policies: reporter/reported/admin SELECT, authenticated INSERT, admin UPDATE
   - Table comment

### Files Changed

- `database/migrations/034-restore-missing-tables.sql` — new table creation

### Post-Fix Note

The fraud reports routes in `AppRouter.jsx` remain disabled. Re-enabling them requires:
1. Running migration 034 on production DB
2. Uncommenting the lazy imports and routes in `AppRouter.jsx`
3. Verifying the admin `FraudReports.jsx` page works against the live table
4. This is deferred to a future phase to avoid route changes in this triage.

---

## PB-003: refunds table missing from schema

### Evidence

- **No migration** in `database/migrations/` creates a `refunds` table
- **Migration 021** (`021-admin-orders-refund-audit.sql`) adds refund-related columns to `payments` table (`refund_amount`, `refund_reason`, `refunded_at`) but does NOT create a separate `refunds` table
- **Code reference** (`src/modules/payments/api/paymentGateway.js`, line 194-205):
  - `recordRefund()` method inserts into `refunds` table: `payment_id`, `order_id`, `amount`, `reason`, `status`, `gateway_response`
- **PayPal refund flow** (line 518-531) calls `recordRefund()` with a try/catch that warns: `PayPal refund succeeded but recordRefund skipped (refunds table unavailable)`
- **TypeScript types** (`src/types/database.ts`) — no `refunds` table definition exists

### Runtime Impact

**High — Silent data loss.** The PayPal refund flow catches the error silently. The refund succeeds at the gateway level, but no record is persisted in the database. This means:
- Refund audit trail is incomplete
- Admin cannot see refund history
- Financial reconciliation is broken

### Remediation

1. **Created migration 034** which includes `CREATE TABLE IF NOT EXISTS refunds (...)` with:
   - Columns: `id`, `payment_id` (FK→payments), `order_id` (FK→orders), `amount`, `reason`, `status`, `gateway_response`, timestamps
   - CHECK constraints: `amount > 0`, `status` in pending/completed/failed
   - Indexes on payment_id, order_id, status, created_at
   - RLS policies: admin SELECT/INSERT/UPDATE, buyer/vendor SELECT via order join
   - Table comment

### Files Changed

- `database/migrations/034-restore-missing-tables.sql` — new table creation

---

## PB-004: profiles.is_active ghost column

### Evidence

- **No migration** adds `is_active` column to `profiles` table:
  - `030-unified-schema.sql` profiles table definition (lines 73-106) — no `is_active` column
  - `20260519_add_missing_profiles_columns.sql` — no `is_active` column added
  - Searched all `*.sql` files for `ALTER TABLE.*profiles.*ADD.*is_active` — no results
- **`is_active` exists on other tables** (stores, delivery_zones, tier_pricing, coupons, etc.) but NOT on `profiles`
- **commissionService.js** uses `profiles.is_active` in 6 locations:
  1. `getAdminUsers()` — `.eq('is_active', true)` filter (line 97)
  2. `confirmSaleAndCalculate()` — `.select('is_active')` + freeze check (lines 169-178)
  3. `checkOverdueCommissions()` — `.update({ is_active: false })` (lines 375-378)
  4. `confirmCommissionPayment()` — `.update({ is_active: true })` (lines 551-554)
  5. `getCurrentMonthSummary()` — `.select('is_active')` + `account_active` derivation (lines 579-615)
  6. `manuallyUnfreezeVendor()` — `.update({ is_active: true })` (lines 683-688)

### Runtime Impact

**High — PostgREST 400 errors.** Every query selecting or updating `is_active` on `profiles` returns a 400 Bad Request from Supabase/PostgREST because the column does not exist. This affects:
- Commission sale confirmation flow (fails at vendor profile check)
- Overdue commission freeze flow (fails at profile update)
- Commission payment confirmation (fails at profile unfreeze)
- Current month summary (fails at profile select)
- Manual unfreeze (fails at profile update)
- Admin user lookup (fails at is_active filter)

### Remediation

**Code fix (preferred over schema addition).** The `is_active` column on `profiles` was never part of the schema. The commission service's freeze/unfreeze concept is fully covered by the `vendor_monthly_sales.status` field ('overdue' = frozen, 'active'/'pending'/'paid' = active).

Changes to `src/modules/commissions/api/commissionService.js`:

1. **`getAdminUsers()`** — removed `.eq('is_active', true)` filter (admins are active by definition)
2. **`confirmSaleAndCalculate()`** — removed entire `profiles.is_active` query and freeze check block (vendor freeze is checked via `vendor_monthly_sales.status` elsewhere)
3. **`checkOverdueCommissions()`** — removed `profiles.update({ is_active: false })` call (the `vendor_monthly_sales.status = 'overdue'` update is the canonical freeze mechanism)
4. **`confirmCommissionPayment()`** — removed `profiles.update({ is_active: true })` call (the `vendor_monthly_sales.status = 'paid'` update is the canonical unfreeze)
5. **`getCurrentMonthSummary()`** — removed `profiles.select('is_active')` query; `account_active` now derived from `monthly.status !== 'overdue'`
6. **`manuallyUnfreezeVendor()`** — removed `profiles.update({ is_active: true })` call (the `vendor_monthly_sales.status = 'pending'` update is the canonical unfreeze)

### Files Changed

- `src/modules/commissions/api/commissionService.js` — removed all 6 `profiles.is_active` references
- `src/__tests__/services/commissionService.test.js` — updated all affected tests

### Test Updates

- Removed `profiles` mock from tests where it was only used for `is_active`
- Changed "returns error when vendor account is frozen" test → "succeeds when vendor contract is active" (since the profiles.is_active check is removed)
- Changed "returns error when profile query fails" → "returns error when monthly sale query fails"
- Changed "returns account_active false when vendor is frozen" → "returns account_active false when vendor monthly sale is overdue" (uses `status: 'overdue'` instead of `is_active: false`)
- Changed "freezes account when dueDate is past" → "freezes account when dueDate is past (no profiles.is_active update)"
- Added PB-004 regression test: "confirmSaleAndCalculate does NOT query profiles table for is_active"
- Updated R-001 regression tests to remove `profiles: tableMock(OK)` first response (was for is_active update), keeping only the `getAdminUsers` response

---

## Verification Results

| Check | Result |
|-------|--------|
| `npm run lint` | ✅ Pass (0 errors) |
| `npm run build` | ✅ Pass (built in 2m 47s) |
| `npm run check:circular` | ✅ Pass (no circular dependencies) |
| `commissionService.test.js` | ✅ 71/71 tests pass |
| `AdminPayouts.test.jsx` | ✅ All tests pass |
| `AdminCommissionManagement.columns.test.jsx` | ✅ All tests pass |

---

## Migration 034 Summary

**File:** `database/migrations/034-restore-missing-tables.sql`

**Tables created (all `IF NOT EXISTS`):**
1. `payouts` — full schema from 021b, with RLS, indexes, audit trigger
2. `fraud_reports` — schema matching database.ts types and fraudReportService.js usage
3. `refunds` — schema matching paymentGateway.js recordRefund() usage

**RLS policies applied:**
- `payouts`: vendor SELECT (own), admin SELECT/INSERT/UPDATE
- `fraud_reports`: reporter/reported/admin SELECT, authenticated INSERT, admin UPDATE
- `refunds`: admin SELECT/INSERT/UPDATE, buyer/vendor SELECT (via order join)

**All operations are idempotent** — safe for fresh installs and existing databases.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Migration 034 run on DB where payouts was already dropped | Low | Medium | `CREATE TABLE IF NOT EXISTS` restores full schema |
| commissionService behavior change (no is_active check) | Low | Low | Freeze/unfreeze fully covered by `vendor_monthly_sales.status` |
| fraud_reports routes still disabled | Expected | Low | Service works once migration runs; routes can be re-enabled in future phase |
| refunds table RLS too restrictive | Low | Low | Admin has full access; buyer/vendor can view their own refunds |

---

## Files Changed Summary

| File | Change Type | Description |
|------|------------|-------------|
| `database/migrations/030-unified-schema.sql` | Edit | Removed `DROP TABLE IF EXISTS payouts CASCADE;` |
| `database/migrations/034-restore-missing-tables.sql` | New | Creates payouts, fraud_reports, refunds tables with RLS |
| `src/modules/commissions/api/commissionService.js` | Edit | Removed all `profiles.is_active` ghost column references |
| `src/__tests__/services/commissionService.test.js` | Edit | Updated tests to match PB-004 code changes |
