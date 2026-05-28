import {
  fetchBuyerOrders,
  fetchVendorOrders,
  fetchAdminOrders,
  fetchOrderById,
  submitReturnRequest,
  updateOrderStatus,
  subscribeToVendorOrders,
  subscribeToOrderById,
  ordersService,
} from '@/services/ordersService'
import { supabase } from '@/services/supabase'
import {
  isProductImagesRelationError,
  hydrateRowsWithProductItems,
} from '@/services/productImages'
import { sanitizePostgRESTFilter } from '@/utils/sanitization.jsx'

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}))

jest.mock('@/services/productImages', () => ({
  isProductImagesRelationError: jest.fn(() => false),
  hydrateRowsWithProductItems: jest.fn(async (rows) => rows),
}))

jest.mock('@/utils/sanitization.jsx', () => ({
  sanitizePostgRESTFilter: jest.fn((value) => value),
}))

const createThenableBuilder = (response = { data: [], error: null, count: 0 }) => {
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    in: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    or: jest.fn(() => builder),
    order: jest.fn(() => builder),
    range: jest.fn(() => builder),
    update: jest.fn(() => builder),
    insert: jest.fn(() => builder),
    single: jest.fn(() => Promise.resolve(response)),
    then: (onFulfilled, onRejected) =>
      Promise.resolve(response).then(onFulfilled, onRejected),
  }

  return builder
}

describe('ordersService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('exports all expected public APIs', () => {
    expect(typeof fetchBuyerOrders).toBe('function')
    expect(typeof fetchVendorOrders).toBe('function')
    expect(typeof fetchAdminOrders).toBe('function')
    expect(typeof fetchOrderById).toBe('function')
    expect(typeof updateOrderStatus).toBe('function')
    expect(typeof subscribeToVendorOrders).toBe('function')
    expect(typeof subscribeToOrderById).toBe('function')

    expect(ordersService).toEqual(
      expect.objectContaining({
        fetchBuyerOrders,
        fetchVendorOrders,
        fetchAdminOrders,
        fetchOrderById,
        updateOrderStatus,
        subscribeToVendorOrders,
        subscribeToOrderById,
      }),
    )
  })

  it('fetchBuyerOrders applies active filter and pagination', async () => {
    const builder = createThenableBuilder({ data: [{ id: 'o1' }], error: null, count: 1 })
    supabase.from.mockReturnValue(builder)

    const result = await fetchBuyerOrders('buyer-1', {
      status: 'active',
      page: 2,
      limit: 5,
    })

    expect(supabase.from).toHaveBeenCalledWith('orders')
    expect(builder.eq).toHaveBeenCalledWith('buyer_id', 'buyer-1')
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false })
    expect(builder.range).toHaveBeenCalledWith(5, 9)
    expect(builder.in).toHaveBeenCalledWith('status', expect.any(Array))
    expect(result).toEqual({ data: [{ id: 'o1' }], error: null, total: 1 })
  })

  it('fetchBuyerOrders falls back when product_images relation is missing', async () => {
    const relationError = { message: 'missing relation' }
    const firstBuilder = createThenableBuilder({ data: null, error: relationError, count: null })
    const fallbackBuilder = createThenableBuilder({ data: [{ id: 'o2' }], error: null, count: 1 })

    supabase.from.mockReturnValue(firstBuilder)
    firstBuilder.select.mockReturnValueOnce(firstBuilder).mockReturnValueOnce(fallbackBuilder)

    isProductImagesRelationError.mockReturnValue(true)
    hydrateRowsWithProductItems.mockResolvedValue([{ id: 'hydrated-order' }])

    const result = await fetchBuyerOrders('buyer-2', { page: 1, limit: 10 })

    expect(isProductImagesRelationError).toHaveBeenCalledWith(relationError)
    expect(hydrateRowsWithProductItems).toHaveBeenCalledWith([{ id: 'o2' }])
    expect(result).toEqual({ data: [{ id: 'hydrated-order' }], error: null, total: 1 })
  })

  it('fetchVendorOrders applies filters and returns total count', async () => {
    const builder = createThenableBuilder({ data: [{ id: 'v1' }], error: null, count: 33 })
    supabase.from.mockReturnValue(builder)

    const result = await fetchVendorOrders('vendor-1', {
      status: 'active',
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      page: 1,
      limit: 20,
    })

    expect(builder.eq).toHaveBeenCalledWith('vendor_id', 'vendor-1')
    expect(builder.in).toHaveBeenCalledWith('status', expect.any(Array))
    expect(builder.gte).toHaveBeenCalledWith('created_at', '2026-01-01')
    expect(builder.lte).toHaveBeenCalledWith('created_at', '2026-01-31')
    expect(builder.range).toHaveBeenCalledWith(0, 19)
    expect(result.total).toBe(33)
  })

  it('fetchAdminOrders applies vendor/date/search filters and normalizes commission_data', async () => {
    const builder = createThenableBuilder({
      data: [{ id: 'a1', subtotal: 120, total_amount: 150 }],
      error: null,
      count: 1,
    })
    supabase.from.mockReturnValue(builder)
    sanitizePostgRESTFilter.mockReturnValue('SAFE')

    const result = await fetchAdminOrders(
      {
        status: 'delivered',
        search: 'ORD-1',
        vendorId: 'vendor-88',
        dateFrom: '2026-02-01',
        dateTo: '2026-02-10',
      },
      { page: 1, limit: 25 },
    )

    expect(builder.eq).toHaveBeenCalledWith('vendor_id', 'vendor-88')
    expect(builder.eq).toHaveBeenCalledWith('status', 'delivered')
    expect(builder.or).toHaveBeenCalledWith(
      'order_number.ilike.%SAFE%,buyer_id.eq.SAFE,vendor_id.eq.SAFE',
    )
    expect(builder.gte).toHaveBeenCalledWith('created_at', expect.any(String))
    expect(builder.lte).toHaveBeenCalledWith('created_at', expect.any(String))
    expect(result.data[0].commission_data).toEqual({ subtotal: 120, total_amount: 150 })
    expect(result.total).toBe(1)
  })

  it('fetchOrderById maps PGRST116 to NOT_FOUND', async () => {
    const builder = createThenableBuilder({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
      count: null,
    })
    supabase.from.mockReturnValue(builder)

    const result = await fetchOrderById('missing-order', 'buyer')

    expect(result.data).toBeNull()
    expect(result.error).toEqual(expect.objectContaining({ code: 'NOT_FOUND' }))
  })

  it('updateOrderStatus rejects invalid transitions', async () => {
    const existingBuilder = createThenableBuilder({
      data: { id: 'o1', status: 'pending', buyer_id: 'b1', order_number: 'ORD-1' },
      error: null,
      count: null,
    })

    supabase.from.mockReturnValue(existingBuilder)

    const result = await updateOrderStatus('o1', 'delivered', { confirmed_at: '2026-01-01T00:00:00.000Z' })

    expect(result.data).toBeNull()
    expect(result.error).toEqual(
      expect.objectContaining({ code: 'INVALID_STATUS_TRANSITION' }),
    )
  })

  it('updateOrderStatus applies metadata and creates notification on valid transition', async () => {
    const existingBuilder = createThenableBuilder({
      data: { id: 'o2', status: 'pending', buyer_id: 'buyer-77', order_number: 'ORD-22' },
      error: null,
      count: null,
    })
    const updateBuilder = createThenableBuilder({
      data: { id: 'o2', status: 'vendor_accepted' },
      error: null,
      count: null,
    })
    const notificationBuilder = createThenableBuilder({ data: {}, error: null, count: null })

    supabase.from
      .mockReturnValueOnce(existingBuilder)
      .mockReturnValueOnce(updateBuilder)
      .mockReturnValueOnce(notificationBuilder)

    const result = await updateOrderStatus('o2', 'vendor_accepted', {
      confirmed_at: '2026-01-10T10:00:00.000Z',
      source: 'vendor-panel',
    })

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'vendor_accepted',
        confirmed_at: '2026-01-10T10:00:00.000Z',
        source: 'vendor-panel',
      }),
    )
    expect(notificationBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'buyer-77',
        type: 'order',
      }),
    )
    expect(result).toEqual({ data: { id: 'o2', status: 'vendor_accepted' }, error: null })
  })

  it('subscribeToVendorOrders and subscribeToOrderById register channels and cleanup', () => {
    const channelBuilder = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnValue({ id: 'chan-1' }),
    }

    supabase.channel.mockReturnValue(channelBuilder)

    const unSubVendor = subscribeToVendorOrders('vendor-7', jest.fn())
    const unSubOrder = subscribeToOrderById('order-9', jest.fn())

    expect(supabase.channel).toHaveBeenCalledWith('vendor-orders-vendor-7')
    expect(supabase.channel).toHaveBeenCalledWith('order-order-9')

    unSubVendor()
    unSubOrder()

    expect(supabase.removeChannel).toHaveBeenCalledTimes(2)
  })

  it('submitReturnRequest resolves vendor_id and inserts schema-compatible payload', async () => {
    const orderLookupBuilder = createThenableBuilder({
      data: { vendor_id: 'vendor-42' },
      error: null,
      count: null,
    })

    const returnInsertBuilder = createThenableBuilder({
      data: { id: 'rr-1', order_id: 'order-1' },
      error: null,
      count: null,
    })

    supabase.from
      .mockReturnValueOnce(orderLookupBuilder)
      .mockReturnValueOnce(returnInsertBuilder)

    const result = await submitReturnRequest({
      orderId: 'order-1',
      buyerId: 'buyer-9',
      reason: 'damaged',
      description: 'Item arrived damaged',
      itemIds: ['item-a', 'item-b'],
    })

    expect(orderLookupBuilder.select).toHaveBeenCalledWith('vendor_id')
    expect(orderLookupBuilder.eq).toHaveBeenCalledWith('id', 'order-1')

    expect(returnInsertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: 'order-1',
        buyer_id: 'buyer-9',
        user_id: 'buyer-9',
        vendor_id: 'vendor-42',
        items: ['item-a', 'item-b'],
      }),
    )

    const insertedPayload = returnInsertBuilder.insert.mock.calls[0][0]
    expect(insertedPayload).not.toHaveProperty('item_ids')
    expect(result).toEqual({ id: 'rr-1', order_id: 'order-1' })
  })

  it('submitReturnRequest throws when vendor lookup fails', async () => {
    const orderLookupBuilder = createThenableBuilder({
      data: null,
      error: { message: 'lookup failed' },
      count: null,
    })

    supabase.from.mockReturnValueOnce(orderLookupBuilder)

    await expect(
      submitReturnRequest({
        orderId: 'order-2',
        buyerId: 'buyer-11',
        reason: 'wrong_item',
        description: 'Wrong product',
        itemIds: ['item-c'],
      }),
    ).rejects.toEqual(expect.objectContaining({ message: 'lookup failed' }))
  })
})
