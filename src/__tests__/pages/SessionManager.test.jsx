import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import SessionManager from '@/components/auth/SessionManager'

const mockGetActiveSessions = jest.fn()
const mockRevokeSession = jest.fn()
const mockRevokeAllOtherSessions = jest.fn()
const mockToast = { success: jest.fn(), error: jest.fn() }

jest.mock('@/services/authServices', () => ({
  sessionService: {
    getActiveSessions: (...args) => mockGetActiveSessions(...args),
    revokeSession: (...args) => mockRevokeSession(...args),
    revokeAllOtherSessions: (...args) => mockRevokeAllOtherSessions(...args),
  },
}))

jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn() },
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args) => mockToast.success(...args),
    error: (...args) => mockToast.error(...args),
  },
}))

const mockSessions = [
  {
    id: 'sess-1',
    is_current: true,
    device_info: { browser: 'Chrome', os: 'macOS', deviceType: 'desktop' },
    last_active: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'sess-2',
    is_current: false,
    device_info: { browser: 'Safari', os: 'iOS', deviceType: 'mobile' },
    last_active: new Date(Date.now() - 7200000).toISOString(),
    expires_at: new Date(Date.now() + 1800000).toISOString(),
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
]

const renderComponent = (props = {}) =>
  render(<SessionManager isOpen={true} onClose={jest.fn()} {...props} />)

describe('SessionManager component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetActiveSessions.mockResolvedValue(mockSessions)
    mockRevokeSession.mockResolvedValue({ success: true })
    mockRevokeAllOtherSessions.mockResolvedValue({ success: true })
  })

  it('renders null when isOpen is false', () => {
    const { container } = render(<SessionManager isOpen={false} onClose={jest.fn()} />)
    expect(container.firstChild).toBeNull()
  })

  it('loads sessions on open', async () => {
    renderComponent()

    await waitFor(() => {
      expect(mockGetActiveSessions).toHaveBeenCalled()
    })
  })

  it('shows loading state initially', () => {
    mockGetActiveSessions.mockImplementation(() => new Promise(() => {}))
    renderComponent()

    expect(screen.getByText('Loading sessions...')).toBeInTheDocument()
  })

  it('displays current and other sessions', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Chrome')).toBeInTheDocument()
      expect(screen.getByText('Safari')).toBeInTheDocument()
      expect(screen.getByText('Current Session')).toBeInTheDocument()
    })
  })

  it('shows empty state when no sessions', async () => {
    mockGetActiveSessions.mockResolvedValue([])
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('No active sessions found')).toBeInTheDocument()
    })
  })

  it('revokes a session on revoke button click', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Safari')).toBeInTheDocument()
    })

    const revokeButton = screen.getAllByRole('button').find((btn) => btn.classList.contains('text-red-600'))
    fireEvent.click(revokeButton)

    await waitFor(() => {
      expect(mockRevokeSession).toHaveBeenCalledWith('sess-2')
      expect(mockToast.success).toHaveBeenCalledWith('Session revoked')
    })
  })

  it('shows error when revoke fails', async () => {
    mockRevokeSession.mockResolvedValue({ success: false, error: 'Failed' })
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Safari')).toBeInTheDocument()
    })

    const revokeButton = screen.getAllByRole('button').find((btn) => btn.classList.contains('text-red-600'))
    fireEvent.click(revokeButton)

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Failed')
    })
  })

  it('revokes all other sessions on "Sign Out All Other Devices"', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Sign Out All Other Devices')).toBeInTheDocument()
    })

    global.confirm = jest.fn(() => true)
    fireEvent.click(screen.getByText('Sign Out All Other Devices'))

    await waitFor(() => {
      expect(mockRevokeAllOtherSessions).toHaveBeenCalled()
      expect(mockToast.success).toHaveBeenCalledWith('All other sessions revoked')
    })
  })

  it('does not revoke all when confirm is cancelled', async () => {
    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Sign Out All Other Devices')).toBeInTheDocument()
    })

    global.confirm = jest.fn(() => false)
    fireEvent.click(screen.getByText('Sign Out All Other Devices'))

    expect(mockRevokeAllOtherSessions).not.toHaveBeenCalled()
  })

  it('disables revoke all button when only one session', async () => {
    mockGetActiveSessions.mockResolvedValue([mockSessions[0]])
    renderComponent()

    await waitFor(() => {
      const btn = screen.getByText('Sign Out All Other Devices')
      expect(btn).toBeDisabled()
    })
  })
})
