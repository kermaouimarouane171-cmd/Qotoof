import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ResetPasswordPage from '@/pages/auth/ResetPassword'

const mockUpdatePassword = jest.fn()
const mockNavigate = jest.fn()
const mockSupabaseOnAuthStateChange = jest.fn()

const mockAuthState = {
  updatePassword: (...args) => mockUpdatePassword(...args),
  loading: false,
  passwordRecoveryMode: false,
}

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
  }
})

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key, fallback) => fallback }),
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn((selector) => selector(mockAuthState)),
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (...args) => mockSupabaseOnAuthStateChange(...args),
    },
  },
}))

jest.mock('@/components/ui', () => ({
  __esModule: true,
  Input: ({ label, value, onChange, type, name, 'data-cy': dataCy, ...props }) => (
    <label>
      {label}
      <input type={type} name={name} value={value} onChange={onChange} data-cy={dataCy} data-testid={dataCy} {...props} />
    </label>
  ),
  Button: ({ children, onClick, isLoading, disabled, type, 'data-cy': dataCy, ...props }) => (
    <button type={type || 'button'} onClick={onClick} disabled={disabled || isLoading} data-cy={dataCy} data-testid={dataCy} {...props}>
      {isLoading ? 'جاري التحميل...' : children}
    </button>
  ),
  LoadingSpinner: () => <div data-testid="loading-spinner">جارٍ التحميل...</div>,
}))

jest.mock('@/components/auth/AuthCard', () => ({
  __esModule: true,
  default: ({ children }) => <div data-testid="auth-card">{children}</div>,
}))

jest.mock('@/components/auth/AuthHeader', () => ({
  __esModule: true,
  default: ({ title, subtitle }) => (
    <div data-testid="auth-header">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </div>
  ),
}))

jest.mock('@/components/auth/AuthFooter', () => ({
  __esModule: true,
  default: ({ question, linkTo, linkText }) => (
    <p>{question} <a href={linkTo}>{linkText}</a></p>
  ),
}))

jest.mock('@/utils/validationSchemas', () => ({
  newPasswordSchema: {
    safeParse: (data) => {
      const { password, confirmPassword } = data || {}
      if (!password || password.length < 8) {
        return { success: false, error: { issues: [{ message: 'Password must be at least 8 characters' }] } }
      }
      if (password !== confirmPassword) {
        return { success: false, error: { issues: [{ message: 'Passwords do not match' }] } }
      }
      return { success: true, data: { password, confirmPassword } }
    },
  },
}))

const renderPage = () => {
  const utils = render(
    <MemoryRouter>
      <ResetPasswordPage />
    </MemoryRouter>
  )
  return utils
}

const getByCy = (container, cy) => container.querySelector(`[data-cy="${cy}"]`)

describe('ResetPassword page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUpdatePassword.mockResolvedValue({ success: true })
    mockAuthState.loading = false
    mockAuthState.passwordRecoveryMode = false
    mockSupabaseOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })
  })

  it('shows loading state when not recovery ready', () => {
    mockAuthState.loading = true
    renderPage()
    expect(screen.getByText(/جارٍ التحقق من الرابط/i)).toBeInTheDocument()
  })

  it('renders password form when recovery mode is active', () => {
    mockAuthState.passwordRecoveryMode = true
    const { container } = renderPage()

    expect(getByCy(container, 'reset-password-form')).toBeInTheDocument()
    expect(getByCy(container, 'reset-password-input')).toBeInTheDocument()
    expect(getByCy(container, 'reset-confirm-password-input')).toBeInTheDocument()
    expect(getByCy(container, 'reset-password-submit-button')).toBeInTheDocument()
  })

  it('calls updatePassword on valid submission', async () => {
    mockAuthState.passwordRecoveryMode = true
    const { container } = renderPage()

    fireEvent.change(getByCy(container, 'reset-password-input'), {
      target: { value: 'NewPassword123!' },
    })
    fireEvent.change(getByCy(container, 'reset-confirm-password-input'), {
      target: { value: 'NewPassword123!' },
    })
    fireEvent.submit(getByCy(container, 'reset-password-form'))

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith('NewPassword123!')
      expect(mockNavigate).toHaveBeenCalledWith('/login', expect.objectContaining({ replace: true }))
    })
  })

  it('shows error when passwords do not match', async () => {
    mockAuthState.passwordRecoveryMode = true
    const { container } = renderPage()

    fireEvent.change(getByCy(container, 'reset-password-input'), {
      target: { value: 'Password123!' },
    })
    fireEvent.change(getByCy(container, 'reset-confirm-password-input'), {
      target: { value: 'DifferentPass!' },
    })
    fireEvent.submit(getByCy(container, 'reset-password-form'))

    await waitFor(() => {
      expect(getByCy(container, 'reset-password-error')).toBeInTheDocument()
      expect(mockUpdatePassword).not.toHaveBeenCalled()
    })
  })

  it('shows error when updatePassword fails', async () => {
    mockAuthState.passwordRecoveryMode = true
    mockUpdatePassword.mockResolvedValue({ success: false, error: 'Failed to update' })

    const { container } = renderPage()

    fireEvent.change(getByCy(container, 'reset-password-input'), {
      target: { value: 'NewPassword123!' },
    })
    fireEvent.change(getByCy(container, 'reset-confirm-password-input'), {
      target: { value: 'NewPassword123!' },
    })
    fireEvent.submit(getByCy(container, 'reset-password-form'))

    await waitFor(() => {
      expect(getByCy(container, 'reset-password-error')).toHaveTextContent('Failed to update')
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  it('shows invalid link message after timeout', async () => {
    const { container } = renderPage()

    await waitFor(() => {
      expect(getByCy(container, 'reset-request-new-link')).toBeInTheDocument()
    }, { timeout: 12000 })
  }, 15000)
})
