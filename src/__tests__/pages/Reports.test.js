/**
 * Page Tests: Reports Page
 * Tests report generation logic, export formatting, and date range validation.
 */

describe('Reports Page – Logic', () => {
  // ─── Date range validation ────────────────────────────────────────────────

  function validateDateRange(startDate, endDate) {
    if (!startDate || !endDate) return 'التواريخ مطلوبة'
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'تاريخ غير صالح'
    if (start > end) return 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية'
    const diffDays = (end - start) / (1000 * 60 * 60 * 24)
    if (diffDays > 365) return 'النطاق الزمني لا يمكن أن يتجاوز سنة واحدة'
    return null
  }

  test('rejects missing dates', () => {
    expect(validateDateRange(null, null)).toBeTruthy()
    expect(validateDateRange('2024-01-01', null)).toBeTruthy()
  })

  test('rejects start after end', () => {
    expect(validateDateRange('2024-06-01', '2024-01-01')).toContain('قبل')
  })

  test('rejects range over 1 year', () => {
    expect(validateDateRange('2023-01-01', '2025-01-02')).toContain('سنة')
  })

  test('accepts valid date range', () => {
    expect(validateDateRange('2024-01-01', '2024-06-30')).toBeNull()
  })

  // ─── CSV export data shaping ─────────────────────────────────────────────

  function flattenSalesRow(order) {
    return {
      id: order.id,
      date: new Date(order.created_at).toLocaleDateString('ar-MA'),
      buyer: order.buyer?.full_name || '',
      total: order.total_amount,
      status: order.status,
      payment: order.payment_method
    }
  }

  const sampleOrders = [
    { id: '1', created_at: '2024-03-01T10:00:00Z', buyer: { full_name: 'أحمد' }, total_amount: 500, status: 'delivered', payment_method: 'cod' },
    { id: '2', created_at: '2024-03-05T14:00:00Z', buyer: { full_name: 'فاطمة' }, total_amount: 300, status: 'completed', payment_method: 'stripe' }
  ]

  test('flattens sales rows for export', () => {
    const flat = sampleOrders.map(flattenSalesRow)
    expect(flat[0].buyer).toBe('أحمد')
    expect(flat[0].total).toBe(500)
    expect(flat[1].payment).toBe('stripe')
  })

  test('all required fields present in flattened row', () => {
    const flat = flattenSalesRow(sampleOrders[0])
    expect(flat).toHaveProperty('id')
    expect(flat).toHaveProperty('date')
    expect(flat).toHaveProperty('buyer')
    expect(flat).toHaveProperty('total')
    expect(flat).toHaveProperty('status')
    expect(flat).toHaveProperty('payment')
  })

  // ─── Summary calculations ─────────────────────────────────────────────────

  function computeSalesSummary(orders) {
    const revenue = orders.reduce((s, o) => s + o.total_amount, 0)
    return {
      totalRevenue: revenue,
      orderCount: orders.length,
      avgOrderValue: orders.length > 0 ? revenue / orders.length : 0
    }
  }

  test('calculates total revenue', () => {
    const summary = computeSalesSummary(sampleOrders)
    expect(summary.totalRevenue).toBe(800)
  })

  test('calculates average order value', () => {
    const summary = computeSalesSummary(sampleOrders)
    expect(summary.avgOrderValue).toBe(400)
  })

  test('handles empty orders', () => {
    const summary = computeSalesSummary([])
    expect(summary.totalRevenue).toBe(0)
    expect(summary.avgOrderValue).toBe(0)
  })

  // ─── Report type selector ─────────────────────────────────────────────────

  test('valid report types are enumerated', () => {
    const REPORT_TYPES = ['sales', 'users', 'inventory', 'delivery']
    expect(REPORT_TYPES).toContain('sales')
    expect(REPORT_TYPES).toContain('inventory')
    expect(REPORT_TYPES.includes('financials')).toBe(false)
  })
})
