import { requireUser, unauthenticatedResponse } from '@/utils/authHelpers'

describe('authHelpers', () => {
  describe('requireUser', () => {
    it('returns the user when provided', () => {
      const user = { id: 'u-1' }
      expect(requireUser(user)).toBe(user)
    })

    it('throws default message when user is missing', () => {
      expect(() => requireUser(null)).toThrow('No user logged in')
    })

    it('throws custom message when provided', () => {
      expect(() => requireUser(undefined, 'Custom auth error')).toThrow('Custom auth error')
    })
  })

  describe('unauthenticatedResponse', () => {
    it('returns success false with default message', () => {
      expect(unauthenticatedResponse()).toEqual({ success: false, error: 'No user logged in' })
    })

    it('returns success false with custom message', () => {
      expect(unauthenticatedResponse('Session expired')).toEqual({ success: false, error: 'Session expired' })
    })
  })
})
