import { Link, useNavigate } from 'react-router-dom'
import { formatPrice } from '@/utils/currency'
import { MapPinIcon, ShoppingCartIcon, HeartIcon as HeartOutline, FlagIcon, CheckIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid, HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import { useCartStore } from '@/store/cartStore'
import { useFavoritesStore } from '@/store/favoritesStore'
import { useAuthStore } from '@/store/authStore'
import ReportAbuseModal from '@/components/ReportAbuseModal'
import { useState } from 'react'
import toast from 'react-hot-toast'
import queryClient from '@/services/queryClient'

const ProductCard = ({ product }) => {
  const navigate = useNavigate()
  const { addItem } = useCartStore()
  const { toggleProduct, isFavorited } = useFavoritesStore()
  const { user } = useAuthStore()
  const [showReport, setShowReport] = useState(false)
  const imageList = product.images?.length ? product.images : product.product_images
  const primaryImage = imageList?.find(img => img.is_primary) || imageList?.[0]
  const favorited = isFavorited(product.id)
  const rating = Number(product.average_rating ?? product.rating ?? 0)
  const reviewsCount = Number(product.reviews_count ?? 0)

  const openProductDetails = () => {
    navigate(`/product/${product.id}`)
  }

  const prefetchProductDetails = async () => {
    if (!product?.id) return

    try {
      const { fetchProductById } = await import('@/api/productsApi')

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
    
    if (!user) {
      toast.error('Please login to add favorites')
      return
    }

    await toggleProduct(user.id, product.id)
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
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
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

          {/* Category Badge */}
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/90 backdrop-blur-sm text-xs font-semibold text-gray-700 capitalize shadow-sm">
              {product.category}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="absolute top-3 right-3 flex flex-col gap-2">
            {/* Report Button */}
            {user && user.id !== product.vendor_id && (
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setShowReport(true)
                }}
                className="w-11 h-11 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
                title="الإبلاغ عن هذا المنتج"
                aria-label="الإبلاغ عن المنتج"
              >
                <FlagIcon className="w-4 h-4 text-gray-600 hover:text-red-500" />
              </button>
            )}
            
            {/* Favorite Button */}
            <button
              onClick={handleToggleFavorite}
              className="w-11 h-11 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-all"
              aria-label={favorited ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
              aria-pressed={favorited}
            >
              {favorited ? (
                <HeartSolid className="w-5 h-5 text-red-500" />
              ) : (
                <HeartOutline className="w-5 h-5 text-gray-600 hover:text-red-500" />
              )}
            </button>
          </div>

          {/* Quick Add Button */}
          {product.is_available && (
            <button
              data-testid="add-to-cart-btn"
              onClick={handleQuickAdd}
              className="absolute bottom-3 right-3 w-11 h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 hover:scale-110 transition-all"
              aria-label={`إضافة ${product.name} إلى السلة`}
            >
              <ShoppingCartIcon className="w-5 h-5" />
            </button>
          )}
          
          {/* Out of Stock Overlay */}
          {!product.is_available && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="px-3 py-1.5 bg-white rounded-lg text-sm font-semibold text-gray-900">
                غير متوفر
              </span>
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-4">
          {/* Vendor & Location */}
          {product.vendor && (
            <div className="mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-[10px] font-bold">
                    {product.vendor.first_name?.[0]}{product.vendor.last_name?.[0]}
                  </span>
                </div>
                <span className="text-xs text-gray-500 truncate">
                  {product.vendor.store_name || `${product.vendor.first_name} ${product.vendor.last_name}`}
                </span>
                {product.vendor.city && (
                  <>
                    <span className="text-gray-400">•</span>
                    <MapPinIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    <span className="text-xs text-gray-500 truncate">{product.vendor.city}</span>
                  </>
                )}
                {product.vendor.is_verified && (
                  <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                    <CheckIcon className="w-3 h-3" />
                    مزارع موثّق
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                  <LockClosedIcon className="w-3 h-3" />
                  بيانات التواصل تظهر بعد تأكيد الطلب
                </span>
                <Link
                  to={`/vendor/public/${product.vendor_id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-[11px] text-emerald-700 hover:text-emerald-800 font-medium"
                >
                  عرض البائع
                </Link>
              </div>
            </div>
          )}
          
          {/* Product Name */}
          <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2 group-hover:text-emerald-600 transition-colors">
            {product.name}
          </h3>

          {/* Product Description */}
          {product.description && (
            <p className="text-sm text-gray-500 line-clamp-2 mb-3">
              {product.description}
            </p>
          )}
          
          {/* Rating */}
          <div className="flex items-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((star) => (
              <StarIconSolid
                key={star}
                className={`w-3.5 h-3.5 ${rating >= star ? 'text-yellow-400' : 'text-gray-200'}`}
              />
            ))}
            {rating > 0 ? (
              <span className="text-xs text-gray-500 ms-1">
                {rating.toFixed(1)}
                {reviewsCount > 0 ? ` (${reviewsCount})` : ''}
              </span>
            ) : (
              <span className="text-xs text-gray-500 ms-1">بدون تقييم</span>
            )}
          </div>
          
          {/* Price & Min Order */}
          <div className="flex items-end justify-between pt-3 border-t border-gray-100">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold text-gray-900" aria-label={`السعر: ${Number(product.price_per_unit || 0)} درهم`}>
                  {formatPrice(product.price_per_unit)}
                </span>
                {product.unit_type && <span className="text-sm text-gray-500">/{product.unit_type}</span>}
              </div>
              {product.min_order_quantity > 1 && product.unit_type && (
                <p className="text-xs text-gray-500 mt-0.5">
                  أدنى كمية: {product.min_order_quantity} {product.unit_type}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      <ReportAbuseModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        reportedUserId={product.vendor_id}
        category="product"
        categoryId={product.id}
      />
    </div>
  )
}

export default ProductCard
