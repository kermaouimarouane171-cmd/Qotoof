/**
 * APIs barrel — Phase 4.7 split
 *
 * Re-exports all individual API files from src/services/apis/.
 * This barrel is used by src/services/api.js for backward compatibility.
 *
 * Individual API files:
 *   - productsApi.js  → productsApi
 *   - ordersApi.js    → ordersApi
 *   - reviewsApi.js   → reviewsApi
 *   - vendorsApi.js   → vendorsApi
 *   - usersApi.js     → usersApi
 *   - analyticsApi.js → analyticsApi
 */

export { productsApi } from './productsApi'
export { ordersApi } from './ordersApi'
export { reviewsApi } from './reviewsApi'
export { vendorsApi } from './vendorsApi'
export { usersApi } from './usersApi'
export { analyticsApi } from './analyticsApi'
