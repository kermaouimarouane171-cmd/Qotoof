import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, VendorLayout } from '@/components/ProtectedRoute'
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

const vendorAuth = {
  user: { id: 'vendor-1', email: 'vendor@greenmarket.test' },
  profile: {
    id: 'profile-vendor',
    role: 'vendor',
    onboarding_completed: true,
    agreement_accepted: true,
  },
  loading: false,
  profileLoading: false,
  profileError: false,
  mfaRequired: false,
  mfaPending: false,
  signOut: jest.fn(),
}

const nonVendorAuth = {
  ...vendorAuth,
  user: { id: 'buyer-1', email: 'buyer@greenmarket.test' },
  profile: { id: 'profile-buyer', role: 'buyer', onboarding_completed: true },
}

const unauthState = {
  ...vendorAuth,
  user: null,
  profile: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.mockImplementation((selector) => typeof selector === "function" ? selector(vendorAuth) : vendorAuth)
  useOnboardingGate.mockReturnValue({ isBlocking: false })
  usePaymentGuard.mockReturnValue({ shouldRedirect: false, redirectTo: null, message: null })
})

const renderVendorRoute = (path, pageElement) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/vendor"
          element={
            <ProtectedRoute
              Layout={VendorLayout}
              requiredRole={USER_ROLES.VENDOR}
              allowedRoles={[USER_ROLES.VENDOR]}
            />
          }
        >
          <Route path="dashboard" element={pageElement} />
          <Route path="products" element={pageElement} />
          <Route path="orders" element={pageElement} />
          <Route path="settings" element={pageElement} />
        </Route>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Vendor Role Smoke Tests', () => {
  test('vendor dashboard renders for vendor role', async () => {
    const MockDashboard = () => <div data-testid="vendor-dashboard">Vendor Dashboard</div>
    renderVendorRoute('/vendor/dashboard', <MockDashboard />)
    await waitFor(() => {
      expect(screen.getByTestId('vendor-dashboard')).toBeInTheDocument()
    })
  })

  test('vendor products page renders', async () => {
    const MockProducts = () => <div data-testid="vendor-products">Products</div>
    renderVendorRoute('/vendor/products', <MockProducts />)
    await waitFor(() => {
      expect(screen.getByTestId('vendor-products')).toBeInTheDocument()
    })
  })

  test('vendor orders page renders', async () => {
    const MockOrders = () => <div data-testid="vendor-orders">Orders</div>
    renderVendorRoute('/vendor/orders', <MockOrders />)
    await waitFor(() => {
      expect(screen.getByTestId('vendor-orders')).toBeInTheDocument()
    })
  })

  test('vendor settings page renders', async () => {
    const MockSettings = () => <div data-testid="vendor-settings">Settings</div>
    renderVendorRoute('/vendor/settings', <MockSettings />)
    await waitFor(() => {
      expect(screen.getByTestId('vendor-settings')).toBeInTheDocument()
    })
  })

  test('non-vendor role is redirected to /unauthorized', async () => {
    useAuthStore.mockImplementation((selector) => typeof selector === "function" ? selector(nonVendorAuth) : nonVendorAuth)
    const MockDashboard = () => <div data-testid="vendor-dashboard">Dashboard</div>
    renderVendorRoute('/vendor/dashboard', <MockDashboard />)
    await waitFor(() => {
      expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument()
    })
  })

  test('unauthenticated user is redirected to /login', async () => {
    useAuthStore.mockImplementation((selector) => typeof selector === "function" ? selector(unauthState) : unauthState)
    const MockDashboard = () => <div data-testid="vendor-dashboard">Dashboard</div>
    renderVendorRoute('/vendor/dashboard', <MockDashboard />)
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  test('vendor layout sidebar contains key navigation links', async () => {
    const MockPage = () => <div data-testid="vendor-page">Content</div>
    renderVendorRoute('/vendor/dashboard', <MockPage />)
    await waitFor(() => {
      expect(screen.getByTestId('vendor-page')).toBeInTheDocument()
    })
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
    expect(screen.getAllByText('My Products').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Orders').length).toBeGreaterThan(0)
  })
})
