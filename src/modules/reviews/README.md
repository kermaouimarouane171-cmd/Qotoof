# Reviews Module

## Purpose

The reviews module encapsulates all review-related functionality:
- Review records CRUD (create, read, soft delete, restore)
- Review creation with validation (duplicate check, rating range 1–5)
- Review listing by vendor with pagination
- Deleted reviews listing (admin moderation)
- Vendor reply to reviews
- Rating summary calculation (average, replied count, pending, low rating count)
- Review-related React Query hooks
- Vendor notification on new review

## Current Status: Re-export Foundation Only

This module is currently a **re-export layer**. No source files have been moved.
The re-exports point to existing files in `src/services/` and `src/hooks/queries/`.

**Source files:**
- `src/services/api.js` — contains `reviewsApi` (lines 421–502)
- `src/services/reviewService.js` — contains `reviewService` and `buildReviewSummary` (205 lines)
- `src/hooks/queries/useReviewQueries.js` — contains review hooks (73 lines)

## Public API

```js
import {
  // API — Service functions
  reviewsApi,
  reviewService,
  buildReviewSummary,

  // Hooks — React Query
  reviewKeys,
  useVendorReviews,
  useDeletedReviews,
  useCreateReview,
  useDeleteReview,
  useRestoreReview,
} from '@/modules/reviews'
```

### `reviewsApi` Methods (from `src/services/api.js`)

- `create(review)` — insert a new review record
- `getByVendor(vendorId, filters)` — get reviews for a vendor with pagination
- `delete(id)` — soft delete a review (sets `deleted_at`)
- `restore(id)` — restore a soft-deleted review (clears `deleted_at`)
- `getDeleted()` — get all soft-deleted reviews (admin moderation)

### `reviewService` Methods (from `src/services/reviewService.js`)

- `createReview({ orderId, productId, vendorId, userId, rating, comment })` — create review with validation, duplicate check, and vendor notification
- `getVendorReviews(vendorId, { page, pageSize })` — get vendor reviews with summary
- `replyToReview({ reviewId, vendorId, replyText })` — vendor replies to a review

### Domain Helpers

- `buildReviewSummary(reviews)` — calculates `{ totalReviews, averageRating, repliedCount, pendingReplyCount, lowRatingCount }`

### Hooks (from `src/hooks/queries/useReviewQueries.js`)

- `reviewKeys` — query key factory (`all`, `byVendor(vendorId)`, `deleted()`)
- `useVendorReviews(vendorId, options)` — fetch vendor reviews
- `useDeletedReviews(options)` — fetch deleted reviews
- `useCreateReview()` — create review mutation
- `useDeleteReview()` — soft delete review mutation
- `useRestoreReview()` — restore review mutation

## What Belongs in Reviews

- Review CRUD operations (create, read, soft delete, restore)
- Review validation (rating range, duplicate check)
- Review listing by vendor with pagination
- Deleted reviews listing for moderation
- Vendor reply to reviews
- Rating summary calculation
- Review-related React Query hooks and query keys
- Review notifications (vendor notification on new review)

## What Does NOT Belong in Reviews

- **Product CRUD** — owned by `catalog` module. Reviews reference `product_id` but do not own product data.
- **Order lifecycle** — owned by `orders` module. Reviews reference `order_id` but do not own order status transitions.
- **Checkout** — owned by `checkout` module. Reviews are not part of checkout flow.
- **Payments** — owned by `payments` module.
- **Delivery** — owned by `delivery` module.
- **Marketplace page composition** — owned by `marketplace` module. Marketplace displays reviews but does not own review data.
- **Auth/session logic** — owned by `auth` module. Reviews reads user identity from `useAuthStore`.
- **User profile ownership** — owned by `users` module. Reviews display buyer names/photos via joins but do not own profiles.
- **Admin dashboard composition** — not a reviews concern.

---

## Relationship with Catalog / Products

- Catalog **owns** products. Reviews reference `product_id` to associate a review with a product.
- Reviews **does not** own product CRUD or product display.
- `ProductDetail.jsx` imports `reviewService` to display reviews and ratings on the product page.
- `buildReviewSummary` is used to display aggregate ratings.
- **Do not change `ProductDetail.jsx`** in this phase.

## Relationship with Marketplace

- Marketplace **displays** reviews and ratings on product and store pages.
- Review hooks are available from `@/modules/reviews`. The old `@/hooks/queries/useReviewQueries` stub was deleted in Phase 6.33.

## Relationship with Orders

- Orders **determine** whether a buyer can review an order/product (eligibility check).
- `reviewService.createReview()` accepts `orderId` and `productId` to link reviews to orders.
- `OrderDetail.jsx` imports `reviewService` to display review status.
- `buyer/Orders.jsx` imports `reviewService` and `ReviewModal` to allow buyers to submit reviews.
- Reviews **does not** own order lifecycle or order status transitions.
- **Do not change order pages** in this phase.

## Relationship with Users

- Reviews display buyer names/photos via Supabase joins on `profiles` table.
- Reviews **does not** own user profiles or profile data.
- `reviewService.createReview()` accepts `userId` to associate a review with a buyer.

## Relationship with Vendor Pages

- `src/pages/vendor/Reviews.jsx` — vendor review management page.
- This page uses `reviewService` for fetching reviews and replying to them.
- **Do not move this page** in this phase. It is a migration candidate for a future sprint.

## Relationship with Admin Pages

- `src/pages/admin/Reviews.jsx` (470 lines) — admin review moderation page.
- This page uses **Supabase directly** (not `reviewsApi` or `reviewService`) for CRUD operations.
- This is a known inconsistency — the page should eventually use the service layer.
- **Do not move this page** in this phase. It is a migration candidate for a future sprint.

---

## Module Structure

```
src/modules/reviews/
├── index.js          # Public API entry point
├── api/
│   └── index.js      # reviewsApi, reviewService, buildReviewSummary
├── data/
│   └── index.js      # Placeholder (reviewsApi/reviewService are closest to data layer)
├── domain/
│   └── index.js      # buildReviewSummary (rating aggregation)
├── ui/
│   └── index.js      # Placeholder (ReviewModal and pages not re-exported yet)
├── hooks/
│   └── index.js      # reviewKeys, useVendorReviews, useDeletedReviews, useCreateReview, useDeleteReview, useRestoreReview
├── stores/
│   └── index.js      # Placeholder (no dedicated review store)
├── utils/
│   └── index.js      # buildReviewSummary (aliased)
└── README.md         # This file
```

---

## Allowed Dependencies

- `shared` — shared utilities and components
- `catalog` — public API only (for product data if needed)
- `orders` — public API only (for order eligibility if needed)
- `users` — public API only (for reviewer profile display)
- `utils` — utility functions (logger, etc.)
- `config` — configuration constants
- `lib/supabase` — Supabase client

## Forbidden Dependencies

- `checkout` internals — checkout flow is not a reviews concern
- `payments` internals — payment provider logic is not a reviews concern
- `delivery` internals — delivery logic is not a reviews concern
- `admin` dashboard composition — not a reviews concern

---

## Migration Candidates for Future Sprints

| # | Item | Current Location | Target | Risk | Recommended Phase |
|---|---|---|---|---|---|
| MC1 | `reviewsApi` in `src/services/api.js` (lines 421–502) | `src/services/api.js` | `src/modules/reviews/api/` | Medium — part of a mixed API file | Phase 4.3+ |
| MC2 | `src/services/reviewService.js` (205 lines) | `src/services/` | `src/modules/reviews/api/` | Medium — used by ProductDetail, OrderDetail, buyer/Orders, vendor/Reviews | Phase 4.3+ |
| MC3 | `src/hooks/queries/useReviewQueries.js` (73 lines) | `src/hooks/queries/` | `src/modules/reviews/hooks/` | Low — clean, focused file | Phase 4.3+ |
| MC4 | `src/components/orders/ReviewModal.jsx` (113 lines) | `src/components/orders/` | `src/modules/reviews/ui/` | Medium — used by buyer/Orders.jsx | Phase 4.3+ |
| MC5 | `src/components/buyer/ReviewModal.jsx` | `src/components/buyer/` | `src/modules/reviews/ui/` | Low — thin wrapper around ReviewModalBase | Phase 4.3+ |
| MC6 | `src/pages/vendor/Reviews.jsx` | `src/pages/vendor/` | `src/modules/reviews/ui/` | High — uses reviewService, tightly coupled to vendor context | Phase 4.4+ |
| MC7 | `src/pages/admin/Reviews.jsx` (470 lines) | `src/pages/admin/` | `src/modules/reviews/ui/` | High — uses Supabase directly, 470 lines | Phase 4.4+ |
| MC8 | Remove review re-exports from marketplace module | `src/modules/marketplace/hooks/index.js` | Remove re-export, consumers import from `@/modules/reviews` | Low — but requires updating all consumers | Phase 4.3+ |
| MC9 | Consolidate `reviewsApi` and `reviewService` into a single reviews API | Two separate services | One unified `reviewsApi` | Medium — different APIs with overlapping functionality | Phase 4.4+ |

---

## Safety Notes

### Rating Calculations

- `buildReviewSummary` is **unchanged**. It calculates `averageRating`, `totalReviews`, `repliedCount`, `pendingReplyCount`, and `lowRatingCount`.
- Any change to this function could affect rating display on product pages, store pages, and vendor dashboards.
- **Do not modify rating formulas** without thorough testing.

### Review Eligibility

- `reviewService.createReview()` checks for duplicate reviews (same vendor + user + order + product).
- It validates rating range (1–5).
- It notifies the vendor via `notifyVendorAboutReview()` which uses `supabase.rpc('create_user_notification', ...)` with a fallback direct insert.
- **Do not modify eligibility logic** without thorough testing of order flow.

### Two Review APIs

- There are **two** review APIs in the codebase:
  1. `reviewsApi` in `src/services/api.js` — simpler CRUD (create, getByVendor, delete, restore, getDeleted)
  2. `reviewService` in `src/services/reviewService.js` — richer (createReview with validation + notification, getVendorReviews with summary, replyToReview)
- These are separate APIs with overlapping functionality. This is a known inconsistency.
- **Do not merge them** in this phase. Document as migration candidate MC9.

### Supabase Tables

- `reviews` table — stores review records (rating, comment, vendor_id, user_id, order_id, product_id, vendor_reply, etc.)
- Reviews reference `profiles` (buyer info) and `products` (product info) via joins.
- **Do not modify schema or RLS policies.**
