/**
 * Payments Module — Stores Layer (placeholder)
 *
 * No dedicated payment store exists.
 * Payment state is managed through:
 * - React Query (useCartPaymentQueries.js) for server state
 * - Local component state for payment form UI
 * - useAuthStore for PayPal email/verification status
 *
 * Migration candidates (future sprints):
 * - Extract payment UI state into a dedicated Zustand store
 * - Separate payment method selection state from checkout
 */
