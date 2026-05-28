import { supabase } from '@/services/supabase'
import type { Database } from '@/types/database'

type ProductUpdate = Database['public']['Tables']['products']['Update']
type CountMode = 'exact' | 'planned' | 'estimated'

const PRODUCT_LIST_FIELDS = `
  id, name, description, category, subcategory,
  price_per_unit, unit_type, stock_quantity,
  min_order_quantity, is_available, approval_status,
  created_at, vendor_id
`

const PRODUCT_LIST_SELECT = `
  ${PRODUCT_LIST_FIELDS},
  product_images(url, is_primary)
`

const PRODUCT_DETAIL_SELECT = `
  id, name, description, category, subcategory,
  price_per_unit, unit_type, unit:unit_type,
  stock_quantity, min_order_quantity,
  vendor_id, is_available, approval_status,
  created_at, updated_at,
  product_images(url, is_primary),
  reviews!inner(rating, comment, created_at)
`

const PRODUCT_DETAIL_SELECT_WITHOUT_IMAGES = `
  id, name, description, category, subcategory,
  price_per_unit, unit_type, unit:unit_type,
  stock_quantity, min_order_quantity,
  vendor_id, is_available, approval_status,
  created_at, updated_at,
  reviews!inner(rating, comment, created_at)
`

const PENDING_PRODUCT_SELECT = `
  id, name, description, category, price_per_unit, unit_type,
  approval_status, created_at, vendor_id,
  vendor:profiles(first_name, last_name, store_name),
  images:product_images(url, is_primary)
`

const PENDING_PRODUCT_SELECT_WITHOUT_IMAGES = `
  id, name, description, category, price_per_unit, unit_type,
  approval_status, created_at, vendor_id,
  vendor:profiles(first_name, last_name, store_name)
`

export const productSelects = {
  PRODUCT_LIST_FIELDS,
  PRODUCT_LIST_SELECT,
  PRODUCT_DETAIL_SELECT,
  PRODUCT_DETAIL_SELECT_WITHOUT_IMAGES,
  PENDING_PRODUCT_SELECT,
  PENDING_PRODUCT_SELECT_WITHOUT_IMAGES,
}

export const listProducts = async ({
  filters,
  selectClause,
  includeDeletedFilter = true,
  count = 'exact' as CountMode,
}) => {
  let query = supabase
    .from('products')
    .select(selectClause, { count })

  if (includeDeletedFilter) {
    query = query.is('deleted_at', null)
  }

  if (filters.category) {
    query = query.eq('category', filters.category)
  }

  if (filters.minPrice) {
    query = query.gte('price_per_unit', filters.minPrice)
  }

  if (filters.maxPrice) {
    query = query.lte('price_per_unit', filters.maxPrice)
  }

  if (filters.search) {
    query = query.or(filters.search)
  }

  if (filters.vendorId) {
    query = query.eq('vendor_id', filters.vendorId)
  }

  if (filters.approvalStatus) {
    query = query.eq('approval_status', filters.approvalStatus)
  }

  const limit = Math.min(filters.limit || 50, 200)
  const offset = filters.offset || 0

  return query
    .range(offset, offset + limit - 1)
    .order('created_at', { ascending: false })
}

export const getProductById = async ({ id, selectClause }) => {
  return supabase
    .from('products')
    .select(selectClause)
    .eq('id', id)
    .is('deleted_at', null)
    .single()
}

export const insertProduct = async (product) => {
  return supabase
    .from('products')
    .insert(product)
    .select()
    .single()
}

export const updateProductById = async (id, updates) => {
  return supabase
    .from('products')
    .update(updates as ProductUpdate)
    .eq('id', id)
    .select()
    .single()
}

export const listDeletedProducts = async () => {
  return supabase
    .from('products')
    .select(`
      id, name, description, category, subcategory,
      price_per_unit, unit_type, unit:unit_type,
      stock_quantity, min_order_quantity,
      vendor_id, is_available, approval_status,
      created_at, updated_at, deleted_at,
      vendor:profiles(id, role, first_name, last_name, store_name, phone, avatar_url)
    `)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
}

export const listPendingProducts = async ({ selectClause }) => {
  return supabase
    .from('products')
    .select(selectClause)
    .eq('approval_status', 'pending')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
}

export const updateManyProducts = async (ids, updates) => {
  return supabase
    .from('products')
    .update(updates as ProductUpdate)
    .in('id', ids)
    .select()
}
