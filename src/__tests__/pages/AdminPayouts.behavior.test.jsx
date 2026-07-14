import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const fromCalls = []
const rpcCalls = []
let mockPayoutsData = []
let mockPayoutsError = null
let mockAuditLogsData = []
let mockAuditLogsError = null
let mockUpdateError = null
let mockRpcError = null
let mockNotificationError = null

const resolveQuery = (table, operation) => {
  if (table === 'payouts' && operation === 'update') {
    return { data: null, error: mockUpdateError }
  }
  if (table === 'notifications') {
    return { data: null, error: mockNotificationError }
  }
  return { data: [], error: null }
}

const createBuilder = (table) => {
  let operation = 'select'
  const builder = {
    select: jest.fn(() => { operation = 'select'; return builder }),
    update: jest.fn(() => { operation = 'update'; return builder }),
    insert: jest.fn(() => { operation = 'insert'; return builder }),
    eq: jest.fn(() => builder),
    gte: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    then: (onFulfilled, onRejected) => Promise.resolve(resolveQuery(table, operation)).then(onFulfilled, onRejected),
  }
  return builder
}

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn((table) => {
      fromCalls.push(table)
      return createBuilder(table)
    }),
    rpc: jest.fn((fnName, params) => {
      rpcCalls.push({ fnName, params })
      return Promise.resolve({ data: null, error: mockRpcError })
    }),
  },
}))

jest.mock('@/modules/commissions', () => ({
  getAdminPayouts: jest.fn(),
  getPayoutFinancialAuditLogs: jest.fn(),
  updateAdminPayoutStatus: jest.fn(),
}))

jest.mock('react-i18next', () => {
  const t = (_key, fallback, options) => {
    if (typeof fallback === 'string' && fallback.includes('{{')) {
      return fallback.replace(/\{\{(\w+)\}\}/g, (_, key) => options?.[key] ?? '')
    }
    return typeof fallback === 'string' ? fallback : _key
  }
  return {
    useTranslation: () => ({ t }),
  }
})

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
  Card: ({ children }) => <div data-testid="card">{children}</div>,
  LoadingSpinner: () => <div data-testid="loading-spinner">Loading...</div>,
}))

jest.mock('@heroicons/react/24/outline', () => new Proxy({}, {
  get: () => () => null,
}))

jest.mock('date-fns', () => ({
  subDays: jest.fn((date, days) => new Date(date.getTime() - days * 24 * 60 * 60 * 1000)),
  format: jest.fn((date, fmt) => {
    if (!date) return ''
    const d = new Date(date)
    if (fmt === 'dd MMM yyyy') return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()}`
    if (fmt === 'dd/MM/yyyy') return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
    if (fmt === 'dd MMM yyyy HH:mm') return `${d.getDate()} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    return d.toISOString()
  }),
}))

const AdminPayouts = require('@/pages/admin/Payouts').default
const commissions = require('@/modules/commissions')

const createMockPayout = (overrides = {}) => ({
  id: 'payout-1',
  vendor_id: 'vendor-1',
  amount: 5000,
  status: 'pending',
  payment_method: 'bank_transfer',
  reference: 'REF001',
  notes: 'Monthly payout',
  created_at: '2026-06-01T00:00:00.000Z',
  updated_at: '2026-06-01T00:00:00.000Z',
  vendor: {
    id: 'vendor-1',
    first_name: 'Hassan',
    last_name: 'Benali',
    email: 'hassan@example.com',
    store_name: 'Souk Atlas',
    phone: '0611111111',
  },
  ...overrides,
})

describe('AdminPayouts — behavior tests', () => {
  beforeEach(() => {
    fromCalls.length = 0
    rpcCalls.length = 0
    mockPayoutsData = []
    mockPayoutsError = null
    mockAuditLogsData = []
    mockAuditLogsError = null
    mockUpdateError = null
    mockRpcError = null
    mockNotificationError = null
    const toast = require('react-hot-toast').default
    const { logger } = require('@/utils/logger')
    const { supabase } = require('@/services/supabase')
    toast.error.mockClear()
    toast.success.mockClear()
    logger.error.mockClear()
    logger.warn.mockClear()
    logger.info.mockClear()
    supabase.from.mockClear()
    supabase.rpc.mockClear()
    commissions.getAdminPayouts.mockClear()
    commissions.getPayoutFinancialAuditLogs.mockClear()
    commissions.updateAdminPayoutStatus.mockClear()
    commissions.getAdminPayouts.mockImplementation(async () => ({ data: mockPayoutsData, error: mockPayoutsError }))
    commissions.getPayoutFinancialAuditLogs.mockImplementation(async () => ({ data: mockAuditLogsData, error: mockAuditLogsError }))
    commissions.updateAdminPayoutStatus.mockImplementation(async () => ({ error: null }))
  })

  // 1. Loading state
  test('renders loading spinner initially', async () => {
    mockPayoutsData = []
    render(<AdminPayouts />)
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument()
    })
  })

  // 2. Successful payouts list render
  test('renders payouts list with vendor names after successful load', async () => {
    mockPayoutsData = [
      createMockPayout(),
      createMockPayout({ id: 'payout-2', vendor_id: 'vendor-2', vendor: { id: 'vendor-2', first_name: 'Salma', last_name: 'Alaoui', store_name: 'Rabat Fresh', email: 'salma@example.com' } }),
    ]
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
      expect(screen.getByText('Rabat Fresh')).toBeInTheDocument()
    })
  })

  // 3. Empty state
  test('renders empty state when no payouts exist', async () => {
    mockPayoutsData = []
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(screen.getByText('No Payouts Found')).toBeInTheDocument()
    })
  })

  // 4. Payouts select error
  test('handles payouts load error with toast.error', async () => {
    mockPayoutsError = new Error('Database connection failed')
    const toast = require('react-hot-toast').default
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load payouts')
    })
  })

  // 5. Read API called — getAdminPayouts
  test('calls getAdminPayouts from commissions module', async () => {
    mockPayoutsData = []
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(commissions.getAdminPayouts).toHaveBeenCalled()
    })
  })

  // 6. Status filter change triggers reload
  test('status filter change triggers data reload', async () => {
    mockPayoutsData = [createMockPayout()]
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
    })

    const initialCallCount = commissions.getAdminPayouts.mock.calls.length
    const selects = document.querySelectorAll('select')
    const statusSelect = selects[1]
    fireEvent.change(statusSelect, { target: { value: 'completed' } })

    await waitFor(() => {
      expect(commissions.getAdminPayouts.mock.calls.length).toBeGreaterThan(initialCallCount)
    })
  })

  // 7. Date range change triggers reload
  test('date range change triggers data reload', async () => {
    mockPayoutsData = [createMockPayout()]
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
    })

    const initialCallCount = commissions.getAdminPayouts.mock.calls.length
    const selects = document.querySelectorAll('select')
    const dateRangeSelect = selects[0]
    fireEvent.change(dateRangeSelect, { target: { value: '7d' } })

    await waitFor(() => {
      expect(commissions.getAdminPayouts.mock.calls.length).toBeGreaterThan(initialCallCount)
    })
  })

  // 8. Status update success path — updateAdminPayoutStatus called, success toast shown
  test('status update success: calls updateAdminPayoutStatus, shows success toast', async () => {
    mockPayoutsData = [createMockPayout({ status: 'pending' })]
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
    })

    const toast = require('react-hot-toast').default
    fireEvent.click(screen.getByText('Start Processing'))

    await waitFor(() => {
      expect(commissions.updateAdminPayoutStatus).toHaveBeenCalledWith({
        payoutId: 'payout-1',
        newStatus: 'processing',
        payout: expect.objectContaining({ id: 'payout-1', status: 'pending' }),
        currentUser: expect.objectContaining({ id: 'admin-1' }),
      })
      expect(toast.success).toHaveBeenCalledWith('Status updated')
    })
  })

  // 9. Status update — updateAdminPayoutStatus called with correct parameters
  test('status update calls updateAdminPayoutStatus with correct parameters', async () => {
    mockPayoutsData = [createMockPayout({ id: 'payout-1', status: 'pending', amount: 5000 })]
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Start Processing'))

    await waitFor(() => {
      expect(commissions.updateAdminPayoutStatus).toHaveBeenCalledTimes(1)
    })
    const callArgs = commissions.updateAdminPayoutStatus.mock.calls[0][0]
    expect(callArgs.payoutId).toBe('payout-1')
    expect(callArgs.newStatus).toBe('processing')
    expect(callArgs.payout).toEqual(expect.objectContaining({ id: 'payout-1', status: 'pending', amount: 5000 }))
    expect(callArgs.currentUser).toEqual(expect.objectContaining({ id: 'admin-1' }))
  })

  // 10. Payout update failure — error toast shown
  test('payout update failure: shows error toast when updateAdminPayoutStatus returns error', async () => {
    mockPayoutsData = [createMockPayout({ status: 'pending' })]
    commissions.updateAdminPayoutStatus.mockImplementation(async () => ({ error: new Error('Update failed') }))
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
    })

    const toast = require('react-hot-toast').default
    fireEvent.click(screen.getByText('Start Processing'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to update status')
    })
  })

  // 11. Notification failure after successful RPC — success toast shown (best-effort notification)
  // NOTE: With Phase 8.6 transactional RPC, audit is atomic with status update.
  // Notification is best-effort — updateAdminPayoutStatus returns no error when notification fails.
  test('notification failure after successful RPC: success toast shown (best-effort notification)', async () => {
    mockPayoutsData = [createMockPayout({ status: 'pending' })]
    // updateAdminPayoutStatus returns no error when notification fails (best-effort)
    commissions.updateAdminPayoutStatus.mockImplementation(async () => ({ error: null }))
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
    })

    const toast = require('react-hot-toast').default
    fireEvent.click(screen.getByText('Start Processing'))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Status updated')
    })
  })

  // 12. Side-effect failure after successful RPC — success toast shown (best-effort)
  // NOTE: With Phase 8.6 transactional RPC, status + audit are atomic.
  // Side-effect failures (notification) do not return error to the page.
  test('side-effect failure after successful RPC: success toast shown (best-effort)', async () => {
    mockPayoutsData = [createMockPayout({ status: 'pending' })]
    // updateAdminPayoutStatus returns no error when side-effect fails (best-effort)
    commissions.updateAdminPayoutStatus.mockImplementation(async () => ({ error: null }))
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
    })

    const toast = require('react-hot-toast').default
    fireEvent.click(screen.getByText('Start Processing'))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Status updated')
    })
  })

  // 13. Processing state — button shows "Processing..." during update
  test('processing state shows Processing text during status update', async () => {
    mockPayoutsData = [createMockPayout({ status: 'pending' })]
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Start Processing'))

    // The button should show "Processing..." while the update is in progress
    await waitFor(() => {
      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })
  })

  // 14. Audit modal — opens and shows audit logs
  test('audit modal opens and displays audit log entries', async () => {
    mockPayoutsData = [createMockPayout({ status: 'pending' })]
    mockAuditLogsData = [
      {
        id: 'log-1',
        action: 'manual_adjustment',
        previous_status: 'pending',
        new_status: 'processing',
        created_at: '2026-06-01T10:00:00.000Z',
        performed_by_profile: { first_name: 'Admin', last_name: 'User', role: 'admin' },
        reason: null,
      },
    ]
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
    })

    // Click the audit trail button (EyeIcon button)
    const auditButton = screen.getByTitle('View Audit Trail')
    fireEvent.click(auditButton)

    await waitFor(() => {
      expect(screen.getByText('Audit Trail')).toBeInTheDocument()
      expect(screen.getByText('manual adjustment')).toBeInTheDocument()
    })
  })

  // 15. Audit modal — empty state
  test('audit modal shows no logs message when audit logs are empty', async () => {
    mockPayoutsData = [createMockPayout({ status: 'pending' })]
    mockAuditLogsData = []
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTitle('View Audit Trail'))

    await waitFor(() => {
      expect(screen.getByText('No audit logs found')).toBeInTheDocument()
    })
  })

  // 16. Audit log select error — silently handled
  test('audit log select error is silently handled without crash', async () => {
    mockPayoutsData = [createMockPayout({ status: 'pending' })]
    mockAuditLogsError = new Error('Audit log query failed')
    const { logger } = require('@/utils/logger')
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTitle('View Audit Trail'))

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith('Error loading audit logs:', expect.any(Error))
    })
  })

  // 17. CSV/PDF export buttons are present
  test('CSV and PDF export buttons are present and clickable', async () => {
    mockPayoutsData = [createMockPayout()]
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
    })

    expect(screen.getByText('Export CSV')).toBeInTheDocument()
    expect(screen.getByText('Export PDF')).toBeInTheDocument()
  })

  // 18. CSV export with no data shows error toast
  test('CSV export with no payouts shows error toast', async () => {
    mockPayoutsData = []
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(screen.getByText('No Payouts Found')).toBeInTheDocument()
    })

    const toast = require('react-hot-toast').default
    fireEvent.click(screen.getByText('Export CSV'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('No data to export')
    })
  })

  // 19. Read API called — getPayoutFinancialAuditLogs when viewing audit
  test('calls getPayoutFinancialAuditLogs from commissions module when viewing audit trail', async () => {
    mockPayoutsData = [createMockPayout({ status: 'pending' })]
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTitle('View Audit Trail'))

    await waitFor(() => {
      expect(commissions.getPayoutFinancialAuditLogs).toHaveBeenCalled()
    })
  })
})
