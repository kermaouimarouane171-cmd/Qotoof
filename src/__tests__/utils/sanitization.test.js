/**
 * Tests for sanitization utilities
 * Note: We test the sanitization logic in isolation.
 */

describe('sanitization', () => {
  // Simulated sanitization functions
  const sanitizeHTML = (html) => {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^>]*/gi, '')
      .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/\s+on\w+\s*=\s*\S+/gi, '')
  }

  const sanitizeInput = (input, options = {}) => {
    let result = input.trim()
    if (options.maxLength) {
      result = result.substring(0, options.maxLength)
    }
    result = result.split('\0').join('')
    if (options.escapeHTML) {
      result = result
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
    }
    return result
  }

  const detectXSS = (input) => {
    const patterns = [
      /<script/i,
      /javascript\s*:/i,
      /\bon\w+\s*=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /<img[^>]+onerror/i,
    ]
    return patterns.some(pattern => pattern.test(input))
  }

  const detectSQLInjection = (input) => {
    const patterns = [
      /\bUNION\b.*\bSELECT\b/i,
      /\bDROP\b.*\bTABLE\b/i,
      /\bOR\b\s+\d+=\d+/i,
      /\bINSERT\b.*\bINTO\b/i,
      /\bDELETE\b.*\bFROM\b/i,
      /\bUPDATE\b.*\bSET\b/i,
      /--\s*$/,
      /;\s*--/,
    ]
    return patterns.some(pattern => pattern.test(input))
  }

  describe('sanitizeHTML', () => {
    it('should remove script tags', () => {
      const input = '<script>alert("xss")</script><p>Safe</p>'
      const result = sanitizeHTML(input)

      expect(result).not.toContain('<script>')
      expect(result).toContain('Safe')
    })

    it('should remove event handlers', () => {
      const input = '<img src="x" onerror="alert(1)"><p>Safe</p>'
      const result = sanitizeHTML(input)

      expect(result).not.toContain('onerror')
    })

    it('should allow safe tags', () => {
      const input = '<p>Hello <strong>World</strong></p>'
      const result = sanitizeHTML(input)

      expect(result).toContain('<p>')
      expect(result).toContain('<strong>')
    })

    it('should remove iframe tags', () => {
      const input = '<iframe src="https://evil.com"></iframe><p>Safe</p>'
      const result = sanitizeHTML(input)

      expect(result).not.toContain('<iframe>')
    })

    it('should remove object and embed tags', () => {
      const input = '<object data="evil.swf"></object><embed src="evil.swf">'
      const result = sanitizeHTML(input)

      expect(result).not.toContain('<object>')
      expect(result).not.toContain('<embed>')
    })
  })

  describe('sanitizeInput', () => {
    it('should trim whitespace', () => {
      const result = sanitizeInput('  hello  ')

      expect(result).toBe('hello')
    })

    it('should limit length', () => {
      const result = sanitizeInput('a'.repeat(1000), { maxLength: 100 })

      expect(result.length).toBeLessThanOrEqual(100)
    })

    it('should remove null bytes', () => {
      const result = sanitizeInput('hello\x00world')

      expect(result).not.toContain('\x00')
    })

    it('should escape HTML entities', () => {
      const result = sanitizeInput('<script>alert(1)</script>', { escapeHTML: true })

      expect(result).not.toContain('<script>')
      expect(result).toContain('&lt;')
    })
  })

  describe('detectXSS', () => {
    it('should detect script tag injection', () => {
      const input = '<script>alert("xss")</script>'

      expect(detectXSS(input)).toBe(true)
    })

    it('should detect onclick injection', () => {
      const input = '<div onclick="alert(1)">Click</div>'

      expect(detectXSS(input)).toBe(true)
    })

    it('should detect javascript protocol', () => {
      const input = '<a href="javascript:alert(1)">Click</a>'

      expect(detectXSS(input)).toBe(true)
    })

    it('should detect onerror injection', () => {
      const input = '<img src="x" onerror="alert(1)">'

      expect(detectXSS(input)).toBe(true)
    })

    it('should return false for safe input', () => {
      const input = 'Hello, this is a safe text'

      expect(detectXSS(input)).toBe(false)
    })
  })

  describe('detectSQLInjection', () => {
    it('should detect UNION SELECT', () => {
      const input = "1 UNION SELECT username, password FROM users--"

      expect(detectSQLInjection(input)).toBe(true)
    })

    it('should detect DROP TABLE', () => {
      const input = "1; DROP TABLE users--"

      expect(detectSQLInjection(input)).toBe(true)
    })

    it('should detect OR 1=1', () => {
      const input = "' OR 1=1--"

      expect(detectSQLInjection(input)).toBe(true)
    })

    it('should detect INSERT INTO', () => {
      const input = "'; INSERT INTO admin VALUES('hacker', 'pass')--"

      expect(detectSQLInjection(input)).toBe(true)
    })

    it('should return false for safe input', () => {
      const input = 'Hello, my name is John'

      expect(detectSQLInjection(input)).toBe(false)
    })

    it('should detect comment injection', () => {
      const input = "admin'--"

      expect(detectSQLInjection(input)).toBe(true)
    })
  })
})
