/**
 * 🔒 Security Headers Configuration
 * Implements Content Security Policy (CSP) and other security headers
 * to protect against XSS, clickjacking, MIME sniffing, and other attacks
 */

import { logger } from './logger.js'

// ============================================
// 1. CONTENT SECURITY POLICY (CSP)
// ============================================

export const generateCSP = (env = 'production') => {
  const isDev = env === 'development'

  // Base policies - restrictive by default
  const policies = {
    // Only allow scripts from self and known CDNs
    'script-src': [
      "'self'",
      "'unsafe-inline'", // Required for React in production
      "'unsafe-eval'", // Required for Vite HMR in dev
      'blob:',
      'https://www.google.com/recaptcha/',
      'https://www.gstatic.com/recaptcha/',
      'https://js.stripe.com', // Future payment integration
      'https://unpkg.com', // Leaflet, etc.
      'https://*.sentry.io',
    ],

    // Only allow styles from self and inline
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for Tailwind and dynamic styles
      'https://fonts.googleapis.com',
    ],

    // Only allow images from self and trusted sources
    'img-src': [
      "'self'",
      'data:', // For base64 images
      'blob:',
      'https://*.supabase.co',
      'https://*.googleusercontent.com',
      'https://*.firebaseapp.com',
      'https://images.unsplash.com', // Product images
    ],

    // Only allow fonts from self and Google Fonts
    'font-src': [
      "'self'",
      'https://fonts.gstatic.com',
    ],

    // Only allow connections to these domains (including WebSocket for dev)
    'connect-src': [
      "'self'",
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://*.firebaseio.com',
      'https://*.googleapis.com',
      'https://www.google.com/recaptcha/',
      'https://*.stripe.com',
      'ws://localhost:*', // Vite HMR
      'ws://127.0.0.1:*', // Vite HMR
    ],

    // Only allow frames from these sources
    'frame-src': [
      "'self'",
      'https://www.google.com/recaptcha/',
      'https://js.stripe.com',
    ],

    // Only allow media from self
    'media-src': ["'self'"],

    // Only allow objects from self (should be none ideally)
    'object-src': ["'none'"],

    // Restrict base URI
    'base-uri': ["'self'"],

    // Restrict form actions
    'form-action': ["'self'"],

    // Prevent framing (clickjacking protection)
    // Note: frame-ancestors is ignored in meta tags, only works via HTTP header
    'frame-ancestors': ["'none'"],

    // Restrict manifest source
    'manifest-src': ["'self'"],

    // Worker sources
    'worker-src': [
      "'self'",
      'blob:',
    ],
  }

  // Add development-specific sources
  if (isDev) {
    policies['script-src'].push('ws://localhost:*')
    policies['connect-src'].push('ws://localhost:*', 'ws://127.0.0.1:*')
  }

  // Convert to CSP header string
  return Object.entries(policies)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ')
}

// ============================================
// 2. SECURITY HEADERS (Server-side only)
// ============================================
// Note: These headers MUST be set via HTTP headers from the server
// They cannot be set via meta tags in the browser

export const securityHeaders = {
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',

  // Enable XSS protection (legacy browsers)
  'X-XSS-Protection': '1; mode=block',

  // Prevent clickjacking - SERVER SIDE ONLY
  // This header cannot be set via meta tag, only via HTTP response header
  'X-Frame-Options': 'DENY',

  // Enable HTTPS strict transport security
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Referrer policy - only send origin
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Permissions policy - restrict browser features
  'Permissions-Policy': [
    'camera=()',
    'microphone=()',
    'geolocation=(self)',
    'payment=(self)',
    'usb=()',
    'magnetometer=()',
    'gyroscope=()',
    'accelerometer=()',
  ].join(', '),
}

// ============================================
// 3. META TAG GENERATOR
// ============================================

export const generateSecurityMeta = () => {
  return {
    // CSP meta tag (less secure than header, but better than nothing)
    csp: generateCSP(import.meta.env.DEV ? 'development' : 'production'),

    // Theme color for mobile browsers
    themeColor: '#16a34a',

    // Color scheme
    colorScheme: 'light',

    // Prevent DNS prefetch (privacy)
    dnsPrefetchControl: 'off',

    // Disable browser features that leak information
    featurePolicy: securityHeaders['Permissions-Policy'],
  }
}

// ============================================
// 4. SECURITY VALIDATOR
// ============================================

/**
 * Validate that security headers are properly set
 */
export const validateSecurityHeaders = () => {
  const checks = {
    csp: document.querySelector("meta[http-equiv='Content-Security-Policy']") !== null,
    xContentTypeOptions: false, // Can only check server-side
    xFrameOptions: false, // Can only check server-side
    referrerPolicy: document.querySelector("meta[name='referrer']") !== null,
  }

  const passed = Object.values(checks).filter(Boolean).length
  const total = Object.keys(checks).length

  return {
    checks,
    score: `${passed}/${total}`,
    passed: passed === total,
  }
}

// ============================================
// 5. INLINE SCRIPT NONCE GENERATOR
// ============================================

/**
 * Generate cryptographically secure nonce for inline scripts
 * Note: In production, nonces should be generated server-side
 */
export const generateNonce = () => {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
}

// ============================================
// 6. SUBRESOURCE INTEGRITY (SRI) HELPER
// ============================================

/**
 * Generate SRI hash for a resource
 * Used to verify integrity of external resources
 */
export const generateSRIHash = async (url) => {
  try {
    const response = await fetch(url)
    const data = await response.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-384', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashBase64 = btoa(String.fromCharCode(...hashArray))
    return `sha384-${hashBase64}`
  } catch (error) {
    logger.error('SRI hash generation failed:', error)
    return null
  }
}

// ============================================
// 7. SECURITY INITIALIZER
// ============================================

/**
 * Initialize security measures on app load
 */
export const initializeSecurity = () => {
  // Set referrer policy
  const referrerMeta = document.createElement('meta')
  referrerMeta.name = 'referrer'
  referrerMeta.content = 'strict-origin-when-cross-origin'
  document.head.appendChild(referrerMeta)

  // Set DNS prefetch control
  const dnsMeta = document.createElement('meta')
  dnsMeta.httpEquiv = 'x-dns-prefetch-control'
  dnsMeta.content = 'off'
  document.head.appendChild(dnsMeta)

  // Note: X-Frame-Options and frame-ancestors cannot be set via meta tags
  // They must be configured in your server configuration (Firebase, Nginx, etc.)
  // For Firebase Hosting, add to firebase.json:
  // "headers": [{ "source": "**", "headers": [{ "key": "X-Frame-Options", "value": "DENY" }] }]

  // Log security initialization in dev
  if (import.meta.env.DEV) {
    logger.log('🔒 Security headers initialized')
    logger.log('⚠️  Note: X-Frame-Options and frame-ancestors require server-side configuration')
  }
}

// ============================================
// Default export
// ============================================
export default {
  generateCSP,
  securityHeaders,
  generateSecurityMeta,
  validateSecurityHeaders,
  generateNonce,
  generateSRIHash,
  initializeSecurity,
}
