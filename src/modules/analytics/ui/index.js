/**
 * Analytics Module — UI Layer (re-export)
 *
 * Placeholder: Analytics UI components are not re-exported yet because they are
 * tightly coupled to their parent contexts (admin pages, vendor pages, routing).
 *
 * Current analytics UI lives in:
 *   - src/pages/admin/Analytics.jsx (439 lines) — admin analytics page with charts (recharts)
 *   - src/pages/admin/Reports.jsx — admin reports page with report generation + export
 *   - src/pages/admin/Dashboard.jsx — admin dashboard (uses supabase directly)
 *   - src/pages/admin/Commissions.jsx (322 lines) — admin commission analytics (uses supabase directly)
 *   - src/pages/vendor/Analytics.jsx (711 lines) — vendor analytics page with charts (chart.js) + CSV/PDF export
 *   - src/pages/vendor/Dashboard.jsx — vendor dashboard (uses supabase directly, lazy-loaded chart)
 *   - src/components/Reports/ExportButtons.jsx — export buttons (CSV/Excel/PDF)
 *   - src/components/Reports/ReportPreview.jsx — report preview table
 *   - src/components/vendor/RevenueChart.jsx — vendor revenue chart
 *   - src/components/vendor/RecentOrdersWidget.jsx — recent orders widget
 *
 * These components/pages are too coupled to their parent contexts to be safely
 * re-exported as analytics module UI. They should remain where they are until
 * a future phase decouples them.
 */
