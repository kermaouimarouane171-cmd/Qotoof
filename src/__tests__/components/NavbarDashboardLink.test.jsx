import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Navbar from '@/components/Navbar'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => typeof fallback === 'string' ? fallback : _key,
    i18n: { language: 'en' },
  }),
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(),
}))

jest.mock('@/modules/cart', () => ({
  useCartStore: () => ({ items: [] }),
}))

jest.mock('@/store/languageStore', () => ({
  useLanguageStore: () => ({ language: 'en', setLanguage: jest.fn() }),
}))

jest.mock('@/hooks/useDarkMode', () => ({
  useDarkMode: () => ({ isDark: false, toggle: jest.fn() }),
}))

jest.mock('@/components/notifications/NotificationLink', () => () => null)

const { useAuthStore } = require('@/store/authStore')

const renderNavbar = () => {
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  )
}

const openUserMenu = async () => {
  const userMenuButton = screen.getByTestId('user-menu')
  await userEvent.click(userMenuButton)
}

describe('Navbar getDashboardLink', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does not show a dashboard link when profile.role is buyer (B-2 fix: buyers have no dedicated dashboard)', async () => {
    useAuthStore.mockReturnValue({
      user: { id: 'u1', email: 'buyer@test.com' },
      profile: { id: 'p1', role: 'buyer' },
      signOut: jest.fn(),
    })

    renderNavbar()
    await openUserMenu()
    // Buyers should NOT see a "لوحة التحكم" entry — they access /marketplace via the nav
    expect(screen.queryByText('لوحة التحكم')).not.toBeInTheDocument()
  })

  it('links to /vendor/dashboard when profile.role is vendor', async () => {
    useAuthStore.mockReturnValue({
      user: { id: 'u1', email: 'vendor@test.com' },
      profile: { id: 'p1', role: 'vendor' },
      signOut: jest.fn(),
    })

    renderNavbar()
    await openUserMenu()
    const dashboardLink = screen.getByText('لوحة التحكم').closest('a')
    expect(dashboardLink).toHaveAttribute('href', '/vendor/dashboard')
  })

  it('links to /admin/dashboard when profile.role is admin', async () => {
    useAuthStore.mockReturnValue({
      user: { id: 'u1', email: 'admin@test.com' },
      profile: { id: 'p1', role: 'admin' },
      signOut: jest.fn(),
    })

    renderNavbar()
    await openUserMenu()
    const dashboardLink = screen.getByText('لوحة التحكم').closest('a')
    expect(dashboardLink).toHaveAttribute('href', '/admin/dashboard')
  })

  it('links to /driver/dashboard when profile.role is driver', async () => {
    useAuthStore.mockReturnValue({
      user: { id: 'u1', email: 'driver@test.com' },
      profile: { id: 'p1', role: 'driver' },
      signOut: jest.fn(),
    })

    renderNavbar()
    await openUserMenu()
    const dashboardLink = screen.getByText('لوحة التحكم').closest('a')
    expect(dashboardLink).toHaveAttribute('href', '/driver/dashboard')
  })

  it('does not show dashboard link when profile is null and user_metadata.role is buyer (B-2 fix)', async () => {
    useAuthStore.mockReturnValue({
      user: {
        id: 'u1',
        email: 'buyer@test.com',
        user_metadata: { role: 'buyer' },
      },
      profile: null,
      signOut: jest.fn(),
    })

    renderNavbar()
    await openUserMenu()
    // Buyer has no dedicated dashboard — no "لوحة التحكم" entry expected
    expect(screen.queryByText('لوحة التحكم')).not.toBeInTheDocument()
  })

  it('does not show dashboard link when both profile and user_metadata.role are null', async () => {
    useAuthStore.mockReturnValue({
      user: { id: 'u1', email: 'unknown@test.com' },
      profile: null,
      signOut: jest.fn(),
    })

    renderNavbar()
    await openUserMenu()
    // No role determinable → no dashboard link shown
    expect(screen.queryByText('لوحة التحكم')).not.toBeInTheDocument()
  })

  it('does not show dashboard link when user is null (not authenticated)', () => {
    useAuthStore.mockReturnValue({
      user: null,
      profile: null,
      signOut: jest.fn(),
    })

    renderNavbar()
    expect(screen.queryByText('لوحة التحكم')).not.toBeInTheDocument()
  })

  it('uses user_metadata.role for vendor when profile is null', async () => {
    useAuthStore.mockReturnValue({
      user: {
        id: 'u1',
        email: 'vendor@test.com',
        user_metadata: { role: 'vendor' },
      },
      profile: null,
      signOut: jest.fn(),
    })

    renderNavbar()
    await openUserMenu()
    const dashboardLink = screen.getByText('لوحة التحكم').closest('a')
    expect(dashboardLink).toHaveAttribute('href', '/vendor/dashboard')
  })
})
