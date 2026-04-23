import {
  buildMinimumOrderMessage,
  buildVendorCartBuckets,
  evaluateVendorMinimumOrders,
} from '@/services/minimumOrderService'

describe('minimumOrderService', () => {
  test('groups cart items by vendor subtotal', () => {
    expect(buildVendorCartBuckets([
      { id: '1', vendor_id: 'v1', vendor_name: 'Atlas Farm', price_per_unit: 10, quantity: 3 },
      { id: '2', vendor_id: 'v1', vendor_name: 'Atlas Farm', price_per_unit: 5, quantity: 2 },
      { id: '3', vendor_id: 'v2', vendor_name: 'Souss Herbs', price_per_unit: 7, quantity: 4 },
    ])).toEqual([
      {
        vendorId: 'v1',
        vendorName: 'Atlas Farm',
        subtotal: 40,
        itemCount: 2,
        items: [
          { id: '1', vendor_id: 'v1', vendor_name: 'Atlas Farm', price_per_unit: 10, quantity: 3 },
          { id: '2', vendor_id: 'v1', vendor_name: 'Atlas Farm', price_per_unit: 5, quantity: 2 },
        ],
      },
      {
        vendorId: 'v2',
        vendorName: 'Souss Herbs',
        subtotal: 28,
        itemCount: 1,
        items: [
          { id: '3', vendor_id: 'v2', vendor_name: 'Souss Herbs', price_per_unit: 7, quantity: 4 },
        ],
      },
    ])
  })

  test('detects vendor minimum-order shortfalls', () => {
    const result = evaluateVendorMinimumOrders({
      items: [
        { id: '1', vendor_id: 'v1', vendor_name: 'Atlas Farm', price_per_unit: 10, quantity: 3 },
        { id: '2', vendor_id: 'v2', vendor_name: 'Souss Herbs', price_per_unit: 20, quantity: 4 },
      ],
      vendorProfiles: [
        { id: 'v1', store_name: 'Atlas Farm', min_order_amount: 50 },
        { id: 'v2', store_name: 'Souss Herbs', min_order_amount: 60 },
      ],
    })

    expect(result.hasViolations).toBe(true)
    expect(result.violations).toEqual([
      {
        vendorId: 'v1',
        vendorName: 'Atlas Farm',
        subtotal: 30,
        itemCount: 1,
        items: [
          { id: '1', vendor_id: 'v1', vendor_name: 'Atlas Farm', price_per_unit: 10, quantity: 3 },
        ],
        minOrderAmount: 50,
        shortfall: 20,
        meetsMinimum: false,
      },
    ])
    expect(buildMinimumOrderMessage(result.firstViolation)).toBe('الحد الأدنى للطلب لدى Atlas Farm هو 50.00 درهم. المتبقي 20.00 درهم.')
  })

  test('passes when vendors meet or do not define minimums', () => {
    const result = evaluateVendorMinimumOrders({
      items: [
        { id: '1', vendor_id: 'v1', vendor_name: 'Atlas Farm', price_per_unit: 25, quantity: 2 },
      ],
      vendorProfiles: [
        { id: 'v1', store_name: 'Atlas Farm', min_order_amount: 50 },
      ],
    })

    expect(result.hasViolations).toBe(false)
    expect(result.violations).toEqual([])
  })
})