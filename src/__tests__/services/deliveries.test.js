jest.mock('@/services/supabase', () => ({
  supabase: mockSupabase,
}))

jest.mock('@/utils/withRetry', () => ({
  withRetry: (fn) => fn,
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

const mockSupabaseState = {
  queryResolver: jest.fn(),
}

const mockDeliveryChannel = {
  topic: 'delivery:del-1',
  unsubscribe: jest.fn(),
}

const mockDeliveryChannelBuilder = {
  lastCallback: null,
  lastFilter: null,
  on: jest.fn((event, filter, callback) => {
    mockDeliveryChannelBuilder.lastCallback = callback
    mockDeliveryChannelBuilder.lastFilter = filter
    return mockDeliveryChannelBuilder
  }),
  subscribe: jest.fn(() => mockDeliveryChannel),
}

const mockCreateQueryBuilder = (table) => {
  const state = {
    table,
    action: null,
    payload: null,
    selection: null,
    filters: [],
    terminal: null,
  }

  const builder = {
    select: jest.fn((selection) => {
      state.selection = selection
      return builder
    }),
    insert: jest.fn((payload) => {
      state.action = 'insert'
      state.payload = payload
      return builder
    }),
    update: jest.fn((payload) => {
      state.action = 'update'
      state.payload = payload
      return builder
    }),
    eq: jest.fn((field, value) => {
      state.filters.push({ field, value })
      return builder
    }),
    maybeSingle: jest.fn(() => {
      state.terminal = 'maybeSingle'
      return builder
    }),
    single: jest.fn(() => {
      state.terminal = 'single'
      return builder
    }),
    then: (resolve, reject) => {
      try {
        return Promise.resolve(mockSupabaseState.queryResolver(state)).then(resolve, reject)
      } catch (error) {
        return Promise.reject(error).then(resolve, reject)
      }
    },
  }

  return builder
}

jest.mock('@/services/supabase', () => {
  const mockSupabase = {
    from: jest.fn((table) => mockCreateQueryBuilder(table)),
    channel: jest.fn(() => mockDeliveryChannelBuilder),
    removeChannel: jest.fn(),
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: { id: 'driver-1' } },
        error: null,
      })),
    },
    functions: {
      invoke: jest.fn(),
    },
  }

  globalThis.__mockSupabase = mockSupabase

  return {
    supabase: mockSupabase,
  }
})

import {
  assignDriver,
  createDelivery,
  fetchDeliveryById,
  markDelivered,
  subscribeToDeliveryUpdates,
  updateDeliveryStatus,
} from '@/services/deliveries'

const mockSupabase = globalThis.__mockSupabase

describe('deliveries service', () => {
  const fixedNow = new Date('2026-05-23T10:00:00.000Z')

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(fixedNow)
    mockSupabaseState.queryResolver.mockImplementation(() => ({
      data: null,
      error: null,
    }))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('fetchDeliveryById returns the joined delivery row', async () => {
    let capturedState = null
    mockSupabaseState.queryResolver.mockImplementation((state) => {
      capturedState = state
      return {
        data: {
          id: 'del-1',
          order_id: 'order-1',
          status: 'assigned',
          order: { id: 'order-1', order_number: 'ORD-001' },
        },
        error: null,
      }
    })

    const result = await fetchDeliveryById('del-1')

    expect(result).toEqual({
      data: {
        id: 'del-1',
        order_id: 'order-1',
        status: 'assigned',
        order: { id: 'order-1', order_number: 'ORD-001' },
      },
      error: null,
    })
    expect(mockSupabase.from).toHaveBeenCalledWith('deliveries')
    expect(capturedState.selection).toContain('order:orders(')
    expect(capturedState.filters).toEqual([{ field: 'id', value: 'del-1' }])
    expect(capturedState.terminal).toBe('maybeSingle')
  })

  it('updateDeliveryStatus updates status and timestamps', async () => {
    let capturedState = null
    mockSupabaseState.queryResolver.mockImplementation((state) => {
      capturedState = state
      return {
        data: {
          id: 'del-2',
          ...state.payload,
        },
        error: null,
      }
    })

    const result = await updateDeliveryStatus('del-2', 'picked_up')

    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({
      id: 'del-2',
      status: 'picked_up',
      updated_at: fixedNow.toISOString(),
      picked_up_at: fixedNow.toISOString(),
    })
    expect(capturedState.payload).toMatchObject({
      status: 'picked_up',
      updated_at: fixedNow.toISOString(),
      picked_up_at: fixedNow.toISOString(),
    })
  })

  it('subscribeToDeliveryUpdates creates the realtime channel and unsubscribes it', () => {
    const callback = jest.fn()
    const unsubscribe = subscribeToDeliveryUpdates('del-3', callback)

    expect(mockSupabase.channel).toHaveBeenCalledWith('delivery:del-3')
    expect(mockDeliveryChannelBuilder.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'UPDATE',
        schema: 'public',
        table: 'deliveries',
        filter: 'id=eq.del-3',
      }),
      expect.any(Function)
    )

    mockDeliveryChannelBuilder.lastCallback({ new: { id: 'del-3', status: 'delivered' } })

    expect(callback).toHaveBeenCalledWith({ id: 'del-3', status: 'delivered' })

    unsubscribe()

    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockDeliveryChannel)
  })

  it('createDelivery creates a delivery with the initial status', async () => {
    let capturedState = null
    mockSupabaseState.queryResolver.mockImplementation((state) => {
      capturedState = state
      return {
        data: {
          id: 'del-4',
          ...state.payload,
          created_at: fixedNow.toISOString(),
        },
        error: null,
      }
    })

    const result = await createDelivery({
      orderId: 'order-4',
      vendorId: 'vendor-4',
      driverId: 'driver-4',
      status: 'assigned',
    })

    expect(result.data).toMatchObject({
      id: 'del-4',
      order_id: 'order-4',
      vendor_id: 'vendor-4',
      driver_id: 'driver-4',
      status: 'assigned',
    })
    expect(capturedState.action).toBe('insert')
    expect(capturedState.payload).toEqual({
      order_id: 'order-4',
      vendor_id: 'vendor-4',
      driver_id: 'driver-4',
      status: 'assigned',
    })
  })

  it('assignDriver updates driver_id and status', async () => {
    let capturedState = null
    mockSupabaseState.queryResolver.mockImplementation((state) => {
      capturedState = state
      return {
        data: {
          id: 'del-5',
          ...state.payload,
        },
        error: null,
      }
    })

    const result = await assignDriver('del-5', 'driver-5')

    expect(result.data).toMatchObject({
      id: 'del-5',
      driver_id: 'driver-5',
      status: 'assigned',
      assigned_at: fixedNow.toISOString(),
    })
    expect(capturedState.payload).toMatchObject({
      driver_id: 'driver-5',
      status: 'assigned',
      assigned_at: fixedNow.toISOString(),
    })
  })

  it('markDelivered sets delivered_at and proof photo url', async () => {
    let capturedState = null
    mockSupabaseState.queryResolver.mockImplementation((state) => {
      capturedState = state
      return {
        data: {
          id: 'del-6',
          ...state.payload,
        },
        error: null,
      }
    })

    const result = await markDelivered('del-6', 'https://cdn.example.com/proof.jpg')

    expect(result.data).toMatchObject({
      id: 'del-6',
      status: 'delivered',
      delivered_at: fixedNow.toISOString(),
      proof_photo_url: 'https://cdn.example.com/proof.jpg',
    })
    expect(capturedState.payload).toMatchObject({
      status: 'delivered',
      delivered_at: fixedNow.toISOString(),
      proof_photo_url: 'https://cdn.example.com/proof.jpg',
    })
  })

  it.each([
    ['createDelivery', () => createDelivery({ orderId: 'order-err' })],
    ['fetchDeliveryById', () => fetchDeliveryById('del-err')],
    ['updateDeliveryStatus', () => updateDeliveryStatus('del-err', 'accepted')],
    ['assignDriver', () => assignDriver('del-err', 'driver-err')],
    ['markDelivered', () => markDelivered('del-err', 'proof-url')],
  ])('%s returns wrapped errors when supabase fails', async (_label, call) => {
    const error = new Error('supabase exploded')
    mockSupabaseState.queryResolver.mockImplementation(() => ({
      data: null,
      error,
    }))

    await expect(call()).resolves.toEqual({
      data: null,
      error,
    })
  })
})
