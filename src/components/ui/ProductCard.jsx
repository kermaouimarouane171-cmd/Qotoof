import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatPrice } from '@/utils/currency'
import { MapPinIcon, HeartIcon as HeartOutline } from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid, HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import { useCartStore } from '@/modules/cart'
import { useFavoritesStore } from '@/modules/cart'
import { useAuthStore } from '@/store/authStore'
import queryClient from '@/services/queryClient'

const ProductCard = ({ product }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { addItem } = useCartStore()
  const { toggleProduct, isFavorited } = useFavoritesStore()
  const { user } = useAuthStore()
  const imageList = product.images?.length ? product.images : product.product_images
  const primaryImage = imageList?.find(img => img.is_primary) || imageList?.[0]
  const favorited = isFavorited(product.id)
  const rating = Number(product.average_rating ?? product.rating ?? 0)
  const reviewsCount = Number(product.reviews_count ?? 0)

  // Discount calculation
  const price = Number(product.price_per_unit ?? 0)
  const compareAtPrice = Number(product.compare_at_price ?? product.original_price ?? 0)
  const hasDiscount = compareAtPrice > 0 && compareAtPrice > price
  const discountPercent = hasDiscount
    ? Math.round(((compareAtPrice - price) / compareAtPrice) * 100)
    : 0

  // Free shipping flag (if product has free shipping or vendor offers it)
  const hasFreeShipping = Boolean(product.free_shipping ?? product.is_free_shipping ?? false)

  const openProductDetails = () => {
    navigate(`/product/${product.id}`)
  }

  const prefetchProductDetails = async () => {
    if (!product?.id) return

    try {
      const { fetchProductById } = await import('@/modules/catalog')

      queryClient.prefetchQuery({
        queryKey: ['product', product.id],
        queryFn: () => fetchProductById(product.id),
        staleTime: 5 * 60 * 1000,
      })
    } catch {
      // Ignore prefetch failures to keep card interactions non-blocking.
    }
  }

  const handleCardKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openProductDetails()
    }
  }

  const handleQuickAdd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    addItem(product, product.min_order_quantity)
  }

  const handleToggleFavorite = async (e) => {
    e.preventDefault()
    e.stopPropagation()

    await toggleProduct(user?.id || null, product.id)
  }

  return (
    <div
      data-testid="product-card"
      className="group block cursor-pointer"
      onClick={openProductDetails}
      onMouseEnter={prefetchProductDetails}
      onFocus={prefetchProductDetails}
      onKeyDown={handleCardKeyDown}
      role="link"
      tabIndex={0}
    >
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
        {/* Image — 1:1 square like Etsy */}
        <div className="relative aspect-square overflow-hidden bg-gray-100">
          {primaryImage ? (
            <img
              src={primaryImage.url}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <span className="text-5xl">🌱</span>
            </div>
          )}

          {/* Discount Badge — top left */}
          {hasDiscount && (
            <div className="absolute top-2.5 left-2.5">
              <span className="inline-flex items-center px-2 py-1 rounded-lg bg-red-500 text-white text-xs font-bold shadow-sm">
                -{discountPercent}%
              </span>
            </div>
          )}

          {/* Free Shipping Badge — below discount or top left */}
          {hasFreeShipping && !hasDiscount && (
            <div className="absolute top-2.5 left-2.5">
              <span className="inline-flex items-center px-2 py-1 rounded-lg bg-green-600/90 backdrop-blur-sm text-white text-xs font-semibold shadow-sm">
                {t('product.card.freeShipping', 'شحن مجاني')}
              </span>
            </div>
          )}

          {/* Favorite Button — top right (always visible on mobile, hover on desktop) */}
          <div className="absolute top-2.5 right-2.5">
            <button
              onClick={handleToggleFavorite}
              className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
              aria-label={favorited ? t('favorites.removeFavorite', 'Remove from favorites') : t('favorites.addFavorite', 'Add to favorites')}
              aria-pressed={favorited}
            >
              {favorited ? (
                <HeartSolid className="w-4 h-4 text-red-500" />
              ) : (
                <HeartOutline className="w-4 h-4 text-gray-700 hover:text-red-500" />
              )}
            </button>
          </div>

          {/* Out of Stock Overlay */}
          {!product.is_available && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="px-3 py-1.5 bg-white rounded-lg text-sm font-semibold text-gray-900">
                {t('product.card.outOfStock', 'Out of Stock')}
              </span>
            </div>
          )}
        </div>

        {/* Content — Etsy style: minimal, clean */}
        <div className="p-3 sm:p-4">
          {/* Seller name — clickable, Etsy style */}
          {product.vendor && (
            <Link
              to={`/vendor/public/${product.vendor_id}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 mb-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              <span className="truncate font-medium">
                {product.vendor.store_name || `${product.vendor.first_name} ${product.vendor.last_name}`}
              </span>
              {product.vendor.is_verified && (
                <span className="inline-flex items-center text-primary-600 flex-shrink-0" title={t('product.card.verified', 'Verified vendor')}>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
              {product.vendor.is_paid_vendor && !product.vendor.is_verified && (
                <span className="inline-flex items-center text-green-600 flex-shrink-0" title={t('product.card.paidVendor', 'موثّق')}>
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
              {product.vendor.city && (
                <>
                  <span className="text-gray-300">•</span>
                  <MapPinIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{product.vendor.city}</span>
                </>
              )}
            </Link>
          )}

          {/* Product Name — 2 lines max */}
          <h3 className="font-medium text-gray-900 line-clamp-2 mb-1.5 text-sm group-hover:text-primary-600 transition-colors min-h-[2.5rem]">
            {product.name}
          </h3>

          {/* Rating — stars + count */}
          <div className="flex items-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <StarIconSolid
                key={star}
                className={`w-3.5 h-3.5 ${rating >= star ? 'text-yellow-400' : 'text-gray-200'}`}
              />
            ))}
            {rating > 0 ? (
              <span className="text-xs text-gray-500 ms-1">
                {rating.toFixed(1)}{reviewsCount > 0 && ` (${reviewsCount})`}
              </span>
            ) : (
              <span className="text-xs text-gray-400 ms-1">{t('product.card.noRating', 'No rating')}</span>
            )}
          </div>

          {/* Price — Etsy style: prominent, with compare-at price */}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-lg font-bold text-gray-900" aria-label={t('product.card.price', { price: formatPrice(product.price_per_unit), defaultValue: `Price: ${formatPrice(product.price_per_unit)}` })}>
              {formatPrice(product.price_per_unit)}
            </span>
            {hasDiscount && (
              <span className="text-sm text-gray-400 line-through">
                {formatPrice(compareAtPrice)}
              </span>
            )}
            {product.unit_type && <span className="text-xs text-gray-500">/{product.unit_type}</span>}
          </div>

          {/* Min order + Quick add — bottom row */}
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-50">
            <div className="min-w-0 flex-1">
              {product.min_order_quantity > 1 && product.unit_type ? (
                <p className="text-xs text-gray-500 truncate">
                  {t('product.card.minOrder', { quantity: product.min_order_quantity, unit: product.unit_type, defaultValue: `Min: ${product.min_order_quantity} ${product.unit_type}` })}
                </p>
              ) : (
                <p className="text-xs text-gray-400 truncate">&nbsp;</p>
              )}
            </div>
            {product.is_available && (
              <button
                data-testid="add-to-cart-btn"
                onClick={handleQuickAdd}
                className="flex-shrink-0 w-9 h-9 bg-primary-600 hover:bg-primary-700 text-white rounded-full flex items-center justify-center shadow-md shadow-primary-500/20 hover:scale-110 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-label={t('product.card.addToCart', { name: product.name, defaultValue: `Add ${product.name} to cart` })}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.81M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProductCard
