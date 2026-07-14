import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, AdminLayout } from '@/components/ProtectedRoute'
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

const adminAuth = {
  user: { id: 'admin-1', email: 'admin@greenmarket.test' },
  profile: { id: 'profile-admin', role: 'admin', onboarding_completed: true },
  loading: false,
  profileLoading: false,
  profileError: false,
  mfaRequired: false,
  mfaPending: false,
  signOut: jest.fn(),
}

const nonAdminAuth = {
  ...adminAuth,
  user: { id: 'buyer-1', email: 'buyer@greenmarket.test' },
  profile: { id: 'profile-buyer', role: 'buyer', onboarding_completed: true },
}

const unauthState = {
  ...adminAuth,
  user: null,
  profile: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.mockImplementation((selector) => typeof selector === "function" ? selector(adminAuth) : adminAuth)
  useOnboardingGate.mockReturnValue({ isBlocking: false })
  usePaymentGuard.mockReturnValue({ shouldRedirect: false, redirectTo: null, message: null })
})

const renderAdminRoute = (path, pageElement) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <ProtectedRoute
              Layout={AdminLayout}
              requiredRole={USER_ROLES.ADMIN}
              allowedRoles={[USER_ROLES.ADMIN]}
            />
          }
        >
          <Route path="dashboard" element={pageElement} />
          <Route path="commissions" element={pageElement} />
          <Route path="payouts" element={pageElement} />
        </Route>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Admin Role Smoke Tests', () => {
  test('admin dashboard renders for admin role', async () => {
    const MockDashboard = () => <div data-testid="admin-dashboard">Admin Dashboard Content</div>
    renderAdminRoute('/admin/dashboard', <MockDashboard />)
    await waitFor(() => {
      expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument()
    })
  })

  test('non-admin role is redirected to /unauthorized', async () => {
    useAuthStore.mockImplementation((selector) => typeof selector === "function" ? selector(nonAdminAuth) : nonAdminAuth)
    const MockDashboard = () => <div data-testid="admin-dashboard">Admin Dashboard</div>
    renderAdminRoute('/admin/dashboard', <MockDashboard />)
    await waitFor(() => {
      expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument()
    })
  })

  test('unauthenticated user is redirected to /login', async () => {
    useAuthStore.mockImplementation((selector) => typeof selector === "function" ? selector(unauthState) : unauthState)
    const MockDashboard = () => <div data-testid="admin-dashboard">Admin Dashboard</div>
    renderAdminRoute('/admin/dashboard', <MockDashboard />)
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  test('admin commissions page renders', async () => {
    const MockCommissions = () => <div data-testid="admin-commissions">Commissions</div>
    renderAdminRoute('/admin/commissions', <MockCommissions />)
    await waitFor(() => {
      expect(screen.getByTestId('admin-commissions')).toBeInTheDocument()
    })
  })

  test('admin payouts page renders', async () => {
    const MockPayouts = () => <div data-testid="admin-payouts">Payouts</div>
    renderAdminRoute('/admin/payouts', <MockPayouts />)
    await waitFor(() => {
      expect(screen.getByTestId('admin-payouts')).toBeInTheDocument()
    })
  })

  test('admin layout sidebar contains key navigation links', async () => {
    const MockPage = () => <div data-testid="admin-page">Content</div>
    renderAdminRoute('/admin/dashboard', <MockPage />)
    await waitFor(() => {
      expect(screen.getByTestId('admin-page')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Users').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Payouts').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Commissions').length).toBeGreaterThan(0)
  })
})
