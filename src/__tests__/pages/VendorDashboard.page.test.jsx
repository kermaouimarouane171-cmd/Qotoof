import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockNavigate = jest.fn()

const mockAuthState = {
  profile: {
    id: 'vendor-1',
    role: 'vendor',
    store_name: 'متجر الأطلس',
    first_name: 'أحمد',
    agreement_accepted: true,
    driver_search_done: true,
    latitude: 33.57,
    longitude: -7.59,
    is_active: false,
    store_paused: false,
  },
}

const supabaseQueues = {
  products: [],
  orders: [],
  reviews: [],
  profiles: [],
}

const enqueue = (table, value) => {
  supabaseQueues[table].push(value)
}

const makeThenableBuilder = (table) => {
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    is: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    lt: jest.fn(() => builder),
    lte: jest.fn(() => builder),
    gt: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    in: jest.fn(() => builder),
    then: (resolve) => {
      const next = supabaseQueues[table].length ? supabaseQueues[table].shift() : { data: [], error: null, count: 0 }
      return Promise.resolve(next).then(resolve)
    },
  }
  return builder
}

const mockSupabaseFrom = jest.fn((table) => makeThenableBuilder(table))

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback, vars) => {
      if (typeof fallback === 'string' && vars?.name) return fallback.replace('{{name}}', vars.name)
      return fallback
    },
    i18n: { language: 'ar' },
  }),
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(() => mockAuthState),
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: (...args) => mockSupabaseFrom(...args),
  },
}))

jest.mock('@/services/realtime', () => ({
  realtimeService: {
    initialize: jest.fn(),
    subscribeToVendorOrders: jest.fn(() => ({ unsubscribe: jest.fn() })),
  },
}))

jest.mock('@/services/deliveries', () => ({
  ordersApi: {
    acceptOrder: jest.fn(),
    rejectOrder: jest.fn(),
  },
}))

jest.mock('@/components/ErrorBoundary', () => {
  return function ErrorBoundaryMock({ children }) {
    return children
  }
})

jest.mock('@/components/ui', () => ({
  Card: ({ children, className = '', ...props }) => <div className={className} {...props}>{children}</div>,
  LoadingSpinner: () => <div>Loading...</div>,
  VendorAlerts: () => <div>VendorAlerts</div>,
  VendorGuidelines: () => <div>VendorGuidelines</div>,
  StarRating: () => <div>StarRating</div>,
  Modal: ({ isOpen, children }) => (isOpen ? <div>{children}</div> : null),
  StateSkeleton: Object.assign(() => <div data-testid="skeleton" />, {
    Card: () => <div data-testid="skeleton-card" />,
    Table: () => <div data-testid="skeleton-table" />,
  }),
  ErrorState: ({ title, onRetry, retryLabel = 'إعادة المحاولة' }) => (
    <div>
      <h3>{title}</h3>
      {onRetry ? <button type="button" onClick={onRetry}>{retryLabel}</button> : null}
    </div>
  ),
}))

jest.mock('@/components/vendor/CommissionDashboard', () => () => <div>CommissionDashboard</div>)
jest.mock('@/components/vendor/StoreEvolutionNotification', () => () => <div>StoreEvolutionNotification</div>)
jest.mock('@/components/shared/PartnershipRequests', () => () => <div>PartnershipRequests</div>)
jest.mock('@/components/vendor/PendingOrdersPanel', () => () => <div>PendingOrdersPanel</div>)
jest.mock('@/components/vendor/RevenueChart', () => () => <div>RevenueChart</div>)
jest.mock('@/components/vendor/RecentOrdersWidget', () => () => <div>RecentOrdersWidget</div>)
jest.mock('@/components/vendor/VendorSetupChecklist', () => () => <div>VendorSetupChecklist</div>)

jest.mock('@/utils/currency', () => ({
  formatPrice: (value) => `${Number(value || 0).toFixed(0)} د.م`,
}))

jest.mock('@heroicons/react/24/outline', () => new Proxy({}, { get: () => () => null }))
jest.mock('@heroicons/react/24/solid', () => new Proxy({}, { get: () => () => null }))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

const VendorDashboardPage = require('@/pages/vendor/Dashboard').default

const renderPage = () => render(
  <MemoryRouter initialEntries={['/vendor/dashboard']}>
    <VendorDashboardPage />
  </MemoryRouter>,
)

describe('صفحة لوحة تحكم البائع /vendor/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    supabaseQueues.products = []
    supabaseQueues.orders = []
    supabaseQueues.reviews = []
    supabaseQueues.profiles = []

    // Default queues (Promise.all in loadDashboardData)
    enqueue('products', { data: null, error: null, count: 8 }) // productsCountResult
    enqueue('products', { data: [], error: null }) // lowStockResult
    enqueue('products', { data: [], error: null }) // outOfStockResult
    enqueue('orders', { data: [], error: null }) // todayOrdersResult
    enqueue('orders', { data: [], error: null }) // yesterdayOrdersResult
    enqueue('orders', { data: null, error: null, count: 12 }) // pendingCountResult
    enqueue('orders', { data: null, error: null, count: 4 }) // prevPendingCountResult
    enqueue('orders', { data: [], error: null }) // monthOrdersResult
    enqueue('orders', { data: [], error: null }) // prevMonthOrdersResult
    enqueue('reviews', { data: [], error: null }) // reviewsResult
    enqueue('orders', { data: [], error: null }) // pendingOrdersResult
    enqueue('orders', { data: [], error: null }) // recentOrdersResult
    enqueue('orders', { data: [], error: null }) // weekOrdersResult
    enqueue('products', { data: null, error: null, count: 0 }) // pendingApprovalsResult
  })

  it('يعرض الصفحة بدون crash وعنوان عربي', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('vendor-dashboard-page')).toBeInTheDocument()
    })

    expect(screen.getByText(/مرحباً،/)).toBeInTheDocument()
  })

  it('لا يعرض رموز $ أو USD', async () => {
    const { container } = renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('vendor-dashboard-page')).toBeInTheDocument()
    })

    expect(container.textContent).not.toMatch(/\\$|USD/)
  })

  it('يعرض حالة الخطأ مع إعادة المحاولة عند فشل التحميل', async () => {
    // First render fails by throwing (simulates transport error)
    mockSupabaseFrom.mockImplementationOnce(() => {
      throw new Error('فشل الاتصال')
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('تعذر تحميل لوحة التحكم')).toBeInTheDocument()
    })

    // Retry succeeds with defaults
    supabaseQueues.products = []
    supabaseQueues.orders = []
    supabaseQueues.reviews = []
    enqueue('products', { data: null, error: null, count: 8 })
    enqueue('products', { data: [], error: null })
    enqueue('products', { data: [], error: null })
    enqueue('orders', { data: [], error: null })
    enqueue('orders', { data: [], error: null })
    enqueue('orders', { data: null, error: null, count: 12 })
    enqueue('orders', { data: null, error: null, count: 4 })
    enqueue('orders', { data: [], error: null })
    enqueue('orders', { data: [], error: null })
    enqueue('reviews', { data: [], error: null })
    enqueue('orders', { data: [], error: null })
    enqueue('orders', { data: [], error: null })
    enqueue('orders', { data: [], error: null })
    enqueue('products', { data: null, error: null, count: 0 })

    fireEvent.click(screen.getByRole('button', { name: 'إعادة المحاولة' }))

    await waitFor(() => {
      expect(screen.getByTestId('vendor-dashboard-page')).toBeInTheDocument()
    })
  })

  it('يحتوي على pb-20 لتجنب تغطية شريط التنقل السفلي', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('vendor-dashboard-page')).toBeInTheDocument()
    })

    expect(screen.getByTestId('vendor-dashboard-page')).toHaveClass('pb-20')
  })
})

