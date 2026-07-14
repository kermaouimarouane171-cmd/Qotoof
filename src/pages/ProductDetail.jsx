import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCartStore } from '@/modules/cart'
import { useAuthStore } from '@/store/authStore'
import useRequireAuth from '@/hooks/useRequireAuth'
import { supabase } from '@/services/supabase'
import { runProductImageFallbackQuery } from '@/modules/catalog'
import inventoryService from '@/services/inventoryService'
import { reviewService } from '@/modules/reviews'
import { refundPolicyService } from '@/modules/payments'
import { Button, LoadingSpinner, Map, StarRating, RecentlyViewed, ProductRecommendations, trackProductView } from '@/components/ui'
import { useMapCenter } from '@/hooks/useMapCenter'
import ErrorBoundary from '@/components/ErrorBoundary'
import { formatPrice } from '@/utils/currency'
import { formatQuantity, getQuantityStep, normalizeQuantity } from '@/modules/cart'
import { getCategoryLabel } from '@/constants/categories'
import {
  MapPinIcon,
  ShoppingCartIcon,
  TruckIcon,
  ShieldCheckIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  PhotoIcon,
  StarIcon,
  CheckCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { checkDeliveryEligibility } from '@/services/deliveryEligibilityService'

const REVIEWS_PER_PAGE = 10

const getTextLocale = (language = 'en') => {
  if (language.startsWith('ar')) return 'ar-MA'
  if (language.startsWith('fr')) return 'fr-FR'
  return 'en-US'
}

const ProductDetailPage = () => {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const queryClient = useQueryClient()
  const { addItem } = useCartStore()
  const { user, profile } = useAuthStore()
  const { requireAuth } = useRequireAuth()

  // UI-only state (not server data)
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [userRating, setUserRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [joiningWaitlist, setJoiningWaitlist] = useState(false)
  const currentLanguage = i18n.resolvedLanguage || i18n.language || 'en'
  const textLocale = useMemo(() => getTextLocale(currentLanguage), [currentLanguage])
  const numberFormatter = useMemo(() => new Intl.NumberFormat(textLocale), [textLocale])
  const formatReviewDate = useCallback((value) => new Date(value).toLocaleDateString(textLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }), [textLocale])
  // SM-2 fix: جلب بيانات المنتج عبر TanStack Query → كاش مشترك مع Marketplace
  // عند العودة من صفحة التفاصيل تُعاد البيانات فوراً من الكاش دون طلب HTTP
  const {
    data: product,
    isLoading: loading,
    isError: productFetchError,
  } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      if (!id) return null
      const buildQuery = (selectClause) => supabase
        .from('products')
        .select(selectClause)
        .eq('id', id)
        .single()

      try {
        const { data } = await runProductImageFallbackQuery({
          buildQuery,
          selectWithImages: `
            *,
            vendor:public_vendor_profiles!vendor_id(
              id,
              first_name,
              last_name,
              store_name,
              store_description,
              avatar_url,
              city,
              country,
              latitude,
              longitude
            ),
            product_images(id, url, is_primary)
          `,
          selectWithoutImages: `
            *,
            vendor:public_vendor_profiles!vendor_id(
              id,
              first_name,
              last_name,
              store_name,
              store_description,
              avatar_url,
              city,
              country,
              latitude,
              longitude
            )
          `,
          onRelationError: (relationError) => logger.warn('Product detail: product_images relation missing, hydrating separately', relationError),
        })
        return data
      } catch (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }
    },
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error?.code === 'PGRST116') return false
      return failureCount < 2
    },
  })

  const notFound = !loading && (productFetchError || product === null)

  // Unified map center: vendor coords → vendor city → buyer city → Casablanca
  const vendorMapCenter = useMapCenter({
    lat: product?.vendor?.latitude,
    lng: product?.vendor?.longitude,
    city: product?.vendor?.city || profile?.city,
  })

  // Sync initial quantity & selectedImage when product loads (UI state only)
  useEffect(() => {
    if (product) {
      setQuantity(product.min_order_quantity || 1)
      if (product.images?.length > 0) {
        const primaryIndex = product.images.findIndex(img => img.is_primary)
        setSelectedImage(primaryIndex >= 0 ? primaryIndex : 0)
      }
      if (product.id) {
        trackProductView(product.id)
      }
    }
  }, [product?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // SM-2 fix: Reviews via TanStack Query — كاش مستقل لكل منتج
  const {
    data: reviewsData,
    isLoading: _reviewsLoading,
  } = useQuery({
    queryKey: ['product-reviews', id, 1],
    queryFn: async () => {
      const from = 0
      const to = REVIEWS_PER_PAGE - 1

      const { data, error, count } = await supabase
        .from('reviews')
        .select(`
          *,
          reviewer:profiles!reviews_user_id_fkey(first_name, last_name, avatar_url)
        `, { count: 'exact' })
        .eq('product_id', id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error

      // Calculate average rating in same query batch
      let averageRating = 0
      if ((count || 0) > 0) {
        const { data: allRatings } = await supabase
          .from('reviews')
          .select('rating')
          .eq('product_id', id)
          .is('deleted_at', null)
        if (allRatings?.length > 0) {
          averageRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length
        }
      }

      return { reviews: data || [], totalReviews: count || 0, averageRating }
    },
    enabled: Boolean(id) && Boolean(product),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })

  const reviews = reviewsData?.reviews ?? []
  const _totalReviews = reviewsData?.totalReviews ?? 0
  const averageRating = reviewsData?.averageRating ?? 0

  // SM-2 fix: Related products via TanStack Query
  const { data: _relatedProducts = [], isLoading: _relatedLoading } = useQuery({
    queryKey: ['product-related', id, product?.category],
    queryFn: async () => {
      const buildQuery = (selectClause) => supabase
        .from('products')
        .select(selectClause)
        .eq('is_available', true)
        .eq('category', product.category)
        .neq('id', id)
        .order('created_at', { ascending: false })
        .limit(4)

      const { data } = await runProductImageFallbackQuery({
        buildQuery,
        selectWithImages: `*, product_images(url, is_primary)`,
        selectWithoutImages: '*',
        onRelationError: (error) => logger.warn('Product detail related products: product_images relation missing, hydrating separately', error),
      })

      return data || []
    },
    enabled: Boolean(id) && Boolean(product?.category),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })

  // SM-2 fix: Refund policy via TanStack Query
  const { data: refundPolicy = null } = useQuery({
    queryKey: ['vendor-refund-policy', product?.vendor_id],
    queryFn: async () => {
      try {
        return await refundPolicyService.getVendorRefundPolicy(product.vendor_id)
      } catch (error) {
        logger.warn('Error loading vendor refund policy:', error)
        return null
      }
    },
    enabled: Boolean(product?.vendor_id),
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  })

  // SM-6 fix: Waitlist entry — يبقى useEffect لأنه مرتبط بحالة المستخدم وليس بيانات عامة
  // نستخدم useQuery مع enabled لتأمين cleanup صحيح
  const { data: waitlistEntry = null } = useQuery({
    queryKey: ['waitlist-entry', id, user?.id],
    queryFn: () => inventoryService.getUserWaitlistEntry(id, user.id),
    enabled: Boolean(id) && Boolean(user?.id) && Boolean(product),
    staleTime: 60 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: false,
  })

  const localizedCategoryLabel = useMemo(() => {
    if (!product?.category) return ''
    return getCategoryLabel(product.category, currentLanguage)
  }, [product?.category, currentLanguage])
  const minimumOrderQuantity = useMemo(
    () => Number(product?.min_order_quantity || 1),
    [product?.min_order_quantity]
  )
  const quantityStep = useMemo(
    () => getQuantityStep(product?.unit_type, minimumOrderQuantity),
    [minimumOrderQuantity, product?.unit_type]
  )

  // SEO: Update title and meta description
  useEffect(() => {
    if (product) {
      document.title = t('productDetail.meta.title', '{{productName}} | Qotoof - قطوف', {
        productName: product.name,
      })

      let metaDescription = document.querySelector('meta[name="description"]')
      if (!metaDescription) {
        metaDescription = document.createElement('meta')
        metaDescription.name = 'description'
        document.head.appendChild(metaDescription)
      }
      metaDescription.content = product.description || t(
        'productDetail.meta.defaultDescription',
        '{{productName}} - {{category}} available at Qotoof marketplace',
        {
          productName: product.name,
          category: localizedCategoryLabel || product.category,
        }
      )

      // JSON-LD Structured Data for SEO
      const jsonLd = {
        '@context': 'https://schema.org/',
        '@type': 'Product',
        name: product.name,
        description: product.description || '',
        image: product.images?.map(img => img.url) || [],
        brand: {
          '@type': 'Brand',
          name: product.vendor?.store_name || product.vendor?.first_name || t('productDetail.vendor.unknown', 'Unknown vendor')
        },
        offers: {
          '@type': 'Offer',
          url: window.location.href,
          priceCurrency: 'MAD',
          price: product.price_per_unit,
          availability: product.is_available
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          eligibleQuantity: product.min_order_quantity
            ? [{ '@type': 'QuantitativeValue', value: product.min_order_quantity, unitCode: product.unit_type }]
            : [],
          seller: {
            '@type': 'Organization',
            name: product.vendor?.store_name || product.vendor?.first_name || t('productDetail.vendor.unknown', 'Unknown vendor')
          }
        },
        aggregateRating: averageRating > 0
          ? {
              '@type': 'AggregateRating',
              ratingValue: averageRating.toFixed(1),
              reviewCount: reviews.length,
              bestRating: '5',
              worstRating: '1'
            }
          : undefined,
        category: localizedCategoryLabel || product.category
      }

      // Remove existing JSON-LD if any
      const existingScript = document.querySelector('script[type="application/ld+json"]')
      if (existingScript) existingScript.remove()

      // Add new JSON-LD
      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.textContent = JSON.stringify(jsonLd)
      document.head.appendChild(script)

      // Cleanup on unmount
      return () => {
        script.remove()
      }
    }
  }, [product, averageRating, reviews, t, localizedCategoryLabel])

  const handleSubmitReview = async () => {
    if (!requireAuth({ from: `/product/${id}` })) return

    if (userRating === 0) {
      toast.error(t('productDetail.reviews.selectRating', 'Please select a rating'))
      return
    }

    try {
      setSubmittingReview(true)

        await reviewService.createReview({
          productId: id,
          vendorId: product?.vendor_id,
          userId: user.id,
          rating: userRating,
          comment: reviewText,
        })

      toast.success(t('productDetail.reviews.submitSuccess', 'Review submitted successfully!'))
      setUserRating(0)
      setReviewText('')
      // Invalidate reviews cache so the new review appears immediately
      await queryClient.invalidateQueries({ queryKey: ['product-reviews', id] })
    } catch (error) {
      logger.error('Error submitting review:', error)
      toast.error(t('productDetail.reviews.submitFailed', 'Failed to submit review'))
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleAddToCart = () => {
    if (!product) return

    const normalizedQuantity = normalizeQuantity(quantity, {
      unitType: product.unit_type,
      minOrderQuantity: minimumOrderQuantity,
      fallbackQuantity: minimumOrderQuantity,
    })

    // Check if product is available
    if (!product.is_available) {
      toast.error(t('product.outOfStock', 'This product is out of stock'))
      return
    }

    // Check minimum order quantity
    if (normalizedQuantity < product.min_order_quantity) {
      toast.error(
        t('product.minOrder', 'Minimum order is {{min}} {{unit}}', {
          min: product.min_order_quantity,
          unit: product.unit_type
        })
      )
      return
    }

    // Check available quantity
    if (product.available_quantity !== null && normalizedQuantity > product.available_quantity) {
      toast.error(
        t('product.exceedsStock', 'Requested quantity exceeds available stock ({{max}} {{unit}})', {
          max: product.available_quantity,
          unit: product.unit_type
        })
      )
      return
    }

    // Delivery eligibility guard — prevent illogical distant orders
    const eligibility = checkDeliveryEligibility({
      buyerLocation: profile
        ? {
            latitude: profile.latitude,
            longitude: profile.longitude,
          }
        : null,
      vendorLocation: product.vendor
        ? {
            latitude: product.vendor.latitude,
            longitude: product.vendor.longitude,
          }
        : null,
      orderAmount: Number(product.price_per_unit || product.price || 0) * normalizedQuantity,
      vendorPolicy: product.vendor || null,
    })

    if (!eligibility.allowed) {
      toast.error(eligibility.message || 'التوصيل غير متاح لهذا الطلب.')
      return
    }

    // Only show location hint for authenticated users who haven't set a location yet.
    // Guests don't have a profile so the hint is meaningless for them.
    if (eligibility.reason === 'LOCATION_MISSING' && user) {
      toast(eligibility.message || 'سيتم التحقق من التوصيل بعد تحديد موقعك.', {
        icon: '📍',
        duration: 4000,
      })
    }

    addItem(product, normalizedQuantity)
  }

  const handleJoinWaitlist = async () => {
    if (!product) return

    if (!requireAuth({ from: `/product/${id}`, onUnauthorized: () => toast.error(t('common.loginRequired', 'Please sign in to continue.')) })) return

    setJoiningWaitlist(true)
    try {
      await inventoryService.joinWaitlist({
        productId: product.id,
        userId: user.id,
        requestedQuantity: quantity,
      })

      // Invalidate waitlist and product caches to reflect updated waitlist_count
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['waitlist-entry', id, user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['product', id] }),
      ])
      toast.success(t('productDetail.waitlist.joinSuccess', 'You have been added to the waitlist successfully'))
    } catch (error) {
      logger.error('Error joining waitlist:', error)
      toast.error(error.message || t('productDetail.waitlist.joinFailed', 'Unable to add you to the waitlist'))
    } finally {
      setJoiningWaitlist(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const isProductSoldOut = !product?.is_available || Number(product?.available_quantity ?? product?.stock_quantity ?? 0) <= 0

  if (notFound) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <PhotoIcon className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {t('product.notFound.title', 'Product not found')}
        </h2>
        <p className="text-gray-500 mb-6">
          {t('product.notFound.description', 'The product you\'re looking for doesn\'t exist or has been removed.')}
        </p>
        <Link to="/marketplace" className="btn-primary inline-flex items-center gap-2">
          <ArrowLeftIcon className="w-5 h-5" />
          {t('product.notFound.backToMarketplace', 'Back to Marketplace')}
        </Link>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <PhotoIcon className="w-10 h-10 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('product.notFound.title', 'Product not found')}</h2>
        <p className="text-gray-500 mb-6">{t('product.notFound.description', 'The product you\'re looking for doesn\'t exist or has been removed.')}</p>
        <Link to="/marketplace" className="btn-primary">
          <ArrowLeftIcon className="w-5 h-5 mr-2" />
          {t('product.notFound.backToMarketplace', 'Back to Marketplace')}
        </Link>
      </div>
    )
  }

  const allImages = product.images || []
  const displayImage = allImages[selectedImage]?.url

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6" aria-label={t('product.breadcrumb', 'Breadcrumb')}>
        <Link to="/" className="hover:text-green-600">{t('nav.home', 'Home')}</Link>
        <span aria-hidden="true">/</span>
        <Link to="/marketplace" className="hover:text-green-600">{t('nav.marketplace', 'Marketplace')}</Link>
        {product.category && (
          <>
            <span aria-hidden="true">/</span>
            <Link to={`/marketplace?category=${product.category}`} className="hover:text-green-600 capitalize">
              {localizedCategoryLabel || product.category}
            </Link>
          </>
        )}
        {product.subcategory && (
          <>
            <span aria-hidden="true">/</span>
            <Link to={`/marketplace?category=${product.category}&subcategory=${product.subcategory}`} className="hover:text-green-600 capitalize">
              {product.subcategory}
            </Link>
          </>
        )}
        <span aria-hidden="true">/</span>
        <span className="text-gray-900 truncate" aria-current="page">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* Images */}
        <div>
          <div className="group relative aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-4">
            {displayImage ? (
              <img
                src={displayImage}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <PhotoIcon className="w-20 h-20" />
              </div>
            )}

            {allImages.length > 1 && (
              <>
                <button
                  onClick={() => setSelectedImage(prev => (prev === 0 ? allImages.length - 1 : prev - 1))}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                  aria-label={t('product.previousImage', 'Previous image')}
                >
                  <ArrowLeftIcon className="w-5 h-5 text-gray-700" />
                </button>
                <button
                  onClick={() => setSelectedImage(prev => (prev === allImages.length - 1 ? 0 : prev + 1))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                  aria-label={t('product.nextImage', 'Next image')}
                >
                  <ArrowRightIcon className="w-5 h-5 text-gray-700" />
                </button>
              </>
            )}
          </div>

          {allImages.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {allImages.map((img, index) => (
                <button
                  key={img.id || index}
                  onClick={() => setSelectedImage(index)}
                  className={`aspect-square rounded-xl overflow-hidden border-2 transition-colors ${
                    selectedImage === index ? 'border-green-500' : 'border-transparent hover:border-gray-300'
                  }`}
                  aria-label={t('product.imageThumbnail', 'View image {{num}}', { num: index + 1 })}
                  aria-pressed={selectedImage === index}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div>
          <div className="mb-2">
            <span className="badge-primary capitalize">{localizedCategoryLabel || product.category}</span>
            {product.subcategory && (
              <span className="badge-secondary ml-2 capitalize">{product.subcategory}</span>
            )}
            {!product.is_available && (
              <span className="badge-danger ml-2">{t('product.outOfStock', 'Out of Stock')}</span>
            )}
            {product.is_available && product.available_quantity <= 10 && product.available_quantity > 0 && (
              <span className="badge-warning ml-2">{t('productDetail.badges.lowStock', 'Low Stock')}</span>
            )}
            {product.is_organic && (
              <span className="badge-success ml-2">{t('productDetail.badges.organic', 'Organic')}</span>
            )}
            {product.is_local && (
              <span className="badge-secondary ml-2">{t('productDetail.badges.local', 'Local')}</span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
            {product.name}
          </h1>

          {/* Vendor */}
          {product.vendor && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold">
                  {product.vendor.first_name?.[0]}{product.vendor.last_name?.[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">
                  {product.vendor.store_name || `${product.vendor.first_name} ${product.vendor.last_name}`}
                </p>
                {product.vendor.city && (
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <MapPinIcon className="w-4 h-4" />
                    <span>{product.vendor.city}{product.vendor.country ? `, ${product.vendor.country}` : ''}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Price */}
          <div className="bg-green-50 rounded-2xl p-6 mb-6 border border-green-100">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-bold text-green-600">
                {formatPrice(product.price_per_unit)}
              </span>
              <span className="text-lg text-gray-500">{t('product.perUnit', 'per {{unit}}', { unit: product.unit_type })}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">
                {t('productDetail.purchase.minOrder', 'Min order: {{quantity}} {{unit}}', {
                  quantity: numberFormatter.format(product.min_order_quantity),
                  unit: product.unit_type,
                })}
              </span>
              {product.available_quantity > 0 && (
                <span className="text-green-600">
                  {t('productDetail.purchase.available', 'Available: {{quantity}} {{unit}}', {
                    quantity: numberFormatter.format(product.available_quantity),
                    unit: product.unit_type,
                  })}
                </span>
              )}
            </div>
          </div>

          {/* Quantity Selector */}
          <div className="mb-6">
            <label className="input-label">{t('productDetail.purchase.quantityLabel', 'Quantity ({{unit}})', { unit: product.unit_type })}</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity((currentQuantity) => Math.max(
                  minimumOrderQuantity,
                  normalizeQuantity(currentQuantity - quantityStep, {
                    unitType: product.unit_type,
                    minOrderQuantity: minimumOrderQuantity,
                    fallbackQuantity: minimumOrderQuantity,
                  })
                ))}
                disabled={quantity <= minimumOrderQuantity}
                className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xl font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-gray-100"
              >
                −
              </button>
              <input
                type="number"
                value={quantity}
                onChange={(e) => {
                  const nextValue = Number(e.target.value)
                  if (Number.isFinite(nextValue)) {
                    setQuantity(Math.max(
                      minimumOrderQuantity,
                      normalizeQuantity(nextValue, {
                        unitType: product.unit_type,
                        minOrderQuantity: minimumOrderQuantity,
                        fallbackQuantity: minimumOrderQuantity,
                      })
                    ))
                  } else if (e.target.value === '') {
                    setQuantity(minimumOrderQuantity)
                  }
                }}
                className="input w-24 text-center text-lg font-semibold"
                min={minimumOrderQuantity}
                step={quantityStep}
              />
              <button
                onClick={() => setQuantity((currentQuantity) => normalizeQuantity(currentQuantity + quantityStep, {
                  unitType: product.unit_type,
                  minOrderQuantity: minimumOrderQuantity,
                  fallbackQuantity: minimumOrderQuantity,
                }))}
                className="w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xl font-medium transition-colors"
              >
                +
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {t('productDetail.purchase.quantityStep', 'Quantity changes in steps of {{quantity}} {{unit}}', {
                quantity: formatQuantity(quantityStep, product.unit_type),
                unit: product.unit_type,
              })}
            </p>
          </div>

          {/* Total */}
          <div className="mb-6 p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">{t('productDetail.purchase.totalPrice', 'Total Price:')}</span>
              <span className="text-2xl font-bold text-gray-900">
                {formatPrice(product.price_per_unit * quantity)}
              </span>
            </div>
          </div>

          {/* Delivery Rules Info */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <div className="flex items-start gap-3">
              <InformationCircleIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900">
                  {t('productDetail.deliveryInfo.title', 'كيف يعمل التوصيل؟')}
                </p>
                <p className="text-sm text-blue-800 mt-1 leading-relaxed">
                  {t('productDetail.deliveryInfo.description', 'تعتمد إمكانية التوصيل على المسافة بين موقعك وموقع البائع، وعلى قيمة الطلب. الطلبات الصغيرة قد لا تكون متاحة من بائعين بعيدين. ستظهر لك رسالة واضحة إذا كان الطلب يحتاج حداً أدنى أعلى أو إذا كان البائع خارج نطاق التوصيل.')}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mb-6">
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              onClick={handleAddToCart}
              disabled={!product.is_available || quantity < product.min_order_quantity}
              leftIcon={<ShoppingCartIcon className="w-5 h-5" />}
            >
              {t('product.addToCart', 'Add to Cart')}
            </Button>
          </div>

          {isProductSoldOut && product.waitlist_enabled !== false && (
            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">{t('productDetail.waitlist.title', 'This product is currently unavailable')}</p>
              <p className="mt-1 text-sm text-amber-800">
                {t('productDetail.waitlist.description', 'We will send you an in-app notification as soon as this product is back in stock.')}
              </p>
              {Number(product.waitlist_count || 0) > 0 && (
                <p className="mt-2 text-xs text-amber-700">
                  {t('productDetail.waitlist.count', 'Current waitlist: {{count}}', {
                    count: numberFormatter.format(Number(product.waitlist_count || 0)),
                  })}
                </p>
              )}
              <div className="mt-4">
                <Button
                  variant={waitlistEntry ? 'outline' : 'secondary'}
                  onClick={handleJoinWaitlist}
                  disabled={Boolean(waitlistEntry)}
                  isLoading={joiningWaitlist}
                >
                  {waitlistEntry
                    ? t('productDetail.waitlist.alreadyJoined', 'You are already on the waitlist')
                    : t('productDetail.waitlist.join', 'Join the waitlist')}
                </Button>
              </div>
            </div>
          )}

          {/* Features */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <TruckIcon className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">{t('productDetail.features.fastDeliveryTitle', 'Fast Delivery')}</p>
                <p className="text-xs text-gray-500">{t('productDetail.features.fastDeliveryBody', '24-48 hours')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <ShieldCheckIcon className="w-6 h-6 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">{t('productDetail.features.qualityAssuredTitle', 'Quality Assured')}</p>
                <p className="text-xs text-gray-500">{t('productDetail.features.qualityAssuredBody', 'Verified vendor')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <div className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('product.description', 'Description')}</h2>
          <div className="card p-6">
            <p className="text-gray-600 whitespace-pre-line leading-relaxed">
              {product.description}
            </p>
          </div>
        </div>
      )}

      {refundPolicy && (
        <div className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('productDetail.refund.title', 'Refund Policy')}</h2>
          <div className="card p-6">
            <p className="text-gray-700 leading-7 mb-4">{refundPolicy.policy_text}</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-gray-500 mb-1">{t('productDetail.refund.returnWindow', 'Return window')}</p>
                <p className="font-semibold text-gray-900">{t('productDetail.refund.returnWindowValue', '{{count}} days', { count: numberFormatter.format(refundPolicy.return_window_days) })}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-gray-500 mb-1">{t('productDetail.refund.partialReturns', 'Partial returns')}</p>
                <p className="font-semibold text-gray-900">{refundPolicy.allow_partial_returns ? t('productDetail.refund.allowed', 'Allowed') : t('productDetail.refund.notAllowed', 'Not allowed')}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-gray-500 mb-1">{t('productDetail.refund.shippingResponsibility', 'Return shipping')}</p>
                <p className="font-semibold text-gray-900">
                  {refundPolicy.return_shipping_paid_by === 'vendor'
                    ? t('productDetail.refund.shippingPaidBy.vendor', 'Paid by the vendor')
                    : refundPolicy.return_shipping_paid_by === 'shared'
                    ? t('productDetail.refund.shippingPaidBy.shared', 'Shared between both parties')
                    : t('productDetail.refund.shippingPaidBy.buyer', 'Paid by the buyer')}
                </p>
              </div>
            </div>
            {Array.isArray(refundPolicy.non_returnable_categories) && refundPolicy.non_returnable_categories.length > 0 && (
              <p className="text-xs text-gray-500 mt-4">
                {t('productDetail.refund.nonReturnable', 'Non-returnable categories: {{categories}}', {
                  categories: refundPolicy.non_returnable_categories.join(', '),
                })}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Farming Information */}
      {(product.scientific_name || product.season || product.care_instructions) && (
        <div className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('productDetail.farming.title', 'Farming Information')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {product.scientific_name && (
              <div className="card p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t('productDetail.farming.scientificName', 'Scientific Name')}</h3>
                <p className="text-gray-900 font-semibold italic">{product.scientific_name}</p>
              </div>
            )}
            {product.season && (
              <div className="card p-4">
                <h3 className="text-sm font-medium text-gray-500 mb-1">{t('productDetail.farming.season', 'Season')}</h3>
                <p className="text-gray-900 font-semibold">{product.season}</p>
              </div>
            )}
            {product.care_instructions && (
              <div className="card p-4 md:col-span-2">
                <h3 className="text-sm font-medium text-gray-500 mb-2">{t('productDetail.farming.careInstructions', 'Care Instructions')}</h3>
                <p className="text-gray-600 whitespace-pre-line leading-relaxed">{product.care_instructions}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vendor Location */}
      {product.vendor && (product.vendor.latitude || product.vendor.longitude || product.vendor.city) && (
        <div className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('productDetail.vendor.locationTitle', 'Vendor Location')}</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="font-semibold text-gray-900 text-lg mb-2">
                {product.vendor.store_name || `${product.vendor.first_name} ${product.vendor.last_name}`}
              </h3>
              {product.vendor.store_description && (
                <p className="text-gray-600 mb-4">{product.vendor.store_description}</p>
              )}
              {product.vendor.city && (
                <div className="flex items-center gap-2 text-gray-500 mb-4">
                  <MapPinIcon className="w-5 h-5" />
                  <span>{product.vendor.city}{product.vendor.country ? `, ${product.vendor.country}` : ''}</span>
                </div>
              )}
            </div>
            <Map
              center={vendorMapCenter}
              zoom={10}
              markers={
                product.vendor.latitude && product.vendor.longitude
                  ? [{
                      lat: product.vendor.latitude,
                      lng: product.vendor.longitude,
                      popup: product.vendor.store_name || t('productDetail.vendor.locationTitle', 'Vendor Location')
                    }]
                  : []
              }
              height="300px"
            />
          </div>
        </div>
      )}

      {/* Reviews Section */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          {t('product.reviews', 'Reviews')} ({numberFormatter.format(reviews.length)})
        </h2>

        {/* Rating Summary */}
        <div className="bg-gray-50 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
              <StarIcon className="w-8 h-8 text-yellow-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-gray-900">
                  {averageRating > 0 ? averageRating.toFixed(1) : '—'}
                </span>
                <span className="text-gray-500">/ 5</span>
              </div>
              <p className="text-sm text-gray-500">
                {t('productDetail.reviews.summary', '{{count}} reviews', {
                  count: numberFormatter.format(reviews.length),
                })}
              </p>
            </div>
          </div>

          {reviews.length > 0 && (
            <StarRating
              rating={Math.round(averageRating)}
              size="lg"
              showValue={false}
            />
          )}
        </div>

        {/* Write Review */}
        {user ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('productDetail.reviews.writeTitle', 'Write a Review')}</h3>
            <div className="mb-4">
              <p className="block text-sm font-medium text-gray-700 mb-2">{t('productDetail.reviews.ratingLabel', 'Rating')}</p>
              <StarRating
                rating={userRating}
                size="lg"
                onRate={(rating) => setUserRating(rating)}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="product-review-text" className="block text-sm font-medium text-gray-700 mb-2">
                {t('productDetail.reviews.yourReviewLabel', 'Your review (optional)')}
              </label>
              <textarea
                id="product-review-text"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder={t('productDetail.reviews.yourReviewPlaceholder', 'Share your experience with this product...')}
              />
            </div>
            <button
              onClick={handleSubmitReview}
              disabled={submittingReview || userRating === 0}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingReview ? t('productDetail.reviews.submitting', 'Submitting...') : t('productDetail.reviews.submit', 'Submit Review')}
            </button>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6 text-center">
            <p className="text-blue-800">
              {t('productDetail.reviews.loginPromptPrefix', 'Please')}{' '}
              <Link to="/login" className="font-semibold underline hover:text-blue-600">
                {t('productDetail.reviews.loginLink', 'login')}
              </Link>
              {' '}{t('productDetail.reviews.loginPromptSuffix', 'to write a review')}
            </p>
          </div>
        )}

        {/* Reviews List */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {t('productDetail.reviews.emptyDescription', 'No reviews yet for this product')}
            </div>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="bg-white border border-gray-200 rounded-2xl p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">
                        {review.reviewer?.first_name?.[0]}{review.reviewer?.last_name?.[0] || t('productDetail.reviews.anonymousInitial', 'U')}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {review.reviewer ? `${review.reviewer.first_name} ${review.reviewer.last_name}` : t('productDetail.reviews.anonymousUser', 'User')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatReviewDate(review.created_at)}
                      </p>
                    </div>
                  </div>
                  <StarRating rating={review.rating} size="sm" />
                </div>
                {review.comment && (
                  <p className="text-gray-600 leading-relaxed">{review.comment}</p>
                )}
                {/* Vendor Reply */}
                {review.vendor_reply && (
                  <div className="mt-4 ml-6 bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircleIcon className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-800">{t('productDetail.reviews.vendorReply', 'Vendor reply')}</span>
                      {review.vendor_reply_at && (
                        <span className="text-xs text-green-500">
                          {formatReviewDate(review.vendor_reply_at)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-green-700">{review.vendor_reply}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recently Viewed */}
      <RecentlyViewed excludeId={product?.id} className="mt-12" />

      {/* Product Recommendations */}
      <ProductRecommendations category={product?.category} excludeId={product?.id} className="mt-8" />
    </div>
  )
}

// Wrap with Error Boundary to prevent page crashes
const ProductDetailWithErrorBoundary = () => (
  <ErrorBoundary componentName="ProductDetailPage">
    <ProductDetailPage />
  </ErrorBoundary>
)

export default ProductDetailWithErrorBoundary
