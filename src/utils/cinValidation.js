/**
 * Moroccan National ID (CIN) Validation
 *
 * Supports BOTH formats:
 * - Old format: 1-2 letters + 5 digits (e.g., T12345 or AB12345)
 * - New format: 1-2 letters + 6 digits (e.g., A123456 or AB123456)
 *
 * Letters: A-Z (uppercase)
 * Digits: 0-9
 */

// Accept both 5-digit and 6-digit formats
export const CIN_REGEX = /^[A-Z]{1,2}\d{5,6}$/

/**
 * Validate Moroccan CIN format
 * Supports both old (5 digits) and new (6 digits) formats
 * @param {string} cin - The CIN to validate
 * @returns {object} - { valid: boolean, error?: string }
 */
export function validateCIN(cin) {
  if (!cin) {
    return { valid: false, error: 'رقم البطاقة الوطنية مطلوب' }
  }

  const cleaned = cin.trim().toUpperCase()

  // Check length - must be 6 to 8 characters
  if (cleaned.length < 6 || cleaned.length > 8) {
    return {
      valid: false,
      error: 'رقم البطاقة الوطنية يجب أن يكون من 6 إلى 8 خانات (حرف أو حرفان + 5 أو 6 أرقام)'
    }
  }

  // Check format: 1-2 letters followed by 5 or 6 digits
  if (!CIN_REGEX.test(cleaned)) {
    return {
      valid: false,
      error: 'تنسيق غير صالح. مثال: T12345 أو AB12345 أو A123456 أو AB123456'
    }
  }

  // Additional validation: first 1-2 characters must be letters
  const [, letters = '', digits = ''] = cleaned.match(/^([A-Z]{1,2})(\d{5,6})$/) || []

  if (!/^[A-Z]{1,2}$/.test(letters)) {
    return { valid: false, error: 'البادئة يجب أن تكون حرفاً أو حرفين (A-Z)' }
  }

  if (!/^\d{5,6}$/.test(digits)) {
    return { valid: false, error: 'الخانات الأخيرة يجب أن تكون أرقام (5 أو 6 أرقام)' }
  }

  // Detect format type
  const formatType = digits.length === 5 ? 'old' : 'new'

  return { valid: true, cin: cleaned, formatType }
}

/**
 * Format CIN for display (adds spacing for readability)
 * @param {string} cin - Raw CIN value
 * @returns {string} - Formatted CIN (e.g., "AB 12345" or "AB 123456")
 */
export function formatCIN(cin) {
  if (!cin) return ''
  const cleaned = cin.trim().toUpperCase()
  if (cleaned.length === 6 || cleaned.length === 7 || cleaned.length === 8) {
    const [, letters = '', digits = ''] = cleaned.match(/^([A-Z]{1,2})(\d{5,6})$/) || []
    if (letters && digits) {
      return `${letters} ${digits}`
    }
  }

  return cleaned
}

/**
 * Mask CIN for display (show only last 4 digits)
 * @param {string} cin - Raw CIN value
 * @returns {string} - Masked CIN (e.g., "AB1****" or "AB12****")
 */
export function maskCIN(cin) {
  if (!cin || cin.length < 6) return '********'
  const cleaned = cin.trim().toUpperCase()
  const [, letters = '', digits = ''] = cleaned.match(/^([A-Z]{1,2})(\d{5,6})$/) || []
  if (!letters || !digits) return '********'
  return `${letters}***${digits.slice(-1)}`
}

/**
 * Auto-format CIN as user types
 * Supports both 5-digit and 6-digit formats
 * @param {string} value - Current input value
 * @returns {string} - Formatted value
 */
export function autoFormatCIN(value) {
  // Remove all non-alphanumeric characters
  let cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

  // Limit to 8 characters (max for new format)
  if (cleaned.length > 8) {
    cleaned = cleaned.substring(0, 8)
  }

  return cleaned
}

/**
 * Get verification status label and color
 * @param {string} status - Verification status
 * @returns {object} - { label, color, bgColor }
 */
export function getVerificationStatus(status) {
  const statuses = {
    verified: {
      label: 'Verified',
      color: 'text-green-700',
      bgColor: 'bg-green-100',
      icon: '✓',
    },
    pending: {
      label: 'Pending Review',
      color: 'text-yellow-700',
      bgColor: 'bg-yellow-100',
      icon: '⏳',
    },
    rejected: {
      label: 'Verification Failed',
      color: 'text-red-700',
      bgColor: 'bg-red-100',
      icon: '✗',
    },
    unverified: {
      label: 'Not Verified',
      color: 'text-gray-700',
      bgColor: 'bg-gray-100',
      icon: '○',
    },
  }

  return statuses[status] || statuses.unverified
}
