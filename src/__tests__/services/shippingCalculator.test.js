import fs from 'fs'
import path from 'path'

jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

jest.mock('../../utils/logger.js', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

import {
  buildShippingQuote,
  calculateDistance,
  getEstimatedDeliveryTime,
  getTimeMultiplier,
} from '../../services/shippingCalculator'

const databaseMigrationPath = path.join(
  process.cwd(),
  'database/migrations/022-delivery-zone-pricing-and-payment-rls-hardening.sql'
)

const supabaseMigrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260504000030_delivery_zone_pricing_and_rls_hardening.sql'
)

const databaseUniquenessMigrationPath = path.join(
  process.cwd(),
  'database/migrations/028-delivery-zone-dedup-and-uniqueness.sql'
)

const supabaseUniquenessMigrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260504000031_enforce_delivery_zone_uniqueness.sql'
)

function extractZoneRows(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8')
  const matches = sql.matchAll(/\('((?:[^']|'')+)',\s*'((?:[^']|'')+)',\s*'((?:[^']|'')+)',\s*([0-9.]+),\s*([0-9.]+),\s*([0-9.]+)\)/g)

  return Array.from(matches, ([, city, zoneName, zoneCode, basePrice, pricePerKm, maxDistanceKm]) => ({
    city: city.replace(/''/g, "'"),
    zoneName: zoneName.replace(/''/g, "'"),
    zoneCode,
    basePrice: Number(basePrice),
    pricePerKm: Number(pricePerKm),
    maxDistanceKm: Number(maxDistanceKm),
  }))
}

function buildZoneMap(rows) {
  return new Map(rows.map((row) => [`${row.city}|${row.zoneName}`, row]))
}

describe('shippingCalculator', () => {
  describe('calculateDistance', () => {
    it('calculates distance between Casablanca and Rabat', () => {
      const distance = calculateDistance(33.5731, -7.5898, 34.0209, -6.8416)

      expect(distance).toBeGreaterThan(50)
      expect(distance).toBeLessThan(100)
    })

    it('returns 0 for the same location', () => {
      const distance = calculateDistance(33.5731, -7.5898, 33.5731, -7.5898)

      expect(distance).toBe(0)
    })
  })

  describe('getTimeMultiplier', () => {
    it('uses the softer midday multiplier', () => {
      expect(getTimeMultiplier(new Date('2025-01-01T13:00:00'))).toBe(1.1)
    })

    it('uses the softer evening multiplier', () => {
      expect(getTimeMultiplier(new Date('2025-01-01T21:00:00'))).toBe(1.05)
    })

    it('returns 1.0 during normal hours', () => {
      expect(getTimeMultiplier(new Date('2025-01-01T16:00:00'))).toBe(1)
    })
  })

  describe('buildShippingQuote', () => {
    it('keeps short urban deliveries close to the base fee', () => {
      const quote = buildShippingQuote({
        distanceKm: 2,
        basePrice: 15,
        pricePerKm: 2,
        maxDistanceKm: 50,
        pricingSource: 'zone',
        timeMultiplier: 1,
      })

      expect(quote.available).toBe(true)
      expect(quote.cost).toBe(14)
      expect(quote.breakdown.includedDistanceKm).toBe(3)
    })

    it('caps medium-distance city deliveries at a consumer-friendly level', () => {
      const quote = buildShippingQuote({
        distanceKm: 10,
        basePrice: 15,
        pricePerKm: 2,
        maxDistanceKm: 50,
        pricingSource: 'zone',
        timeMultiplier: 1,
      })

      expect(quote.available).toBe(true)
      expect(quote.cost).toBe(25)
      expect(quote.breakdown.capApplied).toBe(25)
    })

    it('still allows longer in-zone deliveries without exploding to 200 MAD', () => {
      const quote = buildShippingQuote({
        distanceKm: 30,
        basePrice: 15,
        pricePerKm: 2,
        maxDistanceKm: 50,
        pricingSource: 'zone',
        timeMultiplier: 1,
      })

      expect(quote.available).toBe(true)
      expect(quote.cost).toBe(43.9)
      expect(quote.cost).toBeLessThan(45)
    })

    it('blocks delivery when the route exceeds the configured zone limit', () => {
      const quote = buildShippingQuote({
        distanceKm: 60,
        basePrice: 15,
        pricePerKm: 2,
        maxDistanceKm: 50,
        pricingSource: 'zone',
        timeMultiplier: 1,
      })

      expect(quote.available).toBe(false)
      expect(quote.cost).toBe(0)
      expect(quote.blockingReason).toContain('50 كم')
    })

    it('applies the new time multiplier without reintroducing harsh spikes', () => {
      const normalQuote = buildShippingQuote({
        distanceKm: 4,
        basePrice: 15,
        pricePerKm: 2,
        maxDistanceKm: 50,
        pricingSource: 'zone',
        timeMultiplier: 1,
      })

      const middayQuote = buildShippingQuote({
        distanceKm: 4,
        basePrice: 15,
        pricePerKm: 2,
        maxDistanceKm: 50,
        pricingSource: 'zone',
        timeMultiplier: 1.1,
      })

      expect(middayQuote.cost).toBeGreaterThan(normalQuote.cost)
      expect(middayQuote.cost).toBeLessThan(20)
    })
  })

  describe('getEstimatedDeliveryTime', () => {
    it('keeps short trips in the first window', () => {
      expect(getEstimatedDeliveryTime(4)).toBe('30-45 min')
    })

    it('returns the medium urban window for 10km', () => {
      expect(getEstimatedDeliveryTime(10)).toBe('45-60 min')
    })

    it('returns the longer window for routes above 15km', () => {
      expect(getEstimatedDeliveryTime(20)).toBe('1-1.5 hours')
    })
  })

  describe('delivery zone migration pricing', () => {
    const databaseZones = extractZoneRows(databaseMigrationPath)
    const supabaseZones = extractZoneRows(supabaseMigrationPath)
    const databaseZoneMap = buildZoneMap(databaseZones)
    const supabaseZoneMap = buildZoneMap(supabaseZones)

    it('keeps both migration stacks aligned on the same 77 Moroccan zone prices', () => {
      expect(databaseZones).toHaveLength(77)
      expect(supabaseZones).toHaveLength(77)
      expect(databaseZoneMap.size).toBe(77)
      expect(supabaseZoneMap.size).toBe(77)
      expect([...databaseZoneMap.entries()]).toEqual([...supabaseZoneMap.entries()])
    })

    it('keeps every configured zone inside the consumer-friendly price bands', () => {
      databaseZones.forEach((zone) => {
        expect(zone.basePrice).toBeGreaterThanOrEqual(9.5)
        expect(zone.basePrice).toBeLessThanOrEqual(14)
        expect(zone.pricePerKm).toBeGreaterThanOrEqual(1.2)
        expect(zone.pricePerKm).toBeLessThanOrEqual(1.8)
        expect(zone.maxDistanceKm).toBeGreaterThanOrEqual(18)
        expect(zone.maxDistanceKm).toBeLessThanOrEqual(30)
      })
    })

    it('keeps premium districts above their local standard neighborhoods', () => {
      expect(databaseZoneMap.get('Casablanca|Ain Diab').basePrice).toBeGreaterThan(databaseZoneMap.get('Casablanca|Sidi Othmane').basePrice)
      expect(databaseZoneMap.get('Rabat|Souissi').basePrice).toBeGreaterThan(databaseZoneMap.get('Rabat|Yacoub El Mansour').basePrice)
      expect(databaseZoneMap.get('Marrakech|Hivernage').basePrice).toBeGreaterThan(databaseZoneMap.get('Marrakech|Sidi Youssef').basePrice)
      expect(databaseZoneMap.get('Tangier|Malabata').basePrice).toBeGreaterThan(databaseZoneMap.get('Tangier|Beni Makada').basePrice)
    })

    it('keeps the biggest metros above small-city centers without runaway values', () => {
      expect(databaseZoneMap.get('Casablanca|Centre Ville').basePrice).toBeGreaterThan(databaseZoneMap.get('Tiznit|Centre').basePrice)
      expect(databaseZoneMap.get('Mohammedia|Corniche').pricePerKm).toBeGreaterThan(databaseZoneMap.get('Khouribga|Centre').pricePerKm)
      expect(databaseZoneMap.get('Casablanca|Ain Diab').maxDistanceKm).toBeGreaterThan(databaseZoneMap.get('Essaouira|Medina').maxDistanceKm)
    })
  })

  describe('RLS hardening migration', () => {
    const supabaseMigrationSql = fs.readFileSync(supabaseMigrationPath, 'utf8')

    it('drops the known permissive location and delivery request policies before recreating them', () => {
      expect(supabaseMigrationSql).toContain('DROP POLICY IF EXISTS "Anyone can view available drivers" ON driver_locations;')
      expect(supabaseMigrationSql).toContain('DROP POLICY IF EXISTS "Admins can view all locations" ON driver_locations;')
      expect(supabaseMigrationSql).toContain('DROP POLICY IF EXISTS "Admins can view all delivery requests" ON delivery_requests;')
      expect(supabaseMigrationSql).toContain('CREATE POLICY admin_see_driver_locations')
      expect(supabaseMigrationSql).toContain('CREATE POLICY admin_delivery_requests')
    })

    it('replaces unrestricted payment and delivery insertion checks with role-bound rules', () => {
      expect(supabaseMigrationSql).not.toContain('CREATE POLICY "Admins can view all payments" ON payments\n    FOR SELECT USING (true);')
      expect(supabaseMigrationSql).toContain("AND profiles.role = 'admin'")
      expect(supabaseMigrationSql).toContain("WITH CHECK (auth.role() = 'service_role')")
    })
  })

  describe('delivery zone uniqueness follow-up migration', () => {
    const databaseUniquenessSql = fs.readFileSync(databaseUniquenessMigrationPath, 'utf8')
    const supabaseUniquenessSql = fs.readFileSync(supabaseUniquenessMigrationPath, 'utf8')

    it('keeps both migration stacks aligned on duplicate cleanup before enforcing uniqueness', () => {
      const requiredFragments = [
        'ROW_NUMBER() OVER (',
        'PARTITION BY city, zone_name',
        'DELETE FROM public.delivery_zones',
        'ADD CONSTRAINT delivery_zones_city_zone_name_key UNIQUE (city, zone_name);',
      ]

      requiredFragments.forEach((fragment) => {
        expect(databaseUniquenessSql).toContain(fragment)
        expect(supabaseUniquenessSql).toContain(fragment)
      })
    })

    it('keeps the newest active zone record when duplicates exist', () => {
      expect(databaseUniquenessSql).toContain('COALESCE(is_active, false) DESC')
      expect(databaseUniquenessSql).toContain('updated_at DESC NULLS LAST')
      expect(supabaseUniquenessSql).toContain('COALESCE(is_active, false) DESC')
      expect(supabaseUniquenessSql).toContain('updated_at DESC NULLS LAST')
    })
  })
})
