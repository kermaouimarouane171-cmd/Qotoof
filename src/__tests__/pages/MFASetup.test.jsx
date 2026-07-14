import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import MFASetup from '@/components/auth/MFASetup'

const mockRefreshProfile = jest.fn()
const mockGenerateTOTPSecret = jest.fn()
const mockInitiateEmailMFA = jest.fn()
const mockVerifyEmailMFA = jest.fn()
const mockEnableWithTOTP = jest.fn()
const mockToast = { success: jest.fn(), error: jest.fn() }

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    refreshProfile: (...args) => mockRefreshProfile(...args),
  }),
}))

jest.mock('@/services/authServices', () => ({
  mfaService: {
    generateTOTPSecret: (...args) => mockGenerateTOTPSecret(...args),
    initiateEmailMFA: (...args) => mockInitiateEmailMFA(...args),
    verifyEmailMFA: (...args) => mockVerifyEmailMFA(...args),
    enableWithTOTP: (...args) => mockEnableWithTOTP(...args),
  },
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args) => mockToast.success(...args),
    error: (...args) => mockToast.error(...args),
  },
}))

const renderComponent = (props = {}) =>
  render(<MFASetup isOpen={true} onClose={jest.fn()} {...props} />)

describe('MFASetup component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGenerateTOTPSecret.mockResolvedValue({
      success: true,
      secret: 'JBSWY3DPEHPK3PXP',
      qrCodeUrl: 'otpauth://totp/Qotoof:test@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Qotoof',
    })
    mockInitiateEmailMFA.mockResolvedValue({ success: true })
    mockVerifyEmailMFA.mockResolvedValue({ success: true, backupCodes: ['12345678', '87654321'] })
    mockEnableWithTOTP.mockResolvedValue({
      success: true,
      backupCodes: ['12345678', '87654321'],
    })
  })

  it('renders null when isOpen is false', () => {
    const { container } = render(<MFASetup isOpen={false} onClose={jest.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders method selection on step 1', () => {
    renderComponent()
    expect(screen.getByText('Email Verification')).toBeInTheDocument()
    expect(screen.getByText('Authenticator App')).toBeInTheDocument()
  })

  it('initiates email MFA on email button click', async () => {
    renderComponent()

    fireEvent.click(screen.getByText('Email Verification'))

    await waitFor(() => {
      expect(mockInitiateEmailMFA).toHaveBeenCalled()
      expect(screen.getByText(/Enter the 6-digit code sent to your email/i)).toBeInTheDocument()
    })
  })

  it('verifies email OTP and shows backup codes', async () => {
    renderComponent()

    fireEvent.click(screen.getByText('Email Verification'))

    await waitFor(() => {
      expect(screen.getByText(/Enter the 6-digit code sent to your email/i)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('000000')
    fireEvent.change(input, { target: { value: '123456' } })
    fireEvent.click(screen.getByText('Verify Code'))

    await waitFor(() => {
      expect(mockVerifyEmailMFA).toHaveBeenCalledWith('123456')
      expect(mockRefreshProfile).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('Email MFA enabled successfully!')
      expect(screen.getByText('12345678')).toBeInTheDocument()
    })
  })

  it('generates TOTP secret and moves to step 2', async () => {
    renderComponent()

    fireEvent.click(screen.getByText('Authenticator App'))

    await waitFor(() => {
      expect(mockGenerateTOTPSecret).toHaveBeenCalled()
      expect(screen.getByText(/Scan this QR code/i)).toBeInTheDocument()
      expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument()
    })
  })

  it('verifies TOTP code and shows backup codes', async () => {
    renderComponent()

    fireEvent.click(screen.getByText('Authenticator App'))

    await waitFor(() => {
      expect(screen.getByText(/Scan this QR code/i)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('000000')
    fireEvent.change(input, { target: { value: '123456' } })
    fireEvent.click(screen.getByText('Verify Code'))

    await waitFor(() => {
      expect(mockEnableWithTOTP).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP', '123456')
      expect(screen.getByText('12345678')).toBeInTheDocument()
      expect(screen.getByText('87654321')).toBeInTheDocument()
    })
  })

  it('shows error when TOTP verification fails', async () => {
    mockEnableWithTOTP.mockResolvedValue({ success: false, error: 'Invalid code' })

    renderComponent()

    fireEvent.click(screen.getByText('Authenticator App'))

    await waitFor(() => {
      expect(screen.getByText(/Scan this QR code/i)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('000000')
    fireEvent.change(input, { target: { value: '000000' } })
    fireEvent.click(screen.getByText('Verify Code'))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Invalid code')
    })
  })

  it('disables verify button when code is incomplete', async () => {
    renderComponent()

    fireEvent.click(screen.getByText('Authenticator App'))

    await waitFor(() => {
      expect(screen.getByText(/Scan this QR code/i)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('000000')
    fireEvent.change(input, { target: { value: '12' } })

    const verifyButton = screen.getByText('Verify Code')
    expect(verifyButton).toBeDisabled()
  })

  it('shows error when generateTOTPSecret fails', async () => {
    mockGenerateTOTPSecret.mockResolvedValue({ success: false, error: 'Server error' })

    renderComponent()

    fireEvent.click(screen.getByText('Authenticator App'))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Server error')
    })
  })

  it('completes setup and calls onClose', async () => {
    const onClose = jest.fn()
    renderComponent({ onClose })

    // Use TOTP flow to reach step 3 (email requires OTP entry)
    fireEvent.click(screen.getByText('Authenticator App'))

    await waitFor(() => {
      expect(screen.getByText(/Scan this QR code/i)).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('000000')
    fireEvent.change(input, { target: { value: '123456' } })
    fireEvent.click(screen.getByText('Verify Code'))

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Done'))
    expect(onClose).toHaveBeenCalled()
  })
})
