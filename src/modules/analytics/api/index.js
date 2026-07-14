/**
 * Analytics Module — API Layer (re-export)
 *
 * Re-exports analytics-related service functions from existing source files.
 * No behavior changes. No calculation changes. No Supabase query changes.
 * All exports are additive re-exports from existing source files.
 */

// ── analyticsApi from src/services/apis/analyticsApi.js (Phase 4.7 split) ─
// analyticsApi is an object with methods:
//   getVendorStats(vendorId) — fetch vendor stats (totalRevenue, totalOrders, pendingOrders, orders)
//   getAdminStats() — fetch admin stats (totalUsers, totalProducts, totalOrders, totalRevenue)
export { analyticsApi } from '@/services/apis/analyticsApi'

// ── vendorAnalytics from src/services/vendorAnalytics.js ─────────────────
// vendorAnalytics helpers (all exported as named exports):
//   DATE_RANGES, getOrderRevenue, resolveVendorAnalyticsRange, buildTimeBuckets,
//   buildRevenueChartData, buildOrdersChartData, buildRatingsTrendData,
//   buildTopProductMetrics, buildTopProductsChartData, buildCategoryDistributionData,
//   buildStatusBreakdown, calculateVendorAnalyticsMetrics,
//   buildAnalyticsCsvRows, buildAnalyticsPdfSummary
export {
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
} from '@/services/vendorAnalytics'

// ── reportService from src/services/reports/reportService.js ─────────────
// reportService is an object with methods:
//   generateSalesReport, generateUserReport, generateInventoryReport, generateDeliveryReport
export { reportService, reportService as reportServiceDefault } from '@/services/reports/reportService'

// ── Export utilities from src/services/reports/ ──────────────────────────
export { csvExport } from '@/services/reports/csvExport'
export { excelExport } from '@/services/reports/excelExport'
export { pdfExport } from '@/services/reports/pdfExport'

// ── Privacy-friendly analytics from src/services/analytics.js ────────────
// Self-hosted analytics (no cookies): page views, events, e-commerce tracking
export {
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
} from '@/services/analytics'

export { default as analyticsService } from '@/services/analytics'

// ── Google Analytics from src/services/googleAnalytics.js ────────────────
// Google Analytics service (GA4): page views, events, e-commerce tracking
export { googleAnalytics } from '@/services/googleAnalytics'
export { default as googleAnalyticsDefault } from '@/services/googleAnalytics'

// ── Analytics utils from src/utils/analytics.js ──────────────────────────
// Thin wrapper around googleAnalytics service for consistent event naming
export {
  trackPageView as trackPageViewGA,
  trackEvent as trackEventGA,
  trackSignUp,
  trackLogin as trackLoginGA,
  trackViewItem,
  trackAddToCart as trackAddToCartGA,
  trackRemoveFromCart as trackRemoveFromCartGA,
  trackBeginCheckout,
  trackPurchase as trackPurchaseGA,
  trackSearch as trackSearchGA,
  trackProductCreate,
  trackOrderAccepted,
  trackOrderDelivered,
} from '@/utils/analytics'
