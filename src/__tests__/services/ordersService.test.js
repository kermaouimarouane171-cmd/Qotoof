/**
 * Service Tests: ordersService
 * Verifies that buyer order queries use correct column names (B-01 + B-02).
 * - BUYER_ORDER_COLUMNS must not contain ghost column `total_amount`
 * - fetchBuyerOrdersAll must query `shipping_*` columns, not `delivery_*`
 */

const mockSelect = jest.fn()
const mockEq = jest.fn()
const mockFrom = jest.fn(() => ({
  select: mockSelect,
  eq: mockEq,
}))

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}))

jest.mock('@/services/productImages', () => ({
  isProductImagesRelationError: jest.fn(() => false),
  hydrateRowsWithProductItems: jest.fn(async (rows) => rows),
}))

jest.mock('@/utils/sanitization.jsx', () => ({
  sanitizePostgRESTFilter: jest.fn((v) => v),
}))

jest.mock('@/business/orderLogic', () => ({
  buildOrderStatusUpdatePayload: jest.fn(() => ({})),
  isAllowedOrderStatusTransition: jest.fn(() => true),
}))

jest.mock('@/data/orderRepository', () => ({
  fetchOrderStatusContext: jest.fn(),
  insertOrderNotification: jest.fn(),
  updateOrderById: jest.fn(),
}))

const { fetchBuyerOrders, fetchBuyerOrdersAll } = require('@/services/ordersService')

describe('ordersService: buyer column names (B-01 + B-02)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // fetchBuyerOrders uses: .select(...).eq(...).order(...).range(...)
  describe('fetchBuyerOrders (BUYER_ORDER_COLUMNS)', () => {
    beforeEach(() => {
      const mockRange = jest.fn().mockResolvedValue({ data: [], error: null, count: 0 })
      const mockOrder = jest.fn().mockReturnValue({ range: mockRange })
      mockSelect.mockReturnValue({ eq: mockEq })
      mockEq.mockReturnValue({ order: mockOrder, range: mockRange })
    })

    it('does not contain total_amount (B-01)', async () => {
      await fetchBuyerOrders('buyer-1')

      const selectArg = mockSelect.mock.calls[0][0]
      expect(selectArg).not.toContain('total_amount')
      expect(selectArg).toContain('total')
    })
  })

  // fetchBuyerOrdersAll uses: .select(...).eq(...)  then await
  describe('fetchBuyerOrdersAll', () => {
    beforeEach(() => {
      mockSelect.mockReturnValue({ eq: mockEq })
      mockEq.mockResolvedValue({ data: [], error: null })
    })

    it('queries shipping_address not delivery_address (B-02)', async () => {
      await fetchBuyerOrdersAll('buyer-1')

      const selectArg = mockSelect.mock.calls[0][0]
      expect(selectArg).toContain('shipping_address')
      expect(selectArg).not.toContain('delivery_address')
    })

    it('queries shipping_city not delivery_city (B-02)', async () => {
      await fetchBuyerOrdersAll('buyer-1')

      const selectArg = mockSelect.mock.calls[0][0]
      expect(selectArg).toContain('shipping_city')
      expect(selectArg).not.toContain('delivery_city')
    })

    it('queries shipping_latitude not delivery_latitude (B-02)', async () => {
      await fetchBuyerOrdersAll('buyer-1')

      const selectArg = mockSelect.mock.calls[0][0]
      expect(selectArg).toContain('shipping_latitude')
      expect(selectArg).not.toContain('delivery_latitude')
    })

    it('queries shipping_longitude not delivery_longitude (B-02)', async () => {
      await fetchBuyerOrdersAll('buyer-1')

      const selectArg = mockSelect.mock.calls[0][0]
      expect(selectArg).toContain('shipping_longitude')
      expect(selectArg).not.toContain('delivery_longitude')
    })

    it('uses total not total_amount (B-01)', async () => {
      await fetchBuyerOrdersAll('buyer-1')

      const selectArg = mockSelect.mock.calls[0][0]
      expect(selectArg).toContain('total')
      expect(selectArg).not.toContain('total_amount')
    })
  })
})
