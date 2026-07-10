/**
 * Service Tests: authActionsService.signUp
 * Verifies that the signup flow uses OTP-based email verification and role metadata.
 */

jest.mock('@/services/supabase', () => {
  const mockSignUp = jest.fn()
  const mockResend = jest.fn()
  const mockUpsert = jest.fn()
  const mockFrom = jest.fn(() => ({ upsert: mockUpsert }))
  return {
    supabase: {
      auth: { signUp: mockSignUp, resend: mockResend },
      from: mockFrom,
    },
    __mockSignUp: mockSignUp,
    __mockResend: mockResend,
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
const mockResend = supabase.auth.resend
const mockUpsert = supabase.from().upsert

describe('authActionsService.signUp', () => {
  const set = jest.fn()
  let actions
  const getRedirectPath = (role) =>
    role === 'vendor' ? '/vendor/dashboard' : role === 'driver' ? '/driver/dashboard' : '/marketplace'

  const get = jest.fn(() => ({
    ...actions,
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
    mockResend.mockResolvedValue({ error: null })
    actions = createAuthActions(set, get)
  })

  it('passes role metadata and triggers email verification when session is null', async () => {
    const result = await actions.signUp('buyer@example.com', 'Password123!', {
      firstName: 'Ali',
      lastName: 'Test',
      role: 'buyer',
      phone: '+212612345678',
      cin: 'CD789012',
    })

    expect(result.success).toBe(true)
    expect(result.needsEmailVerification).toBe(true)
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'buyer@example.com',
        password: 'Password123!',
        options: expect.objectContaining({
          data: expect.objectContaining({
            first_name: 'Ali',
            last_name: 'Test',
            role: 'buyer',
            phone: '+212612345678',
            cin: 'CD789012',
          }),
        }),
      })
    )
    const signUpOptions = mockSignUp.mock.calls[0][0].options
    expect(signUpOptions).not.toHaveProperty('emailRedirectTo')
  })

  it('returns needsEmailVerification when session is null', async () => {
    const result = await actions.signUp('buyer@example.com', 'Password123!', {
      firstName: 'Ali',
      lastName: 'Test',
      role: 'buyer',
    })

    expect(result.success).toBe(true)
    expect(result.needsEmailVerification).toBe(true)
    expect(result.requiresPhoneVerification).toBe(false)
  })

  it('returns success with redirect when session is present (email confirmation disabled)', async () => {
    mockSignUp.mockResolvedValue({
      data: {
        user: {
          id: 'u-123',
          email: 'buyer@example.com',
          user_metadata: { role: 'buyer' },
        },
        session: { access_token: 'token', refresh_token: 'refresh' },
      },
      error: null,
    })

    const result = await actions.signUp('buyer@example.com', 'Password123!', {
      firstName: 'Ali',
      lastName: 'Test',
      role: 'buyer',
    })

    expect(result.success).toBe(true)
    expect(result.redirect).toBe('/marketplace')
    expect(result.needsEmailVerification).toBeUndefined()
  })

  it('resends verification email on already-registered error', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'User already registered' },
    })

    const actions = createAuthActions(set, get)
    const result = await actions.signUp('buyer@example.com', 'Password123!', {
      firstName: 'Ali',
      lastName: 'Test',
      role: 'buyer',
    })

    expect(result.success).toBe(true)
    expect(result.needsEmailVerification).toBe(true)
    expect(mockResend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'buyer@example.com',
    })
  })

  it('saves vendor-specific fields (store_name, city) without overriding store_type', async () => {
    await actions.signUp('vendor@example.com', 'Password123!', {
      firstName: 'Ahmed',
      lastName: 'Farmer',
      role: 'vendor',
      phone: '+212612345678',
      storeName: 'Green Valley Farm',
      city: 'Marrakech',
    })

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        store_name: 'Green Valley Farm',
        city: 'Marrakech',
      }),
      { onConflict: 'id' }
    )

    const upsertArg = mockUpsert.mock.calls[0][0]
    expect(upsertArg).not.toHaveProperty('store_type')
  })

  it('does not accept invalid storeType values that would fail the DB trigger', async () => {
    await actions.signUp('vendor@example.com', 'Password123!', {
      firstName: 'Ahmed',
      lastName: 'Farmer',
      role: 'vendor',
      phone: '+212612345678',
      storeName: 'Green Valley Farm',
      storeType: 'farm',
      city: 'Marrakech',
    })

    const upsertArg = mockUpsert.mock.calls[0][0]
    expect(upsertArg).not.toHaveProperty('store_type')
    expect(upsertArg).toHaveProperty('store_name', 'Green Valley Farm')
  })

  it('saves buyer-specific field (address) to profiles on signUp', async () => {
    await actions.signUp('buyer@example.com', 'Password123!', {
      firstName: 'Ali',
      lastName: 'Buyer',
      role: 'buyer',
      phone: '+212612345678',
      deliveryAddress: '123 Main Street, Casablanca',
      city: 'Casablanca',
    })

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '123 Main Street, Casablanca',
        city: 'Casablanca',
      }),
      { onConflict: 'id' }
    )
  })

  it('does not add vendor fields for buyer role', async () => {
    await actions.signUp('buyer@example.com', 'Password123!', {
      firstName: 'Ali',
      lastName: 'Buyer',
      role: 'buyer',
      phone: '+212612345678',
      deliveryAddress: '123 Main Street',
      city: 'Rabat',
    })

    const upsertArg = mockUpsert.mock.calls[0][0]
    expect(upsertArg).not.toHaveProperty('store_name')
    expect(upsertArg).not.toHaveProperty('store_type')
  })

  it('returns error on signup failure', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Password should be at least 6 characters' },
    })
    mockResend.mockResolvedValue({
      error: { message: 'User not found' },
    })

    const actions = createAuthActions(set, get)
    const result = await actions.signUp('buyer@example.com', 'short', {
      firstName: 'Ali',
      lastName: 'Test',
      role: 'buyer',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Password should be at least 6 characters')
  })
})
