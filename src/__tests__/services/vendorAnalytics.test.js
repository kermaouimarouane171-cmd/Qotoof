import {
  buildAnalyticsCsvRows,
  buildTopProductMetrics,
  calculateVendorAnalyticsMetrics,
  resolveVendorAnalyticsRange,
} from '@/services/vendorAnalytics'

describe('vendorAnalytics helpers', () => {
  test('resolves custom date ranges and keeps them active', () => {
    const result = resolveVendorAnalyticsRange({
      selectedRange: 'custom',
      customDateFrom: '2026-04-01',
      customDateTo: '2026-04-20',
    })

    expect(result.labelAr).toBe('نطاق مخصص')
    expect(result.startDate.toISOString().slice(0, 10)).toBe('2026-04-01')
    expect(result.endDate.toISOString().slice(0, 10)).toBe('2026-04-20')
    expect(result.granularity).toBe('day')
  })

  test('aggregates top products by revenue and quantity', () => {
    const metrics = buildTopProductMetrics({
      orders: [
        {
          order_items: [
            { product_id: 'p1', quantity: 2, unit_price: 10 },
            { product_id: 'p2', quantity: 5, unit_price: 4 },
          ],
        },
        {
          order_items: [
            { product_id: 'p1', quantity: 1, unit_price: 10 },
          ],
        },
      ],
      products: [
        { id: 'p1', name: 'Tomato', category: 'vegetables' },
        { id: 'p2', name: 'Mint', category: 'herbs' },
      ],
    })

    expect(metrics[0]).toEqual({
      productId: 'p1',
      name: 'Tomato',
      category: 'vegetables',
      quantity: 3,
      revenue: 30,
    })
    expect(metrics[1]).toEqual({
      productId: 'p2',
      name: 'Mint',
      category: 'herbs',
      quantity: 5,
      revenue: 20,
    })
  })

  test('calculates vendor metrics from orders, reviews, and products', () => {
    const metrics = calculateVendorAnalyticsMetrics({
      orders: [
        {
          total: 120,
          vendor_amount: 100,
          status: 'delivered',
          buyer_id: 'b1',
          created_at: '2026-04-01T08:00:00Z',
          delivered_at: '2026-04-03T08:00:00Z',
        },
        {
          total: 180,
          vendor_amount: 150,
          status: 'completed',
          buyer_id: 'b1',
          created_at: '2026-04-05T08:00:00Z',
          delivered_at: '2026-04-06T20:00:00Z',
        },
        {
          total: 90,
          vendor_amount: 75,
          status: 'pending',
          buyer_id: 'b2',
          created_at: '2026-04-07T08:00:00Z',
        },
      ],
      reviews: [
        {
          rating: 5,
          created_at: '2026-04-01T10:00:00Z',
          vendor_reply_at: '2026-04-01T16:00:00Z',
        },
        {
          rating: 3,
          created_at: '2026-04-02T10:00:00Z',
          vendor_reply_at: null,
        },
      ],
      products: [
        { id: 'p1', stock_quantity: 4 },
        { id: 'p2', stock_quantity: 20 },
      ],
    })

    expect(metrics.totalRevenue).toBe(325)
    expect(metrics.totalOrders).toBe(3)
    expect(metrics.avgOrderValue).toBeCloseTo(108.33, 2)
    expect(metrics.repeatCustomers).toBe(50)
    expect(metrics.fulfillmentRate).toBe(67)
    expect(metrics.avgDeliveryTime).toBe(1.8)
    expect(metrics.avgReviewResponseHours).toBe(6)
    expect(metrics.reviewReplyRate).toBe(50)
    expect(metrics.averageRating).toBe(4)
    expect(metrics.lowStockProducts).toBe(1)
  })

  test('builds export rows with vendor revenue values', () => {
    const rows = buildAnalyticsCsvRows({
      orders: [
        {
          id: 'order-1',
          created_at: '2026-04-01T08:00:00Z',
          status: 'delivered',
          vendor_amount: 255,
          order_items: [{ id: 'item-1' }, { id: 'item-2' }],
          buyer_id: 'buyer-1',
        },
      ],
    })

    expect(rows).toEqual([
      {
        orderId: 'order-1',
        date: '2026-04-01T08:00:00Z',
        status: 'delivered',
        totalRevenue: '255.00',
        itemsCount: 2,
        buyerId: 'buyer-1',
      },
    ])
  })
})