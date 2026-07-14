import {
  commissionService,
  confirmSaleAndCalculate,
  closeMonthAndNotify,
  checkOverdueCommissions,
  submitPaymentNotice,
  confirmCommissionPayment,
  getCurrentMonthSummary,
  getVendorCommissionHistory,
  manuallyUnfreezeVendor,
} from '@/modules/commissions/api/commissionService'

import commissionServiceDefault from '@/modules/commissions/api/commissionService'

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'admin-test-user' } },
        error: null,
      }),
    },
  },
}))
jest.mock('@/services/platformSettings', () => ({
  getSettings: jest.fn().mockResolvedValue({ commission_rate: 3 }),
}))
jest.mock('@/config/appConfig', () => ({
  APP_CONFIG: { commissionRate: 0.03 },
}))
jest.mock('@/utils/sanitization', () => ({
  sanitizeText: jest.fn((text) => {
    if (!text || typeof text !== 'string') return ''
    return text.trim()
  }),
}))
jest.mock('@/utils/rateLimiter', () => ({
  enforceRateLimit: jest.fn(),
  checkCommissionPaymentNoticeRate: jest.fn(),
  rateLimiter: { check: jest.fn(), reset: jest.fn(), resetAll: jest.fn() },
  RATE_LIMITS: {},
}))
jest.mock('@/services/notifications', () => ({ notificationsApi: { create: jest.fn() } }))
jest.mock('@/modules/commissions/api/commissionNotifications', () => ({
  commissionNotifications: {
    afterConfirmedSale: jest.fn(),
    monthEndSummary: jest.fn(),
    reminder3Days: jest.fn(),
    dueToday: jest.fn(),
    accountFrozen: jest.fn(),
    paymentConfirmed: jest.fn(),
  },
}))
jest.mock('@/utils/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }))

const { supabase } = require('@/services/supabase')
const { notificationsApi } = require('@/services/notifications')
const { commissionNotifications } = require('@/modules/commissions/api/commissionNotifications')
const { logger } = require('@/utils/logger')

// Thenable chainable mock: `await chain` resolves to { data, error }
function createChain(resolved) {
  const chain = {}
  for (const m of ['select','insert','update','delete','eq','neq','gt','not','order','limit']) {
    chain[m] = jest.fn(() => chain)
  }
  chain.single = jest.fn().mockResolvedValue(resolved)
  chain.maybeSingle = jest.fn().mockResolvedValue(resolved)
  chain.then = (resolve, reject) => Promise.resolve(resolved).then(resolve, reject)
  return chain
}

// Per-table mock that cycles through responses for successive calls
function tableMock(...responses) {
  let i = 0
  return () => {
    const r = i < responses.length ? responses[i] : responses[responses.length - 1]
    i++
    return createChain(r)
  }
}

function setupFrom(mocks) {
  // Default profiles mock for requireAdmin() — returns admin role
  const defaultProfiles = tableMock({ data: { role: 'admin' }, error: null })
  supabase.from.mockImplementation((table) => {
    if (mocks[table]) return mocks[table]()
    if (table === 'profiles') return defaultProfiles()
    return createChain({ data: null, error: null })
  })
}

const OK = { data: null, error: null }
const NO = { data: null, error: { message: 'db error' } }

describe('commissionService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    supabase.rpc.mockResolvedValue({ data: null, error: null })
  })

  // ── Export surface ────────────────────────────────────────────────────
  describe('export surface', () => {
    test('commissionService is an object with 8 methods', () => {
      expect(typeof commissionService).toBe('object')
      expect(typeof commissionService.confirmSaleAndCalculate).toBe('function')
      expect(typeof commissionService.closeMonthAndNotify).toBe('function')
      expect(typeof commissionService.checkOverdueCommissions).toBe('function')
      expect(typeof commissionService.submitPaymentNotice).toBe('function')
      expect(typeof commissionService.confirmCommissionPayment).toBe('function')
      expect(typeof commissionService.getCurrentMonthSummary).toBe('function')
      expect(typeof commissionService.getVendorCommissionHistory).toBe('function')
      expect(typeof commissionService.manuallyUnfreezeVendor).toBe('function')
    })

    test('default export is the same object as named export', () => {
      expect(commissionServiceDefault).toBe(commissionService)
    })

    test('confirmSaleAndCalculate wrapper delegates', async () => {
      const spy = jest.spyOn(commissionService, 'confirmSaleAndCalculate').mockResolvedValue({ success: true })
      await confirmSaleAndCalculate('o1', 'v1', 100)
      expect(spy).toHaveBeenCalledWith('o1', 'v1', 100)
      spy.mockRestore()
    })

    test('closeMonthAndNotify wrapper delegates', async () => {
      const spy = jest.spyOn(commissionService, 'closeMonthAndNotify').mockResolvedValue({ success: true })
      await closeMonthAndNotify()
      expect(spy).toHaveBeenCalledWith()
      spy.mockRestore()
    })

    test('checkOverdueCommissions wrapper delegates', async () => {
      const spy = jest.spyOn(commissionService, 'checkOverdueCommissions').mockResolvedValue({ success: true })
      await checkOverdueCommissions()
      expect(spy).toHaveBeenCalledWith()
      spy.mockRestore()
    })

    test('submitPaymentNotice wrapper delegates', async () => {
      const spy = jest.spyOn(commissionService, 'submitPaymentNotice').mockResolvedValue({ success: true })
      await submitPaymentNotice('v1', 'm1', 'bank', 'ref')
      expect(spy).toHaveBeenCalledWith('v1', 'm1', 'bank', 'ref')
      spy.mockRestore()
    })

    test('confirmCommissionPayment wrapper delegates', async () => {
      const spy = jest.spyOn(commissionService, 'confirmCommissionPayment').mockResolvedValue({ success: true })
      await confirmCommissionPayment('v1', 6, 2026, 'bank', 'ref')
      expect(spy).toHaveBeenCalledWith('v1', 6, 2026, 'bank', 'ref')
      spy.mockRestore()
    })

    test('getCurrentMonthSummary wrapper delegates', async () => {
      const spy = jest.spyOn(commissionService, 'getCurrentMonthSummary').mockResolvedValue({ success: true })
      await getCurrentMonthSummary('v1')
      expect(spy).toHaveBeenCalledWith('v1')
      spy.mockRestore()
    })

    test('getVendorCommissionHistory wrapper delegates', async () => {
      const spy = jest.spyOn(commissionService, 'getVendorCommissionHistory').mockResolvedValue({ success: true })
      await getVendorCommissionHistory('v1')
      expect(spy).toHaveBeenCalledWith('v1')
      spy.mockRestore()
    })

    test('manuallyUnfreezeVendor wrapper delegates', async () => {
      const spy = jest.spyOn(commissionService, 'manuallyUnfreezeVendor').mockResolvedValue({ success: true })
      await manuallyUnfreezeVendor('v1', 'm1', 'note')
      expect(spy).toHaveBeenCalledWith('v1', 'm1', 'note')
      spy.mockRestore()
    })
  })

  // ── confirmSaleAndCalculate ───────────────────────────────────────────
  describe('confirmSaleAndCalculate', () => {
    test('returns error for missing orderId', async () => {
      const result = await commissionService.confirmSaleAndCalculate(null, 'v1', 100)
      expect(result.success).toBe(false)
      expect(result.error).toBe('بيانات البيع غير صالحة')
    })

    test('returns error for missing vendorId', async () => {
      const result = await commissionService.confirmSaleAndCalculate('o1', null, 100)
      expect(result.success).toBe(false)
      expect(result.error).toBe('بيانات البيع غير صالحة')
    })

    test('returns error for NaN saleAmount', async () => {
      const result = await commissionService.confirmSaleAndCalculate('o1', 'v1', 'abc')
      expect(result.success).toBe(false)
      expect(result.error).toBe('بيانات البيع غير صالحة')
    })

    test('returns error for zero saleAmount', async () => {
      const result = await commissionService.confirmSaleAndCalculate('o1', 'v1', 0)
      expect(result.success).toBe(false)
      expect(result.error).toBe('بيانات البيع غير صالحة')
    })

    test('returns error for negative saleAmount', async () => {
      const result = await commissionService.confirmSaleAndCalculate('o1', 'v1', -50)
      expect(result.success).toBe(false)
      expect(result.error).toBe('بيانات البيع غير صالحة')
    })

    test('returns error when order not found', async () => {
      setupFrom({ orders: tableMock({ data: null, error: null }) })
      const result = await commissionService.confirmSaleAndCalculate('o1', 'v1', 100)
      expect(result.success).toBe(false)
      expect(result.error).toBe('تعذر العثور على الطلب المرتبط بعملية البيع')
    })

    test('returns error when order query fails', async () => {
      setupFrom({ orders: tableMock({ data: null, error: { message: 'db error' } }) })
      const result = await commissionService.confirmSaleAndCalculate('o1', 'v1', 100)
      expect(result.success).toBe(false)
      expect(result.error).toBe('db error')
      expect(logger.error).toHaveBeenCalled()
    })

    test('returns already_recorded when transaction exists', async () => {
      setupFrom({
        orders: tableMock({ data: { id: 'o1', buyer_id: 'b1' }, error: null }),
        confirmed_transactions: tableMock({ data: { id: 'tx1', commission_amount: 3, monthly_sale_id: 'ms1' }, error: null }),
        vendor_monthly_sales: tableMock({ data: { id: 'ms1', commission_due: 15, total_sales: 500 }, error: null }),
      })
      const result = await commissionService.confirmSaleAndCalculate('o1', 'v1', 100)
      expect(result.success).toBe(true)
      expect(result.already_recorded).toBe(true)
      expect(result.commission_added).toBe(3)
      expect(result.total_this_month).toBe(15)
      expect(result.total_sales).toBe(500)
      expect(result.monthly_sale_id).toBe('ms1')
    })

    test('returns error when no active contract found', async () => {
      setupFrom({
        orders: tableMock({ data: { id: 'o1', buyer_id: 'b1' }, error: null }),
        confirmed_transactions: tableMock(OK),
        vendor_contracts: tableMock(OK),
      })
      const result = await commissionService.confirmSaleAndCalculate('o1', 'v1', 100)
      expect(result.success).toBe(false)
      expect(result.error).toBe('لا يمكن تأكيد البيع قبل توقيع العقد الرقمي')
    })

    test('succeeds when vendor contract is active (is_active ghost column removed)', async () => {
      setupFrom({
        orders: tableMock({ data: { id: 'o1', buyer_id: 'b1' }, error: null }),
        confirmed_transactions: tableMock(OK),
        vendor_contracts: tableMock({ data: { id: 'c1', is_active: true }, error: null }),
      })
      supabase.rpc.mockResolvedValue({
        data: { success: true, already_recorded: false, commission_amount: 3, total_sales: 100, commission_due: 3, monthly_sale_id: 'ms1' },
        error: null,
      })
      const result = await commissionService.confirmSaleAndCalculate('o1', 'v1', 100)
      expect(result.success).toBe(true)
      expect(result.commission_added).toBe(3)
    })

    test('succeeds and calculates 3% commission correctly', async () => {
      setupFrom({
        orders: tableMock({ data: { id: 'o1', buyer_id: 'b1' }, error: null }),
        confirmed_transactions: tableMock(OK),
        vendor_contracts: tableMock({ data: { id: 'c1', is_active: true }, error: null }),
      })
      supabase.rpc.mockResolvedValue({
        data: { success: true, already_recorded: false, commission_amount: 3, total_sales: 100, commission_due: 3, monthly_sale_id: 'ms1' },
        error: null,
      })
      const result = await commissionService.confirmSaleAndCalculate('o1', 'v1', 100)
      expect(result.success).toBe(true)
      expect(result.commission_added).toBe(3)
      expect(result.total_sales).toBe(100)
      expect(result.commission_so_far).toBe(3)
      expect(result.monthly_sale_id).toBe('ms1')
      expect(commissionNotifications.afterConfirmedSale).toHaveBeenCalledWith({
        vendorId: 'v1',
        saleAmount: 100,
        commissionSoFar: 3,
        orderId: 'o1',
      })
    })

    test('handles Supabase RPC error for confirm_sale_and_calculate_commission', async () => {
      setupFrom({
        orders: tableMock({ data: { id: 'o1', buyer_id: 'b1' }, error: null }),
        confirmed_transactions: tableMock(OK),
        vendor_contracts: tableMock({ data: { id: 'c1', is_active: true }, error: null }),
      })
      supabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } })
      const result = await commissionService.confirmSaleAndCalculate('o1', 'v1', 100)
      expect(result.success).toBe(false)
      expect(result.error).toBe('RPC failed')
      expect(logger.error).toHaveBeenCalled()
    })
  })

  // ── closeMonthAndNotify ───────────────────────────────────────────────
  describe('closeMonthAndNotify', () => {
    test('succeeds with processed count when there are monthly sales', async () => {
      setupFrom({
        vendor_monthly_sales: tableMock(
          { data: [{ id: 'ms1', vendor_id: 'v1', total_sales: 1000, commission_paid: 0, due_date: null }], error: null },
          OK,
          { data: { id: 'ms2' }, error: null },
        ),
        commission_notifications: tableMock(OK, OK),
      })
      const result = await commissionService.closeMonthAndNotify()
      expect(result.success).toBe(true)
      expect(result.processed).toBe(1)
    })

    test('succeeds with 0 processed when no monthly sales', async () => {
      setupFrom({ vendor_monthly_sales: tableMock({ data: [], error: null }) })
      const result = await commissionService.closeMonthAndNotify()
      expect(result.success).toBe(true)
      expect(result.processed).toBe(0)
    })

    test('returns error when select fails', async () => {
      setupFrom({ vendor_monthly_sales: tableMock(NO) })
      const result = await commissionService.closeMonthAndNotify()
      expect(result.success).toBe(false)
      expect(result.error).toBe('db error')
      expect(logger.error).toHaveBeenCalled()
    })

    test('triggers monthEndSummary notification for unpaid vendors', async () => {
      setupFrom({
        vendor_monthly_sales: tableMock(
          { data: [{ id: 'ms1', vendor_id: 'v1', total_sales: 1000, commission_paid: 0, due_date: null }], error: null },
          OK,
          { data: { id: 'ms2' }, error: null },
        ),
        commission_notifications: tableMock(OK, OK),
      })
      await commissionService.closeMonthAndNotify()
      expect(commissionNotifications.monthEndSummary).toHaveBeenCalled()
    })

    test('does not trigger notification for already paid vendors', async () => {
      setupFrom({
        vendor_monthly_sales: tableMock(
          { data: [{ id: 'ms1', vendor_id: 'v1', total_sales: 1000, commission_paid: 30, due_date: null }], error: null },
          OK,
          { data: { id: 'ms2' }, error: null },
        ),
      })
      await commissionService.closeMonthAndNotify()
      expect(commissionNotifications.monthEndSummary).not.toHaveBeenCalled()
    })
  })

  // ── checkOverdueCommissions ───────────────────────────────────────────
  describe('checkOverdueCommissions', () => {
    test('succeeds with zero counts when no pending commissions', async () => {
      setupFrom({ vendor_monthly_sales: tableMock({ data: [], error: null }) })
      const result = await commissionService.checkOverdueCommissions()
      expect(result.success).toBe(true)
      expect(result.reminders_sent).toBe(0)
      expect(result.due_today_sent).toBe(0)
      expect(result.frozen_accounts).toBe(0)
    })

    test('returns error when select fails', async () => {
      setupFrom({ vendor_monthly_sales: tableMock(NO) })
      const result = await commissionService.checkOverdueCommissions()
      expect(result.success).toBe(false)
      expect(result.error).toBe('db error')
      expect(logger.error).toHaveBeenCalled()
    })

    test('sends 3-day reminder when dueDate is 3 days away', async () => {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 3)
      dueDate.setHours(0, 0, 0, 0)
      setupFrom({
        vendor_monthly_sales: tableMock({ data: [{ id: 'ms1', vendor_id: 'v1', commission_due: 30, due_date: dueDate.toISOString() }], error: null }),
        commission_notifications: tableMock(OK, OK),
      })
      const result = await commissionService.checkOverdueCommissions()
      expect(result.reminders_sent).toBe(1)
      expect(commissionNotifications.reminder3Days).toHaveBeenCalledWith({
        vendorId: 'v1', amountDue: 30, dueDate: dueDate.toISOString(), monthlySaleId: 'ms1',
      })
    })

    test('sends due today alert when remainingDays is 0', async () => {
      const dueDate = new Date()
      dueDate.setHours(0, 0, 0, 0)
      setupFrom({
        vendor_monthly_sales: tableMock({ data: [{ id: 'ms1', vendor_id: 'v1', commission_due: 30, due_date: dueDate.toISOString() }], error: null }),
        commission_notifications: tableMock(OK, OK),
      })
      const result = await commissionService.checkOverdueCommissions()
      expect(result.due_today_sent).toBe(1)
      expect(commissionNotifications.dueToday).toHaveBeenCalled()
    })

    test('freezes account when dueDate is past (no profiles.is_active update)', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      setupFrom({
        vendor_monthly_sales: tableMock(
          { data: [{ id: 'ms1', vendor_id: 'v1', commission_due: 30, due_date: pastDate.toISOString() }], error: null },
          OK,
        ),
        commission_notifications: tableMock(OK, OK),
      })
      const result = await commissionService.checkOverdueCommissions()
      expect(result.frozen_accounts).toBe(1)
      expect(commissionNotifications.accountFrozen).toHaveBeenCalled()
    })

    test('does not send notification when one already exists (dedup)', async () => {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 3)
      dueDate.setHours(0, 0, 0, 0)
      setupFrom({
        vendor_monthly_sales: tableMock({ data: [{ id: 'ms1', vendor_id: 'v1', commission_due: 30, due_date: dueDate.toISOString() }], error: null }),
        commission_notifications: tableMock({ data: { id: 'existing-notif' }, error: null }),
      })
      const result = await commissionService.checkOverdueCommissions()
      expect(result.reminders_sent).toBe(0)
      expect(commissionNotifications.reminder3Days).not.toHaveBeenCalled()
    })

    // ── R-001 Regression Tests (Phase 7.35 + 7.37) ──────────────────────
    // These tests verify the fixed behavior of checkOverdueCommissions:
    // - Phase 7.35: notifications_skipped + logger.warn when dedup skips accountFrozen
    // - Phase 7.37: admin notification via notificationsApi.create when dedup skips accountFrozen
    // See: docs/architecture/phase-7-35-r001-minimal-fix-report.md
    // See: docs/architecture/phase-7-37-r001-option-e2-admin-notification-report.md

    test('R-001 regression: freezes vendor even when accountFrozen dedup skips notification', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      setupFrom({
        vendor_monthly_sales: tableMock(
          { data: [{ id: 'ms1', vendor_id: 'v1', commission_due: 30, due_date: pastDate.toISOString() }], error: null },
          OK,
        ),
        profiles: tableMock({ data: [{ id: 'admin1' }, { id: 'admin2' }], error: null }),
        commission_notifications: tableMock({ data: { id: 'existing-frozen-notif' }, error: null }, OK),
      })
      notificationsApi.create.mockResolvedValue({ id: 'n1' })
      const result = await commissionService.checkOverdueCommissions()
      expect(result.success).toBe(true)
      expect(result.frozen_accounts).toBe(1)
      expect(commissionNotifications.accountFrozen).not.toHaveBeenCalled()
    })

    test('R-001 regression: exposes notifications_skipped when freeze notification is skipped', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      setupFrom({
        vendor_monthly_sales: tableMock(
          { data: [{ id: 'ms1', vendor_id: 'v1', commission_due: 30, due_date: pastDate.toISOString() }], error: null },
          OK,
        ),
        profiles: tableMock({ data: [{ id: 'admin1' }, { id: 'admin2' }], error: null }),
        commission_notifications: tableMock({ data: { id: 'existing-frozen-notif' }, error: null }, OK),
      })
      notificationsApi.create.mockResolvedValue({ id: 'n1' })
      const result = await commissionService.checkOverdueCommissions()
      expect(result.notifications_skipped).toEqual([
        expect.objectContaining({
          vendor_id: 'v1',
          notification_type: 'account_frozen',
          reason: 'dedup',
          monthly_sale_id: 'ms1',
        }),
      ])
    })

    test('R-001 regression: emits logger.warn when freeze notification is skipped', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      setupFrom({
        vendor_monthly_sales: tableMock(
          { data: [{ id: 'ms1', vendor_id: 'v1', commission_due: 30, due_date: pastDate.toISOString() }], error: null },
          OK,
        ),
        profiles: tableMock({ data: [{ id: 'admin1' }, { id: 'admin2' }], error: null }),
        commission_notifications: tableMock({ data: { id: 'existing-frozen-notif' }, error: null }, OK),
      })
      notificationsApi.create.mockResolvedValue({ id: 'n1' })
      await commissionService.checkOverdueCommissions()
      expect(logger.warn).toHaveBeenCalledWith(
        'Account frozen but accountFrozen notification skipped due to dedup',
        expect.objectContaining({
          vendor_id: 'v1',
          notification_type: 'account_frozen',
          reason: 'dedup',
        }),
      )
    })

    test('R-001 regression: dedup blocks notification but not freeze', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      setupFrom({
        vendor_monthly_sales: tableMock(
          { data: [{ id: 'ms1', vendor_id: 'v1', commission_due: 30, due_date: pastDate.toISOString() }], error: null },
          OK,
        ),
        profiles: tableMock({ data: [{ id: 'admin1' }, { id: 'admin2' }], error: null }),
        commission_notifications: tableMock({ data: { id: 'existing-frozen-notif' }, error: null }, OK),
      })
      notificationsApi.create.mockResolvedValue({ id: 'n1' })
      const result = await commissionService.checkOverdueCommissions()
      expect(supabase.from).toHaveBeenCalledWith('profiles')
      expect(result.frozen_accounts).toBe(1)
      expect(commissionNotifications.accountFrozen).not.toHaveBeenCalled()
    })

    test('R-001 regression: normal freeze path sends accountFrozen when dedup allows', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      setupFrom({
        vendor_monthly_sales: tableMock(
          { data: [{ id: 'ms1', vendor_id: 'v1', commission_due: 30, due_date: pastDate.toISOString() }], error: null },
          OK,
        ),
        commission_notifications: tableMock(OK, OK),
      })
      const result = await commissionService.checkOverdueCommissions()
      expect(result.frozen_accounts).toBe(1)
      expect(commissionNotifications.accountFrozen).toHaveBeenCalledWith({
        vendorId: 'v1', amountDue: 30, monthlySaleId: 'ms1',
      })
      expect(logger.warn).not.toHaveBeenCalled()
    })

    test('R-001 regression: no freeze path produces no skipped notifications or warnings', async () => {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 3)
      dueDate.setHours(0, 0, 0, 0)
      setupFrom({
        vendor_monthly_sales: tableMock({ data: [{ id: 'ms1', vendor_id: 'v1', commission_due: 30, due_date: dueDate.toISOString() }], error: null }),
        commission_notifications: tableMock(OK, OK),
      })
      const result = await commissionService.checkOverdueCommissions()
      expect(result.frozen_accounts).toBe(0)
      expect(result.notifications_skipped).toEqual([])
      expect(logger.warn).not.toHaveBeenCalled()
    })

    // ── R-001 Phase 7.37: Admin Notification on Skipped Freeze ────────────

    test('R-001 Option E2: admin notification is sent when freeze notification is skipped by dedup', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      setupFrom({
        vendor_monthly_sales: tableMock(
          { data: [{ id: 'ms1', vendor_id: 'v1', commission_due: 30, due_date: pastDate.toISOString() }], error: null },
          OK,
        ),
        profiles: tableMock({ data: [{ id: 'admin1' }, { id: 'admin2' }], error: null }),
        commission_notifications: tableMock({ data: { id: 'existing-frozen-notif' }, error: null }, OK),
      })
      notificationsApi.create.mockResolvedValue({ id: 'n1' })
      const result = await commissionService.checkOverdueCommissions()
      expect(result.success).toBe(true)
      expect(result.notifications_skipped).toEqual([
        expect.objectContaining({
          vendor_id: 'v1',
          notification_type: 'account_frozen',
          reason: 'dedup',
          monthly_sale_id: 'ms1',
        }),
      ])
      expect(logger.warn).toHaveBeenCalled()
      expect(notificationsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'admin1',
          type: 'commission',
          data: expect.objectContaining({
            event: 'account_frozen_skipped',
            vendor_id: 'v1',
            monthly_sale_id: 'ms1',
            reason: 'dedup',
          }),
        }),
      )
      expect(notificationsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'admin2',
          type: 'commission',
          data: expect.objectContaining({
            event: 'account_frozen_skipped',
            vendor_id: 'v1',
            monthly_sale_id: 'ms1',
            reason: 'dedup',
          }),
        }),
      )
    })

    test('R-001 Option E2: admin notification failure does not fail checkOverdueCommissions', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      setupFrom({
        vendor_monthly_sales: tableMock(
          { data: [{ id: 'ms1', vendor_id: 'v1', commission_due: 30, due_date: pastDate.toISOString() }], error: null },
          OK,
        ),
        profiles: tableMock({ data: [{ id: 'admin1' }], error: null }),
        commission_notifications: tableMock({ data: { id: 'existing-frozen-notif' }, error: null }, OK),
      })
      notificationsApi.create.mockRejectedValue(new Error('notification service down'))
      const result = await commissionService.checkOverdueCommissions()
      expect(result.success).toBe(true)
      expect(result.frozen_accounts).toBe(1)
      expect(result.notifications_skipped).toEqual([
        expect.objectContaining({
          vendor_id: 'v1',
          notification_type: 'account_frozen',
          reason: 'dedup',
          monthly_sale_id: 'ms1',
        }),
      ])
    })

    test('R-001 Option E2: no admin notification when vendor accountFrozen is sent normally', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      setupFrom({
        vendor_monthly_sales: tableMock(
          { data: [{ id: 'ms1', vendor_id: 'v1', commission_due: 30, due_date: pastDate.toISOString() }], error: null },
          OK,
        ),
        commission_notifications: tableMock(OK, OK),
      })
      await commissionService.checkOverdueCommissions()
      expect(commissionNotifications.accountFrozen).toHaveBeenCalledWith({
        vendorId: 'v1', amountDue: 30, monthlySaleId: 'ms1',
      })
      expect(notificationsApi.create).not.toHaveBeenCalled()
    })

    test('R-001 Option E2: no admin notification when there is no freeze path', async () => {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 3)
      dueDate.setHours(0, 0, 0, 0)
      setupFrom({
        vendor_monthly_sales: tableMock({ data: [{ id: 'ms1', vendor_id: 'v1', commission_due: 30, due_date: dueDate.toISOString() }], error: null }),
        commission_notifications: tableMock(OK, OK),
      })
      await commissionService.checkOverdueCommissions()
      expect(notificationsApi.create).not.toHaveBeenCalled()
    })
  })

  // ── submitPaymentNotice ───────────────────────────────────────────────
  describe('submitPaymentNotice', () => {
    test('returns error when missing required fields', async () => {
      const result = await commissionService.submitPaymentNotice(null, 'm1', 'bank', 'ref')
      expect(result.success).toBe(false)
      expect(result.error).toBe('طريقة الدفع ومرجع العملية مطلوبان')
    })

    test('returns error when paymentMethod is missing', async () => {
      const result = await commissionService.submitPaymentNotice('v1', 'm1', '', 'ref')
      expect(result.success).toBe(false)
      expect(result.error).toBe('طريقة الدفع ومرجع العملية مطلوبان')
    })

    test('returns error when paymentReference is missing', async () => {
      const result = await commissionService.submitPaymentNotice('v1', 'm1', 'bank', '')
      expect(result.success).toBe(false)
      expect(result.error).toBe('طريقة الدفع ومرجع العملية مطلوبان')
    })

    test('returns error when monthly sale not found', async () => {
      setupFrom({ vendor_monthly_sales: tableMock(OK) })
      const result = await commissionService.submitPaymentNotice('v1', 'm1', 'bank', 'ref123')
      expect(result.success).toBe(false)
      expect(result.error).toBe('تعذر العثور على ملف العمولة المطلوب')
    })

    test('succeeds and notifies admins', async () => {
      setupFrom({
        vendor_monthly_sales: tableMock(
          { data: { id: 'm1', month: 6, year: 2026, commission_due: 30 }, error: null },
          OK,
        ),
        commission_notifications: tableMock(OK, OK),
        profiles: tableMock({ data: [{ id: 'admin1' }, { id: 'admin2' }], error: null }),
      })
      notificationsApi.create.mockResolvedValue({ id: 'n1' })
      const result = await commissionService.submitPaymentNotice('v1', 'm1', 'bank', 'ref123', 'note')
      expect(result.success).toBe(true)
      expect(result.month_label).toBeDefined()
      expect(notificationsApi.create).toHaveBeenCalledTimes(2)
    })

    test('handles Supabase error on monthly sale select', async () => {
      setupFrom({ vendor_monthly_sales: tableMock(NO) })
      const result = await commissionService.submitPaymentNotice('v1', 'm1', 'bank', 'ref')
      expect(result.success).toBe(false)
      expect(result.error).toBe('db error')
      expect(logger.error).toHaveBeenCalled()
    })
  })

  // ── confirmCommissionPayment ──────────────────────────────────────────
  describe('confirmCommissionPayment', () => {
    test('succeeds and marks as paid', async () => {
      const msData = { id: 'ms1', vendor_id: 'v1', commission_due: 30, commission_paid: 0, status: 'pending', payment_method: null, payment_reference: null }
      setupFrom({
        vendor_monthly_sales: tableMock({ data: msData, error: null }, OK),
        commission_notifications: tableMock(OK, OK),
      })
      const result = await commissionService.confirmCommissionPayment('v1', 6, 2026, 'bank', 'ref')
      expect(result.success).toBe(true)
      expect(result.paid_amount).toBe(30)
      expect(commissionNotifications.paymentConfirmed).toHaveBeenCalledWith({
        vendorId: 'v1', paidAmount: 30, monthlySaleId: 'ms1',
      })
    })

    test('returns already_paid when commission is already paid', async () => {
      const msData = { id: 'ms1', vendor_id: 'v1', commission_due: 30, commission_paid: 30, status: 'paid' }
      setupFrom({ vendor_monthly_sales: tableMock({ data: msData, error: null }) })
      const result = await commissionService.confirmCommissionPayment('v1', 6, 2026)
      expect(result.success).toBe(true)
      expect(result.already_paid).toBe(true)
      expect(commissionNotifications.paymentConfirmed).not.toHaveBeenCalled()
    })

    test('returns error when select fails', async () => {
      setupFrom({ vendor_monthly_sales: tableMock(NO) })
      const result = await commissionService.confirmCommissionPayment('v1', 6, 2026)
      expect(result.success).toBe(false)
      expect(result.error).toBe('db error')
      expect(logger.error).toHaveBeenCalled()
    })

    test('uses default payment method from row when not provided', async () => {
      const msData = { id: 'ms1', vendor_id: 'v1', commission_due: 30, commission_paid: 0, status: 'pending', payment_method: 'paypal', payment_reference: 'pp-ref' }
      setupFrom({
        vendor_monthly_sales: tableMock({ data: msData, error: null }, OK),
        commission_notifications: tableMock(OK, OK),
      })
      const result = await commissionService.confirmCommissionPayment('v1', 6, 2026)
      expect(result.success).toBe(true)
    })
  })

  // ── getCurrentMonthSummary ────────────────────────────────────────────
  describe('getCurrentMonthSummary', () => {
    test('succeeds and returns summary with transactions', async () => {
      const monthlyData = { id: 'ms1', month: 6, year: 2026, total_sales: 1000, commission_due: 30, commission_paid: 0, status: 'active', due_date: null, paid_at: null, payment_method: null, payment_reference: null }
      setupFrom({
        vendor_monthly_sales: tableMock({ data: monthlyData, error: null }),
        confirmed_transactions: tableMock({ data: [{ id: 'tx1', commission_amount: 3 }], error: null }),
      })
      const result = await commissionService.getCurrentMonthSummary('v1')
      expect(result.success).toBe(true)
      expect(result.id).toBe('ms1')
      expect(result.total_sales).toBe(1000)
      expect(result.commission_due).toBe(30)
      expect(result.balance_remaining).toBe(30)
      expect(result.transactions).toHaveLength(1)
      expect(result.account_active).toBe(true)
    })

    test('returns error when monthly sale query fails', async () => {
      setupFrom({ vendor_monthly_sales: tableMock(NO) })
      const result = await commissionService.getCurrentMonthSummary('v1')
      expect(result.success).toBe(false)
      expect(result.error).toBe('db error')
      expect(logger.error).toHaveBeenCalled()
    })

    test('returns account_active false when vendor monthly sale is overdue', async () => {
      const monthlyData = { id: 'ms1', month: 6, year: 2026, total_sales: 0, commission_due: 0, commission_paid: 0, status: 'overdue', due_date: null, paid_at: null, payment_method: null, payment_reference: null }
      setupFrom({
        vendor_monthly_sales: tableMock({ data: monthlyData, error: null }),
        confirmed_transactions: tableMock({ data: [], error: null }),
      })
      const result = await commissionService.getCurrentMonthSummary('v1')
      expect(result.success).toBe(true)
      expect(result.account_active).toBe(false)
    })
  })

  // ── getVendorCommissionHistory ────────────────────────────────────────
  describe('getVendorCommissionHistory', () => {
    test('succeeds and returns history with month labels', async () => {
      const historyData = [
        { id: 'ms1', month: 6, year: 2026, total_sales: 1000, commission_due: 30, commission_paid: 30 },
        { id: 'ms2', month: 5, year: 2026, total_sales: 500, commission_due: 15, commission_paid: 0 },
      ]
      setupFrom({ vendor_monthly_sales: tableMock({ data: historyData, error: null }) })
      const result = await commissionService.getVendorCommissionHistory('v1')
      expect(result.success).toBe(true)
      expect(result.history).toHaveLength(2)
      expect(result.history[0].month_label).toBeDefined()
      expect(result.history[0].balance_remaining).toBe(0)
      expect(result.history[1].balance_remaining).toBe(15)
    })

    test('succeeds with empty history', async () => {
      setupFrom({ vendor_monthly_sales: tableMock({ data: [], error: null }) })
      const result = await commissionService.getVendorCommissionHistory('v1')
      expect(result.success).toBe(true)
      expect(result.history).toHaveLength(0)
    })

    test('returns error when select fails', async () => {
      setupFrom({ vendor_monthly_sales: tableMock(NO) })
      const result = await commissionService.getVendorCommissionHistory('v1')
      expect(result.success).toBe(false)
      expect(result.error).toBe('db error')
      expect(logger.error).toHaveBeenCalled()
    })
  })

  // ── manuallyUnfreezeVendor ────────────────────────────────────────────
  describe('manuallyUnfreezeVendor', () => {
    test('returns error when note is missing', async () => {
      const result = await commissionService.manuallyUnfreezeVendor('v1', 'm1', '')
      expect(result.success).toBe(false)
      expect(result.error).toBe('الملاحظة مطلوبة قبل رفع التجميد يدوياً')
    })

    test('returns error when vendorId is missing', async () => {
      const result = await commissionService.manuallyUnfreezeVendor(null, 'm1', 'note')
      expect(result.success).toBe(false)
      expect(result.error).toBe('الملاحظة مطلوبة قبل رفع التجميد يدوياً')
    })

    test('returns error when monthlySaleId is missing', async () => {
      const result = await commissionService.manuallyUnfreezeVendor('v1', null, 'note')
      expect(result.success).toBe(false)
      expect(result.error).toBe('الملاحظة مطلوبة قبل رفع التجميد يدوياً')
    })

    test('returns error when monthly sale not found', async () => {
      setupFrom({ vendor_monthly_sales: tableMock(OK) })
      const result = await commissionService.manuallyUnfreezeVendor('v1', 'm1', 'note')
      expect(result.success).toBe(false)
      expect(result.error).toBe('تعذر العثور على ملف العمولة المطلوب')
    })

    test('succeeds and unfreezes account with notification', async () => {
      setupFrom({
        vendor_monthly_sales: tableMock(
          { data: { id: 'm1', month: 6, year: 2026 }, error: null },
          OK,
        ),
        commission_notifications: tableMock(OK, OK),
      })
      notificationsApi.create.mockResolvedValue({ id: 'n1' })
      const result = await commissionService.manuallyUnfreezeVendor('v1', 'm1', 'unfreeze note')
      expect(result.success).toBe(true)
      expect(result.due_date).toBeDefined()
      expect(result.month_label).toBeDefined()
      expect(notificationsApi.create).toHaveBeenCalledWith({
        user_id: 'v1',
        title: 'تم رفع تجميد الحساب مؤقتاً',
        message: expect.stringContaining('unfreeze note'),
        type: 'commission',
        data: expect.objectContaining({
          monthly_sale_id: 'm1',
          note: 'unfreeze note',
        }),
        is_read: false,
      })
    })

    test('handles Supabase error on monthly sale select', async () => {
      setupFrom({ vendor_monthly_sales: tableMock(NO) })
      const result = await commissionService.manuallyUnfreezeVendor('v1', 'm1', 'note')
      expect(result.success).toBe(false)
      expect(result.error).toBe('db error')
      expect(logger.error).toHaveBeenCalled()
    })

    test('uses default grace days of 3 when not provided', async () => {
      setupFrom({
        vendor_monthly_sales: tableMock(
          { data: { id: 'm1', month: 6, year: 2026 }, error: null },
          OK,
        ),
        commission_notifications: tableMock(OK, OK),
      })
      notificationsApi.create.mockResolvedValue({ id: 'n1' })
      const result = await commissionService.manuallyUnfreezeVendor('v1', 'm1', 'note')
      const dueDate = new Date(result.due_date)
      const now = new Date()
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      expect(diffDays).toBeGreaterThanOrEqual(2)
      expect(diffDays).toBeLessThanOrEqual(4)
    })
  })

  // ── Supabase table coverage ──────────────────────────────────────────
  describe('Supabase table coverage', () => {
    test('confirmSaleAndCalculate touches orders table', async () => {
      setupFrom({ orders: tableMock(OK) })
      await commissionService.confirmSaleAndCalculate('o1', 'v1', 100)
      expect(supabase.from).toHaveBeenCalledWith('orders')
    })

    test('confirmSaleAndCalculate touches confirmed_transactions table (idempotency check)', async () => {
      setupFrom({
        orders: tableMock({ data: { id: 'o1', buyer_id: 'b1' }, error: null }),
        confirmed_transactions: tableMock(OK),
        vendor_contracts: tableMock(OK),
      })
      supabase.rpc.mockResolvedValue({
        data: { success: true, already_recorded: false, commission_amount: 3, total_sales: 100, commission_due: 3, monthly_sale_id: 'ms1' },
        error: null,
      })
      await commissionService.confirmSaleAndCalculate('o1', 'v1', 100)
      expect(supabase.from).toHaveBeenCalledWith('confirmed_transactions')
    })

    test('confirmSaleAndCalculate touches vendor_contracts table', async () => {
      setupFrom({
        orders: tableMock({ data: { id: 'o1', buyer_id: 'b1' }, error: null }),
        confirmed_transactions: tableMock(OK),
        vendor_contracts: tableMock(OK),
      })
      supabase.rpc.mockResolvedValue({
        data: { success: true, already_recorded: false, commission_amount: 3, total_sales: 100, commission_due: 3, monthly_sale_id: 'ms1' },
        error: null,
      })
      await commissionService.confirmSaleAndCalculate('o1', 'v1', 100)
      expect(supabase.from).toHaveBeenCalledWith('vendor_contracts')
    })

    test('confirmSaleAndCalculate does NOT query profiles table for is_active (PB-004 regression)', async () => {
      setupFrom({
        orders: tableMock({ data: { id: 'o1', buyer_id: 'b1' }, error: null }),
        confirmed_transactions: tableMock(OK),
        vendor_contracts: tableMock({ data: { id: 'c1', is_active: true }, error: null }),
      })
      supabase.rpc.mockResolvedValue({
        data: { success: true, already_recorded: false, commission_amount: 3, total_sales: 100, commission_due: 3, monthly_sale_id: 'ms1' },
        error: null,
      })
      await commissionService.confirmSaleAndCalculate('o1', 'v1', 100)
      expect(supabase.from).not.toHaveBeenCalledWith('profiles')
    })

    test('checkOverdueCommissions touches commission_notifications table', async () => {
      const pastDate = new Date()
      pastDate.setDate(pastDate.getDate() - 5)
      setupFrom({
        vendor_monthly_sales: tableMock(
          { data: [{ id: 'ms1', vendor_id: 'v1', commission_due: 30, due_date: pastDate.toISOString() }], error: null },
          OK,
        ),
        commission_notifications: tableMock(OK, OK),
      })
      await commissionService.checkOverdueCommissions()
      expect(supabase.from).toHaveBeenCalledWith('commission_notifications')
    })
  })
})
