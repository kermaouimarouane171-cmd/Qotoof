import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { ClockIcon } from '@heroicons/react/24/outline'
import { formatPrice } from '@/utils/currency'
import { logger } from '@/utils/logger'

const STORAGE_KEY = 'recently-viewed-products'
const MAX_ITEMS = 10

export function trackProductView(productId) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    const filtered = stored.filter((id) => id !== productId)
    filtered.unshift(productId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_ITEMS)))
  } catch {
    // ignore storage errors
  }
}

export function getRecentlyViewedIds() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export default function RecentlyViewed({ excludeId = null, limit = 6, className = '' }) {
  const { t } = useTranslation()
  const [ids, setIds] = useState([])

  useEffect(() => {
    setIds(getRecentlyViewedIds().filter((id) => id !== excludeId).slice(0, limit))
  }, [excludeId, limit])

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['recently-viewed', ids],
    queryFn: async () => {
      if (ids.length === 0) return []
      const { data, error } = await supabase
        .from('products')
        .select('id, name, price_per_unit, unit_type, images:product_images(url, is_primary)')
        .in('id', ids)
      if (error) {
        logger.error('RecentlyViewed: failed to load products', error)
        return []
      }
      const orderMap = new Map(ids.map((id, idx) => [id, idx]))
      return (data || []).sort((a, b) => orderMap.get(a.id) - orderMap.get(b.id))
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading || products.length === 0) return null

  return (
    <section className={className} data-testid="recently-viewed-section">
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <ClockIcon className="w-5 h-5 text-primary-500" />
        {t('home.recentlyViewed.title', 'Recently Viewed')}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {products.map((product) => {
          const image = product.images?.find((img) => img.is_primary) || product.images?.[0]
          return (
            <Link
              key={product.id}
              to={`/product/${product.id}`}
              className="group block rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-all overflow-hidden"
            >
              <div className="aspect-square overflow-hidden bg-gray-100">
                {image?.url ? (
                  <img
                    src={image.url}
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <ClockIcon className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-gray-900 truncate">{product.name}</p>
                <p className="text-xs text-primary-600 font-semibold mt-0.5">
                  {formatPrice(product.price_per_unit)}
                  <span className="text-gray-400 font-normal">/{product.unit_type}</span>
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
