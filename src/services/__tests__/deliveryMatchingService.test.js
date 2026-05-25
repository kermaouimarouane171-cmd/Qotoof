jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

jest.mock('@/services/shippingCalculator', () => ({
  calculateDistance: jest.requireActual('@/services/shippingCalculator').calculateDistance,
}))

jest.mock('@/services/supabase', () => {
  const mockRpc = jest.fn()
  const mockFrom = jest.fn()
  const mockRemoveChannel = jest.fn()

  const makeBuilder = (response) => {
    const builder = {
      select: jest.fn(() => builder),
      eq: jest.fn(() => builder),
      in: jest.fn(() => builder),
      or: jest.fn(() => builder),
      order: jest.fn(() => builder),
      range: jest.fn(() => builder),
      limit: jest.fn(() => builder),
      maybeSingle: jest.fn(() => builder),
      single: jest.fn(() => builder),
      insert: jest.fn(() => builder),
      update: jest.fn(() => builder),
      then: (onFulfilled, onRejected) => Promise.resolve(response).then(onFulfilled, onRejected),
    }

    return builder
  }

  mockFrom.mockImplementation((_table) => makeBuilder({ data: [], error: null }))

  globalThis.__deliveryMatchingSupabase = {
    rpc: mockRpc,
    from: mockFrom,
    channel: jest.fn(),
    removeChannel: mockRemoveChannel,
  }

  globalThis.__deliveryMatchingMakeBuilder = makeBuilder

  return {
    supabase: globalThis.__deliveryMatchingSupabase,
  }
})

import {
  calculateDistance,
  doesDriverMatchDelivery,
  findNearestDrivers,
  getAvailableDriversForCheckout,
  getCargoSizeLabel,
  getDriverSupportedPaymentMethods,
  normalizeCargoSize,
  normalizeDriverDeliveryPaymentMethod,
} from '@/services/deliveryMatchingService'

const mockSupabase = globalThis.__deliveryMatchingSupabase
const makeBuilder = globalThis.__deliveryMatchingMakeBuilder

describe('deliveryMatchingService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabase.rpc.mockResolvedValue({ data: [], error: null })
    mockSupabase.from.mockImplementation((_table) => makeBuilder({ data: [], error: null }))
  })

  describe('getAvailableDrivers() — Happy Path', () => {
    it('calls supabase.rpc find_nearest_drivers with correct params through nearest search', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            driver_id: 'd1',
            driver_name: 'Driver One',
            distance_km: 2.3,
            is_in_same_region: true,
            is_in_neighboring_region: false,
          },
        ],
        error: null,
      })

      const result = await findNearestDrivers({ lat: 33.5731, lng: -7.5898 }, { maxDistance: 25, limit: 5 })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('find_nearest_drivers', {
        p_pickup_lat: 33.5731,
        p_pickup_lng: -7.5898,
        p_max_distance_km: 25,
        p_limit: 5,
      })
      expect(result.success).toBe(true)
      expect(result.drivers).toHaveLength(1)
      expect(result.searchMethod).toBe('database')
    })

    it('returns array of available drivers with distance in checkout matching', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return makeBuilder({
            data: [
              {
                id: 'd1',
                first_name: 'Ali',
                last_name: 'Driver',
                phone: '+212611111111',
                vehicle_type: 'car',
                latitude: 33.58,
                longitude: -7.60,
                rating: 4.7,
                is_available_for_delivery: true,
                min_delivery_distance_km: 0,
                max_delivery_distance_km: 100,
                accepted_cargo_sizes: ['small', 'medium'],
                driver_delivery_payment_cash: true,
                driver_delivery_payment_transfer: false,
              },
            ],
            error: null,
          })
        }
        return makeBuilder({ data: [], error: null })
      })

      const rows = await getAvailableDriversForCheckout({
        vendorLocation: { lat: 33.5731, lng: -7.5898 },
        deliveryLocation: { lat: 33.8, lng: -7.1 },
        cargoSize: 'medium',
        deliveryPaymentMethod: 'cash',
      })

      expect(rows).toHaveLength(1)
      expect(rows[0]).toEqual(
        expect.objectContaining({
          id: 'd1',
          phone: '+212611111111',
          vehicle_type: 'car',
        }),
      )
      expect(typeof rows[0].pickup_distance_km).toBe('number')
      expect(typeof rows[0].route_distance_km).toBe('number')
    })

    it('sorts drivers by distance ascending (pickup distance)', async () => {
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'profiles') {
          return makeBuilder({
            data: [
              {
                id: 'far',
                first_name: 'Far',
                last_name: 'Driver',
                latitude: 34.0,
                longitude: -7.9,
                rating: 5,
                is_available_for_delivery: true,
                min_delivery_distance_km: 0,
                max_delivery_distance_km: 500,
                accepted_cargo_sizes: ['small', 'medium'],
                driver_delivery_payment_cash: true,
                driver_delivery_payment_transfer: true,
              },
              {
                id: 'near',
                first_name: 'Near',
                last_name: 'Driver',
                latitude: 33.574,
                longitude: -7.59,
                rating: 3,
                is_available_for_delivery: true,
                min_delivery_distance_km: 0,
                max_delivery_distance_km: 500,
                accepted_cargo_sizes: ['small', 'medium'],
                driver_delivery_payment_cash: true,
                driver_delivery_payment_transfer: true,
              },
            ],
            error: null,
          })
        }
        return makeBuilder({ data: [], error: null })
      })

      const rows = await getAvailableDriversForCheckout({
        vendorLocation: { lat: 33.5731, lng: -7.5898 },
        deliveryLocation: { lat: 33.7, lng: -7.5 },
        cargoSize: 'medium',
        deliveryPaymentMethod: 'cash',
      })

      expect(rows.map((d) => d.id)).toEqual(['near', 'far'])
      expect(rows[0].pickup_distance_km).toBeLessThan(rows[1].pickup_distance_km)
    })

    it('filters by cargo requirements', () => {
      const result = doesDriverMatchDelivery({
        driver: {
          accepted_cargo_sizes: ['small'],
          min_delivery_distance_km: 0,
          max_delivery_distance_km: 100,
          driver_delivery_payment_cash: true,
          driver_delivery_payment_transfer: true,
          is_available_for_delivery: true,
        },
        cargoSize: 'large',
        deliveryPaymentMethod: 'cash',
        vendorLocation: { lat: 33.57, lng: -7.58 },
        deliveryLocation: { lat: 33.6, lng: -7.6 },
      })

      expect(result.matches).toBe(false)
      expect(result.reasons.join(' ')).toContain('حمولة')
    })

    it('filters by payment method preference (COD/bank transfer)', () => {
      const codOnly = {
        accepted_cargo_sizes: ['medium'],
        min_delivery_distance_km: 0,
        max_delivery_distance_km: 100,
        driver_delivery_payment_cash: true,
        driver_delivery_payment_transfer: false,
        is_available_for_delivery: true,
      }

      const bankCheck = doesDriverMatchDelivery({
        driver: codOnly,
        cargoSize: 'medium',
        deliveryPaymentMethod: 'bank_transfer',
        vendorLocation: { lat: 33.57, lng: -7.58 },
        deliveryLocation: { lat: 33.6, lng: -7.6 },
      })

      expect(bankCheck.matches).toBe(false)
      expect(bankCheck.reasons.join(' ')).toContain('تحويل')
      expect(getDriverSupportedPaymentMethods(codOnly)).toEqual(['cash'])
    })
  })

  describe('getAvailableDrivers() — Geographic Fallback', () => {
    it('Tier 1 prioritizes drivers in same region when available', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: { message: 'rpc unavailable' } })
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'driver_locations') {
          return makeBuilder({
            data: [
              {
                driver_id: 'same-region',
                latitude: 34.02,
                longitude: -6.84,
                city: 'Rabat',
                region_id: '4',
                service_radius_km: 50,
                driver: { first_name: 'Same', last_name: 'Region', phone: '1', rating: 4.8 },
              },
              {
                driver_id: 'other-region',
                latitude: 33.57,
                longitude: -7.59,
                city: 'Casablanca',
                region_id: '6',
                service_radius_km: 50,
                driver: { first_name: 'Other', last_name: 'Region', phone: '2', rating: 4.2 },
              },
            ],
            error: null,
          })
        }
        return makeBuilder({ data: [], error: null })
      })

      const result = await findNearestDrivers({ lat: 34.0209, lng: -6.8416 }, { maxDistance: 400, limit: 10 })

      expect(result.success).toBe(true)
      expect(result.searchMethod).toBe('client')
      expect(result.drivers[0].driver_id).toBe('same-region')
      expect(result.drivers[0].tier).toBe(1)
    })

    it('Tier 2 includes neighboring regions when same-region pool is small', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: { message: 'rpc unavailable' } })
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'driver_locations') {
          return makeBuilder({
            data: [
              {
                driver_id: 'same-only',
                latitude: 34.03,
                longitude: -6.84,
                city: 'Rabat',
                region_id: '4',
                service_radius_km: 80,
                driver: { first_name: 'Same', last_name: 'One', phone: '1', rating: 4.8 },
              },
              {
                driver_id: 'neighbor',
                latitude: 33.57,
                longitude: -7.58,
                city: 'Casablanca',
                region_id: '6',
                service_radius_km: 120,
                driver: { first_name: 'Neighbor', last_name: 'Two', phone: '2', rating: 4.1 },
              },
            ],
            error: null,
          })
        }
        return makeBuilder({ data: [], error: null })
      })

      const result = await findNearestDrivers({ lat: 34.0209, lng: -6.8416 }, { maxDistance: 500, limit: 10 })

      expect(result.drivers.some((d) => d.tier === 2)).toBe(true)
      expect(result.drivers.map((d) => d.driver_id)).toEqual(['same-only', 'neighbor'])
    })

    it('Tier 3 includes national drivers when no regional drivers found', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: { message: 'rpc unavailable' } })
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'driver_locations') {
          return makeBuilder({
            data: [
              {
                driver_id: 'national-far',
                latitude: 27.12,
                longitude: -13.16,
                city: 'Laayoune',
                region_id: '11',
                service_radius_km: 900,
                driver: { first_name: 'Far', last_name: 'South', phone: '3', rating: 4.0 },
              },
            ],
            error: null,
          })
        }
        return makeBuilder({ data: [], error: null })
      })

      const result = await findNearestDrivers({ lat: 34.0209, lng: -6.8416 }, { maxDistance: 2000, limit: 10 })

      expect(result.success).toBe(true)
      expect(result.drivers).toHaveLength(1)
      expect(result.drivers[0].tier).toBe(3)
    })

    it('returns empty drivers array when truly none found', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: { message: 'rpc unavailable' } })
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'driver_locations') {
          return makeBuilder({ data: [], error: null })
        }
        return makeBuilder({ data: [], error: null })
      })

      const result = await findNearestDrivers({ lat: 33.57, lng: -7.58 }, { maxDistance: 20, limit: 10 })

      expect(result.success).toBe(true)
      expect(result.drivers).toEqual([])
    })

    it('does not fall through to client-side fallback when RPC already returned drivers', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            driver_id: 'rpc-1',
            driver_name: 'RPC Driver',
            distance_km: 3,
            is_in_same_region: true,
            is_in_neighboring_region: false,
          },
        ],
        error: null,
      })

      const result = await findNearestDrivers({ lat: 33.57, lng: -7.58 }, { maxDistance: 30, limit: 5 })

      expect(result.success).toBe(true)
      expect(mockSupabase.from).not.toHaveBeenCalledWith('driver_locations')
      expect(result.searchMethod).toBe('database')
    })
  })

  describe('getAvailableDrivers() — RPC Failure', () => {
    it('falls back to geographic search when RPC returns error', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: { message: 'timeout' } })
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'driver_locations') {
          return makeBuilder({
            data: [
              {
                driver_id: 'fallback-1',
                latitude: 33.57,
                longitude: -7.58,
                city: 'Casablanca',
                region_id: '6',
                service_radius_km: 80,
                driver: { first_name: 'Fallback', last_name: 'One', phone: '4', rating: 4.3 },
              },
            ],
            error: null,
          })
        }
        return makeBuilder({ data: [], error: null })
      })

      const result = await findNearestDrivers({ lat: 33.57, lng: -7.58 }, { maxDistance: 100, limit: 5 })

      expect(result.success).toBe(true)
      expect(result.searchMethod).toBe('client')
      expect(result.drivers).toHaveLength(1)
    })

    it('falls back to geographic search when RPC returns empty', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null })
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'driver_locations') {
          return makeBuilder({
            data: [
              {
                driver_id: 'fallback-empty-rpc',
                latitude: 33.58,
                longitude: -7.60,
                city: 'Casablanca',
                region_id: '6',
                service_radius_km: 70,
                driver: { first_name: 'Fallback', last_name: 'Two', phone: '5', rating: 4.1 },
              },
            ],
            error: null,
          })
        }
        return makeBuilder({ data: [], error: null })
      })

      const result = await findNearestDrivers({ lat: 33.57, lng: -7.58 }, { maxDistance: 120, limit: 5 })

      expect(result.success).toBe(true)
      expect(result.searchMethod).toBe('client')
      expect(result.drivers[0].driver_id).toBe('fallback-empty-rpc')
    })

    it('does not retry RPC loop more than once inside findNearestDrivers', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: { message: 'timeout' } })
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'driver_locations') {
          return makeBuilder({ data: [], error: null })
        }
        return makeBuilder({ data: [], error: null })
      })

      await findNearestDrivers({ lat: 33.57, lng: -7.58 }, { maxDistance: 30, limit: 3 })

      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1)
    })
  })

  describe('cargo options', () => {
    it('normalizes cargo size labels and defaults invalid values to medium', () => {
      expect(normalizeCargoSize('SMALL')).toBe('small')
      expect(normalizeCargoSize('unknown')).toBe('medium')
      expect(getCargoSizeLabel('small')).toContain('صغيرة')
      expect(getCargoSizeLabel('invalid')).toContain('متوسطة')
    })

    it('normalizes driver payment method aliases', () => {
      expect(normalizeDriverDeliveryPaymentMethod('transfer')).toBe('bank_transfer')
      expect(normalizeDriverDeliveryPaymentMethod('cash')).toBe('cash')
      expect(normalizeDriverDeliveryPaymentMethod('')).toBe('cash')
    })
  })

  describe('calculateDistance()', () => {
    it('calculates distance between Casablanca and Rabat around 87km', () => {
      const km = calculateDistance(33.5731, -7.5898, 34.0209, -6.8416)
      expect(km).toBeGreaterThan(80)
      expect(km).toBeLessThan(100)
    })

    it('calculates distance between Casablanca and Marrakech around 238km', () => {
      const km = calculateDistance(33.5731, -7.5898, 31.6295, -7.9811)
      expect(km).toBeGreaterThan(210)
      expect(km).toBeLessThan(260)
    })

    it('returns 0 for same coordinates', () => {
      const km = calculateDistance(33.5731, -7.5898, 33.5731, -7.5898)
      expect(km).toBe(0)
    })

    it('handles edge coordinates without crashing', () => {
      expect(() => calculateDistance(89.9, 0, -89.9, 0)).not.toThrow()
      const originToOrigin = calculateDistance(0, 0, 0, 0)

      expect([0, null]).toContain(originToOrigin)
    })
  })
})
