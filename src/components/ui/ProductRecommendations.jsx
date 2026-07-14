import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/services/supabase'
import { SparklesIcon } from '@heroicons/react/24/outline'
import { formatPrice } from '@/utils/currency'
import { logger } from '@/utils/logger'

export default function ProductRecommendations({ category = null, excludeId = null, limit = 6, className = '' }) {
  const { t } = useTranslation()

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['recommendations', category, excludeId],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, name, price_per_unit, unit_type, category, images:product_images(url, is_primary)')
        .eq('is_available', true)
        .limit(limit + 1)

      if (category) {
        query = query.eq('category', category)
      }

      const { data, error } = await query
      if (error) {
        logger.error('ProductRecommendations: failed to load', error)
        return []
      }

      let result = data || []

      if (result.length < limit && !category) {
        const { data: fallback, error: fallbackError } = await supabase
          .from('products')
          .select('id, name, price_per_unit, unit_type, images:product_images(url, is_primary)')
          .eq('is_available', true)
          .limit(limit + 1)
        if (!fallbackError && fallback) {
          result = fallback
        }
      }

      return result
        .filter((p) => p.id !== excludeId)
        .slice(0, limit)
    },
    staleTime: 10 * 60 * 1000,
  })

  if (isLoading || products.length === 0) return null

  return (
    <section className={className} data-testid="product-recommendations">
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <SparklesIcon className="w-5 h-5 text-primary-500" />
        {t('product.recommendations.title', 'You might also like')}
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
                    <SparklesIcon className="w-8 h-8" />
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
