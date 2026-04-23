const SORT_ALIASES = {
  newest: 'newest',
  relevance: 'relevance',
  price_asc: 'price_asc',
  priceLow: 'price_asc',
  price_desc: 'price_desc',
  priceHigh: 'price_desc',
  rating_desc: 'rating_desc',
  rating: 'rating_desc',
  name_asc: 'name_asc',
  name: 'name_asc',
}

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const toBooleanOrNull = (value) => {
  if (value === true || value === false) return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

const normalizeSortBy = (sortBy) => SORT_ALIASES[sortBy] || 'relevance'

const normalizeVendor = (vendor = {}) => {
  if (!vendor) return null
  return {
    id: vendor.id,
    first_name: vendor.first_name || '',
    last_name: vendor.last_name || '',
    store_name: vendor.store_name || '',
    city: vendor.city || '',
    is_verified: Boolean(vendor.is_verified),
  }
}

export const normalizeProductSearchFilters = (filters = {}) => ({
  query: String(filters.query ?? filters.search ?? '').trim(),
  category: filters.category && filters.category !== 'all' ? String(filters.category) : null,
  subcategory: filters.subcategory && filters.subcategory !== 'all' ? String(filters.subcategory) : null,
  region: filters.region && filters.region !== 'all' ? String(filters.region) : null,
  minPrice: toNumberOrNull(filters.minPrice ?? filters.priceMin ?? filters.price_min),
  maxPrice: toNumberOrNull(filters.maxPrice ?? filters.priceMax ?? filters.price_max),
  rating: toNumberOrNull(filters.rating),
  inStock: toBooleanOrNull(filters.inStock ?? filters.in_stock),
  sortBy: normalizeSortBy(filters.sortBy),
  page: Math.max(Number(filters.page ?? 0) || 0, 0),
  hitsPerPage: Math.min(Math.max(Number(filters.hitsPerPage ?? 24) || 24, 1), 48),
})

export const normalizeSearchProduct = (product = {}) => {
  const images = product.images || product.product_images || []
  const primaryImage = images.find((image) => image?.is_primary) || images[0] || null
  const normalizedVendor = normalizeVendor(product.vendor)
  const price = Number(product.price_per_unit ?? product.price ?? 0)
  const averageRating = Number(product.average_rating ?? product.rating ?? 0)
  const reviewsCount = Number(product.reviews_count ?? product.review_count ?? 0)
  const stockQuantity = Number(product.stock_quantity ?? product.available_quantity ?? 0)
  const isAvailable = product.is_available ?? product.in_stock ?? stockQuantity > 0
  const unitType = product.unit_type || product.unit || ''

  return {
    ...product,
    id: product.id || product.objectID,
    objectID: product.objectID || product.id,
    images,
    image_url: product.image_url || primaryImage?.url || null,
    vendor: normalizedVendor,
    price,
    price_per_unit: price,
    unit_type: unitType,
    average_rating: averageRating,
    rating: averageRating,
    reviews_count: reviewsCount,
    stock_quantity: stockQuantity,
    is_available: Boolean(isAvailable),
    in_stock: Boolean(isAvailable),
    min_order_quantity: Number(product.min_order_quantity || 1),
  }
}

export const buildProductSearchFiltersFromParams = (params = {}) => {
  return normalizeProductSearchFilters({
    query: params.q || params.query || params.search || '',
    category: params.category,
    subcategory: params.subcategory,
    region: params.region,
    minPrice: params.minPrice || params.price_min,
    maxPrice: params.maxPrice || params.price_max,
    rating: params.rating,
    inStock: params.inStock || params.in_stock,
    sortBy: params.sortBy,
    page: params.page,
  })
}