jest.mock('@/services/supabase', () => ({
  supabase: mockSupabase,
}))

jest.mock('@/utils/withRetry', () => ({
  withRetry: (fn) => fn(),
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
  invokeResolver: jest.fn(),
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
    or: jest.fn((filter) => {
      state.filters.push({ op: 'or', value: filter })
      return builder
    }),
    in: jest.fn((field, values) => {
      state.filters.push({ field, value: values })
      return builder
    }),
    order: jest.fn(() => builder),
    range: jest.fn(() => builder),
    limit: jest.fn(() => builder),
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
    functions: {
      invoke: jest.fn((name, options) => Promise.resolve(mockSupabaseState.invokeResolver(name, options))),
    },
    auth: {
      getUser: jest.fn(async () => ({
        data: { user: { id: 'user-1' } },
        error: null,
      })),
    },
  }

  globalThis.__mockSupabase = mockSupabase

  return {
    supabase: mockSupabase,
  }
})

import {
  confirmPayment,
  createPaymentIntent,
  getPaymentById,
  paymentGateway,
} from '@/services/paymentGateway'

const mockSupabase = globalThis.__mockSupabase

describe('paymentGateway', () => {
  const fixedNow = new Date('2026-05-23T10:00:00.000Z')

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(fixedNow)
    paymentGateway.bankDetailsCache.clear()
    paymentGateway.paymentIntentCache.clear()
    paymentGateway.paypalClientId = 'paypal-client'
    mockSupabaseState.queryResolver.mockImplementation(() => ({
      data: null,
      error: null,
    }))
    mockSupabaseState.invokeResolver.mockImplementation(() => ({
      data: null,
      error: null,
    }))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('createPaymentIntent creates a payment record with the right amount and currency', async () => {
    let capturedInsert = null

    mockSupabaseState.invokeResolver.mockImplementation((name, options) => {
      expect(name).toBe('create-paypal-order')
      expect(options.body).toMatchObject({
        orderId: 'order-1',
        amount: 250,
        currency: 'MAD',
      })

      return {
        data: {
          orderId: 'pp-order-1',
          approvalUrl: 'https://paypal.example.com/checkout',
        },
        error: null,
      }
    })

    mockSupabaseState.queryResolver.mockImplementation((state) => {
      capturedInsert = state
      return {
        data: {
          id: 'payment-1',
          ...state.payload,
        },
        error: null,
      }
    })

    const result = await createPaymentIntent({
      orderId: 'order-1',
      amount: 250,
      currency: 'MAD',
      paymentMethod: 'paypal',
      customer: { email: 'buyer@example.com', name: 'Buyer Name' },
    })

    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({
      paymentId: 'payment-1',
      orderId: 'pp-order-1',
      approvalUrl: 'https://paypal.example.com/checkout',
      status: 'redirecting',
    })
    expect(capturedInsert.action).toBe('insert')
    expect(capturedInsert.payload).toMatchObject({
      order_id: 'order-1',
      amount: 250,
      payment_method: 'paypal',
      status: 'pending',
      transaction_id: 'pp-order-1',
    })
  })

  it('confirmPayment updates payment status to confirmed', async () => {
    let updateState = null

    mockSupabaseState.queryResolver.mockImplementation((state) => {
      if (state.action === 'update') {
        updateState = state
        return {
          data: {
            id: 'payment-2',
            status: 'confirmed',
          },
          error: null,
        }
      }

      return {
        data: {
          id: 'payment-2',
          status: 'pending',
          payment_method: 'bank',
        },
        error: null,
      }
    })

    const result = await confirmPayment('payment-2')

    expect(result.error).toBeNull()
    expect(result.data).toMatchObject({
      id: 'payment-2',
      status: 'confirmed',
    })
    expect(updateState.payload).toMatchObject({
      status: 'confirmed',
      confirmed_at: fixedNow.toISOString(),
    })
  })

  it('refundPayment creates a refund record and updates the payment', async () => {
    const queryStates = []

    mockSupabaseState.queryResolver.mockImplementation((state) => {
      queryStates.push(state)

      if (state.table === 'refunds') {
        return {
          data: { id: 'refund-1' },
          error: null,
        }
      }

      if (state.action === 'update') {
        return {
          data: {
            id: 'payment-3',
            status: 'refunded',
          },
          error: null,
        }
      }

      return {
        data: {
          id: 'payment-3',
          order_id: 'order-3',
          payment_method: 'bank',
          transaction_id: 'txn-3',
        },
        error: null,
      }
    })

    const result = await paymentGateway.refundPayment('payment-3', 125, 'customer_request')

    expect(result).toEqual({ success: true, status: 'refunded' })
    expect(queryStates[1].payload).toMatchObject({
      status: 'refunded',
      refund_amount: 125,
      refund_reason: 'customer_request',
      refunded_at: fixedNow.toISOString(),
    })
    expect(queryStates[2].table).toBe('refunds')
    expect(queryStates[2].payload).toMatchObject({
      payment_id: 'payment-3',
      order_id: 'order-3',
      amount: 125,
      reason: 'customer_request',
      status: 'refunded',
    })
  })

  it('getPaymentById returns the payment row with joins', async () => {
    let capturedState = null
    mockSupabaseState.queryResolver.mockImplementation((state) => {
      capturedState = state
      return {
        data: {
          id: 'payment-4',
          order: {
            id: 'order-4',
            order_number: 'ORD-004',
            buyer: { id: 'buyer-4', first_name: 'Amina' },
            vendor: { id: 'vendor-4', first_name: 'Youssef', store_name: 'Farm Shop' },
          },
        },
        error: null,
      }
    })

    const result = await getPaymentById('payment-4')

    expect(result.error).toBeNull()
    expect(result.data.order.vendor.store_name).toBe('Farm Shop')
    expect(capturedState.selection).toContain('order:orders(')
    expect(capturedState.filters).toEqual([{ field: 'id', value: 'payment-4' }])
    expect(capturedState.terminal).toBe('single')
  })

  it('bankDetailsCache returns the cached result on the second call', async () => {
    mockSupabaseState.invokeResolver.mockImplementation((name, options) => ({
      data: {
        bankName: 'Bank of Morocco',
        iban: 'MA0000000000000000000000000',
        referenceNumber: options.body.referenceNumber,
      },
      error: null,
    }))

    const first = await paymentGateway.getCachedBankDetails('ref-1')
    const second = await paymentGateway.getCachedBankDetails('ref-1')

    expect(first).toEqual(second)
    expect(mockSupabase.functions.invoke).toHaveBeenCalledTimes(1)
  })

  it('createPaymentIntent is idempotent for the same order', async () => {
    mockSupabaseState.invokeResolver.mockImplementation(() => ({
      data: { orderId: 'pp-order-2', approvalUrl: 'https://paypal.example.com/checkout' },
      error: null,
    }))

    mockSupabaseState.queryResolver.mockImplementation(() => ({
      data: {
        id: 'payment-5',
      },
      error: null,
    }))

    const first = await createPaymentIntent({
      orderId: 'order-5',
      amount: 300,
      currency: 'MAD',
      paymentMethod: 'paypal',
      customer: { email: 'buyer@example.com', name: 'Buyer Name' },
    })
    const second = await createPaymentIntent({
      orderId: 'order-5',
      amount: 300,
      currency: 'MAD',
      paymentMethod: 'paypal',
      customer: { email: 'buyer@example.com', name: 'Buyer Name' },
    })

    expect(second).toBe(first)
    expect(mockSupabase.functions.invoke).toHaveBeenCalledTimes(1)
    expect(mockSupabase.from).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['createPaymentIntent', () => createPaymentIntent({
      orderId: 'error-order',
      amount: 99,
      currency: 'MAD',
      paymentMethod: 'paypal',
      customer: { email: 'buyer@example.com', name: 'Buyer Name' },
    })],
    ['confirmPayment', () => confirmPayment('error-payment')],
    ['getPaymentById', () => getPaymentById('error-payment')],
  ])('%s returns wrapped errors on supabase failure', async (_label, call) => {
    const error = new Error('supabase exploded')

    mockSupabaseState.invokeResolver.mockImplementation(() => ({
      data: null,
      error,
    }))
    mockSupabaseState.queryResolver.mockImplementation(() => ({
      data: null,
      error,
    }))

    const result = await call()

    expect(result).toEqual({
      data: null,
      error,
    })
  })

  it('refundPayment throws when supabase fails', async () => {
    mockSupabaseState.queryResolver.mockImplementation(() => ({
      data: null,
      error: new Error('supabase exploded'),
    }))

    await expect(paymentGateway.refundPayment('error-payment', 50, 'error')).rejects.toThrow('supabase exploded')
  })

  it('getCachedBankDetails returns null when supabase returns an error', async () => {
    const error = new Error('bank lookup failed')
    mockSupabaseState.invokeResolver.mockImplementation(() => ({
      data: null,
      error,
    }))

    await expect(paymentGateway.getCachedBankDetails('ref-error')).resolves.toBeNull()
  })
})
