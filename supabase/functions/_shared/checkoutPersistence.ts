import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type SupabaseClient = ReturnType<typeof createClient>

type JsonRecord = Record<string, unknown>

export type InventoryReservationItem = {
  productId: string
  quantity: number
}

export type CheckoutRequestClaim = {
  request_id?: string
  status?: string
  can_proceed?: boolean
  cached_response?: JsonRecord | null
  cached_order_ids?: string[]
  in_progress?: boolean
}

export type CheckoutWriteVendorOrder = {
  items: Array<Record<string, unknown>>
  orderPayload: JsonRecord
  preferredOrderPayload: JsonRecord
  paymentPlan: {
    paymentMethod: string
    paymentType: string
    firstPaymentAmount: number
    secondPaymentAmount: number
  }
}

const asObject = (value: unknown): JsonRecord => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as JsonRecord
}

const asString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

export const buildInventoryReservationItems = (vendorOrders: Array<Record<string, unknown>> = []): InventoryReservationItem[] => {
  const quantities = new Map<string, number>()

  for (const rawVendorOrder of vendorOrders) {
    const vendorOrder = asObject(rawVendorOrder)
    const items = Array.isArray(vendorOrder.items) ? vendorOrder.items : []

    for (const rawItem of items) {
      const item = asObject(rawItem)
      const productId = asString(item.id || item.product_id || item.productId)
      const quantity = Number(item.quantity || 0)

      if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
        continue
      }

      const existing = quantities.get(productId) || 0
      quantities.set(productId, Number((existing + quantity).toFixed(2)))
    }
  }

  return Array.from(quantities.entries()).map(([productId, quantity]) => ({ productId, quantity }))
}

export const reserveCheckoutInventory = async (supabase: SupabaseClient, items: InventoryReservationItem[]) => {
  if (items.length === 0) return

  const { error } = await supabase.rpc('reserve_checkout_inventory', { p_items: items })
  if (error) throw new Error(`reserve_checkout_inventory_failed: ${error.message}`)
}

export const releaseCheckoutInventory = async (supabase: SupabaseClient, items: InventoryReservationItem[]) => {
  if (items.length === 0) return

  const { error } = await supabase.rpc('release_checkout_inventory', { p_items: items })
  if (error) throw new Error(`release_checkout_inventory_failed: ${error.message}`)
}

export const claimCheckoutRequest = async (
  supabase: SupabaseClient,
  userId: string,
  idempotencyKey: string,
  payload: JsonRecord,
): Promise<CheckoutRequestClaim | null> => {
  if (!idempotencyKey) return null

  const { data, error } = await supabase.rpc('claim_checkout_request', {
    p_buyer_id: userId,
    p_idempotency_key: idempotencyKey,
    p_request_hash: JSON.stringify(payload),
    p_payload_snapshot: payload,
  })

  if (error) throw new Error(`claim_checkout_request_failed: ${error.message}`)
  if (Array.isArray(data)) return (data[0] || null) as CheckoutRequestClaim | null
  return (data || null) as CheckoutRequestClaim | null
}

export const finalizeCheckoutRequest = async (
  supabase: SupabaseClient,
  userId: string,
  idempotencyKey: string,
  {
    status,
    responsePayload,
    orderIds,
    errorMessage,
  }: {
    status: 'completed' | 'failed'
    responsePayload?: JsonRecord | null
    orderIds?: string[]
    errorMessage?: string | null
  },
) => {
  if (!userId || !idempotencyKey) return

  const { error } = await supabase
    .from('checkout_requests')
    .update({
      status,
      response_payload: responsePayload || null,
      order_ids: Array.from(new Set((orderIds || []).filter(Boolean))),
      error_message: errorMessage || null,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      last_seen_at: new Date().toISOString(),
    })
    .eq('buyer_id', userId)
    .eq('idempotency_key', idempotencyKey)

  if (error) throw new Error(`finalize_checkout_request_failed: ${error.message}`)
}

export const rollbackCheckoutRecords = async (supabase: SupabaseClient, orderIds: string[]) => {
  const uniqueOrderIds = Array.from(new Set((orderIds || []).filter(Boolean)))
  if (uniqueOrderIds.length === 0) return

  const cleanupSteps: Array<{ table: string; column: string }> = [
    { table: 'coupon_redemptions', column: 'order_id' },
    { table: 'payment_terms_acceptance', column: 'order_id' },
    { table: 'payments', column: 'order_id' },
    { table: 'order_items', column: 'order_id' },
    { table: 'orders', column: 'id' },
  ]

  for (const step of cleanupSteps) {
    const { error } = await supabase.from(step.table).delete().in(step.column, uniqueOrderIds)
    if (error) throw new Error(`rollback_failed_at_${step.table}: ${error.message}`)
  }
}

export const insertOrderWithFallback = async (supabase: SupabaseClient, vendorOrder: CheckoutWriteVendorOrder) => {
  let insertResult = await supabase
    .from('orders')
    .insert(vendorOrder.preferredOrderPayload)
    .select()
    .single()

  if (insertResult.error && insertResult.error.message?.includes('preferred_driver')) {
    insertResult = await supabase
      .from('orders')
      .insert(vendorOrder.orderPayload)
      .select()
      .single()
  }

  const { data, error } = insertResult
  if (error || !data) throw new Error(error?.message || 'failed_to_create_order')
  return data as Record<string, unknown>
}

export const insertPaymentRecord = async (supabase: SupabaseClient, orderId: string, vendorOrder: CheckoutWriteVendorOrder) => {
  const amount = vendorOrder.paymentPlan.paymentMethod === 'cod'
    ? Number(vendorOrder.paymentPlan.secondPaymentAmount || 0)
    : Number(vendorOrder.paymentPlan.firstPaymentAmount || 0)

  const { error } = await supabase
    .from('payments')
    .insert({
      order_id: orderId,
      amount,
      payment_method: vendorOrder.paymentPlan.paymentMethod,
      status: 'pending',
    })

  if (error) throw new Error(`payments_insert_failed: ${error.message}`)
}

export const insertPaymentTermsAcceptance = async (
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
  vendorOrder: CheckoutWriteVendorOrder,
) => {
  const { error } = await supabase
    .from('payment_terms_acceptance')
    .insert({
      user_id: userId,
      order_id: orderId,
      payment_type: vendorOrder.paymentPlan.paymentType,
      terms_version: 'payment-policy-v1',
      warning_shown: true,
    })

  if (error) throw new Error(`payment_terms_acceptance_insert_failed: ${error.message}`)
}

export const insertOrderItems = async (supabase: SupabaseClient, orderId: string, vendorOrder: CheckoutWriteVendorOrder) => {
  const orderItems = vendorOrder.items.map((rawItem) => {
    const item = asObject(rawItem)
    const unitPrice = Number(item.price_per_unit || 0)
    const quantity = Number(item.quantity || 0)

    return {
      order_id: orderId,
      product_id: item.id,
      quantity,
      unit_price: unitPrice,
      total: unitPrice * quantity,
    }
  })

  if (orderItems.length === 0) throw new Error('order_items_required')

  const { error } = await supabase.from('order_items').insert(orderItems)
  if (error) throw new Error(`order_items_insert_failed: ${error.message}`)
}

export const insertCouponRedemption = async (
  supabase: SupabaseClient,
  orderId: string,
  userId: string,
  checkout: JsonRecord,
) => {
  const appliedCoupon = asObject(checkout.appliedCoupon)
  if (!appliedCoupon.id) return

  const pricing = asObject(checkout.pricing)
  const { error } = await supabase.from('coupon_redemptions').insert({
    coupon_id: appliedCoupon.id,
    user_id: userId,
    order_id: orderId,
    discount_amount: Number(pricing.couponDiscount || 0),
    discount_percentage: appliedCoupon.discount_type === 'percentage'
      ? Number(appliedCoupon.discount_value || 0)
      : null,
  })

  if (error) throw new Error(`coupon_redemption_insert_failed: ${error.message}`)
}
