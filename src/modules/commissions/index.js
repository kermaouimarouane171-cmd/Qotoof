/**
 * Commissions Module — Public API Entry Point (Phase 4.4)
 *
 * This module exposes existing commission/payout functionality through a clean
 * public API. It is a re-export/wrapper layer only — no business logic changes.
 *
 * Public API:
 *   import { commissionService, commissionNotifications, payoutService } from '@/modules/commissions'
 *
 * The commissions module owns:
 *   - Commission records (vendor_monthly_sales, confirmed_transactions)
 *   - Commission calculation (3% monthly commission on vendor sales)
 *   - Commission lifecycle (active → pending → paid / overdue)
 *   - Commission status helpers (days remaining, balance remaining)
 *   - Commission notifications (sale confirmed, month-end, reminders, frozen, paid)
 *   - Vendor account freezing/unfreezing for overdue commissions
 *   - Payment notice submission (vendor → admin)
 *   - Commission payment confirmation (admin → vendor)
 *   - Payout sending (via Edge Function) — re-exported for compatibility
 *
 * The commissions module does NOT own:
 *   - Payment provider logic (PayPal, CMI, bank transfer, COD)
 *   - Checkout flow
 *   - Cart state
 *   - Order lifecycle (order status transitions)
 *   - Delivery lifecycle
 *   - User profile ownership
 *   - Notification delivery infrastructure
 *   - Admin dashboard composition
 *   - Refund provider behavior
 *
 * Allowed dependencies:
 *   - shared, payments (public API only for payment facts),
 *     orders (public API only for order facts), notifications (public API only),
 *     users (public API only for vendor profile references),
 *     utils, config, lib/supabase
 *
 * Forbidden dependencies:
 *   - checkout internals, cart internals, delivery internals,
 *     admin dashboard composition
 */

// ── API ──────────────────────────────────────────────────────────────────
export {
  // commissionService — main commission service object
  commissionService,
  commissionServiceDefault,
  // Individual function wrappers
  confirmSaleAndCalculate,
  closeMonthAndNotify,
  checkOverdueCommissions,
  submitPaymentNotice,
  confirmCommissionPayment,
  getCurrentMonthSummary,
  getVendorCommissionHistory,
  manuallyUnfreezeVendor,
  // commissionNotifications — commission-specific notification triggers
  commissionNotifications,
  commissionNotificationsDefault,
  // payoutService — payout sending via Edge Function (moved in Phase 7.21)
  payoutService,
  payoutServiceDefault,
  // paymentMethodStrategy — payout strategy validation (moved in Phase 7.21)
  getPayoutStrategy,
  // adminCommissions — read-only admin analytics query (created in Phase 7.40)
  getAdminCommissionsPayments,
  // adminPayouts — admin payout queries (created in Phase 7.43, extended in Phase 7.45)
  getAdminPayouts,
  getPayoutFinancialAuditLogs,
  updateAdminPayoutStatus,
} from './api'
