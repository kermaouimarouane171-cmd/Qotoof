import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { favoritesApi } from '@/services/favorites'
import toast from 'react-hot-toast'
import { logger } from '../utils/logger.js'

// Helper: Get i18n translation
const getTranslation = (key, fallback) => {
  try {
    const lang = localStorage.getItem('language') || 'en'
    const translations = {
      en: {
        'favorites.added': 'Added to favorites',
        'favorites.removed': 'Removed from favorites',
        'favorites.failed': 'Failed to update favorites',
        'favorites.loginRequired': 'Please login to add favorites',
        'favorites.loadError': 'Failed to load favorites',
        'favorites.removeConfirm': 'Remove from favorites?',
        'favorites.removeMessage': 'Are you sure you want to remove this item from your favorites?',
      },
      fr: {
        'favorites.added': 'Ajouté aux favoris',
        'favorites.removed': 'Retiré des favoris',
        'favorites.failed': 'Échec de la mise à jour des favoris',
        'favorites.loginRequired': 'Veuillez vous connecter pour ajouter des favoris',
        'favorites.loadError': 'Échec du chargement des favoris',
        'favorites.removeConfirm': 'Retirer des favoris ?',
        'favorites.removeMessage': 'Êtes-vous sûr de vouloir retirer cet article de vos favoris ?',
      },
      ar: {
        'favorites.added': 'تمت الإضافة إلى المفضلة',
        'favorites.removed': 'تمت الإزالة من المفضلة',
        'favorites.failed': 'فشل تحديث المفضلة',
        'favorites.loginRequired': 'يرجى تسجيل الدخول لإضافة المفضلة',
        'favorites.loadError': 'فشل تحميل المفضلة',
        'favorites.removeConfirm': 'إزالة من المفضلة؟',
        'favorites.removeMessage': 'هل أنت متأكد من إزالة هذا العنصر من المفضلة؟',
      }
    }
    return translations[lang]?.[key] || translations.en[key] || fallback
  } catch {
    return fallback
  }
}

export const useFavoritesStore = create(
  persist(
    (set, get) => ({
      favorites: [],
      loading: false,
      error: null,
      favoriteIds: new Set(),
      userId: null, // Track which user the favorites belong to

      /**
       * Load user favorites from server
       * Validates userId to prevent cross-user data leakage
       */
      loadFavorites: async (userId) => {
        const currentState = get()
        
        // Clear favorites if user changed
        if (currentState.userId && currentState.userId !== userId) {
          set({ favorites: [], favoriteIds: new Set(), userId: null, error: null })
        }

        set({ loading: true, error: null })
        try {
          const data = await favoritesApi.getUserFavorites(userId)
          const favoriteIds = new Set(
            data.filter(f => f.product_id).map(f => f.product_id)
          )
          set({
            favorites: data,
            favoriteIds,
            loading: false,
            userId,
            error: null
          })
        } catch (error) {
          logger.error('Error loading favorites:', error)
          // Clear favoriteIds on error to prevent stale heart icons
          set({
            favorites: [],
            favoriteIds: new Set(),
            loading: false,
            error: error.message || getTranslation('favorites.loadError', 'Failed to load favorites'),
            userId
          })
        }
      },

      /**
       * Toggle product favorite with optimistic updates
       */
      toggleProduct: async (userId, productId) => {
        if (!userId) {
          toast.error(getTranslation('favorites.loginRequired', 'Please login to add favorites'))
          return
        }

        const { favoriteIds, favorites } = get()
        const isFavorited = favoriteIds.has(productId)

        // Optimistic update
        const newFavoriteIds = new Set(favoriteIds)
        let newFavorites = [...favorites]

        if (isFavorited) {
          newFavoriteIds.delete(productId)
          newFavorites = favorites.filter(f => f.product_id !== productId)
        } else {
          newFavoriteIds.add(productId)
          // Add placeholder until API returns
          newFavorites.push({ 
            product_id: productId, 
            product: { id: productId } 
          })
        }

        set({ favoriteIds: newFavoriteIds, favorites: newFavorites })

        try {
          if (isFavorited) {
            // Remove from favorites
            const favorite = favorites.find(f => f.product_id === productId)
            if (favorite) {
              await favoritesApi.remove(favorite.id)
            }
            toast.success(getTranslation('favorites.removed', 'Removed from favorites'))
          } else {
            // Add to favorites
            const result = await favoritesApi.addProduct(userId, productId)
            
            // Update placeholder with real data
            set((state) => ({
              favorites: state.favorites.map(f => 
                f.product_id === productId && !f.product?.name ? result : f
              )
            }))
            
            toast.success(getTranslation('favorites.added', 'Added to favorites'))
          }
        } catch (error) {
          logger.error('Error toggling favorite:', error)
          
          // Rollback optimistic update
          set({ favoriteIds, favorites })
          toast.error(getTranslation('favorites.failed', 'Failed to update favorites'))
        }
      },

      /**
       * Check if product is favorited
       */
      isFavorited: (productId) => {
        return get().favoriteIds.has(productId)
      },

      /**
       * Get favorite products only (exclude placeholders without real data)
       */
      getFavoriteProducts: () => {
        return get().favorites.filter(f =>
          f.product && f.product_id && f.product?.name // Exclude placeholders
        )
      },

      /**
       * Get favorite vendors only
       */
      getFavoriteVendors: () => {
        return get().favorites.filter(f => f.vendor && f.vendor_id)
      },

      /**
       * Get favorites count (for badge) — exclude placeholders
       */
      getCount: () => {
        return get().favorites.filter(f =>
          f.product && f.product_id && f.product?.name
        ).length
      },

      /**
       * Clear favorites (on logout)
       */
      clearFavorites: () => {
        set({ favorites: [], favoriteIds: new Set(), userId: null, error: null })
      }
    }),
    {
      name: 'favorites-storage',
      partialize: (state) => ({
        favoriteIds: Array.from(state.favoriteIds),
        userId: state.userId
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.favoriteIds) {
          state.favoriteIds = new Set(state.favoriteIds)
        }
      }
    }
  )
)
