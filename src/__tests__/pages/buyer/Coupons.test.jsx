/**
 * Test: Coupons page error handling (B-03)
 * Verifies that toast.error is shown when coupon loading fails.
 */
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'

const mockToast = { success: jest.fn(), error: jest.fn() }
const mockGetAvailableCoupons = jest.fn()

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return { ...actual, useNavigate: () => jest.fn() }
})

jest.mock('react-i18next', () => {
  const t = (_k, fallback) => fallback
  return { useTranslation: () => ({ t }) }
})

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args) => mockToast.success(...args),
    error: (...args) => mockToast.error(...args),
  },
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'buyer-1' } }),
}))

jest.mock('@/modules/coupons', () => ({
  couponsApi: {
    getAvailableCoupons: (...args) => mockGetAvailableCoupons(...args),
  },
}))

jest.mock('@/modules/shared', () => ({
  Card: ({ children }) => <div>{children}</div>,
  LoadingSpinner: () => <div data-testid="loading">Loading...</div>,
  formatPrice: (v) => String(v),
  logger: { error: jest.fn() },
}))

jest.mock('@heroicons/react/24/outline', () => ({
  TagIcon: () => <svg />,
  ClipboardDocumentIcon: () => <svg />,
  ShoppingBagIcon: () => <svg />,
  ClockIcon: () => <svg />,
  ArrowLeftIcon: () => <svg />,
  SparklesIcon: () => <svg />,
}))

import BuyerCoupons from '@/pages/buyer/Coupons'

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BuyerCoupons />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('Coupons page error handling (B-03)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('shows toast.error when getAvailableCoupons returns error', async () => {
    mockGetAvailableCoupons.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    })

    renderPage()

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        'Failed to load coupons',
      )
    })
  })

  it('does not show toast.error on successful load', async () => {
    mockGetAvailableCoupons.mockResolvedValue({
      data: [{ id: 'c1', code: 'SAVE10', discount_value: 10 }],
      error: null,
    })

    renderPage()

    await waitFor(() => {
      expect(mockToast.error).not.toHaveBeenCalled()
    })
  })
})
