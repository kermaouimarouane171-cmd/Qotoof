// ============================================
// Cart Module — Stores Public API
// Re-exports cart and favorites Zustand stores.
// No files were moved — this is a re-export layer.
// ============================================

// Cart store (Zustand + persist)
// Persist key: 'cart-storage' (version 4)
// State: items, lastValidated, checkoutVendorId, _hasHydrated
// Actions: addItem, removeItem, updateQuantity, clearCart,
//          setCheckoutVendor, clearCheckoutVendor, clearVendorItems,
//          getCheckoutItems, validateCart
// Getters: getItemCount, getTotalQuantity, getSubtotal, getTotal,
//          getTax, getVendorCount
export { useCartStore, useCartHydrated } from './cartStore'

// Favorites store (Zustand + persist)
// Persist key: 'favorites-storage'
// State: favorites, loading, error, favoriteIds (Set), userId
// Actions: loadFavorites, toggleProduct, isFavorited,
//          getFavoriteProducts, getFavoriteVendors, getCount, clearFavorites
export { useFavoritesStore } from './favoritesStore'
