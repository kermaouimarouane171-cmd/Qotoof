# Phase 7.31 — Commissions Module Closure & Next Risk Map

**Phase:** 7.31 — Commissions Module Closure Report + Next Risk Map
**Date:** 2026-06-26
**Status:** ✅ Complete — Audit/documentation only

---

## 1. `.windsurfrules` Compliance

✅ `.windsurfrules` read and followed. This phase was audit/documentation only — no source behavior changed, no files moved, no stubs created or deleted, no production code changes.

## 2. Phase Nature Confirmation

- ✅ This phase was audit/documentation only
- ✅ No source behavior changed
- ✅ No files were moved
- ✅ No stubs were created or deleted
- ✅ No production code changes
- ✅ No commission logic changes
- ✅ No payout/payment behavior changes
- ✅ No notification behavior changes
- ✅ No admin/vendor behavior changes
- ✅ No Supabase query changes
- ✅ No Edge Function changes
- ✅ No React Query key changes
- ✅ No route changes
- ✅ No database/RLS changes

---

## 3. Commissions Migration Closure Summary

The commissions migration cycle spanned Phases 7.20–7.30:

| Phase | Action | Status |
|---|---|---|
| 7.20 | Moved `payoutService.js` to commissions module | ✅ Complete |
| 7.21 | Moved `paymentMethodStrategy.js` to commissions module | ✅ Complete |
| 7.22 | Deleted `payoutService` and `paymentMethodStrategy` stubs | ✅ Complete |
| 7.23 | Moved `commissionNotifications.js` to commissions module | ✅ Complete |
| 7.24 | Updated notifications re-export to source from `@/modules/commissions` | ✅ Complete |
| 7.25 | Updated `commissionService.js` internal import to `@/modules/commissions` | ✅ Complete |
| 7.26 | Deleted `commissionNotifications` compatibility stub | ✅ Complete |
| 7.27 | Pre-movement analysis of `commissionService.js` (696 lines) | ✅ Complete |
| 7.28 | Added 61 tests for `commissionService.js` | ✅ Complete |
| 7.29 | Moved `commissionService.js` to `src/modules/commissions/api/` with stub | ✅ Complete |
| 7.30 | Deleted `commissionService.js` compatibility stub | ✅ Complete |

**Official closure:** The commissions module migration cycle (7.20–7.30) is **complete**. All implementation files live under `src/modules/commissions/api/`. No compatibility stubs remain. All consumers use `@/modules/commissions` public API.

---

## 4. Public API Audit

### `src/modules/commissions/api/index.js` (53 lines)

| Symbol | Type | Classification | Should Remain Public? |
|---|---|---|---|
| `commissionService` | Named object (commission service) | Commission service | ✅ Yes |
| `confirmSaleAndCalculate` | Named wrapper | Commission service | ✅ Yes |
| `closeMonthAndNotify` | Named wrapper | Commission service | ✅ Yes |
| `checkOverdueCommissions` | Named wrapper | Commission service | ✅ Yes |
| `submitPaymentNotice` | Named wrapper | Commission service | ✅ Yes |
| `confirmCommissionPayment` | Named wrapper | Commission service | ✅ Yes |
| `getCurrentMonthSummary` | Named wrapper | Commission service | ✅ Yes |
| `getVendorCommissionHistory` | Named wrapper | Commission service | ✅ Yes |
| `manuallyUnfreezeVendor` | Named wrapper | Commission service | ✅ Yes |
| `commissionServiceDefault` | Default re-export | Commission service | ✅ Yes |
| `commissionNotifications` | Named object (notification triggers) | Commission notifications | ✅ Yes |
| `commissionNotificationsDefault` | Default re-export | Commission notifications | ✅ Yes |
| `payoutService` | Named object (payout sending) | Payout service | ✅ Yes (may move to payouts module in future) |
| `payoutServiceDefault` | Default re-export | Payout service | ✅ Yes (legacy compatibility) |
| `getPayoutStrategy` | Named function (strategy validation) | Payment method strategy | ✅ Yes (may move to payouts module in future) |

### `src/modules/commissions/index.js` (66 lines)

Re-exports all 15 symbols from `./api`. Classification identical to above.

**Assessment:**
- **Should remain public:** All 15 symbols — they are consumed by app code and tests
- **Should be internal later:** `payoutService`, `payoutServiceDefault`, `getPayoutStrategy` — if a dedicated payouts module is created (MC3 in README), these should move there
- **Legacy compatibility concern:** `commissionServiceDefault`, `commissionNotificationsDefault`, `payoutServiceDefault` — default re-exports for backward compatibility; no active consumers found but kept for safety
- **No deep imports in app code:** Confirmed — app code uses `@/modules/commissions` only

---

## 5. Deleted Old Service Path Verification

Searched for all four old paths in `src/` (excluding `node_modules/`, `coverage/`, `android/`):

| Old Path | Active References | Result |
|---|---|---|
| `@/services/commissionService` | 0 | ✅ Clean |
| `@/services/commissionNotifications` | 0 | ✅ Clean |
| `@/services/payoutService` | 0 | ✅ Clean |
| `@/services/paymentMethodStrategy` | 0 | ✅ Clean |

Also searched for relative path patterns (`../services/commissionService`, `../../services/commissionService`): 0 found.

All remaining references exist only in historical phase reports under `docs/architecture/` — intentionally left unchanged.

---

## 6. Compatibility Stub Verification

| Stub File | Status |
|---|---|
| `src/services/commissionService.js` | ✅ Deleted (Phase 7.30) |
| `src/services/commissionNotifications.js` | ✅ Deleted (Phase 7.26) |
| `src/services/payoutService.js` | ✅ Deleted (Phase 7.22) |
| `src/services/paymentMethodStrategy.js` | ✅ Deleted (Phase 7.22) |

**Zero compatibility stubs remain from the commissions migration cycle.**

---

## 7. Notifications Re-Export Audit

### Current State

`src/modules/notifications/api/index.js` (lines 30–36) re-exports `commissionNotifications` from `@/modules/commissions`:

```js
export {
  commissionNotifications,
} from '@/modules/commissions'
```

This re-export flows through to `src/modules/notifications/index.js` (line 49).

### Consumer Search

Searched all `.js`, `.ts`, `.jsx`, `.tsx` files in `src/` for imports of `commissionNotifications` from `@/modules/notifications` (excluding commissions module and tests):

**Result: 0 active consumers import `commissionNotifications` from `@/modules/notifications`.**

All active consumers import from `@/modules/commissions` directly:
- `src/modules/commissions/api/commissionService.js` — imports from `./commissionNotifications` (local)
- `src/__tests__/services/commissionNotifications.test.js` — imports from `@/modules/commissions`

### Assessment

| Question | Answer |
|---|---|
| Does `@/modules/notifications` still re-export `commissionNotifications`? | ✅ Yes |
| Is that re-export still needed? | ❌ No — 0 active consumers use it |
| Does it create conceptual coupling? | Yes — notifications module depends on commissions module for a symbol that is not a notification concern |
| Should removing it be Phase 7.32 candidate? | ✅ Yes — safe candidate (MC8) |
| Do consumers currently use the notifications re-export? | ❌ No |
| Is MC8 safe or needs import adoption first? | ✅ Safe — no import adoption needed, zero consumers to migrate |

### Recommendation

The re-export can be safely removed in Phase 7.32. No import adoption is needed because zero consumers use the notifications path. The removal is purely architectural cleanup.

---

## 8. Admin/Vendor Consumer Audit

### Admin Commission UI

| File | Import Path | Symbols Used | Uses `@/modules/commissions`? | Deep Imports? | Old Paths? | Risk |
|---|---|---|---|---|---|---|
| `src/pages/admin/CommissionManagement.jsx` | `@/modules/commissions` | `commissionService` | ✅ Yes | ❌ No | ❌ No | Low |
| `src/pages/admin/Commissions.jsx` | `@/services/supabase` + `@/modules/admin` | `supabase`, `platformSettings` (no commissionService) | ❌ N/A | ❌ No | ❌ No | Low |
| `src/pages/admin/Payouts.jsx` | `@/services/supabase` + others | `supabase` directly (no payoutService) | ❌ N/A | ❌ No | ❌ No | Low |

### Vendor Commission UI

| File | Import Path | Symbols Used | Uses `@/modules/commissions`? | Deep Imports? | Old Paths? | Risk |
|---|---|---|---|---|---|---|
| `src/components/vendor/CommissionDashboard.jsx` | `@/modules/commissions` | `commissionService` | ✅ Yes | ❌ No | ❌ No | Low |

### Summary

- **2 consumers** use `@/modules/commissions` public API: `CommissionManagement.jsx`, `CommissionDashboard.jsx`
- **2 admin pages** use Supabase directly (not through module): `Commissions.jsx`, `Payouts.jsx` — these are migration candidates (MC4/MC5/MC6) but not urgent
- **0 deep imports** in app code
- **0 old path references** remain
- **Risk level: Low** for all current consumers

---

## 9. Test Coverage Summary

### Current Test Files

| Test File | Tests | Suites | Status |
|---|---|---|---|
| `src/__tests__/services/commissionService.test.js` | 61 | 10 | ✅ All pass |
| `src/__tests__/services/commissionNotifications.test.js` | — | — | ✅ All pass |
| `src/__tests__/services/payoutService.test.js` | — | — | ✅ All pass |
| `src/__tests__/services/paymentMethodStrategy.test.js` | — | — | ✅ All pass |
| `src/__tests__/pages/AdminCommissionManagement.columns.test.jsx` | — | — | ✅ All pass |
| `src/__tests__/pages/AdminCommissions.columns.test.jsx` | — | — | ✅ All pass |
| `src/__tests__/pages/AdminPayouts.test.jsx` | — | — | ✅ All pass |

### Targeted Test Run (Phase 7.31)

- **7 suites, 122 tests, 0 failures**

### Full Test Suite (from Phase 7.30)

- **145/145 suites, 1521/1523 tests (2 todo), 0 failures**

### Remaining Gaps

| Gap | Description | Risk |
|---|---|---|
| Integration coverage | No integration test covers the full commission lifecycle (sale → month close → overdue → freeze → pay → unfreeze) | Medium |
| Suspicious behavior coverage | `checkOverdueCommissions` freeze-without-notification path is tested but the behavior itself is suspicious (see Risk Register) | Medium |
| Admin/vendor flow gaps | `CommissionManagement.jsx` and `CommissionDashboard.jsx` have column/structure tests but no full interaction flow tests | Low-Medium |
| Notification dedup edge cases | Dedup guard is tested but edge cases (concurrent calls, race conditions) are not covered | Low |
| Payout/commission cross-flow | No test covers the interaction between payout sending and commission payment confirmation | Low |

---

## 10. Known Risk Register

### Risk R-001: `checkOverdueCommissions` freezes account even when dedup prevents `accountFrozen` notification

| Field | Value |
|---|---|
| **Current behavior** | In `checkOverdueCommissions()`, when `remainingDays < 0`: (1) status set to `overdue`, (2) `profiles.is_active` set to `false`, (3) dedup check runs — if notification already sent, `accountFrozen` notification is NOT sent, but account IS still frozen |
| **Why it was not changed** | Protected Zone (Section 37) — requires explicit analysis and approval. Discovered in Phase 7.28, documented but not changed |
| **Affected tests** | `commissionService.test.js` — tests cover both the freeze path and the dedup path, but the suspicious combination (freeze + dedup-blocked-notification) is the actual production behavior |
| **Potential impact** | Vendor account is frozen without receiving the `accountFrozen` notification — vendor may not know why their account is frozen |
| **Recommended future phase** | Phase 7.32 or later: bug analysis only → add specific regression test → fix only if approved |

---

## 11. Next Phase Candidate Risk Map

### Option A: MC8 — Remove `commissionNotifications` re-export from notifications module

| Criterion | Assessment |
|---|---|
| Active consumers | 0 — no code imports `commissionNotifications` from `@/modules/notifications` |
| Import adoption needed | ❌ No — zero consumers to migrate |
| Risk level | **Very Low** — purely architectural cleanup |
| Test impact | Minimal — only notifications barrel test if any |
| Purely architectural cleanup? | ✅ Yes |
| **Recommendation** | ✅ **Safest candidate** — can be done in a single small phase |

### Option B: MC4/MC5 — Admin pages migration/cleanup

| Criterion | Assessment |
|---|---|
| Files involved | `CommissionManagement.jsx` (636 lines), `Commissions.jsx` (322 lines) |
| UI risk | Medium — large files with Supabase queries, platformSettings, CSV export |
| Test coverage | Column/structure tests exist but no full interaction tests |
| Current imports already use modules? | `CommissionManagement.jsx` uses `@/modules/commissions` ✅; `Commissions.jsx` uses Supabase directly ❌ |
| Needs analysis first? | ✅ Yes — pre-movement analysis recommended before any migration |
| **Recommendation** | Not recommended for 7.32 — needs analysis phase first |

### Option C: MC9 — Extract commission constants

| Criterion | Assessment |
|---|---|
| Constants involved | `COMMISSION_RATE = 0.03`, `PAYMENT_DEADLINE_DAYS = 7`, `MANUAL_UNFREEZE_GRACE_DAYS = 3` |
| Risk level | Low — constants are module-scoped, not exported |
| Could extraction change behavior? | Only if import path changes introduce circular deps or if values are accidentally changed |
| Test coverage | Constants are tested indirectly through commissionService tests |
| Should it wait? | Can be done anytime but low urgency — constants work fine where they are |
| **Recommendation** | Low priority — not recommended for 7.32 |

### Option D: Bug-risk analysis for `checkOverdueCommissions` dedup/freeze behavior

| Criterion | Assessment |
|---|---|
| Should this happen before more movement? | ✅ Yes — fixing a known bug before more architectural changes is prudent |
| Does it need tests first? | ✅ Yes — a specific regression test should be added before any fix |
| Risk level | Medium — changes to freeze/unfreeze logic affect vendor access |
| **Recommendation** | Good candidate but requires careful analysis and explicit approval (Protected Zone) |

### Option E: Broader next `src/services/` group analysis

| Criterion | Assessment |
|---|---|
| Return to Phase 7.18 ownership map? | Possible — Phase 7.18 closed the payments module; next group could be orders, delivery, or notifications |
| Safest low-risk group | Notifications module has re-export layer but `notifications.js` (669 lines) is a complex move |
| **Recommendation** | Possible but premature — should complete commissions cleanup (MC8) first |

---

## 12. Recommended Phase 7.32

**MC8 — Remove `commissionNotifications` re-export from notifications module.**

This is the smallest and safest next phase:
- Zero active consumers need migration
- Purely architectural cleanup
- No behavior change
- No logic change
- Minimal test impact
- Follows the established stub-deletion pattern (search → confirm zero consumers → remove → verify)

### Suggested Phase 7.32 Prompt Outline

```
Phase 7.32 — Remove commissionNotifications re-export from notifications module.

Steps:
1. Read .windsurfrules
2. Search for all active imports of `commissionNotifications` from `@/modules/notifications`
3. If zero consumers found:
   a. Remove `commissionNotifications` re-export from `src/modules/notifications/api/index.js`
   b. Remove `commissionNotifications` from `src/modules/notifications/index.js` root barrel
   c. Update notifications README migration plan
   d. Run lint, type-check, build, check:circular
   e. Run targeted tests (notifications + commissions)
4. Create phase report
5. Update MODULAR_DEVELOPMENT_PLAN.md

Do NOT change:
- commissionNotifications implementation
- commissionService behavior
- Any notification delivery behavior
- Any commission behavior
```

---

## 13. Verification Results

| Check | Result |
|---|---|
| `npm run lint` | ✅ Passed |
| `npm run type-check` | ✅ Passed |
| `npm run build` | ✅ Passed (2m 29s) |
| `npm run check:circular` | ✅ 711 files, 0 circular dependencies |
| Targeted tests (7 suites) | ✅ 122/122 passed |

### Targeted Test Breakdown

| Suite | Result |
|---|---|
| `commissionService.test.js` | ✅ Passed |
| `commissionNotifications.test.js` | ✅ Passed |
| `payoutService.test.js` | ✅ Passed |
| `paymentMethodStrategy.test.js` | ✅ Passed |
| `AdminCommissionManagement.columns.test.jsx` | ✅ Passed |
| `AdminCommissions.columns.test.jsx` | ✅ Passed |
| `AdminPayouts.test.jsx` | ✅ Passed |

---

## 14. Files Inspected

- `.windsurfrules` (614 lines — Section 37 confirmed)
- `src/modules/commissions/index.js` (66 lines)
- `src/modules/commissions/api/index.js` (53 lines)
- `src/modules/commissions/api/commissionService.js` (696 lines)
- `src/modules/commissions/api/commissionNotifications.js` (111 lines)
- `src/modules/commissions/api/payoutService.js` (22 lines)
- `src/modules/commissions/api/paymentMethodStrategy.js` (35 lines)
- `src/modules/commissions/README.md` (264 lines)
- `src/modules/notifications/api/index.js` (47 lines)
- `src/modules/notifications/index.js` (89 lines)
- `src/modules/notifications/README.md` (395 lines)
- `src/pages/admin/CommissionManagement.jsx` (import audit)
- `src/pages/admin/Commissions.jsx` (import audit)
- `src/pages/admin/Payouts.jsx` (import audit)
- `src/components/vendor/CommissionDashboard.jsx` (import audit)
- `src/__tests__/services/commissionService.test.js` (707 lines)
- `src/__tests__/services/commissionNotifications.test.js` (import audit)
- `src/__tests__/services/payoutService.test.js` (import audit)
- `src/__tests__/services/paymentMethodStrategy.test.js` (import audit)
- `src/__tests__/pages/AdminCommissionManagement.columns.test.jsx`
- `src/__tests__/pages/AdminCommissions.columns.test.jsx`
- `src/__tests__/pages/AdminPayouts.test.jsx`
- `MODULAR_DEVELOPMENT_PLAN.md`

## 15. Files Changed

| File | Change |
|---|---|
| `MODULAR_DEVELOPMENT_PLAN.md` | **Updated** — Phase 7.31 status added |
| `docs/architecture/phase-7-31-commissions-module-closure-and-next-risk-map.md` | **Created** — This report |

---

## 16. Remaining Risks Before Moving Additional Services

1. **R-001:** `checkOverdueCommissions` freezes account even when dedup prevents `accountFrozen` notification — unresolved, documented
2. **Two commission rate sources:** 3% hardcoded in `commissionService.js` vs 10% configurable in `platformSettings.js` — known inconsistency, not reconciled
3. **Admin pages using Supabase directly:** `Commissions.jsx` and `Payouts.jsx` bypass the module API — migration candidates for future phases
4. **Notifications re-export:** `commissionNotifications` re-export from notifications module is unused but creates conceptual coupling — safe to remove (MC8)
5. **No integration test for full commission lifecycle:** Unit tests cover individual methods but no end-to-end lifecycle test exists
