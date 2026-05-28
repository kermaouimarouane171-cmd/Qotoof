export type OrderStatusMetadata = {
  cancelled_reason?: string
  confirmed_at?: string
  cancelled_at?: string
  delivered_at?: string
  [key: string]: unknown
}

export const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['vendor_accepted', 'vendor_rejected', 'cancelled'],
  vendor_accepted: ['driver_assigned', 'driver_accepted', 'cancelled'],
  driver_assigned: ['driver_accepted', 'cancelled'],
  driver_accepted: ['driver_picked_up', 'cancelled'],
  driver_picked_up: ['on_the_way', 'cancelled'],
  on_the_way: ['delivered', 'cancelled'],
  delivered: ['refunded'],
  cancelled: [],
  vendor_rejected: [],
  refunded: [],
}

export const isAllowedOrderStatusTransition = (
  currentStatus: string,
  nextStatus: string,
) => {
  if (!currentStatus || currentStatus === nextStatus) return true
  const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || []
  return allowedNext.includes(nextStatus)
}

export const buildOrderStatusUpdatePayload = (
  status: string,
  metadata: OrderStatusMetadata = {},
) => {
  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    ...metadata,
  }

  if (status === 'vendor_accepted' && !payload.confirmed_at) {
    payload.confirmed_at = new Date().toISOString()
  }

  if ((status === 'cancelled' || status === 'vendor_rejected') && !payload.cancelled_at) {
    payload.cancelled_at = new Date().toISOString()
  }

  if (status === 'delivered' && !payload.delivered_at) {
    payload.delivered_at = new Date().toISOString()
  }

  return payload
}
