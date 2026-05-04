import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { HeartIcon, ShoppingBagIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import { useFavoritesStore } from '@/store/favoritesStore'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { favoritesApi } from '@/services/favorites'
import { formatPrice } from '@/utils/currency'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { logger } from '@/utils/logger'

const FavoritesPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { 
    favorites, 
    loading, 
    error, 
    loadFavorites, 
    getFavoriteProducts, 
    getFavoriteVendors,
    toggleProduct 
  } = useFavoritesStore()
  const { addItem } = useCartStore()
  const [activeTab, setActiveTab] = useState('products')
  const [removeConfirm, setRemoveConfirm] = useState(null)
  const subscriptionRef = useRef(null)

  useEffect(() => {
    if (user) {
      loadFavorites(user.id)

      // Set up real-time subscription for cross-tab sync
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }

      subscriptionRef.current = favoritesApi.subscribe(user.id, (payload) => {
        logger.info('Favorites real-time update:', payload.eventType)
        // Re-fetch favorites from server when changes occur
        loadFavorites(user.id)
      })
    }

    // Cleanup subscription on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
        subscriptionRef.current = null
      }
    }
  }, [user, loadFavorites])

  const handleRemoveFavorite = (favId, itemName) => {
    setRemoveConfirm({ id: favId, name: itemName })
  }

  const confirmRemove = async () => {
    if (removeConfirm) {
      await toggleProduct(user.id, removeConfirm.id)
      setRemoveConfirm(null)
    }
  }

  const handleAddToCart = (product) => {
    if (!product.is_available) {
      toast.error('This product is currently out of stock')
      return
    }
    addItem(product, product.min_order_quantity || 1)
  }

  const handleImageError = (e) => {
    e.target.style.display = 'none'
    const placeholder = e.target.parentElement.querySelector('.image-placeholder')
    if (placeholder) placeholder.style.display = 'flex'
  }

  const favoriteProducts = getFavoriteProducts()
  const favoriteVendors = getFavoriteVendors()

  if (!user) {
    navigate('/login')
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-pink-600 rounded-xl flex items-center justify-center">
              <HeartSolid className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('favorites.title', 'My Favorites')}</h1>
              <p className="text-sm text-gray-500">
                {t('favorites.subtitle', '{{count}} saved items', { count: favoriteProducts.length + favoriteVendors.length })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-fit">
          <button
            onClick={() => setActiveTab('products')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'products'
                ? 'bg-green-500 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            role="tab"
            aria-selected={activeTab === 'products'}
          >
            {t('favorites.products', 'Products')} ({favoriteProducts.length})
          </button>
          <button
            onClick={() => setActiveTab('vendors')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeTab === 'vendors'
                ? 'bg-green-500 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            role="tab"
            aria-selected={activeTab === 'vendors'}
          >
            {t('favorites.vendors', 'Vendors')} ({favoriteVendors.length})
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button
              onClick={() => user && loadFavorites(user.id)}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
          </div>
        ) : activeTab === 'products' ? (
          favoriteProducts.length === 0 && !error ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <HeartIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {t('favorites.noProducts', 'No favorite products yet')}
              </h3>
              <p className="text-gray-500 mb-6">
                {t('favorites.browseMarketplace', 'Browse the marketplace and click the heart icon to save products')}
              </p>
              <button
                onClick={() => navigate('/marketplace')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors"
              >
                <ShoppingBagIcon className="w-5 h-5" />
                {t('favorites.browseNow', 'Browse Now')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {favoriteProducts.map((fav) => {
                const product = fav.product
                if (!product) return null
                
                const isOutOfStock = product.is_available === false
                const isLowStock = product.available_quantity !== null && product.available_quantity <= 5
                const productImages = product.product_images || product.images || []
                const primaryImage = productImages.find(img => img.is_primary) || productImages[0]

                return (
                  <div
                    key={fav.id}
                    className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300"
                  >
                    {/* Image */}
                    <div
                      className="relative aspect-[4/3] overflow-hidden bg-gray-100 cursor-pointer"
                      onClick={() => navigate(`/product/${product.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          navigate(`/product/${product.id}`)
                        }
                      }}
                      aria-label={`View ${product.name} details`}
                    >
                      {/* Out of Stock Overlay */}
                      {isOutOfStock && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
                          <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                            Out of Stock
                          </span>
                        </div>
                      )}
                      
                      {/* Low Stock Badge */}
                      {isLowStock && !isOutOfStock && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className="bg-orange-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                            <ExclamationTriangleIcon className="w-3 h-3" />
                            Only {product.available_quantity} left
                          </span>
                        </div>
                      )}

                      {primaryImage ? (
                        <>
                          <img
                            src={primaryImage.url}
                            alt={product.name}
                            className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
                            loading="lazy"
                            onError={handleImageError}
                          />
                          <div className="image-placeholder hidden w-full h-full absolute inset-0 items-center justify-center text-gray-300 bg-gray-100">
                            <span className="text-5xl">🌱</span>
                          </div>
                        </>
                      ) : (
                        <div className="image-placeholder w-full h-full flex items-center justify-center text-gray-300">
                          <span className="text-5xl">🌱</span>
                        </div>
                      )}

                      {/* Remove Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveFavorite(fav.id, product.name)
                        }}
                        className="absolute top-3 right-3 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:bg-red-50 transition-all z-20"
                        aria-label={`Remove ${product.name} from favorites`}
                      >
                        <TrashIcon className="w-5 h-5 text-red-500" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                      <h3
                        className="font-semibold text-gray-900 line-clamp-2 mb-2 cursor-pointer hover:text-green-600 transition-colors"
                        onClick={() => navigate(`/product/${product.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            navigate(`/product/${product.id}`)
                          }
                        }}
                      >
                        {product.name}
                      </h3>

                      {/* Vendor */}
                      {product.vendor && (
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-[10px] font-bold">
                              {product.vendor.first_name?.[0]}{product.vendor.last_name?.[0]}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 truncate">
                            {product.vendor.first_name} {product.vendor.last_name}
                          </span>
                        </div>
                      )}

                      {/* Price */}
                      <div className="flex items-end justify-between pt-3 border-t border-gray-100">
                        <div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold text-gray-900">{formatPrice(product.price_per_unit)}</span>
                            <span className="text-sm text-gray-400">/{product.unit_type}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAddToCart(product)}
                          disabled={isOutOfStock}
                          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                            isOutOfStock
                              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-green-500 hover:bg-green-600 text-white'
                          }`}
                          aria-label={isOutOfStock ? `${product.name} is out of stock` : `Add ${product.name} to cart`}
                        >
                          {isOutOfStock ? 'Out of Stock' : t('favorites.addToCart', 'Add to Cart')}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        ) : (
          favoriteVendors.length === 0 && !error ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <ShoppingBagIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {t('favorites.noVendors', 'No favorite vendors yet')}
              </h3>
              <p className="text-gray-500 mb-6">
                {t('favorites.saveVendors', 'Save your favorite vendors for quick access')}
              </p>
              <button
                onClick={() => navigate('/stores')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors"
              >
                <ShoppingBagIcon className="w-5 h-5" />
                {t('favorites.browseStores', 'Browse Stores')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {favoriteVendors.map((fav) => {
                const vendor = fav.vendor
                if (!vendor) return null

                return (
                  <div
                    key={fav.id}
                    className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                          <span className="text-white text-lg font-bold">
                            {vendor.first_name?.[0]}{vendor.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {vendor.store_name || `${vendor.first_name} ${vendor.last_name}`}
                          </h3>
                          {vendor.city && (
                            <p className="text-sm text-gray-500">📍 {vendor.city}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveFavorite(fav.id, vendor.store_name || `${vendor.first_name} ${vendor.last_name}`)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-2"
                        aria-label={`Remove ${vendor.store_name || `${vendor.first_name} ${vendor.last_name}`} from favorites`}
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>

                    {vendor.store_description && (
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {vendor.store_description}
                      </p>
                    )}

                    <button
                      onClick={() => navigate(`/marketplace?vendorId=${vendor.id}`)}
                      className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                    >
                      {t('favorites.viewProducts', 'View Products')}
                    </button>
                  </div>
                )
              })}
            </div>
          )
        )}
      </div>

      {/* Remove Confirmation Modal */}
      {removeConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('favorites.removeConfirm', 'Remove from favorites?')}
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {t('favorites.removeMessage', 'Are you sure you want to remove this item from your favorites?')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRemoveConfirm(null)}
                className="btn-outline flex-1"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                className="btn-primary flex-1 bg-red-600 hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default FavoritesPage
