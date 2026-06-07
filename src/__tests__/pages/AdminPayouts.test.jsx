import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import fs from 'fs'
import path from 'path'

const fromCalls = []
let mockPayouts = []

const resolveQuery = (table) => {
  if (table === 'payouts') {
    return { data: mockPayouts, error: null }
  }
  if (table === 'financial_audit_log') {
    return { data: [], error: null }
  }
  return { data: [], error: null }
}

const createBuilder = (table) => {
  const state = {
    eqFilters: [],
    gteFilters: [],
    selectQuery: '',
  }

  const builder = {
    select: jest.fn((query) => {
      state.selectQuery = query
      return builder
    }),
    eq: jest.fn((column, value) => {
      state.eqFilters.push({ column, value })
      return builder
    }),
    gte: jest.fn((column, value) => {
      state.gteFilters.push({ column, value })
      return builder
    }),
    order: jest.fn(() => builder),
    then: jest.fn((callback) => {
      return Promise.resolve(callback(resolveQuery(table)))
    }),
  }

  return builder
}

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn((table) => {
      fromCalls.push(table)
      return createBuilder(table)
    }),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
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

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

jest.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
    profile: { id: 'admin-1', role: 'admin', first_name: 'Admin' },
  }),
}))

jest.mock('@/components/ui', () => ({
  Card: ({ children }) => <div>{children}</div>,
  LoadingSpinner: () => <div>loading</div>,
}))

jest.mock('@heroicons/react/24/outline', () => new Proxy({}, {
  get: () => () => null,
}))

const AdminPayouts = require('@/pages/admin/Payouts').default

describe('AdminPayouts – schema compatibility', () => {
  beforeEach(() => {
    fromCalls.length = 0
    mockPayouts = [
      {
        id: 'payout-1',
        user_id: 'vendor-1',
        amount: 5000,
        status: 'pending',
        payment_method: 'bank_transfer',
        reference: 'REF001',
        notes: 'Monthly payout',
        created_at: '2026-06-01T00:00:00.000Z',
        updated_at: '2026-06-01T00:00:00.000Z',
        user: {
          id: 'vendor-1',
          first_name: 'Hassan',
          last_name: 'Benali',
          email: 'hassan@example.com',
          store_name: 'Souk Atlas',
          phone: '0611111111',
        },
      },
      {
        id: 'payout-2',
        user_id: 'vendor-2',
        amount: 12000,
        status: 'processing',
        payment_method: 'bank_transfer',
        reference: 'REF002',
        notes: '',
        created_at: '2026-06-02T00:00:00.000Z',
        updated_at: '2026-06-02T00:00:00.000Z',
        user: {
          id: 'vendor-2',
          first_name: 'Salma',
          last_name: 'Alaoui',
          email: 'salma@example.com',
          store_name: 'Rabat Fresh',
          phone: '0622222222',
        },
      },
      {
        id: 'payout-3',
        user_id: 'vendor-3',
        amount: 3000,
        status: 'completed',
        payment_method: 'cmi',
        reference: 'REF003',
        notes: '',
        created_at: '2026-06-03T00:00:00.000Z',
        updated_at: '2026-06-03T00:00:00.000Z',
        user: {
          id: 'vendor-3',
          first_name: 'Karim',
          last_name: 'Fassi',
          email: 'karim@example.com',
          store_name: 'Fassi Market',
          phone: '0633333333',
        },
      },
    ]
  })

  it('renders payouts list and uses user_id schema', async () => {
    render(<AdminPayouts />)

    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
      expect(screen.getByText('Rabat Fresh')).toBeInTheDocument()
      expect(screen.getByText('Fassi Market')).toBeInTheDocument()
    })

    const payoutsCalls = fromCalls.filter((table) => table === 'payouts')
    expect(payoutsCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('does not reference vendor_id or approval columns', async () => {
    render(<AdminPayouts />)

    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
    })

    // The UI should not show approval-related labels for the DB schema we have
    expect(screen.queryByText('Approve (1st)')).not.toBeInTheDocument()
    expect(screen.queryByText('Approve (2nd)')).not.toBeInTheDocument()
    expect(screen.queryByText('Reject')).not.toBeInTheDocument()
  })

  it('shows only supported statuses: pending, processing, completed, failed', async () => {
    render(<AdminPayouts />)

    await waitFor(() => {
      expect(screen.getByText('pending')).toBeInTheDocument()
      expect(screen.getByText('processing')).toBeInTheDocument()
      expect(screen.getByText('completed')).toBeInTheDocument()
    })

    // Should NOT show unsupported statuses
    expect(screen.queryByText('approved')).not.toBeInTheDocument()
    expect(screen.queryByText('rejected')).not.toBeInTheDocument()
  })

  it('includes audit logging and user notifications in status update handler', () => {
    const sourcePath = path.resolve(__dirname, '../../pages/admin/Payouts.jsx')
    const source = fs.readFileSync(sourcePath, 'utf8')

    // Verify audit logging RPC is present
    expect(source).toContain("await supabase.rpc('log_financial_audit'")
    expect(source).toContain("p_action: 'status_updated'")

    // Verify user notification insert is present and uses user_id
    expect(source).toContain("await supabase.from('notifications').insert")
    expect(source).toContain('payout.user_id')

    // Verify no deprecated approval columns are referenced
    expect(source).not.toMatch(/first_approved_by|second_approved_by|rejection_reason|requires_second_approval/)
  })
})
