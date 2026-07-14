/**
 * Reviews Module — Domain Layer (re-export)
 *
 * Re-exports review-related domain logic, rating calculation helpers,
 * and review summary builders.
 * No business logic changes.
 */

// ── Rating summary and review domain helpers ──────────────────────────────
export {
  buildReviewSummary,
} from '../api/reviewService'
