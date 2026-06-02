import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockChannel = { id: 'vendor-channel' }

const mockAuthState = {
  profile: {
    id: 'vendor-1',
    store_name: 'Store',
    latitude: 33.57,
    longitude: -7.59,
  },
}

const mockFetchVendorOrders = jest.fn()

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => fallback,
    i18n: { language: 'en' },
  }),
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(() => mockAuthState),
}))

jest.mock('@/services/ordersService', () => ({
  fetchVendorOrders: (...args) => mockFetchVendorOrders(...args),
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}))

jest.mock('@/services/deliveries', () => ({
  ordersApi: {
    acceptOrder: jest.fn(),
    rejectOrder: jest.fn(),
  },
  deliveriesApi: {
    getAvailableDrivers: jest.fn().mockResolvedValue([]),
    assignDriver: jest.fn(),
  },
}))

jest.mock('@/components/ui', () => ({
  Card: ({ children }) => <div>{children}</div>,
  Badge: ({ children }) => <span>{children}</span>,
  Button: ({ children, onClick, className, type = 'button', ...props }) => (
    <button type={type} className={className} onClick={onClick} {...props}>{children}</button>
  ),
  Modal: ({ isOpen, children }) => (isOpen ? <div>{children}</div> : null),
  ChatComponent: () => <div>Chat</div>,
  OrderTimeline: () => <div>Timeline</div>,
  EmptyState: ({ title, description, actionLabel, onAction }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
      {actionLabel && <button onClick={onAction}>{actionLabel}</button>}
    </div>
  ),
  StateSkeleton: () => <div>Skeleton</div>,
  OrderCardSkeleton: () => <div>OrderCardSkeleton</div>,
}))

jest.mock('@/components/ErrorBoundary', () => {
  return function ErrorBoundaryMock({ children }) {
    return children
  }
})

jest.mock('@/components/maps/LiveDriverMap', () => {
  return function LiveDriverMapMock() {
    return <div>Map</div>
  }
})

jest.mock('@/utils/currency', () => ({
  formatPrice: (value) => `MAD ${Number(value).toFixed(2)}`,
}))

jest.mock('@heroicons/react/24/outline', () => new Proxy({}, {
  get: () => () => null,
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}))

const VendorOrdersPage = require('@/pages/vendor/Orders').default
const { supabase } = require('@/services/supabase')

describe('Vendor orders realtime subscription', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetchVendorOrders.mockResolvedValue({ data: [], error: null })
    const builder = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(() => mockChannel),
    }
    supabase.channel.mockReturnValue(builder)
    mockAuthState.profile = {
      id: 'vendor-1',
      store_name: 'Store',
      latitude: 33.57,
      longitude: -7.59,
    }
  })

  it('subscribes to vendor channel and removes it on unmount', async () => {
    const { unmount } = render(<VendorOrdersPage />)

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith('vendor-orders-vendor-1')
    })

    unmount()

    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel)
  })

  it('does not subscribe when vendor profile is missing', () => {
    mockAuthState.profile = null

    render(<VendorOrdersPage />)

    expect(supabase.channel).not.toHaveBeenCalled()
  })

  it('shows empty state when no orders exist', async () => {
    mockFetchVendorOrders.mockResolvedValueOnce({ data: [], error: null })

    render(<VendorOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('لا توجد طلبات حالياً')).toBeInTheDocument()
    })
  })

  it('renders order amount in MAD and no dollar sign', async () => {
    mockFetchVendorOrders.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          order_number: 'ORD-100',
          created_at: '2025-01-01T12:00:00Z',
          status: 'pending',
          total_amount: 150,
          payment_method: 'cash',
          payment_status: 'pending',
          items: [{}, {}],
        },
      ],
      error: null,
    })

    const { container } = render(<VendorOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('MAD 150.00')).toBeInTheDocument()
      expect(container.textContent).not.toContain('$')
    })
  })

  it('shows pending order actions accept and reject', async () => {
    mockFetchVendorOrders.mockResolvedValueOnce({
      data: [
        {
          id: 'o2',
          order_number: 'ORD-101',
          created_at: '2025-01-01T12:00:00Z',
          status: 'pending',
          total_amount: 200,
          payment_method: 'cod',
          payment_status: 'pending',
          items: [{}, {}],
        },
      ],
      error: null,
    })

    render(<VendorOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('قبول')).toBeInTheDocument()
      expect(screen.getByText('رفض')).toBeInTheDocument()
    })
  })

  it('uses overflow-x-hidden on the root page wrapper', async () => {
    mockFetchVendorOrders.mockResolvedValueOnce({ data: [], error: null })

    const { container } = render(<VendorOrdersPage />)

    await waitFor(() => {
      expect(container.querySelector('div')).toHaveClass('overflow-x-hidden')
    })
  })

  it('shows Arabic page title', async () => {
    mockFetchVendorOrders.mockResolvedValueOnce({ data: [], error: null })

    const { container } = render(<VendorOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('إدارة الطلبات')).toBeInTheDocument()
    })
  })

  it('shows Arabic status badge for pending orders', async () => {
    mockFetchVendorOrders.mockResolvedValueOnce({
      data: [
        {
          id: 'o1',
          order_number: 'ORD-100',
          created_at: '2025-01-01T12:00:00Z',
          status: 'pending',
          total_amount: 150,
          payment_method: 'cash',
          payment_status: 'pending',
          items: [{}, {}],
        },
      ],
      error: null,
    })

    const { container } = render(<VendorOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('جديدة')).toBeInTheDocument()
      expect(container.textContent).not.toContain('Pending')
    })
  })

  it('shows Arabic status badge for vendor_accepted orders', async () => {
    mockFetchVendorOrders.mockResolvedValueOnce({
      data: [
        {
          id: 'o2',
          order_number: 'ORD-101',
          created_at: '2025-01-01T12:00:00Z',
          status: 'vendor_accepted',
          total_amount: 200,
          payment_method: 'cod',
          payment_status: 'pending',
          items: [{}, {}],
        },
      ],
      error: null,
    })

    const { container } = render(<VendorOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('قيد التحضير')).toBeInTheDocument()
      expect(container.textContent).not.toContain('Accepted')
    })
  })

  it('shows confirmation dialog when rejecting order', async () => {
    mockFetchVendorOrders.mockResolvedValueOnce({
      data: [
        {
          id: 'o3',
          order_number: 'ORD-102',
          created_at: '2025-01-01T12:00:00Z',
          status: 'pending',
          total_amount: 300,
          payment_method: 'cod',
          payment_status: 'pending',
          items: [{}, {}],
        },
      ],
      error: null,
    })

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)

    render(<VendorOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('رفض')).toBeInTheDocument()
    })

    const rejectButton = screen.getByText('رفض')
    fireEvent.click(rejectButton)

    expect(confirmSpy).toHaveBeenCalledWith('هل أنت متأكد من رفض هذا الطلب؟')

    confirmSpy.mockRestore()
  })

  it('does not reject order when confirmation is cancelled', async () => {
    mockFetchVendorOrders.mockResolvedValueOnce({
      data: [
        {
          id: 'o4',
          order_number: 'ORD-103',
          created_at: '2025-01-01T12:00:00Z',
          status: 'pending',
          total_amount: 400,
          payment_method: 'cod',
          payment_status: 'pending',
          items: [{}, {}],
        },
      ],
      error: null,
    })

    const { ordersApi } = require('@/services/deliveries')
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false)

    render(<VendorOrdersPage />)

    await waitFor(() => {
      expect(screen.getByText('رفض')).toBeInTheDocument()
    })

    const rejectButton = screen.getByText('رفض')
    fireEvent.click(rejectButton)

    expect(ordersApi.rejectOrder).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  it('has padding-bottom for mobile safe area', async () => {
    mockFetchVendorOrders.mockResolvedValueOnce({ data: [], error: null })

    const { container } = render(<VendorOrdersPage />)

    await waitFor(() => {
      expect(container.querySelector('div')).toHaveClass('pb-20')
    })
  })
})
