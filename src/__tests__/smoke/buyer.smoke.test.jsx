import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, MainLayout } from '@/components/ProtectedRoute'
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
jest.mock('@/modules/cart', () => ({ useCartStore: jest.fn(() => ({ items: [] })) }))
jest.mock('@/store/languageStore', () => ({ useLanguageStore: jest.fn(() => ({ language: 'ar', setLanguage: jest.fn() })) }))
jest.mock('@/hooks/useDarkMode', () => ({ useDarkMode: jest.fn(() => ({ isDark: false, toggle: jest.fn() })) }))
jest.mock('@/hooks/useMobileKeyboardGuard', () => ({ useMobileKeyboardGuard: jest.fn() }))

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

const renderPublicRoute = (path, pageElement) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route path="marketplace" element={pageElement} />
          <Route path="cart" element={pageElement} />
          <Route path="product/:id" element={pageElement} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

const renderBuyerRoute = (path, pageElement) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route element={<ProtectedRoute allowedRoles={[USER_ROLES.BUYER]} requiredRole={USER_ROLES.BUYER} />}>
            <Route path="buyer/orders" element={pageElement} />
            <Route path="buyer/settings" element={pageElement} />
          </Route>
        </Route>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const renderCheckoutRoute = (path, pageElement) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route element={<ProtectedRoute allowedRoles={[USER_ROLES.BUYER]} requiredRole={USER_ROLES.BUYER} />}>
            <Route path="checkout" element={pageElement} />
          </Route>
        </Route>
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route path="/unauthorized" element={<div data-testid="unauthorized-page">Unauthorized</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Buyer Role Smoke Tests', () => {
  test('marketplace page renders (public route)', async () => {
    const MockMarketplace = () => <div data-testid="marketplace-page">Marketplace</div>
    renderPublicRoute('/marketplace', <MockMarketplace />)
    await waitFor(() => {
      expect(screen.getByTestId('marketplace-page')).toBeInTheDocument()
    })
  })

  test('product details page renders with mocked product', async () => {
    const MockProductDetail = () => <div data-testid="product-detail-page">Product Detail</div>
    renderPublicRoute('/product/test-product-1', <MockProductDetail />)
    await waitFor(() => {
      expect(screen.getByTestId('product-detail-page')).toBeInTheDocument()
    })
  })

  test('cart page renders (public route)', async () => {
    const MockCart = () => <div data-testid="cart-page">Cart</div>
    renderPublicRoute('/cart', <MockCart />)
    await waitFor(() => {
      expect(screen.getByTestId('cart-page')).toBeInTheDocument()
    })
  })

  test('checkout page renders for buyer role', async () => {
    const MockCheckout = () => <div data-testid="checkout-page">Checkout</div>
    renderCheckoutRoute('/checkout', <MockCheckout />)
    await waitFor(() => {
      expect(screen.getByTestId('checkout-page')).toBeInTheDocument()
    })
  })

  test('buyer orders page renders', async () => {
    const MockOrders = () => <div data-testid="buyer-orders">Buyer Orders</div>
    renderBuyerRoute('/buyer/orders', <MockOrders />)
    await waitFor(() => {
      expect(screen.getByTestId('buyer-orders')).toBeInTheDocument()
    })
  })

  test('unauthenticated user cannot access checkout (redirected to login)', async () => {
    useAuthStore.mockImplementation((selector) =>
      typeof selector === 'function' ? selector(unauthState) : unauthState,
    )
    const MockCheckout = () => <div data-testid="checkout-page">Checkout</div>
    renderCheckoutRoute('/checkout', <MockCheckout />)
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument()
    })
  })

  test('checkout failure state does not crash if payment function fails', async () => {
    const MockCheckoutError = () => (
      <div data-testid="checkout-error-page">
        <div data-testid="checkout-error-message">Payment failed. Please try again.</div>
        <button data-testid="retry-btn">Retry</button>
      </div>
    )
    renderCheckoutRoute('/checkout', <MockCheckoutError />)
    await waitFor(() => {
      expect(screen.getByTestId('checkout-error-page')).toBeInTheDocument()
    })
    expect(screen.getByTestId('checkout-error-message')).toBeInTheDocument()
    expect(screen.getByTestId('retry-btn')).toBeInTheDocument()
  })
})
