import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

const fromCalls = []
let mockProfiles = []
let mockProducts = []
let mockReviews = []

const resolveQuery = (table, state) => {
  if (table === 'profiles') {
    const roleFilter = state.eqFilters.find((item) => item.column === 'role')
    const data = roleFilter?.value === 'vendor'
      ? mockProfiles.filter((row) => row.role === 'vendor')
      : mockProfiles
    return { data, error: null }
  }

  if (table === 'products') {
    const idsFilter = state.inFilters.find((item) => item.column === 'vendor_id')
    const data = idsFilter
      ? mockProducts.filter((row) => idsFilter.values.includes(row.vendor_id))
      : mockProducts
    return { data, error: null }
  }

  if (table === 'reviews') {
    const idsFilter = state.inFilters.find((item) => item.column === 'vendor_id')
    const data = idsFilter
      ? mockReviews.filter((row) => idsFilter.values.includes(row.vendor_id))
      : mockReviews
    return { data, error: null }
  }

  return { data: [], error: null }
}

const createBuilder = (table) => {
  const state = {
    eqFilters: [],
    inFilters: [],
  }

  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn((column, value) => {
      state.eqFilters.push({ column, value })
      return builder
    }),
    in: jest.fn((column, values) => {
      state.inFilters.push({ column, values })
      return Promise.resolve(resolveQuery(table, state))
    }),
    order: jest.fn(() => Promise.resolve(resolveQuery(table, state))),
  }

  return builder
}

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn((table) => {
      fromCalls.push(table)
      return createBuilder(table)
    }),
  },
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key, fallback) => (typeof fallback === 'string' ? fallback : _key),
  }),
}))

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    success: jest.fn(),
  },
}))

jest.mock('@/services/auditLogger', () => ({
  auditLogger: {
    logProfileAction: jest.fn().mockResolvedValue(null),
  },
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

jest.mock('@/components/ui', () => ({
  Card: ({ children }) => <div>{children}</div>,
  Badge: ({ children }) => <span>{children}</span>,
  Button: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
  LoadingSpinner: () => <div>loading</div>,
  Modal: ({ isOpen, children }) => (isOpen ? <div>{children}</div> : null),
}))

jest.mock('@heroicons/react/24/outline', () => new Proxy({}, {
  get: () => () => null,
}))

const AdminVendors = require('@/pages/admin/Vendors').default

describe('AdminVendors loading behavior', () => {
  beforeEach(() => {
    fromCalls.length = 0

    mockProfiles = [
      {
        id: 'vendor-1',
        role: 'vendor',
        first_name: 'Hassan',
        last_name: 'Benali',
        email: 'hassan@example.com',
        phone: '0611111111',
        city: 'Casablanca',
        country: 'Morocco',
        store_name: 'Souk Atlas',
        store_description: 'Fresh products',
        vendor_status: 'approved',
        is_verified: true,
        vendor_warning_count: 0,
        latitude: null,
        longitude: null,
        created_at: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'vendor-2',
        role: 'vendor',
        first_name: 'Salma',
        last_name: 'Alaoui',
        email: 'salma@example.com',
        phone: '0622222222',
        city: 'Rabat',
        country: 'Morocco',
        store_name: 'Rabat Fresh',
        store_description: 'Seasonal products',
        vendor_status: 'pending',
        is_verified: false,
        vendor_warning_count: 1,
        latitude: null,
        longitude: null,
        created_at: '2026-01-02T00:00:00.000Z',
      },
    ]

    mockProducts = [
      { vendor_id: 'vendor-1' },
      { vendor_id: 'vendor-1' },
      { vendor_id: 'vendor-2' },
    ]

    mockReviews = [
      { vendor_id: 'vendor-1', rating: 5 },
      { vendor_id: 'vendor-1', rating: 4 },
      { vendor_id: 'vendor-2', rating: 3 },
    ]
  })

  it('loads vendors without N+1 requests and exits loading state', async () => {
    render(<AdminVendors />)

    expect(screen.getByText('loading')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
      expect(screen.getByText('Rabat Fresh')).toBeInTheDocument()
    })

    expect(screen.queryByText('loading')).not.toBeInTheDocument()

    const profilesCalls = fromCalls.filter((table) => table === 'profiles').length
    const productsCalls = fromCalls.filter((table) => table === 'products').length
    const reviewsCalls = fromCalls.filter((table) => table === 'reviews').length

    expect(profilesCalls).toBe(1)
    expect(productsCalls).toBe(1)
    expect(reviewsCalls).toBe(1)
  })

  it('renders a clear empty state when no vendors exist', async () => {
    mockProfiles = []
    mockProducts = []
    mockReviews = []

    render(<AdminVendors />)

    await waitFor(() => {
      expect(screen.getByText('لا يوجد باعة مطابقون للفلاتر الحالية')).toBeInTheDocument()
    })

    expect(screen.queryByText('loading')).not.toBeInTheDocument()
  })
})
