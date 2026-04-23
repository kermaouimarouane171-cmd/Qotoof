jest.mock('@/services/supabase', () => ({
  supabase: {},
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}))

import { buildInvoicePayload, resolveInvoiceStatus } from '@/services/invoiceService'

describe('invoiceService helpers', () => {
  it('builds invoice payload from order totals and discount components', () => {
    expect(buildInvoicePayload({
      id: 'order-1',
      vendor_id: 'vendor-1',
      buyer_id: 'buyer-1',
      subtotal: 300,
      shipping_cost: 40,
      buyer_commission: 10,
      coupon_discount_total: 5,
      loyalty_discount_total: 15,
      buyer_total: 330,
      order_number: 'ORD-001',
      status: 'pending',
      payment_type: 'card',
    })).toEqual({
      order_id: 'order-1',
      vendor_id: 'vendor-1',
      buyer_id: 'buyer-1',
      currency: 'MAD',
      subtotal: 300,
      shipping_total: 40,
      fees_total: 10,
      discount_total: 20,
      grand_total: 330,
      status: 'generated',
      metadata: {
        order_number: 'ORD-001',
        payment_type: 'card',
        generated_for_status: 'pending',
        driver_delivery_payment_method: null,
        product_tva_exempt: true,
        platform_commission_rate_snapshot: 0.03,
        invoice_note: 'المنتجات الفلاحية معفاة من TVA. عمولة المنصة 3% تُسوّى بين المنصة والبائع في نهاية الشهر.',
      },
    })
  })

  it('resolves invoice status from order state', () => {
    expect(resolveInvoiceStatus({ status: 'cancelled' })).toBe('cancelled')
    expect(resolveInvoiceStatus({ status: 'delivered' })).toBe('paid')
    expect(resolveInvoiceStatus({ status: 'pending' })).toBe('generated')
  })
})