/**
 * src/services/api.js — Backward-compatible re-export (Phase 4.7)
 *
 * The original 713-line monolith has been split into individual API files
 * under src/services/apis/. This file re-exports them so that all existing
 * imports from '@/services/api' continue to work unchanged.
 *
 * Split files:
 *   - src/services/apis/productsApi.js  → productsApi
 *   - src/services/apis/ordersApi.js    → ordersApi
 *   - reviewsApi                        → from @/modules/reviews (stub deleted Phase 6.33)
 *   - src/services/apis/vendorsApi.js   → vendorsApi
 *   - src/services/apis/usersApi.js     → usersApi
 *   - src/services/apis/analyticsApi.js → analyticsApi
 *
 * No behavior changes. All Supabase queries, retry logic, and return shapes
 * are preserved exactly in the split files.
 */

export { productsApi } from './apis/productsApi'
export { ordersApi } from './apis/ordersApi'
export { reviewsApi } from '@/modules/reviews'
export { vendorsApi } from './apis/vendorsApi'
export { usersApi } from './apis/usersApi'
export { analyticsApi } from './apis/analyticsApi'
