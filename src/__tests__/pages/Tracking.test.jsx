/**
 * Tests for the Tracking gateway page (src/pages/Tracking.jsx)
 * The page is now a guest-only landing page; authenticated users are redirected.
 */

import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

// ─── Mutable mock state ──────────────────────────────────────────────────────

const mockAuthState = { user: null, profile: null }
const mockT = jest.fn((key, fallback) => {
  if (typeof fallback === 'object' && fallback !== null) return key.split('.').pop()
  return fallback || key
})

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: mockT,
    i18n: { language: 'ar', dir: () => 'rtl' },
  }),
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector) => typeof selector === 'function' ? selector(mockAuthState) : mockAuthState,
}))

jest.mock('@/components/ErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>,
}))

jest.mock('@/components/ui', () => ({
  Card: ({ children, className }) => <div className={className}>{children}</div>,
}))

// ─── Import after mocks ──────────────────────────────────────────────────────

import TrackingPage from '@/pages/Tracking'

// ─── Helpers ─────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup()
  mockT.mockClear()
})

const renderTracking = () =>
  render(
    <MemoryRouter initialEntries={['/tracking']}>
      <Routes>
        <Route path="/tracking" element={<TrackingPage />} />
        <Route path="/buyer/orders" element={<div data-testid="buyer-orders">Buyer Orders</div>} />
        <Route path="/login" element={<div data-testid="login-page">Login</div>} />
        <Route path="/register" element={<div data-testid="register-page">Register</div>} />
        <Route path="/vendor/dashboard" element={<div data-testid="vendor-dashboard">Vendor Dashboard</div>} />
        <Route path="/driver/dashboard" element={<div data-testid="driver-dashboard">Driver Dashboard</div>} />
        <Route path="/admin/dashboard" element={<div data-testid="admin-dashboard">Admin Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  )

// ─── Tests: Guest state ──────────────────────────────────────────────────────

describe('Tracking page — guest', () => {
  beforeEach(() => {
    mockAuthState.user = null
    mockAuthState.profile = null
  })

  it('renders guest login prompt with title and message', () => {
    renderTracking()
    expect(screen.getByText(/Track Your Orders|تتبع طلباتك/i)).toBeInTheDocument()
    expect(screen.getByText(/Sign in to view your orders|سجل الدخول/i)).toBeInTheDocument()
  })

  it('shows Sign In and Create Account links', () => {
    renderTracking()
    expect(screen.getByRole('link', { name: /Sign In|تسجيل الدخول/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Create Account|إنشاء حساب/i })).toBeInTheDocument()
  })

  it('navigates to /login with state.from = /tracking when Sign In clicked', () => {
    renderTracking()
    fireEvent.click(screen.getByRole('link', { name: /Sign In|تسجيل الدخول/i }))
    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })

  it('navigates to /register with state.from = /tracking when Create Account clicked', () => {
    renderTracking()
    fireEvent.click(screen.getByRole('link', { name: /Create Account|إنشاء حساب/i }))
    expect(screen.getByTestId('register-page')).toBeInTheDocument()
  })
})

// ─── Tests: Authenticated users ─────────────────────────────────────────────

describe('Tracking page — authenticated buyer', () => {
  beforeEach(() => {
    mockAuthState.user = { id: 'u1' }
    mockAuthState.profile = { id: 'u1', role: 'buyer' }
  })

  it('redirects buyer to /buyer/orders', () => {
    renderTracking()
    expect(screen.getByTestId('buyer-orders')).toBeInTheDocument()
  })
})

// ─── Tests: Non-buyer role ───────────────────────────────────────────────────

describe('Tracking page — non-buyer role', () => {
  it('redirects vendor to /vendor/dashboard', () => {
    mockAuthState.user = { id: 'v1' }
    mockAuthState.profile = { id: 'v1', role: 'vendor' }
    renderTracking()
    expect(screen.getByTestId('vendor-dashboard')).toBeInTheDocument()
  })

  it('redirects driver to /driver/dashboard', () => {
    mockAuthState.user = { id: 'd1' }
    mockAuthState.profile = { id: 'd1', role: 'driver' }
    renderTracking()
    expect(screen.getByTestId('driver-dashboard')).toBeInTheDocument()
  })

  it('redirects admin to /admin/dashboard', () => {
    mockAuthState.user = { id: 'a1' }
    mockAuthState.profile = { id: 'a1', role: 'admin' }
    renderTracking()
    expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument()
  })
})
