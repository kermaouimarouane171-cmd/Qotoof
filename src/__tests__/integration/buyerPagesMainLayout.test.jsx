import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, MainLayout } from '@/components/ProtectedRoute'
import { USER_ROLES } from '@/constants/roles'

jest.mock('@/components/Navbar', () => () => null)
jest.mock('@/components/notifications/NotificationLink', () => () => null)
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { success: jest.fn(), error: jest.fn() },
}))

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
jest.mock('@/orchestrators/OnboardingOrchestrator', () => ({
  useOnboardingGate: jest.fn(),
}))
jest.mock('@/contexts/PaymentGuard', () => ({ usePaymentGuard: jest.fn() }))

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

const { useAuthStore } = require('@/store/authStore')
const { useOnboardingGate } = require('@/orchestrators/OnboardingOrchestrator')
const { usePaymentGuard } = require('@/contexts/PaymentGuard')

const buyerAuth = {
  user: { id: 'buyer-1', email: 'buyer@greenmarket.test' },
  profile: { id: 'profile-buyer', role: 'buyer', onboarding_completed: true },
  loading: false,
  profileLoading: false,
  profileError: false,
  mfaRequired: false,
  mfaPending: false,
  signOut: jest.fn(),
}

const vendorAuth = {
  ...buyerAuth,
  user: { id: 'vendor-1', email: 'vendor@greenmarket.test' },
  profile: { id: 'profile-vendor', role: 'vendor', onboarding_completed: true, agreement_accepted: true },
}

const unauthState = {
  ...buyerAuth,
  user: null,
  profile: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.mockImplementation((selector) =>
    typeof selector === 'function' ? selector(buyerAuth) : buyerAuth,
  )
  useOnboardingGate.mockReturnValue({ isBlocking: false })
  usePaymentGuard.mockReturnValue({ shouldRedirect: false, redirectTo: null, message: null })
})

const renderBuyerPage = (path, pageElement) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route
            element={
              <ProtectedRoute
                allowedRoles={[USER_ROLES.BUYER]}
                requiredRole={USER_ROLES.BUYER}
              />
            }
          >
            <Route path="buyer/orders" element={pageElement} />
            <Route path="buyer/addresses" element={pageElement} />
            <Route path="buyer/settings" element={pageElement} />
            <Route path="buyer/coupons" element={pageElement} />
            <Route path="buyer/loyalty" element={pageElement} />
            <Route path="buyer/security" element={pageElement} />
            <Route path="buyer/shopping-lists" element={pageElement} />
            <Route path="buyer/rfq" element={pageElement} />
          </Route>
        </Route>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Buyer pages in MainLayout', () => {
  const buyerPages = [
    { path: '/buyer/orders', testId: 'buyer-orders' },
    { path: '/buyer/addresses', testId: 'buyer-addresses' },
    { path: '/buyer/settings', testId: 'buyer-settings' },
    { path: '/buyer/coupons', testId: 'buyer-coupons' },
    { path: '/buyer/loyalty', testId: 'buyer-loyalty' },
    { path: '/buyer/security', testId: 'buyer-security' },
    { path: '/buyer/shopping-lists', testId: 'buyer-shopping-lists' },
    { path: '/buyer/rfq', testId: 'buyer-rfq' },
  ]

  buyerPages.forEach(({ path, testId }) => {
    test(`${path} renders for buyer role`, async () => {
      const MockPage = () => <div data-testid={testId}>Page Content</div>
      renderBuyerPage(path, <MockPage />)
      await waitFor(() => {
        expect(screen.getByTestId(testId)).toBeInTheDocument()
      })
    })
  })

  test('vendor cannot access buyer pages (redirected to unauthorized)', async () => {
    useAuthStore.mockImplementation((selector) =>
      typeof selector === 'function' ? selector(vendorAuth) : vendorAuth,
    )
    const MockPage = () => <div data-testid="buyer-orders">Orders</div>
    renderBuyerPage('/buyer/orders', <MockPage />)
    await waitFor(() => {
      expect(screen.getByTestId('unauthorized-page')).toBeInTheDocument()
    })
  })

  test('unauthenticated user cannot access buyer pages (redirected to login)', async () => {
    useAuthStore.mockImplementation((selector) =>
      typeof selector === 'function' ? selector(unauthState) : unauthState,
    )
    const MockPage = () => <div data-testid="buyer-orders">Orders</div>
    renderBuyerPage('/buyer/orders', <MockPage />)
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })
})
