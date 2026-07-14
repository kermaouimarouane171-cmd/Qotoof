# Analytics Module

## Purpose

The analytics module encapsulates all analytics, reporting, and dashboard data functionality:
- Admin and vendor stats APIs (total revenue, orders, users, products)
- Vendor analytics helpers (chart data building, KPI calculations, time bucketing)
- Report generation (sales, user, inventory, delivery reports)
- Export utilities (CSV, Excel, PDF)
- Privacy-friendly analytics tracking (self-hosted, no cookies)
- Google Analytics tracking (GA4 events)
- Analytics-related React Query hooks

## Current Status: Re-export Foundation Only

This module is currently a **re-export layer**. No source files have been moved.
The re-exports point to existing files in `src/services/`, `src/utils/`, and `src/hooks/`.

**Source files:**
- `src/services/api.js` (713 lines) — exports `analyticsApi` (getVendorStats, getAdminStats)
- `src/services/vendorAnalytics.js` (309 lines) — vendor analytics helpers: chart data, KPIs, time bucketing
- `src/services/reports/reportService.js` (131 lines) — report generation: sales, user, inventory, delivery
- `src/services/reports/csvExport.js` (50 lines) — CSV export utility
- `src/services/reports/excelExport.js` (54 lines) — Excel export utility
- `src/services/reports/pdfExport.js` (108 lines) — PDF export utility
- `src/services/analytics.js` (358 lines) — privacy-friendly analytics (self-hosted)
- `src/services/googleAnalytics.js` (114 lines) — Google Analytics service (GA4)
- `src/utils/analytics.js` (123 lines) — thin wrapper around googleAnalytics
- `src/hooks/queries/useVendorAdminQueries.js` (157 lines) — useVendorStats, useAdminStats hooks

## Public API

```js
import {
  // Stats APIs
  analyticsApi,          // { getVendorStats, getAdminStats }

  // Vendor analytics helpers
  DATE_RANGES,
  getOrderRevenue,
  resolveVendorAnalyticsRange,
  buildTimeBuckets,
  buildRevenueChartData,
  buildOrdersChartData,
  buildRatingsTrendData,
  buildTopProductMetrics,
  buildTopProductsChartData,
  buildCategoryDistributionData,
  buildStatusBreakdown,
  calculateVendorAnalyticsMetrics,
  buildAnalyticsCsvRows,
  buildAnalyticsPdfSummary,

  // Report service
  reportService,         // { generateSalesReport, generateUserReport, generateInventoryReport, generateDeliveryReport }

  // Export utilities
  csvExport,             // { exportToCSV }
  excelExport,           // { exportToExcel }
  pdfExport,             // { exportElementToPDF, exportTableToPDF }

  // Privacy-friendly analytics
  initializeAnalytics,
  trackPageView,
  trackEvent,
  trackProductView,
  trackAddToCart,
  trackRemoveFromCart,
  trackCheckoutStart,
  trackPurchase,
  trackLoginAttempt,
  trackRegistration,
  trackSearch,
  trackFilter,
  trackPageLoadTime,
  usePageViewTracking,
  useTimeOnPage,
  setupOutboundLinkTracking,
  setupErrorTracking,
  initializeAllAnalytics,

  // Google Analytics
  googleAnalytics,

  // Analytics utils (GA wrappers)
  trackSignUp,
  trackViewItem,
  trackBeginCheckout,
  trackProductCreate,
  trackOrderAccepted,
  trackOrderDelivered,

  // React Query hooks
  useVendorStats,
  useAdminStats,
} from '@/modules/analytics'
```

### `analyticsApi` Methods (from `src/services/api.js`)

- `getVendorStats(vendorId)` — fetch vendor stats: totalRevenue, totalOrders, pendingOrders, recent orders
- `getAdminStats()` — fetch admin stats: totalUsers, totalProducts, totalOrders, totalRevenue

### `vendorAnalytics` Helpers (from `src/services/vendorAnalytics.js`)

- `DATE_RANGES` — preset date range definitions (7d, 30d, 3m, 6m, 1y)
- `getOrderRevenue(order)` — resolve vendor revenue from order (vendor_amount → payment_received_amount → actual_sale_amount → total)
- `resolveVendorAnalyticsRange({ selectedRange, customDateFrom, customDateTo, now })` — resolve date range with granularity
- `buildTimeBuckets({ startDate, endDate, granularity })` — build time buckets for chart data (day/week/month)
- `buildRevenueChartData({ orders, buckets, labels, label })` — build chart.js data for revenue over time
- `buildOrdersChartData({ orders, buckets, labels, label })` — build chart.js data for order count over time
- `buildRatingsTrendData({ reviews, buckets, labels, label })` — build chart.js data for average rating over time
- `buildTopProductMetrics({ orders, products })` — calculate top products by revenue and quantity
- `buildTopProductsChartData({ topProducts, label, metric })` — build chart.js data for top products
- `buildCategoryDistributionData({ topProducts })` — build chart.js data for category distribution
- `buildStatusBreakdown(orders)` — build order status breakdown
- `calculateVendorAnalyticsMetrics({ orders, reviews, products })` — calculate KPI metrics (totalRevenue, totalOrders, avgOrderValue, repeatCustomers, avgDeliveryTime, fulfillmentRate, avgReviewResponseHours, reviewReplyRate, averageRating, lowStockProducts)
- `buildAnalyticsCsvRows({ orders })` — build CSV-ready rows from orders
- `buildAnalyticsPdfSummary({ rangeLabel, metrics, topProducts })` — build PDF summary text lines

### `reportService` Methods (from `src/services/reports/reportService.js`)

- `generateSalesReport({ startDate, endDate, vendorId })` — generate sales report with summary
- `generateUserReport({ startDate, endDate })` — generate user/customer report
- `generateInventoryReport({ vendorId })` — generate product inventory report
- `generateDeliveryReport({ startDate, endDate })` — generate delivery performance report

### Export Utilities

- `csvExport.exportToCSV(rows, filename)` — export rows to CSV file
- `excelExport.exportToExcel(rows, filename, sheetName)` — export rows to Excel file
- `pdfExport.exportElementToPDF(elementId, filename, title)` — export DOM element to PDF
- `pdfExport.exportTableToPDF(columns, rows, filename, title)` — export table data to PDF

### Privacy-Friendly Analytics (from `src/services/analytics.js`)

- `initializeAnalytics()` — initialize self-hosted analytics script
- `trackPageView(url, title)` — track page view
- `trackEvent(eventName, properties)` — track custom event
- `trackProductView(productId, productName, category)` — track product view
- `trackAddToCart(productId, productName, price, quantity)` — track add to cart
- `trackRemoveFromCart(productId, productName)` — track remove from cart
- `trackCheckoutStart(cartValue, itemCount)` — track checkout start
- `trackPurchase(orderId, total, itemCount)` — track purchase
- `trackLoginAttempt(success)` — track login attempt
- `trackRegistration(role)` — track registration
- `trackSearch(query, resultsCount)` — track search
- `trackFilter(filterType, filterValue)` — track filter usage
- `trackPageLoadTime()` — track page load time
- `usePageViewTracking()` — React hook for page view tracking
- `useTimeOnPage(pageName)` — React hook for time on page tracking
- `setupOutboundLinkTracking()` — setup outbound link click tracking
- `setupErrorTracking()` — setup JS error tracking
- `initializeAllAnalytics()` — initialize all analytics features

### Google Analytics (from `src/services/googleAnalytics.js`)

- `googleAnalytics.init()` — initialize Google Analytics
- `googleAnalytics.pageView(path)` — track page view
- `googleAnalytics.event(category, action, label)` — track custom event
- `googleAnalytics.purchase(order)` — track e-commerce purchase
- `googleAnalytics.signUp(method)` — track sign up
- `googleAnalytics.login(method)` — track login
- `googleAnalytics.search(searchTerm, resultsCount)` — track search

### React Query Hooks (from `src/hooks/queries/useVendorAdminQueries.js`)

- `useVendorStats(vendorId, options)` — fetch vendor stats with caching
- `useAdminStats(options)` — fetch admin stats with caching

## What Belongs in Analytics

- Analytics APIs (getVendorStats, getAdminStats)
- Vendor analytics helpers (chart data, KPIs, time bucketing, status breakdown)
- Report APIs (sales, user, inventory, delivery reports)
- Export utilities (CSV, Excel, PDF)
- Privacy-friendly analytics tracking (page views, events, e-commerce)
- Google Analytics tracking (GA4 events)
- Analytics-related React Query hooks (useVendorStats, useAdminStats)
- Analytics-related UI components (future migration)
- Admin/vendor analytics pages (future migration)

## What Does NOT Belong in Analytics

- **Order lifecycle** — owned by `orders` module. Analytics reads order facts but does not change order behavior.
- **Payment provider logic** — owned by `payments` module. Analytics reads payment facts but does not change payment behavior.
- **Commission calculation** — owned by `commissions` module. Analytics may display commission metrics but does not calculate commissions.
- **Product CRUD** — owned by `catalog` module. Analytics reads product facts but does not manage products.
- **Delivery lifecycle** — owned by `delivery` module. Analytics reads delivery facts but does not change delivery behavior.
- **Cart state** — owned by `cart` module
- **Checkout flow** — owned by `checkout` module
- **Auth/session logic** — owned by `auth` module
- **User profile ownership** — owned by `users` module
- **Admin dashboard composition** — analytics provides widgets/data but does not own the full dashboard layout

---

## Relationship with Orders

- `orders` owns order lifecycle (status transitions, fulfillment).
- Analytics **reads** order facts (id, total, status, created_at, vendor_id, buyer_id, order_items) via Supabase queries.
- `analyticsApi.getVendorStats()` queries `orders` table for vendor stats.
- `reportService.generateSalesReport()` queries `orders` with joined `order_items` and `profiles`.
- `vendorAnalytics` helpers process order data in-memory (no Supabase queries — pure functions).
- Analytics **must not** change order behavior or status transitions.

## Relationship with Payments

- `payments` owns payment lifecycle and provider behavior.
- Analytics **reads** payment facts (amount, method, status) but does not change payment behavior.
- `getOrderRevenue()` resolves revenue from `vendor_amount` → `payment_received_amount` → `actual_sale_amount` → `total` — this is a **read-only** resolution, not a payment calculation.
- Analytics **must not** change payment behavior.

## Relationship with Commissions

- `commissions` owns commission lifecycle and calculations.
- Analytics **may display** commission metrics (e.g., admin Commissions page shows commission charts).
- The admin `Commissions.jsx` page uses Supabase directly + `platformSettings` for commission rate — it is **not** re-exported from analytics.
- Analytics **must not** change commission behavior or calculations.

## Relationship with Catalog/Products

- `catalog` owns product CRUD and product data.
- Analytics **reads** product facts (id, name, category, price, stock_quantity) for top products and category distribution.
- `vendorAnalytics.buildTopProductMetrics()` joins order items with product data in-memory.
- `reportService.generateInventoryReport()` queries `products` table.
- Analytics **must not** change product behavior.

## Relationship with Delivery

- `delivery` owns delivery lifecycle and driver management.
- Analytics **reads** delivery facts (driver_id, status, created_at, accepted_at, completed_at) for driver performance.
- `reportService.generateDeliveryReport()` queries `orders` with driver joins.
- Admin `Analytics.jsx` queries `deliveries` table for driver performance charts.
- Analytics **must not** change delivery behavior.

## Relationship with Users

- `users` owns user profile data.
- Analytics **reads** profile data (first_name, last_name, store_name, email) for vendor/buyer/driver name resolution in charts.
- `reportService.generateUserReport()` queries `profiles` table.
- Analytics **must not** own user profiles.

## Relationship with Admin/Vendor Dashboards

- Analytics provides **data and helpers** for dashboards but does not own the dashboard layout.
- Admin dashboard (`src/pages/admin/Dashboard.jsx`) uses Supabase directly — not re-exported from analytics.
- Vendor dashboard (`src/pages/vendor/Dashboard.jsx`) uses Supabase directly + `ordersApi` + chart components — not re-exported from analytics.
- Admin analytics page (`src/pages/admin/Analytics.jsx`) uses Supabase directly + recharts — not re-exported from analytics.
- Vendor analytics page (`src/pages/vendor/Analytics.jsx`) uses `vendorAnalytics` helpers + chart.js — not re-exported from analytics.
- Admin reports page (`src/pages/admin/Reports.jsx`) uses `reportService` + `ExportButtons` + `ReportPreview` — not re-exported from analytics.
- These pages are **migration candidates** for future phases.

---

## Module Structure

```
src/modules/analytics/
├── index.js          # Public API entry point
├── api/
│   └── index.js      # analyticsApi, vendorAnalytics, reportService, export utils, tracking
├── data/
│   └── index.js      # Placeholder (analyticsApi/reportService are closest to data layer)
├── domain/
│   └── index.js      # Placeholder (domain logic embedded in vendorAnalytics.js)
├── ui/
│   └── index.js      # Placeholder (analytics pages/components not re-exported yet)
├── hooks/
│   └── index.js      # useVendorStats, useAdminStats
├── stores/
│   └── index.js      # Placeholder (no dedicated analytics store)
├── utils/
│   └── index.js      # GA wrapper functions (re-exported from api layer)
└── README.md         # This file
```

---

## Allowed Dependencies

- `shared` — shared utilities and components
- `orders` — public API only (for order facts: id, total, status, created_at, vendor_id, buyer_id)
- `payments` — public API only (for payment facts: amount, method, status)
- `commissions` — public API only (for commission facts: commission_due, commission_paid, status)
- `catalog` — public API only (for product facts: id, name, category, price, stock_quantity)
- `delivery` — public API only (for delivery facts: driver_id, status, timings)
- `users` — public API only (for profile facts: first_name, last_name, store_name, email)
- `utils` — utility functions (logger, currency formatting)
- `config` — configuration constants
- `lib/supabase` — Supabase client

## Forbidden Dependencies

- `checkout` internals — checkout flow is not an analytics concern
- `cart` internals — cart state is not an analytics concern
- `payment provider internals` — payment provider logic is not an analytics concern
- `admin dashboard composition` — analytics provides widgets/data, not dashboard layout

---

## Migration Candidates for Future Sprints

| # | Item | Current Location | Target | Risk | Recommended Phase |
|---|---|---|---|---|---|
| MC1 | `src/services/vendorAnalytics.js` (309 lines) | `src/services/` | `src/modules/analytics/domain/` or `api/` | Low — pure functions, no Supabase queries, only imported by vendor/Analytics.jsx + test | Phase 4.6+ |
| MC2 | `src/services/reports/reportService.js` (131 lines) | `src/services/reports/` | `src/modules/analytics/api/` | Low — clean, focused file with Supabase queries | Phase 4.6+ |
| MC3 | `src/services/reports/csvExport.js` (50 lines) | `src/services/reports/` | `src/modules/analytics/utils/` | Low — pure utility, no business logic | Phase 4.6+ |
| MC4 | `src/services/reports/excelExport.js` (54 lines) | `src/services/reports/` | `src/modules/analytics/utils/` | Low — pure utility, no business logic | Phase 4.6+ |
| MC5 | `src/services/reports/pdfExport.js` (108 lines) | `src/services/reports/` | `src/modules/analytics/utils/` | Low — pure utility, no business logic | Phase 4.6+ |
| MC6 | `analyticsApi` in `src/services/api.js` | `src/services/api.js` | `src/modules/analytics/api/` | Medium — analyticsApi is part of larger api.js file. Must extract carefully without breaking other exports. | Phase 4.6+ |
| MC7 | `src/services/analytics.js` (358 lines) | `src/services/` | `src/modules/analytics/api/` | Low — self-hosted analytics tracking, only imported by main.jsx | Phase 4.6+ |
| MC8 | `src/services/googleAnalytics.js` (114 lines) | `src/services/` | `src/modules/analytics/api/` | Low — GA4 service, only imported by utils/analytics.js | Phase 4.6+ |
| MC9 | `src/utils/analytics.js` (123 lines) | `src/utils/` | `src/modules/analytics/utils/` | Low — thin wrapper around googleAnalytics | Phase 4.6+ |
| MC10 | `useVendorStats`, `useAdminStats` in `useVendorAdminQueries.js` | `src/hooks/queries/` | `src/modules/analytics/hooks/` | Medium — must split from vendor/admin hooks file | Phase 4.6+ |
| MC11 | `src/pages/admin/Analytics.jsx` (439 lines) | `src/pages/admin/` | `src/modules/analytics/ui/` | Medium — uses supabase directly + recharts | Phase 4.6+ |
| MC12 | `src/pages/vendor/Analytics.jsx` (711 lines) | `src/pages/vendor/` | `src/modules/analytics/ui/` | Medium — uses vendorAnalytics + chart.js + supabase directly | Phase 4.6+ |
| MC13 | `src/pages/admin/Reports.jsx` | `src/pages/admin/` | `src/modules/analytics/ui/` | Medium — uses reportService + ExportButtons + ReportPreview | Phase 4.6+ |
| MC14 | `src/components/Reports/ExportButtons.jsx` | `src/components/Reports/` | `src/modules/analytics/ui/` | Low — self-contained export component | Phase 4.6+ |
| MC15 | `src/components/Reports/ReportPreview.jsx` | `src/components/Reports/` | `src/modules/analytics/ui/` | Low — self-contained preview component | Phase 4.6+ |
| MC16 | `src/components/vendor/RevenueChart.jsx` | `src/components/vendor/` | `src/modules/analytics/ui/` | Low — chart component | Phase 4.6+ |
| MC17 | `src/components/vendor/RecentOrdersWidget.jsx` | `src/components/vendor/` | `src/modules/analytics/ui/` or `orders/ui/` | Low — orders widget, may belong in orders | Phase 4.6+ |
| MC18 | `src/pages/admin/Dashboard.jsx` | `src/pages/admin/` | `src/modules/admin/ui/` or `src/modules/analytics/ui/` | Medium — admin dashboard, uses supabase directly. May belong in admin module. | Phase 4.6+ |
| MC19 | `src/pages/vendor/Dashboard.jsx` | `src/pages/vendor/` | `src/modules/analytics/ui/` or vendor module | Medium — vendor dashboard, uses supabase + ordersApi + multiple components | Phase 4.6+ |
| MC20 | `src/pages/admin/Commissions.jsx` (322 lines) | `src/pages/admin/` | `src/modules/commissions/ui/` | Medium — commission analytics, uses supabase + platformSettings | Phase 4.6+ |

---

## Safety Notes

### Analytics Calculations

- **`calculateVendorAnalyticsMetrics()`** computes KPIs from raw orders, reviews, and products data in-memory. **Do not change these calculations.**
- **`getOrderRevenue()`** resolves vendor revenue using fallback chain: `vendor_amount` → `payment_received_amount` → `actual_sale_amount` → `total`. **Do not change this resolution order.**
- **`buildTopProductMetrics()`** aggregates order items by product. **Do not change aggregation logic.**
- All vendorAnalytics helpers are **pure functions** — they do not make Supabase queries. They process data passed to them.

### Report Generation

- **`reportService.generateSalesReport()`** queries `orders` with status filter `['delivered', 'completed']`. **Do not change status filters.**
- **`reportService.generateDeliveryReport()`** queries orders with `not('driver_id', 'is', null)`. **Do not change query filters.**
- All report queries use specific date range filters. **Do not change date range logic.**

### Admin Analytics Page

- `src/pages/admin/Analytics.jsx` uses **recharts** (not chart.js) and queries Supabase directly.
- It builds time-series data, status pie charts, top vendors/buyers, and driver performance.
- **Do not change chart data building logic.**
- **Do not change Supabase queries.**

### Vendor Analytics Page

- `src/pages/vendor/Analytics.jsx` uses **chart.js** (not recharts) and `vendorAnalytics` helpers.
- It fetches orders, products, reviews from Supabase and processes them with vendorAnalytics functions.
- **Do not change chart data building logic.**
- **Do not change Supabase queries.**

### Two Analytics Tracking Systems

- **`src/services/analytics.js`** — privacy-friendly, self-hosted analytics (no cookies). Active in production only.
- **`src/services/googleAnalytics.js`** — Google Analytics 4 (GA4). Active in production only.
- Both systems track page views, events, and e-commerce. They are **independent** and **complementary**.
- **Do not merge or change either tracking system.**

### Export Utilities

- `csvExport`, `excelExport`, `pdfExport` are generic utilities — they do not contain analytics-specific logic.
- They are re-exported from analytics because they are primarily used by report pages.
- `csvExport` is also used by `CommissionManagement.jsx` (commissions module) and `Payouts.jsx`.
- **Do not change export behavior.**

### Supabase Tables Read by Analytics

- `orders` — order data for stats, reports, charts
- `order_items` — order line items for top products
- `products` — product data for inventory reports and top products
- `profiles` — user data for user reports and name resolution
- `deliveries` — delivery data for driver performance
- `reviews` — review data for ratings trend
- **Do not modify schema or RLS policies.**

### `analyticsApi` Location

- `analyticsApi` is defined in `src/services/api.js` (713 lines) alongside other APIs (ordersApi, vendorsApi, usersApi, etc.).
- It is **not** a separate file. Extracting it would require careful splitting of api.js.
- **Do not extract analyticsApi from api.js in this phase.** Documented as migration candidate MC6.
