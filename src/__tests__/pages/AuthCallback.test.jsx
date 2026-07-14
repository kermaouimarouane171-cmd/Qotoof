import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AuthCallback from '@/pages/auth/AuthCallback'

const mockNavigate = jest.fn()
const mockInitialize = jest.fn()
const mockGetSession = jest.fn()

const mockAuthState = {
  initialize: (...args) => mockInitialize(...args),
  profile: null,
  loading: true,
}

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ search: '', hash: '' }),
  }
})

jest.mock('@/modules/auth', () => ({
  useAuthStore: Object.assign(jest.fn(() => mockAuthState), {
    getState: jest.fn(() => ({
      getRedirectPath: () => '/marketplace',
    })),
  }),
  resolveSafeAuthRedirect: jest.fn((redirect, fallback) => redirect || fallback),
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args) => mockGetSession(...args),
    },
  },
}))

jest.mock('@/components/ui', () => ({
  __esModule: true,
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

const originalLocation = window.location

const setPageUrl = (search = '', hash = '') => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...originalLocation, search, hash },
  })
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <AuthCallback />
    </MemoryRouter>
  )

describe('AuthCallback page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetSession.mockResolvedValue({ data: { session: null }, error: null })
    mockInitialize.mockResolvedValue(undefined)
    mockAuthState.loading = true
    mockAuthState.profile = null
    sessionStorage.clear()
    setPageUrl('', '')
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    })
  })

  it('shows loading spinner initially', () => {
    renderPage()
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('shows OAuth error when error param is present', async () => {
    setPageUrl('?error=access_denied&error_description=User+denied', '')

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/denied the sign-in/i)).toBeInTheDocument()
    })
  })

  it('shows error for state mismatch', async () => {
    sessionStorage.setItem('oauth_state', 'oauth_stored_value')
    setPageUrl('?state=oauth_different_value', '')

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Security check failed/i)).toBeInTheDocument()
    })
  })

  it('calls getSession and initialize on success path', async () => {
    renderPage()

    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalled()
    })
  })

  it('navigates to redirect path after successful auth', async () => {
    mockAuthState.loading = false
    mockAuthState.profile = { role: 'buyer' }
    sessionStorage.setItem('redirect_after_verification', '/marketplace')

    renderPage()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/marketplace', { replace: true })
    })
  })
})
