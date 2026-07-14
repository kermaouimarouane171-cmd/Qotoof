/**
 * Reviews Module — UI Layer (re-export)
 *
 * Placeholder: ReviewModal components are not re-exported yet because they
 * are tightly coupled to their parent contexts (orders, buyer).
 *
 * Current review UI lives in:
 *   - src/components/orders/ReviewModal.jsx — base review modal (star rating, comment)
 *   - src/components/buyer/ReviewModal.jsx — buyer wrapper around ReviewModalBase
 *   - src/pages/vendor/Reviews.jsx — vendor review management page (uses reviewService)
 *   - src/pages/admin/Reviews.jsx — admin review moderation page (uses Supabase directly)
 *   - src/pages/ProductDetail.jsx — displays reviews and ratings on product page
 *   - src/pages/OrderDetail.jsx — displays review status on order detail
 *
 * These components/pages are too coupled to their parent contexts to be safely
 * re-exported as reviews module UI. They should remain where they are until
 * a future phase decouples them.
 */
