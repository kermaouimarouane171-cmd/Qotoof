import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import VerifyEmailPage from '@/pages/auth/VerifyEmail'

const mockNavigate = jest.fn()
const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
}

const mockAuthState = {
  initialize: jest.fn().mockResolvedValue(undefined),
  getRedirectPath: jest.fn().mockReturnValue('/marketplace'),
}

const mockSupabaseAuth = {
  verifyOtp: jest.fn(),
  resend: jest.fn(),
  onAuthStateChange: jest.fn().mockReturnValue({
    subscription: { unsubscribe: jest.fn() },
  }),
}

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

jest.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(jest.fn((selector) => selector(mockAuthState)), {
    getState: jest.fn(() => ({
      profile: { role: 'buyer' },
      getRedirectPath: (role) =>
        role === 'vendor' ? '/vendor/dashboard' : role === 'driver' ? '/driver/dashboard' : '/marketplace',
    })),
    setState: jest.fn(),
  }),
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      verifyOtp: (...args) => mockSupabaseAuth.verifyOtp(...args),
      resend: (...args) => mockSupabaseAuth.resend(...args),
      onAuthStateChange: (...args) => mockSupabaseAuth.onAuthStateChange(...args),
    },
  },
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args) => mockToast.success(...args),
    error: (...args) => mockToast.error(...args),
  },
}))

jest.mock('@/components/ui', () => ({
  __esModule: true,
  Button: ({ children, onClick, isLoading, disabled, variant, type, className, ...props }) => (
    <button
      type={type || 'button'}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={className}
      {...props}
    >
      {isLoading ? 'جاري التحميل...' : children}
    </button>
  ),
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}))

const renderPage = (initialState = {}) => {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/verify-email', state: initialState }]}>
      <VerifyEmailPage />
    </MemoryRouter>
  )
}

describe('VerifyEmail OTP page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    sessionStorage.clear()
    mockSupabaseAuth.verifyOtp.mockResolvedValue({ error: null })
    mockSupabaseAuth.resend.mockResolvedValue({ error: null })
  })

  it('renders OTP input and verify button', async () => {
    renderPage({ email: 'test@example.ma' })

    expect(screen.getByTestId('verify-email-page')).toBeInTheDocument()
    expect(screen.getByTestId('verify-email-otp-input')).toBeInTheDocument()
    expect(screen.getByTestId('verify-email-verify-button')).toBeInTheDocument()
    expect(screen.getByTestId('verify-email-resend-button')).toBeInTheDocument()
    expect(screen.getByTestId('verify-email-address')).toHaveTextContent('test@example.ma')
    expect(screen.getByTestId('verify-email-login-link')).toBeInTheDocument()
    expect(screen.getByTestId('verify-email-register-link')).toBeInTheDocument()
  })

  it('does not show confirmation link as the main instruction', async () => {
    renderPage({ email: 'test@example.ma' })

    expect(screen.queryByText(/اضغط على الرابط/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/click the link/i)).not.toBeInTheDocument()
    expect(screen.getByText(/رمز التحقق/i)).toBeInTheDocument()
  })

  it('calls verifyOtp with valid code and redirects to role path', async () => {
    renderPage({ email: 'test@example.ma', redirectPath: '/marketplace' })

    fireEvent.change(screen.getByTestId('verify-email-otp-input'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByTestId('verify-email-verify-button'))

    await waitFor(() => {
      expect(mockSupabaseAuth.verifyOtp).toHaveBeenCalledWith({
        email: 'test@example.ma',
        token: '123456',
        type: 'signup',
      })
      expect(mockAuthState.initialize).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('تم التحقق من البريد بنجاح')
      expect(mockNavigate).toHaveBeenCalledWith('/marketplace', { replace: true })
    })
  })

  it('falls back to getRedirectPath when redirectPath is not provided', async () => {
    renderPage({ email: 'test@example.ma' })

    fireEvent.change(screen.getByTestId('verify-email-otp-input'), {
      target: { value: '654321' },
    })
    fireEvent.click(screen.getByTestId('verify-email-verify-button'))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/marketplace', { replace: true })
    })
  })

  it('shows error when OTP verification fails', async () => {
    mockSupabaseAuth.verifyOtp.mockResolvedValue({
      error: { message: 'Token has expired or is invalid' },
    })

    renderPage({ email: 'test@example.ma' })

    fireEvent.change(screen.getByTestId('verify-email-otp-input'), {
      target: { value: '000000' },
    })
    fireEvent.click(screen.getByTestId('verify-email-verify-button'))

    await waitFor(() => {
      expect(screen.getByTestId('verify-email-error')).toHaveTextContent('Token has expired or is invalid')
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  it('only allows numeric input of max 6 characters', async () => {
    renderPage({ email: 'test@example.ma' })

    const input = screen.getByTestId('verify-email-otp-input')
    fireEvent.change(input, { target: { value: 'abc123456' } })

    expect(input).toHaveValue('123456')
  })

  it('calls resend on button click', async () => {
    renderPage({ email: 'test@example.ma' })

    fireEvent.click(screen.getByTestId('verify-email-resend-button'))

    await waitFor(() => {
      expect(mockSupabaseAuth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'test@example.ma',
      })
      expect(mockToast.success).toHaveBeenCalledWith('تم إعادة إرسال رمز التحقق')
    })
  })

  it('shows rate-limit error when resend fails', async () => {
    mockSupabaseAuth.resend.mockResolvedValue({
      error: { message: 'For security purposes, you can only request this after 60 seconds' },
    })

    renderPage({ email: 'test@example.ma' })

    fireEvent.click(screen.getByTestId('verify-email-resend-button'))

    await waitFor(() => {
      expect(screen.getByTestId('verify-email-resend-error')).toHaveTextContent(
        'For security purposes, you can only request this after 60 seconds'
      )
    })
  })

  it('disables resend button during countdown', async () => {
    renderPage({ email: 'test@example.ma' })

    fireEvent.click(screen.getByTestId('verify-email-resend-button'))

    await waitFor(() => {
      expect(mockSupabaseAuth.resend).toHaveBeenCalled()
    })

    expect(screen.getByTestId('verify-email-resend-button')).toBeDisabled()
  })

  it('does not auto-redirect on mount (anti-loop guard)', async () => {
    renderPage({ email: 'test@example.ma' })

    expect(screen.getByTestId('verify-email-page')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockAuthState.initialize).not.toHaveBeenCalled()
  })

  it('reads email and redirectPath from sessionStorage when location state is empty', async () => {
    sessionStorage.setItem('pendingVerificationEmail', 'stored@example.ma')
    sessionStorage.setItem('redirect_after_verification', '/vendor/dashboard')

    renderPage({})

    expect(screen.getByTestId('verify-email-address')).toHaveTextContent('stored@example.ma')

    fireEvent.change(screen.getByTestId('verify-email-otp-input'), {
      target: { value: '111111' },
    })
    fireEvent.click(screen.getByTestId('verify-email-verify-button'))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/vendor/dashboard', { replace: true })
    })
  })

  it('shows safe state when email is missing', async () => {
    renderPage({})

    expect(screen.getByTestId('verify-email-page')).toBeInTheDocument()
    expect(screen.queryByTestId('verify-email-otp-input')).not.toBeInTheDocument()
    expect(screen.getByText('لا يوجد تحقق معلق من البريد الإلكتروني')).toBeInTheDocument()
    expect(screen.getByTestId('verify-email-register-link')).toBeInTheDocument()
    expect(screen.getByTestId('verify-email-login-link')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
