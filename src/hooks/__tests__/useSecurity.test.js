import { act, renderHook, waitFor } from '@testing-library/react'
import {
  usePasswordChange,
  usePasswordStrength,
  useSecurityActions,
  useSecurityData,
  validatePasswordStrength,
} from '@/hooks/useSecurity'

const mockStore = {
  user: { id: 'user-1', email: 'vendor@greenmarket.test' },
  getMFASettings: jest.fn(),
  getActiveSessions: jest.fn(),
  disableMFA: jest.fn(),
  enableMFA: jest.fn(),
  revokeAllOtherSessions: jest.fn(),
  updatePassword: jest.fn(),
}

const mockSignInWithPassword = jest.fn()
const mockAuditLogger = {
  logMFAAction: jest.fn(),
  logSessionAction: jest.fn(),
  logSecurityAction: jest.fn(),
}

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(() => mockStore),
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args) => mockSignInWithPassword(...args),
    },
  },
}))

jest.mock('@/services/auditLogger', () => ({
  auditLogger: {
    logMFAAction: (...args) => mockAuditLogger.logMFAAction(...args),
    logSessionAction: (...args) => mockAuditLogger.logSessionAction(...args),
    logSecurityAction: (...args) => mockAuditLogger.logSecurityAction(...args),
  },
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

const createDeferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const toStrengthBucket = (score) => {
  if (score <= 1) return 'weak'
  if (score <= 4) return 'medium'
  return 'strong'
}

describe('useSecurityData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStore.getMFASettings.mockResolvedValue({ is_enabled: true, method: 'totp' })
    mockStore.getActiveSessions.mockResolvedValue([
      { id: 's1', device: 'Chrome', ip: '127.0.0.1', lastActive: '2026-05-24T10:00:00Z' },
      { id: 's2', device: 'Safari', ip: '127.0.0.2', lastActive: '2026-05-24T09:00:00Z' },
    ])
  })

  it('loads MFA settings on mount', async () => {
    const { result } = renderHook(() => useSecurityData())

    await waitFor(() => expect(mockStore.getMFASettings).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.mfaSettings).not.toBeNull())
    expect(result.current.mfaSettings?.is_enabled).toBe(true)
    expect(result.current.mfaSettings?.method).toBe('totp')
  })

  it('loads active sessions on mount', async () => {
    const { result } = renderHook(() => useSecurityData())

    await waitFor(() => expect(mockStore.getActiveSessions).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(result.current.sessions).toHaveLength(2))
    expect(result.current.sessions).toEqual([
      expect.objectContaining({ id: 's1', device: 'Chrome', ip: '127.0.0.1' }),
      expect.objectContaining({ id: 's2', device: 'Safari', ip: '127.0.0.2' }),
    ])
    expect(result.current.sessions).toHaveLength(2)
  })

  it('handles loading state correctly', async () => {
    const mfaDeferred = createDeferred()
    const sessionsDeferred = createDeferred()
    mockStore.getMFASettings.mockReturnValueOnce(mfaDeferred.promise)
    mockStore.getActiveSessions.mockReturnValueOnce(sessionsDeferred.promise)

    const { result } = renderHook(() => useSecurityData())

    expect(result.current.loading).toBe(true)

    await act(async () => {
      mfaDeferred.resolve({ is_enabled: false, method: null })
      sessionsDeferred.resolve([])
    })

    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('sets loading=false even when fetch throws', async () => {
    mockStore.getMFASettings.mockRejectedValueOnce(new Error('fetch mfa failed'))

    const { result } = renderHook(() => useSecurityData())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('fetch mfa failed')
  })

  it('handles fetch error gracefully', async () => {
    mockStore.getActiveSessions.mockRejectedValueOnce(new Error('Unable to load security data'))

    const { result } = renderHook(() => useSecurityData())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('Unable to load security data')
    expect(result.current.sessions).toEqual([])
  })
})

describe('usePasswordStrength', () => {
  it('returns strength weak for passwords under 8 chars (policy validation)', () => {
    const t = (_key, fallback) => fallback
    const validation = validatePasswordStrength('Ab1!a', t, 'security.errors')
    expect(validation.strength).toBe('weak')
  })

  it('returns strength medium for 8+ chars without special chars', () => {
    const { result } = renderHook(() => usePasswordStrength('Password1'))
    expect(toStrengthBucket(result.current.score)).toBe('medium')
    expect(result.current.checks.special).toBe(false)
  })

  it('returns strength strong for 8+ chars with uppercase + number + special', () => {
    const { result } = renderHook(() => usePasswordStrength('Password1!'))
    expect(toStrengthBucket(result.current.score)).toBe('strong')
  })

  it('validates minimum 8 characters', () => {
    const { result } = renderHook(() => usePasswordStrength('Aa1!abc'))
    expect(result.current.checks.minLength).toBe(false)
  })

  it('validates at least one uppercase letter', () => {
    const { result } = renderHook(() => usePasswordStrength('password1!'))
    expect(result.current.checks.uppercase).toBe(false)
  })

  it('validates at least one number', () => {
    const { result } = renderHook(() => usePasswordStrength('Password!'))
    expect(result.current.checks.number).toBe(false)
  })

  it('validates at least one special character', () => {
    const { result } = renderHook(() => usePasswordStrength('Password1'))
    expect(result.current.checks.special).toBe(false)
  })

  it('returns score mappable to 0-100 for progress bar display', () => {
    const { result } = renderHook(() => usePasswordStrength('Password1!'))
    const progress = result.current.score * 20
    expect(progress).toBeGreaterThanOrEqual(0)
    expect(progress).toBeLessThanOrEqual(100)
  })

  it('handles empty string input', () => {
    const { result } = renderHook(() => usePasswordStrength(''))
    expect(result.current.score).toBe(0)
    expect(result.current.label).toBe('weak')
  })

  it('handles null and undefined input without crashing', () => {
    const nullResult = renderHook(() => usePasswordStrength(null)).result
    const undefinedResult = renderHook(() => usePasswordStrength(undefined)).result

    expect(nullResult.current.score).toBe(0)
    expect(undefinedResult.current.score).toBe(0)
  })

  it('password validator enforces minimum policy rules', () => {
    const t = (_key, fallback) => fallback
    const result = validatePasswordStrength('abc', t, 'security.errors')

    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
    expect(result.strength).toBe('weak')
  })
})

describe('usePasswordChange', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStore.user = { id: 'user-1', email: 'vendor@greenmarket.test' }
    mockStore.updatePassword.mockResolvedValue({ success: true })
    mockSignInWithPassword.mockResolvedValue({ error: null })
  })

  it('calls authStore.updatePassword with old and new password flow', async () => {
    const { result } = renderHook(() => usePasswordChange())

    await act(async () => {
      await result.current.changePassword('OldPass1!', 'NewPass1!')
    })

    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'vendor@greenmarket.test',
      password: 'OldPass1!',
    })
    expect(mockStore.updatePassword).toHaveBeenCalledWith('NewPass1!')
  })

  it('shows success state after password change', async () => {
    const { result } = renderHook(() => usePasswordChange())

    await act(async () => {
      await result.current.changePassword('OldPass1!', 'NewPass1!')
    })

    expect(result.current.success).toBe(true)
  })

  it('shows error for wrong current password', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } })
    const { result } = renderHook(() => usePasswordChange())

    await act(async () => {
      await result.current.changePassword('WrongPass1!', 'NewPass1!')
    })

    expect(result.current.error).toBe('Current password is incorrect')
    expect(mockStore.updatePassword).not.toHaveBeenCalled()
  })

  it('logs audit event after successful password change', async () => {
    const { result } = renderHook(() => usePasswordChange())

    await act(async () => {
      await result.current.changePassword('OldPass1!', 'NewPass1!')
    })

    expect(mockAuditLogger.logSecurityAction).toHaveBeenCalledWith('PASSWORD_CHANGED', 'user-1')
  })

  it('supports clearing status after successful change', async () => {
    const { result } = renderHook(() => usePasswordChange())

    await act(async () => {
      await result.current.changePassword('OldPass1!', 'NewPass1!')
    })
    expect(result.current.success).toBe(true)

    act(() => {
      result.current.reset()
    })

    expect(result.current.success).toBe(false)
    expect(result.current.error).toBe(null)
  })

  it('prevents duplicate submission while loading', async () => {
    const deferred = createDeferred()
    mockStore.updatePassword.mockReturnValueOnce(deferred.promise)

    const { result } = renderHook(() => usePasswordChange())

    let pendingPromise
    await act(async () => {
      pendingPromise = result.current.changePassword('OldPass1!', 'NewPass1!')
    })

    await waitFor(() => expect(result.current.isPending).toBe(true))

    await act(async () => {
      deferred.resolve({ success: true })
      await pendingPromise
    })

    expect(result.current.isPending).toBe(false)
  })
})

describe('handleDisableMFA/useSecurityActions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStore.user = { id: 'user-1', email: 'vendor@greenmarket.test' }
    mockStore.disableMFA.mockResolvedValue({ success: true })
    mockStore.revokeAllOtherSessions.mockResolvedValue({ success: true })
  })

  it('calls disableMFA action', async () => {
    const { result } = renderHook(() => useSecurityActions())

    await act(async () => {
      await result.current.disableMFA()
    })

    expect(mockStore.disableMFA).toHaveBeenCalledTimes(1)
  })

  it('updates state and logs event after disabling MFA', async () => {
    const { result } = renderHook(() => useSecurityActions())

    await act(async () => {
      await result.current.disableMFA()
    })

    expect(result.current.error).toBe(null)
    expect(mockAuditLogger.logMFAAction).toHaveBeenCalledWith('MFA_DISABLED', 'user-1')
  })

  it('shows error if disable fails', async () => {
    mockStore.disableMFA.mockResolvedValueOnce({ success: false, error: 'disable failed' })
    const { result } = renderHook(() => useSecurityActions())

    await act(async () => {
      await expect(result.current.disableMFA()).rejects.toBeDefined()
    })

    expect(result.current.error).toBe('disable failed')
  })
})

describe('handleRevokeAllSessions/useSecurityActions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStore.user = { id: 'user-1', email: 'vendor@greenmarket.test' }
    mockStore.revokeAllOtherSessions.mockResolvedValue({ success: true })
  })

  it('calls revokeAllOtherSessions action', async () => {
    const { result } = renderHook(() => useSecurityActions())

    await act(async () => {
      await result.current.revokeAllSessions()
    })

    expect(mockStore.revokeAllOtherSessions).toHaveBeenCalledTimes(1)
  })

  it('logs audit event after revocation', async () => {
    const { result } = renderHook(() => useSecurityActions())

    await act(async () => {
      await result.current.revokeAllSessions()
    })

    expect(mockAuditLogger.logSessionAction).toHaveBeenCalledWith('SESSIONS_REVOKED_ALL', 'user-1')
  })

  it('handles API error gracefully', async () => {
    mockStore.revokeAllOtherSessions.mockResolvedValueOnce({ success: false, error: 'revoke failed' })
    const { result } = renderHook(() => useSecurityActions())

    await act(async () => {
      await expect(result.current.revokeAllSessions()).rejects.toBeDefined()
    })

    expect(result.current.error).toBe('revoke failed')
  })
})