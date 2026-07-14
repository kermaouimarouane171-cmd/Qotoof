/**
 * @module ordersService
 * @description Centralised Supabase queries on the `orders` table.
 *
 * All exported functions return `{ data, error }` so callers can pattern-match
 * on the error rather than wrapping in try/catch.
 *
 * Legacy helpers (`fetchBuyerOrdersAll`, `submitReturnRequest`) are kept for
 * backward compatibility with existing callers.
 */

import { supabase } from '@/services/supabase'
import type {
  PostgrestError,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import {
  isProductImagesRelationError,
  hydrateRowsWithProductItems,
} from '@/modules/catalog'
import { sanitizePostgRESTFilter } from '@/utils/sanitization.jsx'
import {
  buildOrderStatusUpdatePayload,
  isAllowedOrderStatusTransition,
} from '@/business/orderLogic'
import {
  fetchOrderStatusContext,
  insertOrderNotification,
  updateOrderById,
} from '@/data/orderRepository'

type Order = Database['public']['Tables']['orders']['Row']
type ReturnRequestRow = Database['public']['Tables']['return_requests']['Row']
type OrderStatusValue = Database['public']['Tables']['orders']['Row']['status']

type ServiceResult = {
  data: Order[] | null
  error: PostgrestError | null
}

type ServiceResultWithTotal = ServiceResult & {
  total: number | null
}

type SingleOrderResult = {
  data: Order | null
  error: PostgrestError | null
}

type OrderStatusFilter = 'all' | 'active' | 'delivered' | 'cancelled'
type Role = 'buyer' | 'vendor' | 'driver' | 'admin'

type VendorFilters = {
  status?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

type BuyerFilters = {
  status?: OrderStatusFilter
  dateFrom?: string
  dateTo?: string
  page?: number
  limit?: number
}

type AdminFilters = {
  status?: OrderStatusFilter
  search?: string
  vendorId?: string
  dateFrom?: string
  dateTo?: string
}

type Pagination = {
  page?: number
  limit?: number
}

type OrderStatusMetadata = {
  cancelled_reason?: string
  confirmed_at?: string
  cancelled_at?: string
  delivered_at?: string
  [key: string]: unknown
}

type ReturnRequestPayload = {
  orderId: string
  buyerId: string
  reason: string
  description: string
  itemIds: string[]
}

const asPostgrestError = (err: unknown): PostgrestError => err as PostgrestError

// ── Status sets ───────────────────────────────────────────────────────────────

const ACTIVE_ORDER_STATUSES = [
  'pending',
  'vendor_accepted',
  'preparing',
  'driver_assigned',
  'driver_accepted',
  'driver_picked_up',
  'on_the_way',
]

const asOrderStatusList = (statuses: string[]) => statuses as unknown as readonly OrderStatusValue[]
const asOrderStatus = (status: string) => status as unknown as OrderStatusValue

// ── Select clauses ────────────────────────────────────────────────────────────

const VENDOR_ORDERS_SELECT = `
  *,
  buyer:profiles!buyer_id(first_name, last_name, phone),
  items:order_items(*, product:products(name)),
  deliveries:deliveries(
    id,
    driver_id,
    status,
    driver:profiles!driver_id(first_name, last_name, phone),
    current_latitude,
    current_longitude,
    delivery_latitude,
    delivery_longitude
  )
`

const BUYER_ORDER_COLUMNS = `
  id,
  order_number,
  status,
  payment_status,
  payment_method,
  payment_type,
  total,
  subtotal,
  shipping_cost,
  created_at,
  updated_at,
  delivered_at,
  buyer_id,
  vendor_id,
  driver_id
`

const BUYER_ORDERS_SELECT = `
  ${BUYER_ORDER_COLUMNS},
  vendor:profiles!vendor_id(first_name, last_name, store_name, phone),
  items:order_items(id, quantity, unit_price, product_id, product:products(id, name, images:product_images(url, is_primary))),
  deliveries:deliveries(id, status, driver_id, current_latitude, current_longitude)
`

const BUYER_ORDERS_SELECT_NO_IMAGES = `
  ${BUYER_ORDER_COLUMNS},
  vendor:profiles!vendor_id(first_name, last_name, store_name, phone),
  items:order_items(id, quantity, unit_price, product_id, product:products(id, name)),
  deliveries:deliveries(id, status, driver_id, current_latitude, current_longitude)
`

const ADMIN_ORDERS_SELECT = `
  *,
  buyer:profiles!buyer_id(id, first_name, last_name, email, phone, avatar_url),
  vendor:profiles!vendor_id(id, first_name, last_name, email, phone, store_name, avatar_url, latitude, longitude),
  driver:profiles!driver_id(id, first_name, last_name, phone, avatar_url, latitude, longitude, vehicle_type),
  items:order_items(*, product:products(id, name, images:product_images(url, is_primary))),
  deliveries:deliveries(
    id,
    driver_id,
    status,
    current_latitude,
    current_longitude,
    delivery_latitude,
    delivery_longitude,
    driver:profiles!driver_id(id, first_name, last_name, phone, avatar_url)
  )
`

const ADMIN_ORDERS_SELECT_NO_IMAGES = `
  *,
  buyer:profiles!buyer_id(id, first_name, last_name, email, phone, avatar_url),
  vendor:profiles!vendor_id(id, first_name, last_name, email, phone, store_name, avatar_url, latitude, longitude),
  driver:profiles!driver_id(id, first_name, last_name, phone, avatar_url, latitude, longitude, vehicle_type),
  items:order_items(*, product:products(id, name)),
  deliveries:deliveries(
    id,
    driver_id,
    status,
    current_latitude,
    current_longitude,
    delivery_latitude,
    delivery_longitude,
    driver:profiles!driver_id(id, first_name, last_name, phone, avatar_url)
  )
`

const ORDER_BY_ID_SELECT = `
  *,
  buyer:profiles!orders_buyer_id_fkey(id, first_name, last_name, phone),
  vendor:profiles!orders_vendor_id_fkey(id, first_name, last_name, store_name, phone, latitude, longitude),
  driver:profiles!orders_driver_id_fkey(id, first_name, last_name, phone, avatar_url, latitude, longitude, vehicle_type),
  items:order_items(*, product:products(id, name, images:product_images(url, is_primary))),
  deliveries:deliveries(
    id,
    driver_id,
    status,
    current_latitude,
    current_longitude,
    delivery_latitude,
    delivery_longitude,
    driver:profiles!driver_id(id, first_name, last_name, phone, avatar_url)
  )
`

const ORDER_BY_ID_SELECT_NO_IMAGES = `
  *,
  buyer:profiles!orders_buyer_id_fkey(id, first_name, last_name, phone),
  vendor:profiles!orders_vendor_id_fkey(id, first_name, last_name, store_name, phone, latitude, longitude),
  driver:profiles!orders_driver_id_fkey(id, first_name, last_name, phone, avatar_url, latitude, longitude, vehicle_type),
  items:order_items(*, product:products(id, name)),
  deliveries:deliveries(
    id,
    driver_id,
    status,
    current_latitude,
    current_longitude,
    delivery_latitude,
    delivery_longitude,
    driver:profiles!driver_id(id, first_name, last_name, phone, avatar_url)
  )
`

// ── Vendor ────────────────────────────────────────────────────────────────────

/**
 * Fetch orders for a vendor with optional filtering and pagination.
 *
 * @param {string} vendorId - The vendor's profile ID.
 * @param {{
 *   status?: string,
 *   dateFrom?: string,
 *   dateTo?: string,
 *   page?: number,
 *   limit?: number,
 * }} [filters={}]
 * @returns {Promise<{ data: Object[]|null, error: Error|null, total: number|null }>}
 */
export const fetchVendorOrders = async (
  vendorId: string,
  filters: VendorFilters = {},
): Promise<ServiceResultWithTotal> => {
  try {
    let query = supabase
      .from('orders')
      .select(VENDOR_ORDERS_SELECT, { count: 'exact' })
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })

    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'active') {
        query = query.in('status', asOrderStatusList(ACTIVE_ORDER_STATUSES))
      } else {
        query = query.eq('status', asOrderStatus(filters.status))
      }
    }

    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
    if (filters.dateTo) query = query.lte('created_at', filters.dateTo)

    if (filters.limit) {
      const page = filters.page || 1
      const from = (page - 1) * filters.limit
      query = query.range(from, from + filters.limit - 1)
    }

    const { data, error, count } = await query
    if (error) throw error
    return { data: (data as Order[]) || [], error: null, total: count }
  } catch (err) {
    return { data: null, error: asPostgrestError(err), total: null }
  }
}

/**
 * Subscribe to real-time order changes for a vendor.
 *
 * @param {string} vendorId - The vendor's profile ID.
 * @param {function(payload: Object): void} callback - Called on every change event.
 * @returns {function(): void} Unsubscribe function — call it on component unmount.
 */
export const subscribeToVendorOrders = (
  vendorId: string,
  callback: (payload: RealtimePostgresChangesPayload<Order>) => void,
) => {
  const channel = supabase
    .channel(`vendor-orders-${vendorId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `vendor_id=eq.${vendorId}`,
      },
      callback,
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

// ── Buyer ─────────────────────────────────────────────────────────────────────

/**
 * Fetch paginated orders for a buyer with optional filtering.
 * Automatically falls back to a no-images query if the `product_images`
 * relation is missing, then hydrates the rows client-side.
 *
 * @param {string} buyerId - The buyer's user ID.
 * @param {{
 *   status?: 'all'|'active'|'delivered'|'cancelled',
 *   dateFrom?: string,
 *   dateTo?: string,
 *   page?: number,
 *   limit?: number,
 * }} [filters={}]
 * @returns {Promise<{ data: Object[]|null, error: Error|null, total: number|null }>}
 */
export const fetchBuyerOrders = async (
  buyerId: string,
  filters: BuyerFilters = {},
): Promise<ServiceResultWithTotal> => {
  const PAGE_SIZE = filters.limit || 10
  const page = filters.page || 1
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const buildQuery = (selectClause: string): any => {
    let q = supabase
      .from('orders')
      .select(selectClause, { count: 'exact' })
      .eq('buyer_id', buyerId)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (filters.status === 'active') {
      q = q.in('status', asOrderStatusList(ACTIVE_ORDER_STATUSES))
    } else if (filters.status === 'delivered') {
      q = q.eq('status', 'delivered')
    } else if (filters.status === 'cancelled') {
      q = q.in('status', asOrderStatusList(['cancelled', 'vendor_rejected']))
    }

    if (filters.dateFrom) q = q.gte('created_at', new Date(filters.dateFrom).toISOString())
    if (filters.dateTo) {
      const end = new Date(filters.dateTo)
      end.setHours(23, 59, 59, 999)
      q = q.lte('created_at', end.toISOString())
    }

    return q
  }

  try {
    let result: any = await buildQuery(BUYER_ORDERS_SELECT)

    if (result.error) {
      if (!isProductImagesRelationError(result.error)) throw result.error

      // product_images relation missing — fetch without images and hydrate
      const fallback = await buildQuery(BUYER_ORDERS_SELECT_NO_IMAGES)
      if (fallback.error) throw fallback.error

      const hydrated = await hydrateRowsWithProductItems(fallback.data || [])
      return { data: hydrated as Order[], error: null, total: fallback.count }
    }

    return { data: (result.data as unknown as Order[]) || [], error: null, total: result.count }
  } catch (err) {
    return { data: null, error: asPostgrestError(err), total: null }
  }
}

/**
 * Fetch all orders for a buyer without pagination (used for data export).
 *
 * @param {string} buyerId - The buyer's user ID.
 * @returns {Promise<Object[]>} Array of order rows (throws on error).
 */
export const fetchBuyerOrdersAll = async (buyerId: string): Promise<Order[]> => {
  const { data, error } = await supabase
    .from('orders')
    .select(
      'id, order_number, status, created_at, updated_at, buyer_id, vendor_id, driver_id, ' +
      'subtotal, shipping_cost, total, payment_type, payment_method, delivery_option, ' +
      'shipping_address, shipping_city, shipping_latitude, shipping_longitude, ' +
      'accepted_at, delivered_at, cancelled_at, cancellation_reason, buyer_notes, vendor_notes',
    )
    .eq('buyer_id', buyerId)

  if (error) throw error
  return (data as unknown as Order[]) || []
}

// ── Admin ─────────────────────────────────────────────────────────────────────

/**
 * Fetch paginated orders for the admin panel with optional filtering and search.
 *
 * @param {{
 *   status?: 'all'|'active'|'delivered'|'cancelled',
 *   search?: string,
 * }} [filters={}]
 * @param {{
 *   page?: number,
 *   limit?: number,
 * }} [pagination={}]
 * @returns {Promise<{ data: Object[]|null, error: Error|null, total: number|null }>}
 */
export const fetchAdminOrders = async (
  filters: AdminFilters = {},
  pagination: Pagination = {},
): Promise<ServiceResultWithTotal> => {
  const limit = pagination.limit || 20
  const page = pagination.page || 1
  const from = (page - 1) * limit
  const to = from + limit - 1

  try {
    const buildQuery = (selectClause: string): any => {
      let query = supabase
      .from('orders')
      .select(selectClause, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

      if (filters.status === 'active') {
        query = query.in('status', asOrderStatusList(ACTIVE_ORDER_STATUSES))
      } else if (filters.status === 'delivered') {
        query = query.eq('status', 'delivered')
      } else if (filters.status === 'cancelled') {
        query = query.in('status', asOrderStatusList(['cancelled', 'refunded', 'vendor_rejected']))
      }

      if (filters.search) {
        const safe = sanitizePostgRESTFilter(filters.search)
        query = query.or(
          `order_number.ilike.%${safe}%,buyer_id.eq.${safe},vendor_id.eq.${safe}`,
        )
      }

      if (filters.vendorId) {
        query = query.eq('vendor_id', filters.vendorId)
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', new Date(filters.dateFrom).toISOString())
      }

      if (filters.dateTo) {
        const end = new Date(filters.dateTo)
        end.setHours(23, 59, 59, 999)
        query = query.lte('created_at', end.toISOString())
      }

      return query
    }

    let result: any = await buildQuery(ADMIN_ORDERS_SELECT)

    if (result.error) {
      if (!isProductImagesRelationError(result.error)) throw result.error

      const fallback = await buildQuery(ADMIN_ORDERS_SELECT_NO_IMAGES)
      if (fallback.error) throw fallback.error

      result = {
        ...fallback,
        data: (await hydrateRowsWithProductItems(fallback.data || [])) as unknown as Order[],
      }
    }

    const { data, count } = result
    const normalizedData = (((data as unknown as Order[]) || [])).map((order) => ({
      ...order,
      commission_data: {
        subtotal: (order as Record<string, unknown>).subtotal ?? 0,
        total_amount: (order as Record<string, unknown>).total_amount ?? (order as Record<string, unknown>).total ?? 0,
      },
    })) as Order[]
    return { data: normalizedData, error: null, total: count }
  } catch (err) {
    return { data: null, error: asPostgrestError(err), total: null }
  }
}

// ── Single order ──────────────────────────────────────────────────────────────

/**
 * Fetch a single order by ID with all related profiles and items.
 *
 * The `role` parameter is reserved for future role-specific field scoping;
 * currently the same comprehensive join is used for all roles so that
 * tracking, condition-capture, and admin detail pages share one query.
 *
 * Row-level security enforced by Supabase policies ensures each caller
 * only receives rows they are authorised to view.
 *
 * @param {string} orderId - The order's UUID.
 * @param {'buyer'|'vendor'|'driver'|'admin'} [role='buyer']
 * @returns {Promise<{ data: Object|null, error: Error|null }>}
 */
export const fetchOrderById = async (
  orderId: string,
  role: Role = 'buyer',
): Promise<SingleOrderResult> => {
  void role // reserved for future role-specific select scoping

  try {
    let result = await supabase
      .from('orders')
      .select(ORDER_BY_ID_SELECT)
      .eq('id', orderId)
      .single()

    if (result.error) {
      if (!isProductImagesRelationError(result.error)) throw result.error

      const fallback = await supabase
        .from('orders')
        .select(ORDER_BY_ID_SELECT_NO_IMAGES)
        .eq('id', orderId)
        .single()

      if (fallback.error) throw fallback.error

      const hydrated = await hydrateRowsWithProductItems([fallback.data])
      return { data: (hydrated?.[0] as Order) || (fallback.data as Order), error: null }
    }

    const order = result.data as Order

    if (!order) {
      const notFoundError = { message: 'NOT_FOUND', code: 'NOT_FOUND' } as PostgrestError
      return { data: null, error: notFoundError }
    }

    return { data: result.data as Order, error: null }
  } catch (err) {
    const error = asPostgrestError(err)
    if ((error as { code?: string }).code === 'PGRST116') {
      return { data: null, error: { ...error, message: 'NOT_FOUND', code: 'NOT_FOUND' } as PostgrestError }
    }
    return { data: null, error }
  }
}

/**
 * Update an order status. `updatedBy` is accepted for call-site consistency.
 *
 * @param {string} orderId
 * @param {string} status
 * @param {string|null} updatedBy
 * @returns {Promise<{ data: Object|null, error: Error|null }>}
 */
export const updateOrderStatus = async (
  orderId: string,
  status: string,
  metadataOrUpdatedBy: OrderStatusMetadata | string | null = null,
): Promise<SingleOrderResult> => {
  try {
    const metadata = typeof metadataOrUpdatedBy === 'object' && metadataOrUpdatedBy !== null
      ? metadataOrUpdatedBy
      : {}

    // 1) Load current status for transition validation
    const { data: existingOrder, error: existingError } = await fetchOrderStatusContext(orderId)

    if (existingError) throw existingError

    const currentStatus = (existingOrder as { status?: string })?.status || ''

    if (!isAllowedOrderStatusTransition(currentStatus, status)) {
      throw {
        message: `INVALID_STATUS_TRANSITION: ${currentStatus} -> ${status}`,
        code: 'INVALID_STATUS_TRANSITION',
      } as PostgrestError
    }

    // 2) Build update payload with metadata/timestamps
    const updatePayload = buildOrderStatusUpdatePayload(status, metadata)

    // 3) Persist
    const { data, error } = await updateOrderById(orderId, updatePayload)

    if (error) throw error

    // 4) Trigger notification (best effort)
    await insertOrderNotification({
      userId: (existingOrder as { buyer_id?: string })?.buyer_id,
      orderId,
      orderNumber: (existingOrder as { order_number?: string })?.order_number,
      previousStatus: currentStatus,
      status,
      metadata,
    })

    return { data: data as Order, error: null }
  } catch (err) {
    return { data: null, error: asPostgrestError(err) }
  }
}

/**
 * Subscribe to updates for a specific order row.
 */
export const subscribeToOrderById = (
  orderId: string,
  callback: (payload: RealtimePostgresChangesPayload<Order>) => void,
) => {
  const channel = supabase
    .channel(`order-${orderId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      },
      callback,
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}

// ── Misc ──────────────────────────────────────────────────────────────────────

/**
 * Submit a return request for a delivered order.
 *
 * @param {{
 *   orderId: string,
 *   buyerId: string,
 *   reason: string,
 *   description: string,
 *   itemIds: string[],
 * }} payload
 * @returns {Promise<Object>} Inserted return_request row (throws on error).
 */
export const submitReturnRequest = async ({
  orderId,
  buyerId,
  reason,
  description,
  itemIds,
}: ReturnRequestPayload): Promise<ReturnRequestRow | null> => {
  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select('vendor_id')
    .eq('id', orderId)
    .single()

  if (orderError) throw orderError

  const { data, error } = await supabase
    .from('return_requests')
    .insert({
      order_id: orderId,
      buyer_id: buyerId,
      user_id: buyerId,
      vendor_id: orderRow.vendor_id,
      reason,
      description,
      items: itemIds,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return data as ReturnRequestRow | null
}

export const ordersService = {
  fetchBuyerOrders,
  fetchVendorOrders,
  fetchAdminOrders,
  fetchOrderById,
  updateOrderStatus,
  subscribeToVendorOrders,
  subscribeToOrderById,
}

export default ordersService
