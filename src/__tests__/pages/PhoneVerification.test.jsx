import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PhoneVerification from '@/components/auth/PhoneVerification'

const mockNavigate = jest.fn()
const mockSendPhoneOTP = jest.fn()
const mockVerifyPhoneOTP = jest.fn()
const mockToast = { success: jest.fn(), error: jest.fn() }

const mockAuthState = {
  user: { id: 'user-123' },
  profile: { phone: '+212600000000' },
  loading: false,
}

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Navigate: ({ to }) => <div data-testid="navigate-redirect" data-to={to} />,
  }
})

jest.mock('@/store/authStore', () => ({
  useAuthStore: Object.assign(
    jest.fn((selector) => (typeof selector === 'function' ? selector(mockAuthState) : mockAuthState)),
    { setState: jest.fn() },
  ),
}))

jest.mock('@/services/phoneOtpService', () => ({
  sendPhoneOTP: (...args) => mockSendPhoneOTP(...args),
  verifyPhoneOTP: (...args) => mockVerifyPhoneOTP(...args),
  getPendingPhoneVerification: jest.fn(() => null),
  clearPendingPhoneVerification: jest.fn(),
  maskPhoneNumber: jest.fn((phone) => phone ? `***${phone.slice(-4)}` : ''),
}))

jest.mock('@/components/ui', () => ({
  __esModule: true,
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args) => mockToast.success(...args),
    error: (...args) => mockToast.error(...args),
  },
}))

jest.mock('@heroicons/react/24/outline', () => ({
  ArrowPathIcon: () => <svg data-testid="arrow-icon" />,
  XMarkIcon: () => <svg data-testid="x-icon" />,
}))

const renderComponent = (props = {}) =>
  render(
    <MemoryRouter>
      <PhoneVerification
        userId="user-123"
        phone="+212600000000"
        purpose="registration"
        successPath="/marketplace"
        {...props}
      />
    </MemoryRouter>
  )

describe('PhoneVerification component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSendPhoneOTP.mockResolvedValue({})
    mockVerifyPhoneOTP.mockResolvedValue({ phone: '+212600000000' })
  })

  it('renders OTP input fields and verify button', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('تأكيد')).toBeInTheDocument()
    })
    const inputs = document.querySelectorAll('input[type="text"][inputmode="numeric"]')
    expect(inputs.length).toBe(6)
  })

  it('auto-sends OTP on mount', async () => {
    renderComponent()

    await waitFor(() => {
      expect(mockSendPhoneOTP).toHaveBeenCalledWith('user-123', '+212600000000', 'registration')
    })
  })

  it('shows error when no phone or userId', async () => {
    mockAuthState.user = null
    mockAuthState.profile = null
    renderComponent({ userId: null, phone: null })

    await waitFor(() => {
      expect(screen.getByTestId('navigate-redirect')).toBeInTheDocument()
    })
    mockAuthState.user = { id: 'user-123' }
    mockAuthState.profile = { phone: '+212600000000' }
  })

  it('verifies OTP and navigates on success', async () => {
    renderComponent()

    await waitFor(() => {
      expect(mockSendPhoneOTP).toHaveBeenCalled()
    })

    const inputs = document.querySelectorAll('input[type="text"][inputmode="numeric"]')
    for (let i = 0; i < 6; i++) {
      fireEvent.change(inputs[i], { target: { value: String(i + 1) } })
    }

    fireEvent.click(screen.getByText('تأكيد'))

    await waitFor(() => {
      expect(mockVerifyPhoneOTP).toHaveBeenCalledWith('user-123', '+212600000000', '123456', 'registration')
      expect(mockNavigate).toHaveBeenCalledWith('/marketplace', { replace: true })
    })
  })

  it('shows error when OTP verification fails', async () => {
    mockVerifyPhoneOTP.mockRejectedValue(new Error('Invalid code'))

    renderComponent()

    await waitFor(() => {
      expect(mockSendPhoneOTP).toHaveBeenCalled()
    })

    const inputs = document.querySelectorAll('input[type="text"][inputmode="numeric"]')
    for (let i = 0; i < 6; i++) {
      fireEvent.change(inputs[i], { target: { value: '0' } })
    }

    fireEvent.click(screen.getByText('تأكيد'))

    await waitFor(() => {
      expect(screen.getByText('Invalid code')).toBeInTheDocument()
    })
  })

  it('shows error for incomplete OTP', async () => {
    renderComponent()

    await waitFor(() => {
      expect(mockSendPhoneOTP).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByText('تأكيد'))

    await waitFor(() => {
      expect(screen.getByText(/أدخل رمز التحقق كاملاً/i)).toBeInTheDocument()
    })
  })

  it('calls onVerified callback when provided', async () => {
    const onVerified = jest.fn()
    renderComponent({ onVerified })

    await waitFor(() => {
      expect(mockSendPhoneOTP).toHaveBeenCalled()
    })

    const inputs = document.querySelectorAll('input[type="text"][inputmode="numeric"]')
    for (let i = 0; i < 6; i++) {
      fireEvent.change(inputs[i], { target: { value: '1' } })
    }

    fireEvent.click(screen.getByText('تأكيد'))

    await waitFor(() => {
      expect(onVerified).toHaveBeenCalled()
    })
  })
})
