import {
  checkDeliveryEligibility,
  normalizeLocation,
} from '../../services/deliveryEligibilityService'

jest.mock('../../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

describe('deliveryEligibilityService', () => {
  describe('normalizeLocation', () => {
    it('normalizes { latitude, longitude }', () => {
      expect(normalizeLocation({ latitude: 33.5, longitude: -7.5 })).toEqual({ lat: 33.5, lng: -7.5 })
    })

    it('normalizes { lat, lng }', () => {
      expect(normalizeLocation({ lat: 33.5, lng: -7.5 })).toEqual({ lat: 33.5, lng: -7.5 })
    })

    it('normalizes { center_lat, center_lng }', () => {
      expect(normalizeLocation({ center_lat: 33.5, center_lng: -7.5 })).toEqual({ lat: 33.5, lng: -7.5 })
    })

    it('returns null for missing coordinates', () => {
      expect(normalizeLocation({ latitude: 33.5 })).toBeNull()
      expect(normalizeLocation(null)).toBeNull()
      expect(normalizeLocation({})).toBeNull()
    })
  })

  describe('checkDeliveryEligibility', () => {
    const casablancaVendor = { latitude: 33.5731, longitude: -7.5898 }
    const nearbyBuyer = { latitude: 33.58, longitude: -7.60 } // ~1 km away
    const mediumBuyer = { latitude: 33.70, longitude: -7.40 } // ~20 km away
    const farBuyer = { latitude: 34.0209, longitude: -6.8416 } // Rabat, ~85 km away

    it('returns allowed true for local 5km + order 60 MAD', () => {
      const result = checkDeliveryEligibility({
        buyerLocation: nearbyBuyer,
        vendorLocation: casablancaVendor,
        orderAmount: 60,
      })
      expect(result.allowed).toBe(true)
      expect(result.zone).toBe('local')
      expect(result.distanceKm).toBeGreaterThan(0)
      expect(result.distanceKm).toBeLessThan(10)
    })

    it('returns allowed false for local 5km + order 20 MAD', () => {
      const result = checkDeliveryEligibility({
        buyerLocation: nearbyBuyer,
        vendorLocation: casablancaVendor,
        orderAmount: 20,
      })
      expect(result.allowed).toBe(false)
      expect(result.zone).toBe('local')
      expect(result.reason).toBe('MIN_ORDER_DISTANCE')
      expect(result.requiredMinimumOrder).toBe(50)
      expect(result.message).toContain('50 MAD')
    })

    it('returns allowed false for medium 20km + order 100 MAD', () => {
      const result = checkDeliveryEligibility({
        buyerLocation: mediumBuyer,
        vendorLocation: casablancaVendor,
        orderAmount: 100,
      })
      expect(result.allowed).toBe(false)
      expect(result.zone).toBe('medium')
      expect(result.reason).toBe('MIN_ORDER_DISTANCE')
      expect(result.requiredMinimumOrder).toBe(150)
      expect(result.message).toContain('150 MAD')
    })

    it('returns allowed true for medium 20km + order 160 MAD', () => {
      const result = checkDeliveryEligibility({
        buyerLocation: mediumBuyer,
        vendorLocation: casablancaVendor,
        orderAmount: 160,
      })
      expect(result.allowed).toBe(true)
      expect(result.zone).toBe('medium')
      expect(result.distanceKm).toBeGreaterThan(10)
      expect(result.distanceKm).toBeLessThan(30)
    })

    it('returns allowed false for far 45km + order 300 MAD + supportsIntercity false', () => {
      const farMid = { latitude: 33.20, longitude: -7.20 } // ~45 km from Casablanca
      const result = checkDeliveryEligibility({
        buyerLocation: farMid,
        vendorLocation: casablancaVendor,
        orderAmount: 300,
        vendorPolicy: { supports_intercity_delivery: false },
      })
      expect(result.allowed).toBe(false)
      expect(result.zone).toBe('far')
      expect(result.reason).toBe('NO_INTERCITY_SUPPORT')
    })

    it('returns allowed true for far 45km + order 600 MAD + supportsIntercity true', () => {
      const farMid = { latitude: 33.20, longitude: -7.20 } // ~45 km from Casablanca
      const result = checkDeliveryEligibility({
        buyerLocation: farMid,
        vendorLocation: casablancaVendor,
        orderAmount: 600,
        vendorPolicy: { supports_intercity_delivery: true },
      })
      expect(result.allowed).toBe(true)
      expect(result.zone).toBe('far')
      expect(result.distanceKm).toBeGreaterThan(30)
      expect(result.distanceKm).toBeLessThan(60)
    })

    it('returns allowed false for too far 80km', () => {
      const result = checkDeliveryEligibility({
        buyerLocation: farBuyer,
        vendorLocation: casablancaVendor,
        orderAmount: 1000,
      })
      expect(result.allowed).toBe(false)
      expect(result.zone).toBe('too_far')
      expect(result.reason).toBe('TOO_FAR')
      expect(result.message).toContain('خارج نطاق التوصيل')
    })

    it('returns allowed true with LOCATION_MISSING when buyer location is missing', () => {
      const result = checkDeliveryEligibility({
        buyerLocation: null,
        vendorLocation: casablancaVendor,
        orderAmount: 60,
      })
      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('LOCATION_MISSING')
      expect(result.message).toContain('سيتم التحقق')
    })

    it('returns allowed true with LOCATION_MISSING when vendor location is missing', () => {
      const result = checkDeliveryEligibility({
        buyerLocation: nearbyBuyer,
        vendorLocation: null,
        orderAmount: 60,
      })
      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('LOCATION_MISSING')
    })

    it('returns allowed true with LOCATION_MISSING when coordinates are invalid', () => {
      const result = checkDeliveryEligibility({
        buyerLocation: { latitude: 'invalid', longitude: 'invalid' },
        vendorLocation: casablancaVendor,
        orderAmount: 60,
      })
      expect(result.allowed).toBe(true)
      expect(result.reason).toBe('LOCATION_MISSING')
    })

    it('respects vendor policy overrides from profile fields', () => {
      const vendor = {
        latitude: 33.5731,
        longitude: -7.5898,
        max_delivery_distance_km: [80],
        min_order_amount: [200],
        supports_intercity_delivery: true,
      }
      const buyer = { latitude: 33.20, longitude: -7.20 }
      const result = checkDeliveryEligibility({
        buyerLocation: buyer,
        vendorLocation: vendor,
        orderAmount: 250,
        vendorPolicy: vendor,
      })
      // With farRadiusKm=80, ~50km is in far zone; min order from profile=200 + intercity true → should pass
      expect(result.allowed).toBe(true)
      expect(result.distanceKm).toBeGreaterThan(30)
    })

    it('respects vendor policy overrides that block far orders', () => {
      const vendor = {
        latitude: 33.5731,
        longitude: -7.5898,
        max_delivery_distance_km: [40],
        min_order_amount: [200],
      }
      const buyer = { latitude: 33.20, longitude: -7.20 }
      const result = checkDeliveryEligibility({
        buyerLocation: buyer,
        vendorLocation: vendor,
        orderAmount: 250,
        vendorPolicy: vendor,
      })
      // With farRadiusKm=40, ~50km becomes too_far
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('TOO_FAR')
      expect(result.distanceKm).toBeGreaterThan(40)
    })
  })
})
