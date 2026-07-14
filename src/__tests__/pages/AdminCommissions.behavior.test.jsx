import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

let mockPaymentsData = []
let mockPaymentsError = null
let mockSettings = { commission_rate: 10 }
let mockApiCallCount = 0
let mockApiCallArgs = []

jest.mock('@/modules/commissions', () => ({
  getAdminCommissionsPayments: jest.fn(({ period } = {}) => {
    mockApiCallCount++
    mockApiCallArgs.push({ period })
    return Promise.resolve({ data: mockPaymentsData, error: mockPaymentsError })
  }),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => (typeof fallback === 'string' ? fallback : _key),
  }),
}))

jest.mock('@/components/ui', () => ({
  Card: ({ children }) => <div data-testid="card">{children}</div>,
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}))

jest.mock('@heroicons/react/24/outline', () => new Proxy({}, {
  get: () => () => null,
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

jest.mock('@/modules/admin', () => ({
  platformSettings: {
    getSettings: jest.fn(() => Promise.resolve(mockSettings)),
  },
}))

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="chart-container">{children}</div>,
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
}))

const AdminCommissionsPage = require('@/pages/admin/Commissions').default

describe('AdminCommissionsPage — behavior tests', () => {
  beforeEach(() => {
    mockPaymentsData = []
    mockPaymentsError = null
    mockSettings = { commission_rate: 10 }
    mockApiCallCount = 0
    mockApiCallArgs = []
    jest.clearAllMocks()
  })

  // 1. Loading state
  test('renders loading spinner initially', async () => {
    mockPaymentsData = []
    render(<AdminCommissionsPage />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })
  })

  // 2. API call — calls getAdminCommissionsPayments
  test('calls getAdminCommissionsPayments API', async () => {
    mockPaymentsData = []
    render(<AdminCommissionsPage />)
    await waitFor(() => {
      expect(mockApiCallCount).toBeGreaterThanOrEqual(1)
    })
  })

  // 3. Successful data rendering — stats cards
  test('renders stats cards with computed commission values after data loads', async () => {
    const now = new Date()
    mockPaymentsData = [
      {
        id: 'p1',
        order_id: 'order-001',
        amount: 100,
        payment_method: 'bank_transfer',
        status: 'completed',
        created_at: new Date(now.getFullYear(), now.getMonth(), 15).toISOString(),
      },
      {
        id: 'p2',
        order_id: 'order-002',
        amount: 200,
        payment_method: 'cod',
        status: 'pending',
        created_at: new Date(now.getFullYear(), now.getMonth(), 10).toISOString(),
      },
    ]
    render(<AdminCommissionsPage />)
    await waitFor(() => {
      // totalCommission = (100 + 200) * 0.10 = 30.00
      // thisMonth = 30.00 (both payments in current month)
      // Both appear as '30.00 MAD' — use getAllByText
      expect(screen.getAllByText('30.00 MAD').length).toBeGreaterThanOrEqual(1)
      // avgCommission = 30 / 2 = 15.00
      expect(screen.getByText('15.00 MAD')).toBeInTheDocument()
    })
  })

  // 4. Successful data rendering — payments table
  test('renders recent payments table with payment rows after data loads', async () => {
    const now = new Date()
    mockPaymentsData = [
      {
        id: 'p1',
        order_id: 'order-001',
        amount: 100,
        payment_method: 'bank_transfer',
        status: 'completed',
        created_at: new Date(now.getFullYear(), now.getMonth(), 15).toISOString(),
      },
    ]
    render(<AdminCommissionsPage />)
    await waitFor(() => {
      // order_id is displayed as first 8 chars: 'order-00'
      expect(screen.getByText('order-00')).toBeInTheDocument()
      // amount displayed with .toFixed(2)
      expect(screen.getByText('100.00 MAD')).toBeInTheDocument()
      // commission = 100 * 0.10 = 10.00
      expect(screen.getByText('+10.00 MAD')).toBeInTheDocument()
      // vendor_amount = 100 * 0.90 = 90.00
      expect(screen.getByText('90.00 MAD')).toBeInTheDocument()
      // status badge
      expect(screen.getByText('completed')).toBeInTheDocument()
    })
  })

  // 5. Empty state
  test('renders empty state message when no payments exist', async () => {
    mockPaymentsData = []
    render(<AdminCommissionsPage />)
    await waitFor(() => {
      expect(screen.getByText('No transactions yet')).toBeInTheDocument()
    })
  })

  // 6. Error state — silently handled with logger.error
  test('handles API error gracefully without crashing', async () => {
    mockPaymentsError = new Error('Database connection failed')
    const { logger } = require('@/utils/logger')
    render(<AdminCommissionsPage />)
    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith('Load commissions error:', expect.any(Error))
    })
    // Page should not crash — loading spinner should disappear
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
  })

  // 7. Commission rate from platformSettings
  test('uses commission_rate from platformSettings to calculate commission', async () => {
    mockSettings = { commission_rate: 5 }
    const now = new Date()
    mockPaymentsData = [
      {
        id: 'p1',
        order_id: 'order-001',
        amount: 200,
        payment_method: 'bank_transfer',
        status: 'completed',
        created_at: new Date(now.getFullYear(), now.getMonth(), 15).toISOString(),
      },
    ]
    render(<AdminCommissionsPage />)
    await waitFor(() => {
      // commission = 200 * 0.05 = 10.00
      expect(screen.getByText('+10.00 MAD')).toBeInTheDocument()
      // vendor_amount = 200 * 0.95 = 190.00
      expect(screen.getByText('190.00 MAD')).toBeInTheDocument()
    })
  })

  // 8. Period change triggers reload
  test('period change triggers data reload', async () => {
    mockPaymentsData = [
      {
        id: 'p1',
        order_id: 'order-001',
        amount: 100,
        payment_method: 'bank_transfer',
        status: 'completed',
        created_at: new Date().toISOString(),
      },
    ]
    render(<AdminCommissionsPage />)
    await waitFor(() => {
      expect(screen.getByText('+10.00 MAD')).toBeInTheDocument()
    })

    const initialCallCount = mockApiCallCount
    const select = screen.getByLabelText('Analytics period')
    fireEvent.change(select, { target: { value: '7d' } })

    await waitFor(() => {
      expect(mockApiCallCount).toBeGreaterThan(initialCallCount)
    })
  })

  // 9. API called with correct period
  test('passes period to getAdminCommissionsPayments', async () => {
    mockPaymentsData = []
    render(<AdminCommissionsPage />)
    await waitFor(() => {
      expect(mockApiCallArgs).toContainEqual({ period: '30d' })
    })
  })

  // 10. Chart rendering — charts appear when data exists
  test('renders chart containers when chart data exists', async () => {
    const now = new Date()
    mockPaymentsData = [
      {
        id: 'p1',
        order_id: 'order-001',
        amount: 100,
        payment_method: 'bank_transfer',
        status: 'completed',
        created_at: new Date(now.getFullYear(), now.getMonth(), 15).toISOString(),
      },
    ]
    render(<AdminCommissionsPage />)
    await waitFor(() => {
      expect(screen.getAllByTestId('chart-container').length).toBeGreaterThanOrEqual(1)
    })
  })
})
