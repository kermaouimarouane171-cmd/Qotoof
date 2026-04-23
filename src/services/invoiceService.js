import { createElement } from 'react'
import { supabase } from './supabase'
import { logger } from '@/utils/logger'

const toAmount = (value) => Number(Number(value || 0).toFixed(2))

const sumDiscounts = (order = {}) => {
  const explicitDiscount = Number(order.discount_total || 0)
  if (explicitDiscount > 0) return explicitDiscount

  return Number((
    Number(order.coupon_discount_total || 0) +
    Number(order.bulk_discount_total || 0) +
    Number(order.loyalty_discount_total || 0) +
    Number(order.referral_discount_total || 0)
  ).toFixed(2))
}

export const resolveInvoiceStatus = (order = {}) => {
  if (['cancelled', 'vendor_rejected', 'refunded'].includes(order.status)) {
    return 'cancelled'
  }

  if (order.payment_status === 'paid' || order.payment_received_at || order.status === 'delivered') {
    return 'paid'
  }

  return 'generated'
}

export const buildInvoicePayload = (order = {}) => {
  const productTotal = toAmount(order.vendor_product_total ?? order.subtotal ?? order.total ?? order.buyer_total ?? 0)
  const deliveryFeeTotal = toAmount(order.delivery_fee_total ?? order.shipping_cost ?? order.shipping_total ?? 0)
  const platformCommissionRate = Number(order.platform_commission_rate_snapshot ?? 0.03)

  return {
    order_id: order.id,
    vendor_id: order.vendor_id,
    buyer_id: order.buyer_id,
    currency: order.currency || 'MAD',
    subtotal: productTotal,
    shipping_total: deliveryFeeTotal,
    fees_total: toAmount(order.buyer_commission ?? order.fees_total ?? 0),
    discount_total: toAmount(sumDiscounts(order)),
    grand_total: toAmount(order.grand_total ?? order.buyer_total ?? order.total ?? 0),
    status: resolveInvoiceStatus(order),
    metadata: {
      order_number: order.order_number || null,
      payment_type: order.payment_type || order.payment_method || null,
      driver_delivery_payment_method: order.driver_delivery_payment_method || null,
      product_tva_exempt: order.product_tva_exempt !== false,
      platform_commission_rate_snapshot: platformCommissionRate,
      invoice_note: 'المنتجات الفلاحية معفاة من TVA. عمولة المنصة 3% تُسوّى بين المنصة والبائع في نهاية الشهر.',
      generated_for_status: order.status || null,
    },
  }
}

const syncOrderInvoiceFields = async (orderId, invoice) => {
  const payload = {
    invoice_number: invoice.invoice_number,
    invoice_generated_at: invoice.issued_at,
    invoice_status: invoice.status,
    invoice_metadata: {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      issued_at: invoice.issued_at,
      status: invoice.status,
    },
  }

  const { error } = await supabase
    .from('orders')
    .update(payload)
    .eq('id', orderId)

  if (error) {
    logger.warn('Failed to sync order invoice fields:', error)
  }
}

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

const invoiceService = {
  async ensureInvoiceRecord(order) {
    if (!order?.id || !order?.vendor_id || !order?.buyer_id) {
      throw new Error('بيانات الطلب غير مكتملة لإنشاء الفاتورة.')
    }

    const payload = buildInvoicePayload(order)
    const { data: existingInvoice, error: existingError } = await supabase
      .from('invoices')
      .select('*')
      .eq('order_id', order.id)
      .maybeSingle()

    if (existingError) throw existingError

    let invoice = existingInvoice

    if (invoice) {
      const { data: updatedInvoice, error: updateError } = await supabase
        .from('invoices')
        .update({
          ...payload,
          metadata: {
            ...(invoice.metadata || {}),
            ...(payload.metadata || {}),
          },
        })
        .eq('id', invoice.id)
        .select('*')
        .single()

      if (updateError) throw updateError
      invoice = updatedInvoice
    } else {
      const { data: createdInvoice, error: createError } = await supabase
        .from('invoices')
        .insert(payload)
        .select('*')
        .single()

      if (createError) throw createError
      invoice = createdInvoice
    }

    await syncOrderInvoiceFields(order.id, invoice)
    return invoice
  },

  async downloadOrderInvoice(order) {
    const invoice = await this.ensureInvoiceRecord(order)

    const [{ pdf }, { default: OrderInvoiceDocument }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('@/components/invoices/OrderInvoiceDocument'),
    ])

    const blob = await pdf(createElement(OrderInvoiceDocument, { order, invoice })).toBlob()
    downloadBlob(blob, `${invoice.invoice_number || `invoice_${order.id}`}.pdf`)

    return invoice
  },
}

export default invoiceService