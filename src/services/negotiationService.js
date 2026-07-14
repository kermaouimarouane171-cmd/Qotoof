import { supabase } from './supabase'
import { calculateShippingCost, calculateDistance } from './shippingCalculator'
import { createCheckoutOrder } from '@/modules/checkout'
import { logger } from '@/utils/logger'
import { auditLogger } from '@/services/auditLogger'

const MAX_ROUNDS = 3
const EXPIRY_HOURS = 24

/**
 * Check rate limit for negotiation actions using the existing
 * check_negotiation_rate_limit SQL wrapper (calls enforce_rate_limit internally).
 * Returns { allowed, retry_after_seconds, remaining, reset_at }.
 * Fails open on error so the app stays functional.
 */
async function checkNegotiationRateLimit(userId, action) {
  try {
    const { data, error } = await supabase.rpc('check_negotiation_rate_limit', {
      p_user_id: userId,
      p_action: action,
    }).single()

    if (error) throw error
    return data
  } catch (err) {
    logger.warn('Negotiation rate limit check failed (non-fatal, allowing):', err)
    return { allowed: true, remaining: 99, retry_after_seconds: 0, reset_at: null }
  }
}

/**
 * Log a negotiation event to the immutable audit_logs table
 * using the existing auditLogger infrastructure (used in 29+ files).
 */
async function logNegotiationAudit({ action, negotiationId, userId = null, oldValues = null, newValues = null, metadata = null }) {
  try {
    await auditLogger.log({
      action,
      entityType: 'negotiation',
      entityId: negotiationId,
      oldValues,
      newValues,
      userId,
      metadata,
    })
  } catch (err) {
    logger.warn('Negotiation audit log failed (non-fatal):', err)
  }
}

/**
 * Call the session-audit edge function to log negotiation events
 * with the real client IP and user agent (captured server-side).
 * Complements the client-side auditLogger which captures device fingerprint.
 */
async function logSessionAudit(action, negotiationId, metadata = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.functions.invoke('session-audit', {
      body: {
        user_id: user?.id,
        action,
        entityType: 'negotiation',
        entityId: negotiationId,
        metadata,
      },
    })
  } catch (err) {
    logger.warn('Session audit for negotiation failed (non-fatal):', err)
  }
}

/**
 * Log a suspicious_negotiation security alert using the existing
 * create_security_alert SQL function + security_alerts table.
 */
async function logSuspiciousNegotiation({ userId, reason, metadata = {} }) {
  try {
    await supabase.rpc('create_security_alert', {
      p_alert_type: 'suspicious_negotiation',
      p_severity: 'medium',
      p_title: `Suspicious negotiation activity: ${reason}`,
      p_description: reason,
      p_user_id: userId,
      p_metadata: metadata,
    })
  } catch (err) {
    logger.warn('Security alert for negotiation failed (non-fatal):', err)
  }
}

/**
 * Check if the user's phone is verified before allowing negotiation creation.
 * Uses the existing profiles.is_verified flag.
 * Fails open on error so the app stays functional.
 */
async function checkPhoneVerified(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_verified, phone')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw error
    return { verified: !!data?.is_verified, phone: data?.phone || null }
  } catch (err) {
    logger.warn('Phone verification check failed (non-fatal, allowing):', err)
    return { verified: true, phone: null }
  }
}

/**
 * Compute delivery price + distance for a negotiation using the same
 * shippingCalculator used in normal checkout.
 *
 * @param {string} vendorId
 * @param {string} buyerId
 * @returns {Promise<{ deliveryPrice: number, deliveryDistanceKm: number|null }>}
 */
async function computeDelivery(vendorId, buyerId) {
  const { data: vendor, error: vErr } = await supabase
    .from('public_profiles')
    .select('city, latitude, longitude')
    .eq('id', vendorId)
    .maybeSingle()
  if (vErr) throw vErr

  const { data: buyer, error: bErr } = await supabase
    .from('profiles')
    .select('city, latitude, longitude')
    .eq('id', buyerId)
    .maybeSingle()
  if (bErr) throw bErr

  if (!vendor?.latitude || !vendor?.longitude || !buyer?.latitude || !buyer?.longitude) {
    return { deliveryPrice: 0, deliveryDistanceKm: null }
  }

  const distance = calculateDistance(
    vendor.latitude, vendor.longitude,
    buyer.latitude, buyer.longitude,
  )

  const quote = await calculateShippingCost({
    vendorCity: vendor.city,
    vendorLat: vendor.latitude,
    vendorLon: vendor.longitude,
    buyerCity: buyer.city,
    buyerLat: buyer.latitude,
    buyerLon: buyer.longitude,
  })

  return {
    deliveryPrice: quote.cost || 0,
    deliveryDistanceKm: distance,
  }
}

/**
 * Create a new price negotiation (buyer initiates).
 */
export async function createNegotiation({
  productId,
  buyerId,
  vendorId,
  originalPrice,
  proposedPrice,
  proposedQuantity = 1,
  buyerNote = null,
}) {
  // ── Security gate 1: phone verification ──────────────────────────
  const { verified } = await checkPhoneVerified(buyerId)
  if (!verified) {
    throw new Error('Phone verification required to create negotiations')
  }

  // ── Security gate 2: rate limiting (5 offers/hour) ───────────────
  const rateLimit = await checkNegotiationRateLimit(buyerId, 'create')
  if (!rateLimit.allowed) {
    await logSuspiciousNegotiation({
      userId: buyerId,
      reason: 'Rate limit exceeded on negotiation creation',
      metadata: { action: 'create', retry_after: rateLimit.retry_after_seconds },
    })
    throw new Error(`Rate limit exceeded. Try again in ${rateLimit.retry_after_seconds} seconds.`)
  }

  const { deliveryPrice, deliveryDistanceKm } = await computeDelivery(vendorId, buyerId)

  const { data, error } = await supabase
    .from('price_negotiations')
    .insert({
      product_id: productId,
      buyer_id: buyerId,
      vendor_id: vendorId,
      original_price: originalPrice,
      proposed_price: proposedPrice,
      proposed_quantity: proposedQuantity,
      offer_by: 'buyer',
      status: 'pending',
      round_number: 1,
      max_rounds: MAX_ROUNDS,
      expires_at: new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000).toISOString(),
      delivery_price: deliveryPrice,
      delivery_distance_km: deliveryDistanceKm,
      buyer_note: buyerNote,
    })
    .select('*')
    .single()

  if (error) throw error

  // ── Audit log: negotiation created ───────────────────────────────
  await logNegotiationAudit({
    action: 'NEGOTIATION_CREATED',
    negotiationId: data.id,
    userId: buyerId,
    newValues: {
      product_id: productId,
      original_price: originalPrice,
      proposed_price: proposedPrice,
      proposed_quantity: proposedQuantity,
      status: 'pending',
      round_number: 1,
    },
    metadata: { vendor_id: vendorId },
  })

  await logSessionAudit('NEGOTIATION_CREATED', data.id, { vendor_id: vendorId, proposed_price: proposedPrice })

  return data
}

/**
 * Fetch a single negotiation by ID with joined product + profiles.
 */
export async function fetchNegotiation(id) {
  const { data, error } = await supabase
    .from('price_negotiations')
    .select(`
      *,
      product:products(id, name, image_url, price, vendor_id),
      buyer:profiles!buyer_id(first_name, last_name, email, phone, city),
      vendor:public_profiles!vendor_id(store_name, first_name, last_name, email, phone, city)
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data
}

/**
 * Fetch all negotiations for the current buyer.
 */
export async function fetchBuyerNegotiations(buyerId) {
  const { data, error } = await supabase
    .from('price_negotiations')
    .select(`
      *,
      product:products(id, name, image_url, price),
      vendor:public_profiles!vendor_id(store_name, city)
    `)
    .eq('buyer_id', buyerId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Fetch all negotiations for the current vendor.
 */
export async function fetchVendorNegotiations(vendorId) {
  const { data, error } = await supabase
    .from('price_negotiations')
    .select(`
      *,
      product:products(id, name, image_url, price),
      buyer:profiles!buyer_id(first_name, last_name, email, phone, city)
    `)
    .eq('vendor_id', vendorId)
    .order('updated_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Vendor (or buyer) accepts the current offer.
 * Status → 'accepted'. The negotiation can then be converted to an order.
 */
export async function acceptNegotiation(id, { note = null } = {}) {
  const { data: existing, error: fetchErr } = await supabase
    .from('price_negotiations')
    .select('status, proposed_price, round_number')
    .eq('id', id)
    .single()
  if (fetchErr) throw fetchErr

  const { data, error } = await supabase
    .from('price_negotiations')
    .update({
      status: 'accepted',
      vendor_note: note,
      expires_at: new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000).toISOString(),
    })
    .eq('id', id)
    .in('status', ['pending', 'countered'])
    .select('*')
    .single()

  if (error) throw error

  await logNegotiationAudit({
    action: 'NEGOTIATION_ACCEPTED',
    negotiationId: id,
    oldValues: { status: existing.status, proposed_price: existing.proposed_price },
    newValues: { status: 'accepted', proposed_price: data.proposed_price },
    metadata: { round_number: existing.round_number, note },
  })

  await logSessionAudit('NEGOTIATION_ACCEPTED', id, { round_number: existing.round_number })

  return data
}

/**
 * Reject the current offer. Status → 'rejected', negotiation closed.
 */
export async function rejectNegotiation(id, { note = null } = {}) {
  const { data: existing, error: fetchErr } = await supabase
    .from('price_negotiations')
    .select('status, proposed_price, round_number')
    .eq('id', id)
    .single()
  if (fetchErr) throw fetchErr

  const { data, error } = await supabase
    .from('price_negotiations')
    .update({
      status: 'rejected',
      vendor_note: note,
    })
    .eq('id', id)
    .in('status', ['pending', 'countered'])
    .select('*')
    .single()

  if (error) throw error

  await logNegotiationAudit({
    action: 'NEGOTIATION_REJECTED',
    negotiationId: id,
    oldValues: { status: existing.status, proposed_price: existing.proposed_price },
    newValues: { status: 'rejected', note },
    metadata: { round_number: existing.round_number },
  })

  await logSessionAudit('NEGOTIATION_REJECTED', id, { round_number: existing.round_number })

  return data
}

/**
 * Submit a counter-offer. Increments round_number, resets expiry.
 * Fails if max_rounds is exceeded.
 */
export async function counterNegotiation(id, {
  proposedPrice,
  note = null,
  offerBy,
}) {
  const { data: existing, error: fetchErr } = await supabase
    .from('price_negotiations')
    .select('round_number, max_rounds, status, proposed_price, buyer_id, vendor_id')
    .eq('id', id)
    .single()
  if (fetchErr) throw fetchErr

  if (existing.status === 'expired' || existing.status === 'rejected') {
    throw new Error('Cannot counter an expired or rejected negotiation')
  }

  const nextRound = existing.round_number + 1
  if (nextRound > existing.max_rounds) {
    throw new Error(`Maximum rounds (${existing.max_rounds}) exceeded`)
  }

  // ── Security gate: rate limiting on counter offers ───────────────
  const counterUserId = offerBy === 'buyer' ? existing.buyer_id : existing.vendor_id
  const rateLimit = await checkNegotiationRateLimit(counterUserId, 'counter')
  if (!rateLimit.allowed) {
    await logSuspiciousNegotiation({
      userId: counterUserId,
      reason: 'Rate limit exceeded on negotiation counter',
      metadata: { action: 'counter', negotiation_id: id, retry_after: rateLimit.retry_after_seconds },
    })
    throw new Error(`Rate limit exceeded. Try again in ${rateLimit.retry_after_seconds} seconds.`)
  }

  const oldPrice = existing.proposed_price

  const updateFields = {
    proposed_price: proposedPrice,
    offer_by: offerBy,
    status: 'countered',
    round_number: nextRound,
    expires_at: new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000).toISOString(),
  }

  if (offerBy === 'buyer') {
    updateFields.buyer_note = note
  } else {
    updateFields.vendor_note = note
  }

  const { data, error } = await supabase
    .from('price_negotiations')
    .update(updateFields)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error

  // ── Audit log: counter offer submitted ───────────────────────────
  await logNegotiationAudit({
    action: 'NEGOTIATION_COUNTERED',
    negotiationId: id,
    oldValues: { proposed_price: oldPrice, status: existing.status, round_number: existing.round_number },
    newValues: { proposed_price: proposedPrice, status: 'countered', round_number: nextRound },
    metadata: { offer_by: offerBy, note },
  })

  await logSessionAudit('NEGOTIATION_COUNTERED', id, { offer_by: offerBy, proposed_price: proposedPrice })

  return data
}

/**
 * Convert an accepted negotiation into a real order using the same
 * createCheckoutOrder flow used in normal checkout.
 *
 * @returns {Promise<{ orderId: string, paypalOrderId?: string }>}
 */
export async function convertNegotiationToOrder(id, { shippingInfo, deliveryLocation }) {
  const neg = await fetchNegotiation(id)
  if (!neg) throw new Error('Negotiation not found')
  if (neg.status !== 'accepted') throw new Error('Negotiation must be accepted first')

  const cartItem = {
    id: neg.product_id,
    vendor_id: neg.vendor_id,
    price_per_unit: neg.proposed_price,
    quantity: neg.proposed_quantity,
  }

  const result = await createCheckoutOrder({
    items: [cartItem],
    shippingInfo,
    deliveryLocation,
    paymentType: 'full',
    selectedPaymentMethod: 'paypal',
    idempotencyKey: `neg-${neg.id}`,
  })

  const orderId = result.data?.id || result.orders?.[0]?.id
  if (!orderId) throw new Error('Failed to create order from negotiation')

  // Create PayPal order via edge function (same as checkout)
  const amount = Number(result.data?.first_payment_amount || 0)
    || Number((neg.proposed_price * neg.proposed_quantity) + (neg.delivery_price || 0))

  // Link negotiation to the created order
  await supabase
    .from('price_negotiations')
    .update({ status: 'converted', converted_order_id: orderId })
    .eq('id', id)

  // ── Audit log: negotiation converted to order ────────────────────
  await logNegotiationAudit({
    action: 'NEGOTIATION_CONVERTED',
    negotiationId: id,
    oldValues: { status: 'accepted' },
    newValues: { status: 'converted', converted_order_id: orderId },
    metadata: { order_id: orderId, amount },
  })

  await logSessionAudit('NEGOTIATION_CONVERTED', id, { order_id: orderId, amount })

  const { data: paypalInit, error: paypalErr } = await supabase.functions.invoke('create-paypal-order', {
    body: {
      orderId,
      amount,
      currency: 'MAD',
      customer: {
        email: neg.buyer?.email || null,
        name: `${neg.buyer?.first_name || ''} ${neg.buyer?.last_name || ''}`.trim(),
      },
      returnUrl: `${window.location.origin}/order-confirmation/${orderId}?paypal=success`,
      cancelUrl: `${window.location.origin}/order-confirmation/${orderId}?paypal=cancel`,
    },
  })

  if (paypalErr) {
    logger.error('PayPal order creation failed for negotiation:', paypalErr)
  }

  return {
    orderId,
    paypalOrderId: paypalInit?.orderId || null,
    amount,
  }
}

/**
 * Expire stale negotiations (call on page load as a safety net alongside cron).
 */
export async function expireStaleNegotiations() {
  try {
    const { data, error } = await supabase.rpc('expire_stale_negotiations')
    if (error) throw error
    return data
  } catch (err) {
    logger.warn('expireStaleNegotiations failed (non-fatal):', err)
    return 0
  }
}

/**
 * Subscribe to real-time updates on a single negotiation.
 */
export function subscribeToNegotiation(id, callback) {
  const channel = supabase
    .channel(`negotiation:${id}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'price_negotiations',
      filter: `id=eq.${id}`,
    }, (payload) => callback(payload.new))
    .subscribe()

  return () => supabase.removeChannel(channel)
}

export const NEGOTIATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  COUNTERED: 'countered',
  EXPIRED: 'expired',
  CONVERTED: 'converted',
}

export const NEGOTIATION_MAX_ROUNDS = MAX_ROUNDS
