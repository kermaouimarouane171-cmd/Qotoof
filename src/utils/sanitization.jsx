/**
 * 🛡️ Input Sanitization & Validation
 * Protects against XSS, SQL injection, and other injection attacks
 */

import DOMPurify from 'dompurify'

// ============================================
// 1. HTML SANITIZATION
// ============================================

/**
 * Sanitize HTML content to prevent XSS
 * Allows safe HTML tags but removes scripts and event handlers
 */
export const sanitizeHTML = (html, options = {}) => {
  if (!html || typeof html !== 'string') return ''

  const defaultOptions = {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'figure', 'figcaption',
    ],
    ALLOWED_ATTR: ['href', 'title', 'alt', 'src', 'class', 'id', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
    ...options,
  }

  return DOMPurify.sanitize(html, defaultOptions)
}

/**
 * Strip all HTML tags - plain text only
 */
export const stripHTML = (html) => {
  if (!html || typeof html !== 'string') return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

// ============================================
// 2. TEXT SANITIZATION
// ============================================

/**
 * Sanitize plain text input
 * Removes potentially dangerous characters
 */
export const sanitizeText = (text, options = {}) => {
  if (!text || typeof text !== 'string') return ''

  const {
    maxLength = 10000,
    allowNewlines = true,
    trim = true,
    collapseWhitespace = true,
  } = options

  let sanitized = text

  // Trim whitespace
  if (trim) {
    sanitized = sanitized.trim()
  }

  // Collapse multiple whitespace characters
  if (collapseWhitespace) {
    sanitized = sanitized.replace(/\s+/g, ' ')
  }

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '')

  // Remove control characters (except newlines if allowed)
  const isBlockedControlChar = (ch) => {
    const code = ch.charCodeAt(0)
    if (code === 127 || (code >= 128 && code <= 159)) return true
    if (allowNewlines) {
      return (code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31)
    }
    return code >= 0 && code <= 31
  }
  sanitized = Array.from(sanitized).filter((ch) => !isBlockedControlChar(ch)).join('')

  // Truncate to max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }

  return sanitized
}

// ============================================
// 3. URL SANITIZATION
// ============================================

/**
 * Sanitize and validate URLs
 * Prevents javascript: and data: URI XSS
 */
export const sanitizeURL = (url) => {
  if (!url || typeof url !== 'string') return ''

  // Trim whitespace
  url = url.trim()

  // Block javascript: and data: protocols
  const lowerURL = url.toLowerCase()
  if (lowerURL.startsWith('javascript:') || lowerURL.startsWith('data:')) {
    return ''
  }

  // Block vbscript: protocol
  if (lowerURL.startsWith('vbscript:')) {
    return ''
  }

  // Validate URL format
  try {
    const urlObj = new URL(url, window.location.origin)

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return ''
    }

    return urlObj.toString()
  } catch {
    // If URL is invalid, return empty
    return ''
  }
}

// ============================================
// 4. EMAIL SANITIZATION
// ============================================

/**
 * Sanitize and validate email addresses
 */
export const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return ''

  // Trim and lowercase
  email = email.trim().toLowerCase()

  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRegex.test(email)) {
    return ''
  }

  // Max length
  if (email.length > 254) {
    return ''
  }

  return email
}

// ============================================
// 5. PHONE NUMBER SANITIZATION
// ============================================

/**
 * Sanitize phone numbers
 */
export const sanitizePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return ''

  // Remove all non-digit characters except +
  phone = phone.replace(/[^\d+]/g, '')

  // Validate format (international or local)
  const phoneRegex = /^\+?[1-9]\d{6,14}$/
  if (!phoneRegex.test(phone)) {
    return ''
  }

  return phone
}

// ============================================
// 6. NUMBER SANITIZATION
// ============================================

/**
 * Sanitize numeric input
 */
export const sanitizeNumber = (value, options = {}) => {
  const {
    min = -Infinity,
    max = Infinity,
    decimals = 0,
    defaultValue = 0,
  } = options

  if (value === null || value === undefined || value === '') return defaultValue

  // Convert to number
  const num = typeof value === 'string' ? parseFloat(value) : value

  // Check if valid number
  if (isNaN(num) || !isFinite(num)) return defaultValue

  // Clamp to range
  const clamped = Math.max(min, Math.min(max, num))

  // Round to decimals
  if (decimals > 0) {
    return Math.round(clamped * Math.pow(10, decimals)) / Math.pow(10, decimals)
  }

  return Math.round(clamped)
}

// ============================================
// 7. FILE NAME SANITIZATION
// ============================================

/**
 * Sanitize file names to prevent path traversal
 */
export const sanitizeFileName = (fileName) => {
  if (!fileName || typeof fileName !== 'string') return ''

  // Remove path separators
  fileName = fileName.replace(/[\\/]/g, '')

  // Remove null bytes
  fileName = fileName.replace(/\0/g, '')

  // Remove special characters
  fileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')

  // Remove leading dots
  fileName = fileName.replace(/^\.+/, '')

  // Max length
  if (fileName.length > 255) {
    const ext = fileName.split('.').pop()
    fileName = fileName.substring(0, 255 - ext.length - 1) + '.' + ext
  }

  return fileName
}

// ============================================
// 8. SQL INJECTION PREVENTION
// ============================================

/**
 * Detect and prevent SQL injection attempts
 * Note: This is a client-side check. Server-side parameterized queries are essential.
 */
export const detectSQLInjection = (input) => {
  if (!input || typeof input !== 'string') return false

  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(\b(UNION|JOIN|WHERE|HAVING|GROUP BY|ORDER BY)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\b(OR|AND)\s+['"]\w+['"]\s*=\s*['"]\w+['"])/i,
    /(;|--|\/\*)/,
    /(\b(WAITFOR|DELAY|BENCHMARK|SLEEP)\b)/i,
    /(\b(LOAD_FILE|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b)/i,
  ]

  return sqlPatterns.some(pattern => pattern.test(input))
}

/**
 * Sanitize input to prevent SQL injection
 */
export const sanitizeForQuery = (input) => {
  if (!input || typeof input !== 'string') return input

  // Remove SQL keywords and special characters
  return input
    .replace(/['";\\]/g, '')
    .replace(/\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b/gi, '')
}

/**
 * Sanitize user input before embedding it in a Supabase/PostgREST .or() filter string.
 *
 * PostgREST parses the filter string before URL-encoding takes effect, so characters
 * like `,`  `(`  `)` allow an attacker to inject extra filter conditions.
 *
 * Example injection:
 *   input: "apple,name.eq.secret_product"
 *   unsafe: `name.ilike.%apple,name.eq.secret_product%`
 *   → PostgREST sees TWO conditions and the second bypasses the intended filter.
 *
 * Use this function on every user-controlled value that goes into an .or() string.
 * Does NOT apply to auth.uid() / system-generated UUIDs which cannot contain these chars.
 */
export const sanitizePostgRESTFilter = (input, maxLength = 200) => {
  if (!input || typeof input !== 'string') return ''
  return input
    .trim()
    .replace(/[,()]/g, '')   // strip PostgREST condition-separator and grouping chars
    .substring(0, maxLength)
}

// ============================================
// 9. XSS DETECTION
// ============================================

/**
 * Detect potential XSS attempts
 */
export const detectXSS = (input) => {
  if (!input || typeof input !== 'string') return false

  const xssPatterns = [
    /<script[\s>]/i,
    /javascript\s*:/i,
    /on\w+\s*=/i, // onclick=, onload=, etc.
    /eval\s*\(/i,
    /document\.(cookie|write|location)/i,
    /window\.(location|open)/i,
    /alert\s*\(/i,
    /prompt\s*\(/i,
    /confirm\s*\(/i,
    /<iframe[\s>]/i,
    /<object[\s>]/i,
    /<embed[\s>]/i,
    /<link[\s>]/i,
    /<meta[\s>]/i,
    /<img[^>]+onerror/i,
    /<svg[^>]+onload/i,
    /expression\s*\(/i,
  ]

  return xssPatterns.some(pattern => pattern.test(input))
}

// ============================================
// 10. REACT SANITIZATION COMPONENTS
// ============================================

import { useMemo } from 'react'

/**
 * React hook for sanitized HTML
 */
export const useSanitizedHTML = (html, options) => {
  return useMemo(() => sanitizeHTML(html, options), [html, options])
}

/**
 * React component for safe HTML rendering
 */
export const SafeHTML = ({ html, options, className, ...props }) => {
  const sanitized = useSanitizedHTML(html, options)

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
      {...props}
    />
  )
}

/**
 * React component for plain text with preserved newlines
 */
export const SafeText = ({ text, className, ...props }) => {
  const sanitized = sanitizeText(text)

  return (
    <div className={className} {...props}>
      {sanitized.split('\n').map((line, i) => (
        <span key={i}>
          {line}
          {i < sanitized.split('\n').length - 1 && <br />}
        </span>
      ))}
    </div>
  )
}

// ============================================
// 11. FORM INPUT VALIDATORS
// ============================================

/**
 * Validate and sanitize form inputs
 */
export const validateFormInput = (name, value, rules = {}) => {
  const errors = []
  let sanitized = value

  // Required field check
  if (rules.required && (!value || value.trim() === '')) {
    errors.push(`${name} is required`)
    return { valid: false, errors, value: '' }
  }

  // Type-specific sanitization and validation
  switch (rules.type) {
    case 'email':
      sanitized = sanitizeEmail(value)
      if (!sanitized && value) errors.push('Invalid email format')
      break

    case 'url':
      sanitized = sanitizeURL(value)
      if (!sanitized && value) errors.push('Invalid URL format')
      break

    case 'phone':
      sanitized = sanitizePhone(value)
      if (!sanitized && value) errors.push('Invalid phone number')
      break

    case 'number':
      sanitized = sanitizeNumber(value, rules)
      if (isNaN(sanitized)) errors.push('Invalid number')
      break

    case 'html':
      sanitized = sanitizeHTML(value)
      break

    case 'text':
    default:
      sanitized = sanitizeText(value, { maxLength: rules.maxLength || 10000 })

      // Check for SQL injection
      if (detectSQLInjection(value)) {
        errors.push('Invalid characters detected')
      }

      // Check for XSS
      if (detectXSS(value)) {
        errors.push('Invalid characters detected')
      }
      break
  }

  // Min length check
  if (rules.minLength && sanitized.length < rules.minLength) {
    errors.push(`${name} must be at least ${rules.minLength} characters`)
  }

  // Max length check
  if (rules.maxLength && sanitized.length > rules.maxLength) {
    errors.push(`${name} must be less than ${rules.maxLength} characters`)
  }

  // Pattern check
  if (rules.pattern && !rules.pattern.test(sanitized)) {
    errors.push(rules.patternMessage || `${name} format is invalid`)
  }

  return {
    valid: errors.length === 0,
    errors,
    value: sanitized,
  }
}

// ============================================
// Default export
// ============================================
export default {
  sanitizeHTML,
  stripHTML,
  sanitizeText,
  sanitizeURL,
  sanitizeEmail,
  sanitizePhone,
  sanitizeNumber,
  sanitizeFileName,
  detectSQLInjection,
  sanitizeForQuery,
  sanitizePostgRESTFilter,
  detectXSS,
  useSanitizedHTML,
  SafeHTML,
  SafeText,
  validateFormInput,
}
