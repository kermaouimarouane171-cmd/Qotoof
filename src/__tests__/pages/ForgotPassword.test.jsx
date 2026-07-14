import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ForgotPasswordPage from '@/pages/auth/ForgotPassword'

const mockResetPassword = jest.fn()
const mockToast = { success: jest.fn(), error: jest.fn() }

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn((selector) => selector({
    resetPassword: (...args) => mockResetPassword(...args),
  })),
}))

jest.mock('@/components/ui', () => ({
  __esModule: true,
  Input: ({ label, value, onChange, type, name, ...props }) => (
    <label>
      {label}
      <input type={type} name={name} value={value} onChange={onChange} {...props} />
    </label>
  ),
  Button: ({ children, onClick, isLoading, disabled, type, ...props }) => (
    <button type={type || 'button'} onClick={onClick} disabled={disabled || isLoading} {...props}>
      {isLoading ? 'جاري التحميل...' : children}
    </button>
  ),
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args) => mockToast.success(...args),
    error: (...args) => mockToast.error(...args),
  },
}))

jest.mock('@/utils/validationSchemas', () => ({
  passwordResetSchema: {
    safeParse: (data) => {
      const email = (data?.email || '').trim().toLowerCase()
      const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      return valid
        ? { success: true, data: { email } }
        : { success: false, error: { issues: [{ message: 'Invalid email address' }] } }
    },
  },
}))

const renderPage = () =>
  render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>
  )

describe('ForgotPassword page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockResetPassword.mockResolvedValue({ success: true })
  })

  it('renders form with email input and submit button', () => {
    renderPage()
    expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument()
    expect(screen.getByTestId('forgot-password-email-input')).toBeInTheDocument()
    expect(screen.getByTestId('forgot-password-submit-button')).toBeInTheDocument()
  })

  it('shows success message after valid email submission', async () => {
    renderPage()

    fireEvent.change(screen.getByTestId('forgot-password-email-input'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.submit(screen.getByTestId('forgot-password-form'))

    await waitFor(() => {
      expect(mockResetPassword).toHaveBeenCalledWith('test@example.com')
      expect(screen.getByTestId('forgot-password-success')).toBeInTheDocument()
    })
  })

  it('shows error for invalid email', async () => {
    renderPage()

    fireEvent.change(screen.getByTestId('forgot-password-email-input'), {
      target: { value: 'invalid-email' },
    })
    fireEvent.submit(screen.getByTestId('forgot-password-form'))

    await waitFor(() => {
      expect(screen.getByTestId('forgot-password-error')).toBeInTheDocument()
      expect(mockResetPassword).not.toHaveBeenCalled()
    })
  })

  it('shows rate limit error when rate limited', async () => {
    mockResetPassword.mockResolvedValue({
      success: false,
      rateLimited: true,
      message: 'محاولات كثيرة، يرجى المحاولة لاحقًا',
    })

    renderPage()

    fireEvent.change(screen.getByTestId('forgot-password-email-input'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.submit(screen.getByTestId('forgot-password-form'))

    await waitFor(() => {
      expect(screen.getByTestId('forgot-password-error')).toHaveTextContent('محاولات كثيرة')
      expect(screen.queryByTestId('forgot-password-success')).not.toBeInTheDocument()
    })
  })

  it('shows success even on non-rate-limit failure (anti-enumeration)', async () => {
    mockResetPassword.mockResolvedValue({ success: false })

    renderPage()

    fireEvent.change(screen.getByTestId('forgot-password-email-input'), {
      target: { value: 'unknown@example.com' },
    })
    fireEvent.submit(screen.getByTestId('forgot-password-form'))

    await waitFor(() => {
      expect(screen.getByTestId('forgot-password-success')).toBeInTheDocument()
    })
  })

  it('clears error when typing in email field', async () => {
    renderPage()

    fireEvent.change(screen.getByTestId('forgot-password-email-input'), {
      target: { value: 'bad' },
    })
    fireEvent.submit(screen.getByTestId('forgot-password-form'))

    await waitFor(() => {
      expect(screen.getByTestId('forgot-password-error')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('forgot-password-email-input'), {
      target: { value: 'test@example.com' },
    })

    expect(screen.queryByTestId('forgot-password-error')).not.toBeInTheDocument()
  })

  it('shows loading state during submission', async () => {
    mockResetPassword.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100)))

    renderPage()

    fireEvent.change(screen.getByTestId('forgot-password-email-input'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.submit(screen.getByTestId('forgot-password-form'))

    expect(screen.getByTestId('forgot-password-submit-button')).toBeDisabled()
  })
})
