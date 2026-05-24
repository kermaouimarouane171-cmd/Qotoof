import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/services/supabase'
import { runProductImageFallbackQuery } from '@/services/productImages'
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
import { isPublicVendorVisible } from '@/utils/publicVisibility'

const PRODUCT_CATEGORIES = [
  { id: 'all', defaultLabel: 'All Products' },
  { id: 'plants', defaultLabel: 'Plants & Trees', emoji: '🌿' },
  { id: 'vegetables', defaultLabel: 'Vegetables', emoji: '🥬' },
  { id: 'fruits', defaultLabel: 'Fruits', emoji: '🍎' },
  { id: 'herbs', defaultLabel: 'Herbs', emoji: '🌱' },
  { id: 'seeds', defaultLabel: 'Seeds', emoji: '🌰' },
]

const SORT_OPTIONS = [
  { id: 'newest', defaultLabel: 'Newest First' },
  { id: 'priceLow', defaultLabel: 'Price: Low to High' },
  { id: 'priceHigh', defaultLabel: 'Price: High to Low' },
  { id: 'name', defaultLabel: 'Name A-Z' },
]

const PRODUCTS_PER_PAGE = 12

const getTextLocale = (language = 'en') => {
  if (language.startsWith('ar')) return 'ar-MA'
  if (language.startsWith('fr')) return 'fr-FR'
  return 'en-US'
}

const StoreDetail = () => {
  const { t, i18n } = useTranslation()
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
  const displayName = store?.store_name || [store?.first_name, store?.last_name].filter(Boolean).join(' ').trim()
  const textLocale = useMemo(() => getTextLocale(i18n.resolvedLanguage || i18n.language || 'en'), [i18n.language, i18n.resolvedLanguage])
  const numberFormatter = useMemo(() => new Intl.NumberFormat(textLocale), [textLocale])
  const localizedProductCategories = useMemo(() => PRODUCT_CATEGORIES.map((category) => ({
    ...category,
    label: t(`storeDetail.products.categories.${category.id}`, category.defaultLabel),
  })), [t])
  const localizedSortOptions = useMemo(() => SORT_OPTIONS.map((option) => ({
    ...option,
    label: t(`storeDetail.products.sortOptions.${option.id}`, option.defaultLabel),
  })), [t])

  // Load store info
  const loadStore = useCallback(async () => {
    setLoading(true)
    setStoreError(false)
    setNotFound(false)
    const loadStoreFailedMessage = t('storeDetail.error.loadStoreFailed', 'Failed to load store information. Please try again.')
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

      if (!isPublicVendorVisible(data)) {
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
      toast.error(loadStoreFailedMessage)
    } finally {
      setLoading(false)
    }
  }, [id, t])

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
      document.title = t('storeDetail.meta.title', '{{storeName}} | Qotoof Stores - قطوف', { storeName: displayName })

      let metaDescription = document.querySelector('meta[name="description"]')
      if (!metaDescription) {
        metaDescription = document.createElement('meta')
        metaDescription.name = 'description'
        document.head.appendChild(metaDescription)
      }
      metaDescription.content = store.description || t('storeDetail.meta.defaultDescription', '{{storeName}} - Store on Qotoof marketplace', { storeName: displayName })

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
      script.textContent = JSON.stringify(jsonLd)
      document.head.appendChild(script)

      return () => { script.remove() }
    }
  }, [store, averageRating, totalReviews, displayName, t, i18n.language])

  const loadProducts = useCallback(async () => {
    setProductsLoading(true)
    const loadProductsFailedMessage = t('storeDetail.error.loadProductsFailed', 'Failed to load products')
    try {
      const buildQuery = (selectClause) => {
        let query = supabase
          .from('products')
          .select(selectClause, { count: 'exact' })
          .eq('vendor_id', id)
          .eq('is_available', true)
          .eq('approval_status', 'approved')

        if (categoryFilter !== 'all') {
          query = query.eq('category', categoryFilter)
        }

        if (productSearch) {
          query = query.or(`name.ilike.%${sanitizePostgRESTFilter(productSearch)}%,description.ilike.%${sanitizePostgRESTFilter(productSearch)}%`)
        }

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

        const from = (productPage - 1) * PRODUCTS_PER_PAGE
        const to = from + PRODUCTS_PER_PAGE - 1
        return query.range(from, to)
      }

      const { data, count } = await runProductImageFallbackQuery({
        buildQuery,
        selectWithImages: `
          *,
          product_images(url, is_primary)
        `,
        selectWithoutImages: '*',
        onRelationError: (error) => logger.warn('Store detail: product_images relation missing, hydrating separately', error),
      })

      setProducts(data || [])
      setTotalProducts(count || 0)
    } catch (error) {
      logger.error('Error loading products:', error)
      toast.error(loadProductsFailedMessage)
      setProducts([])
      setTotalProducts(0)
    } finally {
      setProductsLoading(false)
    }
  }, [id, categoryFilter, productSearch, sortBy, productPage, t])

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

  // Debounced auto-search for product search
  useEffect(() => {
    if (!id) return
    const timer = setTimeout(() => {
      setProductPage(1)
      loadProducts()
    }, 400)
    return () => clearTimeout(timer)
  }, [id, productSearch, loadProducts])

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

  const handleFollowStore = async () => {
    if (!user) {
      toast.error(t('storeDetail.actions.loginToFollow', 'Please login to follow stores'))
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
        toast.success(t('storeDetail.actions.unfollowSuccess', 'Unfollowed store'))
      } else {
        await supabase
          .from('store_follows')
          .insert({ user_id: user.id, store_id: id })

        setIsFollowing(true)
        toast.success(t('storeDetail.actions.followSuccess', 'Now following this store!'))
      }
    } catch (error) {
      logger.error('Error toggling follow:', error)
      toast.error(t('storeDetail.error.followUpdateFailed', 'Failed to update follow status'))
    } finally {
      setFollowLoading(false)
    }
  }

  const handleCallSeller = useCallback(() => {
    if (store?.phone) {
      window.location.href = `tel:${store.phone}`
    } else {
      toast.error(t('storeDetail.location.noPhone', 'No phone number available'))
    }
  }, [store?.phone, t])

  const handleSendMessage = () => {
    if (!user) {
      toast.error(t('storeDetail.actions.loginToMessage', 'Please login to send messages'))
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
      toast.success(t('storeDetail.actions.shareCopied', 'Store link copied to clipboard!'))
    }
  }

  const handleSubmitReview = async () => {
    if (!user) {
      toast.error(t('storeDetail.reviews.loginRequired', 'Please login to add a review'))
      return
    }

    if (userRating === 0) {
      toast.error(t('storeDetail.reviews.selectRating', 'Please select a rating'))
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

      toast.success(t('storeDetail.reviews.submitSuccess', 'Review submitted successfully!'))
      setUserRating(0)
      setReviewText('')
      await loadReviews()
    } catch (error) {
      logger.error('Error submitting review:', error)
      toast.error(t('storeDetail.error.submitReviewFailed', 'Failed to submit review'))
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
  const marketTenureLabel = useMemo(() => {
    if (!store?.created_at) return null
    const created = new Date(store.created_at)
    const now = new Date()
    const diffMs = now - created
    const diffYears = diffMs / (365.25 * 24 * 60 * 60 * 1000)
    if (diffYears < 0.25) return t('storeDetail.stats.newInMarket', 'New in market')

    if (diffYears < 1) {
      return t('storeDetail.stats.monthsInMarket', '{{count}} months in market', {
        count: numberFormatter.format(Math.max(Math.floor(diffYears * 12), 1)),
      })
    }

    return t('storeDetail.stats.yearsInMarket', '{{count}}+ years in market', {
      count: numberFormatter.format(Math.floor(diffYears)),
    })
  }, [store?.created_at, t, numberFormatter])

  const businessHoursDisplay = useMemo(() => {
    const hours = store?.business_hours
    if (!hours) return ''

    if (typeof hours === 'string') {
      return hours.trim()
    }

    if (Array.isArray(hours)) {
      return hours.filter(Boolean).join(' • ')
    }

    if (typeof hours === 'object') {
      return Object.entries(hours)
        .filter(([, value]) => Boolean(value))
        .map(([day, value]) => {
          if (Array.isArray(value)) {
            return `${day}: ${value.filter(Boolean).join(', ')}`
          }

          if (typeof value === 'object') {
            return `${day}: ${Object.values(value).filter(Boolean).join(' - ')}`
          }

          return `${day}: ${value}`
        })
        .join(' • ')
    }

    return ''
  }, [store?.business_hours])

  const storeSetup = useMemo(() => storeTypeService.decorateStoreProfile(store), [store])
  const localizedStoreSetup = useMemo(() => {
    if (!storeSetup) return null

    const storeTypeLabel = t(`storeDetail.setup.storeTypes.${storeSetup.storeType}`, storeSetup.storeTypeLabel || '')
    const deliveryOptionLabel = t(`storeDetail.setup.deliveryOptions.${storeSetup.deliveryOption}`, storeSetup.deliveryOptionMeta?.label || '')
    const nextStoreTypeLabel = storeSetup.progress?.nextStoreType
      ? t(`storeDetail.setup.storeTypes.${storeSetup.progress.nextStoreType}`, storeSetup.progress.nextStoreTypeLabel || '')
      : ''

    const progressHeadline = !storeSetup.progress?.nextStoreType
      ? t('storeDetail.setup.progress.complete', 'Your store has reached the highest available tier.')
      : t('storeDetail.setup.progress.headline', '{{count}} products left to reach {{nextStoreType}}.', {
          count: numberFormatter.format(storeSetup.progress.remainingProducts || 0),
          nextStoreType: nextStoreTypeLabel,
        })

    return {
      storeTypeLabel,
      deliveryOptionLabel,
      activeProductsCountLabel: t('storeDetail.setup.activeProductsCountValue', '{{count}} products', {
        count: numberFormatter.format(storeSetup.activeProductsCount || 0),
      }),
      progressHeadline,
    }
  }, [storeSetup, t, numberFormatter])
  const minOrderLabel = useMemo(() => {
    if (!store?.min_order_value) return ''
    return t('storeDetail.stats.minOrder', 'Min. order: {{amount}}', { amount: store.min_order_value })
  }, [store?.min_order_value, t])
  const formatReviewDate = useCallback((value) => new Date(value).toLocaleDateString(textLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }), [textLocale])

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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('storeDetail.notFound.title', 'Store not found')}</h2>
        <p className="text-gray-500 mb-6">{t('storeDetail.notFound.description', 'The store you\'re looking for doesn\'t exist or has been removed.')}</p>
        <button onClick={() => navigate('/stores')} className="btn-primary">
          <ArrowLeftIcon className="w-5 h-5 mr-2" />
          {t('storeDetail.actions.backToStores', 'Back to Stores')}
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('storeDetail.error.title', 'Something went wrong')}</h2>
        <p className="text-gray-500 mb-6">{t('storeDetail.error.loadStoreFailed', 'Failed to load store information. Please try again.')}</p>
        <button onClick={loadStore} className="btn-primary">{t('storeDetail.error.tryAgain', 'Try Again')}</button>
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
          aria-label={t('storeDetail.actions.backToStores', 'Back to stores')}
        >
          <ArrowLeftIcon className="w-5 h-5 text-gray-700" />
        </button>

        {/* Share button */}
        <button
          onClick={handleShareStore}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
          aria-label={t('storeDetail.actions.shareStore', 'Share store')}
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
              {t('storeDetail.badges.verifiedStore', 'Verified Store')}
            </span>
          )}
        </div>

        {/* Description */}
        {store.description && (
          <p className="text-gray-600 mb-4 max-w-2xl">{store.description}</p>
        )}

        {storeSetup && localizedStoreSetup && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 mb-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                <SparklesIcon className="w-4 h-4" />
                {localizedStoreSetup.storeTypeLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                <TruckIcon className="w-4 h-4" />
                {localizedStoreSetup.deliveryOptionLabel}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">{t('storeDetail.setup.storeType', 'Store type')}</p>
                <p className="font-semibold text-gray-900">{localizedStoreSetup.storeTypeLabel}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">{t('storeDetail.setup.deliveryOption', 'Delivery option')}</p>
                <p className="font-semibold text-gray-900">{localizedStoreSetup.deliveryOptionLabel}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">{t('storeDetail.setup.activeProducts', 'Active products')}</p>
                <p className="font-semibold text-gray-900">{localizedStoreSetup.activeProductsCountLabel}</p>
              </div>
            </div>

            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-gray-900">{t('storeDetail.setup.nextTierProgress', 'Progress to next tier')}</p>
              <span className="text-xs text-gray-500">{storeSetup.progress.percentage}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden mb-3">
              <div
                className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-600"
                style={{ width: `${storeSetup.progress.percentage}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 leading-6">{localizedStoreSetup.progressHeadline}</p>
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
            <span className="text-gray-400">{t('storeDetail.stats.noReviews', 'No reviews yet')}</span>
          )}

          {/* Years in Market */}
          {marketTenureLabel && (
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4" />
              <span>{marketTenureLabel}</span>
            </div>
          )}

          {/* Response Time (placeholder) */}
          {store.response_time_hours && (
            <div className="flex items-center gap-1.5">
              <BoltIcon className="w-4 h-4 text-green-500" />
              <span>{t('storeDetail.stats.respondsIn', 'Responds in ~{{hours}}h', { hours: store.response_time_hours })}</span>
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
              <span>{minOrderLabel}</span>
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
            {isFollowing ? t('storeDetail.actions.following', 'Following') : t('storeDetail.actions.followStore', 'Follow Store')}
          </button>

          {/* Call Seller */}
          {store.phone && (
            <button
              onClick={handleCallSeller}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
            >
              <PhoneIcon className="w-4 h-4" />
              {t('storeDetail.actions.callSeller', 'Call Seller')}
            </button>
          )}

          {/* Send Message */}
          <button
            onClick={handleSendMessage}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
          >
            <ChatBubbleLeftRightIcon className="w-4 h-4" />
            {t('storeDetail.actions.sendMessage', 'Send Message')}
          </button>

          {/* Email */}
          {store.email && (
            <a
              href={`mailto:${store.email}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
            >
              <EnvelopeIcon className="w-4 h-4" />
                {t('storeDetail.location.email', 'Email')}
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
              {t('storeDetail.products.title', 'Products')}
              <span className="text-gray-400 font-normal ml-1">({totalProducts})</span>
            </h2>
          </div>

          {/* Sort Dropdown (Desktop) */}
          <div className="hidden sm:flex items-center gap-3">
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setProductPage(1) }}
              className="input text-sm py-2"
              aria-label={t('storeDetail.products.sortAria', 'Sort products')}
            >
              {localizedSortOptions.map(opt => (
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
              placeholder={t('storeDetail.products.searchPlaceholder', 'Search products in this store...')}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="input pl-12 pr-10 py-2.5"
              aria-label={t('storeDetail.products.searchLabel', 'Search products in store')}
            />
            {productSearch && (
              <button
                type="button"
                onClick={() => { setProductSearch(''); setProductPage(1) }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                aria-label={t('storeDetail.actions.clearSearch', 'Clear search')}
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
            {t('storeDetail.products.filters', 'Filters')}
          </button>
        </div>

        {/* Category Pills + Sort (Mobile) */}
        <div className={`${mobileFiltersOpen ? 'block' : 'hidden'} sm:block mb-6`}>
          {/* Category Pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin mb-3">
            {localizedProductCategories.map(cat => (
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
                  {t('storeDetail.products.searchTag', 'Search: "{{query}}"', { query: productSearch })}
                  <button onClick={() => { setProductSearch(''); setProductPage(1) }} className="hover:text-green-900">
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </span>
              )}
              {categoryFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs">
                  {localizedProductCategories.find(c => c.id === categoryFilter)?.emoji} {localizedProductCategories.find(c => c.id === categoryFilter)?.label}
                  <button onClick={() => { setCategoryFilter('all'); setProductPage(1) }} className="hover:text-green-900">
                    <XMarkIcon className="w-3 h-3" />
                  </button>
                </span>
              )}
              <button onClick={clearProductFilters} className="text-xs text-green-600 hover:underline">
                {t('storeDetail.actions.clearAll', 'Clear all')}
              </button>
            </div>
          )}

          {/* Sort (Mobile) */}
          <div className="sm:hidden">
            <select
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setProductPage(1) }}
              className="input text-sm py-2 w-full"
              aria-label={t('storeDetail.products.sortAria', 'Sort products')}
            >
              {localizedSortOptions.map(opt => (
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
                  {t('storeDetail.products.pagination.previous', 'Previous')}
                </button>
                <span className="text-sm text-gray-500 px-3">
                  {t('storeDetail.products.pagination.page', 'Page {{current}} of {{total}}', {
                    current: numberFormatter.format(productPage),
                    total: numberFormatter.format(Math.ceil(totalProducts / PRODUCTS_PER_PAGE)),
                  })}
                </span>
                <button
                  onClick={() => setProductPage(p => Math.min(Math.ceil(totalProducts / PRODUCTS_PER_PAGE), p + 1))}
                  disabled={productPage >= Math.ceil(totalProducts / PRODUCTS_PER_PAGE)}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors"
                >
                  {t('storeDetail.products.pagination.next', 'Next')}
                </button>
              </div>
            )}
          </>
        ) : (
          <Card className="p-12 text-center">
            <MagnifyingGlassIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('storeDetail.products.emptyTitle', 'No products found')}</h3>
            <p className="text-gray-500 mb-4">
              {productSearch || categoryFilter !== 'all'
                ? t('storeDetail.products.emptyFiltered', 'Try adjusting your filters or search terms')
                : t('storeDetail.products.emptyInitial', 'This store doesn\'t have any products yet')}
            </p>
            {(productSearch || categoryFilter !== 'all') && (
              <button onClick={clearProductFilters} className="btn-primary">
                {t('storeDetail.actions.clearFilters', 'Clear Filters')}
              </button>
            )}
          </Card>
        )}
      </div>

      {/* ===== LOCATION MAP ===== */}
      {(store.latitude || store.longitude || store.city) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-4">{t('storeDetail.location.title', 'Store Location')}</h2>
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
                        <p className="text-gray-500">{t('storeDetail.location.address', 'Address')}</p>
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
                        <p className="text-gray-500">{t('storeDetail.location.phone', 'Phone')}</p>
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
                        <p className="text-gray-500">{t('storeDetail.location.email', 'Email')}</p>
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
                      <p className="text-gray-500">{t('storeDetail.location.status', 'Status')}</p>
                      {isVendorOpen === null ? (
                        <p className="text-gray-400 text-sm">{t('storeDetail.location.checking', 'Checking...')}</p>
                      ) : isVendorOpen ? (
                        <p className="text-green-600 font-semibold flex items-center gap-1">
                          <CheckCircleIcon className="w-4 h-4" />
                          {t('storeDetail.location.openNow', 'Open Now')}
                        </p>
                      ) : (
                        <p className="text-red-600 font-semibold flex items-center gap-1">
                          <XMarkIcon className="w-4 h-4" />
                          {t('storeDetail.location.closed', 'Closed')}
                        </p>
                      )}
                    </div>
                  </div>
                  {businessHoursDisplay && (
                    <div className="flex items-start gap-3 text-sm">
                      <ClockIcon className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-gray-500">{t('storeDetail.location.businessHours', 'Business Hours')}</p>
                        <p className="text-gray-900 font-medium">{businessHoursDisplay}</p>
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
          {t('storeDetail.reviews.title', 'Reviews')}
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
                  {t('storeDetail.reviews.summary', '{{count}} reviews', { count: numberFormatter.format(totalReviews) })}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Write Review */}
        {user ? (
          <Card className="p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('storeDetail.reviews.writeTitle', 'Write a Review')}</h3>
            <div className="mb-4">
              <p className="block text-sm font-medium text-gray-700 mb-2">{t('storeDetail.reviews.ratingLabel', 'Rating')}</p>
              <StarRating
                rating={userRating}
                size="lg"
                onRate={(rating) => setUserRating(rating)}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="store-review-text" className="block text-sm font-medium text-gray-700 mb-2">
                {t('storeDetail.reviews.yourReviewLabel', 'Your Review (optional)')}
              </label>
              <textarea
                id="store-review-text"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                placeholder={t('storeDetail.reviews.yourReviewPlaceholder', 'Share your experience with this store...')}
              />
            </div>
            <button
              onClick={handleSubmitReview}
              disabled={submittingReview || userRating === 0}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submittingReview ? t('storeDetail.reviews.submitting', 'Submitting...') : t('storeDetail.reviews.submit', 'Submit Review')}
            </button>
          </Card>
        ) : (
          <Card className="p-6 mb-6 bg-blue-50 border-blue-200 text-center">
            <p className="text-blue-800">
              {t('storeDetail.reviews.loginPromptPrefix', 'Please')}{' '}
              <Link to="/login" className="font-semibold underline hover:text-blue-600">
                {t('storeDetail.reviews.loginLink', 'login')}
              </Link>
              {' '}{t('storeDetail.reviews.loginPromptSuffix', 'to write a review')}
            </p>
          </Card>
        )}

        {/* Reviews List */}
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <Card className="p-12 text-center">
              <ChatBubbleLeftRightIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('storeDetail.reviews.emptyTitle', 'No reviews yet')}</h3>
              <p className="text-gray-500">{t('storeDetail.reviews.emptyDescription', 'Be the first to review this store')}</p>
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
                        {review.reviewer ? `${review.reviewer.first_name} ${review.reviewer.last_name}` : t('storeDetail.reviews.anonymousUser', 'User')}
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
