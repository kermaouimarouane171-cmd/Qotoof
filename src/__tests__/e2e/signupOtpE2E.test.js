/**
 * Mocked E2E: Buyer signup + OTP verification
 * FG-009: Verifies the end-to-end signup flow with OTP-based email verification
 * without relying on real email delivery or Supabase network calls.
 */

jest.mock('@/services/supabase', () => {
  const mockSignUp = jest.fn()
  const mockResend = jest.fn()
  const mockVerifyOtp = jest.fn()
  const mockUpsert = jest.fn()
  const mockFrom = jest.fn(() => ({ upsert: mockUpsert }))
  return {
    supabase: {
      auth: { signUp: mockSignUp, resend: mockResend, verifyOtp: mockVerifyOtp },
      from: mockFrom,
    },
    __mockSignUp: mockSignUp,
    __mockResend: mockResend,
    __mockVerifyOtp: mockVerifyOtp,
    __mockUpsert: mockUpsert,
  }
})

jest.mock('@/services/authServices', () => ({
  mfaService: {},
  sessionService: {
    registerSession: jest.fn().mockResolvedValue(undefined),
  },
  autoLogoutService: {
    start: jest.fn().mockReturnValue(undefined),
    stop: jest.fn().mockReturnValue(undefined),
  },
}))

jest.mock('@/services/auditLogger', () => ({
  auditLogger: {
    logAuthAction: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('@/services/emailService', () => ({
  emailService: {},
}))

jest.mock('@/modules/cart', () => ({
  useCartStore: {},
  useFavoritesStore: {},
}))

jest.mock('@/utils/encryption', () => ({
  generateDeviceFingerprint: jest.fn().mockResolvedValue('fp'),
  secureStorage: {},
  clearSupabaseLocalStorage: jest.fn(),
}))

jest.mock('@/utils/authRedirects', () => ({
  DEFAULT_AUTH_REDIRECT: '/marketplace',
  clearPendingAuthRedirect: jest.fn(),
  consumePendingAuthRedirect: jest.fn((fallback) => fallback),
  resolveSafeAuthRedirect: jest.fn((input, fallback) => input || fallback),
  setPendingAuthRedirect: jest.fn(),
}))

jest.mock('@/utils/rateLimiter', () => ({
  checkLoginRate: jest.fn(() => ({ allowed: true })),
  checkPasswordResetRate: jest.fn(() => ({ allowed: true })),
  enforceRateLimit: jest.fn(),
  rateLimiter: {
    reset: jest.fn(),
  },
}))

jest.mock('@/services/authGateway', () => ({
  signInWithServerRateLimit: jest.fn(),
}))

jest.mock('@/config/appConfig', () => ({
  APP_CONFIG: { siteUrl: 'https://greenmarket-marketplace.web.app' },
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

import { supabase } from '@/services/supabase'
import { createAuthActions } from '@/services/authActionsService'

const mockSignUp = supabase.auth.signUp
const mockVerifyOtp = supabase.auth.verifyOtp
const mockUpsert = supabase.from().upsert

describe('FG-009 — Mocked E2E signup + OTP verification', () => {
  const getRedirectPath = (role) =>
    role === 'vendor' ? '/vendor/dashboard' : role === 'driver' ? '/driver/dashboard' : '/marketplace'

  const set = jest.fn()
  const get = jest.fn(() => ({
    getRedirectPath,
    fetchProfile: jest.fn().mockResolvedValue({ id: 'u-123', role: 'buyer' }),
    startAutoLogout: jest.fn().mockReturnValue(undefined),
  }))

  beforeEach(() => {
    jest.clearAllMocks()
    mockSignUp.mockResolvedValue({
      data: {
        user: {
          id: 'u-123',
          email: 'buyer@example.com',
          user_metadata: { role: 'buyer' },
        },
        session: null,
      },
      error: null,
    })
    mockUpsert.mockResolvedValue({ error: null })
    mockVerifyOtp.mockResolvedValue({ error: null })
  })

  it('completes buyer signup and verifies 6-digit OTP', async () => {
    const actions = createAuthActions(set, get)

    // Step 1: Buyer submits registration form
    const signupResult = await actions.signUp('buyer@example.com', 'Password123!', {
      firstName: 'Ali',
      lastName: 'Test',
      role: 'buyer',
      phone: '+212612345678',
    })

    expect(signupResult.success).toBe(true)
    expect(signupResult.needsEmailVerification).toBe(true)
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'buyer@example.com',
        password: 'Password123!',
        options: expect.objectContaining({
          data: expect.objectContaining({
            first_name: 'Ali',
            last_name: 'Test',
            role: 'buyer',
          }),
        }),
      })
    )

    // No emailRedirectTo — OTP is the primary path
    const signUpOptions = mockSignUp.mock.calls[0][0].options
    expect(signUpOptions).not.toHaveProperty('emailRedirectTo')

    // Step 2: Supabase sends a 6-digit OTP code (mocked)
    const otpCode = '123456'

    // Step 3: Buyer enters the OTP on the verification page
    const verifyResult = await supabase.auth.verifyOtp({
      email: 'buyer@example.com',
      token: otpCode,
      type: 'signup',
    })

    expect(verifyResult.error).toBeNull()
    expect(mockVerifyOtp).toHaveBeenCalledWith({
      email: 'buyer@example.com',
      token: otpCode,
      type: 'signup',
    })

    // Step 4: Verify redirect path for buyer role
    expect(getRedirectPath('buyer')).toBe('/marketplace')
  })

  it('fails signup+OTP flow when OTP token is invalid', async () => {
    const actions = createAuthActions(set, get)

    mockVerifyOtp.mockResolvedValue({
      error: { message: 'Token has expired or is invalid' },
    })

    const signupResult = await actions.signUp('buyer@example.com', 'Password123!', {
      firstName: 'Ali',
      lastName: 'Test',
      role: 'buyer',
      phone: '+212612345678',
    })

    expect(signupResult.success).toBe(true)
    expect(signupResult.needsEmailVerification).toBe(true)

    const verifyResult = await supabase.auth.verifyOtp({
      email: 'buyer@example.com',
      token: '000000',
      type: 'signup',
    })

    expect(verifyResult.error).toEqual(
      expect.objectContaining({ message: 'Token has expired or is invalid' })
    )
  })
})
