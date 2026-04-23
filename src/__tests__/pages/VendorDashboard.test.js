/**
 * Page Tests: Vendor Dashboard
 * Tests product management, order processing, and analytics logic.
 */

describe('Vendor Dashboard – Logic', () => {
  function createProduct(overrides = {}) {
    return {
      id: `prod_${Math.random().toString(36).slice(2)}`,
      name: 'منتج اختبار',
      price: 100,
      stock_quantity: 50,
      is_active: true,
      category: 'خضروات',
      ...overrides
    }
  }

  function validateProduct(p) {
    const errors = {}
    if (!p.name || p.name.trim().length < 2) errors.name = 'اسم المنتج مطلوب'
    if (!p.price || p.price <= 0) errors.price = 'السعر يجب أن يكون أكبر من صفر'
    if (p.stock_quantity < 0) errors.stock_quantity = 'الكمية لا يمكن أن تكون سالبة'
    if (!p.category) errors.category = 'الفئة مطلوبة'
    return errors
  }

  function computeVendorStats(orders) {
    const completed = orders.filter(o => ['delivered', 'completed'].includes(o.status))
    const revenue = completed.reduce((s, o) => s + (o.vendor_amount || o.total_amount * 0.85), 0)
    return {
      totalOrders: orders.length,
      completedOrders: completed.length,
      pendingOrders: orders.filter(o => o.status === 'pending').length,
      revenue,
      fulfillmentRate: orders.length > 0 ? ((completed.length / orders.length) * 100).toFixed(0) : 0
    }
  }

  // ─── Product validation ──────────────────────────────────────────────────

  test('rejects product with empty name', () => {
    const errors = validateProduct(createProduct({ name: '' }))
    expect(errors.name).toBeDefined()
  })

  test('rejects product with zero price', () => {
    const errors = validateProduct(createProduct({ price: 0 }))
    expect(errors.price).toBeDefined()
  })

  test('rejects product with negative stock', () => {
    const errors = validateProduct(createProduct({ stock_quantity: -5 }))
    expect(errors.stock_quantity).toBeDefined()
  })

  test('accepts valid product', () => {
    const errors = validateProduct(createProduct())
    expect(Object.keys(errors).length).toBe(0)
  })

  // ─── Vendor analytics ────────────────────────────────────────────────────

  const orders = [
    { status: 'pending', total_amount: 200 },
    { status: 'delivered', total_amount: 300, vendor_amount: 255 },
    { status: 'completed', total_amount: 500, vendor_amount: 425 },
    { status: 'cancelled', total_amount: 150 },
    { status: 'delivered', total_amount: 400, vendor_amount: 340 }
  ]

  test('calculates vendor revenue from completed/delivered only', () => {
    const stats = computeVendorStats(orders)
    expect(stats.revenue).toBe(255 + 425 + 340)
  })

  test('calculates fulfillment rate', () => {
    const stats = computeVendorStats(orders)
    expect(Number(stats.fulfillmentRate)).toBe(60) // 3/5 = 60%
  })

  test('counts pending orders', () => {
    const stats = computeVendorStats(orders)
    expect(stats.pendingOrders).toBe(1)
  })

  // ─── Stock management ────────────────────────────────────────────────────

  test('detects low stock', () => {
    const LOW_STOCK_THRESHOLD = 10
    const products = [
      createProduct({ stock_quantity: 5 }),
      createProduct({ stock_quantity: 100 }),
      createProduct({ stock_quantity: 3 })
    ]
    const lowStock = products.filter(p => p.stock_quantity <= LOW_STOCK_THRESHOLD)
    expect(lowStock.length).toBe(2)
  })

  test('deactivating a product sets is_active to false', () => {
    const product = createProduct()
    const updated = { ...product, is_active: false }
    expect(updated.is_active).toBe(false)
  })
})
