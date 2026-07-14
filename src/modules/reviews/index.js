/**
 * Reviews Module — Public API Entry Point (Phase 4.2)
 *
 * This module exposes existing review functionality through a clean public API.
 * It is a re-export/wrapper layer only — no business logic changes.
 *
 * Public API:
 *   import { reviewsApi, reviewService, useVendorReviews, buildReviewSummary } from '@/modules/reviews'
 *
 * The reviews module owns:
 *   - review records (CRUD via reviewsApi and reviewService)
 *   - review creation (with validation and duplicate check)
 *   - review reading/listing (by vendor, deleted)
 *   - review soft delete and restore
 *   - vendor reply to reviews
 *   - rating summary calculation (buildReviewSummary)
 *   - review-related React Query hooks
 *   - review realtime subscriptions if present
 *
 * The reviews module does NOT own:
 *   - product CRUD
 *   - order lifecycle
 *   - checkout
 *   - payments
 *   - delivery
 *   - marketplace page composition
 *   - admin dashboard composition
 *
 * Allowed dependencies:
 *   - shared, catalog (public API only), orders (public API only),
 *     users (public API only), utils, config, lib/supabase
 *
 * Forbidden dependencies:
 *   - checkout internals, payments internals, delivery internals,
 *     admin dashboard composition
 */

// ── API ──────────────────────────────────────────────────────────────────
export {
  reviewsApi,
  reviewService,
  buildReviewSummary,
} from './api'

// ── Domain ───────────────────────────────────────────────────────────────
export {
  buildReviewSummary as domainBuildReviewSummary,
} from './domain'

// ── Hooks ────────────────────────────────────────────────────────────────
export {
  reviewKeys,
  useVendorReviews,
  useDeletedReviews,
  useCreateReview,
  useDeleteReview,
  useRestoreReview,
} from './hooks'

// ── Utils ────────────────────────────────────────────────────────────────
export {
  buildReviewSummary as utilsBuildReviewSummary,
} from './utils'
