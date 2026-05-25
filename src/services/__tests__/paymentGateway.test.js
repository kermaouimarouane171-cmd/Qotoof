jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

jest.mock('@/utils/withRetry', () => {
  const calls = []
  const withRetry = (fn, options = {}) => {
    calls.push({ fn, options })

    const execute = async (...args) => fn(...args)
    const wrapped = (...args) => execute(...args)
    wrapped.then = (onFulfilled, onRejected) => execute().then(onFulfilled, onRejected)
    wrapped.catch = (onRejected) => execute().catch(onRejected)
    wrapped.finally = (onFinally) => execute().finally(onFinally)

    return wrapped
  }

  globalThis.__paymentWithRetryCalls = calls

  return { withRetry }
})

jest.mock('@/lib/config', () => ({
  getPayPalClientId: jest.fn(() => 'paypal-client-id'),
}))

jest.mock('@/services/supabase', () => {
  const tableResponses = new Map()
  const buildersByTable = new Map()

  const getResponse = (table) => tableResponses.get(table) || { data: null, error: null, count: null }

  const makeBuilder = (table) => {
    const builder = {
      _table: table,
      _insertPayload: null,
      _updatePayload: null,
      _eqCalls: [],
      _selectArg: null,
      _orderArg: null,
      _limitArg: null,
      _orArg: null,
      select: jest.fn((arg) => {
        builder._selectArg = arg
        return builder
      }),
      insert: jest.fn((payload) => {
        builder._insertPayload = payload
        return builder
      }),
      update: jest.fn((payload) => {
        builder._updatePayload = payload
        return builder
      }),
      eq: jest.fn((key, value) => {
        builder._eqCalls.push([key, value])
        return builder
      }),
      in: jest.fn(() => builder),
      or: jest.fn((arg) => {
        builder._orArg = arg
        return builder
      }),
      order: jest.fn((field, options) => {
        builder._orderArg = [field, options]
        return builder
      }),
      limit: jest.fn((n) => {
        builder._limitArg = n
        return builder
      }),
      single: jest.fn(() => builder),
      maybeSingle: jest.fn(() => builder),
      range: jest.fn(() => builder),
      then: (onFulfilled, onRejected) => Promise.resolve(getResponse(table)).then(onFulfilled, onRejected),
    }

    if (!buildersByTable.has(table)) {
      buildersByTable.set(table, [])
    }
    buildersByTable.get(table).push(builder)

    return builder
  }

  const supabase = {
    from: jest.fn((table) => makeBuilder(table)),
    functions: {
      invoke: jest.fn(),
    },
  }

  globalThis.__paymentSupabase = supabase
  globalThis.__paymentTableResponses = tableResponses
  globalThis.__paymentBuildersByTable = buildersByTable

  return { supabase }
})

import paymentGateway, {
  confirmPayment,
  createPaymentIntent,
} from '@/services/paymentGateway'
import {
  getLatestPaymentRecordForOrder,
  getPaymentRecordById,
  insertPaymentRecord,
  normalizePaymentMethod,
  resolvePaymentMethod,
  updatePaymentRecordById,
} from '@/services/paymentRecords'
import { confirmOrderPayment } from '@/services/paymentService'
import {
  getCMIStatus,
  initCMIPayment,
  verifyCMICallback,
} from '@/services/cmiPayment'

const mockSupabase = globalThis.__paymentSupabase
const tableResponses = globalThis.__paymentTableResponses
const buildersByTable = globalThis.__paymentBuildersByTable
const withRetryCalls = globalThis.__paymentWithRetryCalls

const latestBuilder = (table) => {
  const list = buildersByTable.get(table) || []
  return list[list.length - 1]
}

describe('payment gateway and related services', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    tableResponses.clear()
    buildersByTable.clear()
    withRetryCalls.length = 0

    paymentGateway.bankDetailsCache.clear()
    paymentGateway.paymentIntentCache.clear()
    paymentGateway.bankDetailsTtlMs = 5 * 60 * 1000

    mockSupabase.functions.invoke.mockResolvedValue({ data: {}, error: null })
  })

  describe('paymentGateway — Stripe', () => {
    it('rejects unsupported Stripe method in Morocco gateway', async () => {
      await expect(
        paymentGateway.initializePayment({
          orderId: 'order-1',
          amount: 1000,
          paymentMethod: 'stripe',
          customer: { email: 'buyer@test.ma', name: 'Buyer' },
        }),
      ).rejects.toThrow('Unsupported payment method for Morocco')
    })

    it('createPaymentIntent uses cache for same input key', async () => {
      tableResponses.set('payments', {
        data: { id: 'pay-cached-1', order_id: 'ord-cache', payment_method: 'cod', status: 'pending' },
        error: null,
      })

      const params = {
        orderId: 'ord-cache',
        amount: 100,
        paymentMethod: 'cod',
        customer: { name: 'Buyer', phone: '+212611111111' },
      }

      const first = await createPaymentIntent(params)
      const second = await createPaymentIntent(params)

      expect(first.error).toBeNull()
      expect(second.error).toBeNull()
      expect(mockSupabase.from).toHaveBeenCalledTimes(1)
    })
  })

  describe('paymentGateway — PayPal', () => {
    it('creates PayPal order with correct amount and MAD currency', async () => {
      mockSupabase.functions.invoke
        .mockResolvedValueOnce({
          data: { orderId: 'PP-123', approvalUrl: 'https://paypal.test/approve/PP-123' },
          error: null,
        })

      tableResponses.set('payments', {
        data: {
          id: 'pay-pp-1',
          order_id: 'ord-pp-1',
          payment_method: 'paypal',
          status: 'pending',
          transaction_id: 'PP-123',
        },
        error: null,
      })

      const result = await paymentGateway.processPayPalPayment({
        orderId: 'ord-pp-1',
        amount: 250.75,
        currency: 'MAD',
        customer: { email: 'buyer@test.ma', name: 'Buyer' },
      })

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('create-paypal-order', {
        body: expect.objectContaining({
          orderId: 'ord-pp-1',
          amount: 250.75,
          currency: 'MAD',
        }),
      })
      expect(result).toEqual(
        expect.objectContaining({
          method: 'paypal',
          orderId: 'PP-123',
          approvalUrl: 'https://paypal.test/approve/PP-123',
          status: 'redirecting',
        }),
      )
    })

    it('captures PayPal payment after approval', async () => {
      mockSupabase.functions.invoke.mockResolvedValueOnce({
        data: {
          status: 'COMPLETED',
          paymentStatus: 'completed',
          internalOrderId: 'internal-1',
        },
        error: null,
      })

      const result = await paymentGateway.confirmPayPalPayment('PP-ORDER-9')

      expect(result).toEqual({
        status: 'completed',
        orderId: 'PP-ORDER-9',
        internalOrderId: 'internal-1',
      })
    })

    it('handles PayPal error response', async () => {
      mockSupabase.functions.invoke.mockResolvedValueOnce({
        data: null,
        error: { message: 'buyer cancelled' },
      })

      await expect(paymentGateway.confirmPayPalPayment('PP-CANCEL')).rejects.toThrow('buyer cancelled')
    })
  })

  describe('paymentGateway — COD (Cash on Delivery)', () => {
    it('creates COD order record without gateway processing', async () => {
      tableResponses.set('payments', {
        data: {
          id: 'cod-1',
          order_id: 'ord-cod',
          payment_method: 'cod',
          status: 'pending',
        },
        error: null,
      })

      const result = await paymentGateway.processCodPayment({
        orderId: 'ord-cod',
        amount: 399,
        customer: { name: 'Buyer', phone: '+212611111111' },
      })

      expect(result.status).toBe('confirmed')
      expect(result.method).toBe('cod')
      expect(mockSupabase.functions.invoke).not.toHaveBeenCalled()
    })
  })

  describe('paymentGateway — Bank Transfer', () => {
    it('returns vendor bank details and caches them in memory', async () => {
      tableResponses.set('payments', {
        data: {
          id: 'bank-1',
          order_id: 'ord-bank',
          payment_method: 'bank',
          status: 'awaiting_transfer',
        },
        error: null,
      })

      mockSupabase.functions.invoke.mockResolvedValue({
        data: { rib: 'RIB123', bank_name: 'Attijari', account_holder: 'Vendor Co' },
        error: null,
      })

      const first = await paymentGateway.processBankTransfer({
        orderId: 'ord-bank',
        amount: 900,
        customer: { name: 'Buyer' },
      })

      const second = await paymentGateway.processBankTransfer({
        orderId: 'ord-bank-2',
        amount: 901,
        customer: { name: 'Buyer' },
      })

      const bankInvokeCalls = mockSupabase.functions.invoke.mock.calls.filter(
        ([fnName]) => fnName === 'get-bank-details',
      )

      expect(bankInvokeCalls).toHaveLength(1)
      expect(first.bankDetails).toEqual(expect.objectContaining({ rib: 'RIB123' }))
      expect(second.bankDetails).toEqual(expect.objectContaining({ rib: 'RIB123' }))
    })

    it('cache expires after configured duration', async () => {
      tableResponses.set('payments', {
        data: {
          id: 'bank-exp-1',
          order_id: 'ord-bank-exp',
          payment_method: 'bank',
          status: 'awaiting_transfer',
        },
        error: null,
      })

      paymentGateway.bankDetailsTtlMs = 10

      const nowSpy = jest.spyOn(Date, 'now')
      nowSpy
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1050)
        .mockReturnValue(1051)

      mockSupabase.functions.invoke
        .mockResolvedValueOnce({ data: { rib: 'RIB-A' }, error: null })
        .mockResolvedValueOnce({ data: { rib: 'RIB-B' }, error: null })

      await paymentGateway.getCachedBankDetails('REF-1')
      await paymentGateway.getCachedBankDetails('REF-2')

      const bankInvokeCalls = mockSupabase.functions.invoke.mock.calls.filter(
        ([fnName]) => fnName === 'get-bank-details',
      )
      expect(bankInvokeCalls).toHaveLength(2)

      nowSpy.mockRestore()
    })

    it('admin/manual confirmation updates status via confirmPayment wrapper', async () => {
      tableResponses.set('payments', {
        data: {
          id: 'bank-manual-1',
          order_id: 'ord-manual',
          payment_method: 'bank',
          status: 'awaiting_transfer',
        },
        error: null,
      })

      const result = await confirmPayment('bank-manual-1')

      expect(result.error).toBeNull()
      expect(result.data.status).toBe('confirmed')
    })
  })

  describe('Commission Calculation', () => {
    it('delegates commission confirmation to edge function and returns summary payload', async () => {
      mockSupabase.functions.invoke.mockResolvedValueOnce({
        data: {
          success: true,
          order: { id: 'ord-commission', payment_status: 'confirmed' },
          commission: {
            amount: 30,
            percentage: 3,
            vendor_receives: 970,
          },
        },
        error: null,
      })

      const result = await confirmOrderPayment({ orderId: 'ord-commission' })

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('confirm-order-payment', {
        body: { orderId: 'ord-commission' },
      })
      expect(result).toEqual(
        expect.objectContaining({
          success: true,
          commission: expect.objectContaining({ percentage: 3 }),
        }),
      )
    })
  })

  describe('paymentRecords CRUD', () => {
    it('insertPaymentRecord saves with normalized shape', async () => {
      tableResponses.set('payments', {
        data: {
          id: 'p1',
          order_id: 'ord-1',
          payment_method: 'bank_transfer',
          method: 'bank_transfer',
          status: 'pending',
          amount: 100,
          currency: 'MAD',
          reference_number: 'REF-1',
        },
        error: null,
      })

      const { data, error } = await insertPaymentRecord({
        payload: {
          order_id: 'ord-1',
          payment_method: 'bank_transfer',
          status: 'pending',
          amount: 100,
          currency: 'MAD',
          reference_number: 'REF-1',
        },
      })

      expect(error).toBeNull()
      expect(data).toEqual(
        expect.objectContaining({
          id: 'p1',
          order_id: 'ord-1',
          payment_method: 'bank',
          method: 'bank',
          status: 'pending',
          amount: 100,
          currency: 'MAD',
        }),
      )
    })

    it('getLatestPaymentRecordForOrder fetches by orderId', async () => {
      tableResponses.set('payments', {
        data: {
          id: 'p2',
          order_id: 'ord-2',
          payment_method: 'cod',
          status: 'pending',
        },
        error: null,
      })

      const { data } = await getLatestPaymentRecordForOrder({ orderId: 'ord-2' })

      expect(data).toEqual(expect.objectContaining({ order_id: 'ord-2' }))
      const builder = latestBuilder('payments')
      expect(builder._eqCalls).toContainEqual(['order_id', 'ord-2'])
    })

    it('updatePaymentRecordById updates status field', async () => {
      tableResponses.set('payments', {
        data: {
          id: 'p3',
          order_id: 'ord-3',
          payment_method: 'paypal',
          status: 'completed',
        },
        error: null,
      })

      const { data } = await updatePaymentRecordById({
        paymentId: 'p3',
        values: { status: 'completed' },
      })

      expect(data.status).toBe('completed')
      const builder = latestBuilder('payments')
      expect(builder._updatePayload).toEqual(expect.objectContaining({ status: 'completed' }))
    })

    it('getPaymentRecordById fetches by id and resolvePaymentMethod works', async () => {
      tableResponses.set('payments', {
        data: {
          id: 'p4',
          order_id: 'ord-4',
          method: 'cash_on_delivery',
          status: 'pending',
          amount: 55,
          currency: 'MAD',
          reference: 'R-4',
        },
        error: null,
      })

      const { data } = await getPaymentRecordById({ paymentId: 'p4' })

      expect(data).toEqual(expect.objectContaining({ id: 'p4', order_id: 'ord-4' }))
      expect(resolvePaymentMethod(data)).toBe('cod')
      expect(normalizePaymentMethod('bank_transfer')).toBe('bank')
    })
  })

  describe('cmiPayment.js — Legacy Tombstone', () => {
    it('initCMIPayment throws legacy inactive error', async () => {
      await expect(initCMIPayment({ id: 'ord-legacy' })).rejects.toThrow(/CMI|نشط|PayPal|التحويل البنكي/i)
    })

    it('verifyCMICallback throws server-only verification error', async () => {
      await expect(verifyCMICallback()).rejects.toThrow(/السيرفر|server/i)
    })

    it('getCMIStatus falls back to unknown status when no CMI record exists', async () => {
      tableResponses.set('payments', {
        data: null,
        error: null,
      })

      const status = await getCMIStatus('ord-missing-cmi')

      expect(status).toEqual(
        expect.objectContaining({
          order_id: 'ord-missing-cmi',
          status: 'unknown',
        }),
      )
    })
  })

  describe('withRetry integration', () => {
    it('uses retry wrapper with maxRetries=2 in initialization paths', async () => {
      tableResponses.set('payments', {
        data: {
          id: 'p-retry-1',
          order_id: 'ord-retry',
          payment_method: 'cod',
          status: 'pending',
        },
        error: null,
      })

      await paymentGateway.processCodPayment({
        orderId: 'ord-retry',
        amount: 42,
        customer: { name: 'Retry Test', phone: '+2126' },
      })

      expect(withRetryCalls.length).toBeGreaterThan(0)
      expect(withRetryCalls.some((entry) => entry.options?.maxRetries === 2)).toBe(true)
    })
  })
})
