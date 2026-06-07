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
    })),
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
  Button: ({ children, onClick, isLoading, disabled, variant, className, ...props }) => (
    <button
      type="button"
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
  })

  it('allows entering only numeric 6-digit code', async () => {
    renderPage({ email: 'test@example.ma' })

    const input = screen.getByTestId('verify-email-otp-input')
    fireEvent.change(input, { target: { value: 'abc123def' } })
    expect(input.value).toBe('123')

    fireEvent.change(input, { target: { value: '1234567' } })
    expect(input.value).toBe('123456')
  })

  it('calls verifyOtp and navigates on successful verification', async () => {
    renderPage({ email: 'test@example.ma' })

    const input = screen.getByTestId('verify-email-otp-input')
    fireEvent.change(input, { target: { value: '654321' } })

    fireEvent.click(screen.getByTestId('verify-email-verify-button'))

    await waitFor(() => {
      expect(mockSupabaseAuth.verifyOtp).toHaveBeenCalledWith({
        email: 'test@example.ma',
        token: '654321',
        type: 'signup',
      })
    })

    await waitFor(() => {
      expect(mockAuthState.initialize).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith('/marketplace', { replace: true })
      expect(mockToast.success).toHaveBeenCalledWith('تم تأكيد البريد الإلكتروني بنجاح')
    })
  })

  it('shows error when verifyOtp fails', async () => {
    mockSupabaseAuth.verifyOtp.mockResolvedValue({
      error: { message: 'Token has expired or is invalid' },
    })

    renderPage({ email: 'test@example.ma' })

    const input = screen.getByTestId('verify-email-otp-input')
    fireEvent.change(input, { target: { value: '000000' } })

    fireEvent.click(screen.getByTestId('verify-email-verify-button'))

    await waitFor(() => {
      expect(screen.getByTestId('verify-email-error')).toHaveTextContent('Token has expired or is invalid')
    })
  })

  it('calls resend on button click', async () => {
    renderPage({ email: 'test@example.ma' })

    fireEvent.click(screen.getByTestId('verify-email-resend-button'))

    await waitFor(() => {
      expect(mockSupabaseAuth.resend).toHaveBeenCalledWith({
        type: 'signup',
        email: 'test@example.ma',
      })
      expect(mockToast.success).toHaveBeenCalledWith('تم إرسال رمز التحقق مرة أخرى')
    })
  })

  it('disables verify button when OTP is not 6 digits', async () => {
    renderPage({ email: 'test@example.ma' })

    const verifyButton = screen.getByTestId('verify-email-verify-button')
    expect(verifyButton).toBeDisabled()

    const input = screen.getByTestId('verify-email-otp-input')
    fireEvent.change(input, { target: { value: '12345' } })
    expect(verifyButton).toBeDisabled()

    fireEvent.change(input, { target: { value: '123456' } })
    expect(verifyButton).not.toBeDisabled()
  })

  it('clears error when user types a new OTP after failed verification', async () => {
    mockSupabaseAuth.verifyOtp.mockResolvedValue({
      error: { message: 'رمز التحقق غير صحيح' },
    })

    renderPage({ email: 'test@example.ma' })

    const input = screen.getByTestId('verify-email-otp-input')
    fireEvent.change(input, { target: { value: '000000' } })
    fireEvent.click(screen.getByTestId('verify-email-verify-button'))

    await screen.findByTestId('verify-email-error')

    fireEvent.change(input, { target: { value: '000001' } })
    expect(screen.queryByTestId('verify-email-error')).not.toBeInTheDocument()
  })
})
