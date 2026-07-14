import { supabase } from '@/services/supabase'
import { runProductImageFallbackQuery } from '@/modules/catalog'
import productSearchService from '@/services/search/productSearchService'
import { logger } from '@/utils/logger'

export const fetchProducts = async (filters = {}) => {
  return productSearchService.searchProducts(filters)
}

export const fetchAvailableRegions = async () => {
  return productSearchService.getAvailableRegions()
}

export const fetchProductById = async (id) => {
  const buildQuery = (selectClause) =>
    supabase
      .from('products')
      .select(selectClause)
      .eq('id', id)
      .single()

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
    onRelationError: (error) => {
      logger.warn('productsApi: product_images relation missing, using fallback hydration', error)
    },
  })

  return data
}
