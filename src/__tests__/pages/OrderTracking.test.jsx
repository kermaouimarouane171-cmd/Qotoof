/**
 * Tests for OrderTracking page (src/pages/OrderTracking.jsx)
 * Covers the loading flow and verifies the order is loaded without infinite loops.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const mockAuthState = { user: { id: 'u1' }, profile: { id: 'u1', role: 'buyer' } }
const mockSupabaseFrom = jest.fn()
const mockSupabaseChannel = jest.fn()

jest.mock('react-i18next', () => {
  const mockT = () => (key, fallback) => fallback || key
  return {
    useTranslation: () => ({
      t: mockT(),
      i18n: { language: 'ar', dir: () => 'rtl' },
    }),
  }
})

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: (...args) => mockSupabaseFrom(...args),
    channel: (name) => mockSupabaseChannel(name),
  },
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector) => typeof selector === 'function' ? selector(mockAuthState) : mockAuthState,
}))

jest.mock('@/components/ui', () => ({
  Card: ({ children, className }) => <div className={className}>{children}</div>,
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading</div>,
}))

jest.mock('@/components/maps/LiveDriverMap', () => () => <div data-testid="live-map">Map</div>)

jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() } }))

jest.mock('@/components/ErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }) => <>{children}</>,
}))

jest.mock('react-hot-toast', () => {
  const toast = jest.fn()
  toast.success = jest.fn()
  toast.error = jest.fn()
  return toast
})

// ─── Import after mocks ──────────────────────────────────────────────────────

import OrderTrackingPage from '@/pages/OrderTracking'

const renderOrderTracking = (orderId = 'o1') =>
  render(
    <MemoryRouter initialEntries={[`/orders/${orderId}/tracking`]}>
      <Routes>
        <Route path="/orders/:id/tracking" element={<OrderTrackingPage />} />
      </Routes>
    </MemoryRouter>
  )

const createOrderResponse = (order) => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      or: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({ data: order, error: null })),
      })),
    })),
  })),
})

const createItemsResponse = (data) => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => Promise.resolve({ data, error: null })),
  })),
})

const createPaymentsResponse = (data) => ({
  select: jest.fn(() => ({
    eq: jest.fn(() => ({
      order: jest.fn(() => Promise.resolve({ data, error: null })),
    })),
  })),
})

const createNotificationsResponse = (data) => ({
  select: jest.fn(() => ({
    or: jest.fn(() => ({
      ilike: jest.fn(() => ({
        order: jest.fn(() => ({
          limit: jest.fn(() => Promise.resolve({ data, error: null })),
        })),
      })),
    })),
  })),
})

describe('OrderTracking page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSupabaseChannel.mockReturnValue({
      on: jest.fn(function () { return this }),
      subscribe: jest.fn(),
    })
  })

  it('loads order and stops loading after successful fetch', async () => {
    const order = {
      id: 'o1',
      order_number: 'ORD-2024-000001',
      status: 'on_the_way',
      total: 250,
      buyer_id: 'u1',
      vendor_id: 'v1',
      driver_id: 'd1',
      created_at: '2024-06-15T10:00:00Z',
      shipping_address: 'المنزل، طنجة، حي المرسى',
      shipping_city: 'طنجة',
      shipping_phone: '0612345678',
      vendor: { store_name: 'متجر الخضار الطازجة', first_name: 'Ali', last_name: 'Ben', phone: '0699999999' },
      driver: { first_name: 'Said', last_name: 'Alami', phone: '0688888888', vehicle_type: 'شاحنة صغيرة', rating: 4.8 },
    }

    mockSupabaseFrom.mockImplementation((table) => {
      if (table === 'orders') return createOrderResponse(order)
      if (table === 'order_items') return createItemsResponse([])
      if (table === 'payments') return createPaymentsResponse([])
      if (table === 'notifications') return createNotificationsResponse([])
      return createItemsResponse([])
    })

    renderOrderTracking()

    await waitFor(() => expect(screen.getByText(/ORD-2024-000001/i)).toBeInTheDocument(), { timeout: 3000 })
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
  })

  it('does not call loadOrder in an infinite loop', async () => {
    const order = {
      id: 'o1',
      order_number: 'ORD-2024-000001',
      status: 'pending',
      total: 100,
      buyer_id: 'u1',
      vendor_id: 'v1',
      vendor: { store_name: 'Test Store', first_name: 'Ali', last_name: 'Ben' },
    }

    mockSupabaseFrom.mockImplementation((table) => {
      if (table === 'orders') return createOrderResponse(order)
      if (table === 'order_items') return createItemsResponse([])
      if (table === 'payments') return createPaymentsResponse([])
      if (table === 'notifications') return createNotificationsResponse([])
      return createItemsResponse([])
    })

    renderOrderTracking()

    await waitFor(() => expect(screen.getByText(/ORD-2024-000001/i)).toBeInTheDocument(), { timeout: 3000 })

    // Allow a small window for any extra renders, then ensure we did not spam supabase
    await new Promise((resolve) => setTimeout(resolve, 100))
    const orderCalls = mockSupabaseFrom.mock.calls.filter((call) => call[0] === 'orders')
    expect(orderCalls.length).toBeLessThanOrEqual(2)
  })
})
