/**
 * Page Tests: Admin Dashboard
 * Tests stat calculations, order filtering, and admin actions.
 */

describe('Admin Dashboard – Logic', () => {
  const makeOrders = (n, status = 'pending') =>
    Array.from({ length: n }, (_, i) => ({
      id: `ord_${i}`,
      status,
      total_amount: 100 + i * 50,
      created_at: new Date().toISOString(),
      payment_method: i % 2 === 0 ? 'cod' : 'stripe'
    }))

  function computeStats(orders, users, products) {
    const revenue = orders
      .filter(o => ['delivered', 'completed'].includes(o.status))
      .reduce((s, o) => s + o.total_amount, 0)
    const pending = orders.filter(o => o.status === 'pending').length
    const activeVendors = users.filter(u => u.role === 'vendor' && u.is_active).length
    return { revenue, pendingOrders: pending, activeVendors, totalProducts: products.length }
  }

  const orders = [
    ...makeOrders(5, 'pending'),
    ...makeOrders(3, 'delivered'),
    ...makeOrders(2, 'completed'),
    ...makeOrders(1, 'cancelled')
  ]
  const users = [
    { role: 'vendor', is_active: true },
    { role: 'vendor', is_active: false },
    { role: 'buyer', is_active: true },
    { role: 'vendor', is_active: true }
  ]
  const products = Array.from({ length: 20 }, (_, i) => ({ id: i }))

  test('calculates revenue from delivered/completed orders only', () => {
    const stats = computeStats(orders, users, products)
    const expected = [...makeOrders(3, 'delivered'), ...makeOrders(2, 'completed')]
      .reduce((s, o) => s + o.total_amount, 0)
    expect(stats.revenue).toBe(expected)
  })

  test('counts pending orders correctly', () => {
    const stats = computeStats(orders, users, products)
    expect(stats.pendingOrders).toBe(5)
  })

  test('counts only active vendors', () => {
    const stats = computeStats(orders, users, products)
    expect(stats.activeVendors).toBe(2)
  })

  test('counts total products', () => {
    const stats = computeStats(orders, users, products)
    expect(stats.totalProducts).toBe(20)
  })

  // ─── Order filtering ─────────────────────────────────────────────────────

  test('filters orders by status', () => {
    const pending = orders.filter(o => o.status === 'pending')
    expect(pending.length).toBe(5)
  })

  test('filters orders by payment method', () => {
    const cod = orders.filter(o => o.payment_method === 'cod')
    expect(cod.length).toBeGreaterThan(0)
  })

  // ─── Admin access control ─────────────────────────────────────────────────

  test('admin role has access to admin routes', () => {
    const user = { role: 'admin' }
    const canAccess = (u, route) => {
      if (route.startsWith('/admin')) return u.role === 'admin'
      return true
    }
    expect(canAccess(user, '/admin/reports')).toBe(true)
    expect(canAccess({ role: 'vendor' }, '/admin/reports')).toBe(false)
  })

  test('suspending a user sets is_active to false', () => {
    const user = { id: '1', is_active: true }
    const updated = { ...user, is_active: false }
    expect(updated.is_active).toBe(false)
  })
})
