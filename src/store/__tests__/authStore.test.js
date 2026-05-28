import { act } from '@testing-library/react'

const mockSignInWithServerRateLimit = jest.fn()
const mockGetSession = jest.fn()
const mockGetUser = jest.fn()
const mockSignOut = jest.fn()
const mockRefreshSession = jest.fn()
const mockOnAuthStateChange = jest.fn()
const mockFrom = jest.fn()
const mockGenerateDeviceFingerprint = jest.fn()
const mockClearSupabaseLocalStorage = jest.fn()
const mockSecureStorageClear = jest.fn()
const mockSetPendingAuthRedirect = jest.fn()
const mockConsumePendingAuthRedirect = jest.fn()
const mockClearPendingAuthRedirect = jest.fn()
const mockResolveSafeAuthRedirect = jest.fn()
const mockEnforceRateLimit = jest.fn()
const mockCheckLoginRate = jest.fn()
const mockCheckPasswordResetRate = jest.fn()
const mockToastSuccess = jest.fn()
const mockToastError = jest.fn()
const mockToast = jest.fn()
const mockRegisterSession = jest.fn()
const mockRevokeCurrentSession = jest.fn()
const mockAutoLogoutStart = jest.fn()
const mockAutoLogoutStop = jest.fn()
const mockAuditLogAuthAction = jest.fn().mockResolvedValue(undefined)
const mockAuditClearQueue = jest.fn()
const mockClearCart = jest.fn()
const mockClearFavorites = jest.fn()
const mockSetCartState = jest.fn()
const mockSetFavoritesState = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args) => mockGetSession(...args),
      getUser: (...args) => mockGetUser(...args),
      signOut: (...args) => mockSignOut(...args),
      refreshSession: (...args) => mockRefreshSession(...args),
      onAuthStateChange: (...args) => mockOnAuthStateChange(...args),
      signInWithOAuth: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      signUp: jest.fn(),
    },
    from: (...args) => mockFrom(...args),
    rpc: jest.fn(),
  },
}))

jest.mock('@/services/authGateway', () => ({
  signInWithServerRateLimit: (...args) => mockSignInWithServerRateLimit(...args),
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign((...args) => mockToast(...args), {
    success: (...args) => mockToastSuccess(...args),
    error: (...args) => mockToastError(...args),
  }),
}))

jest.mock('@/services/authServices', () => ({
  mfaService: {
    getSettings: jest.fn().mockResolvedValue({ is_enabled: false }),
    verifyCode: jest.fn(),
    disable: jest.fn(),
    enableWithEmail: jest.fn(),
  },
  sessionService: {
    registerSession: (...args) => mockRegisterSession(...args),
    revokeCurrentSession: (...args) => mockRevokeCurrentSession(...args),
    updateSessionActivity: jest.fn(),
    revokeAllOtherSessions: jest.fn(),
    getActiveSessions: jest.fn(),
  },
  autoLogoutService: {
    start: (...args) => mockAutoLogoutStart(...args),
    stop: (...args) => mockAutoLogoutStop(...args),
  },
}))

jest.mock('@/services/auditLogger', () => ({
  auditLogger: {
    logAuthAction: (...args) => mockAuditLogAuthAction(...args),
    logProfileAction: jest.fn(),
    clearQueue: (...args) => mockAuditClearQueue(...args),
  },
}))

jest.mock('@/services/emailService', () => ({
  emailService: {
    queueEmail: jest.fn(),
  },
}))

jest.mock('@/store/cartStore', () => ({
  useCartStore: {
    getState: () => ({ clearCart: (...args) => mockClearCart(...args) }),
    setState: (...args) => mockSetCartState(...args),
  },
}))

jest.mock('@/store/favoritesStore', () => ({
  useFavoritesStore: {
    getState: () => ({ clearFavorites: (...args) => mockClearFavorites(...args) }),
    setState: (...args) => mockSetFavoritesState(...args),
  },
}))

jest.mock('@/utils/encryption', () => ({
  generateDeviceFingerprint: (...args) => mockGenerateDeviceFingerprint(...args),
  secureStorage: {
    clear: (...args) => mockSecureStorageClear(...args),
  },
  clearSupabaseLocalStorage: (...args) => mockClearSupabaseLocalStorage(...args),
}))

jest.mock('@/utils/authRedirects', () => ({
  DEFAULT_AUTH_REDIRECT: '/marketplace',
  clearPendingAuthRedirect: (...args) => mockClearPendingAuthRedirect(...args),
  consumePendingAuthRedirect: (...args) => mockConsumePendingAuthRedirect(...args),
  resolveSafeAuthRedirect: (...args) => mockResolveSafeAuthRedirect(...args),
  setPendingAuthRedirect: (...args) => mockSetPendingAuthRedirect(...args),
}))

jest.mock('@/utils/rateLimiter', () => ({
  enforceRateLimit: (...args) => mockEnforceRateLimit(...args),
  checkLoginRate: (...args) => mockCheckLoginRate(...args),
  checkPasswordResetRate: (...args) => mockCheckPasswordResetRate(...args),
}))

jest.mock('@/utils/logger.js', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}))

jest.mock('../languageStore', () => ({
  __esModule: true,
  default: {
    getState: () => ({ language: 'ar' }),
  },
}))

import { useAuthStore } from '../authStore'

const setProfileQueryResult = ({ data, error = null }) => {
  const single = jest.fn().mockResolvedValue({ data, error })
  const eq = jest.fn().mockReturnValue({ single })
  const select = jest.fn().mockReturnValue({ eq })

  mockFrom.mockReturnValue({ select })

  return { select, eq, single }
}

const getDerivedAuthState = () => {
  const state = useAuthStore.getState()
  return {
    isAuthenticated: Boolean(state.user),
    role: state.profile?.role ?? null,
  }
}

const resetAuthState = () => {
  useAuthStore.setState({
    user: null,
    profile: null,
    session: null,
    loading: true,
    isSigningIn: false,
    initialized: false,
    profileLoading: false,
    profileError: false,
    mfaRequired: false,
    mfaPending: false,
    passwordRecoveryMode: false,
    deviceFingerprint: null,
    autoLogoutWarning: false,
    securityInitialized: false,
  })
}

describe('useAuthStore (real implementation)', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    mockSetPendingAuthRedirect.mockReturnValue('/marketplace')
    mockConsumePendingAuthRedirect.mockImplementation((fallbackPath) => fallbackPath)
    mockResolveSafeAuthRedirect.mockImplementation((_redirect, fallback) => fallback)
    mockGenerateDeviceFingerprint.mockResolvedValue('device-fingerprint-1')

    mockGetSession.mockResolvedValue({ data: { session: null } })
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    mockSignOut.mockResolvedValue({ error: null })
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null })
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
      unsubscribe: jest.fn(),
    })

    setProfileQueryResult({ data: { id: 'default-user', role: 'buyer' } })

    resetAuthState()
  })

  describe('Initial state', () => {
    it('should have user null, unauthenticated, role null, and loading true initially', () => {
      const state = useAuthStore.getState()
      const derived = getDerivedAuthState()

      expect(state.user).toBeNull()
      expect(derived.isAuthenticated).toBe(false)
      expect(derived.role).toBeNull()
      expect(state.loading).toBe(true)
    })
  })

  describe('Login action (signIn)', () => {
    it('should set user and isAuthenticated on successful login', async () => {
      const user = { id: 'user-1', email: 'buyer@qotoof.com' }
      const session = { access_token: 'token-1' }

      mockSignInWithServerRateLimit.mockResolvedValue({ user, session })
      setProfileQueryResult({
        data: { id: 'user-1', role: 'buyer', first_name: 'Buyer' },
      })

      let result
      await act(async () => {
        result = await useAuthStore.getState().signIn('buyer@qotoof.com', 'Password123!')
      })

      const state = useAuthStore.getState()
      const derived = getDerivedAuthState()

      expect(result.success).toBe(true)
      expect(state.user).toEqual(user)
      expect(state.session).toEqual(session)
      expect(derived.isAuthenticated).toBe(true)
      expect(state.loading).toBe(false)
    })

    it('should set correct role based on profile data', async () => {
      mockSignInWithServerRateLimit.mockResolvedValue({
        user: { id: 'user-2', email: 'vendor@qotoof.com' },
        session: { access_token: 'token-2' },
      })
      setProfileQueryResult({
        data: { id: 'user-2', role: 'vendor', first_name: 'Vendor' },
      })

      await act(async () => {
        await useAuthStore.getState().signIn('vendor@qotoof.com', 'Password123!')
      })

      const derived = getDerivedAuthState()
      expect(derived.role).toBe('vendor')
    })

    it('should handle Supabase auth errors (wrong password)', async () => {
      mockSignInWithServerRateLimit.mockRejectedValue(new Error('Invalid login credentials'))

      let result
      await act(async () => {
        result = await useAuthStore.getState().signIn('buyer@qotoof.com', 'wrong-password')
      })

      const state = useAuthStore.getState()

      expect(result).toEqual({
        success: false,
        error: 'Invalid email or password. Please try again.',
      })
      expect(state.user).toBeNull()
      expect(state.loading).toBe(false)
      expect(mockToastError).toHaveBeenCalledWith('Invalid email or password. Please try again.')
    })

    it('should handle Supabase auth errors (user not found)', async () => {
      mockSignInWithServerRateLimit.mockRejectedValue(new Error('User not found'))

      let result
      await act(async () => {
        result = await useAuthStore.getState().signIn('missing@qotoof.com', 'Password123!')
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid email or password. Please try again.')
      expect(useAuthStore.getState().loading).toBe(false)
    })

    it('should update loading correctly during and after login', async () => {
      let resolveSignIn
      const delayedSignIn = new Promise((resolve) => {
        resolveSignIn = resolve
      })

      mockSignInWithServerRateLimit.mockReturnValue(delayedSignIn)
      setProfileQueryResult({ data: { id: 'user-3', role: 'buyer' } })

      let signInPromise
      act(() => {
        signInPromise = useAuthStore.getState().signIn('buyer@qotoof.com', 'Password123!')
      })

      expect(useAuthStore.getState().loading).toBe(true)

      await act(async () => {
        resolveSignIn({
          user: { id: 'user-3', email: 'buyer@qotoof.com' },
          session: { access_token: 'token-3' },
        })
        await signInPromise
      })

      expect(useAuthStore.getState().loading).toBe(false)
    })
  })

  describe('Logout action (signOut)', () => {
    it('should clear user, role, isAuthenticated and call supabase.auth.signOut()', async () => {
      act(() => {
        useAuthStore.setState({
          user: { id: 'user-9', email: 'admin@qotoof.com' },
          session: { access_token: 'token-9' },
          profile: { id: 'user-9', role: 'admin' },
          loading: false,
        })
      })

      let result
      await act(async () => {
        result = await useAuthStore.getState().signOut()
      })

      const state = useAuthStore.getState()
      const derived = getDerivedAuthState()

      expect(result).toEqual({ success: true })
      expect(mockSignOut).toHaveBeenCalledTimes(1)
      expect(state.user).toBeNull()
      expect(state.profile).toBeNull()
      expect(state.session).toBeNull()
      expect(derived.role).toBeNull()
      expect(derived.isAuthenticated).toBe(false)
      expect(mockClearCart).toHaveBeenCalledTimes(1)
      expect(mockClearFavorites).toHaveBeenCalledTimes(1)
    })
  })

  describe('Role-based checks (derived selectors)', () => {
    const selectors = {
      isAdmin: () => useAuthStore.getState().profile?.role === 'admin',
      isVendor: () => useAuthStore.getState().profile?.role === 'vendor',
      isBuyer: () => useAuthStore.getState().profile?.role === 'buyer',
      isDriver: () => useAuthStore.getState().profile?.role === 'driver',
    }

    it('should correctly evaluate admin role', () => {
      act(() => {
        useAuthStore.setState({ profile: { id: '1', role: 'admin' } })
      })

      expect(selectors.isAdmin()).toBe(true)
      expect(selectors.isVendor()).toBe(false)
      expect(selectors.isBuyer()).toBe(false)
      expect(selectors.isDriver()).toBe(false)
    })

    it('should correctly evaluate vendor role', () => {
      act(() => {
        useAuthStore.setState({ profile: { id: '2', role: 'vendor' } })
      })

      expect(selectors.isAdmin()).toBe(false)
      expect(selectors.isVendor()).toBe(true)
      expect(selectors.isBuyer()).toBe(false)
      expect(selectors.isDriver()).toBe(false)
    })

    it('should correctly evaluate buyer role', () => {
      act(() => {
        useAuthStore.setState({ profile: { id: '3', role: 'buyer' } })
      })

      expect(selectors.isAdmin()).toBe(false)
      expect(selectors.isVendor()).toBe(false)
      expect(selectors.isBuyer()).toBe(true)
      expect(selectors.isDriver()).toBe(false)
    })

    it('should correctly evaluate driver role', () => {
      act(() => {
        useAuthStore.setState({ profile: { id: '4', role: 'driver' } })
      })

      expect(selectors.isAdmin()).toBe(false)
      expect(selectors.isVendor()).toBe(false)
      expect(selectors.isBuyer()).toBe(false)
      expect(selectors.isDriver()).toBe(true)
    })
  })

  describe('Session persistence', () => {
    it('should restore session from Supabase on app load via initialize()', async () => {
      const session = { access_token: 'persisted-token', user: { id: 'user-20' } }
      const user = { id: 'user-20', email: 'admin@qotoof.com' }
      const profile = { id: 'user-20', role: 'admin' }

      mockGetSession.mockResolvedValue({ data: { session } })
      mockGetUser.mockResolvedValue({ data: { user }, error: null })
      setProfileQueryResult({ data: profile })

      await act(async () => {
        await useAuthStore.getState().initialize()
      })

      const state = useAuthStore.getState()
      const derived = getDerivedAuthState()

      expect(mockGetSession).toHaveBeenCalledTimes(1)
      expect(mockGetUser).toHaveBeenCalledTimes(1)
      expect(state.session).toEqual(session)
      expect(state.user).toEqual(user)
      expect(state.profile).toEqual(profile)
      expect(derived.isAuthenticated).toBe(true)
      expect(derived.role).toBe('admin')
      expect(state.loading).toBe(false)
      expect(state.securityInitialized).toBe(true)
    })
  })
})
