/**
 * Tests for CIN validation
 * Note: We test CIN validation logic for Moroccan national ID format.
 */

describe('CIN validation', () => {
  // Moroccan CIN format: 1-2 letters followed by 6-7 digits
  const validateCIN = (cin) => {
    if (!cin || typeof cin !== 'string') {
      return { valid: false, error: 'CIN is required' }
    }
    const cleaned = cin.trim().toUpperCase().replace(/\s/g, '')
    const pattern = /^[A-Z]{1,2}\d{6,7}$/
    if (!pattern.test(cleaned)) {
      return { valid: false, error: 'Invalid CIN format. Expected 1-2 letters followed by 6-7 digits.' }
    }
    return { valid: true }
  }

  const formatCIN = (cin) => {
    return cin.trim().toUpperCase().replace(/\s/g, '')
  }

  describe('validateCIN', () => {
    it('should validate a valid CIN with letter prefix', () => {
      const result = validateCIN('AB123456')

      expect(result.valid).toBe(true)
    })

    it('should validate CIN with single letter prefix', () => {
      const result = validateCIN('A123456')

      expect(result.valid).toBe(true)
    })

    it('should reject CIN without letter prefix', () => {
      const result = validateCIN('123456')

      expect(result.valid).toBe(false)
    })

    it('should reject CIN with too few digits', () => {
      const result = validateCIN('AB123')

      expect(result.valid).toBe(false)
    })

    it('should reject CIN with too many digits', () => {
      const result = validateCIN('AB12345678')

      expect(result.valid).toBe(false)
    })

    it('should reject empty CIN', () => {
      const result = validateCIN('')

      expect(result.valid).toBe(false)
    })

    it('should reject CIN with special characters', () => {
      const result = validateCIN('AB123!@#')

      expect(result.valid).toBe(false)
    })

    it('should be case insensitive', () => {
      const result = validateCIN('ab123456')

      expect(result.valid).toBe(true)
    })

    it('should return error message for invalid CIN', () => {
      const result = validateCIN('123456')

      expect(result.error).toBeDefined()
    })
  })

  describe('formatCIN', () => {
    it('should format CIN to uppercase', () => {
      const result = formatCIN('ab123456')

      expect(result).toBe('AB123456')
    })

    it('should trim whitespace', () => {
      const result = formatCIN('  AB123456  ')

      expect(result).toBe('AB123456')
    })

    it('should remove spaces within CIN', () => {
      const result = formatCIN('AB 123456')

      expect(result).toBe('AB123456')
    })
  })
})
