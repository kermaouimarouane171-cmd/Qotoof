import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

let mockPayoutsData = []
let mockPayoutsError = null
let mockAuditLogsData = []
let mockAuditLogsError = null
let mockUpdateStatusError = null

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
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
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    if (fmt === 'dd MMM yyyy') return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
    if (fmt === 'dd/MM/yyyy') return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
    if (fmt === 'dd MMM yyyy HH:mm') return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
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

describe('AdminPayouts — write-flow page tests (Phase 7.45)', () => {
  beforeEach(() => {
    mockPayoutsData = []
    mockPayoutsError = null
    mockAuditLogsData = []
    mockAuditLogsError = null
    mockUpdateStatusError = null
    const toast = require('react-hot-toast').default
    const { logger } = require('@/utils/logger')
    toast.error.mockClear()
    toast.success.mockClear()
    logger.error.mockClear()
    logger.warn.mockClear()
    logger.info.mockClear()
    commissions.getAdminPayouts.mockClear()
    commissions.getPayoutFinancialAuditLogs.mockClear()
    commissions.updateAdminPayoutStatus.mockClear()
    commissions.getAdminPayouts.mockImplementation(async () => ({ data: mockPayoutsData, error: mockPayoutsError }))
    commissions.getPayoutFinancialAuditLogs.mockImplementation(async () => ({ data: mockAuditLogsData, error: mockAuditLogsError }))
    commissions.updateAdminPayoutStatus.mockImplementation(async () => ({ error: mockUpdateStatusError }))
  })

  const renderWithPayout = async (overrides = {}) => {
    mockPayoutsData = [createMockPayout(overrides)]
    render(<AdminPayouts />)
    await waitFor(() => {
      expect(screen.getByText('Souk Atlas')).toBeInTheDocument()
    })
  }

  // 1. updateAdminPayoutStatus is called with correct params
  test('clicking Start Processing calls updateAdminPayoutStatus with payoutId, newStatus, payout, and currentUser', async () => {
    await renderWithPayout({ id: 'payout-1', status: 'pending', amount: 5000 })

    fireEvent.click(screen.getByText('Start Processing'))

    await waitFor(() => {
      expect(commissions.updateAdminPayoutStatus).toHaveBeenCalledTimes(1)
    })
    const args = commissions.updateAdminPayoutStatus.mock.calls[0][0]
    expect(args.payoutId).toBe('payout-1')
    expect(args.newStatus).toBe('processing')
    expect(args.payout).toEqual(expect.objectContaining({ id: 'payout-1', status: 'pending', amount: 5000 }))
    expect(args.currentUser).toEqual(expect.objectContaining({ id: 'admin-1' }))
  })

  // 2. Processing state cleanup after success
  test('processing state is cleared after successful status update', async () => {
    await renderWithPayout({ status: 'pending' })

    fireEvent.click(screen.getByText('Start Processing'))

    await waitFor(() => {
      expect(screen.getByText('Processing...')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.queryByText('Processing...')).not.toBeInTheDocument()
    })
  })

  // 3. Processing state cleanup after update failure
  test('processing state is cleared after updateAdminPayoutStatus returns error', async () => {
    mockUpdateStatusError = new Error('Update failed')
    await renderWithPayout({ status: 'pending' })

    fireEvent.click(screen.getByText('Start Processing'))

    await waitFor(() => {
      expect(require('react-hot-toast').default.error).toHaveBeenCalledWith('Failed to update status')
    })

    await waitFor(() => {
      expect(screen.queryByText('Processing...')).not.toBeInTheDocument()
    })
  })

  // 4. Processing state cleanup when API returns no error (non-transactional: audit/notification failures)
  test('processing state is cleared when updateAdminPayoutStatus returns no error (non-transactional behavior)', async () => {
    await renderWithPayout({ status: 'pending' })

    fireEvent.click(screen.getByText('Start Processing'))

    await waitFor(() => {
      expect(require('react-hot-toast').default.success).toHaveBeenCalledWith('Status updated')
    })

    await waitFor(() => {
      expect(screen.queryByText('Processing...')).not.toBeInTheDocument()
    })
  })

  // 5. Update failure shows error toast
  test('updateAdminPayoutStatus error: toast.error shown', async () => {
    mockUpdateStatusError = new Error('Update failed')
    await renderWithPayout({ status: 'pending' })

    fireEvent.click(screen.getByText('Start Processing'))

    await waitFor(() => {
      expect(require('react-hot-toast').default.error).toHaveBeenCalledWith('Failed to update status')
    })
  })

  // 6. Success shows success toast
  test('updateAdminPayoutStatus success: toast.success shown', async () => {
    await renderWithPayout({ status: 'pending' })

    fireEvent.click(screen.getByText('Start Processing'))

    await waitFor(() => {
      expect(require('react-hot-toast').default.success).toHaveBeenCalledWith('Status updated')
    })
  })

  // 7. Non-transactional behavior: API returns no error even when audit/notification fail
  test('non-transactional: API returns no error, page shows toast.success (preserved behavior)', async () => {
    await renderWithPayout({ status: 'pending' })

    fireEvent.click(screen.getByText('Start Processing'))

    const toast = require('react-hot-toast').default
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Status updated')
    })
    expect(toast.error).not.toHaveBeenCalled()
  })

  // 8. Reload after success
  test('successful write chain triggers loadPayouts reload', async () => {
    await renderWithPayout({ status: 'pending' })

    const initialCallCount = commissions.getAdminPayouts.mock.calls.length

    fireEvent.click(screen.getByText('Start Processing'))

    await waitFor(() => {
      expect(commissions.getAdminPayouts.mock.calls.length).toBeGreaterThan(initialCallCount)
    })
  })

  // 9. No reload after update failure
  test('update failure does not trigger loadPayouts reload', async () => {
    mockUpdateStatusError = new Error('Update failed')
    await renderWithPayout({ status: 'pending' })

    const initialCallCount = commissions.getAdminPayouts.mock.calls.length

    fireEvent.click(screen.getByText('Start Processing'))

    await waitFor(() => {
      expect(require('react-hot-toast').default.error).toHaveBeenCalled()
    })

    await new Promise(resolve => setTimeout(resolve, 100))
    expect(commissions.getAdminPayouts.mock.calls.length).toBe(initialCallCount)
  })

  // 10. Mark Completed button sends 'completed' status
  test('Mark Completed button calls updateAdminPayoutStatus with "completed"', async () => {
    await renderWithPayout({ status: 'processing' })

    fireEvent.click(screen.getByText('Mark Completed'))

    await waitFor(() => {
      expect(commissions.updateAdminPayoutStatus).toHaveBeenCalledTimes(1)
    })
    expect(commissions.updateAdminPayoutStatus.mock.calls[0][0].newStatus).toBe('completed')
  })

  // 11. Mark Failed button sends 'failed' status
  test('Mark Failed button calls updateAdminPayoutStatus with "failed"', async () => {
    await renderWithPayout({ status: 'processing' })

    fireEvent.click(screen.getByText('Mark Failed'))

    await waitFor(() => {
      expect(commissions.updateAdminPayoutStatus).toHaveBeenCalledTimes(1)
    })
    expect(commissions.updateAdminPayoutStatus.mock.calls[0][0].newStatus).toBe('failed')
  })

  // 12. Page does not call supabase directly for writes
  test('page does not call supabase.from or supabase.rpc directly for write operations', async () => {
    const { supabase } = require('@/services/supabase')
    await renderWithPayout({ status: 'pending' })

    fireEvent.click(screen.getByText('Start Processing'))

    await waitFor(() => {
      expect(commissions.updateAdminPayoutStatus).toHaveBeenCalledTimes(1)
    })

    expect(supabase.from).not.toHaveBeenCalled()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})
