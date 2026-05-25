import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import SessionManager from '@/components/auth/SessionManager'
import { createSessionActions } from '@/store/authSessionStore'

const mockSessionService = {
  getActiveSessions: jest.fn(),
  revokeSession: jest.fn(),
  revokeAllOtherSessions: jest.fn(),
}

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
}

const mockSupabase = {
  auth: {
    onAuthStateChange: jest.fn(),
  },
}

const mockAutoLogoutService = {
  start: jest.fn(),
  stop: jest.fn(),
}

const mockAuditLogger = {
  clearQueue: jest.fn(),
}

const mockSecureStorage = {
  clear: jest.fn(),
}

const mockSetCartState = jest.fn()
const mockSetFavoritesState = jest.fn()

jest.mock('@/services/authServices', () => ({
  sessionService: {
    getActiveSessions: (...args) => mockSessionService.getActiveSessions(...args),
    revokeSession: (...args) => mockSessionService.revokeSession(...args),
    revokeAllOtherSessions: (...args) => mockSessionService.revokeAllOtherSessions(...args),
  },
  autoLogoutService: {
    start: (...args) => mockAutoLogoutService.start(...args),
    stop: (...args) => mockAutoLogoutService.stop(...args),
  },
  mfaService: {
    getSettings: jest.fn(),
  },
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), {
    success: (...args) => mockToast.success(...args),
    error: (...args) => mockToast.error(...args),
  }),
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (...args) => mockSupabase.auth.onAuthStateChange(...args),
    },
  },
}))

jest.mock('@/services/auditLogger', () => ({
  auditLogger: {
    clearQueue: (...args) => mockAuditLogger.clearQueue(...args),
    logAuthAction: jest.fn(),
  },
}))

jest.mock('@/utils/encryption', () => ({
  secureStorage: {
    clear: (...args) => mockSecureStorage.clear(...args),
  },
  clearSupabaseLocalStorage: jest.fn(),
  generateDeviceFingerprint: jest.fn(),
}))

jest.mock('@/store/cartStore', () => ({
  useCartStore: {
    setState: (...args) => mockSetCartState(...args),
  },
}))

jest.mock('@/store/favoritesStore', () => ({
  useFavoritesStore: {
    setState: (...args) => mockSetFavoritesState(...args),
  },
}))

jest.mock('@/utils/authRedirects', () => ({
  clearPendingAuthRedirect: jest.fn(),
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('SessionManager integration', () => {
  const baseSessions = [
    {
      id: 'sess-current',
      is_current: true,
      device_info: { browser: 'Chrome', os: 'Linux', deviceType: 'desktop' },
      last_active: new Date(Date.now() - 60_000).toISOString(),
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
    },
    {
      id: 'sess-other-1',
      is_current: false,
      device_info: { browser: 'Safari', os: 'iOS', deviceType: 'mobile' },
      last_active: new Date(Date.now() - 120_000).toISOString(),
      created_at: new Date(Date.now() - 90_000_000).toISOString(),
    },
    {
      id: 'sess-other-2',
      is_current: false,
      device_info: { browser: 'Firefox', os: 'Windows', deviceType: 'desktop' },
      last_active: new Date(Date.now() - 240_000).toISOString(),
      created_at: new Date(Date.now() - 80_000_000).toISOString(),
    },
    {
      id: 'sess-other-3',
      is_current: false,
      device_info: { browser: 'Edge', os: 'Android', deviceType: 'tablet' },
      last_active: new Date(Date.now() - 300_000).toISOString(),
      created_at: new Date(Date.now() - 70_000_000).toISOString(),
    },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockSessionService.getActiveSessions.mockResolvedValue(baseSessions)
    mockSessionService.revokeSession.mockResolvedValue({ success: true })
    mockSessionService.revokeAllOtherSessions.mockResolvedValue({ success: true })
    jest.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    window.confirm.mockRestore()
  })

  it('renders active sessions and highlights current session', async () => {
    render(<SessionManager isOpen={true} onClose={jest.fn()} />)

    expect(await screen.findByText('Active Sessions')).toBeInTheDocument()
    expect(await screen.findByText('Current Session')).toBeInTheDocument()
    expect(screen.getByText('Chrome')).toBeInTheDocument()
    expect(screen.getByText('Safari')).toBeInTheDocument()
    expect(screen.getByText('Sign Out All Other Devices')).toBeEnabled()
  })

  it('revokes a single session and reloads list', async () => {
    render(<SessionManager isOpen={true} onClose={jest.fn()} />)

    await screen.findByText('Safari')

    const revokeButton = document.querySelector('button.text-red-600')
    expect(revokeButton).toBeTruthy()

    fireEvent.click(revokeButton)

    await waitFor(() => {
      expect(mockSessionService.revokeSession).toHaveBeenCalledWith('sess-other-1')
    })

    expect(mockToast.success).toHaveBeenCalledWith('Session revoked')
    expect(mockSessionService.getActiveSessions).toHaveBeenCalledTimes(2)
  })

  it('revokes all other sessions after confirmation', async () => {
    render(<SessionManager isOpen={true} onClose={jest.fn()} />)

    await screen.findByText('Sign Out All Other Devices')
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out All Other Devices' }))

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled()
      expect(mockSessionService.revokeAllOtherSessions).toHaveBeenCalledTimes(1)
    })

    expect(mockToast.success).toHaveBeenCalledWith('All other sessions revoked')
  })

  it('shows warning banner when there are more than 3 sessions', async () => {
    render(<SessionManager isOpen={true} onClose={jest.fn()} />)

    expect(await screen.findByText('Too many active sessions?')).toBeInTheDocument()
  })
})

describe('auth session lifecycle integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('dispatches auth:sessionExpired on TOKEN_REFRESH_FAILED', async () => {
    let authCallback

    mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
      authCallback = callback
      return { unsubscribe: jest.fn() }
    })

    const set = jest.fn()
    const get = jest.fn(() => ({ user: null, profile: null }))

    const actions = createSessionActions(set, get)
    actions.setupAuthListener()

    const listener = jest.fn()
    window.addEventListener('auth:sessionExpired', listener)

    await authCallback('TOKEN_REFRESH_FAILED', null)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ user: null, session: null, profile: null }))
    expect(mockSetCartState).toHaveBeenCalled()
    expect(mockSetFavoritesState).toHaveBeenCalled()

    window.removeEventListener('auth:sessionExpired', listener)
  })

  it('startAutoLogout triggers warning state and inactivity logout callback', () => {
    jest.useFakeTimers()

    let warningCb
    let logoutCb

    mockAutoLogoutService.start.mockImplementation((onWarning, onLogout) => {
      warningCb = onWarning
      logoutCb = onLogout
    })

    const set = jest.fn()
    const get = jest.fn(() => ({}))
    const actions = createSessionActions(set, get)

    actions.startAutoLogout()

    warningCb(5 * 60 * 1000)
    jest.runOnlyPendingTimers()

    expect(set).toHaveBeenCalledWith({ autoLogoutWarning: true })

    logoutCb()
    jest.runOnlyPendingTimers()

    expect(set).toHaveBeenCalledWith(expect.objectContaining({
      user: null,
      session: null,
      profile: null,
      autoLogoutWarning: false,
    }))
    expect(mockSecureStorage.clear).toHaveBeenCalled()
    expect(mockToast.success).toHaveBeenCalledWith('You have been logged out due to inactivity')

    jest.useRealTimers()
  })
})
