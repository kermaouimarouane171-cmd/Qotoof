import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, DriverLayout } from '@/components/ProtectedRoute'
import { USER_ROLES } from '@/constants/roles'

jest.mock('@/components/Navbar', () => () => null)
jest.mock('@/components/notifications/NotificationLink', () => () => null)
jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback, vars) => {
      if (typeof fallback === 'string' && vars) {
        return fallback.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '')
      }
      return typeof fallback === 'string' ? fallback : _key
    },
  }),
}))

jest.mock('@/store/authStore', () => ({ useAuthStore: jest.fn() }))
jest.mock('@/orchestrators/OnboardingOrchestrator', () => ({ useOnboardingGate: jest.fn() }))
jest.mock('@/contexts/PaymentGuard', () => ({ usePaymentGuard: jest.fn() }))
// Required by ProtectedRoute's MainLayout imports
jest.mock('@/modules/cart', () => ({ useCartStore: jest.fn(() => ({ items: [] })) }))
jest.mock('@/store/languageStore', () => ({ useLanguageStore: jest.fn(() => ({ language: 'ar', setLanguage: jest.fn() })) }))
jest.mock('@/hooks/useDarkMode', () => ({ useDarkMode: jest.fn(() => ({ isDark: false, toggle: jest.fn() })) }))
jest.mock('@/hooks/useMobileKeyboardGuard', () => ({ useMobileKeyboardGuard: jest.fn() }))

const { useAuthStore } = require('@/store/authStore')
const { useOnboardingGate } = require('@/orchestrators/OnboardingOrchestrator')
const { usePaymentGuard } = require('@/contexts/PaymentGuard')

const driverAuth = {
  user: { id: 'driver-1', email: 'driver@greenmarket.test' },
  profile: { id: 'profile-driver', role: 'driver', onboarding_completed: true },
  loading: false,
  profileLoading: false,
  profileError: false,
  mfaRequired: false,
  mfaPending: false,
  signOut: jest.fn(),
}

const nonDriverAuth = {
  ...driverAuth,
  user: { id: 'buyer-1', email: 'buyer@greenmarket.test' },
  profile: { id: 'profile-buyer', role: 'buyer', onboarding_completed: true },
}

const unauthState = {
  ...driverAuth,
  user: null,
  profile: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.mockImplementation((selector) => typeof selector === "function" ? selector(driverAuth) : driverAuth)
  useOnboardingGate.mockReturnValue({ isBlocking: false })
  usePaymentGuard.mockReturnValue({ shouldRedirect: false, redirectTo: null, message: null })
})

const renderDriverRoute = (path, pageElement) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/driver"
          element={
            <ProtectedRoute
              Layout={DriverLayout}
              requiredRole={USER_ROLES.DRIVER}
              allowedRoles={[USER_ROLES.DRIVER]}
            />
          }
        >
          <Route path="dashboard" element={pageElement} />
          <Route path="active" element={pageElement} />
          <Route path="available" element={pageElement} />
          <Route path="earnings" element={pageElement} />
        </Route>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Driver Role Smoke Tests', () => {
  test('driver dashboard renders for driver role', async () => {
    const MockDashboard = () => <div data-testid="driver-dashboard">Driver Dashboard</div>
    renderDriverRoute('/driver/dashboard', <MockDashboard />)
    await waitFor(() => {
      expect(screen.getByTestId('driver-dashboard')).toBeInTheDocument()
    })
  })

  test('driver active deliveries page renders', async () => {
    const MockActive = () => <div data-testid="driver-active">Active Deliveries</div>
    renderDriverRoute('/driver/active', <MockActive />)
    await waitFor(() => {
      expect(screen.getByTestId('driver-active')).toBeInTheDocument()
    })
  })

  test('driver empty deliveries state renders without crash', async () => {
    const MockEmptyActive = () => (
      <div data-testid="driver-empty-active">
        <div data-testid="empty-state">No active deliveries</div>
      </div>
    )
    renderDriverRoute('/driver/active', <MockEmptyActive />)
    await waitFor(() => {
      expect(screen.getByTestId('driver-empty-active')).toBeInTheDocument()
    })
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
  })

  test('non-driver role is redirected to /unauthorized', async () => {
    useAuthStore.mockImplementation((selector) => typeof selector === "function" ? selector(nonDriverAuth) : nonDriverAuth)
    const MockDashboard = () => <div data-testid="driver-dashboard">Dashboard</div>
    renderDriverRoute('/driver/dashboard', <MockDashboard />)
    await waitFor(() => {
      expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument()
    })
  })

  test('unauthenticated user is redirected to /login', async () => {
    useAuthStore.mockImplementation((selector) => typeof selector === "function" ? selector(unauthState) : unauthState)
    const MockDashboard = () => <div data-testid="driver-dashboard">Dashboard</div>
    renderDriverRoute('/driver/dashboard', <MockDashboard />)
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  test('driver layout sidebar contains key navigation links', async () => {
    const MockPage = () => <div data-testid="driver-page">Content</div>
    renderDriverRoute('/driver/dashboard', <MockPage />)
    await waitFor(() => {
      expect(screen.getByTestId('driver-page')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Active Deliveries').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Earnings').length).toBeGreaterThan(0)
  })
})
