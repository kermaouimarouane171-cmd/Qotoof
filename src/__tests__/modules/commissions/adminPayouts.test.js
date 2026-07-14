import { getAdminPayouts, getPayoutFinancialAuditLogs, updateAdminPayoutStatus } from '@/modules/commissions/api/adminPayouts'

const fromCalls = []
const builderState = { selectQuery: '', eqCalls: [], gteCalls: [], orderCalls: [], limitCalls: [], updatePayloads: [], insertPayloads: [] }
let mockData = []
let mockError = null
let mockUpdateError = null
let mockRpcError = null
let mockNotificationError = null
const rpcCalls = []

const createBuilder = () => {
  let operation = 'select'
  let currentUpdatePayload = null
  let currentInsertPayload = null
  const builder = {
    select: jest.fn((query) => {
      operation = 'select'
      builderState.selectQuery = query
      return builder
    }),
    update: jest.fn((payload) => {
      operation = 'update'
      currentUpdatePayload = payload
      return builder
    }),
    insert: jest.fn((payload) => {
      operation = 'insert'
      currentInsertPayload = payload
      return builder
    }),
    eq: jest.fn((column, value) => {
      builderState.eqCalls.push({ column, value })
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
      if (operation === 'update' && currentUpdatePayload) {
        builderState.updatePayloads.push(currentUpdatePayload)
        return Promise.resolve(callback({ data: null, error: mockUpdateError }))
      }
      if (operation === 'insert' && currentInsertPayload) {
        builderState.insertPayloads.push(currentInsertPayload)
        return Promise.resolve(callback({ data: null, error: mockNotificationError }))
      }
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
    rpc: jest.fn((fnName, params) => {
      rpcCalls.push({ fnName, params })
      return Promise.resolve({ data: null, error: mockRpcError })
    }),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}))

jest.mock('@/utils/currency', () => ({
  formatPrice: jest.fn((amount) => `${amount} MAD`),
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  },
}))

describe('getAdminPayouts — API tests', () => {
  beforeEach(() => {
    fromCalls.length = 0
    builderState.selectQuery = ''
    builderState.eqCalls = []
    builderState.gteCalls = []
    builderState.orderCalls = []
    builderState.limitCalls = []
    mockData = []
    mockError = null
    jest.clearAllMocks()
  })

  test('calls supabase.from with payouts table', async () => {
    await getAdminPayouts()
    expect(fromCalls).toContain('payouts')
  })

  test('selects the expected columns including user join', async () => {
    await getAdminPayouts()
    expect(builderState.selectQuery).toContain('*')
    expect(builderState.selectQuery).toContain('vendor:profiles!vendor_id')
    expect(builderState.selectQuery).toContain('first_name')
    expect(builderState.selectQuery).toContain('last_name')
    expect(builderState.selectQuery).toContain('email')
    expect(builderState.selectQuery).toContain('store_name')
    expect(builderState.selectQuery).toContain('phone')
  })

  test('orders by created_at descending', async () => {
    await getAdminPayouts()
    expect(builderState.orderCalls.length).toBe(1)
    expect(builderState.orderCalls[0].column).toBe('created_at')
    expect(builderState.orderCalls[0].opts).toEqual({ ascending: false })
  })

  test('applies gte filter on created_at when dateRange is not "all"', async () => {
    await getAdminPayouts({ dateRange: '30d' })
    expect(builderState.gteCalls.length).toBe(1)
    expect(builderState.gteCalls[0].column).toBe('created_at')
    expect(builderState.gteCalls[0].value).toBeTruthy()
  })

  test('does not apply gte filter when dateRange is "all"', async () => {
    await getAdminPayouts({ dateRange: 'all' })
    expect(builderState.gteCalls.length).toBe(0)
  })

  test('applies eq filter on status when statusFilter is not "all"', async () => {
    await getAdminPayouts({ statusFilter: 'pending' })
    expect(builderState.eqCalls.length).toBe(1)
    expect(builderState.eqCalls[0].column).toBe('status')
    expect(builderState.eqCalls[0].value).toBe('pending')
  })

  test('does not apply eq filter when statusFilter is "all"', async () => {
    await getAdminPayouts({ statusFilter: 'all' })
    expect(builderState.eqCalls.filter(c => c.column === 'status')).toHaveLength(0)
  })

  test('computes correct date range for 7d', async () => {
    await getAdminPayouts({ dateRange: '7d' })
    expect(builderState.gteCalls.length).toBe(1)
    const gteValue = new Date(builderState.gteCalls[0].value)
    const now = new Date()
    const diffMs = now.getTime() - gteValue.getTime()
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
    expect(diffDays).toBeGreaterThanOrEqual(6)
    expect(diffDays).toBeLessThanOrEqual(8)
  })

  test('computes correct date range for 3m (90d)', async () => {
    await getAdminPayouts({ dateRange: '3m' })
    expect(builderState.gteCalls.length).toBe(1)
    const gteValue = new Date(builderState.gteCalls[0].value)
    const now = new Date()
    const diffMs = now.getTime() - gteValue.getTime()
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
    expect(diffDays).toBeGreaterThanOrEqual(89)
    expect(diffDays).toBeLessThanOrEqual(91)
  })

  test('defaults to 30d when no dateRange provided', async () => {
    await getAdminPayouts()
    expect(builderState.gteCalls.length).toBe(1)
    const gteValue = new Date(builderState.gteCalls[0].value)
    const now = new Date()
    const diffMs = now.getTime() - gteValue.getTime()
    const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000))
    expect(diffDays).toBeGreaterThanOrEqual(29)
    expect(diffDays).toBeLessThanOrEqual(31)
  })

  test('returns { data, error } shape', async () => {
    mockData = [{ id: 'p1', amount: 5000 }]
    const result = await getAdminPayouts()
    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('error')
    expect(result.data).toEqual([{ id: 'p1', amount: 5000 }])
    expect(result.error).toBeNull()
  })

  test('returns error when query fails', async () => {
    mockError = new Error('Query failed')
    const result = await getAdminPayouts()
    expect(result.error).toBeInstanceOf(Error)
    expect(result.data).toEqual([])
  })

  test('does not perform Supabase write operations', async () => {
    const { supabase } = require('@/services/supabase')
    await getAdminPayouts()
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(supabase.insert).not.toHaveBeenCalled()
    expect(supabase.update).not.toHaveBeenCalled()
    expect(supabase.delete).not.toHaveBeenCalled()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })
})

describe('getPayoutFinancialAuditLogs — API tests', () => {
  beforeEach(() => {
    fromCalls.length = 0
    builderState.selectQuery = ''
    builderState.eqCalls = []
    builderState.gteCalls = []
    builderState.orderCalls = []
    builderState.limitCalls = []
    mockData = []
    mockError = null
    jest.clearAllMocks()
  })

  test('calls supabase.from with financial_audit_log table', async () => {
    await getPayoutFinancialAuditLogs({ payoutId: 'payout-1' })
    expect(fromCalls).toContain('financial_audit_log')
  })

  test('selects the expected columns including performed_by_profile join', async () => {
    await getPayoutFinancialAuditLogs({ payoutId: 'payout-1' })
    expect(builderState.selectQuery).toContain('*')
    expect(builderState.selectQuery).toContain('performed_by_profile:profiles!financial_audit_log_performed_by_fkey')
    expect(builderState.selectQuery).toContain('first_name')
    expect(builderState.selectQuery).toContain('last_name')
    expect(builderState.selectQuery).toContain('role')
  })

  test('filters by entity_type = payout', async () => {
    await getPayoutFinancialAuditLogs({ payoutId: 'payout-1' })
    const entityTypeCall = builderState.eqCalls.find(c => c.column === 'entity_type')
    expect(entityTypeCall).toBeDefined()
    expect(entityTypeCall.value).toBe('payout')
  })

  test('filters by entity_id = payoutId', async () => {
    await getPayoutFinancialAuditLogs({ payoutId: 'payout-42' })
    const entityIdCall = builderState.eqCalls.find(c => c.column === 'entity_id')
    expect(entityIdCall).toBeDefined()
    expect(entityIdCall.value).toBe('payout-42')
  })

  test('orders by created_at ascending', async () => {
    await getPayoutFinancialAuditLogs({ payoutId: 'payout-1' })
    expect(builderState.orderCalls.length).toBe(1)
    expect(builderState.orderCalls[0].column).toBe('created_at')
    expect(builderState.orderCalls[0].opts).toEqual({ ascending: true })
  })

  test('returns { data, error } shape', async () => {
    mockData = [{ id: 'log-1', action: 'manual_adjustment' }]
    const result = await getPayoutFinancialAuditLogs({ payoutId: 'payout-1' })
    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('error')
    expect(result.data).toEqual([{ id: 'log-1', action: 'manual_adjustment' }])
    expect(result.error).toBeNull()
  })

  test('returns error when query fails', async () => {
    mockError = new Error('Query failed')
    const result = await getPayoutFinancialAuditLogs({ payoutId: 'payout-1' })
    expect(result.error).toBeInstanceOf(Error)
    expect(result.data).toEqual([])
  })

  test('does not perform Supabase write operations', async () => {
    const { supabase } = require('@/services/supabase')
    await getPayoutFinancialAuditLogs({ payoutId: 'payout-1' })
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(supabase.insert).not.toHaveBeenCalled()
    expect(supabase.update).not.toHaveBeenCalled()
    expect(supabase.delete).not.toHaveBeenCalled()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })
})

describe('updateAdminPayoutStatus — API tests (Phase 8.6: transactional RPC)', () => {
  const mockPayout = {
    id: 'payout-1',
    vendor_id: 'vendor-1',
    amount: 5000,
    status: 'pending',
  }
  const mockCurrentUser = { id: 'admin-1', role: 'admin' }

  const mockRpcSuccessData = {
    success: true,
    error_code: null,
    message: 'Payout status updated successfully',
    payout_id: 'payout-1',
    previous_status: 'pending',
    new_status: 'processing',
    audit_logged: true,
    vendor_id: 'vendor-1',
    amount: 5000,
  }

  let mockRpcData = null
  let mockRpcLogicalFail = null

  beforeEach(() => {
    fromCalls.length = 0
    rpcCalls.length = 0
    builderState.eqCalls = []
    builderState.updatePayloads = []
    builderState.insertPayloads = []
    mockUpdateError = null
    mockRpcError = null
    mockNotificationError = null
    mockRpcData = mockRpcSuccessData
    mockRpcLogicalFail = null
    const { supabase } = require('@/services/supabase')
    supabase.from.mockImplementation((table) => {
      fromCalls.push(table)
      return createBuilder()
    })
    supabase.rpc.mockImplementation((fnName, params) => {
      rpcCalls.push({ fnName, params })
      if (mockRpcLogicalFail) {
        return Promise.resolve({ data: mockRpcLogicalFail, error: null })
      }
      return Promise.resolve({ data: mockRpcData, error: mockRpcError })
    })
    jest.clearAllMocks()
    // Re-establish after clearAllMocks
    supabase.from.mockImplementation((table) => {
      fromCalls.push(table)
      return createBuilder()
    })
    supabase.rpc.mockImplementation((fnName, params) => {
      rpcCalls.push({ fnName, params })
      if (mockRpcLogicalFail) {
        return Promise.resolve({ data: mockRpcLogicalFail, error: null })
      }
      return Promise.resolve({ data: mockRpcData, error: mockRpcError })
    })
  })

  test('calls rpc("update_payout_status_transactional") with correct payload', async () => {
    await updateAdminPayoutStatus({ payoutId: 'payout-1', newStatus: 'processing', payout: mockPayout, currentUser: mockCurrentUser })
    const rpcCall = rpcCalls.find(c => c.fnName === 'update_payout_status_transactional')
    expect(rpcCall).toBeDefined()
    expect(rpcCall.params).toEqual({
      p_payout_id: 'payout-1',
      p_new_status: 'processing',
      p_reason: null,
      p_details: { updated_by: 'admin-1', new_status: 'processing' },
    })
  })

  test('does NOT call direct payouts.update', async () => {
    await updateAdminPayoutStatus({ payoutId: 'payout-1', newStatus: 'processing', payout: mockPayout, currentUser: mockCurrentUser })
    expect(builderState.updatePayloads.length).toBe(0)
  })

  test('does NOT call direct log_financial_audit RPC', async () => {
    await updateAdminPayoutStatus({ payoutId: 'payout-1', newStatus: 'processing', payout: mockPayout, currentUser: mockCurrentUser })
    const auditCalls = rpcCalls.filter(c => c.fnName === 'log_financial_audit')
    expect(auditCalls).toHaveLength(0)
  })

  test('inserts notification with correct payload when RPC succeeds and vendor_id exists', async () => {
    await updateAdminPayoutStatus({ payoutId: 'payout-1', newStatus: 'processing', payout: mockPayout, currentUser: mockCurrentUser })
    expect(builderState.insertPayloads.length).toBe(1)
    const payload = builderState.insertPayloads[0]
    expect(payload.user_id).toBe('vendor-1')
    expect(payload.type).toBe('payout')
    expect(payload.title).toBe('Payout Processing')
    expect(payload.message).toContain('processing')
    expect(payload.data).toEqual({ payout_id: 'payout-1', amount: 5000, status: 'processing' })
  })

  test('skips notification insert when vendor_id is null', async () => {
    mockRpcData = { ...mockRpcSuccessData, vendor_id: null }
    await updateAdminPayoutStatus({ payoutId: 'payout-1', newStatus: 'processing', payout: { ...mockPayout, vendor_id: null }, currentUser: mockCurrentUser })
    expect(builderState.insertPayloads.length).toBe(0)
  })

  test('returns { error: null, side_effects_failed: [] } on full success', async () => {
    const result = await updateAdminPayoutStatus({ payoutId: 'payout-1', newStatus: 'processing', payout: mockPayout, currentUser: mockCurrentUser })
    expect(result).toEqual({ error: null, side_effects_failed: [] })
  })

  test('RPC error returns { error } and does NOT attempt notification', async () => {
    mockRpcError = new Error('RPC connection failed')
    const result = await updateAdminPayoutStatus({ payoutId: 'payout-1', newStatus: 'processing', payout: mockPayout, currentUser: mockCurrentUser })
    expect(result.error).toBeInstanceOf(Error)
    expect(result.side_effects_failed).toBeUndefined()
    expect(builderState.insertPayloads.length).toBe(0)
  })

  test('RPC logical failure (success=false) returns { error } and does NOT attempt notification', async () => {
    mockRpcLogicalFail = {
      success: false,
      error_code: 'not_authorized',
      message: 'Only admins can update payout status',
    }
    const result = await updateAdminPayoutStatus({ payoutId: 'payout-1', newStatus: 'processing', payout: mockPayout, currentUser: mockCurrentUser })
    expect(result.error).toBeInstanceOf(Error)
    expect(result.error.message).toBe('Only admins can update payout status')
    expect(result.side_effects_failed).toBeUndefined()
    expect(builderState.insertPayloads.length).toBe(0)
  })

  test('RPC failure calls logger.warn with payout_rpc_failed', async () => {
    mockRpcError = new Error('RPC connection failed')
    const { logger } = require('@/utils/logger')
    await updateAdminPayoutStatus({ payoutId: 'payout-1', newStatus: 'processing', payout: mockPayout, currentUser: mockCurrentUser })
    expect(logger.warn).toHaveBeenCalledWith('payout_rpc_failed', expect.objectContaining({
      payoutId: 'payout-1',
      newStatus: 'processing',
      adminId: 'admin-1',
    }))
  })

  test('notification insert failure returns { error: null, side_effects_failed: ["notification"] }', async () => {
    mockNotificationError = new Error('Notification failed')
    const { logger } = require('@/utils/logger')
    const result = await updateAdminPayoutStatus({ payoutId: 'payout-1', newStatus: 'processing', payout: mockPayout, currentUser: mockCurrentUser })
    expect(result.error).toBeNull()
    expect(result.side_effects_failed).toEqual(['notification'])
    expect(logger.warn).toHaveBeenCalledWith('payout_notification_failed', expect.objectContaining({
      payoutId: 'payout-1',
      newStatus: 'processing',
      userId: 'vendor-1',
    }))
  })

  test('no vendor_id: skips notification, no side_effects_failed, no logger.warn', async () => {
    mockRpcData = { ...mockRpcSuccessData, vendor_id: null }
    const { logger } = require('@/utils/logger')
    const result = await updateAdminPayoutStatus({ payoutId: 'payout-1', newStatus: 'processing', payout: { ...mockPayout, vendor_id: null }, currentUser: mockCurrentUser })
    expect(result.error).toBeNull()
    expect(result.side_effects_failed).toEqual([])
    expect(builderState.insertPayloads.length).toBe(0)
    expect(logger.warn).not.toHaveBeenCalled()
  })

  test('full success: no logger.warn calls', async () => {
    const { logger } = require('@/utils/logger')
    await updateAdminPayoutStatus({ payoutId: 'payout-1', newStatus: 'processing', payout: mockPayout, currentUser: mockCurrentUser })
    expect(logger.warn).not.toHaveBeenCalled()
  })

  test('does not call Edge Functions', async () => {
    const { supabase } = require('@/services/supabase')
    await updateAdminPayoutStatus({ payoutId: 'payout-1', newStatus: 'processing', payout: mockPayout, currentUser: mockCurrentUser })
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })

  test('RPC call order: rpc before notification insert', async () => {
    const callOrder = []
    const { supabase } = require('@/services/supabase')
    jest.spyOn(supabase, 'rpc').mockImplementation((fnName, params) => {
      callOrder.push(`rpc:${fnName}`)
      rpcCalls.push({ fnName, params })
      return Promise.resolve({ data: mockRpcData, error: mockRpcError })
    })
    jest.spyOn(supabase, 'from').mockImplementation((table) => {
      callOrder.push(`from:${table}`)
      return createBuilder()
    })

    await updateAdminPayoutStatus({ payoutId: 'payout-1', newStatus: 'processing', payout: mockPayout, currentUser: mockCurrentUser })

    const rpcIdx = callOrder.findIndex(c => c === 'rpc:update_payout_status_transactional')
    const notifIdx = callOrder.findIndex(c => c === 'from:notifications')

    expect(rpcIdx).toBeGreaterThanOrEqual(0)
    expect(notifIdx).toBeGreaterThan(rpcIdx)

    supabase.rpc.mockRestore()
    supabase.from.mockRestore()
  })
})
