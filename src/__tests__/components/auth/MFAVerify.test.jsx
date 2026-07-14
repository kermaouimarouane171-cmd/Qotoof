import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MFAVerify from '@/components/auth/MFAVerify'

const mockNavigate = jest.fn()
const mockSignOut = jest.fn()
const mockVerifyMFA = jest.fn()

const mockAuthStore = {
  user: { id: 'user-123', email: 'test@example.com' },
  verifyMFA: (...args) => mockVerifyMFA(...args),
  signOut: (...args) => mockSignOut(...args),
}

const mockMfaService = {
  getSettings: jest.fn(),
}

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(() => mockAuthStore),
}))

jest.mock('@/services/authServices', () => ({
  mfaService: {
    getSettings: (...args) => mockMfaService.getSettings(...args),
  },
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      resend: jest.fn(),
    },
    rpc: jest.fn().mockResolvedValue({ data: '123456', error: null }),
  },
}))

jest.mock('@/services/emailService', () => ({
  emailService: {
    sendOTP: jest.fn().mockResolvedValue({ success: true }),
  },
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, fallback, vars) => {
      const template = typeof fallback === 'string' ? fallback : key
      return Object.entries(vars || {}).reduce(
        (acc, [k, v]) => acc.replace(new RegExp(`{{${k}}}`, 'g'), v),
        template
      )
    },
    i18n: { language: 'en', changeLanguage: jest.fn() },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}))

const renderComponent = () => {
  return render(
    <MemoryRouter>
      <MFAVerify />
    </MemoryRouter>
  )
}

const fillCode = () => {
  const inputs = screen.getAllByRole('textbox')
  inputs.forEach((input, index) => {
    fireEvent.change(input, { target: { value: String(index + 1) } })
  })
}

describe('MFAVerify', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMfaService.getSettings.mockResolvedValue({
      is_enabled: true,
      method: 'email',
      failed_attempts: 0,
      locked_until: null,
    })
  })

  it('renders and fetches MFA settings from the server', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/Two-Factor Authentication/i)).toBeInTheDocument()
    })

    expect(mockMfaService.getSettings).toHaveBeenCalled()
  })

  it('shows server-side lockout and disables the form', async () => {
    const lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    mockMfaService.getSettings.mockResolvedValue({
      is_enabled: true,
      method: 'email',
      failed_attempts: 5,
      locked_until: lockedUntil,
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/Account locked/i)).toBeInTheDocument()
    })

    const submitButton = screen.getByRole('button', { name: /Verify Code/i })
    expect(submitButton).toBeDisabled()
    expect(mockVerifyMFA).not.toHaveBeenCalled()
  })

  it('calls verifyMFA and displays server-provided attempts remaining', async () => {
    mockVerifyMFA.mockResolvedValue({
      success: false,
      attemptsRemaining: 2,
      error: 'Invalid or expired code',
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/Enter the 6-digit code/i)).toBeInTheDocument()
    })

    fillCode()
    fireEvent.click(screen.getByRole('button', { name: /Verify Code/i }))

    await waitFor(() => {
      expect(mockVerifyMFA).toHaveBeenCalledWith('123456', 'email')
      // After i18n fix, the component translates errors. The mock error contains
      // 'expired' so the expiredCode path is used.
      expect(screen.getByText(/expired/i)).toBeInTheDocument()
      // The UI shows attempts remaining; exact interpolation depends on i18n resources.
      expect(screen.getByText(/Attempts remaining/i)).toBeInTheDocument()
    })
  })

  it('shows server-side lockout and disables the form after the server locks the account', async () => {
    const lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString()
    mockVerifyMFA.mockResolvedValue({
      success: false,
      locked: true,
      lockedUntil,
      retryAfter: 900,
      error: 'Too many attempts. Account locked. Please try again later.',
    })

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText(/Enter the 6-digit code/i)).toBeInTheDocument()
    })

    fillCode()
    fireEvent.click(screen.getByRole('button', { name: /Verify Code/i }))

    await waitFor(() => {
      expect(mockVerifyMFA).toHaveBeenCalledWith('123456', 'email')
      expect(screen.getByText(/Too many attempts/i)).toBeInTheDocument()
    })

    const submitButton = screen.getByRole('button', { name: /Verify Code/i })
    expect(submitButton).toBeDisabled()
  })
})
