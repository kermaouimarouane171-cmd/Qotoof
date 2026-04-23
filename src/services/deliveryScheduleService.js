import { supabase } from './supabase'

const toInteger = (value, fallback = null) => {
  if (value === '' || value == null) return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? fallback : parsed
}

const buildSlotSignature = (slot) => [
  Number(slot.day_of_week),
  slot.start_time,
  slot.end_time,
].join('|')

export const getDeliveryDayOfWeek = (requestedDate) => {
  if (!requestedDate) return null
  return new Date(`${requestedDate}T12:00:00`).getDay()
}

export const isSlotPastCutoff = ({ slot, requestedDate, now = new Date() }) => {
  if (!slot || !requestedDate) return false

  const today = now.toISOString().slice(0, 10)
  if (requestedDate !== today) return false

  const slotCutoffTime = new Date(`${requestedDate}T${slot.start_time}:00`)
  slotCutoffTime.setHours(slotCutoffTime.getHours() - Number(slot.cutoff_hours || 0))

  return now > slotCutoffTime
}

export const decorateDeliverySlot = ({ slot, requestedDate, bookedOrders = 0, now = new Date() }) => {
  const maxOrders = slot.max_orders == null ? null : Number(slot.max_orders)
  const remainingCapacity = maxOrders == null ? null : Math.max(maxOrders - bookedOrders, 0)
  const pastCutoff = isSlotPastCutoff({ slot, requestedDate, now })
  const isFull = remainingCapacity !== null && remainingCapacity <= 0
  const available = Boolean(slot.is_active) && !pastCutoff && !isFull

  return {
    ...slot,
    bookedOrders,
    remainingCapacity,
    pastCutoff,
    isFull,
    available,
  }
}

export const buildDeliveryScheduleSnapshot = ({ requestedDate, slot }) => {
  if (!slot || !requestedDate) return {}

  return {
    requested_date: requestedDate,
    slot_id: slot.id,
    slot_label: slot.slot_label,
    day_of_week: Number(slot.day_of_week),
    start_time: slot.start_time,
    end_time: slot.end_time,
    cutoff_hours: Number(slot.cutoff_hours || 0),
    max_orders: slot.max_orders == null ? null : Number(slot.max_orders),
  }
}

const normalizeSlotPayload = (vendorId, slot) => {
  const normalized = {
    id: slot.id || undefined,
    vendor_id: vendorId,
    day_of_week: Number(slot.day_of_week),
    slot_label: (slot.slot_label || '').trim(),
    start_time: slot.start_time,
    end_time: slot.end_time,
    cutoff_hours: toInteger(slot.cutoff_hours, 2),
    max_orders: toInteger(slot.max_orders, null),
    is_active: slot.is_active !== false,
  }

  if (!normalized.slot_label) {
    throw new Error('اسم الفترة مطلوب')
  }

  if (!normalized.start_time || !normalized.end_time || normalized.start_time >= normalized.end_time) {
    throw new Error('وقت الفترة غير صالح')
  }

  return normalized
}

export const deliveryScheduleService = {
  async getVendorDeliverySlots(vendorId) {
    if (!vendorId) return []

    const { data, error } = await supabase
      .from('vendor_delivery_slots')
      .select('*')
      .eq('vendor_id', vendorId)
      .order('day_of_week', { ascending: true })
      .order('start_time', { ascending: true })

    if (error) throw error
    return data || []
  },

  async saveVendorDeliverySlots({ vendorId, slots }) {
    if (!vendorId) throw new Error('Vendor ID is required')

    const normalizedSlots = (slots || []).map((slot) => normalizeSlotPayload(vendorId, slot))

    const { data: existingSlots, error: existingError } = await supabase
      .from('vendor_delivery_slots')
      .select('id, day_of_week, start_time, end_time')
      .eq('vendor_id', vendorId)

    if (existingError) throw existingError

    const keepIds = new Set(normalizedSlots.map((slot) => slot.id).filter(Boolean))
    const keepSignatures = new Set(normalizedSlots.map(buildSlotSignature))
    const removableIds = (existingSlots || [])
      .filter((slot) => !keepIds.has(slot.id) && !keepSignatures.has(buildSlotSignature(slot)))
      .map((slot) => slot.id)

    if (removableIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('vendor_delivery_slots')
        .delete()
        .in('id', removableIds)

      if (deleteError) throw deleteError
    }

    if (normalizedSlots.length > 0) {
      const { error: upsertError } = await supabase
        .from('vendor_delivery_slots')
        .upsert(normalizedSlots, {
          onConflict: 'vendor_id,day_of_week,start_time,end_time',
        })

      if (upsertError) throw upsertError
    }

    return this.getVendorDeliverySlots(vendorId)
  },

  async getAvailableDeliverySlots({ vendorId, requestedDate, now = new Date() }) {
    if (!vendorId || !requestedDate) return []

    const dayOfWeek = getDeliveryDayOfWeek(requestedDate)
    if (dayOfWeek == null) return []

    const [{ data: slots, error: slotsError }, { data: existingOrders, error: ordersError }] = await Promise.all([
      supabase
        .from('vendor_delivery_slots')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)
        .order('start_time', { ascending: true }),
      supabase
        .from('orders')
        .select('requested_delivery_slot_id, status')
        .eq('vendor_id', vendorId)
        .eq('requested_delivery_date', requestedDate),
    ])

    if (slotsError) throw slotsError
    if (ordersError) throw ordersError

    const activeOrders = (existingOrders || []).filter(
      (order) => !['cancelled', 'vendor_rejected'].includes(order.status)
    )

    const bookingsBySlot = activeOrders.reduce((accumulator, order) => {
      if (!order.requested_delivery_slot_id) return accumulator
      accumulator[order.requested_delivery_slot_id] = (accumulator[order.requested_delivery_slot_id] || 0) + 1
      return accumulator
    }, {})

    return (slots || []).map((slot) => decorateDeliverySlot({
      slot,
      requestedDate,
      bookedOrders: bookingsBySlot[slot.id] || 0,
      now,
    }))
  },
}

export default deliveryScheduleService