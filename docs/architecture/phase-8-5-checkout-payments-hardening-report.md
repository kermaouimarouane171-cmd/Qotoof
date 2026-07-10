# Phase 8.5 — Checkout/Payments Hardening Report

**Date:** 2026-06-27  
**Phase Type:** Checkout/Payments Hardening (Schema-Code Consistency + Financial Flow Reliability)  
**Auditor:** Cascade (Senior Supabase/PostgreSQL/RLS/Payments/Production Readiness Engineer)  
**Previous Phase:** 8.4 (Schema/RLS Verification) — Score 52/100  

---

## 1. Confirmation: `.windsurfrules` Read and Followed

`.windsurfrules` was read in full before any work began. All rules respected:
- Minimal changes only — no broad refactor, no UI redesign, no checkout rewrite.
- No RLS policy changes without analysis.
- No payment provider behavior changes.
- No R-002 transactional implementation.
- No `any`, no `@ts-ignore`, no `@ts-expect-error`.
- All Supabase access via `src/services/supabase.ts`.
- No git commit or push performed.

---

## 2. Files Inspected

### Source Code
| File | Purpose |
|------|---------|
| `src/modules/commissions/api/adminPayouts.js` | Admin payout read/write API |
| `src/modules/commissions/api/payoutService.js` | Edge Function payout sender |
| `src/modules/commissions/api/commissionService.js` | Commission service (verified no `is_active`) |
| `src/pages/admin/Payouts.jsx` | Admin payouts UI page |
| `src/modules/payments/api/paymentGateway.js` | Payment gateway (PayPal, bank, refund) |
| `src/modules/payments/api/paymentService.js` | Payment service facade |
| `src/modules/checkout/api/checkoutService.js` | Checkout order creation service |
| `src/pages/CheckoutSimplified.jsx` | Checkout page (Edge Function calls) |
| `src/pages/OrderConfirmation.jsx` | Order confirmation page |
| `src/types/database.ts` | TypeScript database types |

### Migrations
| File | Purpose |
|------|---------|
| `database/migrations/021b-payouts-audit-trail.sql` | Original payouts + audit log + RPC + trigger |
| `database/migrations/029-admin-payouts-rls.sql` | Admin RLS for payouts |
| `database/migrations/030-unified-schema.sql` | Canonical schema |
| `database/migrations/034-restore-missing-tables.sql` | Restored payouts/fraud_reports/refunds |

### Edge Functions
| Function | Status |
|----------|--------|
| `create-checkout-order/` | Exists, uses auth, inventory reservation, rollback |
| `create-paypal-order/` | Exists, PayPal API integration, MAD→EUR conversion |
| `capture-paypal-order/` | Exists, captures PayPal order, persists state |
| `process-manual-refund/` | Exists, admin-only, COD/bank refund |
| `refund-paypal-payment/` | Exists |
| `refund-cmi-payment/` | Exists |
| `refund-payment/` | Exists |
| `send-payout/` | Exists |
| `verify-cmi-callback/` | Exists, signature verification |
| `get-bank-details/` | Exists |
| `confirm-bank-transfer/` | Exists |
| `payment-status-write/` | Exists |

### Tests
| File | Purpose |
|------|---------|
| `src/__tests__/modules/commissions/adminPayouts.test.js` | API unit tests (40 tests) |
| `src/__tests__/pages/AdminPayouts.test.jsx` | Page schema compatibility tests |
| `src/__tests__/pages/AdminPayouts.write-flow.test.jsx` | Write flow page tests |
| `src/__tests__/pages/AdminPayouts.behavior.test.jsx` | Behavior tests (audit modal, etc.) |
| `src/__tests__/services/payoutService.test.js` | Payout service tests |
| `src/__tests__/services/paymentGateway.test.js` | Payment gateway tests |
| `src/__tests__/integration/checkoutFlow.test.js` | Checkout integration test |

---

## 3. Files Changed

### Code Fixes (3 files)

| File | Change | Risk Fixed |
|------|--------|------------|
| `src/modules/commissions/api/adminPayouts.js` | `user:profiles!payouts_user_id_fkey` → `vendor:profiles!payouts_vendor_id_fkey`; `payout.user_id` → `payout.vendor_id` (notification + logger); `p_action: 'status_updated'` → `p_action: 'manual_adjustment'` | R-011/R-012, R-013 |
| `src/pages/admin/Payouts.jsx` | All `payout.user?.` → `payout.vendor?.` (CSV export, PDF export, card display, audit modal) | R-011/R-012 |
| `src/types/database.ts` | Added `refunds` TableDef matching migration 034 schema | R-015 |

### Test Updates (4 files)

| File | Change |
|------|--------|
| `src/__tests__/modules/commissions/adminPayouts.test.js` | `user_id` → `vendor_id` in mockPayout; `p_action: 'status_updated'` → `'manual_adjustment'`; test descriptions updated; audit log mock action updated |
| `src/__tests__/pages/AdminPayouts.test.jsx` | Mock data `user_id` → `vendor_id`, `user` → `vendor` join; source assertion `p_action` and `payout.vendor_id` updated |
| `src/__tests__/pages/AdminPayouts.write-flow.test.jsx` | `createMockPayout`: `user_id` → `vendor_id`, `user` → `vendor` |
| `src/__tests__/pages/AdminPayouts.behavior.test.jsx` | `createMockPayout`: `user_id` → `vendor_id`, `user` → `vendor`; audit log action `'status_updated'` → `'manual_adjustment'`; audit modal text `'status updated'` → `'manual adjustment'` |

---

## 4. R-011/R-012 Analysis and Action

### Problem
`adminPayouts.js` used `user_id` and `user:profiles!payouts_user_id_fkey` to query and join payouts, but the canonical schema (migration 021b + 034) defines the column as `vendor_id` with FK `payouts_vendor_id_fkey`.

### Evidence
- **Migration 021b (line 9):** `vendor_id UUID NOT NULL REFERENCES profiles(id)`
- **Migration 034 (line 10):** `vendor_id UUID NOT NULL REFERENCES profiles(id)`
- **RLS policy (021b line 102):** `vendor_id = auth.uid()`
- **Index (021b line 83):** `idx_payouts_vendor ON payouts(vendor_id)`
- **database.ts (line 3018):** `vendor_id: string` (Row type)
- **No `user_id` column exists in any payouts migration.**

### Root Cause
The code was written with a `user_id` assumption that never matched the actual schema. This would cause:
1. **Read failure:** The FK join `payouts_user_id_fkey` doesn't exist → Supabase returns error or empty data.
2. **Notification failure:** `payout.user_id` would be `undefined` → notification skipped silently.
3. **Logger context:** `userId` in warning would be `undefined`.

### Fix Applied
- **`adminPayouts.js` `getAdminPayouts()`:** Changed join to `vendor:profiles!payouts_vendor_id_fkey(...)`.
- **`adminPayouts.js` `updateAdminPayoutStatus()`:** Changed `payout?.user_id` → `payout?.vendor_id` for notification recipient and logger context.
- **`Payouts.jsx`:** Changed all `payout.user?.` references to `payout.vendor?.` (CSV export, PDF export, card display, audit modal vendor name).

### Residual Risk
- **`payoutService.js`** still sends `user_id` to the `send-payout` Edge Function. This is an Edge Function API parameter, not a direct table column reference. The Edge Function may map `user_id` → `vendor_id` internally. **Not changed** — requires Edge Function source verification. Risk: R-017 (low, separate flow).

---

## 5. R-013 Analysis and Action

### Problem
`adminPayouts.js` called `log_financial_audit` RPC with `p_action: 'status_updated'`, but the `financial_audit_log.action` CHECK constraint (migration 021b, lines 57-69) only allows:

```
'created', 'first_approved', 'second_approved', 'approved', 'rejected',
'processing_started', 'completed', 'failed', 'gateway_error',
'manual_adjustment', 'cancelled'
```

`'status_updated'` is **not** in this list → the RPC would throw a CHECK constraint violation in production.

### Evidence
- **021b line 57-69:** CHECK constraint explicitly lists allowed values.
- **021b line 139-181:** `log_financial_audit()` RPC inserts `p_action` directly into `action` column.
- **034 trigger (fixed in Phase 8.4):** Uses valid actions (`'approved'`, `'rejected'`, `'processing_started'`, `'completed'`, `'failed'`, `'created'`).
- **adminPayouts.js (before fix):** Used `'status_updated'` — invalid.

### Fix Applied
- Changed `p_action: 'status_updated'` → `p_action: 'manual_adjustment'` in `adminPayouts.js`.
- `'manual_adjustment'` is in the CHECK constraint allowed list and semantically correct for an admin manually updating payout status.

### Verification
- All tests updated to assert `p_action: 'manual_adjustment'`.
- Audit log mock data updated from `action: 'status_updated'` to `action: 'manual_adjustment'`.
- Audit modal display test updated from `'status updated'` to `'manual adjustment'`.

### Residual Risk
- **None for this specific issue.** The RPC call now uses a valid action value.
- **Note:** The 034 trigger (fixed in Phase 8.4) already uses valid action values. Both code path and trigger path are now CHECK-constraint-compliant.

---

## 6. R-015 Analysis and Action

### Problem
The `refunds` table was created in migration 034 but had no type definition in `database.ts`, creating type drift and unsafe TypeScript assumptions.

### Evidence
- **Migration 034 (lines 221-231):** `refunds` table with 9 columns.
- **`database.ts`:** No `refunds` entry existed between `payouts` and `phone_otp`.
- **`paymentGateway.js` (line 194-205):** `recordRefund()` inserts into `refunds` with `payment_id`, `order_id`, `amount`, `reason`, `status`, `gateway_response`.

### Fix Applied
- Added `refunds: TableDef<{...}, {...}, {...}>` to `database.ts` matching migration 034 schema exactly:
  - **Row:** `amount: number`, `created_at: string`, `gateway_response: Json | null`, `id: string`, `order_id: string | null`, `payment_id: string`, `reason: string | null`, `status: string`, `updated_at: string`
  - **Insert:** Required fields: `amount`, `payment_id`. Optional fields with defaults: `created_at`, `gateway_response`, `id`, `order_id`, `reason`, `status`, `updated_at`.
  - **Update:** All fields optional.

### Verification
- `npm run type-check` passed.
- No fields invented beyond migration 034.

### Residual Risk
- **None.** Type definition matches schema exactly.
- **R-016 (no SQL test tooling):** Still open — future migration bugs won't be caught automatically.

---

## 7. Checkout/Payment Edge Function Readiness

### Architecture Overview
Checkout uses a **hybrid flow**:
1. `checkoutService.js` → `supabase.functions.invoke('create-checkout-order', ...)` — Edge Function creates orders, reserves inventory, inserts payment records.
2. `CheckoutSimplified.jsx` → `supabase.functions.invoke('create-paypal-order', ...)` — PayPal order creation.
3. `CheckoutSimplified.jsx` → `supabase.functions.invoke('capture-paypal-order', ...)` — PayPal capture.
4. `paymentGateway.js` → `supabase.functions.invoke('verify-cmi-callback', ...)` — CMI verification.
5. `paymentGateway.js` → `supabase.functions.invoke('get-bank-details', ...)` — Bank details.

### Edge Function Inventory
All 12 payment-related Edge Functions exist in `supabase/functions/`:
- `create-checkout-order/` — Auth required, inventory reservation, rollback on error
- `create-paypal-order/` — PayPal API, MAD→EUR conversion, service role client
- `capture-paypal-order/` — PayPal capture, state persistence
- `process-manual-refund/` — Admin-only, COD/bank refund
- `refund-paypal-payment/`, `refund-cmi-payment/`, `refund-payment/` — Refund flows
- `send-payout/` — Payout sending
- `verify-cmi-callback/` — Signature verification
- `get-bank-details/`, `confirm-bank-transfer/`, `payment-status-write/`

### Readiness Assessment

| Area | Status | Notes |
|------|--------|-------|
| **Auth** | ✅ | `create-checkout-order` uses `requireAuth()` |
| **Inventory** | ✅ | Reservation + rollback in `create-checkout-order` |
| **Idempotency** | ⚠️ | `idempotencyKey` passed but no server-side dedup table confirmed |
| **Error handling** | ✅ | Edge Functions return structured errors |
| **PayPal flow** | ✅ | Create → approve → capture with retry |
| **CMI flow** | ⚠️ | Legacy compatibility surface, fails fast |
| **Bank transfer** | ✅ | Payment record + order metadata update |
| **COD** | ✅ | No payment processing needed |
| **Direct supabase.from in CheckoutSimplified** | ⚠️ | Lines 509, 590-611: reads `public_profiles` directly (not a payment table, lower risk) |

### Verdict: **Demo-safe, approaching production-safe for PayPal/COD/bank.**
- PayPal flow is well-structured with create/capture separation.
- Inventory reservation with rollback is a strong production pattern.
- **Not yet production-safe for real money** due to R-002 (non-transactional payout write chain) and PB-007 (PayPal idempotency).

---

## 8. Refund Flow Readiness

### Architecture
- **`paymentGateway.js` `recordRefund()`** (line 194-205): Inserts into `refunds` table with `payment_id`, `order_id`, `amount`, `reason`, `status`, `gateway_response`.
- **Edge Functions:** `process-manual-refund/`, `refund-paypal-payment/`, `refund-cmi-payment/`, `refund-payment/` — all exist.
- **RLS:** Admin-only INSERT/UPDATE, admin + buyer/vendor SELECT (migration 034).

### Assessment

| Area | Status | Notes |
|------|--------|-------|
| **Table exists** | ✅ | Migration 034, `CREATE TABLE IF NOT EXISTS refunds` |
| **Schema matches code** | ✅ | `paymentGateway.js` insert fields match 034 columns |
| **FK constraints** | ✅ | `payment_id → payments(id)`, `order_id → orders(id)` |
| **CHECK constraints** | ✅ | `amount > 0`, `status IN ('pending', 'completed', 'failed')` |
| **RLS** | ✅ | Admin INSERT/UPDATE/SELECT + buyer/vendor SELECT |
| **Type definition** | ✅ | Now defined in `database.ts` (R-015 fixed) |
| **Error handling** | ⚠️ | `recordRefund()` returns Supabase response directly — no try/catch, no logging on failure |
| **Edge Function** | ✅ | `process-manual-refund/` exists with auth and admin check |

### Verdict: **Schema-safe, functionally adequate for admin-initiated refunds.**
- **Risk:** `recordRefund()` has no error logging — silent failure possible if insert fails. Not a blocker but should be hardened in Phase 8.6+.
- **No code change made** — no proven production blocker, only an observability gap.

---

## 9. R-002 Transactional Design Roadmap

### Current State
- `updateAdminPayoutStatus()` performs 3 sequential non-transactional operations:
  1. `payouts.update({ status })` — if this fails, short-circuits (correct).
  2. `log_financial_audit()` RPC — if this fails, logged but not rolled back.
  3. `notifications.insert()` — if this fails, logged but not rolled back.
- Observability added in Phase 7.48 (R-002 Option B): `side_effects_failed` array + `logger.warn`.

### Proposed RPC Design: `update_payout_status_transactional()`

```sql
CREATE OR REPLACE FUNCTION update_payout_status_transactional(
  p_payout_id UUID,
  p_new_status TEXT,
  p_admin_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_payout RECORD;
  v_audit_ok BOOLEAN := false;
  v_notification_ok BOOLEAN := false;
BEGIN
  -- 1. Lock and read payout row
  SELECT * INTO v_payout FROM payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'payout_not_found');
  END IF;

  -- 2. Validate status transition
  IF v_payout.status = p_new_status THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_status_change');
  END IF;

  -- 3. Update payout status
  UPDATE payouts SET status = p_new_status, updated_at = NOW() WHERE id = p_payout_id;

  -- 4. Insert audit log (same transaction)
  INSERT INTO financial_audit_log (
    entity_type, entity_id, action, previous_status, new_status,
    amount, performed_by, performed_by_role, details, reason
  ) VALUES (
    'payout', p_payout_id, 'manual_adjustment', v_payout.status, p_new_status,
    v_payout.amount, p_admin_id, 'admin',
    jsonb_build_object('updated_by', p_admin_id, 'new_status', p_new_status),
    p_reason
  );

  -- 5. Insert notification (same transaction)
  INSERT INTO notifications (
    user_id, title, message, type, data
  ) VALUES (
    v_payout.vendor_id,
    'Payout ' || initcap(p_new_status),
    'Your payout of ' || v_payout.amount || ' has been updated to ' || p_new_status || '.',
    'payout',
    jsonb_build_object('payout_id', p_payout_id, 'amount', v_payout.amount, 'status', p_new_status)
  );

  RETURN jsonb_build_object('success', true, 'previous_status', v_payout.status, 'new_status', p_new_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Expected Return Shape
```json
{
  "success": true,
  "previous_status": "pending",
  "new_status": "processing"
}
```
Or on error:
```json
{
  "success": false,
  "error": "payout_not_found" | "no_status_change" | "invalid_transition"
}
```

### Rollback Expectations
- All 3 operations (payout update, audit log, notification) succeed or all roll back.
- PostgreSQL transaction guarantees atomicity.

### Test Plan
1. Unit test: RPC succeeds when all operations valid.
2. Unit test: RPC fails when payout doesn't exist.
3. Unit test: RPC fails on no-status-change.
4. Integration test: Verify audit log row created in same transaction.
5. Integration test: Verify notification row created in same transaction.
6. Failure injection: Force notification insert failure → verify payout update rolled back.
7. Concurrency test: Two concurrent updates → only one succeeds (FOR UPDATE lock).

### Phase Recommendation
**R-002 should be Phase 8.6** — after E2E smoke tests confirm current flow works end-to-end.

---

## 10. Test Updates and Results

### Tests Updated
- `adminPayouts.test.js`: 40 tests — mock data, assertions, descriptions updated for `vendor_id` and `manual_adjustment`.
- `AdminPayouts.test.jsx`: Schema compatibility tests — mock data and source assertions updated.
- `AdminPayouts.write-flow.test.jsx`: Mock payout updated.
- `AdminPayouts.behavior.test.jsx`: Mock payout, audit log action, and audit modal display text updated.

### Check Results

| Check | Result |
|-------|--------|
| `npm run type-check` | ✅ Passed |
| `npm run lint` | ✅ Passed (0 errors, ≤1500 warnings) |
| `npm run build` | ✅ Passed (1m 10s) |
| `npm run check:circular` | ✅ Passed (0 circular, 718 files) |
| Targeted tests (20 suites) | ✅ 349 passed, 0 failed |
| Full test suite (150 suites) | ✅ 1622 passed, 2 todo, 0 failed |

---

## 11. Remaining Risks

| Risk ID | Severity | Description | Status |
|---------|----------|-------------|--------|
| R-002 | High | Payout write chain non-transactional | Mitigated (observability), design roadmap ready for Phase 8.6 |
| R-007 | Medium | PayPal idempotency not server-side enforced | Open — Phase 8.6+ |
| R-016 | Medium | No SQL/migration test tooling | Open — Phase 8.7+ |
| R-017 | Low | `payoutService.js` sends `user_id` to Edge Function (separate from table column) | Open — requires Edge Function source verification |
| R-018 | Low | `recordRefund()` has no error logging (silent failure possible) | Open — observability gap, not a blocker |
| R-019 | Low | `CheckoutSimplified.jsx` reads `public_profiles` directly (lines 509, 590-611) | Open — not a payment table, lower risk |

---

## 12. Updated Production Readiness Score

| Category | Phase 8.4 | Phase 8.5 | Delta |
|----------|-----------|-----------|-------|
| Schema/Code Consistency | 12/20 | 18/20 | +6 |
| RLS/Security | 15/20 | 15/20 | 0 |
| Payment Flow Reliability | 8/20 | 12/20 | +4 |
| Type Safety | 7/10 | 9/10 | +2 |
| Test Coverage | 10/10 | 10/10 | 0 |
| Audit/Compliance | 5/10 | 8/10 | +3 |
| Edge Function Readiness | 5/10 | 6/10 | +1 |
| **Total** | **52/100** | **62/100** | **+10** |

---

## 13. Recommended Phase 8.6

**Recommendation: R-002 Transactional RPC Implementation**

### Rationale
1. R-011/R-012 and R-013 are now fixed — the payout read/write flow is schema-correct.
2. The next critical financial risk is R-002: non-transactional payout write chain.
3. The design roadmap (Section 9) is ready for implementation.
4. E2E smoke tests should follow in Phase 8.7 to validate the full flow.

### Phase 8.6 Scope
- Implement `update_payout_status_transactional()` RPC.
- Update `adminPayouts.js` to call the new RPC.
- Update tests to verify transactional behavior.
- Add PayPal idempotency server-side (R-007) if feasible.

### Alternative: E2E Smoke Tests First
If the team prefers to validate current flow before adding transactional complexity, Phase 8.6 could be E2E Role Flow Smoke Tests, with R-002 deferred to Phase 8.7.

---

## 14. Summary

Phase 8.5 resolved three critical schema-code consistency issues:
- **R-011/R-012 (Fixed):** `adminPayouts.js` and `Payouts.jsx` now use `vendor_id` matching the canonical schema.
- **R-013 (Fixed):** Audit RPC action changed from invalid `'status_updated'` to valid `'manual_adjustment'`.
- **R-015 (Fixed):** `refunds` type definition added to `database.ts`.

All checks pass: type-check, lint, build, circular, 150 test suites (1622 tests). Production readiness score improved from 52/100 to 62/100.
