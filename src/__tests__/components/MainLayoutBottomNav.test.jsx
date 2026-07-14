/**
 * Test: MainLayout bottom nav visibility and usage
 * Verifies that RoleMobileBottomNav is rendered for both guests and buyers,
 * and that tabs are correct for each role.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Outlet } from 'react-router-dom'
import { MainLayout } from '@/components/ProtectedRoute'

jest.mock('@/components/Navbar', () => () => <div data-testid="navbar" />)
jest.mock('@/components/notifications/NotificationLink', () => () => null)
jest.mock('react-hot-toast', () => jest.fn())

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallbackOrOptions) => {
      if (typeof fallbackOrOptions === 'string') return fallbackOrOptions
      if (typeof fallbackOrOptions === 'object' && fallbackOrOptions !== null) {
        // Return a reasonable string for interpolation calls
        return _key.split('.').pop()
      }
      return _key
    },
    i18n: { language: 'ar' },
  }),
}))

const mockAuthStore = jest.fn()
jest.mock('@/store/authStore', () => ({
  useAuthStore: (...args) => mockAuthStore(...args),
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

const renderMainLayout = (initialEntry = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<div data-testid="home-content">Home</div>} />
          <Route path="marketplace" element={<div data-testid="market-content">Market</div>} />
          <Route path="search" element={<div data-testid="search-content">Search</div>} />
          <Route path="tracking" element={<div data-testid="tracking-content">Tracking</div>} />
          <Route path="login" element={<div data-testid="login-content">Login</div>} />
          <Route path="buyer/settings" element={<div data-testid="buyer-settings">Buyer Settings</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

describe('MainLayout bottom nav visibility', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders bottom nav for guests (no profile)', () => {
    mockAuthStore.mockImplementation((selector) =>
      typeof selector === 'function'
        ? selector({ user: null, profile: null, signOut: jest.fn() })
        : { user: null, profile: null, signOut: jest.fn() },
    )

    renderMainLayout('/')

    const bottomNav = screen.getByTestId('role-mobile-bottom-nav')
    expect(bottomNav).toBeInTheDocument()
    expect(bottomNav).toHaveAttribute('data-role', 'guest')
  })

  it('renders bottom nav for buyers', () => {
    mockAuthStore.mockImplementation((selector) =>
      typeof selector === 'function'
        ? selector({ user: { id: 'u1' }, profile: { id: 'u1', role: 'buyer', onboarding_completed: true }, signOut: jest.fn() })
        : { user: { id: 'u1' }, profile: { id: 'u1', role: 'buyer', onboarding_completed: true }, signOut: jest.fn() },
    )

    renderMainLayout('/')

    const bottomNav = screen.getByTestId('role-mobile-bottom-nav')
    expect(bottomNav).toBeInTheDocument()
    expect(bottomNav).toHaveAttribute('data-role', 'buyer')
  })

  it('renders mobile header for guests', () => {
    mockAuthStore.mockImplementation((selector) =>
      typeof selector === 'function'
        ? selector({ user: null, profile: null, signOut: jest.fn() })
        : { user: null, profile: null, signOut: jest.fn() },
    )

    renderMainLayout('/')

    const mobileHeader = screen.getByTestId('role-mobile-header')
    expect(mobileHeader).toBeInTheDocument()
  })

  it('renders mobile header for buyers', () => {
    mockAuthStore.mockImplementation((selector) =>
      typeof selector === 'function'
        ? selector({ user: { id: 'u1' }, profile: { id: 'u1', role: 'buyer' }, signOut: jest.fn() })
        : { user: { id: 'u1' }, profile: { id: 'u1', role: 'buyer' }, signOut: jest.fn() },
    )

    renderMainLayout('/')

    const mobileHeader = screen.getByTestId('role-mobile-header')
    expect(mobileHeader).toBeInTheDocument()
  })

  it('shows 4 tabs in bottom nav for guests', () => {
    mockAuthStore.mockImplementation((selector) =>
      typeof selector === 'function'
        ? selector({ user: null, profile: null, signOut: jest.fn() })
        : { user: null, profile: null, signOut: jest.fn() },
    )

    renderMainLayout('/')

    const bottomNav = screen.getByTestId('role-mobile-bottom-nav')
    const links = bottomNav.querySelectorAll('a')
    expect(links).toHaveLength(4)

    // Guest tabs: Home -> /, Market -> /marketplace, Stores -> /stores, Track -> /tracking
    const hrefs = Array.from(links).map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/')
    expect(hrefs).toContain('/marketplace')
    expect(hrefs).toContain('/stores')
    expect(hrefs).toContain('/tracking')
  })

  it('shows 4 tabs in bottom nav for buyers with marketplace, orders, tracking, and settings', () => {
    mockAuthStore.mockImplementation((selector) =>
      typeof selector === 'function'
        ? selector({ user: { id: 'u1' }, profile: { id: 'u1', role: 'buyer' }, signOut: jest.fn() })
        : { user: { id: 'u1' }, profile: { id: 'u1', role: 'buyer' }, signOut: jest.fn() },
    )

    renderMainLayout('/')

    const bottomNav = screen.getByTestId('role-mobile-bottom-nav')
    const links = bottomNav.querySelectorAll('a')
    expect(links).toHaveLength(4)

    const hrefs = Array.from(links).map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/marketplace')
    expect(hrefs).toContain('/buyer/orders')
    expect(hrefs).toContain('/buyer/tracking')
    expect(hrefs).toContain('/buyer/settings')
    expect(hrefs).not.toContain('/tracking')
  })

  it('hides footer on mobile (footer has hidden md:block class)', () => {
    mockAuthStore.mockImplementation((selector) =>
      typeof selector === 'function'
        ? selector({ user: null, profile: null, signOut: jest.fn() })
        : { user: null, profile: null, signOut: jest.fn() },
    )

    renderMainLayout('/')

    const footer = document.querySelector('footer')
    expect(footer).toBeInTheDocument()
    expect(footer.className).toContain('hidden')
    expect(footer.className).toContain('md:block')
  })

  it('renders bottom nav for vendor role with vendor data-role', () => {
    mockAuthStore.mockImplementation((selector) =>
      typeof selector === 'function'
        ? selector({ user: { id: 'u1' }, profile: { id: 'u1', role: 'vendor' }, signOut: jest.fn() })
        : { user: { id: 'u1' }, profile: { id: 'u1', role: 'vendor' }, signOut: jest.fn() },
    )

    renderMainLayout('/')

    // Bottom nav renders with vendor role, but uses guest-like tabs (non-buyer tabs)
    const bottomNav = screen.getByTestId('role-mobile-bottom-nav')
    expect(bottomNav).toHaveAttribute('data-role', 'vendor')
  })
})
