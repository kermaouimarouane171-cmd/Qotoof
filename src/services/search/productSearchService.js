import { algoliasearch } from 'algoliasearch'
import { supabase } from '@/services/supabase'
import { hydrateProductsWithImages, isProductImagesRelationError } from '@/services/productImages'
import { sanitizePostgRESTFilter } from '@/utils/sanitization'
import { logger } from '@/utils/logger'
import { filterPublicProducts, filterPublicVendors } from '@/utils/publicVisibility'
import {
  buildProductSearchFiltersFromParams,
  normalizeProductSearchFilters,
  normalizeSearchProduct,
} from './productSearchHelpers'

export {
  buildProductSearchFiltersFromParams,
  normalizeProductSearchFilters,
  normalizeSearchProduct,
} from './productSearchHelpers'

const APP_ID = import.meta.env.VITE_ALGOLIA_APP_ID || ''
const SEARCH_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_KEY || ''
const PRODUCTS_INDEX = import.meta.env.VITE_ALGOLIA_PRODUCTS_INDEX || 'products'

const PRODUCT_CORE_SELECT = `
  id,
  name,
  description,
  category,
  subcategory,
  price_per_unit,
  unit_type,
  stock_quantity,
  available_quantity,
  min_order_quantity,
  is_available,
  approval_status,
  average_rating,
  reviews_count,
  created_at,
  vendor_id,
`

const PRODUCT_VENDOR_SELECT = `
  vendor:profiles(id, first_name, last_name, store_name, city, is_verified)
`

const PRODUCT_SELECT = `
  ${PRODUCT_CORE_SELECT}
  product_images(url, is_primary),
  ${PRODUCT_VENDOR_SELECT}
`

const PRODUCT_SELECT_WITHOUT_IMAGES = `
  ${PRODUCT_CORE_SELECT}
  ${PRODUCT_VENDOR_SELECT}
`

const _PRODUCT_SUGGESTION_SELECT = `
  id,
  name,
  category,
  subcategory,
  price_per_unit,
  average_rating,
  vendor_id,
  product_images(url, is_primary),
  vendor:profiles(id, first_name, last_name, store_name, email)
`

const PRODUCT_SUGGESTION_SELECT_WITHOUT_IMAGES = `
  id,
  name,
  category,
  subcategory,
  price_per_unit,
  average_rating,
  vendor_id,
  vendor:profiles(id, first_name, last_name, store_name, email)
`

let algoliaClient = null
let algoliaEnabled = false

if (APP_ID && SEARCH_KEY) {
  try {
    algoliaClient = algoliasearch(APP_ID, SEARCH_KEY)
    algoliaEnabled = true
  } catch (error) {
    logger.warn('Product search: Algolia initialization failed', error)
  }
}

const buildSearchResponse = ({ hits = [], total = 0, page = 0, hitsPerPage = 24, query = '', source = 'supabase' }) => ({
  hits,
  nbHits: total,
  nbPages: Math.max(Math.ceil(total / hitsPerPage), 1),
  page,
  hitsPerPage,
  query,
  source,
})

const shouldUseAlgolia = (filters) => {
  return algoliaEnabled
    && Boolean(filters.query)
    && !filters.region
    && !filters.subcategory
    && filters.sortBy !== 'name_asc'
}

const fetchPublicVendors = async ({ region = null } = {}) => {
  let query = supabase
    .from('profiles')
    .select('id, first_name, last_name, store_name, store_description, city, email')
    .eq('role', 'vendor')

  if (region) {
    query = query.eq('city', region)
  }

  const { data, error } = await query
  if (error) throw error

  return filterPublicVendors(data || [])
}

const searchProductsViaAlgolia = async (filters) => {
  const searchFilters = []
  if (filters.category) searchFilters.push(`category:${filters.category}`)
  if (filters.minPrice !== null) searchFilters.push(`price >= ${filters.minPrice}`)
  if (filters.maxPrice !== null) searchFilters.push(`price <= ${filters.maxPrice}`)
  if (filters.rating !== null) searchFilters.push(`rating >= ${filters.rating}`)
  if (filters.inStock === true) searchFilters.push('in_stock:true')

  const indexName = filters.sortBy && filters.sortBy !== 'relevance'
    ? `${PRODUCTS_INDEX}_${filters.sortBy}`
    : PRODUCTS_INDEX

  const { results } = await algoliaClient.search([{
    indexName,
    query: filters.query,
    params: {
      filters: searchFilters.join(' AND '),
      page: filters.page,
      hitsPerPage: filters.hitsPerPage,
      attributesToHighlight: ['name', 'description'],
      attributesToSnippet: ['description:30'],
    },
  }])

  const firstResult = results?.[0] || { hits: [], nbHits: 0, nbPages: 0, page: filters.page }
  const normalizedHits = (firstResult.hits || []).map(normalizeSearchProduct)
  const visibleHits = filterPublicProducts(normalizedHits)

  if (visibleHits.length !== normalizedHits.length) {
    logger.warn('Product search: hidden experimental Algolia hits detected, falling back to Supabase')
    return searchProductsViaSupabase(filters)
  }

  return buildSearchResponse({
    hits: visibleHits,
    total: firstResult.nbHits || 0,
    page: firstResult.page || 0,
    hitsPerPage: filters.hitsPerPage,
    query: filters.query,
    source: 'algolia',
  })
}

const fetchPublicVendorIds = async (region = null) => {
  const vendors = await fetchPublicVendors({ region })
  return vendors.map((vendor) => vendor.id)
}

const executeProductQueryWithImageFallback = async ({
  buildQuery,
  fallbackSelect,
  relationErrorContext,
}) => {
  const primaryResult = await buildQuery(PRODUCT_SELECT)
  if (!primaryResult.error) {
    return primaryResult
  }

  if (!isProductImagesRelationError(primaryResult.error)) {
    throw primaryResult.error
  }

  logger.warn(`${relationErrorContext}: product_images relation missing, hydrating images separately`, primaryResult.error)

  const fallbackResult = await buildQuery(fallbackSelect)
  if (fallbackResult.error) {
    throw fallbackResult.error
  }

  return {
    ...fallbackResult,
    data: await hydrateProductsWithImages(fallbackResult.data || []),
  }
}

const searchProductsViaSupabase = async (filters) => {
  const publicVendorIds = await fetchPublicVendorIds(filters.region || null)
  if (publicVendorIds.length === 0) {
    return buildSearchResponse({
      hits: [],
      total: 0,
      page: filters.page,
      hitsPerPage: filters.hitsPerPage,
      query: filters.query,
    })
  }

  const buildQuery = (selectClause) => {
    let query = supabase
      .from('products')
      .select(selectClause, { count: 'exact' })
      .eq('approval_status', 'approved')
      .eq('is_available', true)
      .in('vendor_id', publicVendorIds)

    if (filters.category) {
      query = query.eq('category', filters.category)
    }

    if (filters.subcategory) {
      query = query.eq('subcategory', filters.subcategory)
    }

    if (filters.region) {
      query = query.in('vendor_id', publicVendorIds)
    }

    if (filters.minPrice !== null) {
      query = query.gte('price_per_unit', filters.minPrice)
    }

    if (filters.maxPrice !== null) {
      query = query.lte('price_per_unit', filters.maxPrice)
    }

    if (filters.rating !== null) {
      query = query.gte('average_rating', filters.rating)
    }

    if (filters.inStock === true) {
      query = query.or('stock_quantity.gt.0,available_quantity.gt.0')
    }

    if (filters.query) {
      const textQuery = filters.query.replace(/\s+/g, ' ').trim()
      query = query.textSearch('search_document', textQuery, { type: 'websearch', config: 'simple' })
    }

    switch (filters.sortBy) {
      case 'price_asc':
        query = query.order('price_per_unit', { ascending: true })
        break
      case 'price_desc':
        query = query.order('price_per_unit', { ascending: false })
        break
      case 'rating_desc':
        query = query.order('average_rating', { ascending: false }).order('reviews_count', { ascending: false })
        break
      case 'name_asc':
        query = query.order('name', { ascending: true })
        break
      case 'relevance':
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false })
        break
    }

    const from = filters.page * filters.hitsPerPage
    const to = from + filters.hitsPerPage - 1
    return query.range(from, to)
  }

  const { data, count } = await executeProductQueryWithImageFallback({
    buildQuery,
    fallbackSelect: PRODUCT_SELECT_WITHOUT_IMAGES,
    relationErrorContext: 'Product search: Supabase fallback',
  })

  const visibleHits = filterPublicProducts((data || []).map(normalizeSearchProduct))
  return buildSearchResponse({
    hits: visibleHits,
    total: count || 0,
    page: filters.page,
    hitsPerPage: filters.hitsPerPage,
    query: filters.query,
    source: 'supabase',
  })
}

const getSearchSuggestionsViaSupabase = async (query, { hitsPerPage = 6, category = null } = {}) => {
  const publicVendorIds = await fetchPublicVendorIds()
  if (publicVendorIds.length === 0) return []

  const buildQuery = (selectClause) => {
    let searchQuery = supabase
      .from('products')
      .select(selectClause)
      .eq('approval_status', 'approved')
      .eq('is_available', true)
      .in('vendor_id', publicVendorIds)
      .range(0, hitsPerPage - 1)

    if (category) {
      searchQuery = searchQuery.eq('category', category)
    }

    const sanitizedQuery = sanitizePostgRESTFilter(query)
    return searchQuery.or(`name.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%,subcategory.ilike.%${sanitizedQuery}%`)
  }

  const { data } = await executeProductQueryWithImageFallback({
    buildQuery,
    fallbackSelect: PRODUCT_SUGGESTION_SELECT_WITHOUT_IMAGES,
    relationErrorContext: 'Product search: Supabase suggestions',
  })

  return filterPublicProducts((data || []).map((product) => {
    const normalized = normalizeSearchProduct(product)
    return {
      objectID: normalized.id,
      name: normalized.name,
      category: normalized.category,
      subcategory: normalized.subcategory,
      image_url: normalized.image_url,
      vendor: normalized.vendor,
    }
  }))
}

export const productSearchService = {
  async searchProducts(filters = {}) {
    const normalizedFilters = normalizeProductSearchFilters(filters)

    try {
      if (shouldUseAlgolia(normalizedFilters)) {
        return await searchProductsViaAlgolia(normalizedFilters)
      }
    } catch (error) {
      logger.warn('Product search: Algolia request failed, falling back to Supabase', error)
    }

    try {
      return await searchProductsViaSupabase(normalizedFilters)
    } catch (error) {
      logger.error('Product search: Supabase fallback failed', error)
      return buildSearchResponse({
        hits: [],
        total: 0,
        page: normalizedFilters.page,
        hitsPerPage: normalizedFilters.hitsPerPage,
        query: normalizedFilters.query,
      })
    }
  },

  async getFeaturedProducts(limit = 8) {
    const normalizedLimit = Math.max(1, Math.min(Number(limit) || 8, 24))
    const response = await this.searchProducts({
      page: 0,
      hitsPerPage: normalizedLimit,
      sortBy: 'newest',
    })

    return response.hits || []
  },

  async getSearchSuggestions(query, { hitsPerPage = 6, category = null } = {}) {
    const trimmedQuery = String(query || '').trim()
    if (trimmedQuery.length < 2) return []

    if (algoliaEnabled) {
      try {
        const { results } = await algoliaClient.search([{
          indexName: PRODUCTS_INDEX,
          query: trimmedQuery,
          params: {
            hitsPerPage,
            attributesToRetrieve: ['name', 'category', 'subcategory', 'objectID', 'image_url'],
            attributesToHighlight: ['name'],
          },
        }])

        return filterPublicProducts(results?.[0]?.hits || [])
      } catch (error) {
        logger.warn('Product search: Algolia suggestions failed, falling back to Supabase', error)
      }
    }

    try {
      return await getSearchSuggestionsViaSupabase(trimmedQuery, { hitsPerPage, category })
    } catch (error) {
      logger.error('Product search: Supabase suggestions failed', error)
      return []
    }
  },

  buildFiltersFromParams(params = {}) {
    return buildProductSearchFiltersFromParams(params)
  },

  async getAvailableRegions() {
    try {
      const vendors = await fetchPublicVendors()
      return [...new Set(vendors.map((profile) => profile.city).filter(Boolean))].sort()
    } catch (error) {
      logger.error('Product search: failed to load vendor regions', error)
      return []
    }
  },

  isAlgoliaEnabled() {
    return algoliaEnabled
  },
}

export default productSearchService