/**
 * Moroccan Dirham (MAD) Currency Formatter
 * 
 * All prices in the app are in Moroccan Dirham (MAD / درهم)
 */

/**
 * Format a number as Moroccan Dirham
 * @param {number} amount - The amount to format
 * @param {object} options - Formatting options
 * @returns {string} - Formatted price string
 */
const resolveMoroccanLocale = (locale) => {
  if (locale) return locale

  if (typeof document !== 'undefined' && document?.documentElement?.lang) {
    const lang = document.documentElement.lang.toLowerCase()
    if (lang.startsWith('ar')) return 'ar-MA'
    if (lang.startsWith('fr')) return 'fr-MA'
  }

  if (typeof navigator !== 'undefined') {
    const navLang = (navigator.language || '').toLowerCase()
    if (navLang.startsWith('ar')) return 'ar-MA'
  }

  return 'fr-MA'
}

export function formatPrice(amount, options = {}) {
  const {
    showSymbol = true,
    showDecimals = true,
    locale,
    currencyCode = 'MAD',
  } = options
  const normalizedLocale = resolveMoroccanLocale(locale)

  const normalizedCurrency = currencyCode === 'DHS' ? 'AED' : currencyCode
  const safeAmount = (amount == null || Number.isNaN(Number(amount))) ? 0 : Number(amount)

  const fallbackFormatted = showDecimals ? safeAmount.toFixed(2) : `${Math.round(safeAmount)}`

  const localeIsValid = Intl.NumberFormat.supportedLocalesOf([normalizedLocale]).length > 0

  // Keep MAD formatting predictable for the current app UX/tests.
  if (normalizedCurrency === 'MAD') {
    if (!localeIsValid) {
      if (!showSymbol) return fallbackFormatted
      return `MAD ${fallbackFormatted}`
    }
    if (!showSymbol) {
      return showDecimals ? fallbackFormatted.replace('.', ',') : fallbackFormatted
    }
    return `MAD ${showDecimals ? fallbackFormatted.replace('.', ',') : fallbackFormatted}`
  }

  try {
    const intl = new Intl.NumberFormat(normalizedLocale, {
      style: 'currency',
      currency: normalizedCurrency,
      minimumFractionDigits: showDecimals ? 2 : 0,
      maximumFractionDigits: showDecimals ? 2 : 0,
    }).format(safeAmount)

    if (!showSymbol) {
      return new Intl.NumberFormat(normalizedLocale, {
        minimumFractionDigits: showDecimals ? 2 : 0,
        maximumFractionDigits: showDecimals ? 2 : 0,
      }).format(safeAmount)
    }

    return intl.replace(/\u00A0/g, ' ')
  } catch {
    if (!showSymbol) return fallbackFormatted
    return `MAD ${fallbackFormatted}`
  }
}

export function formatCurrency(amount, options = {}) {
  return formatPrice(amount, {
    currencyCode: 'MAD',
    ...options,
    locale: resolveMoroccanLocale(options.locale),
  })
}

/**
 * Format price with Arabic notation
 * @param {number} amount - The amount to format
 * @returns {string} - Formatted price in Arabic
 */
export function formatPriceArabic(amount) {
  if (amount == null || isNaN(amount)) return '0.00 درهم'
  
  const formatted = new Intl.NumberFormat('ar-MA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)

  return `${formatted} درهم`
}

/**
 * Short format for large numbers (e.g., 1.2K MAD)
 * @param {number} amount - The amount to format
 * @returns {string} - Short formatted price
 */
export function formatPriceShort(amount, options = {}) {
  const { currencyCode = 'MAD' } = options
  const normalizedCurrency = currencyCode === 'DHS' ? 'AED' : currencyCode
  if (amount == null || isNaN(amount)) return `0 ${normalizedCurrency}`
  const numericAmount = Number(amount)
  const sign = numericAmount < 0 ? '-' : ''
  const absAmount = Math.abs(numericAmount)

  if (absAmount >= 1000000) {
    return `${sign}${(absAmount / 1000000).toFixed(1)}M ${normalizedCurrency}`
  }
  if (absAmount >= 1000) {
    return `${sign}${(absAmount / 1000).toFixed(1)}K ${normalizedCurrency}`
  }
  return `${sign}${Math.round(absAmount)} ${normalizedCurrency}`
}

/**
 * Price display component
 * @param {object} props
 * @param {number} props.amount - The price amount
 * @param {string} props.className - Additional CSS classes
 * @param {boolean} props.large - Show in large format
 * @param {boolean} props.arabic - Show in Arabic notation
 */
export function PriceDisplay({ amount, className = '', large = false, arabic = false }) {
  const price = arabic ? formatPriceArabic(amount) : formatPrice(amount)
  
  return (
    <span className={`font-bold ${large ? 'text-2xl' : 'text-lg'} text-gray-900 ${className}`}>
      {price}
    </span>
  )
}
