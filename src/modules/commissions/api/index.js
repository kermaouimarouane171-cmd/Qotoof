/**
 * Commissions Module — API Layer (re-export)
 *
 * Re-exports commission-related service functions from existing source files.
 * No business logic changes. No Supabase query changes. No commission formula changes.
 * All exports are additive re-exports from existing source files.
 */

// ── commissionService from ./commissionService.js (moved in Phase 7.29) ────
// commissionService is an object with methods:
//   confirmSaleAndCalculate, closeMonthAndNotify, checkOverdueCommissions,
//   submitPaymentNotice, confirmCommissionPayment, getCurrentMonthSummary,
//   getVendorCommissionHistory, manuallyUnfreezeVendor
export {
  commissionService,
  confirmSaleAndCalculate,
  closeMonthAndNotify,
  checkOverdueCommissions,
  submitPaymentNotice,
  confirmCommissionPayment,
  getCurrentMonthSummary,
  getVendorCommissionHistory,
  manuallyUnfreezeVendor,
} from './commissionService'

export { default as commissionServiceDefault } from './commissionService'

// ── commissionNotifications from ./commissionNotifications.js (moved in Phase 7.24) ──
// commissionNotifications is an object with methods:
//   afterConfirmedSale, monthEndSummary, reminder3Days, dueToday,
//   accountFrozen, paymentConfirmed
export {
  commissionNotifications,
} from './commissionNotifications'

export { default as commissionNotificationsDefault } from './commissionNotifications'

// ── payoutService from ./payoutService.js (moved in Phase 7.21) ──────────
// payoutService is an object with:
//   sendPayout({ userId, amount, currency, source })
export {
  payoutService,
} from './payoutService'

export { default as payoutServiceDefault } from './payoutService'

// ── paymentMethodStrategy from ./paymentMethodStrategy.js (moved in Phase 7.21) ──
// paymentMethodStrategy exports:
//   getPayoutStrategy(method) — returns payout strategy for a given method
export {
  getPayoutStrategy,
} from './paymentMethodStrategy'

// ── adminCommissions from ./adminCommissions.js (created in Phase 7.40) ──
// adminCommissions exports:
//   getAdminCommissionsPayments({ period }) — read-only payments query for admin analytics
export {
  getAdminCommissionsPayments,
} from './adminCommissions'

// ── adminPayouts from ./adminPayouts.js (created in Phase 7.43, extended in Phase 7.45) ──────────
// adminPayouts exports:
//   getAdminPayouts({ dateRange, statusFilter }) — read-only payouts query for admin
//   getPayoutFinancialAuditLogs({ payoutId }) — read-only audit log query for a payout
//   updateAdminPayoutStatus({ payoutId, newStatus, payout, currentUser }) — write flow (update → audit → notification)
export {
  getAdminPayouts,
  getPayoutFinancialAuditLogs,
  updateAdminPayoutStatus,
} from './adminPayouts'
