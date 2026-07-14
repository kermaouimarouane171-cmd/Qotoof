const DECIMAL_COMPATIBLE_UNITS = new Set(['kg', 'g', 'lb', 'ton', 'liter', 'meter'])

const toFinitePositiveNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const roundToTwoDecimals = (value) => Number(Number(value || 0).toFixed(2))

export const isDecimalQuantityUnit = (unitType) => {
  return DECIMAL_COMPATIBLE_UNITS.has(String(unitType || '').toLowerCase())
}

export const getQuantityStep = (unitType, minOrderQuantity = 1) => {
  const minimum = toFinitePositiveNumber(minOrderQuantity, 0)

  if (minimum > 0 && minimum < 1) {
    return roundToTwoDecimals(minimum)
  }

  return isDecimalQuantityUnit(unitType) ? 0.5 : 1
}

export const normalizeQuantity = (
  value,
  { unitType, minOrderQuantity = 1, fallbackQuantity } = {}
) => {
  const fallback = toFinitePositiveNumber(
    fallbackQuantity,
    toFinitePositiveNumber(minOrderQuantity, 1)
  )
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return roundToTwoDecimals(fallback)
  }

  if (numericValue <= 0) {
    return 0
  }

  const step = getQuantityStep(unitType, minOrderQuantity)
  const rounded = (isDecimalQuantityUnit(unitType) || step % 1 !== 0)
    ? Math.round(numericValue / step) * step
    : Math.round(numericValue)

  return roundToTwoDecimals(rounded)
}

export const formatQuantity = (quantity, unitType) => {
  const numericValue = Number(quantity)

  if (!Number.isFinite(numericValue)) {
    return '0'
  }

  if (isDecimalQuantityUnit(unitType) || numericValue % 1 !== 0) {
    return Number(numericValue.toFixed(2)).toString()
  }

  return Math.round(numericValue).toString()
}
