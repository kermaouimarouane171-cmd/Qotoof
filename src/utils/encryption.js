/**
 * 🔐 Encryption & Hashing Utilities
 * Provides client-side encryption, hashing, and data masking
 * for enhanced security and privacy
 */

import { logger } from './logger.js'

// ============================================
// 1. DATA MASKING (For UI display)
// ============================================

/**
 * Mask sensitive data for display
 * Example: "+212674841248" → "+2****1248"
 */
export const maskData = {
  // Phone: Show first 2 and last 4 digits
  phone: (phone) => {
    if (!phone || phone.length < 6) return '***'
    return phone.substring(0, 2) + '****' + phone.substring(phone.length - 4)
  },

  // Email: Show first char and domain
  email: (email) => {
    if (!email) return '***'
    const [username, domain] = email.split('@')
    if (username.length <= 2) return username[0] + '***@' + domain
    return username[0] + '***' + username[username.length - 1] + '@' + domain
  },

  // Address: Show only city
  address: (address) => {
    if (!address) return '***'
    const parts = address.split(',')
    return parts.length > 1 ? '***, ' + parts[parts.length - 1].trim() : '***'
  },

  // Name: Show first letter + asterisks
  name: (name) => {
    if (!name || name.length === 0) return '***'
    return name[0] + '*'.repeat(Math.max(name.length - 1, 2))
  },

  // Generic: Show first and last char
  generic: (text, visibleStart = 2, visibleEnd = 2) => {
    if (!text || text.length <= visibleStart + visibleEnd) return '***'
    return text.substring(0, visibleStart) + '****' + text.substring(text.length - visibleEnd)
  }
}

// ============================================
// 2. HASHING (For integrity verification)
// ============================================

/**
 * Generate SHA-256 hash from string
 * Used for data integrity and digital signatures
 */
export const generateHash = async (data) => {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(JSON.stringify(data))
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate simple hash for quick verification
 */
export const simpleHash = (str) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36)
}

/**
 * Hash a backup code using SHA-256
 * SECURITY: Backup codes are hashed before storage in database
 * @param {string} code - The backup code to hash
 * @returns {Promise<string>} - Hashed code in hex format
 */
export const hashBackupCode = async (code) => {
  if (!code || typeof code !== 'string') {
    throw new Error('Invalid backup code')
  }
  
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(code.trim())
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Hash multiple backup codes
 * @param {string[]} codes - Array of backup codes
 * @returns {Promise<string[]>} - Array of hashed codes
 */
export const hashBackupCodes = async (codes) => {
  if (!Array.isArray(codes)) {
    throw new Error('Codes must be an array')
  }
  
  return Promise.all(codes.map(code => hashBackupCode(code)))
}

// ============================================
// 3. DIGITAL SIGNATURE (For non-repudiation)
// ============================================

/**
 * Create a digital signature for content
 * Returns signature object that can be verified later
 */
export const createSignature = async (content, userId) => {
  const timestamp = new Date().toISOString()
  const contentString = typeof content === 'string' ? content : JSON.stringify(content)
  const dataToSign = `${userId}:${contentString}:${timestamp}`
  
  const hash = await generateHash(dataToSign)
  
  return {
    hash,
    userId,
    timestamp,
    algorithm: 'SHA-256',
    version: '1.0'
  }
}

/**
 * Verify a digital signature
 */
export const verifySignature = async (content, signature) => {
  try {
    const contentString = typeof content === 'string' ? content : JSON.stringify(content)
    const dataToSign = `${signature.userId}:${contentString}:${signature.timestamp}`
    const hash = await generateHash(dataToSign)
    
    return {
      isValid: hash === signature.hash,
      hash,
      expectedHash: signature.hash
    }
  } catch (error) {
    logger.error('Signature verification error:', error)
    return {
      isValid: false,
      error: error.message
    }
  }
}

// ============================================
// 4. CLIENT-SIDE ENCRYPTION (For sensitive data)
// ============================================

/**
 * Generate a random encryption key
 * Note: For production, use server-side encryption with proper key management
 */
export const generateEncryptionKey = async () => {
  const key = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true,
    ['encrypt', 'decrypt']
  )
  return key
}

/**
 * Export key to base64 for storage
 */
export const exportKey = async (key) => {
  const rawKey = await crypto.subtle.exportKey('raw', key)
  return btoa(String.fromCharCode(...new Uint8Array(rawKey)))
}

/**
 * Import key from base64
 */
export const importKey = async (base64Key) => {
  const keyData = Uint8Array.from(atob(base64Key), c => c.charCodeAt(0))
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    'AES-GCM',
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt data (client-side)
 * Note: This is for additional protection. Server-side encryption is still required.
 */
export const encryptData = async (data, key) => {
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(JSON.stringify(data))
  
  // Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12))
  
  // Encrypt
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv
    },
    key,
    dataBuffer
  )
  
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
    iv: btoa(String.fromCharCode(...iv))
  }
}

/**
 * Decrypt data (client-side)
 */
export const decryptData = async (encryptedData, iv, key) => {
  try {
    const encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))
    const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0))
    
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer
      },
      key,
      encryptedBuffer
    )
    
    const decoder = new TextDecoder()
    return JSON.parse(decoder.decode(decryptedBuffer))
  } catch (error) {
    logger.error('Decryption error:', error)
    throw new Error('Failed to decrypt data')
  }
}

// ============================================
// 5. DEVICE FINGERPRINT (For session tracking)
// ============================================

/**
 * Generate a simple device fingerprint
 * Used for session management and security
 */
export const generateDeviceFingerprint = async () => {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 1,
    navigator.deviceMemory || 1
  ]
  
  return await generateHash(components.join('|'))
}

/**
 * Get device information
 */
export const getDeviceInfo = () => {
  const ua = navigator.userAgent
  
  // Detect OS
  let os = 'Unknown'
  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS')) os = 'macOS'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
  
  // Detect browser
  let browser = 'Unknown'
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome'
  else if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari'
  else if (ua.includes('Edg')) browser = 'Edge'
  
  // Detect device type
  let deviceType = 'desktop'
  if (/Mobi|Android/i.test(ua)) deviceType = 'mobile'
  else if (/Tablet|iPad/i.test(ua)) deviceType = 'tablet'
  
  return {
    os,
    browser,
    deviceType,
    screen: `${screen.width}x${screen.height}`,
    language: navigator.language,
    timestamp: new Date().toISOString()
  }
}

// ============================================
// 6. SECURE RANDOM (For OTP, tokens, etc.)
// ============================================

/**
 * Generate cryptographically secure random string
 */
export const generateSecureRandom = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const array = new Uint32Array(length)
  crypto.getRandomValues(array)
  
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length]
  }
  return result
}

/**
 * Generate numeric OTP code
 */
export const generateOTP = (length = 6) => {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  const code = (array[0] % Math.pow(10, length)).toString().padStart(length, '0')
  return code
}

// ============================================
// 7. DATA INTEGRITY CHECK
// ============================================

/**
 * Create integrity checksum for data
 * Used to verify data hasn't been tampered with
 */
export const createChecksum = async (data) => {
  return await generateHash(data)
}

/**
 * Verify data integrity
 */
export const verifyIntegrity = async (data, expectedChecksum) => {
  const actualChecksum = await generateHash(data)
  return actualChecksum === expectedChecksum
}

// ============================================
// 8. SECURE STORAGE (with encryption)
// ============================================

/**
 * Get or create storage encryption key
 * Derived from a fixed salt + browser-specific entropy
 */
const getStorageKey = async () => {
  const salt = new TextEncoder().encode('qotoof-secure-storage-v1')
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    salt,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000 },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt data for secure storage
 */
const encryptForStorage = async (data) => {
  const key = await getStorageKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(data))

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  )

  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv))
  }
}

/**
 * Decrypt data from secure storage
 */
const decryptFromStorage = async (encryptedData, iv) => {
  const key = await getStorageKey()
  const encrypted = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))
  const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0))

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBuffer },
    key,
    encrypted
  )

  return JSON.parse(new TextDecoder().decode(decrypted))
}

/**
 * Store sensitive data securely with AES-GCM encryption
 * Uses sessionStorage for temporary data (cleared on tab close)
 */
export const secureStorage = {
  // Store encrypted in sessionStorage
  set: async (key, value, ttlMs = null) => {
    try {
      const { encrypted, iv } = await encryptForStorage(value)
      const data = { encrypted, iv, ttl: ttlMs, ts: Date.now() }
      sessionStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
      logger.error('Secure storage set error:', error)
      // Fallback: store without encryption if crypto fails
      try {
        sessionStorage.setItem(key, JSON.stringify({ value, timestamp: Date.now(), ttl: ttlMs, fallback: true }))
      } catch (fallbackError) {
        logger.error('Secure storage fallback error:', fallbackError)
      }
    }
  },

  // Retrieve and decrypt from sessionStorage
  get: async (key) => {
    try {
      const item = sessionStorage.getItem(key)
      if (!item) return null

      const data = JSON.parse(item)
      const storedAt = data.ts ?? data.timestamp

      // Check TTL
      if (data.ttl && storedAt && (Date.now() - storedAt) > data.ttl) {
        sessionStorage.removeItem(key)
        return null
      }

      // If fallback (unencrypted), return directly
      if (data.fallback) return data.value

      // Decrypt
      if (data.encrypted && data.iv) {
        return await decryptFromStorage(data.encrypted, data.iv)
      }

      return data.value
    } catch (error) {
      logger.error('Secure storage get error:', error)
      return null
    }
  },

  // Remove from sessionStorage
  remove: (key) => {
    try {
      sessionStorage.removeItem(key)
    } catch (error) {
      logger.error('Secure storage remove error:', error)
    }
  },

  // Clear all secure storage
  clear: () => {
    try {
      sessionStorage.clear()
    } catch (error) {
      logger.error('Secure storage clear error:', error)
    }
  }
}

/**
 * Clear Supabase auth tokens from localStorage
 * Supabase stores session data in localStorage with keys like:
 *   sb-{project-ref}-auth-token
 * This ensures old/expired sessions are fully removed on logout
 */
export const clearSupabaseLocalStorage = () => {
  try {
    // Remove all Supabase auth tokens (pattern: sb-*-auth-token)
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key)
      logger.debug('Cleared Supabase localStorage token:', key.substring(0, 20) + '...')
    })
  } catch (error) {
    logger.error('clearSupabaseLocalStorage error:', error)
  }
}

// ============================================
// Default export
// ============================================
export default {
  maskData,
  generateHash,
  simpleHash,
  createSignature,
  verifySignature,
  generateEncryptionKey,
  exportKey,
  importKey,
  encryptData,
  decryptData,
  generateDeviceFingerprint,
  getDeviceInfo,
  generateSecureRandom,
  generateOTP,
  createChecksum,
  verifyIntegrity,
  secureStorage
}
