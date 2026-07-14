/**
 * Coupons Module — UI Layer (re-export)
 *
 * Placeholder: No coupon-specific UI components are safe to re-export yet.
 *
 * Current coupon UI lives in:
 *   - src/pages/buyer/Coupons.jsx — buyer coupon list page (uses couponsApi)
 *   - src/pages/vendor/Coupons.jsx — vendor coupon management page (uses supabase directly)
 *   - src/components/checkout/OrderSummary.jsx — displays coupon discounts in checkout
 *   - src/components/checkout/CheckoutSummary.jsx — displays coupon discounts in checkout
 *
 * These pages/components are too coupled to their parent contexts (buyer/vendor/checkout)
 * to be safely re-exported as coupons module UI. They should remain where they are
 * until a future phase decouples them.
 */
