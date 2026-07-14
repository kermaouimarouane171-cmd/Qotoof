// ============================================
// Cart Module — Hooks Public API
// Re-exports cart-related hooks.
// No files were moved — this is a re-export layer.
// ============================================

// Cart hydration hook (checks if persisted cart has been rehydrated)
export { useCartHydrated } from '../stores'

// Note: useCartStore and useFavoritesStore are the primary hooks.
// They are re-exported from stores/index.js since they ARE the stores.
// No additional cart-specific hooks exist yet.
// Future candidates:
// - useCartItems (selector hook)
// - useCartCount (selector hook)
// - useCartSubtotal (selector hook)
// - useCheckoutItems (selector hook)
