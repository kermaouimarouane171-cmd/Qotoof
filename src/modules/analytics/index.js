/**
 * Analytics Module — Public API Entry Point (Phase 4.5)
 *
 * This module exposes existing analytics, reporting, and dashboard functionality
 * through a clean public API. It is a re-export/wrapper layer only — no behavior changes.
 *
 * Public API:
 *   import { analyticsApi, vendorAnalytics, reportService, useVendorStats } from '@/modules/analytics'
 *
 * The analytics module owns:
 *   - Analytics APIs (getVendorStats, getAdminStats)
 *   - Vendor analytics helpers (chart data builders, KPI calculations, time bucketing)
 *   - Report APIs (sales, user, inventory, delivery reports)
 *   - Export utilities (CSV, Excel, PDF)
 *   - Privacy-friendly analytics tracking (page views, events, e-commerce)
 *   - Google Analytics tracking (GA4 events)
 *   - Analytics-related React Query hooks (useVendorStats, useAdminStats)
 *
 * The analytics module does NOT own:
 *   - Order lifecycle or status transitions
 *   - Payment provider logic
 *   - Commission calculation ownership
 *   - Product CRUD
 *   - Delivery lifecycle
 *   - Cart state
 *   - Checkout flow
 *   - Auth/session logic
 *   - User profile ownership
 *   - Admin/vendor dashboard composition beyond analytics widgets
 *
 * Allowed dependencies:
 *   - shared, orders (public API only for order facts),
 *     payments (public API only for payment facts),
 *     commissions (public API only for commission facts),
 *     catalog (public API only for product facts),
 *     delivery (public API only for delivery facts),
 *     users (public API only for profile facts),
 *     utils, config, lib/supabase
 *
 * Forbidden dependencies:
 *   - checkout internals, cart internals, payment provider internals,
 *     admin dashboard composition
 */

// ── API ──────────────────────────────────────────────────────────────────
export {
  // analyticsApi — admin/vendor stats from api.js
  analyticsApi,
  // vendorAnalytics helpers — chart data, KPIs, time bucketing
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
  // reportService — report generation
  reportService,
  reportServiceDefault,
  // Export utilities
  csvExport,
  excelExport,
  pdfExport,
  // Privacy-friendly analytics (self-hosted)
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
  analyticsService,
  // Google Analytics (GA4)
  googleAnalytics,
  googleAnalyticsDefault,
  // Analytics utils (wrappers around googleAnalytics)
  trackPageViewGA,
  trackEventGA,
  trackSignUp,
  trackLoginGA,
  trackViewItem,
  trackAddToCartGA,
  trackRemoveFromCartGA,
  trackBeginCheckout,
  trackPurchaseGA,
  trackSearchGA,
  trackProductCreate,
  trackOrderAccepted,
  trackOrderDelivered,
} from './api'

// ── Hooks ────────────────────────────────────────────────────────────────
export {
  useVendorStats,
  useAdminStats,
} from './hooks'
