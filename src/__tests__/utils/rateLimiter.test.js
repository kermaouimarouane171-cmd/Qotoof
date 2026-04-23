import {
  checkLoginRate,
  checkPasswordResetRate,
  checkMFARate,
  checkSignupRate,
  enforceRateLimit,
  RateLimitError,
} from '../../utils/rateLimiter'

describe('Rate Limiter', () => {
  beforeEach(() => {
    // Clear rate limit storage before each test
    if (typeof globalThis.__rateLimitStore !== 'undefined') {
      globalThis.__rateLimitStore.clear()
    }
  })

  describe('checkLoginRate', () => {
    it('should allow first login attempt', () => {
      const result = checkLoginRate('user@test.com')
      expect(result.allowed).toBe(true)
    })

    it('should track attempts per identifier', () => {
      checkLoginRate('user1@test.com')
      checkLoginRate('user1@test.com')
      const result = checkLoginRate('user2@test.com')
      expect(result.allowed).toBe(true)
    })
  })

  describe('checkPasswordResetRate', () => {
    it('should allow first password reset', () => {
      const result = checkPasswordResetRate('user@test.com')
      expect(result.allowed).toBe(true)
    })
  })

  describe('checkMFARate', () => {
    it('should allow first MFA attempt', () => {
      const result = checkMFARate('user-123')
      expect(result.allowed).toBe(true)
    })
  })

  describe('checkSignupRate', () => {
    it('should allow first signup', () => {
      const result = checkSignupRate('user@test.com')
      expect(result.allowed).toBe(true)
    })
  })

  describe('enforceRateLimit', () => {
    it('should not throw when within limits', () => {
      expect(() => enforceRateLimit(checkLoginRate, 'safe@test.com')).not.toThrow()
    })

    it('should throw RateLimitError when exceeded', () => {
      const checker = jest.fn()
        .mockReturnValueOnce({ allowed: true })
        .mockReturnValueOnce({ allowed: true })
        .mockReturnValueOnce({ allowed: true })
        .mockReturnValueOnce({ allowed: true })
        .mockReturnValueOnce({ allowed: true })
        .mockReturnValueOnce({ allowed: false, retryAfter: 60000 })

      // First 5 should pass
      for (let i = 0; i < 5; i++) {
        enforceRateLimit(checker, 'spam@test.com')
      }

      // 6th should throw
      expect(() => enforceRateLimit(checker, 'spam@test.com')).toThrow(RateLimitError)
    })
  })

  describe('RateLimitError', () => {
    it('should be an instance of Error', () => {
      const error = new RateLimitError(60000)
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('RateLimitError')
    })

    it('should include retryAfter in message', () => {
      const error = new RateLimitError(120000)
      expect(error.message).toContain('120000')
    })
  })
})
