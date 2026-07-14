# Commissions Module

## Purpose

The commissions module encapsulates all commission and payout functionality:
- Monthly 3% commission calculation on vendor sales
- Commission lifecycle management (active → pending → paid / overdue)
- Vendor monthly sales tracking and aggregation
- Confirmed transaction recording
- Commission payment notice submission (vendor → admin)
- Commission payment confirmation (admin → vendor)
- Vendor account freezing/unfreezing for overdue commissions
- Commission-specific notifications (sale confirmed, month-end, reminders, frozen, paid)
- Payout sending via Supabase Edge Function (re-exported for compatibility)

## Current Status: Implementation Moved

This module is now the **owner** of commission service implementation.
All source files have been moved here. No compatibility stubs remain.

**Source files:**
- `src/modules/commissions/api/commissionService.js` (696 lines) — main commission service with calculation, lifecycle, and notification triggers (moved in Phase 7.29)
- `src/modules/commissions/api/commissionNotifications.js` (111 lines) — commission-specific notification triggers (in-app + email) (moved in Phase 7.24)
- `src/modules/commissions/api/payoutService.js` (22 lines) — payout sending via `send-payout` Edge Function (moved in Phase 7.21)
- `src/modules/commissions/api/paymentMethodStrategy.js` (35 lines) — PayPal payout strategy validation (moved in Phase 7.21)

## Public API

```js
import {
  // Service instances
  commissionService,
  commissionNotifications,
  payoutService,

  // Individual function wrappers (from commissionService.js)
  confirmSaleAndCalculate,
  closeMonthAndNotify,
  checkOverdueCommissions,
  submitPaymentNotice,
  confirmCommissionPayment,
  getCurrentMonthSummary,
  getVendorCommissionHistory,
  manuallyUnfreezeVendor,
} from '@/modules/commissions'
```

### `commissionService` Methods (from `src/modules/commissions/api/commissionService.js`)

- `confirmSaleAndCalculate(orderId, vendorId, saleAmount)` — confirm a sale and calculate 3% commission; records transaction, updates monthly totals, triggers notification
- `closeMonthAndNotify()` — close the previous month: set commission due, set deadline, send month-end summaries, create new month records
- `checkOverdueCommissions()` — check pending commissions: send 3-day reminders, due-today alerts, freeze overdue accounts
- `submitPaymentNotice(vendorId, monthlySaleId, paymentMethod, paymentReference, note)` — vendor submits payment notice to admin
- `confirmCommissionPayment(vendorId, month, year, paymentMethod, paymentReference)` — admin confirms commission payment, unfreezes account
- `getCurrentMonthSummary(vendorId)` — get current month commission summary (totals, transactions, status, days remaining)
- `getVendorCommissionHistory(vendorId)` — get full commission history for a vendor
- `manuallyUnfreezeVendor(vendorId, monthlySaleId, note, graceDays)` — admin manually unfreezes a vendor account with grace period

### `commissionNotifications` Methods (from `src/modules/commissions/api/commissionNotifications.js`)

- `afterConfirmedSale({ vendorId, saleAmount, commissionSoFar, orderId })` — notify vendor of new sale and accumulated commission
- `monthEndSummary({ vendorId, monthName, totalSales, commissionDue, dueDate, monthlySaleId })` — notify vendor of month-end summary
- `reminder3Days({ vendorId, amountDue, dueDate, monthlySaleId })` — remind vendor 3 days before deadline
- `dueToday({ vendorId, amountDue, monthlySaleId })` — alert vendor that payment is due today
- `accountFrozen({ vendorId, amountDue, monthlySaleId })` — notify vendor that account is frozen
- `paymentConfirmed({ vendorId, paidAmount, monthlySaleId })` — notify vendor that commission payment is confirmed

### `payoutService` Methods (from `src/modules/commissions/api/payoutService.js`)

- `sendPayout({ userId, amount, currency, source })` — send a payout via `send-payout` Supabase Edge Function

## What Belongs in Commissions

- Commission records (vendor_monthly_sales, confirmed_transactions)
- Commission calculation (3% monthly rate)
- Commission lifecycle (active → pending → paid / overdue)
- Commission status helpers (days remaining, balance remaining)
- Commission notifications (sale confirmed, month-end, reminders, frozen, paid)
- Vendor account freezing/unfreezing for overdue commissions
- Payment notice submission (vendor → admin)
- Commission payment confirmation (admin → vendor)
- Commission-related admin/vendor pages (future migration)
- Commission-related components (future migration)

## What Does NOT Belong in Commissions

- **Payment provider logic** — owned by `payments` module (PayPal, CMI, bank transfer, COD)
- **Checkout flow** — owned by `checkout` module
- **Cart state** — owned by `cart` module
- **Order lifecycle** — owned by `orders` module. Commissions may reference completed/paid order facts.
- **Delivery lifecycle** — owned by `delivery` module
- **User profile ownership** — owned by `users` module. Commissions read vendor profile data (is_active, store_name) via Supabase.
- **Notification delivery infrastructure** — owned by `notifications` module. Commissions trigger notifications but do not deliver them.
- **Admin dashboard composition** — not a commissions concern
- **Refund provider behavior** — owned by `payments` module

---

## Relationship with Payments

- `payments` owns payment records and provider behavior (PayPal, CMI, bank transfer, COD).
- Commissions **consume** payment facts (order paid, amount) but do **not** change payment provider logic.
- `commissionService.confirmSaleAndCalculate()` reads order data (including `payment_received_at`) to confirm a sale.
- `payoutService.sendPayout()` invokes the `send-payout` Edge Function — this is a payout concern re-exported here for compatibility.
- Commissions **must not** own payment records or payment provider behavior.

## Relationship with Orders

- `orders` owns order lifecycle (status transitions, fulfillment).
- Commissions **reference** completed/paid order facts via `order_id` in `confirmed_transactions`.
- `commissionService.confirmSaleAndCalculate()` validates that the order exists and belongs to the vendor before recording a commission.
- Commissions **must not** own order status transitions.

## Relationship with Notifications

- `notifications` owns notification delivery/storage/display.
- Commissions **trigger** commission-related notifications via `commissionNotifications` and `notificationsApi.create()`.
- `commissionNotifications.js` is expected to become part of commissions ownership long-term (documented in notifications README migration plan).
- Currently, `commissionNotifications` is **also** re-exported from `src/modules/notifications/` for backward compatibility.
- **Do not change notification delivery behavior.**
- `commissionService` calls `notificationsApi.create()` directly for admin notifications (payment notice, manual unfreeze) — this is a consumer relationship.

## Relationship with Payouts

- Payouts **may** become a future separate module (`src/modules/payouts/`).
- `payoutService.js` (22 lines) is currently re-exported from commissions because it is tightly coupled with the financial domain.
- If a dedicated payouts module is created in the future, `payoutService` should move there.
- `payoutService.sendPayout()` invokes the `send-payout` Supabase Edge Function.
- **Do not change payout calculations or payout statuses.**
- The admin Payouts page (`src/pages/admin/Payouts.jsx`, 652 lines) uses Supabase directly (not `payoutService`) for listing/updating payouts.

## Relationship with Users/Vendors

- `users` owns user profile data.
- Commissions read vendor profile data (`is_active`, `first_name`, `last_name`, `store_name`, `email`) via Supabase joins.
- `commissionService` updates `profiles.is_active` when freezing/unfreezing vendor accounts.
- Commissions **must not** own user profiles.

## Relationship with Admin/Vendor Pages

- Admin commission management: `src/pages/admin/CommissionManagement.jsx` (636 lines) — uses `commissionService` for payment confirmation and manual unfreeze
- Admin commission analytics: `src/pages/admin/Commissions.jsx` (322 lines) — uses Supabase directly + `platformSettings` for commission rate
- Admin payouts: `src/pages/admin/Payouts.jsx` (652 lines) — uses Supabase directly for payout CRUD
- Vendor commission dashboard: `src/components/vendor/CommissionDashboard.jsx` (489 lines) — uses `commissionService` for summary, history, and payment notice
- These pages are **not** re-exported from the commissions module yet. They are migration candidates.

---

## Module Structure

```
src/modules/commissions/
├── index.js          # Public API entry point
├── api/
│   └── index.js      # commissionService, commissionNotifications, payoutService
├── data/
│   └── index.js      # Placeholder (commissionService is closest to data layer)
├── domain/
│   └── index.js      # Placeholder (domain logic embedded in commissionService)
├── ui/
│   └── index.js      # Placeholder (commission pages/components not re-exported yet)
├── hooks/
│   └── index.js      # Placeholder (no dedicated commission hooks exist)
├── stores/
│   └── index.js      # Placeholder (no dedicated commission store)
├── utils/
│   └── index.js      # Placeholder (utils embedded in commissionService)
└── README.md         # This file
```

---

## Allowed Dependencies

- `shared` — shared utilities and components
- `payments` — public API only (for payment facts: amount, method, status)
- `orders` — public API only (for order facts: order_id, vendor_id, status)
- `notifications` — public API only (for notification requests via `notificationsApi.create()`)
- `users` — public API only (for vendor profile references)
- `utils` — utility functions (logger, currency formatting)
- `config` — configuration constants
- `lib/supabase` — Supabase client

## Forbidden Dependencies

- `checkout` internals — checkout flow is not a commissions concern
- `cart` internals — cart state is not a commissions concern
- `delivery` internals — delivery logic is not a commissions concern
- `admin` dashboard composition — not a commissions concern

---

## Migration Candidates for Future Sprints

| # | Item | Current Location | Target | Risk | Recommended Phase |
|---|---|---|---|---|---|
| MC1 | `src/modules/commissions/api/commissionService.js` (696 lines) | `src/services/` → `src/modules/commissions/api/` | ✅ Done | Moved in Phase 7.29, stub at old path |
| MC2 | `src/modules/commissions/api/commissionNotifications.js` (111 lines) | `@/modules/commissions` | Already migrated | ✅ Done | Moved in Phase 7.24, stub deleted Phase 7.26 |
| MC3 | `src/modules/commissions/api/payoutService.js` (22 lines) | `@/modules/commissions` | Already migrated | ✅ Done | Moved in Phase 7.21, stub deleted Phase 7.22 |
| MC4 | `src/pages/admin/CommissionManagement.jsx` (636 lines) | `src/pages/admin/` | `src/modules/commissions/ui/` | Medium — uses commissionService, supabase, platformSettings, csvExport | Phase 4.5+ |
| MC5 | `src/pages/admin/Commissions.jsx` (322 lines) | `src/pages/admin/` | `src/modules/commissions/ui/` | Medium — uses supabase directly + platformSettings, no commissionService | Phase 4.5+ |
| MC6 | `src/pages/admin/Payouts.jsx` (652 lines) | `src/pages/admin/` | `src/modules/payouts/ui/` or `src/modules/commissions/ui/` | Medium — uses supabase directly, no payoutService | Phase 4.5+ |
| MC7 | `src/components/vendor/CommissionDashboard.jsx` (489 lines) | `src/components/vendor/` | `src/modules/commissions/ui/` | Medium — uses commissionService, i18n, toast | Phase 4.5+ |
| MC8 | Remove `commissionNotifications` re-export from notifications module | `src/modules/notifications/api/index.js` | ✅ Done (Phase 7.32) | Low — zero consumers found | ✅ Complete |
| MC9 | Extract commission domain constants (COMMISSION_RATE, PAYMENT_DEADLINE_DAYS) | Module-scoped in commissionService.js | `src/modules/commissions/domain/` | Low — constants are not exported yet | Phase 4.5+ |
| MC10 | Create dedicated commission React Query hooks | Does not exist | `src/modules/commissions/hooks/` | Low — would improve caching and separation | Phase 4.5+ |

---

## Safety Notes

### Financial Calculations

- **Commission rate**: 3% (`COMMISSION_RATE = 0.03`) — hardcoded in `commissionService.js`
- **Payment deadline**: 7 days after month close (`PAYMENT_DEADLINE_DAYS = 7`)
- **Manual unfreeze grace period**: 3 days (`MANUAL_UNFREEZE_GRACE_DAYS = 3`)
- **Do not change commission formulas.** The 3% rate is applied as `saleAmount * COMMISSION_RATE`.
- `platformSettings.js` also has a `commission_rate` setting (default 10%) used by admin pages — this is a **different** rate used for analytics display, not for actual commission calculation. The actual commission calculation in `commissionService.js` uses the hardcoded 3% rate.

### Commission Lifecycle

- `active` → month is open, sales being recorded
- `pending` → month closed, commission due, awaiting payment
- `overdue` → deadline passed, account frozen (`is_active = false`)
- `paid` → commission paid, account reactivated (`is_active = true`)

### Account Freezing

- When a commission is overdue, `commissionService.checkOverdueCommissions()` sets `profiles.is_active = false`.
- When payment is confirmed, `commissionService.confirmCommissionPayment()` sets `profiles.is_active = true`.
- Admin can manually unfreeze via `commissionService.manuallyUnfreezeVendor()` with a grace period.
- **Do not change freezing/unfreezing behavior.**

### Two Commission Rate Sources

- `commissionService.js` uses `COMMISSION_RATE = 0.03` (3%) — hardcoded, used for actual commission calculation
- `platformSettings.js` exposes `commission_rate` (default 10%) — configurable, used by admin analytics pages for display calculations
- This is a **known inconsistency**. The actual commission calculation uses the 3% hardcoded rate.
- **Do not reconcile these rates in this phase.** Document as a known issue.

### Supabase Tables

- `vendor_monthly_sales` — monthly commission records (vendor_id, month, year, total_sales, commission_rate, commission_due, commission_paid, status, due_date, paid_at, payment_method, payment_reference)
- `confirmed_transactions` — individual confirmed sale transactions (order_id, vendor_id, buyer_id, sale_amount, commission_amount, month, year, confirmed_at, monthly_sale_id)
- `commission_notifications` — notification tracking (vendor_id, monthly_sale_id, type) — prevents duplicate notifications
- `vendor_contracts` — digital contracts (required before commission confirmation)
- `payouts` — payout records (user_id, amount, currency, status, reference)
- `financial_audit_log` — audit trail for financial actions
- **Do not modify schema or RLS policies.**

### Edge Functions

- `send-payout` — invoked by `payoutService.sendPayout()` for sending payouts
- **Do not modify Edge Functions.**

### `commissionNotifications` Re-export Status

- `commissionNotifications` is exported exclusively from `src/modules/commissions/` (as the logical owner — implementation moved in Phase 7.24).
- The notifications module re-export was **removed in Phase 7.32** (MC8) after confirming zero active consumers.
- Implementation: `src/modules/commissions/api/commissionNotifications.js` (moved in Phase 7.24).
