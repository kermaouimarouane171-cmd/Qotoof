import React from 'react'
import { render, waitFor } from '@testing-library/react'

const mockNavigate = jest.fn()
const mockAddItem = jest.fn()

const mockChannel = { id: 'buyer-channel' }
const mockAuthState = {
  profile: { id: 'buyer-1' },
  user: { id: 'buyer-1' },
}

const mockFetchBuyerOrders = jest.fn()

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback, params) => {
      if (typeof fallback === 'string') return fallback
      if (params?.count != null) return `${params.count}`
      return _key
    },
  }),
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(() => mockAuthState),
}))

jest.mock('@/store/cartStore', () => ({
  useCartStore: jest.fn(() => ({ addItem: mockAddItem })),
}))

jest.mock('@/components/ui', () => {
  const StateSkeleton = ({ children }) => <div>{children}</div>
  StateSkeleton.Card = ({ children }) => <div>{children}</div>

  return {
    Card: ({ children }) => <div>{children}</div>,
    LoadingSpinner: () => <div>Loading</div>,
    EmptyState: () => <div>Empty</div>,
    StateSkeleton,
  }
})

jest.mock('@/services/ordersService', () => ({
  fetchBuyerOrders: (...args) => mockFetchBuyerOrders(...args),
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    channel: jest.fn(),
    removeChannel: jest.fn(),
    from: jest.fn(() => ({ insert: jest.fn().mockResolvedValue({ error: null }) })),
  },
}))

jest.mock('@/services/deliveries', () => ({
  ordersApi: {
    subscribeToBuyerOrders: jest.fn(),
    cancelOrder: jest.fn(),
    reorderItems: jest.fn(),
  },
  deliveriesApi: {
    getBuyerActiveDelivery: jest.fn().mockResolvedValue(null),
  },
}))

jest.mock('@/services/reviewService', () => ({
  __esModule: true,
  default: {
    canReviewOrder: jest.fn(() => true),
  },
}))

jest.mock('@/services/invoiceService', () => ({
  __esModule: true,
  default: {
    downloadOrderInvoice: jest.fn(),
  },
}))

jest.mock('@/services/loyalty', () => ({
  __esModule: true,
  default: {
    syncDeliveredOrderBenefits: jest.fn().mockResolvedValue({ ordersProcessed: 0 }),
  },
}))

jest.mock('@/components/buyer/OrderCard', () => {
  return function OrderCardMock() {
    return <div>Order Card</div>
  }
})

jest.mock('@/components/buyer/ReviewModal', () => {
  return function ReviewModalMock() {
    return null
  }
})

jest.mock('@/components/buyer/OrderFilters', () => {
  return function OrderFiltersMock() {
    return null
  }
})

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
    warn: jest.fn(),
  },
}))

const BuyerOrdersPage = require('@/pages/buyer/Orders').default
const { supabase } = require('@/services/supabase')

describe('Buyer orders realtime subscription', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    const builder = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(() => mockChannel),
    }
    supabase.channel.mockReturnValue(builder)
    mockAuthState.profile = { id: 'buyer-1' }
    mockAuthState.user = { id: 'buyer-1' }
    mockFetchBuyerOrders.mockResolvedValue({ data: [], error: null, total: 0 })
  })

  it('subscribes to buyer channel and removes it on unmount', async () => {
    const { unmount } = render(<BuyerOrdersPage />)

    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith('buyer-orders-buyer-1')
    })

    unmount()

    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel)
  })

  it('does not subscribe when buyer profile is missing', () => {
    mockAuthState.profile = null

    render(<BuyerOrdersPage />)

    expect(supabase.channel).not.toHaveBeenCalled()
  })
})
