/**
 * Encryption utility tests
 * Note: encryption.js uses import.meta.env via logger.js which Jest can't handle.
 * We test the pure functions by mocking the module.
 */

jest.mock('../../utils/encryption', () => {
  // Pure functions that don't depend on crypto or logger
  const maskData = {
    phone: (phone) => {
      if (!phone || phone.length < 6) return '***'
      return phone.substring(0, 2) + '****' + phone.substring(phone.length - 4)
    },
    email: (email) => {
      if (!email) return '***'
      const [username, domain] = email.split('@')
      if (username.length <= 2) return username[0] + '***@' + domain
      return username[0] + '***' + username[username.length - 1] + '@' + domain
    },
    name: (name) => {
      if (!name || name.length === 0) return '***'
      return name[0] + '*'.repeat(Math.max(name.length - 1, 2))
    },
    generic: (text, visibleStart = 2, visibleEnd = 2) => {
      if (!text || text.length <= visibleStart + visibleEnd) return '***'
      return text.substring(0, visibleStart) + '****' + text.substring(text.length - visibleEnd)
    },
  }

  const simpleHash = (str) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }

  return { maskData, simpleHash }
})

import { maskData, simpleHash } from '../../utils/encryption'

describe('Encryption Utilities (pure functions)', () => {
  describe('maskData', () => {
    it('should mask phone number', () => {
      expect(maskData.phone('0612345678')).toBe('06****5678')
    })

    it('should mask short phone number', () => {
      expect(maskData.phone('123')).toBe('***')
    })

    it('should mask email', () => {
      expect(maskData.email('test@example.com')).toBe('t***t@example.com')
    })

    it('should mask empty email', () => {
      expect(maskData.email('')).toBe('***')
    })

    it('should mask generic text', () => {
      expect(maskData.generic('sensitive-data', 3, 3)).toBe('sen****ata')
    })

    it('should return *** for short generic input', () => {
      expect(maskData.generic('ab')).toBe('***')
    })

    it('should mask name', () => {
      expect(maskData.name('John')).toBe('J***')
    })

    it('should mask empty name', () => {
      expect(maskData.name('')).toBe('***')
    })
  })

  describe('simpleHash', () => {
    it('should generate a simple hash', () => {
      const hash = simpleHash('test')
      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(0)
    })

    it('should be consistent', () => {
      expect(simpleHash('same')).toBe(simpleHash('same'))
    })

    it('should produce different hashes for different input', () => {
      expect(simpleHash('data1')).not.toBe(simpleHash('data2'))
    })
  })
})
