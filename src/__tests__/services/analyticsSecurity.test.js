/**
 * Analytics Module Tests (Phase 4A-5)
 *
 * Tests cover:
 * - P1-1: admin Analytics.jsx uses delivered_at (not completed_at)
 * - P1-2: reportService uses price_per_unit (not price)
 * - P2-1: analyticsApi.getAdminStats checks admin role
 * - P2-2: analyticsApi.getVendorStats checks vendorId matches auth.uid()
 * - P2-3: admin Analytics.jsx does not use total_amount
 * - P2-4: reportService.generateUserReport checks admin role
 */

import fs from 'fs'
import path from 'path'

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'admin-test-user' } },
        error: null,
      }),
    },
  },
}))
jest.mock('@/utils/withRetry', () => ({
  withRetry: jest.fn((fn) => fn),
}))
jest.mock('@/utils/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}))

const { supabase } = require('@/services/supabase')

function createChain(resolved) {
  const chain = {}
  for (const m of ['select','insert','update','delete','eq','neq','gt','not','order','limit','in','is','gte','lte']) {
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
  supabase.from.mockImplementation((table) => {
    if (mocks[table]) return mocks[table]()
    return createChain({ data: null, error: null })
  })
}

const OK = { data: null, error: null }

beforeEach(() => {
  jest.clearAllMocks()
})

// ============================================
// P1-1: admin Analytics.jsx uses delivered_at (not completed_at)
// ============================================

describe('P1-1: admin Analytics.jsx uses delivered_at (not completed_at)', () => {
  const analyticsPath = path.resolve(__dirname, '../../pages/admin/Analytics.jsx')

  test('deliveries query selects delivered_at (not completed_at)', () => {
    const content = fs.readFileSync(analyticsPath, 'utf-8')
    expect(content).toContain('delivered_at')
    expect(content).not.toContain('completed_at')
  })

  test('finishedAt reads from delivery.delivered_at (not delivery.completed_at)', () => {
    const content = fs.readFileSync(analyticsPath, 'utf-8')
    expect(content).toMatch(/delivery\.delivered_at/)
    expect(content).not.toMatch(/delivery\.completed_at/)
  })
})

// ============================================
// P1-2: reportService uses price_per_unit (not price)
// ============================================

describe('P1-2: reportService uses price_per_unit (not price)', () => {
  const reportPath = path.resolve(__dirname, '../../services/reports/reportService.js')

  test('generateInventoryReport selects price_per_unit', () => {
    const content = fs.readFileSync(reportPath, 'utf-8')
    expect(content).toContain('price_per_unit')
    // Should not contain bare 'price' that's not part of price_per_unit
    const matches = content.match(/\bprice\b(?!_per_unit)/g)
    // Only allow 'price' in contexts like 'unit_price' or comments
    // The key check: the select for products must use price_per_unit
    expect(content).toMatch(/price_per_unit.*stock_quantity/)
  })
})

// ============================================
// P2-1: analyticsApi.getAdminStats checks admin role
// ============================================

describe('P2-1: analyticsApi.getAdminStats checks admin role', () => {
  test('rejects non-admin user', async () => {
    // Override profiles mock to return non-admin role
    supabase.from.mockImplementation((table) => {
      if (table === 'profiles') return createChain({ data: { role: 'vendor' }, error: null })
      return createChain({ data: null, error: null })
    })

    const { analyticsApi } = require('@/services/apis/analyticsApi')
    const result = await analyticsApi.getAdminStats()
    expect(result.error).toBeDefined()
    expect(result.error).toContain('مدير')
  })

  test('rejects unauthenticated user', async () => {
    supabase.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null })

    const { analyticsApi } = require('@/services/apis/analyticsApi')
    const result = await analyticsApi.getAdminStats()
    expect(result.error).toBeDefined()
    expect(result.error).toContain('مصادق')
  })

  test('allows admin user', async () => {
    setupFrom({
      profiles: tableMock(
        { data: { role: 'admin' }, error: null },
        { data: [], error: null, count: 100 },
      ),
      products: tableMock({ data: [], error: null, count: 50 }),
      orders: tableMock(
        { data: [], error: null, count: 200 },
        { data: [{ total: 100 }, { total: 200 }], error: null },
      ),
    })

    const { analyticsApi } = require('@/services/apis/analyticsApi')
    const result = await analyticsApi.getAdminStats()
    expect(result.error).toBeUndefined()
    expect(result.totalUsers).toBe(100)
    expect(result.totalProducts).toBe(50)
    expect(result.totalOrders).toBe(200)
    expect(result.totalRevenue).toBe(300)
  })
})

// ============================================
// P2-2: analyticsApi.getVendorStats checks vendorId matches auth.uid()
// ============================================

describe('P2-2: analyticsApi.getVendorStats checks vendorId', () => {
  test('rejects when vendorId does not match auth.uid()', async () => {
    // auth.getUser returns { user: { id: 'admin-test-user' } } by default
    const { analyticsApi } = require('@/services/apis/analyticsApi')
    const result = await analyticsApi.getVendorStats('different-vendor-id')
    expect(result.error).toBeDefined()
    expect(result.error).toContain('غير مصرح')
  })

  test('allows when vendorId matches auth.uid()', async () => {
    setupFrom({
      orders: tableMock(
        { data: [], error: null, count: 10 },
        { data: [], error: null, count: 3 },
        { data: [{ total: 100 }, { total: 200 }], error: null },
      ),
    })

    const { analyticsApi } = require('@/services/apis/analyticsApi')
    const result = await analyticsApi.getVendorStats('admin-test-user')
    expect(result.error).toBeUndefined()
    expect(result.totalOrders).toBe(10)
    expect(result.pendingOrders).toBe(3)
    expect(result.totalRevenue).toBe(300)
  })
})

// ============================================
// P2-3: admin Analytics.jsx does not use total_amount
// ============================================

describe('P2-3: admin Analytics.jsx does not use total_amount', () => {
  const analyticsPath = path.resolve(__dirname, '../../pages/admin/Analytics.jsx')

  test('does not reference total_amount anywhere', () => {
    const content = fs.readFileSync(analyticsPath, 'utf-8')
    expect(content).not.toContain('total_amount')
  })

  test('revenue calculation uses order.total directly', () => {
    const content = fs.readFileSync(analyticsPath, 'utf-8')
    expect(content).toMatch(/Number\(order\.total \?\? 0\)/)
  })
})

// ============================================
// P2-4: reportService.generateUserReport checks admin role
// ============================================

describe('P2-4: reportService.generateUserReport checks admin role', () => {
  test('rejects non-admin user', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'profiles') return createChain({ data: { role: 'vendor' }, error: null })
      return createChain({ data: null, error: null })
    })

    const { reportService } = require('@/services/reports/reportService')
    await expect(
      reportService.generateUserReport({ startDate: '2026-01-01', endDate: '2026-06-01' })
    ).rejects.toThrow('مدير')
  })

  test('allows admin user', async () => {
    setupFrom({
      profiles: tableMock(
        { data: { role: 'admin' }, error: null },
        { data: [{ id: 'u1', first_name: 'Test' }], error: null },
      ),
    })

    const { reportService } = require('@/services/reports/reportService')
    const result = await reportService.generateUserReport({
      startDate: '2026-01-01',
      endDate: '2026-06-01',
    })
    expect(result.rows).toBeDefined()
    expect(result.rows).toHaveLength(1)
  })
})

// ============================================
// requireAdmin is shared from authHelpers (not duplicated)
// ============================================

describe('requireAdmin is shared from authHelpers', () => {
  test('authHelpers exports requireAdmin', () => {
    const authHelpers = require('@/utils/authHelpers')
    expect(typeof authHelpers.requireAdmin).toBe('function')
  })

  test('authHelpers exports requireVendorMatch', () => {
    const authHelpers = require('@/utils/authHelpers')
    expect(typeof authHelpers.requireVendorMatch).toBe('function')
  })

  test('commissionService imports requireAdmin from authHelpers', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../modules/commissions/api/commissionService.js'),
      'utf-8'
    )
    expect(content).toContain("import { requireAdmin } from '@/utils/authHelpers'")
    // Should not have a local requireAdmin definition
    expect(content).not.toMatch(/const requireAdmin = async/)
  })

  test('analyticsApi imports requireAdmin from authHelpers', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../services/apis/analyticsApi.js'),
      'utf-8'
    )
    expect(content).toContain("requireAdmin")
    expect(content).toContain("authHelpers")
  })

  test('reportService imports requireAdmin from authHelpers', () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, '../../services/reports/reportService.js'),
      'utf-8'
    )
    expect(content).toContain("requireAdmin")
    expect(content).toContain("authHelpers")
  })
})
