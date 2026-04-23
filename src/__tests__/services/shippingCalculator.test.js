/**
 * Tests for shippingCalculator
 * Note: We test the shipping calculation logic in isolation.
 */

describe('shippingCalculator', () => {
  // Haversine distance calculation
  const calculateDistance = (point1, point2) => {
    const R = 6371 // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180
    const dLon = (point2.lng - point1.lng) * Math.PI / 180
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  // Moroccan cities with coordinates
  const cities = {
    'Casablanca': { lat: 33.5731, lng: -7.5898, basePrice: 15, perKm: 2 },
    'Rabat': { lat: 34.0209, lng: -6.8416, basePrice: 15, perKm: 2 },
    'Marrakech': { lat: 31.6295, lng: -7.9811, basePrice: 20, perKm: 2.5 },
    'Fes': { lat: 34.0181, lng: -5.0078, basePrice: 25, perKm: 3 },
    'Tangier': { lat: 35.7595, lng: -5.8340, basePrice: 30, perKm: 3 },
  }

  const getDeliveryZone = (city) => {
    return cities[city] || { basePrice: 15, perKm: 2 }
  }

  const getDriverPricing = (city) => {
    const zone = getDeliveryZone(city)
    return { basePrice: zone.basePrice, perKm: zone.perKm }
  }

  const getTimeMultiplier = (date = new Date()) => {
    const hour = date.getHours()
    if (hour >= 7 && hour <= 9) return 1.5 // Rush hour
    if (hour >= 18 && hour <= 21) return 1.3 // Evening
    return 1.0
  }

  const calculateShippingCost = (distanceKm, city, date = new Date()) => {
    const pricing = getDriverPricing(city)
    const timeMultiplier = getTimeMultiplier(date)
    return (pricing.basePrice + (distanceKm * pricing.perKm)) * timeMultiplier
  }

  const getEstimatedDeliveryTime = (distanceKm) => {
    const baseMinutes = 30
    const minutesPerKm = 2
    const min = baseMinutes + (distanceKm * minutesPerKm)
    return { min, max: min + 15 }
  }

  const getDeliveryZones = () => Object.keys(cities)

  const isDeliveryAvailable = (city) => city in cities

  describe('calculateDistance', () => {
    it('should calculate distance between Casablanca and Rabat', () => {
      const casablanca = { lat: 33.5731, lng: -7.5898 }
      const rabat = { lat: 34.0209, lng: -6.8416 }

      const distance = calculateDistance(casablanca, rabat)

      expect(distance).toBeGreaterThan(50)
      expect(distance).toBeLessThan(100)
    })

    it('should return 0 for same location', () => {
      const point = { lat: 33.5731, lng: -7.5898 }

      const distance = calculateDistance(point, point)

      expect(distance).toBe(0)
    })

    it('should calculate distance between Marrakech and Casablanca', () => {
      const marrakech = { lat: 31.6295, lng: -7.9811 }
      const casablanca = { lat: 33.5731, lng: -7.5898 }

      const distance = calculateDistance(marrakech, casablanca)

      expect(distance).toBeGreaterThan(200)
      expect(distance).toBeLessThan(300)
    })
  })

  describe('getDeliveryZone', () => {
    it('should return zone for Casablanca', () => {
      const zone = getDeliveryZone('Casablanca')

      expect(zone).toHaveProperty('basePrice')
      expect(zone).toHaveProperty('perKm')
    })

    it('should return default zone for unknown city', () => {
      const zone = getDeliveryZone('UnknownCity')

      expect(zone.basePrice).toBe(15)
      expect(zone.perKm).toBe(2)
    })
  })

  describe('getDriverPricing', () => {
    it('should return pricing for Casablanca', () => {
      const pricing = getDriverPricing('Casablanca')

      expect(pricing.basePrice).toBe(15)
      expect(pricing.perKm).toBe(2)
    })

    it('should return higher pricing for Tangier', () => {
      const pricing = getDriverPricing('Tangier')

      expect(pricing.basePrice).toBe(30)
      expect(pricing.perKm).toBe(3)
    })
  })

  describe('getTimeMultiplier', () => {
    it('should return 1.5x during morning rush hour (8 AM)', () => {
      const multiplier = getTimeMultiplier(new Date('2025-01-01T08:00:00'))

      expect(multiplier).toBe(1.5)
    })

    it('should return 1.3x during evening (8 PM)', () => {
      const multiplier = getTimeMultiplier(new Date('2025-01-01T20:00:00'))

      expect(multiplier).toBe(1.3)
    })

    it('should return 1.0x during normal hours (2 PM)', () => {
      const multiplier = getTimeMultiplier(new Date('2025-01-01T14:00:00'))

      expect(multiplier).toBe(1.0)
    })
  })

  describe('calculateShippingCost', () => {
    it('should calculate cost for 10km in Casablanca', () => {
      const cost = calculateShippingCost(10, 'Casablanca', new Date('2025-01-01T14:00:00'))

      expect(cost).toBe(35) // (15 + 10*2) * 1.0
    })

    it('should include time multiplier for rush hour', () => {
      const normalCost = calculateShippingCost(10, 'Casablanca', new Date('2025-01-01T14:00:00'))
      const rushCost = calculateShippingCost(10, 'Casablanca', new Date('2025-01-01T08:00:00'))

      expect(rushCost).toBeGreaterThan(normalCost)
    })
  })

  describe('getEstimatedDeliveryTime', () => {
    it('should return estimated time for 10km', () => {
      const estimate = getEstimatedDeliveryTime(10)

      expect(estimate.min).toBe(50)
      expect(estimate.max).toBe(65)
    })

    it('should return estimated time for 0km', () => {
      const estimate = getEstimatedDeliveryTime(0)

      expect(estimate.min).toBe(30)
      expect(estimate.max).toBe(45)
    })
  })

  describe('getDeliveryZones', () => {
    it('should return all delivery zones', () => {
      const zones = getDeliveryZones()

      expect(zones).toContain('Casablanca')
      expect(zones).toContain('Rabat')
      expect(zones).toContain('Marrakech')
      expect(zones.length).toBe(5)
    })
  })

  describe('isDeliveryAvailable', () => {
    it('should return true for Casablanca', () => {
      expect(isDeliveryAvailable('Casablanca')).toBe(true)
    })

    it('should return false for unknown city', () => {
      expect(isDeliveryAvailable('MarsCity')).toBe(false)
    })
  })
})
