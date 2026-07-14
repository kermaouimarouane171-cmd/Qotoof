/**
 * Checkout Module — Public API Entry Point (Phase 3.1)
 *
 * This module exposes existing checkout functionality through a clean public API.
 * It is a re-export/wrapper layer only — no business logic changes.
 *
 * Public API:
 *   import { checkoutService, useCheckoutPricing, calculateOrderTotals } from '@/modules/checkout'
 *
 * Phase 6.17 — Barrel Safety:
 * UI exports (CheckoutPage, CheckoutAddressStep, etc.) removed from root barrel.
 * UI exports remain available via `src/modules/checkout/ui/index.js` for intra-module use.
 * App code imports pages directly via `lazy(() => import('@/pages/CheckoutSimplified'))`
 * and components via `@/components/checkout/...` — not through this barrel.
 * This prevents eager loading of CheckoutSimplified.jsx (1696 lines) when importing
 * lightweight symbols (APIs, hooks, utils).
 *
 * Allowed dependencies:
 *   - shared, cart (public API), orders (public API), delivery (public API),
 *     users (public API), catalog (public API), utils, config, lib/supabase
 *
 * Forbidden dependencies:
 *   - payments internals, delivery internals, admin dashboard composition
 */

// ── API ──────────────────────────────────────────────────────────────────
export {
  calculateOrderTotals,
  calculateCheckoutPricing,
  createCheckoutOrder,
  couponsApi,
  normalizeCoupon,
  isCouponCurrentlyActive,
  calculateCouponDiscountAmount,
  calculateBulkDiscountBreakdown,
  buildMinimumOrderMessage,
  evaluateVendorMinimumOrders,
} from './api'

// ── Domain ───────────────────────────────────────────────────────────────
export { rollbackCheckoutRecords } from './domain'

// ── Hooks ────────────────────────────────────────────────────────────────
export { useCheckoutPricing, calculatePricing } from './hooks'

// ── Utils ────────────────────────────────────────────────────────────────
export { rollbackCheckoutRecords as rollbackCheckout } from './utils'
