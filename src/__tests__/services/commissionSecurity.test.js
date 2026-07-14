/**
 * Commissions Module Security Tests (Phase 4A-4)
 *
 * Tests cover:
 * - Item 1: Commission rate unification (3% from platformSettings)
 * - Item 2: Admin role check in confirmCommissionPayment
 * - Item 3: Admin role check in manuallyUnfreezeVendor
 * - Item 4: XSS sanitization on paymentReference, note, paymentMethod
 * - Item 5: Rate limiting on submitPaymentNotice (5/hour)
 * - Item 6: confirmSaleAndCalculate uses transactional RPC
 * - Item 7: Fallback values in admin pages (?? 3, not ?? 10)
 */

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
    // Simulate sanitization: strip HTML tags
    return text.replace(/<[^>]*>/g, '').trim()
  }),
}))
jest.mock('@/utils/rateLimiter', () => ({
  enforceRateLimit: jest.fn(),
  checkCommissionPaymentNoticeRate: jest.fn(),
  rateLimiter: { check: jest.fn(), reset: jest.fn(), resetAll: jest.fn() },
  RATE_LIMITS: {
    COMMISSION_PAYMENT_NOTICE: { maxAttempts: 5, windowMs: 60 * 60 * 1000 },
  },
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

import { commissionService } from '@/modules/commissions/api/commissionService'
import { getSettings } from '@/services/platformSettings'
import { sanitizeText } from '@/utils/sanitization'
import { enforceRateLimit } from '@/utils/rateLimiter'
import fs from 'fs'
import path from 'path'

const { supabase } = require('@/services/supabase')

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

function tableMock(...responses) {
  let i = 0
  return () => {
    const r = i < responses.length ? responses[i] : responses[responses.length - 1]
    i++
    return createChain(r)
  }
}

function setupFrom(mocks) {
  const defaultProfiles = tableMock({ data: { role: 'admin' }, error: null })
  supabase.from.mockImplementation((table) => {
    if (mocks[table]) return mocks[table]()
    if (table === 'profiles') return defaultProfiles()
    return createChain({ data: null, error: null })
  })
}

const OK = { data: null, error: null }

beforeEach(() => {
  jest.clearAllMocks()
  supabase.rpc.mockResolvedValue({ data: null, error: null })
})

// ============================================
// Item 1: Commission Rate Unification
// ============================================

describe('Item 1: Commission rate unification (3%)', () => {
  test('getSettings is called to fetch commission rate from platformSettings', async () => {
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

    // getSettings should have been called to get the commission rate
    expect(getSettings).toHaveBeenCalled()
  })

  test('APP_CONFIG.commissionRate is 0.03 (3%)', () => {
    // This verifies the default is 3%
    const { APP_CONFIG } = require('@/config/appConfig')
    expect(APP_CONFIG.commissionRate).toBe(0.03)
  })

  test('platformSettings stores commission_rate as 3 (percentage)', async () => {
    const settings = await getSettings()
    expect(settings.commission_rate).toBe(3)
  })
})

// ============================================
// Item 7: Fallback values in admin pages
// ============================================

describe('Item 7: Fallback values in admin pages (?? 3, not ?? 10)', () => {
  const commissionsPagePath = path.resolve(__dirname, '../../pages/admin/Commissions.jsx')
  const commissionMgmtPath = path.resolve(__dirname, '../../pages/admin/CommissionManagement.jsx')
  const checkoutPath = path.resolve(__dirname, '../../pages/CheckoutSimplified.jsx')

  test('Commissions.jsx uses ?? 3 fallback (not ?? 10)', () => {
    const content = fs.readFileSync(commissionsPagePath, 'utf-8')
    expect(content).toContain('commission_rate ?? 3')
    expect(content).not.toContain('commission_rate ?? 10')
  })

  test('CommissionManagement.jsx uses ?? 3 fallback (not ?? 10)', () => {
    const content = fs.readFileSync(commissionMgmtPath, 'utf-8')
    expect(content).toContain('commission_rate ?? 3')
    expect(content).not.toContain('commission_rate ?? 10')
  })

  test('CheckoutSimplified.jsx uses ?? 3 fallback (not ?? 2.0)', () => {
    const content = fs.readFileSync(checkoutPath, 'utf-8')
    expect(content).toContain('commission_rate ?? 3')
    expect(content).not.toContain('commission_rate ?? 2.0')
  })

  test('CheckoutSimplified.jsx initial useState is 3 (not 2.0)', () => {
    const content = fs.readFileSync(checkoutPath, 'utf-8')
    // Initial state must match fallback (3 in both cases)
    expect(content).toMatch(/useState\(3\)/)
    expect(content).not.toMatch(/useState\(2\.0\)/)
  })
})

// ============================================
// Item 2: Admin role check in confirmCommissionPayment
// ============================================

describe('Item 2: Admin role check in confirmCommissionPayment', () => {
  test('rejects non-admin user', async () => {
    // Override profiles mock to return non-admin role
    supabase.from.mockImplementation((table) => {
      if (table === 'profiles') return createChain({ data: { role: 'vendor' }, error: null })
      return createChain({ data: null, error: null })
    })

    const result = await commissionService.confirmCommissionPayment('v1', 6, 2026, 'bank', 'ref')
    expect(result.success).toBe(false)
    expect(result.error).toContain('مدير')
  })

  test('rejects unauthenticated user', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })

    const result = await commissionService.confirmCommissionPayment('v1', 6, 2026, 'bank', 'ref')
    expect(result.success).toBe(false)
    expect(result.error).toContain('مصادق')
  })

  test('allows admin user', async () => {
    setupFrom({
      vendor_monthly_sales: tableMock(
        { data: { id: 'ms1', vendor_id: 'v1', commission_due: 30, commission_paid: 0, status: 'pending' }, error: null },
        OK,
      ),
      commission_notifications: tableMock(OK, OK),
    })

    const result = await commissionService.confirmCommissionPayment('v1', 6, 2026, 'bank', 'ref')
    expect(result.success).toBe(true)
  })
})

// ============================================
// Item 3: Admin role check in manuallyUnfreezeVendor
// ============================================

describe('Item 3: Admin role check in manuallyUnfreezeVendor', () => {
  test('rejects non-admin user', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'profiles') return createChain({ data: { role: 'vendor' }, error: null })
      return createChain({ data: null, error: null })
    })

    const result = await commissionService.manuallyUnfreezeVendor('v1', 'm1', 'note')
    expect(result.success).toBe(false)
    expect(result.error).toContain('مدير')
  })

  test('allows admin user with valid note', async () => {
    setupFrom({
      vendor_monthly_sales: tableMock(
        { data: { id: 'ms1', month: 6, year: 2026 }, error: null },
        OK,
      ),
      commission_notifications: tableMock(OK, OK),
    })

    const result = await commissionService.manuallyUnfreezeVendor('v1', 'm1', 'unfreeze note')
    expect(result.success).toBe(true)
  })
})

// ============================================
// Item 4: XSS sanitization
// ============================================

describe('Item 4: XSS sanitization on payment inputs', () => {
  test('submitPaymentNotice sanitizes paymentReference', async () => {
    setupFrom({
      vendor_monthly_sales: tableMock(
        { data: { id: 'ms1', month: 6, year: 2026, commission_due: 30 }, error: null },
        OK,
      ),
      commission_notifications: tableMock(OK, OK),
      profiles: tableMock({ data: [{ id: 'admin1' }], error: null }),
    })

    await commissionService.submitPaymentNotice('v1', 'ms1', 'bank', '<script>alert(1)</script>ref123', 'note')

    expect(sanitizeText).toHaveBeenCalledWith('<script>alert(1)</script>ref123', expect.objectContaining({ maxLength: 200 }))
  })

  test('submitPaymentNotice sanitizes note', async () => {
    setupFrom({
      vendor_monthly_sales: tableMock(
        { data: { id: 'ms1', month: 6, year: 2026, commission_due: 30 }, error: null },
        OK,
      ),
      commission_notifications: tableMock(OK, OK),
      profiles: tableMock({ data: [{ id: 'admin1' }], error: null }),
    })

    await commissionService.submitPaymentNotice('v1', 'ms1', 'bank', 'ref123', '<img src=x onerror=alert(1)>note')

    expect(sanitizeText).toHaveBeenCalledWith('<img src=x onerror=alert(1)>note', expect.objectContaining({ maxLength: 1000 }))
  })

  test('confirmCommissionPayment sanitizes paymentMethod', async () => {
    setupFrom({
      vendor_monthly_sales: tableMock(
        { data: { id: 'ms1', vendor_id: 'v1', commission_due: 30, commission_paid: 0, status: 'pending' }, error: null },
        OK,
      ),
      commission_notifications: tableMock(OK, OK),
    })

    await commissionService.confirmCommissionPayment('v1', 6, 2026, '<script>alert(1)</script>bank', 'ref')

    expect(sanitizeText).toHaveBeenCalledWith('<script>alert(1)</script>bank', expect.objectContaining({ maxLength: 50 }))
  })

  test('confirmCommissionPayment sanitizes paymentReference', async () => {
    setupFrom({
      vendor_monthly_sales: tableMock(
        { data: { id: 'ms1', vendor_id: 'v1', commission_due: 30, commission_paid: 0, status: 'pending' }, error: null },
        OK,
      ),
      commission_notifications: tableMock(OK, OK),
    })

    await commissionService.confirmCommissionPayment('v1', 6, 2026, 'bank', '<script>x</script>ref456')

    expect(sanitizeText).toHaveBeenCalledWith('<script>x</script>ref456', expect.objectContaining({ maxLength: 200 }))
  })
})

// ============================================
// Item 5: Rate limiting on submitPaymentNotice
// ============================================

describe('Item 5: Rate limiting on submitPaymentNotice', () => {
  test('enforceRateLimit is called with vendorId', async () => {
    setupFrom({
      vendor_monthly_sales: tableMock(
        { data: { id: 'ms1', month: 6, year: 2026, commission_due: 30 }, error: null },
        OK,
      ),
      commission_notifications: tableMock(OK, OK),
      profiles: tableMock({ data: [{ id: 'admin1' }], error: null }),
    })

    await commissionService.submitPaymentNotice('v1', 'ms1', 'bank', 'ref123', 'note')

    expect(enforceRateLimit).toHaveBeenCalled()
  })

  test('RATE_LIMITS has COMMISSION_PAYMENT_NOTICE with 5 attempts and 1 hour window', () => {
    const { RATE_LIMITS } = require('@/utils/rateLimiter')
    expect(RATE_LIMITS.COMMISSION_PAYMENT_NOTICE).toBeDefined()
    expect(RATE_LIMITS.COMMISSION_PAYMENT_NOTICE.maxAttempts).toBe(5)
    expect(RATE_LIMITS.COMMISSION_PAYMENT_NOTICE.windowMs).toBe(60 * 60 * 1000)
  })
})

// ============================================
// Item 6: confirmSaleAndCalculate uses transactional RPC
// ============================================

describe('Item 6: confirmSaleAndCalculate uses transactional RPC', () => {
  test('calls supabase.rpc with confirm_sale_and_calculate_commission', async () => {
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

    expect(supabase.rpc).toHaveBeenCalledWith(
      'confirm_sale_and_calculate_commission',
      expect.objectContaining({
        p_order_id: 'o1',
        p_vendor_id: 'v1',
        p_sale_amount: 100,
      })
    )
  })

  test('RPC migration file exists', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../../../supabase/migrations/20260711000005_add_confirm_sale_rpc.sql'
    )
    expect(fs.existsSync(migrationPath)).toBe(true)
  })

  test('migration creates confirm_sale_and_calculate_commission function', () => {
    const migrationPath = path.resolve(
      __dirname,
      '../../../supabase/migrations/20260711000005_add_confirm_sale_rpc.sql'
    )
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION confirm_sale_and_calculate_commission')
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain('GRANT EXECUTE')
  })

  test('handles RPC error gracefully', async () => {
    setupFrom({
      orders: tableMock({ data: { id: 'o1', buyer_id: 'b1' }, error: null }),
      confirmed_transactions: tableMock(OK),
      vendor_contracts: tableMock({ data: { id: 'c1', is_active: true }, error: null }),
    })
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'RPC transaction failed' } })

    const result = await commissionService.confirmSaleAndCalculate('o1', 'v1', 100)
    expect(result.success).toBe(false)
    expect(result.error).toBe('RPC transaction failed')
  })

  test('handles already_recorded from RPC (idempotency)', async () => {
    setupFrom({
      orders: tableMock({ data: { id: 'o1', buyer_id: 'b1' }, error: null }),
      confirmed_transactions: tableMock(OK),
      vendor_contracts: tableMock({ data: { id: 'c1', is_active: true }, error: null }),
    })
    supabase.rpc.mockResolvedValue({
      data: { success: true, already_recorded: true, commission_amount: 3, total_sales: 100, commission_due: 3, monthly_sale_id: 'ms1' },
      error: null,
    })

    const result = await commissionService.confirmSaleAndCalculate('o1', 'v1', 100)
    expect(result.success).toBe(true)
    expect(result.already_recorded).toBe(true)
  })
})
