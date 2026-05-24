import { renderHook, act, waitFor } from '@testing-library/react'
import { useSecurityData, usePasswordStrength, useSecurityActions } from '@/hooks/useSecurity'

const mockStore = {
  getMFASettings: jest.fn(),
  getActiveSessions: jest.fn(),
  disableMFA: jest.fn(),
  enableMFA: jest.fn(),
  revokeAllOtherSessions: jest.fn(),
}

jest.mock('@/store/authStore', () => ({ useAuthStore: () => mockStore }))
jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
    },
  },
}))
jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}))

describe('useSecurityData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStore.getMFASettings.mockResolvedValue({ is_enabled: true })
    mockStore.getActiveSessions.mockResolvedValue([{ id: 's1' }, { id: 's2' }])
  })

  it('calls getMFASettings on mount', async () => {
    renderHook(() => useSecurityData())
    await waitFor(() => expect(mockStore.getMFASettings).toHaveBeenCalledTimes(1))
  })

  it('calls getActiveSessions on mount', async () => {
    renderHook(() => useSecurityData())
    await waitFor(() => expect(mockStore.getActiveSessions).toHaveBeenCalledTimes(1))
  })

  it('returns loading: true initially, false after data loads', async () => {
    let resolveMfa
    let resolveSessions
    mockStore.getMFASettings.mockReturnValue(new Promise((resolve) => { resolveMfa = resolve }))
    mockStore.getActiveSessions.mockReturnValue(new Promise((resolve) => { resolveSessions = resolve }))

    const { result } = renderHook(() => useSecurityData())
    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveMfa({ is_enabled: true })
      resolveSessions([{ id: 's1' }])
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('reload() re-triggers the fetch', async () => {
    const { result } = renderHook(() => useSecurityData())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(mockStore.getMFASettings).toHaveBeenCalledTimes(1)
    expect(mockStore.getActiveSessions).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.reload()
    })

    expect(mockStore.getMFASettings).toHaveBeenCalledTimes(2)
    expect(mockStore.getActiveSessions).toHaveBeenCalledTimes(2)
  })

  it('handles getMFASettings error gracefully (error set, not thrown)', async () => {
    mockStore.getMFASettings.mockRejectedValue(new Error('mfa failed'))

    const { result } = renderHook(() => useSecurityData())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('mfa failed')
  })
})

describe('usePasswordStrength', () => {
  it('returns score 0 for empty string', () => {
    const { result } = renderHook(() => usePasswordStrength(''))
    expect(result.current.score).toBe(0)
  })

  it('returns score 1 for "password" (no uppercase, no number, no special)', () => {
    const { result } = renderHook(() => usePasswordStrength('password'))
    expect(result.current.score).toBe(1)
    expect(result.current.checks.uppercase).toBe(false)
    expect(result.current.checks.number).toBe(false)
    expect(result.current.checks.special).toBe(false)
  })

  it('returns score 5 for "MyStr0ng!Pass"', () => {
    const { result } = renderHook(() => usePasswordStrength('MyStr0ng!Pass'))
    expect(result.current.score).toBe(5)
  })

  it('minLength check requires exactly 8+ characters', () => {
    const { result: seven } = renderHook(() => usePasswordStrength('Aa1!abc'))
    const { result: eight } = renderHook(() => usePasswordStrength('Aa1!abcd'))

    expect(seven.current.checks.minLength).toBe(false)
    expect(eight.current.checks.minLength).toBe(true)
  })

  it('correctly identifies missing: uppercase, number, special char', () => {
    const { result: noUpper } = renderHook(() => usePasswordStrength('lower1!ab'))
    const { result: noNumber } = renderHook(() => usePasswordStrength('NoNumber!Ab'))
    const { result: noSpecial } = renderHook(() => usePasswordStrength('NoSpecial1Ab'))

    expect(noUpper.current.checks.uppercase).toBe(false)
    expect(noNumber.current.checks.number).toBe(false)
    expect(noSpecial.current.checks.special).toBe(false)
  })
})

describe('useSecurityActions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStore.disableMFA.mockResolvedValue({ success: true })
    mockStore.enableMFA.mockResolvedValue({ success: true })
    mockStore.revokeAllOtherSessions.mockResolvedValue({ success: true })
  })

  it('disableMFA() calls authStore method', async () => {
    const { result } = renderHook(() => useSecurityActions())

    await act(async () => {
      await result.current.disableMFA()
    })

    expect(mockStore.disableMFA).toHaveBeenCalledTimes(1)
  })

  it('revokeAllSessions() calls authStore.revokeAllOtherSessions()', async () => {
    const { result } = renderHook(() => useSecurityActions())

    await act(async () => {
      await result.current.revokeAllSessions()
    })

    expect(mockStore.revokeAllOtherSessions).toHaveBeenCalledTimes(1)
  })

  it('isPending: true during async call, false after', async () => {
    let resolveAction
    mockStore.disableMFA.mockReturnValue(new Promise((resolve) => { resolveAction = resolve }))

    const { result } = renderHook(() => useSecurityActions())

    let pendingPromise
    act(() => {
      pendingPromise = result.current.disableMFA()
    })

    await waitFor(() => expect(result.current.isPending).toBe(true))

    await act(async () => {
      resolveAction({ success: true })
      await pendingPromise
    })

    expect(result.current.isPending).toBe(false)
  })
})
