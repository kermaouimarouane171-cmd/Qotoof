import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { useOnboardingGate } from '@/orchestrators/OnboardingOrchestrator'
import { usePaymentGuard } from '@/contexts/PaymentGuard'
import { VendorLayout } from '@/components/ProtectedRoute'
import { Outlet } from 'react-router-dom'

jest.mock('@/components/Navbar', () => () => null)
jest.mock('@/components/notifications/NotificationLink', () => () => null)
jest.mock('react-hot-toast', () => jest.fn())

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => fallback || _key,
    i18n: { language: 'ar' },
  }),
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(),
}))

jest.mock('@/modules/cart', () => ({
  useCartStore: jest.fn(() => ({ items: [] })),
}))

jest.mock('@/store/languageStore', () => ({
  useLanguageStore: jest.fn(() => ({ language: 'ar', setLanguage: jest.fn() })),
}))

jest.mock('@/hooks/useDarkMode', () => ({
  useDarkMode: jest.fn(() => ({ isDark: false, toggle: jest.fn() })),
}))

jest.mock('@/hooks/useMobileKeyboardGuard', () => ({
  useMobileKeyboardGuard: jest.fn(),
}))

jest.mock('@/orchestrators/OnboardingOrchestrator', () => ({
  useOnboardingGate: jest.fn(),
}))

jest.mock('@/contexts/PaymentGuard', () => ({
  usePaymentGuard: jest.fn(),
}))

const renderRoute = ({
  initialEntry = '/protected?tab=active#summary',
  allowedRoles = ['buyer'],
  requiredRole = null,
} = {}) => {
  const Layout = () => <div data-testid="protected-layout">Protected Content</div>

  const LocationProbe = () => {
    const location = useLocation()
    return (
      <>
        <div data-testid="location-path">{`${location.pathname}${location.search}`}</div>
        <div data-testid="location-state">{JSON.stringify(location.state || {})}</div>
      </>
    )
  }

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/protected"
          element={<ProtectedRoute Layout={Layout} allowedRoles={allowedRoles} requiredRole={requiredRole} />}
        />
        <Route path="/login" element={<LocationProbe />} />
        <Route path="/mfa-verify" element={<LocationProbe />} />
        <Route path="/unauthorized" element={<LocationProbe />} />
        <Route path="/vendor/settings" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute (real component)', () => {
  const baseAuth = {
    user: { id: 'user-1', email: 'user@example.com' },
    profile: { id: 'profile-1', role: 'buyer' },
    loading: false,
    profileLoading: false,
    profileError: false,
    mfaRequired: false,
    mfaPending: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()

    useAuthStore.mockImplementation((selector) =>
      typeof selector === 'function' ? selector(baseAuth) : baseAuth,
    )
    useOnboardingGate.mockReturnValue({ isBlocking: false })
    usePaymentGuard.mockReturnValue({
      shouldRedirect: false,
      redirectTo: null,
      message: null,
    })
  })

  it('renders protected layout when auth and role checks pass', () => {
    renderRoute()
    expect(screen.getByTestId('protected-layout')).toBeInTheDocument()
  })

  it('redirects unauthenticated users to login and preserves from-state', () => {
    useAuthStore.mockImplementation((selector) =>
      typeof selector === 'function' ? selector({ ...baseAuth, user: null }) : { ...baseAuth, user: null },
    )

    renderRoute()

    expect(screen.getByTestId('location-path')).toHaveTextContent('/login')
    expect(screen.getByTestId('location-state')).toHaveTextContent('/protected?tab=active#summary')
  })

  it('redirects to MFA verify when MFA is required and pending', () => {
    useAuthStore.mockImplementation((selector) =>
      typeof selector === 'function' ? selector({ ...baseAuth, mfaRequired: true, mfaPending: true }) : { ...baseAuth, mfaRequired: true, mfaPending: true },
    )

    renderRoute()

    expect(screen.getByTestId('location-path')).toHaveTextContent('/mfa-verify')
  })

  it('does not redirect for missing role until profile.role exists', () => {
    useAuthStore.mockImplementation((selector) =>
      typeof selector === 'function' ? selector({ ...baseAuth, profile: { id: 'profile-1' } }) : { ...baseAuth, profile: { id: 'profile-1' } },
    )

    renderRoute({ allowedRoles: ['admin'] })

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('redirects to unauthorized when role is not allowed', () => {
    useAuthStore.mockImplementation((selector) =>
      typeof selector === 'function' ? selector({ ...baseAuth, profile: { id: 'profile-1', role: 'buyer' } }) : { ...baseAuth, profile: { id: 'profile-1', role: 'buyer' } },
    )

    renderRoute({ allowedRoles: ['vendor'] })

    expect(screen.getByTestId('location-path')).toHaveTextContent('/unauthorized')
  })

  it('redirects to payment setup route when payment guard blocks access', () => {
    usePaymentGuard.mockReturnValue({
      shouldRedirect: true,
      redirectTo: '/vendor/settings',
      message: 'PayPal setup required',
    })

    renderRoute()

    expect(screen.getByTestId('location-path')).toHaveTextContent('/vendor/settings')
    expect(screen.getByTestId('location-state')).toHaveTextContent('paypalSetupRequired')
    expect(screen.getByTestId('location-state')).toHaveTextContent('PayPal setup required')
  })

  it('shows timeout fallback when auth loading exceeds threshold', () => {
    jest.useFakeTimers()
    useAuthStore.mockImplementation((selector) =>
      typeof selector === 'function' ? selector({ ...baseAuth, loading: true }) : { ...baseAuth, loading: true },
    )

    renderRoute()

    expect(screen.getByText('Loading...')).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(10001)
    })

    expect(
      screen.getByText('Authentication is taking longer than expected'),
    ).toBeInTheDocument()

    jest.useRealTimers()
  })

  it('shows ProfileErrorFallback with retry and logout when user exists but profile fetch failed (profileError=true)', () => {
    const signOut = jest.fn().mockResolvedValue(undefined)
    const errorAuth = {
      ...baseAuth,
      profile: null,
      profileError: true,
      loading: false,
      profileLoading: false,
    }
    useAuthStore.mockImplementation((selector) =>
      typeof selector === 'function' ? selector(errorAuth) : errorAuth,
    )
    useAuthStore.getState = () => ({ refreshProfile: jest.fn().mockResolvedValue(null), signOut })

    renderRoute()

    // With profileError=true, ProtectedRoute should show ProfileErrorFallback
    // with retry and logout buttons instead of infinite LoadingFallback.
    expect(screen.getByText('Profile could not be loaded')).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()
    expect(screen.getByText('Log out')).toBeInTheDocument()
  })

  it('passes onRetry to AuthTimeoutFallback and retry button is present', () => {
    jest.useFakeTimers()
    const refreshProfile = jest.fn().mockResolvedValue(null)
    const loadingAuth = {
      ...baseAuth,
      profile: null,
      profileError: false,
      loading: true,
      profileLoading: false,
    }
    useAuthStore.mockImplementation((selector) =>
      typeof selector === 'function' ? selector(loadingAuth) : loadingAuth,
    )
    useAuthStore.getState = () => ({ refreshProfile })

    renderRoute()

    act(() => {
      jest.advanceTimersByTime(10001)
    })

    expect(
      screen.getByText('Authentication is taking longer than expected'),
    ).toBeInTheDocument()
    expect(screen.getByText('Retry')).toBeInTheDocument()

    jest.useRealTimers()
  })
})

describe('VendorLayout digital-contract gate', () => {
  const vendorAuth = {
    user: { id: 'vendor-1', email: 'vendor@example.com' },
    profile: { id: 'profile-vendor', role: 'vendor', agreement_accepted: false },
    loading: false,
    profileLoading: false,
    profileError: false,
    mfaRequired: false,
    mfaPending: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.mockImplementation((selector) =>
      typeof selector === 'function' ? selector(vendorAuth) : vendorAuth,
    )
    useOnboardingGate.mockReturnValue({ isBlocking: false })
    usePaymentGuard.mockReturnValue({ shouldRedirect: false, redirectTo: null, message: null })
  })

  it('redirects unsigned vendor from /vendor/products to /vendor/digital-contract', () => {
    render(
      <MemoryRouter initialEntries={['/vendor/products']}>
        <Routes>
          <Route path="/vendor" element={<VendorLayout />}>
            <Route path="products" element={<div data-testid="products-page">Products</div>} />
            <Route path="digital-contract" element={<div data-testid="contract-page">Contract</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.queryByTestId('products-page')).not.toBeInTheDocument()
    expect(screen.getByTestId('contract-page')).toBeInTheDocument()
  })

  it('does not redirect loop when vendor is already on /vendor/digital-contract', () => {
    render(
      <MemoryRouter initialEntries={['/vendor/digital-contract']}>
        <Routes>
          <Route path="/vendor" element={<VendorLayout />}>
            <Route path="products" element={<div data-testid="products-page">Products</div>} />
            <Route path="digital-contract" element={<div data-testid="contract-page">Contract</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByTestId('contract-page')).toBeInTheDocument()
  })
})
