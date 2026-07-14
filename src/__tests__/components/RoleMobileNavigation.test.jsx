import React from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen, within } from '@testing-library/react'
import { AdminLayout, DriverLayout, VendorLayout } from '@/components/ProtectedRoute'
import { useAuthStore } from '@/store/authStore'

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
  useOnboardingGate: () => ({ isBlocking: false }),
}))

jest.mock('@/contexts/PaymentGuard', () => ({
  usePaymentGuard: () => ({ shouldRedirect: false, redirectTo: null, message: null }),
}))

const baseStore = {
  user: { id: 'user-1' },
  loading: false,
  profileLoading: false,
  mfaRequired: false,
  mfaPending: false,
  signOut: jest.fn(),
}

const renderRoleLayout = ({ initialPath, layoutType, profile }) => {
  let element = null
  let routePath = '/'
  let childPath = ''

  if (layoutType === 'vendor') {
    element = <VendorLayout />
    routePath = '/vendor'
    childPath = 'dashboard'
  }

  if (layoutType === 'driver') {
    element = <DriverLayout />
    routePath = '/driver'
    childPath = 'dashboard'
  }

  if (layoutType === 'admin') {
    element = <AdminLayout />
    routePath = '/admin'
    childPath = 'dashboard'
  }

  useAuthStore.mockReturnValue({
    ...baseStore,
    profile,
  })

  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path={routePath} element={element}>
          <Route path={childPath} element={<div>Role page content</div>} />
          <Route path="orders" element={<div>Orders content</div>} />
          <Route path="products" element={<div>Products content</div>} />
          <Route path="active" element={<div>Active content</div>} />
          <Route path="users" element={<div>Users content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('Role mobile bottom navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders vendor bottom navigation and marks active tab correctly', () => {
    renderRoleLayout({
      initialPath: '/vendor/orders',
      layoutType: 'vendor',
      profile: { role: 'vendor', agreement_accepted: true },
    })

    const nav = screen.getByTestId('role-mobile-bottom-nav')
    expect(nav).toHaveAttribute('data-role', 'vendor')
    expect(nav.querySelector('[data-route="/marketplace"]')).toBeNull()
    expect(nav.querySelector('[aria-current="page"]')).toHaveAttribute('data-route', '/vendor/orders')
  })

  it('renders driver bottom navigation and excludes vendor/buyer tabs', () => {
    renderRoleLayout({
      initialPath: '/driver/active',
      layoutType: 'driver',
      profile: { role: 'driver', agreement_accepted: true },
    })

    const nav = screen.getByTestId('role-mobile-bottom-nav')
    expect(nav).toHaveAttribute('data-role', 'driver')
    expect(nav.querySelector('[data-route="/vendor/products"]')).toBeNull()
    expect(nav.querySelector('[data-route="/buyer/orders"]')).toBeNull()
    expect(nav.querySelector('[aria-current="page"]')).toHaveAttribute('data-route', '/driver/active')
  })

  it('renders admin bottom navigation and keeps a single mobile nav instance', () => {
    renderRoleLayout({
      initialPath: '/admin/users',
      layoutType: 'admin',
      profile: { role: 'admin', agreement_accepted: true },
    })

    const navs = screen.getAllByTestId('role-mobile-bottom-nav')
    expect(navs.length).toBe(1)
    expect(navs[0]).toHaveAttribute('data-role', 'admin')
    expect(navs[0].querySelector('[aria-current="page"]')).toHaveAttribute('data-route', '/admin/users')
  })
})
