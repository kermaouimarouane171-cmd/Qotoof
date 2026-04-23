import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { AdjustmentsHorizontalIcon, XMarkIcon } from '@heroicons/react/24/outline'
import SearchBar from '@/components/Search/SearchBar'
import { ProductCard } from '@/components/ui'
import { PRODUCT_CATEGORIES, getSuggestedSubcategories } from '@/constants/categories'
import productSearchService from '@/services/search/productSearchService'
import { logger } from '@/utils/logger'

const SORT_OPTIONS = [
  { value: 'relevance', label: 'الأكثر صلة' },
  { value: 'newest', label: 'الأحدث' },
  { value: 'price_asc', label: 'السعر: من الأقل' },
  { value: 'price_desc', label: 'السعر: من الأعلى' },
  { value: 'rating_desc', label: 'الأعلى تقييماً' },
  { value: 'name_asc', label: 'الاسم: أ - ي' },
]

const EMPTY_RESULTS = {
  hits: [],
  nbHits: 0,
  nbPages: 0,
  page: 0,
  hitsPerPage: 24,
  query: '',
}

const SearchResults = () => {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [results, setResults] = useState(EMPTY_RESULTS)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [availableRegions, setAvailableRegions] = useState([])

  const params = Object.fromEntries(searchParams.entries())
  const filters = productSearchService.buildFiltersFromParams(params)
  const currentPage = filters.page
  const subcategoryOptions = filters.category ? getSuggestedSubcategories(filters.category) : []
  const hasActiveSearch = Boolean(
    filters.query
      || filters.category
      || filters.subcategory
      || filters.region
      || filters.minPrice !== null
      || filters.maxPrice !== null
      || filters.rating !== null
      || filters.inStock
  )

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

    const loadResults = async () => {
      if (!hasActiveSearch) {
        setLoading(false)
        setResults({ ...EMPTY_RESULTS, query: filters.query })
        return
      }

      setLoading(true)
      try {
        const data = await productSearchService.searchProducts(filters)
        if (!cancelled) {
          setResults(data)
        }
      } catch (error) {
        logger.error('SearchResults: failed to load products', error)
        if (!cancelled) {
          setResults({ ...EMPTY_RESULTS, query: filters.query })
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadResults()
    return () => {
      cancelled = true
    }
  }, [hasActiveSearch, searchParams.toString()])

  const updateParams = (updates, { resetPage = true } = {}) => {
    const nextParams = new URLSearchParams(searchParams)

    if (resetPage) {
      nextParams.delete('page')
    }

    Object.entries(updates).forEach(([key, value]) => {
      if (key === 'page') {
        const nextPage = Number(value) || 0
        if (nextPage <= 0) nextParams.delete('page')
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

  const handleSearch = (query) => {
    updateParams({ q: query })
  }

  const clearFilters = () => {
    const nextParams = new URLSearchParams()
    if (filters.query) nextParams.set('q', filters.query)
    setSearchParams(nextParams)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" data-testid="search-results-page">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
        <div className="max-w-6xl mx-auto">
          <SearchBar onSearch={handleSearch} initialValue={filters.query} className="max-w-3xl" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6">
        <aside className={`w-full md:w-72 shrink-0 ${showFilters ? 'block' : 'hidden md:block'}`}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">{t('search.filters', 'الفلاتر')}</h3>
              <button
                onClick={clearFilters}
                className="text-sm text-red-500 hover:underline"
              >
                {t('search.clearFilters', 'مسح الفلاتر')}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('search.category', 'الفئة الرئيسية')}
              </label>
              <select
                value={filters.category || 'all'}
                onChange={(event) => updateParams({ category: event.target.value })}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
              >
                <option value="all">{t('search.allCategories', 'كل الفئات')}</option>
                {PRODUCT_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>{category.labelAr || category.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('search.subcategory', 'الفئة الفرعية')}
              </label>
              <select
                value={filters.subcategory || 'all'}
                onChange={(event) => updateParams({ subcategory: event.target.value })}
                disabled={!filters.category}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 disabled:opacity-50"
              >
                <option value="all">{t('search.allSubcategories', 'كل الفئات الفرعية')}</option>
                {subcategoryOptions.map((subcategory) => (
                  <option key={subcategory} value={subcategory}>{subcategory}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('search.region', 'المدينة')}
              </label>
              <select
                value={filters.region || 'all'}
                onChange={(event) => updateParams({ region: event.target.value })}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
              >
                <option value="all">{t('search.allRegions', 'كل المدن')}</option>
                {availableRegions.map((region) => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('search.priceRange', 'نطاق السعر')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min="0"
                  value={filters.minPrice ?? ''}
                  onChange={(event) => updateParams({ minPrice: event.target.value })}
                  placeholder={t('search.minPrice', 'من')}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
                />
                <input
                  type="number"
                  min="0"
                  value={filters.maxPrice ?? ''}
                  onChange={(event) => updateParams({ maxPrice: event.target.value })}
                  placeholder={t('search.maxPrice', 'إلى')}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('search.rating', 'التقييم الأدنى')}
              </label>
              <select
                value={filters.rating ?? ''}
                onChange={(event) => updateParams({ rating: event.target.value })}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-700 dark:text-gray-200"
              >
                <option value="">{t('search.anyRating', 'أي تقييم')}</option>
                <option value="4">4+ نجوم</option>
                <option value="3">3+ نجوم</option>
                <option value="2">2+ نجوم</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(filters.inStock)}
                onChange={(event) => updateParams({ inStock: event.target.checked })}
                className="accent-green-500"
              />
              {t('search.inStockOnly', 'متوفر حالياً فقط')}
            </label>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters((value) => !value)}
                className="md:hidden flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg"
              >
                <AdjustmentsHorizontalIcon className="h-4 w-4" />
                {t('search.filters', 'الفلاتر')}
              </button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {loading
                  ? '...'
                  : `${results.nbHits} ${t('search.results', 'نتيجة')}${filters.query ? ` ${t('search.forQuery', 'لـ')} "${filters.query}"` : ''}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {showFilters && (
                <button
                  onClick={() => setShowFilters(false)}
                  className="md:hidden p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  aria-label={t('common.close', 'إغلاق')}
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
              <select
                value={filters.sortBy}
                onChange={(event) => updateParams({ sortBy: event.target.value })}
                className="text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {!hasActiveSearch && !loading && (
            <div className="text-center py-16 bg-white dark:bg-gray-800 border border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
              <div className="text-5xl mb-4">🔎</div>
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                {t('search.startPrompt', 'ابدأ بالبحث أو اختر فلتر لعرض المنتجات المناسبة')}
              </p>
            </div>
          )}

          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="animate-pulse bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-100 dark:border-gray-700">
                  <div className="h-52 bg-gray-200 dark:bg-gray-700 rounded-xl mb-3" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4" />
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                </div>
              ))}
            </div>
          )}

          {!loading && results.hits.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {results.hits.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {results.nbPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    onClick={() => updateParams({ page: Math.max(currentPage - 1, 0) }, { resetPage: false })}
                    disabled={currentPage === 0}
                    className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {t('common.previous', 'السابق')}
                  </button>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {currentPage + 1} / {results.nbPages}
                  </span>
                  <button
                    onClick={() => updateParams({ page: Math.min(currentPage + 1, results.nbPages - 1) }, { resetPage: false })}
                    disabled={currentPage >= results.nbPages - 1}
                    className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {t('common.next', 'التالي')}
                  </button>
                </div>
              )}
            </>
          )}

          {!loading && hasActiveSearch && results.hits.length === 0 && (
            <div className="text-center py-16 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl">
              <div className="text-5xl mb-4">📭</div>
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                {t('search.noResults', 'لا توجد نتائج مطابقة')}
              </p>
              <p className="text-sm text-gray-400 mt-2">
                {t('search.tryOther', 'جرّب تقليل عدد الفلاتر أو تغيير كلمات البحث')}
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default SearchResults