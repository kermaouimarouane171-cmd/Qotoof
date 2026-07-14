/**
 * Reviews Module — API Layer (re-export)
 *
 * Re-exports review-related API functions from existing source files.
 * No business logic changes. No Supabase query changes.
 * All exports are additive re-exports from existing source files.
 */

// ── reviewsApi from src/modules/reviews/api/reviewsApi.js (moved) ──────────
// reviewsApi owns: create, getByVendor, delete (soft), restore, getDeleted
export {
  reviewsApi,
} from './reviewsApi'

// ── reviewService from src/modules/reviews/api/reviewService.js (moved) ────
// reviewService owns: createReview (with validation + notification),
//   getVendorReviews (with summary), replyToReview (vendor reply),
//   buildReviewSummary (rating aggregation helper)
export {
  buildReviewSummary,
} from './reviewService'

export { default as reviewService } from './reviewService'
