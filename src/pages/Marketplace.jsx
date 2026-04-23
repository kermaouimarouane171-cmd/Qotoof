import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ProductCard } from '@/components/ui'
import ErrorBoundary from '@/components/ErrorBoundary'
import SearchBar from '@/components/Search/SearchBar'
import { PRODUCT_CATEGORIES, getSuggestedSubcategories } from '@/constants/categories'
import productSearchService from '@/services/search/productSearchService'
import { FunnelIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import { logger } from '@/utils/logger'

const ITEMS_PER_PAGE = 12

const SORT_OPTIONS = [
  { value: 'newest', label: 'الأحدث' },
  { value: 'price_asc', label: 'السعر: من الأقل' },
  { value: 'price_desc', label: 'السعر: من الأعلى' },
  { value: 'rating_desc', label: 'الأعلى تقييماً' },
  { value: 'name_asc', label: 'الاسم: أ - ي' },
]

const MarketplacePage = () => {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [availableRegions, setAvailableRegions] = useState([])

  const filters = {
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || 'all',
    subcategory: searchParams.get('subcategory') || 'all',
    region: searchParams.get('region') || 'all',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    rating: searchParams.get('rating') || '',
    inStock: searchParams.get('inStock') === 'true',
    sortBy: searchParams.get('sortBy') || 'newest',
    page: Math.max(Number(searchParams.get('page') || '1') || 1, 1),
  }

  const totalPages = Math.max(Math.ceil(totalCount / ITEMS_PER_PAGE), 1)
  const subcategoryOptions = filters.category !== 'all' ? getSuggestedSubcategories(filters.category) : []

  useEffect(() => {
    let cancelled = false

    const loadRegions = async () => {
      const regions = await productSearchService.getAvailableRegions()
      if (!cancelled) setAvailableRegions(regions)
    }

    loadRegions()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadProducts = async () => {
      setLoading(true)
      try {
        const data = await productSearchService.searchProducts({
          query: filters.search,
          category: filters.category,
          subcategory: filters.subcategory,
          region: filters.region,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          rating: filters.rating,
          inStock: filters.inStock,
          sortBy: filters.sortBy,
          page: filters.page - 1,
          hitsPerPage: ITEMS_PER_PAGE,
        })

        if (!cancelled) {
          setProducts(data.hits || [])
          setTotalCount(data.nbHits || 0)
        }
      } catch (error) {
        logger.error('Marketplace: failed to load products', error)
        if (!cancelled) {
          toast.error('تعذر تحميل المنتجات حالياً')
          setProducts([])
          setTotalCount(0)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProducts()
    return () => {
      cancelled = true
    }
  }, [searchParams.toString()])

  const updateParams = (updates, { resetPage = true } = {}) => {
    const nextParams = new URLSearchParams(searchParams)

    if (resetPage) {
      nextParams.delete('page')
    }

    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'page') {
        const nextPage = Number(value) || 1
        if (nextPage <= 1) nextParams.delete('page')
        else nextParams.set('page', String(nextPage))
        return
      }

      if (key === 'inStock') {
        if (value) nextParams.set('inStock', 'true')
        else nextParams.delete('inStock')
        return
      }

      const shouldDelete = value === null || value === undefined || value === '' || value === 'all' || value === false
      if (shouldDelete) nextParams.delete(key)
      else nextParams.set(key, String(value))
    })

    if (Object.prototype.hasOwnProperty.call(updates, 'category')) {
      nextParams.delete('subcategory')
    }

    setSearchParams(nextParams)
  }

  const clearFilters = () => {
    setSearchParams({})
  }

  const categoryTabs = [
    { id: 'all', label: t('marketplace.categories.all', 'كل الفئات') },
    ...PRODUCT_CATEGORIES.map((category) => ({
      id: category.id,
      label: category.labelAr || category.label,
    })),
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          {t('marketplace.title', 'السوق')}
        </h1>
        <p className="text-gray-600">
          {t('marketplace.subtitle', 'ابحث بين المنتجات المعتمدة باستخدام نفس فلاتر البحث المتقدمة في جميع الصفحات')}
        </p>
      </div>

      <div className="mb-6 max-w-3xl">
        <SearchBar
          initialValue={filters.search}
          onSearch={(query) => updateParams({ search: query })}
          className="w-full"
          placeholder={t('marketplace.searchPlaceholder', 'ابحث عن منتج، فئة، أو فئة فرعية...')}
        />
      </div>

      <div className="mb-6 overflow-x-auto scrollbar-thin" role="tablist" aria-label={t('marketplace.categoryTabs', 'فئات المنتجات')}>
        <div className="flex gap-2 pb-2">
          {categoryTabs.map((category) => (
            <button
              key={category.id}
              onClick={() => updateParams({ category: category.id })}
              role="tab"
              aria-selected={filters.category === category.id}
              aria-controls="products-grid"
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filters.category === category.id
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-8">
        <aside className="hidden lg:block w-72 flex-shrink-0" aria-label={t('marketplace.filtersLabel', 'الفلاتر')}>
          <div className="sticky top-24 space-y-6 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{t('marketplace.filtersLabel', 'الفلاتر')}</h3>
              <button
                onClick={clearFilters}
                className="text-sm text-green-600 hover:underline"
                aria-label={t('marketplace.clearAllFilters', 'مسح جميع الفلاتر')}
              >
                {t('marketplace.clearAll', 'مسح الكل')}
              </button>
            </div>

            <div>
              <label htmlFor="subcategory-select" className="input-label">{t('marketplace.subcategory', 'الفئة الفرعية')}</label>
              <select
                id="subcategory-select"
                value={filters.subcategory}
                onChange={(event) => updateParams({ subcategory: event.target.value })}
                className="input"
                disabled={filters.category === 'all'}
              >
                <option value="all">{t('marketplace.allSubcategories', 'كل الفئات الفرعية')}</option>
                {subcategoryOptions.map((subcategory) => (
                  <option key={subcategory} value={subcategory}>{subcategory}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="region-select" className="input-label">{t('marketplace.region', 'المدينة')}</label>
              <select
                id="region-select"
                value={filters.region}
                onChange={(event) => updateParams({ region: event.target.value })}
                className="input"
                disabled={loading}
              >
                <option value="all">{t('marketplace.allRegions', 'كل المدن')}</option>
                {availableRegions.map((region) => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="input-label">{t('marketplace.priceRange', 'نطاق السعر')}</label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder={t('marketplace.min', 'من')}
                  value={filters.minPrice}
                  onChange={(event) => updateParams({ minPrice: event.target.value })}
                  min="0"
                  className="input"
                  disabled={loading}
                  aria-label={t('marketplace.minPrice', 'السعر الأدنى')}
                />
                <input
                  type="number"
                  placeholder={t('marketplace.max', 'إلى')}
                  value={filters.maxPrice}
                  onChange={(event) => updateParams({ maxPrice: event.target.value })}
                  min="0"
                  className="input"
                  disabled={loading}
                  aria-label={t('marketplace.maxPrice', 'السعر الأقصى')}
                />
              </div>
            </div>

            <div>
              <label htmlFor="rating-select" className="input-label">{t('marketplace.rating', 'الحد الأدنى للتقييم')}</label>
              <select
                id="rating-select"
                value={filters.rating}
                onChange={(event) => updateParams({ rating: event.target.value })}
                className="input"
              >
                <option value="">{t('marketplace.anyRating', 'أي تقييم')}</option>
                <option value="4">4+ نجوم</option>
                <option value="3">3+ نجوم</option>
                <option value="2">2+ نجوم</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.inStock}
                onChange={(event) => updateParams({ inStock: event.target.checked })}
                className="accent-green-500"
              />
              {t('marketplace.inStockOnly', 'متوفر حالياً فقط')}
            </label>

            <div>
              <label htmlFor="sort-select" className="input-label">{t('marketplace.sortByLabel', 'الترتيب')}</label>
              <select
                id="sort-select"
                value={filters.sortBy}
                onChange={(event) => updateParams({ sortBy: event.target.value })}
                className="input"
                disabled={loading}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </aside>

        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="lg:hidden fixed bottom-20 right-4 z-30 p-3 bg-green-500 text-white rounded-full shadow-lg"
          aria-label={t('marketplace.openFilters', 'فتح الفلاتر')}
          aria-expanded={filtersOpen}
          aria-controls="mobile-filters-panel"
        >
          <FunnelIcon className="w-6 h-6" />
        </button>

        {filtersOpen && (
          <div
            className="lg:hidden fixed inset-0 z-40"
            role="dialog"
            aria-modal="true"
            aria-label={t('marketplace.filtersPanel', 'خيارات الفلاتر')}
            id="mobile-filters-panel"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              onClick={() => setFiltersOpen(false)}
              aria-label={t('common.close', 'إغلاق')}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">{t('marketplace.filters', 'الفلاتر')}</h3>
                <button onClick={() => setFiltersOpen(false)} aria-label={t('common.close', 'إغلاق')}>
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="input-label">{t('marketplace.subcategory', 'الفئة الفرعية')}</label>
                  <select value={filters.subcategory} onChange={(event) => updateParams({ subcategory: event.target.value })} className="input" disabled={filters.category === 'all'}>
                    <option value="all">{t('marketplace.allSubcategories', 'كل الفئات الفرعية')}</option>
                    {subcategoryOptions.map((subcategory) => (
                      <option key={subcategory} value={subcategory}>{subcategory}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">{t('marketplace.region', 'المدينة')}</label>
                  <select value={filters.region} onChange={(event) => updateParams({ region: event.target.value })} className="input">
                    <option value="all">{t('marketplace.allRegions', 'كل المدن')}</option>
                    {availableRegions.map((region) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="input-label">{t('marketplace.priceRange', 'نطاق السعر')}</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" placeholder={t('marketplace.min', 'من')} value={filters.minPrice} onChange={(event) => updateParams({ minPrice: event.target.value })} min="0" className="input" />
                    <input type="number" placeholder={t('marketplace.max', 'إلى')} value={filters.maxPrice} onChange={(event) => updateParams({ maxPrice: event.target.value })} min="0" className="input" />
                  </div>
                </div>
                <div>
                  <label className="input-label">{t('marketplace.rating', 'الحد الأدنى للتقييم')}</label>
                  <select value={filters.rating} onChange={(event) => updateParams({ rating: event.target.value })} className="input">
                    <option value="">{t('marketplace.anyRating', 'أي تقييم')}</option>
                    <option value="4">4+ نجوم</option>
                    <option value="3">3+ نجوم</option>
                    <option value="2">2+ نجوم</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="checkbox" checked={filters.inStock} onChange={(event) => updateParams({ inStock: event.target.checked })} className="accent-green-500" />
                  {t('marketplace.inStockOnly', 'متوفر حالياً فقط')}
                </label>
                <div>
                  <label className="input-label">{t('marketplace.sortBy', 'الترتيب')}</label>
                  <select value={filters.sortBy} onChange={(event) => updateParams({ sortBy: event.target.value })} className="input">
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <button onClick={() => setFiltersOpen(false)} className="btn-primary w-full">
                  {t('marketplace.showResults', 'عرض {{count}} نتيجة', { count: totalCount })}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" id="products-grid" role="tabpanel" aria-label={t('marketplace.productsGrid', 'قائمة المنتجات')}>
              {[...Array(6)].map((_, index) => (
                <div key={index} className="card animate-pulse">
                  <div className="aspect-square bg-gray-200" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                    <div className="h-6 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length > 0 || totalCount > 0 ? (
            <>
              <p className="text-sm text-gray-500 mb-4">
                {t('marketplace.showingResults', 'عرض {{current}} من أصل {{total}} منتج', {
                  current: products.length,
                  total: totalCount,
                })}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" id="products-grid" role="tabpanel" aria-label={t('marketplace.productsGrid', 'قائمة المنتجات')}>
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {totalCount > ITEMS_PER_PAGE && (
                <nav className="mt-8 flex items-center justify-center gap-2" aria-label={t('marketplace.pagination', 'ترقيم صفحات المنتجات')}>
                  <button
                    onClick={() => {
                      updateParams({ page: Math.max(1, filters.page - 1) }, { resetPage: false })
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    disabled={filters.page === 1}
                    className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    aria-label={t('marketplace.previousPage', 'الصفحة السابقة')}
                  >
                    <ChevronLeftIcon className="w-5 h-5" />
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                    let pageNumber

                    if (totalPages <= 5) {
                      pageNumber = index + 1
                    } else if (filters.page <= 3) {
                      pageNumber = index + 1
                    } else if (filters.page >= totalPages - 2) {
                      pageNumber = totalPages - 4 + index
                    } else {
                      pageNumber = filters.page - 2 + index
                    }

                    return (
                      <button
                        key={pageNumber}
                        onClick={() => {
                          updateParams({ page: pageNumber }, { resetPage: false })
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                          filters.page === pageNumber
                            ? 'bg-green-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-100'
                        }`}
                        aria-label={t('marketplace.pageNumber', 'الصفحة {{num}}', { num: pageNumber })}
                        aria-current={filters.page === pageNumber ? 'page' : undefined}
                      >
                        {pageNumber}
                      </button>
                    )
                  })}

                  <button
                    onClick={() => {
                      updateParams({ page: Math.min(totalPages, filters.page + 1) }, { resetPage: false })
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    disabled={filters.page >= totalPages}
                    className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    aria-label={t('marketplace.nextPage', 'الصفحة التالية')}
                  >
                    <ChevronRightIcon className="w-5 h-5" />
                  </button>
                </nav>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">🔍</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {t('marketplace.empty.title', 'لا توجد منتجات مطابقة')}
              </h3>
              <p className="text-gray-500 mb-4">
                {t('marketplace.empty.description', 'جرّب تعديل البحث أو الفلاتر للوصول إلى نتائج أوسع')}
              </p>
              <button onClick={clearFilters} className="btn-primary">
                {t('marketplace.empty.clearFilters', 'مسح الفلاتر')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const MarketplaceWithErrorBoundary = () => (
  <ErrorBoundary componentName="MarketplacePage">
    <MarketplacePage />
  </ErrorBoundary>
)

export default MarketplaceWithErrorBoundary