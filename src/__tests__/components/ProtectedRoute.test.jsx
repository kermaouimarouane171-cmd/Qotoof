import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'
import { useOnboardingGate } from '@/orchestrators/OnboardingOrchestrator'
import { usePaymentGuard } from '@/contexts/PaymentGuard'

jest.mock('@/components/Navbar', () => () => null)
jest.mock('@/components/notifications/NotificationLink', () => () => null)

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => fallback || _key,
  }),
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(),
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
    mfaRequired: false,
    mfaPending: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()

    useAuthStore.mockReturnValue(baseAuth)
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
    useAuthStore.mockReturnValue({ ...baseAuth, user: null })

    renderRoute()

    expect(screen.getByTestId('location-path')).toHaveTextContent('/login')
    expect(screen.getByTestId('location-state')).toHaveTextContent('/protected?tab=active#summary')
  })

  it('redirects to MFA verify when MFA is required and pending', () => {
    useAuthStore.mockReturnValue({ ...baseAuth, mfaRequired: true, mfaPending: true })

    renderRoute()

    expect(screen.getByTestId('location-path')).toHaveTextContent('/mfa-verify')
  })

  it('does not redirect for missing role until profile.role exists', () => {
    useAuthStore.mockReturnValue({ ...baseAuth, profile: { id: 'profile-1' } })

    renderRoute({ allowedRoles: ['admin'] })

    expect(screen.getByTestId('protected-layout')).toBeInTheDocument()
  })

  it('redirects to unauthorized when role is not allowed', () => {
    useAuthStore.mockReturnValue({ ...baseAuth, profile: { id: 'profile-1', role: 'buyer' } })

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
    useAuthStore.mockReturnValue({ ...baseAuth, loading: true })

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
})
