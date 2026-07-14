/**
 * Checkout Module — Stores Layer (placeholder)
 *
 * No dedicated checkout store exists yet.
 * Checkout state is currently managed locally in CheckoutSimplified.jsx
 * using useState (shipping info, payment method, delivery selection, etc.).
 *
 * Cart state is owned by the cart module (useCartStore).
 * Checkout consumes cart contents read-only through useCartStore.
 *
 * Migration candidates (future sprints):
 * - Extract checkout form state into a dedicated Zustand store
 * - Separate checkout step navigation state
 */
