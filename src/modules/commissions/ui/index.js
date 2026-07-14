/**
 * Commissions Module — UI Layer (re-export)
 *
 * Placeholder: Commission UI components are not re-exported yet because they are
 * tightly coupled to their parent contexts (admin pages, vendor dashboard, routing).
 *
 * Current commission UI lives in:
 *   - src/pages/admin/CommissionManagement.jsx (636 lines) — admin commission management page
 *   - src/pages/admin/Commissions.jsx (322 lines) — admin commission analytics page (uses Supabase directly)
 *   - src/pages/admin/Payouts.jsx (652 lines) — admin payouts page (uses Supabase directly)
 *   - src/components/vendor/CommissionDashboard.jsx (489 lines) — vendor commission dashboard
 *
 * These components/pages are too coupled to their parent contexts to be safely
 * re-exported as commissions module UI. They should remain where they are until
 * a future phase decouples them.
 */
