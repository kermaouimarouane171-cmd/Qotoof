/**
 * Test: signIn safety timeout prevents infinite loading
 * Verifies that if signIn hangs (e.g. Edge Function not deployed),
 * loading and isSigningIn are reset to false after 15 seconds.
 */
import { act } from '@testing-library/react'

const mockSet = jest.fn()
const mockGet = jest.fn()
const mockSignInWithServerRateLimit = jest.fn()
const mockConsumePendingAuthRedirect = jest.fn()
const mockSetPendingAuthRedirect = jest.fn()
const mockClearPendingAuthRedirect = jest.fn()
const mockEnforceRateLimit = jest.fn()
const mockRateLimiterReset = jest.fn()
const mockGenerateDeviceFingerprint = jest.fn().mockResolvedValue('fp-123')
const mockStartAutoLogout = jest.fn()
const mockGetRedirectPath = jest.fn().mockReturnValue('/marketplace')
const mockFetchProfile = jest.fn().mockResolvedValue({ id: 'u1', role: 'buyer' })

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}))

jest.mock('@/services/authGateway', () => ({
  signInWithServerRateLimit: (...args) => mockSignInWithServerRateLimit(...args),
}))

jest.mock('@/utils/authRedirects', () => ({
  setPendingAuthRedirect: (...args) => mockSetPendingAuthRedirect(...args),
  consumePendingAuthRedirect: (...args) => mockConsumePendingAuthRedirect(...args),
  clearPendingAuthRedirect: (...args) => mockClearPendingAuthRedirect(...args),
}))

jest.mock('@/utils/rateLimiter', () => ({
  checkLoginRate: {},
  enforceRateLimit: (...args) => mockEnforceRateLimit(...args),
  rateLimiter: { reset: (...args) => mockRateLimiterReset(...args) },
}))

jest.mock('@/utils/encryption', () => ({
  generateDeviceFingerprint: (...args) => mockGenerateDeviceFingerprint(...args),
  secureStorage: { get: jest.fn(), set: jest.fn(), clear: jest.fn() },
  clearSupabaseLocalStorage: jest.fn(),
}))

jest.mock('@/services/authServices', () => ({
  mfaService: { getSettings: jest.fn().mockResolvedValue(null) },
  sessionService: { registerSession: jest.fn().mockResolvedValue(undefined) },
  autoLogoutService: { start: jest.fn(), stop: jest.fn() },
}))

jest.mock('@/services/auditLogger', () => ({
  auditLogger: { logAuthAction: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}))

jest.mock('@/utils/logger', () => ({
  logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() },
}))

jest.mock('@/services/emailService', () => ({
  emailService: { sendWelcomeEmail: jest.fn().mockResolvedValue(true) },
}))

jest.mock('@/modules/cart', () => ({
  useCartStore: { getState: jest.fn(() => ({ items: [] })) },
  useFavoritesStore: { getState: jest.fn(() => ({ favorites: [] })) },
}))

describe('signIn safety timeout', () => {
  let actions

  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()

    mockGet.mockReturnValue({
      isSigningIn: true,
      profile: null,
      getRedirectPath: mockGetRedirectPath,
      fetchProfile: mockFetchProfile,
      startAutoLogout: mockStartAutoLogout,
    })

    // Import fresh to get actions with mocked dependencies
    jest.isolateModules(() => {
      const mod = require('@/services/authActionsService')
      actions = mod.createAuthActions(mockSet, mockGet)
    })
  })

  it('forces loading:false and isSigningIn:false after 15s if signIn hangs', async () => {
    // Make signInWithServerRateLimit hang forever (never resolves)
    mockSignInWithServerRateLimit.mockReturnValue(new Promise(() => {}))

    // Start signIn — it will hang on signInWithServerRateLimit
    let signInPromise
    act(() => {
      signInPromise = actions.signIn('buyer@test.com', 'password123')
    })

    // Advance time by 15 seconds to trigger the safety timeout
    await act(async () => {
      jest.advanceTimersByTime(15000)
    })

    // The timeout should have called set({ loading: false, isSigningIn: false })
    const loadingFalseCall = mockSet.mock.calls.find(
      (call) => call[0]?.loading === false && call[0]?.isSigningIn === false
    )

    expect(loadingFalseCall).toBeDefined()
    expect(loadingFalseCall[0].loading).toBe(false)
    expect(loadingFalseCall[0].isSigningIn).toBe(false)
  })

  it('clears the timeout when signIn succeeds normally', async () => {
    mockSignInWithServerRateLimit.mockResolvedValue({
      user: { id: 'u1', email: 'buyer@test.com' },
      session: { access_token: 'tok', refresh_token: 'ref' },
    })

    mockConsumePendingAuthRedirect.mockReturnValue('/marketplace')

    let result
    await act(async () => {
      result = await actions.signIn('buyer@test.com', 'password123')
    })

    expect(result.success).toBe(true)

    // Advance time — the timeout should NOT fire because it was cleared
    mockSet.mockClear()
    jest.advanceTimersByTime(20000)

    const timeoutCall = mockSet.mock.calls.find(
      (call) => call[0]?.loading === false && call[0]?.isSigningIn === false && call[0]?.profileError === undefined
    )

    // No timeout-forced set call should happen after success
    expect(timeoutCall).toBeUndefined()
  })

  it('clears the timeout when signIn fails with an error', async () => {
    mockSignInWithServerRateLimit.mockRejectedValue(new Error('Invalid credentials'))

    let result
    await act(async () => {
      result = await actions.signIn('buyer@test.com', 'wrongpass')
    })

    expect(result.success).toBe(false)

    // Advance time — the timeout should NOT fire because it was cleared in catch
    mockSet.mockClear()
    jest.advanceTimersByTime(20000)

    const timeoutCall = mockSet.mock.calls.find(
      (call) => call[0]?.loading === false && call[0]?.isSigningIn === false
    )

    expect(timeoutCall).toBeUndefined()
  })
})
