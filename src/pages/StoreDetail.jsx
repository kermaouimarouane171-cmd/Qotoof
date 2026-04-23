import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/services/supabase'
import storeTypeService from '@/services/storeTypeService'
import { Card, LoadingSpinner, ProductCard, Map, StarRating, SimpleRating } from '@/components/ui'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useAuthStore } from '@/store/authStore'
import {
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  ClockIcon,
  ShareIcon,
  BellIcon,
  BellSlashIcon,
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  CheckBadgeIcon,
  BoltIcon,
  CalendarIcon,
  ArrowLeftIcon,
  BuildingStorefrontIcon,
  CheckCircleIcon,
  TruckIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'
import { sanitizePostgRESTFilter } from '@/utils/sanitization'

const PRODUCT_CATEGORIES = [
  { id: 'all', label: 'All Products' },
  { id: 'plants', label: 'Plants & Trees', emoji: '🌿' },
  { id: 'vegetables', label: 'Vegetables', emoji: '🥬' },
  { id: 'fruits', label: 'Fruits', emoji: '🍎' },
  { id: 'herbs', label: 'Herbs', emoji: '🌱' },
  { id: 'seeds', label: 'Seeds', emoji: '🌰' },
]

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest First' },
  { id: 'priceLow', label: 'Price: Low to High' },
  { id: 'priceHigh', label: 'Price: High to Low' },
  { id: 'name', label: 'Name A-Z' },
]

const PRODUCTS_PER_PAGE = 12

const StoreDetail = () => {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  // Store state
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [storeError, setStoreError] = useState(false)
  const [isVendorOpen, setIsVendorOpen] = useState(null) // null = checking, true = open, false = closed

  // Products state
  const [products, setProducts] = useState([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [totalProducts, setTotalProducts] = useState(0)
  const [productPage, setProductPage] = useState(1)

  // Filter & sort state
  const [productSearch, setProductSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortBy, setSortBy] = useState('newest')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // Reviews state
  const [reviews, setReviews] = useState([])
  const [averageRating, setAverageRating] = useState(0)
  const [totalReviews, setTotalReviews] = useState(0)
  const [userRating, setUserRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  // Load store info
  const loadStore = useCallback(async () => {
    setLoading(true)
    setStoreError(false)
    setNotFound(false)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          setNotFound(true)
          return
        }
        throw error
      }

      if (data?.role !== 'vendor') {
        setNotFound(true)
        return
      }

      setStore(data)

      try {
        const { data: isOpen } = await supabase.rpc('is_vendor_open', {
          p_vendor_id: data.id,
        })
        setIsVendorOpen(isOpen)
      } catch (err) {
        logger.debug('Vendor schedule check skipped:', err.message)
        setIsVendorOpen(null)
      }
    } catch (error) {
      logger.error('Error loading store:', error)
      setStoreError(true)
      toast.error('Failed to load store information. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (id) loadStore()
  }, [id, loadStore])

  // ============================================================
  // REAL-TIME: Subscribe to store profile updates
  // ============================================================
  useEffect(() => {
    if (!id) return

    const channel = supabase
      .channel(`store-updates:${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          logger.info('Store profile updated:', payload)
          // Update store data in real-time
          setStore(prev => prev ? { ...prev, ...payload.new } : payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id])

  // SEO: Update title and meta description
  useEffect(() => {
    if (store) {
      document.title = `${displayName} | Qotoof Stores - قطوف`

      let metaDescription = document.querySelector('meta[name="description"]')
      if (!metaDescription) {
        metaDescription = document.createElement('meta')
        metaDescription.name = 'description'
        document.head.appendChild(metaDescription)
      }
      metaDescription.content = store.description || `${displayName} - Store on Qotoof marketplace`

      // JSON-LD Structured Data for Store
      const jsonLd = {
        '@context': 'https://schema.org/',
        '@type': 'LocalBusiness',
        name: displayName,
        description: store.description || '',
        image: store.store_logo || store.store_banner_url || '',
        telephone: store.phone || '',
        email: store.email || '',
        address: {
          '@type': 'PostalAddress',
          addressLocality: store.city || '',
          addressCountry: store.country || 'MA'
        },
        geo: store.latitude && store.longitude
          ? {
              '@type': 'GeoCoordinates',
              latitude: store.latitude,
              longitude: store.longitude
            }
          : undefined,
        aggregateRating: averageRating > 0
          ? {
              '@type': 'AggregateRating',
              ratingValue: averageRating.toFixed(1),
              reviewCount: totalReviews
            }
          : undefined,
        url: window.location.href
      }

      // Remove existing and add new
      const existingScript = document.querySelector('script[type="application/ld+json"]')
      if (existingScript) existingScript.remove()

      const script = document.createElement('script')
      script.type = 'application/ld+json'
      script.innerHTML = JSON.stringify(jsonLd)
      document.head.appendChild(script)

      return () => { script.remove() }
    }
  }, [store, averageRating, totalReviews, displayName])

  // Debounced auto-search for product search
  useEffect(() => {
    if (!id) return
    const timer = setTimeout(() => {
      setProductPage(1)
      loadProducts()
    }, 400)
    return () => clearTimeout(timer)
  }, [productSearch, loadProducts])

  // Load products when filters change (excluding search which is debounced above)
  useEffect(() => {
    if (id) loadProducts()
  }, [id, categoryFilter, sortBy, productPage, loadProducts])

  // Load reviews
  useEffect(() => {
    if (id) loadReviews()
  }, [id, loadReviews])

  // Check follow status when store loads
  useEffect(() => {
    if (store && user) checkFollowStatus()
  }, [store, user, checkFollowStatus])

  const loadProducts = useCallback(async () => {
    setProductsLoading(true)
    try {
      let query = supabase
        .from('products')
        .select(`
          *,
          product_images(url, is_primary)
        `, { count: 'exact' })
        .eq('vendor_id', id)
        .eq('is_available', true)
        .eq('approval_status', 'approved') // Only show approved products

      // Category filter
      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter)
      }

      // Search
      if (productSearch) {
        query = query.or(`name.ilike.%${sanitizePostgRESTFilter(productSearch)}%,description.ilike.%${sanitizePostgRESTFilter(productSearch)}%`)
      }

      // Sort
      switch (sortBy) {
        case 'priceLow':
          query = query.order('price_per_unit', { ascending: true })
          break
        case 'priceHigh':
          query = query.order('price_per_unit', { ascending: false })
          break
        case 'name':
          query = query.order('name', { ascending: true })
          break
        case 'newest':
        default:
          query = query.order('created_at', { ascending: false })
          break
      }

      // Pagination
      const from = (productPage - 1) * PRODUCTS_PER_PAGE
      const to = from + PRODUCTS_PER_PAGE - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) throw error
      setProducts(data || [])
      setTotalProducts(count || 0)
    } catch (error) {
      logger.error('Error loading products:', error)
      toast.error('Failed to load products')
      setProducts([])
      setTotalProducts(0)
    } finally {
      setProductsLoading(false)
    }
  }, [id, categoryFilter, productSearch, sortBy, productPage])

  const loadReviews = useCallback(async () => {
    try {
      const { data, error, count } = await supabase
        .from('reviews')
        .select(`
          *
        `, { count: 'exact' })
        .eq('vendor_id', id)
        .eq('is_flagged', false)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      setReviews(data || [])
      setTotalReviews(count || 0)

      // Calculate overall average from all reviews (not just the 10 loaded)
      if (count > 0) {
        const { data: allRatings } = await supabase
          .from('reviews')
          .select('rating')
          .eq('vendor_id', id)
          .eq('is_flagged', false)
          .is('deleted_at', null)

        if (allRatings && allRatings.length > 0) {
          const avg = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length
          setAverageRating(avg)
        }
      }
    } catch (error) {
      logger.error('Error loading reviews:', error)
    }
  }, [id])

  const checkFollowStatus = useCallback(async () => {
    if (!user || !id) return
    try {
      const { data } = await supabase
        .from('store_follows')
        .select('id')
        .eq('user_id', user.id)
        .eq('store_id', id)
        .single()

      setIsFollowing(!!data)
    } catch {
      setIsFollowing(false)
    }
  }, [user, id])

  const handleFollowStore = async () => {
    if (!user) {
      toast.error('Please login to follow stores')
      return
    }

    setFollowLoading(true)
    try {
      if (isFollowing) {
        await supabase
          .from('store_follows')
          .delete()
          .eq('user_id', user.id)
          .eq('store_id', id)

        setIsFollowing(false)
        toast.success('Unfollowed store')
      } else {
        await supabase
          .from('store_follows')
          .insert({ user_id: user.id, store_id: id })

        setIsFollowing(true)
        toast.success('Now following this store!')
      }
    } catch (error) {
      logger.error('Error toggling follow:', error)
      toast.error('Failed to update follow status')
    } finally {
      setFollowLoading(false)
    }
  }

  const handleCallSeller = useCallback(() => {
    if (store?.phone) {
      window.location.href = `tel:${store.phone}`
    } else {
      toast.error('No phone number available')
    }
  }, [store?.phone])

  const handleSendMessage = () => {
    if (!user) {
      toast.error('Please login to send messages')
      return
    }
    navigate(`/messages?vendor=${id}`)
  }

  const handleShareStore = async () => {
    const shareUrl = `${window.location.origin}/stores/${id}`
    const shareTitle = store?.store_name || `${store?.first_name} ${store?.last_name}`

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          url: shareUrl,
        })
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(shareUrl)
      toast.success('Store link copied to clipboard!')
    }
  }

  const handleSubmitReview = async () => {
    if (!user) {
      toast.error('Please login to add a review')
      return
    }

    if (userRating === 0) {
      toast.error('Please select a rating')
      return
    }

    try {
      setSubmittingReview(true)

      const { error } = await supabase
        .from('reviews')
        .insert({
          product_id: null,
          vendor_id: id,
          user_id: user.id,
          rating: userRating,
          comment: reviewText,
        })

      if (error) throw error

      toast.success('Review submitted successfully!')
      setUserRating(0)
      setReviewText('')
      await loadReviews()
    } catch (error) {
      logger.error('Error submitting review:', error)
      toast.error('Failed to submit review')
    } finally {
      setSubmittingReview(false)
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setProductPage(1)
    loadProducts()
  }

  const clearProductFilters = () => {
    setProductSearch('')
    setCategoryFilter('all')
    setSortBy('newest')
    setProductPage(1)
  }

  // Calculate years in market
  const yearsInMarket = useMemo(() => {
    if (!store?.created_at) return null
    const created = new Date(store.created_at)
    const now = new Date()
    const diffMs = now - created
    const diffYears = diffMs / (365.25 * 24 * 60 * 60 * 1000)
    if (diffYears < 0.25) return 'New'
    if (diffYears < 1) return `${Math.floor(diffYears * 12)} months`
    return `${Math.floor(diffYears)}+ years`
  }, [store?.created_at])

  // Get display name
  const displayName = useMemo(() => {
    if (!store) return ''
    return store.store_name || `${store.first_name} ${store.last_name}`
  }, [store])

  const storeSetup = useMemo(() => storeTypeService.decorateStoreProfile(store), [store])

  // Banner gradient fallback
  const bannerGradient = 'from-green-600 via-emerald-500 to-teal-500'

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Not found state
  if (notFound) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <BuildingStorefrontIcon className="w-10 h-10 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Store not found</h2>
        <p className="text-gray-500 mb-6">The store you're looking for doesn't exist or has been removed.</p>
        <button onClick={() => navigate('/stores')} className="btn-primary">
          <ArrowLeftIcon className="w-5 h-5 mr-2" />
          Back to Stores
        </button>
      </div>
    )
  }

  // Error state
  if (storeError || !store) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <BuildingStorefrontIcon className="w-10 h-10 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-500 mb-6">Failed to load store information. Please try again.</p>
        <button onClick={loadStore} className="btn-primary">Try Again</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Breadcrumb */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4" aria-label={t('storeDetail.breadcrumb', 'Breadcrumb')}>
        <ol className="flex items-center gap-2 text-sm text-gray-500">
          <li><Link to="/" className="hover:text-green-600">{t('nav.home', 'Home')}</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link to="/stores" className="hover:text-green-600">{t('nav.stores', 'Stores')}</Link></li>
          <li aria-hidden="true">/</li>
          <li className="text-gray-900 truncate" aria-current="page">{displayName}</li>
        </ol>
      </nav>

      {/* ===== STORE HEADER WITH BANNER ===== */}
      <div className="relative">
        {/* Banner */}
        <div className="relative w-full aspect-[16/5] sm:aspect-[16/4] md:aspect-[16/3] overflow-hidden">
          {store.store_banner_url ? (
            <img
              src={store.store_banner_url}
              alt={`${displayName} banner`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-r ${bannerGradient}`} />
          )}
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>

        {/* Back button */}
        <button
          onClick={() => navigate('/stores')}
          className="absolute top-4 left-4 z-10 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
          aria-label="Back to stores"
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-700" />
        </button>

        {/* Share button */}
        <button
          onClick={handleShareStore}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
          aria-label="Share store"
        >
          <ShareIcon className="w-5 h-5 text-gray-700" />
        </button>

        {/* Store Logo - Overlapping the banner */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative -mt-12 sm:-mt-16 mb-4">
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden border-4 border-white shadow-xl bg-white">
              {store.store_logo ? (
                <img
                  src={store.store_logo}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <span className="text-3xl sm:text-4xl font-bold text-white">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Store Info Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        {/* Name & Verified Badge */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{displayName}</h1>
          {store.is_verified && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              <CheckBadgeIcon className="w-4 h-4" />
              Verified Store
            </span>
          )}
        </div>

        {/* Description */}
        {store.description && (
          <p className="text-gray-600 mb-4 max-w-2xl">{store.description}</p>
        )}

        {storeSetup && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 mb-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                <SparklesIcon className="w-4 h-4" />
                {storeSetup.storeTypeLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                <TruckIcon className="w-4 h-4" />
                {storeSetup.deliveryOptionMeta?.label}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">نوع المتجر</p>
                <p className="font-semibold text-gray-900">{storeSetup.storeTypeLabel}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">خيار التوصيل</p>
                <p className="font-semibold text-gray-900">{storeSetup.deliveryOptionMeta?.label}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">المنتجات النشطة</p>
                <p className="font-semibold text-gray-900">{storeSetup.activeProductsCountLabel}</p>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-gray-900">التقدم نحو النوع التالي</p>
              <span className="text-xs text-gray-500">{storeSetup.progress.percentage}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden mb-3">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-600"
                style={{ width: `${storeSetup.progress.percentage}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 leading-6">{storeSetup.progress.headline}</p>
          </div>
        )}

        {/* Trust Indicators Row */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-4 text-sm text-gray-500">
          {/* Rating */}
          {totalReviews > 0 ? (
            <div className="flex items-center gap-1.5">
              <SimpleRating rating={averageRating} size="sm" showValue />
              <span className="text-gray-400">({totalReviews})</span>
            </div>
          ) : (
            <span className="text-gray-400">No reviews yet</span>
          )}

          {/* Years in Market */}
          {yearsInMarket && (
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4" />
              <span>{yearsInMarket} in market</span>
            </div>
          )}

          {/* Response Time (placeholder) */}
          {store.response_time_hours && (
            <div className="flex items-center gap-1.5">
              <BoltIcon className="w-4 h-4 text-green-500" />
              <span>Responds in ~{store.response_time_hours}h</span>
            </div>
          )}
        </div>

        {/* Location & Contact Row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6">
          {store.city && (
            <div className="flex items-center gap-1.5">
              <MapPinIcon className="w-4 h-4 flex-shrink-0" />
              <span>{store.city}{store.address ? `, ${store.address}` : ''}</span>
            </div>
          )}
          {store.min_order_value && (
            <div className="flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4 flex-shrink-0" />
              <span>Min. order: {store.min_order_value}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {/* Follow Button */}
          <button
            onClick={handleFollowStore}
            disabled={followLoading}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all disabled:opacity-50 ${
              isFollowing
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {followLoading ? (
              <LoadingSpinner size="sm" />
            ) : isFollowing ? (
              <BellSlashIcon className="w-4 h-4" />
            ) : (
              <BellIcon className="w-4 h-4" />
            )}
            {isFollowing ? 'Following' : 'Follow Store'}
          </button>

          {/* Call Seller */}
          {store.phone && (
            <button
              onClick={handleCallSeller}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
            >
              <PhoneIcon className="w-4 h-4" />
              Call Seller
            </button>
          )}

          {/* Send Message */}
          <button
            onClick={handleSendMessage}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
          >
            <ChatBubbleLeftRightIcon className="w-4 h-4" />
            Send Message
          </button>

          {/* Email */}
          {store.email && (
            <a
              href={`mailto:${store.email}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
            >
              <EnvelopeIcon className="w-4 h-4" />
              Email
            </a>
          )}
        </div>
      </div>

      {/* ===== PRODUCTS SECTION ===== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Products
              <span className="text-gray-400 font-normal ml-1">({totalProducts})</span>
            </h2>
          </div>

          {/* Sort Dropdown (Desktop) */}
          <div className="hidden sm:flex items-center gap-3">
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setProductPage(1) }}
              className="input text-sm py-2"
              aria-label="Sort products"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Search & Category Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Search */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products in this store..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="input pl-12 pr-10 py-2.5"
              aria-label="Search products in store"
            />
            {productSearch && (
              <button
                type="button"
                onClick={() => { setProductSearch(''); setProductPage(1) }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                aria-label="Clear search"
              >
                <XMarkIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </form>

          {/* Mobile Filter Toggle */}
          <button
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className="sm:hidden inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <FunnelIcon className="w-4 h-4" />
            Filters
          </button>
        </div>

        {/* Category Pills + Sort (Mobile) */}
        <div className={`${mobileFiltersOpen ? 'block' : 'hidden'} sm:block mb-6`}>
          {/* Category Pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin mb-3">
            {PRODUCT_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => { setCategoryFilter(cat.id); setProductPage(1) }}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  categoryFilter === cat.id
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat.emoji && <span className="mr-1">{cat.emoji}</span>}
                {cat.label}
              </button>
            ))}
          </div>

          {/* Active Filters Display */}
          {(categoryFilter !== 'all' || productSearch) && (
            <div className="flex flex-wrap gap-2 mb-3">
              {productSearch && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs">
                  Search: "{productSearch}"
                  <button onClick={() => { setProductSearch(''); setProductPage(1) }} className="hover:text-green-900">
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </span>
              )}
              {categoryFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs">
                  {PRODUCT_CATEGORIES.find(c => c.id === categoryFilter)?.emoji} {PRODUCT_CATEGORIES.find(c => c.id === categoryFilter)?.label}
                  <button onClick={() => { setCategoryFilter('all'); setProductPage(1) }} className="hover:text-green-900">
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button onClick={clearProductFilters} className="text-xs text-green-600 hover:underline">
                Clear all
              </button>
            </div>
          )}

          {/* Sort (Mobile) */}
          <div className="sm:hidden">
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setProductPage(1) }}
              className="input text-sm py-2 w-full"
              aria-label="Sort products"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Products Grid */}
        {productsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
                <div className="aspect-[4/3] bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-6 bg-gray-200 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Pagination */}
            {totalProducts > PRODUCTS_PER_PAGE && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setProductPage(p => Math.max(1, p - 1))}
                  disabled={productPage === 1}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500 px-3">
                  Page {productPage} of {Math.ceil(totalProducts / PRODUCTS_PER_PAGE)}
                </span>
                <button
                  onClick={() => setProductPage(p => Math.min(Math.ceil(totalProducts / PRODUCTS_PER_PAGE), p + 1))}
                  disabled={productPage >= Math.ceil(totalProducts / PRODUCTS_PER_PAGE)}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : (
          <Card className="p-12 text-center">
            <MagnifyingGlassIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-500 mb-4">
              {productSearch || categoryFilter !== 'all'
                ? 'Try adjusting your filters or search terms'
                : 'This store doesn\'t have any products yet'}
            </p>
            {(productSearch || categoryFilter !== 'all') && (
              <button onClick={clearProductFilters} className="btn-primary">
                Clear Filters
              </button>
            )}
          </Card>
        )}
      </div>

      {/* ===== LOCATION MAP ===== */}
      {(store.latitude || store.longitude || store.city) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Store Location</h2>
          <Card className="overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
              {/* Location Info */}
              <div className="p-6 bg-gray-50 lg:col-span-1">
                <h3 className="font-semibold text-gray-900 text-lg mb-4">{displayName}</h3>
                <div className="space-y-3">
                  {store.city && (
                    <div className="flex items-start gap-3 text-sm">
                      <MapPinIcon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-500">Address</p>
                        <p className="text-gray-900 font-medium">
                          {store.address ? `${store.address}, ` : ''}{store.city}{store.country ? `, ${store.country}` : ''}
                        </p>
                      </div>
                    </div>
                  )}
                  {store.phone && (
                    <div className="flex items-start gap-3 text-sm">
                      <PhoneIcon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-500">Phone</p>
                        <a href={`tel:${store.phone}`} className="text-green-600 hover:underline font-medium">
                          {store.phone}
                        </a>
                      </div>
                    </div>
                  )}
                  {store.email && (
                    <div className="flex items-start gap-3 text-sm">
                      <EnvelopeIcon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-500">Email</p>
                        <a href={`mailto:${store.email}`} className="text-green-600 hover:underline font-medium">
                          {store.email}
                        </a>
                      </div>
                    </div>
                  )}
                  {/* Open/Closed Status */}
                  <div className="flex items-start gap-3 text-sm">
                    <ClockIcon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gray-500">Status</p>
                      {isVendorOpen === null ? (
                        <p className="text-gray-400 text-sm">Checking...</p>
                      ) : isVendorOpen ? (
                        <p className="text-green-600 font-semibold flex items-center gap-1">
                          <CheckCircleIcon className="w-4 h-4" />
                          Open Now
                        </p>
                      ) : (
                        <p className="text-red-600 font-semibold flex items-center gap-1">
                          <XMarkIcon className="w-4 h-4" />
                          Closed
                        </p>
                      )}
                    </div>
                  </div>
                  {store.business_hours && (
                    <div className="flex items-start gap-3 text-sm">
                      <ClockIcon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-500">Business Hours</p>
                        <p className="text-gray-900 font-medium">{store.business_hours}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Map */}
              <div className="lg:col-span-2">
                <Map
                  center={[
                    store.latitude || 33.5731,
                    store.longitude || -7.5898
                  ]}
                  zoom={12}
                  markers={
                    store.latitude && store.longitude
                      ? [{
                          lat: store.latitude,
                          lng: store.longitude,
                          popup: displayName
                        }]
                      : []
                  }
                  height="350px"
                />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ===== REVIEWS SECTION ===== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <h2 className="text-xl font-bold text-gray-900 mb-6">
          Reviews
          <span className="text-gray-400 font-normal ml-1">({totalReviews})</span>
        </h2>

        {/* Rating Summary */}
        <Card className="p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center">
                <span className="text-3xl font-bold text-yellow-500">
                  {averageRating > 0 ? averageRating.toFixed(1) : '—'}
                </span>
              </div>
              <div>
                <SimpleRating rating={averageRating} size="lg" />
                <p className="text-sm text-gray-500 mt-1">
                  {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Write Review */}
        {user ? (
          <Card className="p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Write a Review</h3>
            <div className="mb-4">
              <p className="block text-sm font-medium text-gray-700 mb-2">Rating</p>
              <StarRating
                rating={userRating}
                size="lg"
                onRate={(rating) => setUserRating(rating)}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="store-review-text" className="block text-sm font-medium text-gray-700 mb-2">
                Your Review (optional)
              </label>
              <textarea
                id="store-review-text"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                placeholder="Share your experience with this store..."
              />
            </div>
            <button
              onClick={handleSubmitReview}
              disabled={submittingReview || userRating === 0}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingReview ? 'Submitting...' : 'Submit Review'}
            </button>
          </Card>
        ) : (
          <Card className="p-6 mb-6 bg-blue-50 border-blue-200 text-center">
            <p className="text-blue-800">
              Please{' '}
              <Link to="/login" className="font-semibold underline hover:text-blue-600">
                login
              </Link>
              {' '}to write a review
            </p>
          </Card>
        )}

        {/* Reviews List */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <Card className="p-12 text-center">
              <ChatBubbleLeftRightIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No reviews yet</h3>
              <p className="text-gray-500">Be the first to review this store</p>
            </Card>
          ) : (
            reviews.map((review) => (
              <Card key={review.id} className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-bold text-sm">
                        {review.reviewer?.first_name?.[0]}{review.reviewer?.last_name?.[0] || 'U'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {review.reviewer ? `${review.reviewer.first_name} ${review.reviewer.last_name}` : 'User'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(review.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <StarRating rating={review.rating} size="sm" />
                </div>
                {review.comment && (
                  <p className="text-gray-600 leading-relaxed">{review.comment}</p>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// Wrap with Error Boundary to prevent page crashes
const StoreDetailWithErrorBoundary = () => (
  <ErrorBoundary componentName="StoreDetailPage">
    <StoreDetail />
  </ErrorBoundary>
)

export default StoreDetailWithErrorBoundary
