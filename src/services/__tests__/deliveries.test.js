/**
 * Deliveries service unit tests
 * Covers: createDelivery, fetchDeliveryById, updateDeliveryStatus, assignDriver,
 * markDelivered, subscribeToDeliveryUpdates, deliveriesApi.getDriverDeliveries,
 * deliveriesApi.updateLocation, deliveriesApi.subscribeToDelivery,
 * deliveriesApi.subscribeToDriverDeliveries, deliveriesApi.acceptDelivery,
 * deliveriesApi.markPickedUp, deliveriesApi.markDelivered (proof upload)
 */

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

// ─── Supabase mock ─────────────────────────────────────────────────────────────
// Defined entirely inside the factory so jest hoisting works correctly.
jest.mock('@/services/supabase', () => {
  const mockQueryResolve = jest.fn().mockResolvedValue({ data: null, error: null })

  let lastBuilder = null

  const makeBuilder = () => {
    const b = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockReturnThis(),
      then: (resolve, reject) => Promise.resolve(mockQueryResolve()).then(resolve, reject),
    }
    lastBuilder = b
    return b
  }

  const channelBuilder = {
    _lastCallback: null,
    _lastFilter: null,
    on: jest.fn().mockImplementation((_event, filter, cb) => {
      channelBuilder._lastCallback = cb
      channelBuilder._lastFilter = filter
      return channelBuilder
    }),
    subscribe: jest.fn().mockReturnValue({ topic: 'channel', unsubscribe: jest.fn() }),
  }

  const mockSupabase = {
    from: jest.fn().mockImplementation(() => makeBuilder()),
    channel: jest.fn().mockReturnValue(channelBuilder),
    removeChannel: jest.fn(),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'driver-1' } },
        error: null,
      }),
    },
    functions: {
      invoke: jest.fn(),
    },
  }

  // Expose via globalThis so tests can reconfigure after hoisting
  globalThis.__mockDeliveriesQueryResolve = mockQueryResolve
  globalThis.__mockDeliveriesChannelBuilder = channelBuilder
  globalThis.__mockDeliveriesSupabase = mockSupabase
  globalThis.__mockDeliveriesGetLastBuilder = () => lastBuilder

  return { supabase: mockSupabase }
})

// ─── Imports (after mocks so hoisting is safe) ────────────────────────────────
import {
  createDelivery,
  fetchDeliveryById,
  updateDeliveryStatus,
  assignDriver,
  markDelivered,
  subscribeToDeliveryUpdates,
  deliveriesApi,
} from '@/services/deliveries'

// ─── Convenience aliases ──────────────────────────────────────────────────────
const mockSupabase = globalThis.__mockDeliveriesSupabase
const mockQueryResolve = globalThis.__mockDeliveriesQueryResolve
const channelBuilder = globalThis.__mockDeliveriesChannelBuilder
const getLastBuilder = globalThis.__mockDeliveriesGetLastBuilder

const FIXED_NOW = new Date('2026-05-24T12:00:00.000Z')

// ─── Helpers ──────────────────────────────────────────────────────────────────
const okDelivery = (overrides = {}) => ({
  id: 'del-1',
  order_id: 'order-1',
  driver_id: 'driver-1',
  status: 'pending',
  ...overrides,
})

// ══════════════════════════════════════════════════════════════════════════════
describe('deliveries service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(FIXED_NOW)

    // Default: successful empty response
    mockQueryResolve.mockResolvedValue({ data: null, error: null })

    // Reset channel builder captured state
    channelBuilder._lastCallback = null
    channelBuilder._lastFilter = null
    channelBuilder.subscribe.mockReturnValue({
      topic: 'delivery:del-1',
      unsubscribe: jest.fn(),
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // ══════════════════════════════════════════════════════════════════════════
  describe('fetchDeliveryById', () => {
    it('queries the deliveries table and returns joined row', async () => {
      const delivery = okDelivery({ status: 'accepted' })
      mockQueryResolve.mockResolvedValue({ data: delivery, error: null })

      const result = await fetchDeliveryById('del-1')

      expect(result).toEqual({ data: delivery, error: null })
      expect(mockSupabase.from).toHaveBeenCalledWith('deliveries')
      const b = getLastBuilder()
      expect(b.eq).toHaveBeenCalledWith('id', 'del-1')
      expect(b.maybeSingle).toHaveBeenCalled()
    })

    it('wraps supabase errors instead of throwing', async () => {
      const err = new Error('network error')
      mockQueryResolve.mockResolvedValue({ data: null, error: err })

      const result = await fetchDeliveryById('missing-id')

      expect(result).toEqual({ data: null, error: err })
    })

    it('returns data:null when delivery does not exist (maybeSingle returns null)', async () => {
      mockQueryResolve.mockResolvedValue({ data: null, error: null })

      const result = await fetchDeliveryById('not-found')

      expect(result).toEqual({ data: null, error: null })
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  describe('updateDeliveryStatus', () => {
    it('sets accepted_at when transitioning to accepted', async () => {
      mockQueryResolve.mockResolvedValue({
        data: okDelivery({ status: 'accepted', accepted_at: FIXED_NOW.toISOString() }),
        error: null,
      })

      const result = await updateDeliveryStatus('del-1', 'accepted')

      expect(result.error).toBeNull()
      const b = getLastBuilder()
      expect(b.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'accepted',
          accepted_at: FIXED_NOW.toISOString(),
          updated_at: FIXED_NOW.toISOString(),
        })
      )
    })

    it('sets picked_up_at when transitioning to picked_up', async () => {
      mockQueryResolve.mockResolvedValue({
        data: okDelivery({ status: 'picked_up', picked_up_at: FIXED_NOW.toISOString() }),
        error: null,
      })

      await updateDeliveryStatus('del-1', 'picked_up')

      const b = getLastBuilder()
      expect(b.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'picked_up',
          picked_up_at: FIXED_NOW.toISOString(),
        })
      )
    })

    it('sets delivered_at when transitioning to delivered', async () => {
      mockQueryResolve.mockResolvedValue({
        data: okDelivery({ status: 'delivered', delivered_at: FIXED_NOW.toISOString() }),
        error: null,
      })

      await updateDeliveryStatus('del-1', 'delivered')

      const b = getLastBuilder()
      expect(b.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'delivered',
          delivered_at: FIXED_NOW.toISOString(),
        })
      )
    })

    it('sets assigned_at when transitioning to assigned', async () => {
      mockQueryResolve.mockResolvedValue({
        data: okDelivery({ status: 'assigned', assigned_at: FIXED_NOW.toISOString() }),
        error: null,
      })

      await updateDeliveryStatus('del-1', 'assigned')

      const b = getLastBuilder()
      expect(b.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'assigned',
          assigned_at: FIXED_NOW.toISOString(),
        })
      )
    })

    it('always includes updated_at in the payload', async () => {
      mockQueryResolve.mockResolvedValue({ data: okDelivery(), error: null })

      await updateDeliveryStatus('del-1', 'accepted')

      const b = getLastBuilder()
      expect(b.update).toHaveBeenCalledWith(
        expect.objectContaining({ updated_at: FIXED_NOW.toISOString() })
      )
    })

    it('does not overwrite a timestamp already provided in values', async () => {
      const customTime = '2026-01-01T00:00:00.000Z'
      mockQueryResolve.mockResolvedValue({ data: okDelivery(), error: null })

      await updateDeliveryStatus('del-1', 'accepted', { accepted_at: customTime })

      const b = getLastBuilder()
      expect(b.update).toHaveBeenCalledWith(
        expect.objectContaining({ accepted_at: customTime })
      )
    })

    it('filters update by delivery id', async () => {
      mockQueryResolve.mockResolvedValue({ data: okDelivery(), error: null })

      await updateDeliveryStatus('del-42', 'accepted')

      const b = getLastBuilder()
      expect(b.eq).toHaveBeenCalledWith('id', 'del-42')
    })

    it('wraps supabase errors', async () => {
      const err = new Error('update failed')
      mockQueryResolve.mockResolvedValue({ data: null, error: err })

      const result = await updateDeliveryStatus('del-1', 'accepted')

      expect(result).toEqual({ data: null, error: err })
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  describe('createDelivery', () => {
    it('inserts correct fields and returns new delivery', async () => {
      const delivery = okDelivery({ status: 'unassigned' })
      mockQueryResolve.mockResolvedValue({ data: delivery, error: null })

      const result = await createDelivery({
        orderId: 'order-1',
        vendorId: 'vendor-1',
        driverId: null,
        status: 'unassigned',
      })

      expect(result.data).toEqual(delivery)
      const b = getLastBuilder()
      expect(b.insert).toHaveBeenCalledWith({
        order_id: 'order-1',
        vendor_id: 'vendor-1',
        driver_id: null,
        status: 'unassigned',
      })
    })

    it('defaults status to unassigned when not provided', async () => {
      mockQueryResolve.mockResolvedValue({ data: okDelivery(), error: null })

      await createDelivery({ orderId: 'order-1' })

      const b = getLastBuilder()
      expect(b.insert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'unassigned' })
      )
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  describe('assignDriver', () => {
    it('sets driver_id and status:assigned with assigned_at timestamp', async () => {
      mockQueryResolve.mockResolvedValue({
        data: okDelivery({ status: 'assigned', driver_id: 'driver-2' }),
        error: null,
      })

      await assignDriver('del-1', 'driver-2')

      const b = getLastBuilder()
      expect(b.update).toHaveBeenCalledWith(
        expect.objectContaining({
          driver_id: 'driver-2',
          status: 'assigned',
          assigned_at: FIXED_NOW.toISOString(),
        })
      )
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  describe('markDelivered (direct export)', () => {
    it('sets status:delivered, delivered_at, and proof_photo_url', async () => {
      const proofUrl = 'https://cdn.example.com/proof.jpg'
      mockQueryResolve.mockResolvedValue({
        data: okDelivery({ status: 'delivered', proof_photo_url: proofUrl }),
        error: null,
      })

      const result = await markDelivered('del-1', proofUrl)

      expect(result.error).toBeNull()
      const b = getLastBuilder()
      expect(b.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'delivered',
          delivered_at: FIXED_NOW.toISOString(),
          proof_photo_url: proofUrl,
        })
      )
    })

    it('sets proof_photo_url to null when not provided', async () => {
      mockQueryResolve.mockResolvedValue({ data: okDelivery({ status: 'delivered' }), error: null })

      await markDelivered('del-1')

      const b = getLastBuilder()
      expect(b.update).toHaveBeenCalledWith(
        expect.objectContaining({ proof_photo_url: null })
      )
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  describe('subscribeToDeliveryUpdates (direct export)', () => {
    it('creates a realtime channel for the specified delivery', () => {
      subscribeToDeliveryUpdates('del-99', jest.fn())

      expect(mockSupabase.channel).toHaveBeenCalledWith('delivery:del-99')
    })

    it('subscribes to UPDATE events on the deliveries table filtered by id', () => {
      subscribeToDeliveryUpdates('del-99', jest.fn())

      expect(channelBuilder.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: 'id=eq.del-99',
        }),
        expect.any(Function)
      )
    })

    it('invokes the callback with payload.new when an update arrives', () => {
      const callback = jest.fn()
      subscribeToDeliveryUpdates('del-99', callback)

      channelBuilder._lastCallback({ new: { id: 'del-99', status: 'delivered' } })

      expect(callback).toHaveBeenCalledWith({ id: 'del-99', status: 'delivered' })
    })

    it('returns an unsubscribe function that calls removeChannel', () => {
      const channel = { topic: 'delivery:del-99', unsubscribe: jest.fn() }
      channelBuilder.subscribe.mockReturnValue(channel)

      const unsubscribe = subscribeToDeliveryUpdates('del-99', jest.fn())
      unsubscribe()

      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(channel)
    })

    it('falls back to channel.unsubscribe() when removeChannel is unavailable', () => {
      const channel = { topic: 'delivery:del-99', unsubscribe: jest.fn() }
      channelBuilder.subscribe.mockReturnValue(channel)
      delete mockSupabase.removeChannel

      const unsubscribe = subscribeToDeliveryUpdates('del-99', jest.fn())
      unsubscribe()

      expect(channel.unsubscribe).toHaveBeenCalled()

      // Restore for other tests
      mockSupabase.removeChannel = jest.fn()
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  describe('deliveriesApi.getDriverDeliveries', () => {
    it('queries deliveries table filtered by driver_id', async () => {
      mockQueryResolve.mockResolvedValue({
        data: [okDelivery()],
        error: null,
        count: 1,
      })

      const result = await deliveriesApi.getDriverDeliveries('driver-1')

      expect(result).toEqual({ data: [okDelivery()], total: 1 })
      expect(mockSupabase.from).toHaveBeenCalledWith('deliveries')
      const b = getLastBuilder()
      expect(b.eq).toHaveBeenCalledWith('driver_id', 'driver-1')
    })

    it('filters by status when status argument is provided', async () => {
      mockQueryResolve.mockResolvedValue({ data: [], error: null, count: 0 })

      await deliveriesApi.getDriverDeliveries('driver-1', 'accepted')

      const b = getLastBuilder()
      expect(b.eq).toHaveBeenCalledWith('status', 'accepted')
    })

    it('does not add a status filter when status is null', async () => {
      mockQueryResolve.mockResolvedValue({ data: [], error: null, count: 0 })

      await deliveriesApi.getDriverDeliveries('driver-1', null)

      const b = getLastBuilder()
      const eqCalls = b.eq.mock.calls
      const statusCall = eqCalls.find(([field]) => field === 'status')
      expect(statusCall).toBeUndefined()
    })

    it('returns empty array with total:0 when there are no deliveries', async () => {
      mockQueryResolve.mockResolvedValue({ data: [], error: null, count: 0 })

      const result = await deliveriesApi.getDriverDeliveries('driver-1')

      expect(result).toEqual({ data: [], total: 0 })
    })

    it('applies pagination via range()', async () => {
      mockQueryResolve.mockResolvedValue({ data: [], error: null, count: 0 })

      await deliveriesApi.getDriverDeliveries('driver-1', null, { limit: 10, offset: 20 })

      const b = getLastBuilder()
      expect(b.range).toHaveBeenCalledWith(20, 29)
    })

    it('caps limit at 200 regardless of requested value', async () => {
      mockQueryResolve.mockResolvedValue({ data: [], error: null, count: 0 })

      await deliveriesApi.getDriverDeliveries('driver-1', null, { limit: 500 })

      const b = getLastBuilder()
      expect(b.range).toHaveBeenCalledWith(0, 199)
    })

    it('orders results by created_at descending', async () => {
      mockQueryResolve.mockResolvedValue({ data: [], error: null, count: 0 })

      await deliveriesApi.getDriverDeliveries('driver-1')

      const b = getLastBuilder()
      expect(b.order).toHaveBeenCalledWith('created_at', { ascending: false })
    })

    it('throws when supabase returns an error', async () => {
      mockQueryResolve.mockResolvedValue({ data: null, error: new Error('db error'), count: null })

      await expect(deliveriesApi.getDriverDeliveries('driver-1')).rejects.toThrow('db error')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  describe('deliveriesApi.updateLocation', () => {
    it('fetches the authenticated user id before updating', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'driver-1' } },
        error: null,
      })
      mockQueryResolve.mockResolvedValue({ data: { id: 'del-1' }, error: null })

      await deliveriesApi.updateLocation('del-1', 33.5731, -7.5898)

      expect(mockSupabase.auth.getUser).toHaveBeenCalled()
    })

    it('updates location fields on the delivery row', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'driver-1' } },
        error: null,
      })
      mockQueryResolve.mockResolvedValue({ data: { id: 'del-1' }, error: null })

      await deliveriesApi.updateLocation('del-1', 33.5731, -7.5898)

      const b = getLastBuilder()
      expect(b.update).toHaveBeenCalledWith(
        expect.objectContaining({
          current_latitude: 33.5731,
          current_longitude: -7.5898,
          last_location_update: FIXED_NOW.toISOString(),
        })
      )
    })

    it('filters by both delivery id and driver id to prevent cross-driver writes', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'driver-1' } },
        error: null,
      })
      mockQueryResolve.mockResolvedValue({ data: { id: 'del-1' }, error: null })

      await deliveriesApi.updateLocation('del-1', 33.5731, -7.5898)

      const b = getLastBuilder()
      expect(b.eq).toHaveBeenCalledWith('id', 'del-1')
      expect(b.eq).toHaveBeenCalledWith('driver_id', 'driver-1')
    })

    it('throws when the delivery is not found (data is null)', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'driver-1' } },
        error: null,
      })
      mockQueryResolve.mockResolvedValue({ data: null, error: null })

      await expect(
        deliveriesApi.updateLocation('del-missing', 33.5731, -7.5898)
      ).rejects.toThrow('Delivery not found')
    })

    it('throws when auth fails', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated'),
      })

      await expect(
        deliveriesApi.updateLocation('del-1', 33.5731, -7.5898)
      ).rejects.toThrow()
    })

    it('throws when supabase returns a database error', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'driver-1' } },
        error: null,
      })
      mockQueryResolve.mockResolvedValue({ data: null, error: new Error('write failed') })

      await expect(
        deliveriesApi.updateLocation('del-1', 33.5731, -7.5898)
      ).rejects.toThrow('write failed')
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  describe('deliveriesApi.subscribeToDelivery', () => {
    it('opens a realtime channel scoped to the delivery id', () => {
      deliveriesApi.subscribeToDelivery('del-5', jest.fn())

      expect(mockSupabase.channel).toHaveBeenCalledWith('delivery:del-5')
    })

    it('listens for UPDATE events on deliveries table with correct filter', () => {
      deliveriesApi.subscribeToDelivery('del-5', jest.fn())

      expect(channelBuilder.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: 'id=eq.del-5',
        }),
        expect.any(Function)
      )
    })

    it('calls the callback with payload.new when an update arrives', () => {
      const callback = jest.fn()
      deliveriesApi.subscribeToDelivery('del-5', callback)

      channelBuilder._lastCallback({ new: { id: 'del-5', status: 'picked_up' } })

      expect(callback).toHaveBeenCalledWith({ id: 'del-5', status: 'picked_up' })
    })

    it('returns the channel object', () => {
      const fakeChannel = { topic: 'delivery:del-5', unsubscribe: jest.fn() }
      channelBuilder.subscribe.mockReturnValue(fakeChannel)

      const returned = deliveriesApi.subscribeToDelivery('del-5', jest.fn())

      expect(returned).toBe(fakeChannel)
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  describe('deliveriesApi.subscribeToDriverDeliveries', () => {
    it('opens a channel scoped to the driver id', () => {
      deliveriesApi.subscribeToDriverDeliveries('driver-7', jest.fn())

      expect(mockSupabase.channel).toHaveBeenCalledWith('driver-deliveries:driver-7')
    })

    it('listens to ALL events (INSERT/UPDATE/DELETE) on deliveries', () => {
      deliveriesApi.subscribeToDriverDeliveries('driver-7', jest.fn())

      expect(channelBuilder.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          table: 'deliveries',
          filter: 'driver_id=eq.driver-7',
        }),
        expect.any(Function)
      )
    })

    it('forwards the full payload to the callback', () => {
      const callback = jest.fn()
      deliveriesApi.subscribeToDriverDeliveries('driver-7', callback)

      const payload = { eventType: 'INSERT', new: { id: 'del-8', status: 'assigned' } }
      channelBuilder._lastCallback(payload)

      expect(callback).toHaveBeenCalledWith(payload)
    })
  })

  // ══════════════════════════════════════════════════════════════════════════
  describe('deliveriesApi edge-function methods', () => {
    describe('acceptDelivery', () => {
      it('invokes accept-delivery edge function with deliveryId', async () => {
        const delivery = okDelivery({ status: 'accepted' })
        mockSupabase.functions.invoke.mockResolvedValue({
          data: { success: true, delivery },
          error: null,
        })

        const result = await deliveriesApi.acceptDelivery('del-1')

        expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
          'accept-delivery',
          expect.objectContaining({ body: expect.objectContaining({ deliveryId: 'del-1' }) })
        )
        expect(result).toEqual(delivery)
      })

      it('throws when the edge function returns an error object', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
          data: null,
          error: new Error('Function error'),
        })

        await expect(deliveriesApi.acceptDelivery('del-1')).rejects.toThrow('Function error')
      })

      it('throws with the server message when success is false', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
          data: { success: false, error: 'Delivery already accepted' },
          error: null,
        })

        await expect(deliveriesApi.acceptDelivery('del-1')).rejects.toThrow(
          'Delivery already accepted'
        )
      })
    })

    describe('markPickedUp', () => {
      it('invokes mark-delivery-picked-up edge function', async () => {
        const delivery = okDelivery({ status: 'picked_up' })
        mockSupabase.functions.invoke.mockResolvedValue({
          data: { success: true, delivery },
          error: null,
        })

        const result = await deliveriesApi.markPickedUp('del-1')

        expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
          'mark-delivery-picked-up',
          expect.objectContaining({ body: { deliveryId: 'del-1' } })
        )
        expect(result).toEqual(delivery)
      })

      it('throws when delivery cannot be picked up', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
          data: { success: false, error: 'Wrong status' },
          error: null,
        })

        await expect(deliveriesApi.markPickedUp('del-1')).rejects.toThrow('Wrong status')
      })
    })

    describe('markDelivered (upload proof)', () => {
      it('invokes mark-delivery-delivered with proofUrl and signatureUrl', async () => {
        const delivery = okDelivery({ status: 'delivered' })
        mockSupabase.functions.invoke.mockResolvedValue({
          data: { success: true, delivery },
          error: null,
        })

        const result = await deliveriesApi.markDelivered(
          'del-1',
          'https://cdn.example.com/proof.jpg',
          'https://cdn.example.com/sig.png'
        )

        expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
          'mark-delivery-delivered',
          expect.objectContaining({
            body: {
              deliveryId: 'del-1',
              proofUrl: 'https://cdn.example.com/proof.jpg',
              signatureUrl: 'https://cdn.example.com/sig.png',
            },
          })
        )
        expect(result).toEqual(delivery)
      })

      it('works without proof or signature (default null values)', async () => {
        const delivery = okDelivery({ status: 'delivered' })
        mockSupabase.functions.invoke.mockResolvedValue({
          data: { success: true, delivery },
          error: null,
        })

        const result = await deliveriesApi.markDelivered('del-1')

        expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
          'mark-delivery-delivered',
          expect.objectContaining({
            body: { deliveryId: 'del-1', proofUrl: null, signatureUrl: null },
          })
        )
        expect(result).toEqual(delivery)
      })

      it('throws when the upload/edge function fails', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
          data: null,
          error: new Error('upload failed'),
        })

        await expect(
          deliveriesApi.markDelivered('del-1', 'https://cdn.example.com/proof.jpg')
        ).rejects.toThrow('upload failed')
      })
    })

    describe('rejectDelivery', () => {
      it('invokes reject-delivery edge function with reason', async () => {
        const delivery = okDelivery({ status: 'unassigned' })
        mockSupabase.functions.invoke.mockResolvedValue({
          data: { success: true, delivery },
          error: null,
        })

        await deliveriesApi.rejectDelivery('del-1', 'Too far away')

        expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
          'reject-delivery',
          expect.objectContaining({ body: { deliveryId: 'del-1', reason: 'Too far away' } })
        )
      })
    })

    describe('markOnTheWay', () => {
      it('invokes mark-delivery-on-the-way edge function', async () => {
        const delivery = okDelivery({ status: 'on_the_way' })
        mockSupabase.functions.invoke.mockResolvedValue({
          data: { success: true, delivery },
          error: null,
        })

        const result = await deliveriesApi.markOnTheWay('del-1')

        expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
          'mark-delivery-on-the-way',
          expect.objectContaining({ body: { deliveryId: 'del-1' } })
        )
        expect(result).toEqual(delivery)
      })
    })
  })
})
