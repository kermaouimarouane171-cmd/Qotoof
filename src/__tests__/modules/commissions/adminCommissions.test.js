import { getAdminCommissionsPayments } from '@/modules/commissions/api/adminCommissions'

const fromCalls = []
const builderState = { selectQuery: '', gteCalls: [], orderCalls: [], limitCalls: [] }
let mockData = []
let mockError = null

const createBuilder = () => {
  const builder = {
    select: jest.fn((query) => {
      builderState.selectQuery = query
      return builder
    }),
    gte: jest.fn((column, value) => {
      builderState.gteCalls.push({ column, value })
      return builder
    }),
    order: jest.fn((column, opts) => {
      builderState.orderCalls.push({ column, opts })
      return builder
    }),
    limit: jest.fn((n) => {
      builderState.limitCalls.push(n)
      return builder
    }),
    then: jest.fn((callback) => {
      return Promise.resolve(callback({ data: mockData, error: mockError }))
    }),
  }
  return builder
}

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn((table) => {
      fromCalls.push(table)
      return createBuilder()
    }),
    rpc: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}))

describe('getAdminCommissionsPayments — API tests', () => {
  beforeEach(() => {
    fromCalls.length = 0
    builderState.selectQuery = ''
    builderState.gteCalls = []
    builderState.orderCalls = []
    builderState.limitCalls = []
    mockData = []
    mockError = null
    jest.clearAllMocks()
  })

  test('calls supabase.from with payments table', async () => {
    await getAdminCommissionsPayments({ period: '30d' })
    expect(fromCalls).toContain('payments')
  })

  test('selects the expected columns', async () => {
    await getAdminCommissionsPayments({ period: '30d' })
    expect(builderState.selectQuery).toContain('id')
    expect(builderState.selectQuery).toContain('order_id')
    expect(builderState.selectQuery).toContain('amount')
    expect(builderState.selectQuery).toContain('payment_method')
    expect(builderState.selectQuery).toContain('status')
    expect(builderState.selectQuery).toContain('created_at')
  })

  test('applies gte filter on created_at', async () => {
    await getAdminCommissionsPayments({ period: '30d' })
    expect(builderState.gteCalls.length).toBe(1)
    expect(builderState.gteCalls[0].column).toBe('created_at')
    expect(builderState.gteCalls[0].value).toBeTruthy()
  })

  test('orders by created_at descending', async () => {
    await getAdminCommissionsPayments({ period: '30d' })
    expect(builderState.orderCalls.length).toBe(1)
    expect(builderState.orderCalls[0].column).toBe('created_at')
    expect(builderState.orderCalls[0].opts).toEqual({ ascending: false })
  })

  test('limits to 100 rows', async () => {
    await getAdminCommissionsPayments({ period: '30d' })
    expect(builderState.limitCalls).toContain(100)
  })

  test('returns { data, error } shape', async () => {
    mockData = [{ id: 'p1', amount: 100 }]
    const result = await getAdminCommissionsPayments({ period: '30d' })
    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('error')
    expect(result.data).toEqual([{ id: 'p1', amount: 100 }])
    expect(result.error).toBeNull()
  })

  test('returns error when query fails', async () => {
    mockError = new Error('Query failed')
    const result = await getAdminCommissionsPayments({ period: '30d' })
    expect(result.error).toBeInstanceOf(Error)
    expect(result.data).toEqual([])
  })

  test('does not perform Supabase write operations', async () => {
    const { supabase } = require('@/services/supabase')
    await getAdminCommissionsPayments({ period: '30d' })
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(supabase.insert).not.toHaveBeenCalled()
    expect(supabase.update).not.toHaveBeenCalled()
    expect(supabase.delete).not.toHaveBeenCalled()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  test('computes correct date range for 7d period', async () => {
    await getAdminCommissionsPayments({ period: '7d' })
    expect(builderState.gteCalls.length).toBe(1)
    const gteValue = new Date(builderState.gteCalls[0].value)
    const now = new Date()
    const diffMs = now.getTime() - gteValue.getTime()
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
    expect(diffDays).toBeGreaterThanOrEqual(6)
    expect(diffDays).toBeLessThanOrEqual(8)
  })

  test('defaults to 30d when no period provided', async () => {
    await getAdminCommissionsPayments()
    expect(builderState.gteCalls.length).toBe(1)
    const gteValue = new Date(builderState.gteCalls[0].value)
    const now = new Date()
    const diffMs = now.getTime() - gteValue.getTime()
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
    expect(diffDays).toBeGreaterThanOrEqual(29)
    expect(diffDays).toBeLessThanOrEqual(31)
  })
})
