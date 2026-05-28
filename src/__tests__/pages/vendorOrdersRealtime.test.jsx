import React from 'react'
import { render, waitFor } from '@testing-library/react'

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
  Button: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
  Modal: ({ isOpen, children }) => (isOpen ? <div>{children}</div> : null),
  ChatComponent: () => <div>Chat</div>,
  OrderTimeline: () => <div>Timeline</div>,
  EmptyState: () => <div>Empty</div>,
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
  formatPrice: (value) => `${value}`,
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
})
