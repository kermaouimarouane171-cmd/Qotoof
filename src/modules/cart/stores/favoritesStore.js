import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { favoritesApi } from '../api/favorites'
import { supabase } from '@/services/supabase'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

// Helper: Get i18n translation
const getTranslation = (key, fallback) => {
  try {
    const lang = localStorage.getItem('language') || 'en'
    const translations = {
      en: {
        'favorites.added': 'Added to favorites',
        'favorites.removed': 'Removed from favorites',
        'favorites.failed': 'Failed to update favorites',
        'common.loginRequired': 'Please sign in to continue.',
        'favorites.loadError': 'Failed to load favorites',
        'favorites.removeConfirm': 'Remove from favorites?',
        'favorites.removeMessage': 'Are you sure you want to remove this item from your favorites?',
        'favorites.guestSaved': 'Saved to favorites on this device',
      },
      fr: {
        'favorites.added': 'Ajouté aux favoris',
        'favorites.removed': 'Retiré des favoris',
        'favorites.failed': 'Échec de la mise à jour des favoris',
        'common.loginRequired': 'Veuillez vous connecter pour continuer.',
        'favorites.loadError': 'Échec du chargement des favoris',
        'favorites.removeConfirm': 'Retirer des favoris ?',
        'favorites.removeMessage': 'Êtes-vous sûr de vouloir retirer cet article de vos favoris ?',
        'favorites.guestSaved': 'Enregistré dans les favoris sur cet appareil',
      },
      ar: {
        'favorites.added': 'تمت الإضافة إلى المفضلة',
        'favorites.removed': 'تمت الإزالة من المفضلة',
        'favorites.failed': 'فشل تحديث المفضلة',
        'common.loginRequired': 'يرجى تسجيل الدخول للمتابعة.',
        'favorites.loadError': 'فشل تحميل المفضلة',
        'favorites.removeConfirm': 'إزالة من المفضلة؟',
        'favorites.removeMessage': 'هل أنت متأكد من إزالة هذا العنصر من المفضلة؟',
        'favorites.guestSaved': 'تم الحفظ في المفضلة على هذا الجهاز',
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
       * Toggle product favorite with optimistic updates.
       * Supports guest mode (userId = null) by persisting only favoriteIds locally.
       */
      toggleProduct: async (userId, productId) => {
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
          // Add placeholder until API returns (or for guest mode until loadGuestFavorites)
          newFavorites.push({
            product_id: productId,
            product: { id: productId }
          })
        }

        set({ favoriteIds: newFavoriteIds, favorites: newFavorites })

        // Guest mode: local-only toggle
        if (!userId) {
          toast.success(
            isFavorited
              ? getTranslation('favorites.removed', 'Removed from favorites')
              : getTranslation('favorites.guestSaved', 'Saved to favorites on this device')
          )
          return
        }

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
       * Load guest favorites from public products table using local favoriteIds.
       */
      loadGuestFavorites: async () => {
        const { favoriteIds } = get()
        const ids = Array.from(favoriteIds)
        if (ids.length === 0) {
          set({ favorites: [], loading: false, error: null, userId: null })
          return
        }

        set({ loading: true, error: null })
        try {
          const { data, error } = await supabase
            .from('products')
            .select('id, name, price_per_unit, unit_type, is_available, available_quantity, product_images(url, is_primary), vendor:public_vendor_profiles!vendor_id(id, first_name, last_name, store_name, city, avatar_url)')
            .in('id', ids)

          if (error) throw error

          const favorites = (data || []).map((product) => ({
            id: product.id,
            product_id: product.id,
            product,
          }))

          set({
            favorites,
            loading: false,
            error: null,
            userId: null,
          })
        } catch (error) {
          logger.error('Error loading guest favorites:', error)
          set({
            favorites: [],
            loading: false,
            error: error.message || getTranslation('favorites.loadError', 'Failed to load favorites'),
            userId: null,
          })
        }
      },

      /**
       * Sync locally persisted guest favorites to the server after login.
       */
      syncFavoritesToServer: async (userId) => {
        const { favoriteIds } = get()
        const ids = Array.from(favoriteIds)
        if (ids.length === 0) return

        try {
          const { data: existing, error: fetchError } = await supabase
            .from('favorites')
            .select('product_id')
            .eq('user_id', userId)
            .in('product_id', ids)

          if (fetchError) throw fetchError

          const existingIds = new Set((existing || []).map(f => f.product_id))
          const toAdd = ids.filter(id => !existingIds.has(id))

          if (toAdd.length === 0) return

          const rows = toAdd.map(productId => ({ user_id: userId, product_id: productId }))
          const { error: insertError } = await supabase
            .from('favorites')
            .insert(rows)

          if (insertError) throw insertError

          toast.success(getTranslation('favorites.added', 'Added to favorites'))
        } catch (error) {
          logger.error('Error syncing guest favorites to server:', error)
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
