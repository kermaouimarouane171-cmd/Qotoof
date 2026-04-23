import { algoliasearch } from 'algoliasearch'
import { supabase } from '@/services/supabase'
import { sanitizePostgRESTFilter } from '@/utils/sanitization'
import { logger } from '@/utils/logger'
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

const PRODUCT_SELECT = `
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
  product_images(url, is_primary),
  vendor:profiles(id, first_name, last_name, store_name, city, is_verified)
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
  return buildSearchResponse({
    hits: (firstResult.hits || []).map(normalizeSearchProduct),
    total: firstResult.nbHits || 0,
    page: firstResult.page || 0,
    hitsPerPage: filters.hitsPerPage,
    query: filters.query,
    source: 'algolia',
  })
}

const fetchRegionVendorIds = async (region) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'vendor')
    .eq('city', region)

  if (error) throw error
  return (data || []).map((vendor) => vendor.id)
}

const searchProductsViaSupabase = async (filters) => {
  let query = supabase
    .from('products')
    .select(PRODUCT_SELECT, { count: 'exact' })
    .eq('approval_status', 'approved')
    .is('deleted_at', null)
    .eq('is_available', true)

  if (filters.category) {
    query = query.eq('category', filters.category)
  }

  if (filters.subcategory) {
    query = query.eq('subcategory', filters.subcategory)
  }

  if (filters.region) {
    const vendorIds = await fetchRegionVendorIds(filters.region)
    if (vendorIds.length === 0) {
      return buildSearchResponse({
        hits: [],
        total: 0,
        page: filters.page,
        hitsPerPage: filters.hitsPerPage,
        query: filters.query,
      })
    }
    query = query.in('vendor_id', vendorIds)
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
  query = query.range(from, to)

  const { data, error, count } = await query
  if (error) throw error

  return buildSearchResponse({
    hits: (data || []).map(normalizeSearchProduct),
    total: count || 0,
    page: filters.page,
    hitsPerPage: filters.hitsPerPage,
    query: filters.query,
    source: 'supabase',
  })
}

const getSearchSuggestionsViaSupabase = async (query, { hitsPerPage = 6, category = null } = {}) => {
  let searchQuery = supabase
    .from('products')
    .select('id, name, category, subcategory, price_per_unit, average_rating, product_images(url, is_primary)')
    .eq('approval_status', 'approved')
    .is('deleted_at', null)
    .eq('is_available', true)
    .range(0, hitsPerPage - 1)

  if (category) {
    searchQuery = searchQuery.eq('category', category)
  }

  const sanitizedQuery = sanitizePostgRESTFilter(query)
  searchQuery = searchQuery.or(`name.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%,subcategory.ilike.%${sanitizedQuery}%`)

  const { data, error } = await searchQuery
  if (error) throw error

  return (data || []).map((product) => {
    const normalized = normalizeSearchProduct(product)
    return {
      objectID: normalized.id,
      name: normalized.name,
      category: normalized.category,
      subcategory: normalized.subcategory,
      image_url: normalized.image_url,
    }
  })
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

        return results?.[0]?.hits || []
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
      const { data, error } = await supabase
        .from('profiles')
        .select('city')
        .eq('role', 'vendor')
        .not('city', 'is', null)

      if (error) throw error
      return [...new Set((data || []).map((profile) => profile.city).filter(Boolean))].sort()
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