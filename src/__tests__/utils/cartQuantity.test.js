const {
  formatQuantity,
  getQuantityStep,
  isDecimalQuantityUnit,
  normalizeQuantity,
} = require('@/utils/cartQuantity')

describe('cartQuantity utilities', () => {
  test('detects decimal-compatible quantity units', () => {
    expect(isDecimalQuantityUnit('kg')).toBe(true)
    expect(isDecimalQuantityUnit('meter')).toBe(true)
    expect(isDecimalQuantityUnit('piece')).toBe(false)
  })

  test('uses half-step quantities for weight-based units by default', () => {
    expect(getQuantityStep('kg', 1)).toBe(0.5)
    expect(getQuantityStep('piece', 1)).toBe(1)
  })

  test('respects fractional minimum quantities smaller than the default step', () => {
    expect(getQuantityStep('kg', 0.25)).toBe(0.25)
  })

  test('normalizes invalid quantities to the provided fallback', () => {
    expect(normalizeQuantity(undefined, {
      unitType: 'piece',
      minOrderQuantity: 3,
      fallbackQuantity: 3,
    })).toBe(3)
  })

  test('rounds decimal-compatible quantities to the nearest supported step', () => {
    expect(normalizeQuantity(1.24, {
      unitType: 'kg',
      minOrderQuantity: 1,
      fallbackQuantity: 1,
    })).toBe(1)

    expect(normalizeQuantity(1.26, {
      unitType: 'kg',
      minOrderQuantity: 1,
      fallbackQuantity: 1,
    })).toBe(1.5)
  })

  test('rounds count-based quantities to whole numbers', () => {
    expect(normalizeQuantity(3.6, {
      unitType: 'piece',
      minOrderQuantity: 1,
      fallbackQuantity: 1,
    })).toBe(4)
  })

  test('formats decimal quantities without trailing zeros', () => {
    expect(formatQuantity(2.5, 'kg')).toBe('2.5')
    expect(formatQuantity(4, 'piece')).toBe('4')
  })
})