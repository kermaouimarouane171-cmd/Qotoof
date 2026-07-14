/**
 * Analytics Module — Utils Layer (re-export)
 *
 * Re-exports analytics utility functions from src/utils/analytics.js.
 * These are thin wrappers around googleAnalytics service for consistent event naming.
 *
 * Also re-exports export utilities (csvExport, excelExport, pdfExport) from the api layer
 * since they are utility-like helpers for report generation.
 */

export {
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
} from '../api'
