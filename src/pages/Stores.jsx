import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/services/supabase'
import { Card, LoadingSpinner, SimpleRating } from '@/components/ui'
import ErrorBoundary from '@/components/ErrorBoundary'
import {
  MagnifyingGlassIcon,
  MapPinIcon,
  AdjustmentsHorizontalIcon,
  XMarkIcon,
  CheckBadgeIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const SPECIALTY_OPTIONS = [
  { id: 'plants', label: 'Plants', emoji: '🌿' },
  { id: 'vegetables', label: 'Vegetables', emoji: '🥬' },
  { id: 'fruits', label: 'Fruits', emoji: '🍎' },
  { id: 'herbs', label: 'Herbs', emoji: '🌱' },
  { id: 'seeds', label: 'Seeds', emoji: '🌰' },
]

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest First' },
  { id: 'oldest', label: 'Oldest First' },
  { id: 'highest_rated', label: 'Highest Rated' },
  { id: 'most_reviewed', label: 'Most Reviewed' },
]

const Stores = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [cityFilter, setCityFilter] = useState(searchParams.get('city') || '')
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '')
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest')
  const [storeRatings, setStoreRatings] = useState({})
  const [storeCategories, setStoreCategories] = useState({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [error, setError] = useState(null)
  const [searchTimeout, setSearchTimeout] = useState(null)

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (cityFilter) params.set('city', cityFilter)
    if (categoryFilter) params.set('category', categoryFilter)
    if (sortBy !== 'newest') params.set('sort', sortBy)
    setSearchParams(params)
  }, [search, cityFilter, categoryFilter, sortBy])

  // Sync from URL changes (browser back/forward)
  useEffect(() => {
    setSearch(searchParams.get('search') || '')
    setCityFilter(searchParams.get('city') || '')
    setCategoryFilter(searchParams.get('category') || '')
    setSortBy(searchParams.get('sort') || 'newest')
  }, [searchParams])

  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) clearTimeout(searchTimeout)
    }
  }, [searchTimeout])

  useEffect(() => {
    loadStores()
  }, [])

  const loadStores = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'vendor')
        .order('created_at', { ascending: false })

      if (error) throw error
      setStores(data || [])

      // Batch fetch ratings and categories (NOT N+1!)
      if (data && data.length > 0) {
        const vendorIds = data.map(s => s.id)

        // Fetch all reviews at once
        const { data: allReviews } = await supabase
          .from('reviews')
          .select('vendor_id, rating')
          .in('vendor_id', vendorIds)
          .eq('is_flagged', false)
          .is('deleted_at', null)

        // Fetch all product categories at once
        const { data: allProducts } = await supabase
          .from('products')
          .select('vendor_id, category')
          .in('vendor_id', vendorIds)
          .eq('is_available', true)

        // Process reviews into ratings
        const ratings = {}
        vendorIds.forEach(id => { ratings[id] = { average: 0, count: 0 } })

        if (allReviews && allReviews.length > 0) {
          const grouped = allReviews.reduce((acc, r) => {
            if (!acc[r.vendor_id]) acc[r.vendor_id] = []
            acc[r.vendor_id].push(r.rating)
            return acc
          }, {})

          Object.entries(grouped).forEach(([vendorId, ratingsList]) => {
            ratings[vendorId] = {
              average: ratingsList.reduce((a, b) => a + b, 0) / ratingsList.length,
              count: ratingsList.length
            }
          })
        }

        // Process products into categories
        const categories = {}
        vendorIds.forEach(id => { categories[id] = [] })

        if (allProducts && allProducts.length > 0) {
          const grouped = allProducts.reduce((acc, p) => {
            if (!acc[p.vendor_id]) acc[p.vendor_id] = new Set()
            acc[p.vendor_id].add(p.category)
            return acc
          }, {})

          Object.entries(grouped).forEach(([vendorId, catSet]) => {
            categories[vendorId] = [...catSet]
          })
        }

        setStoreRatings(ratings)
        setStoreCategories(categories)
      }
    } catch (error) {
      logger.error('Error loading stores:', error)
      setError('Failed to load stores. Please try again.')
      toast.error('Failed to load stores')
    } finally {
      setLoading(false)
    }
  }

  const filteredAndSortedStores = useMemo(() => {
    let result = stores.filter(store => {
      const matchesSearch = search === '' ||
        store.store_name?.toLowerCase().includes(search.toLowerCase()) ||
        store.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        store.last_name?.toLowerCase().includes(search.toLowerCase())
      const matchesCity = cityFilter === '' || store.city?.toLowerCase().includes(cityFilter.toLowerCase())
      const matchesCategory = categoryFilter === '' || (storeCategories[store.id] || []).includes(categoryFilter)
      return matchesSearch && matchesCity && matchesCategory
    })

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at)
        case 'highest_rated':
          return (storeRatings[b.id]?.average || 0) - (storeRatings[a.id]?.average || 0)
        case 'most_reviewed':
          return (storeRatings[b.id]?.count || 0) - (storeRatings[a.id]?.count || 0)
        case 'newest':
        default:
          return new Date(b.created_at) - new Date(a.created_at)
      }
    })

    return result
  }, [stores, search, cityFilter, categoryFilter, sortBy, storeRatings, storeCategories])

  const cities = useMemo(() => [...new Set(stores.map(s => s.city).filter(Boolean))], [stores])

  const activeSpecialtyTags = useMemo(() => {
    const allCats = new Set(Object.values(storeCategories).flat())
    return SPECIALTY_OPTIONS.filter(opt => allCats.has(opt.id))
  }, [storeCategories])

  const clearAllFilters = () => {
    setSearch('')
    setCityFilter('')
    setCategoryFilter('')
    setSortBy('newest')
  }

  const hasActiveFilters = search || cityFilter || categoryFilter || sortBy !== 'newest'

  // Debounced search handler
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value
    setSearch(value)

    if (searchTimeout) clearTimeout(searchTimeout)

    const timeout = setTimeout(() => {
      // URL update handled by useEffect
    }, 500)

    setSearchTimeout(timeout)
  }, [searchTimeout])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <XMarkIcon className="w-10 h-10 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
        <p className="text-gray-500 mb-6">{error}</p>
        <button onClick={loadStores} className="btn-primary">Try Again</button>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          {t('stores.title', 'All Stores')}
        </h1>
        <p className="text-gray-600">
          {t('stores.browseStores', 'Browse {{count}} stores on Qotoof', { count: stores.length })}
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={t('stores.searchPlaceholder', 'Search stores by name...')}
            value={search}
            onChange={handleSearchChange}
            className="input pl-12 pr-4 py-3 text-base"
            aria-label={t('stores.searchLabel', 'Search stores')}
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* City Filter */}
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="input text-sm py-2"
          aria-label="Filter by city"
        >
          <option value="">All Cities</option>
          {cities.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="input text-sm py-2"
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {activeSpecialtyTags.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.emoji} {cat.label}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="input text-sm py-2"
          aria-label="Sort stores"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-green-600 hover:underline flex items-center gap-1"
            aria-label="Clear all filters"
          >
            <XMarkIcon className="w-4 h-4" />
            Clear all
          </button>
        )}

        {/* Mobile Filters Toggle */}
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="lg:hidden ml-auto flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          aria-label="Toggle filters"
        >
          <AdjustmentsHorizontalIcon className="w-5 h-5" />
          Filters
        </button>
      </div>

      {/* Active Filter Tags */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mb-4">
          {cityFilter && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
              <MapPinIcon className="w-3.5 h-3.5" />
              {cityFilter}
              <button onClick={() => setCityFilter('')} className="hover:text-green-900" aria-label="Remove city filter">
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          )}
          {categoryFilter && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm">
              {SPECIALTY_OPTIONS.find(c => c.id === categoryFilter)?.emoji} {SPECIALTY_OPTIONS.find(c => c.id === categoryFilter)?.label}
              <button onClick={() => setCategoryFilter('')} className="hover:text-green-900" aria-label="Remove category filter">
                <XMarkIcon className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Stores Grid */}
      {filteredAndSortedStores.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedStores.map((store) => {
            const rating = storeRatings[store.id] || { average: 0, count: 0 }
            const categories = storeCategories[store.id] || []
            const displayName = store.store_name || `${store.first_name} ${store.last_name}`
            const storeLogo = store.store_logo

            return (
              <Card
                key={store.id}
                className="group cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100"
                onClick={() => navigate(`/stores/${store.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/stores/${store.id}`)
                  }
                }}
                tabIndex={0}
                role="link"
                aria-label={t('stores.visitStoreCard', 'Visit store: {{storeName}}', { storeName: displayName })}
              >
                {/* Store Image / Placeholder */}
                <div className="relative aspect-video bg-gradient-to-br from-green-100 to-emerald-50 rounded-t-xl overflow-hidden">
                  {storeLogo ? (
                    <img
                      src={storeLogo}
                      alt={displayName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-5xl font-bold text-green-300">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Verified Badge */}
                  {store.is_verified && (
                    <div className="absolute top-3 right-3">
                      <CheckBadgeIcon className="w-7 h-7 text-green-500 drop-shadow-sm" />
                    </div>
                  )}

                  {/* Online/Offline Indicator */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full shadow-sm">
                    <span className={`w-2 h-2 rounded-full ${store.is_online ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                    <span className="text-xs text-gray-600">{store.is_online ? 'Online' : 'Offline'}</span>
                  </div>
                </div>

                {/* Store Info */}
                <div className="p-4">
                  {/* Store Name */}
                  <h3 className="font-semibold text-gray-900 text-lg mb-1 group-hover:text-green-600 transition-colors">
                    {displayName}
                  </h3>

                  {/* Location */}
                  {store.city && (
                    <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                      <MapPinIcon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{store.city}{store.country ? `, ${store.country}` : ''}</span>
                    </div>
                  )}

                  {/* Specialty Tags */}
                  {categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {categories.slice(0, 3).map(catId => {
                        const cat = SPECIALTY_OPTIONS.find(c => c.id === catId)
                        return cat ? (
                          <span
                            key={catId}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs font-medium"
                          >
                            {cat.emoji} {cat.label}
                          </span>
                        ) : null
                      })}
                      {categories.length > 3 && (
                        <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md text-xs">
                          +{categories.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  {store.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3">{store.description}</p>
                  )}

                  {/* Rating & CTA */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      {rating.count > 0 ? (
                        <>
                          <SimpleRating rating={rating.average} size="sm" showValue />
                          <span className="text-xs text-gray-400">({rating.count})</span>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">No reviews yet</span>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600 group-hover:gap-2 transition-all">
                      Visit Store
                      <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                    </span>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MagnifyingGlassIcon className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {t('stores.empty.title', 'No stores found')}
          </h3>
          <p className="text-gray-500 mb-4">
            {t('stores.empty.description', 'Try adjusting your filters or search terms')}
          </p>
          {hasActiveFilters && (
            <button onClick={clearAllFilters} className="btn-primary">
              {t('stores.empty.clearFilters', 'Clear Filters')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// Wrap with Error Boundary to prevent page crashes
const StoresWithErrorBoundary = () => (
  <ErrorBoundary componentName="StoresPage">
    <Stores />
  </ErrorBoundary>
)

export default StoresWithErrorBoundary
