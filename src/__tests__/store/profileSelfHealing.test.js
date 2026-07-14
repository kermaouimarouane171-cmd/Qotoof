/**
 * Tests: Profile self-healing via ensure_profile RPC
 * Verifies that fetchProfile attempts to create a missing profile
 * by calling the ensure_profile RPC when the profile row is not found.
 */

const mockMaybeSingle = jest.fn()
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSelect = jest.fn(() => ({ eq: mockEq }))
const mockFrom = jest.fn(() => ({ select: mockSelect }))
const mockRpc = jest.fn()

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
    rpc: (...args) => mockRpc(...args),
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
  },
}))

jest.mock('@/services/authServices', () => ({
  mfaService: { getSettings: jest.fn().mockResolvedValue(null) },
  sessionService: { registerSession: jest.fn().mockResolvedValue(undefined) },
  autoLogoutService: { start: jest.fn(), stop: jest.fn() },
}))

jest.mock('@/services/auditLogger', () => ({
  auditLogger: { logAuthAction: jest.fn().mockResolvedValue(undefined), clearQueue: jest.fn() },
}))

jest.mock('@/utils/encryption', () => ({
  generateDeviceFingerprint: jest.fn().mockResolvedValue('fp-123'),
  secureStorage: { clear: jest.fn() },
  clearSupabaseLocalStorage: jest.fn(),
}))

jest.mock('@/utils/authRedirects', () => ({
  clearPendingAuthRedirect: jest.fn(),
  setPendingAuthRedirect: jest.fn(),
}))

jest.mock('@/modules/cart', () => ({
  useCartStore: { setState: jest.fn(), getState: jest.fn(() => ({ items: [] })) },
  useFavoritesStore: { setState: jest.fn(), getState: jest.fn(() => ({ favorites: [] })) },
}))

jest.mock('@/services/phoneOtpService', () => ({
  clearPendingPhoneVerification: jest.fn(),
  getPendingPhoneVerification: jest.fn(),
  setPendingPhoneVerification: jest.fn(),
}))

jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}))

describe('Profile self-healing via ensure_profile RPC', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls ensure_profile RPC when profile row is missing', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockRpc.mockResolvedValue({
      data: { id: 'user-123', role: 'buyer', first_name: 'Test', email: 'test@example.com' },
      error: null,
    })

    const { createSessionActions, sessionInitialState } = await import('@/store/authSessionStore')

    let state = { ...sessionInitialState, user: { id: 'user-123' }, profile: null, profileLoading: false, profileError: false }
    const set = (partial) => { state = { ...state, ...partial } }
    const get = () => state

    const actions = createSessionActions(set, get)
    // Merge actions into state so get() can access them (e.g. _attachBuyerReferralAsync)
    state = { ...state, ...actions }
    const result = await actions.fetchProfile('user-123')

    expect(mockMaybeSingle).toHaveBeenCalled()
    expect(mockRpc).toHaveBeenCalledWith('ensure_profile')
    expect(result).toBeTruthy()
    expect(result.role).toBe('buyer')
    expect(state.profile).toBeTruthy()
    expect(state.profileError).toBe(false)
  })

  it('sets profileError when ensure_profile RPC fails', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    mockRpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } })

    const { createSessionActions, sessionInitialState } = await import('@/store/authSessionStore')

    let state = { ...sessionInitialState, user: { id: 'user-123' }, profile: null, profileLoading: false, profileError: false }
    const set = (partial) => { state = { ...state, ...partial } }
    const get = () => state

    const actions = createSessionActions(set, get)
    state = { ...state, ...actions }
    const result = await actions.fetchProfile('user-123')

    expect(mockRpc).toHaveBeenCalledWith('ensure_profile')
    expect(result).toBeNull()
    expect(state.profileError).toBe(true)
    expect(state.profile).toBeNull()
  })

  it('does not call ensure_profile when profile exists', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'user-123', role: 'buyer', first_name: 'Existing' },
      error: null,
    })

    const { createSessionActions, sessionInitialState } = await import('@/store/authSessionStore')

    let state = { ...sessionInitialState, user: { id: 'user-123' }, profile: null, profileLoading: false, profileError: false }
    const set = (partial) => { state = { ...state, ...partial } }
    const get = () => state

    const actions = createSessionActions(set, get)
    state = { ...state, ...actions }
    const result = await actions.fetchProfile('user-123')

    expect(mockRpc).not.toHaveBeenCalled()
    expect(result).toBeTruthy()
    expect(result.first_name).toBe('Existing')
  })

  it('sets profileError when userId is null', async () => {
    const { createSessionActions, sessionInitialState } = await import('@/store/authSessionStore')

    let state = { ...sessionInitialState, user: null, profile: null, profileLoading: false, profileError: false }
    const set = (partial) => { state = { ...state, ...partial } }
    const get = () => state

    const actions = createSessionActions(set, get)
    state = { ...state, ...actions }
    const result = await actions.fetchProfile(null)

    expect(result).toBeNull()
    expect(state.profileError).toBe(true)
  })
})
