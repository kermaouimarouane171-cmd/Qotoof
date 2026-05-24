import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/services/supabase'
import profilesService from '@/services/profilesService'
import {
  BuildingStorefrontIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  StarIcon,
} from '@heroicons/react/24/outline'
import { logger } from '@/utils/logger'

const ITEMS_PER_PAGE = 10

const MOROCCAN_CITIES = [
  'Casablanca',
  'Rabat',
  'Marrakech',
  'Fes',
  'Tangier',
  'Agadir',
  'Meknes',
  'Oujda',
  'Kenitra',
  'Tetouan',
  'Safi',
  'El Jadida',
  'Beni Mellal',
  'Nador',
  'Taza',
]

const CATEGORY_OPTIONS = [
  { value: 'vegetables', label: 'خضروات' },
  { value: 'fruits', label: 'فواكه' },
  { value: 'plants', label: 'نباتات' },
  { value: 'herbs', label: 'أعشاب' },
  { value: 'seeds', label: 'بذور' },
]

const SORT_OPTIONS = [
  { value: 'rating', label: 'الأعلى تقييماً' },
  { value: 'newest', label: 'الأحدث' },
  { value: 'most_orders', label: 'الأكثر طلبات' },
]

const StoreCardSkeleton = () => (
  <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm animate-pulse">
    <div className="flex items-start gap-3">
      <div className="h-12 w-12 rounded-full bg-emerald-100" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-2/3 rounded bg-emerald-100" />
        <div className="h-3 w-1/3 rounded bg-emerald-100" />
      </div>
    </div>
    <div className="mt-4 h-3 w-1/2 rounded bg-emerald-100" />
    <div className="mt-2 h-3 w-1/3 rounded bg-emerald-100" />
    <div className="mt-5 h-10 w-full rounded-xl bg-emerald-100" />
  </div>
)

const Stores = () => {
  const { i18n } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [stores, setStores] = useState([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [ratingFilter, setRatingFilter] = useState('')
  const [sortBy, setSortBy] = useState('rating')
  const [page, setPage] = useState(1)

  const isArabic = (i18n.language || 'ar').toLowerCase().startsWith('ar')

  useEffect(() => {
    const loadStores = async () => {
      setLoading(true)
      try {
        const { data: vendors, error: vendorsError } = await profilesService.fetchActiveVerifiedVendors()
        if (vendorsError) throw vendorsError

        const vendorIds = (vendors || []).map((vendor) => vendor.id)
        if (vendorIds.length === 0) {
          setStores([])
          return
        }

        const [productsResult, ordersResult] = await Promise.all([
          supabase
            .from('products')
            .select('vendor_id, category')
            .in('vendor_id', vendorIds)
            .eq('approval_status', 'approved')
            .eq('is_available', true),
          supabase
            .from('orders')
            .select('vendor_id')
            .in('vendor_id', vendorIds),
        ])

        if (productsResult.error) throw productsResult.error
        if (ordersResult.error) throw ordersResult.error

        const productCounts = {}
        const categoriesByVendor = {}
        for (const row of productsResult.data || []) {
          productCounts[row.vendor_id] = (productCounts[row.vendor_id] || 0) + 1
          if (!categoriesByVendor[row.vendor_id]) categoriesByVendor[row.vendor_id] = new Set()
          if (row.category) categoriesByVendor[row.vendor_id].add(row.category)
        }

        const orderCounts = {}
        for (const row of ordersResult.data || []) {
          orderCounts[row.vendor_id] = (orderCounts[row.vendor_id] || 0) + 1
        }

        const enriched = (vendors || []).map((vendor) => ({
          ...vendor,
          productCount: productCounts[vendor.id] || 0,
          orderCount: orderCounts[vendor.id] || 0,
          categories: Array.from(categoriesByVendor[vendor.id] || []),
          score: Number(vendor.rating || 0),
        }))

        setStores(enriched)
      } catch (error) {
        logger.error('Failed to load stores list:', error)
        setStores([])
      } finally {
        setLoading(false)
      }
    }

    loadStores()
  }, [])

  const filteredStores = useMemo(() => {
    const query = search.trim().toLowerCase()

    const result = stores.filter((store) => {
      const storeName = (store.store_name || `${store.first_name || ''} ${store.last_name || ''}`).trim().toLowerCase()
      const matchesSearch = !query || storeName.includes(query)
      const matchesCategory = !category || store.categories.includes(category)
      const matchesCity = !city || (store.city || '').toLowerCase() === city.toLowerCase()
      const matchesRating = !ratingFilter || store.score >= Number(ratingFilter)
      return matchesSearch && matchesCategory && matchesCity && matchesRating
    })

    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
      if (sortBy === 'most_orders') {
        return b.orderCount - a.orderCount
      }
      return b.score - a.score
    })

    return result
  }, [category, city, ratingFilter, search, sortBy, stores])

  const totalPages = Math.max(1, Math.ceil(filteredStores.length / ITEMS_PER_PAGE))
  const paginatedStores = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE
    return filteredStores.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredStores, page])

  useEffect(() => {
    setPage(1)
  }, [search, category, city, ratingFilter, sortBy])

  return (
    <div dir={isArabic ? 'rtl' : 'ltr'} className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">المتاجر</h1>
        <p className="mt-1 text-sm text-gray-500">اكتشف كل البائعين الموثقين والنشطين في قطوف</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-emerald-100 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <MagnifyingGlassIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث باسم المتجر"
            className="h-10 w-full rounded-xl border border-emerald-100 bg-emerald-50/30 pr-9 pl-3 text-sm outline-none ring-emerald-300 transition focus:ring"
          />
        </div>

        <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-xl border border-emerald-100 px-3 text-sm outline-none ring-emerald-300 focus:ring">
          <option value="">كل الفئات</option>
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <select value={city} onChange={(event) => setCity(event.target.value)} className="h-10 rounded-xl border border-emerald-100 px-3 text-sm outline-none ring-emerald-300 focus:ring">
          <option value="">كل المدن</option>
          {MOROCCAN_CITIES.map((cityName) => (
            <option key={cityName} value={cityName}>{cityName}</option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-2">
          <select value={ratingFilter} onChange={(event) => setRatingFilter(event.target.value)} className="h-10 rounded-xl border border-emerald-100 px-2 text-sm outline-none ring-emerald-300 focus:ring">
            <option value="">التقييم</option>
            <option value="4">4+ ⭐</option>
            <option value="3">3+ ⭐</option>
            <option value="2">2+ ⭐</option>
          </select>

          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="h-10 rounded-xl border border-emerald-100 px-2 text-sm outline-none ring-emerald-300 focus:ring">
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <StoreCardSkeleton key={`store-skeleton-${index}`} />
          ))}
        </div>
      ) : paginatedStores.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-emerald-200 bg-white px-6 py-14 text-center text-sm text-gray-500">
          لا توجد متاجر مطابقة للفلاتر الحالية.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {paginatedStores.map((store) => {
              const storeName = (store.store_name || `${store.first_name || ''} ${store.last_name || ''}`).trim() || 'متجر بدون اسم'
              return (
                <article key={store.id} className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="h-12 w-12 overflow-hidden rounded-full bg-emerald-100">
                      {store.avatar_url ? (
                        <img src={store.avatar_url} alt={storeName} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-emerald-700">
                          <BuildingStorefrontIcon className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-1 text-sm font-semibold text-gray-900">{storeName}</h3>
                      <div className="mt-1 flex items-center gap-1 text-xs text-amber-500">
                        <StarIcon className="h-4 w-4" />
                        <span className="font-medium text-gray-700">{Number(store.score || 0).toFixed(1)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-gray-600">
                    <p className="flex items-center gap-1">
                      <MapPinIcon className="h-4 w-4 text-emerald-600" />
                      {store.city || 'غير محدد'}
                    </p>
                    <p>عدد المنتجات: <span className="font-semibold text-gray-800">{store.productCount}</span></p>
                    <p>عدد الطلبات: <span className="font-semibold text-gray-800">{store.orderCount}</span></p>
                  </div>

                  <Link to={`/stores/${store.id}`} className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700">
                    View Store
                  </Link>
                </article>
              )
            })}
          </div>

          <div className="mt-8 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="h-9 rounded-lg border border-emerald-200 px-3 text-sm text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              السابق
            </button>

            <span className="px-3 text-sm text-gray-600">{page} / {totalPages}</span>

            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
              className="h-9 rounded-lg border border-emerald-200 px-3 text-sm text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              التالي
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default Stores
