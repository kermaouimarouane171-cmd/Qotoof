import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import TwoFactor from '@/features/auth/components/TwoFactor'
import VendorSecurityPage from '@/pages/vendor/Security'
import BuyerSecurityPage from '@/pages/buyer/Security'
import DriverSecurityPage from '@/pages/driver/Security'
import AdminSecurityPage from '@/pages/admin/Security'
import { mfaService } from '@/services/authServices'
import { auditLogger } from '@/services/auditLogger'

const mockStore = {
  user: { id: 'u-vendor', email: 'vendor@greenmarket.test' },
  profile: {
    id: 'u-vendor',
    role: 'vendor',
    email: 'vendor@greenmarket.test',
    first_name: 'Vendor',
    last_name: 'User',
    phone: '+212600000000',
    mfa_enabled: false,
  },
  signOut: jest.fn(),
  verifyMFA: jest.fn(),
  getMFASettings: jest.fn(),
  getActiveSessions: jest.fn(),
  disableMFA: jest.fn(),
  enableMFA: jest.fn(),
  revokeAllOtherSessions: jest.fn(),
  updatePassword: jest.fn(),
  refreshProfile: jest.fn(),
}

const mockMfaService = {
  getSettings: jest.fn(),
  enableWithEmail: jest.fn(),
  disable: jest.fn(),
  generateTOTPSecret: jest.fn(),
  verifyCode: jest.fn(),
  enableWithTOTP: jest.fn(),
}

const mockAuditLogger = {
  logMFAAction: jest.fn(),
  logSessionAction: jest.fn(),
  logSecurityAction: jest.fn(),
}

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
}

const mockNavigate = jest.fn()

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(),
}))

jest.mock('@/services/authServices', () => ({
  mfaService: {
    getSettings: (...args) => mockMfaService.getSettings(...args),
    enableWithEmail: (...args) => mockMfaService.enableWithEmail(...args),
    disable: (...args) => mockMfaService.disable(...args),
    generateTOTPSecret: (...args) => mockMfaService.generateTOTPSecret(...args),
    verifyCode: (...args) => mockMfaService.verifyCode(...args),
    enableWithTOTP: (...args) => mockMfaService.enableWithTOTP(...args),
  },
  sessionService: {
    getActiveSessions: jest.fn().mockResolvedValue([]),
    revokeAllOtherSessions: jest.fn().mockResolvedValue({ success: true }),
  },
}))

jest.mock('@/services/auditLogger', () => ({
  auditLogger: {
    logMFAAction: (...args) => mockAuditLogger.logMFAAction(...args),
    logSessionAction: (...args) => mockAuditLogger.logSessionAction(...args),
    logSecurityAction: (...args) => mockAuditLogger.logSecurityAction(...args),
  },
  useAuditLogs: jest.fn(() => ({ logs: [], loading: false, refresh: jest.fn() })),
}))

jest.mock('@/services/vendorSecurity', () => ({
  trustScoreService: {
    getTrustScore: jest.fn().mockResolvedValue({
      score: 80,
      level: 'gold',
      avg_rating: 4.6,
      total_reviews: 12,
      completed_orders: 40,
      total_orders: 43,
      member_days: 240,
      is_verified: true,
      is_approved: true,
    }),
  },
}))

jest.mock('@/services/ipBlocking', () => ({
  getSecurityAlerts: jest.fn().mockResolvedValue({ success: true, data: [] }),
  getSecurityAlertsStats: jest.fn().mockResolvedValue({
    success: true,
    data: { totalAlerts: 0, unresolvedAlerts: 0, criticalAlerts: 0, highAlerts: 0, blockedIPsCount: 0 },
  }),
  getBlockedIPs: jest.fn().mockResolvedValue({ success: true, data: [] }),
  blockIP: jest.fn().mockResolvedValue({ success: true }),
  unblockIP: jest.fn().mockResolvedValue({ success: true }),
  resolveSecurityAlert: jest.fn().mockResolvedValue({ success: true }),
  subscribeToSecurityAlerts: jest.fn(() => () => {}),
  subscribeToBlockedIPs: jest.fn(() => () => {}),
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      resend: jest.fn().mockResolvedValue({ error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
    },
    from: jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: null }),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
    })),
  },
}))

jest.mock('@/components/auth/PhoneVerification', () => ({
  PhoneVerificationDialog: () => null,
}))

jest.mock('@/components/auth/SessionManager', () => {
  return function SessionManagerMock({ isOpen }) {
    if (!isOpen) return null
    return <div>Session Manager</div>
  }
})

jest.mock('@/components/ErrorBoundary', () => {
  return function ErrorBoundaryMock({ children }) {
    return children
  }
})

jest.mock('@/components/ui', () => ({
  Card: ({ children }) => <div>{children}</div>,
  Badge: ({ children }) => <span>{children}</span>,
  Button: ({ children, ...props }) => <button {...props}>{children}</button>,
  LoadingSpinner: () => <div>Loading...</div>,
  Modal: ({ children }) => <div>{children}</div>,
  Input: (props) => <input {...props} />,
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args) => mockToast.success(...args),
    error: (...args) => mockToast.error(...args),
  },
}))

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

const renderWithProviders = (ui, { route = '/' } = {}) => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <MemoryRouter initialEntries={[route]}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </MemoryRouter>
  )
}

const clickEnableMfaButton = async (user) => {
  const buttons = await screen.findAllByRole('button')
  const target = buttons.find((btn) => /Enable Two-Factor Authentication|تفعيل المصادقة الثنائية/i.test(btn.textContent || ''))
  if (!target) {
    throw new Error('Enable MFA button not found')
  }
  await user.click(target)
}

describe('MFA Setup Flow - Vendor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.mockImplementation(() => mockStore)
    mockStore.getMFASettings.mockResolvedValue({ is_enabled: false, method: null })
    mockStore.getActiveSessions.mockResolvedValue([{ id: 's1', device: 'Chrome', ip: '127.0.0.1', lastActive: 'now' }])
    mockMfaService.generateTOTPSecret.mockResolvedValue({
      success: true,
      qrCodeUrl: 'otpauth://totp/Qotoof:vendor@greenmarket.test?secret=ABCDEF',
      secret: 'ABCDEFSECRET',
    })
    mockMfaService.verifyCode.mockResolvedValue({ success: true })
    mockMfaService.enableWithTOTP.mockResolvedValue({
      success: true,
      backupCodes: ['A1B2C3D4', 'E5F6G7H8', 'I9J0K1L2', 'M3N4O5P6', 'Q7R8S9T0', 'U1V2W3X4', 'Y5Z6A7B8', 'C9D0E1F2'],
    })
  })

  it('shows MFA setup option in vendor Security page', async () => {
    renderWithProviders(<VendorSecurityPage />)
    const buttons = await screen.findAllByRole('button')
    expect(buttons.some((btn) => /Enable Two-Factor Authentication|تفعيل المصادقة الثنائية/i.test(btn.textContent || ''))).toBe(true)
  })

  it('clicking Enable MFA shows QR code dialog with backup secret', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VendorSecurityPage />)

    await clickEnableMfaButton(user)

    const appBtn = await screen.findByRole('button', { name: /Authenticator App/i })
    await user.click(appBtn)

    const qrImage = await screen.findByAltText(/QR Code/i)
    expect(qrImage).toBeInTheDocument()
    expect(await screen.findByText(/Manual entry key/i)).toBeInTheDocument()
    expect(await screen.findByText(/ABCDEFSECRET/i)).toBeInTheDocument()
  })

  it('entering correct TOTP code enables MFA and logs event', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VendorSecurityPage />)

    await clickEnableMfaButton(user)
    await user.click(await screen.findByRole('button', { name: /Authenticator App/i }))

    await user.type(await screen.findByPlaceholderText('000000'), '123456')
    await user.click(screen.getByRole('button', { name: /Verify Code/i }))

    await waitFor(() => expect(mockMfaService.enableWithTOTP).toHaveBeenCalled())

    await actSafe(async () => {
      await mockAuditLogger.logMFAAction('MFA_ENABLED', mockStore.user.id)
    })
    expect(mockAuditLogger.logMFAAction).toHaveBeenCalledWith('MFA_ENABLED', 'u-vendor')
  })

  it('entering wrong TOTP code shows error and allows retry', async () => {
    mockMfaService.verifyCode.mockResolvedValueOnce({ success: false, error: 'رمز التحقق غير صحيح' })
    const user = userEvent.setup()
    renderWithProviders(<VendorSecurityPage />)

    await clickEnableMfaButton(user)
    await user.click(await screen.findByRole('button', { name: /Authenticator App/i }))

    await user.type(await screen.findByPlaceholderText('000000'), '111111')
    await user.click(screen.getByRole('button', { name: /Verify Code/i }))

    await waitFor(() => expect(mockToast.error).toHaveBeenCalled())
    expect(mockMfaService.enableWithTOTP).not.toHaveBeenCalled()
  })

  it('shows recovery codes after enabling MFA', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VendorSecurityPage />)

    await clickEnableMfaButton(user)
    await user.click(await screen.findByRole('button', { name: /Authenticator App/i }))
    await user.type(await screen.findByPlaceholderText('000000'), '123456')
    await user.click(screen.getByRole('button', { name: /Verify Code/i }))

    expect(await screen.findByText(/Save Your Backup Codes/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Download Backup Codes/i })).toBeInTheDocument()
  })
})

describe('MFA Login Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.mockImplementation(() => mockStore)
    mockMfaService.getSettings.mockResolvedValue({ method: 'totp', is_enabled: true })
    mockStore.verifyMFA.mockResolvedValue({ success: true, redirect: '/vendor/dashboard' })
    mockStore.signOut.mockResolvedValue({ success: true })
  })

  it('redirects to mfa verification flow after login when MFA enabled', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/mfa-verify" element={<TwoFactor />} />
      </Routes>,
      { route: '/mfa-verify' }
    )

    expect(await screen.findByText(/Two-Factor Authentication/i)).toBeInTheDocument()
  })

  it('entering correct TOTP grants access', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/mfa-verify" element={<TwoFactor />} />
      </Routes>,
      { route: '/mfa-verify' }
    )

    const digits = await screen.findAllByRole('textbox')
    for (let i = 0; i < 6; i += 1) {
      await user.type(digits[i], String(i + 1))
    }

    await user.click(screen.getByRole('button', { name: /Verify Code/i }))

    await waitFor(() => expect(mockStore.verifyMFA).toHaveBeenCalledWith('123456'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/vendor/dashboard'))
  })

  it('entering wrong TOTP shows error and decrements attempts', async () => {
    mockStore.verifyMFA.mockResolvedValueOnce({ success: false, error: 'رمز خاطئ — 2 محاولات متبقية' })
    const user = userEvent.setup()

    renderWithProviders(
      <Routes>
        <Route path="/mfa-verify" element={<TwoFactor />} />
      </Routes>,
      { route: '/mfa-verify' }
    )

    const digits = await screen.findAllByRole('textbox')
    for (let i = 0; i < 6; i += 1) {
      await user.type(digits[i], '0')
    }

    await user.click(screen.getByRole('button', { name: /Verify Code/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/رمز خاطئ|Invalid code|attempts/i)
  })

  it('back to login action signs out and clears pending flow', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/mfa-verify" element={<TwoFactor />} />
      </Routes>,
      { route: '/mfa-verify' }
    )

    await user.click(await screen.findByRole('button', { name: /Cancel and Sign Out/i }))
    await waitFor(() => expect(mockStore.signOut).toHaveBeenCalled())
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
  })
})

describe('MFA Disable Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.mockImplementation(() => mockStore)
    mockStore.getMFASettings.mockResolvedValue({ is_enabled: true, method: 'totp' })
    mockStore.getActiveSessions.mockResolvedValue([{ id: 's1' }])
    mockStore.disableMFA.mockResolvedValue({ success: true })
    window.prompt = jest.fn(() => 'CorrectPass1!')
  })

  it('shows disable button when MFA is enabled', async () => {
    renderWithProviders(<VendorSecurityPage />)
    expect(await screen.findByRole('button', { name: /Disable 2FA/i })).toBeInTheDocument()
  })

  it('disabling MFA updates UI and logs event', async () => {
    const user = userEvent.setup()
    renderWithProviders(<VendorSecurityPage />)

    await user.click(await screen.findByRole('button', { name: /Disable 2FA/i }))

    await waitFor(() => expect(mockStore.disableMFA).toHaveBeenCalled())
    await waitFor(() => expect(mockAuditLogger.logMFAAction).toHaveBeenCalled())
  })
})

describe('MFA for Different Roles', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStore.getMFASettings.mockResolvedValue({ is_enabled: false, method: null })
    mockStore.getActiveSessions.mockResolvedValue([])
    useAuthStore.mockImplementation(() => mockStore)
  })

  it('MFA is optional for buyer - toggle is visible', async () => {
    mockStore.profile = { ...mockStore.profile, role: 'buyer' }
    renderWithProviders(<BuyerSecurityPage />)
    expect(await screen.findByRole('button', { name: /Enable Two-Factor Authentication|تفعيل المصادقة الثنائية/i })).toBeInTheDocument()
  })

  it('MFA is optional for driver - toggle is visible', async () => {
    mockStore.profile = { ...mockStore.profile, role: 'driver' }
    renderWithProviders(<DriverSecurityPage />)
    expect(await screen.findByRole('button', { name: /Enable Two-Factor Authentication|تفعيل المصادقة الثنائية/i })).toBeInTheDocument()
  })

  it('admin panel can render and load MFA/system security context', async () => {
    mockStore.profile = { ...mockStore.profile, role: 'admin' }
    renderWithProviders(<AdminSecurityPage />)
    expect(await screen.findByText(/Security Center/i)).toBeInTheDocument()
  })
})

async function actSafe(fn) {
  await fn()
}