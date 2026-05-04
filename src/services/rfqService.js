/**
 * rfqService.js
 * Service layer for the RFQ (Request for Quote) system.
 *
 * Buyers post procurement needs → vendors submit price offers →
 * buyer accepts best offer → RFQ closes.
 */

import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

// ─── Internal: in-app notification helper ────────────────────────────────────

async function notify({ userId, title, message, category = 'system', data = {} }) {
  if (!userId) return
  try {
    await supabase.from('notifications').insert({
      user_id:   userId,
      title,
      message,
      type:      category,
      category,
      data,
      is_read:   false,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    // notifications are best-effort — never throw
    logger.warn('[rfqService] notify silenced:', err?.message)
  }
}

// ─── Buyer operations ─────────────────────────────────────────────────────────

/**
 * Create a new RFQ posted by a buyer.
 * @param {object} data - { title, description, category, quantity, unit, budgetMax, city, deadline }
 * @returns {Promise<object>} Created RFQ row
 */
export async function createRFQ(data) {
  const { data: rfq, error } = await supabase
    .from('rfqs')
    .insert({
      buyer_id:   data.buyerId,
      title:      data.title.trim(),
      description: data.description?.trim() || null,
      category:   data.category,
      quantity:   Number(data.quantity),
      unit:       data.unit || 'kg',
      budget_max: data.budgetMax ? Number(data.budgetMax) : null,
      city:       data.city?.trim() || null,
      deadline:   data.deadline || null,
    })
    .select()
    .single()

  if (error) {
    logger.error('[rfqService] createRFQ error:', error)
    throw error
  }

  return rfq
}

/**
 * Get all RFQs posted by a specific buyer, newest first.
 * @param {string} buyerId
 * @returns {Promise<Array>}
 */
export async function getBuyerRFQs(buyerId) {
  const { data, error } = await supabase
    .from('rfqs')
    .select(`
      id, title, category, quantity, unit, budget_max, city,
      deadline, status, winning_offer_id, created_at,
      rfq_offers(count)
    `)
    .eq('buyer_id', buyerId)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('[rfqService] getBuyerRFQs error:', error)
    throw error
  }

  return (data || []).map((rfq) => ({
    ...rfq,
    offersCount: rfq.rfq_offers?.[0]?.count ?? 0,
  }))
}

/**
 * Get all offers submitted on a specific RFQ, including vendor profile info.
 * Only the RFQ owner (buyer) should call this.
 * @param {string} rfqId
 * @returns {Promise<Array>}
 */
export async function getOffersForRFQ(rfqId) {
  const { data, error } = await supabase
    .from('rfq_offers')
    .select(`
      id, price_per_unit, total_price, message, status, created_at,
      vendor:profiles(id, first_name, last_name, store_name, city, average_rating)
    `)
    .eq('rfq_id', rfqId)
    .order('price_per_unit', { ascending: true })

  if (error) {
    logger.error('[rfqService] getOffersForRFQ error:', error)
    throw error
  }

  return data || []
}

/**
 * Buyer accepts an offer: marks offer as accepted, all others as rejected,
 * and closes the RFQ.
 * @param {string} rfqId
 * @param {string} offerId
 * @returns {Promise<void>}
 */
export async function acceptOffer(rfqId, offerId) {
  // Fetch offer vendor_id and RFQ title before updating
  const [offerResult, rfqResult] = await Promise.all([
    supabase.from('rfq_offers').select('vendor_id, price_per_unit').eq('id', offerId).single(),
    supabase.from('rfqs').select('title, quantity, unit').eq('id', rfqId).single(),
  ])

  // Mark winning offer
  const { error: acceptError } = await supabase
    .from('rfq_offers')
    .update({ status: 'accepted' })
    .eq('id', offerId)
    .eq('rfq_id', rfqId)

  if (acceptError) throw acceptError

  // Reject the rest
  await supabase
    .from('rfq_offers')
    .update({ status: 'rejected' })
    .eq('rfq_id', rfqId)
    .neq('id', offerId)

  // Close the RFQ
  const { error: closeError } = await supabase
    .from('rfqs')
    .update({ status: 'closed', winning_offer_id: offerId })
    .eq('id', rfqId)

  if (closeError) throw closeError

  // Notify the winning vendor
  const vendorId  = offerResult.data?.vendor_id
  const rfqTitle  = rfqResult.data?.title || 'طلبك'
  const qty       = rfqResult.data ? `${rfqResult.data.quantity} ${rfqResult.data.unit}` : ''

  if (vendorId) {
    await notify({
      userId:   vendorId,
      title:    '🎉 تم قبول عرضك!',
      message:  `المشتري قبل عرضك على طلب: ${rfqTitle} (${qty}). تواصل معه لإتمام الصفقة.`,
      category: 'system',
      data:     { rfq_id: rfqId, offer_id: offerId },
    })
  }
}

/**
 * Buyer cancels their own RFQ.
 * @param {string} rfqId
 * @param {string} buyerId - safety check
 * @returns {Promise<void>}
 */
export async function cancelRFQ(rfqId, buyerId) {
  const { error } = await supabase
    .from('rfqs')
    .update({ status: 'cancelled' })
    .eq('id', rfqId)
    .eq('buyer_id', buyerId)

  if (error) {
    logger.error('[rfqService] cancelRFQ error:', error)
    throw error
  }
}

// ─── Vendor operations ────────────────────────────────────────────────────────

/**
 * Get open RFQs available for vendors to bid on.
 * @param {object} filters - { category?, city?, search? }
 * @returns {Promise<Array>}
 */
export async function getOpenRFQs({ category = '', city = '', search = '' } = {}) {
  let query = supabase
    .from('rfqs')
    .select(`
      id, title, category, quantity, unit, budget_max, city,
      deadline, status, created_at,
      buyer:profiles(id, first_name, last_name, city),
      rfq_offers(count)
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)
  if (city)     query = query.ilike('city', `%${city}%`)
  if (search)   query = query.ilike('title', `%${search}%`)

  const { data, error } = await query

  if (error) {
    logger.error('[rfqService] getOpenRFQs error:', error)
    throw error
  }

  return (data || []).map((rfq) => ({
    ...rfq,
    offersCount: rfq.rfq_offers?.[0]?.count ?? 0,
  }))
}

/**
 * Get all offers submitted by a vendor, with RFQ details.
 * @param {string} vendorId
 * @returns {Promise<Array>}
 */
export async function getVendorOffers(vendorId) {
  const { data, error } = await supabase
    .from('rfq_offers')
    .select(`
      id, price_per_unit, total_price, message, status, created_at,
      rfq:rfqs(id, title, category, quantity, unit, status, deadline, city)
    `)
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('[rfqService] getVendorOffers error:', error)
    throw error
  }

  return data || []
}

/**
 * Vendor submits a price offer on an open RFQ.
 * @param {object} data - { rfqId, vendorId, pricePerUnit, message }
 * @returns {Promise<object>}
 */
export async function submitOffer(data) {
  const { data: offer, error } = await supabase
    .from('rfq_offers')
    .insert({
      rfq_id:        data.rfqId,
      vendor_id:     data.vendorId,
      price_per_unit: Number(data.pricePerUnit),
      message:       data.message?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    logger.error('[rfqService] submitOffer error:', error)
    throw error
  }

  // Notify the buyer that a new offer arrived
  const { data: rfq } = await supabase
    .from('rfqs')
    .select('buyer_id, title')
    .eq('id', data.rfqId)
    .single()

  if (rfq?.buyer_id) {
    await notify({
      userId:   rfq.buyer_id,
      title:    'عرض سعر جديد على طلبك',
      message:  `تلقّيت عرض سعر جديد بـ ${Number(data.pricePerUnit).toFixed(2)} درهم/وحدة على طلبك: ${rfq.title}`,
      category: 'system',
      data:     { rfq_id: data.rfqId, offer_id: offer.id },
    })
  }

  return offer
}

/**
 * Vendor withdraws their pending offer.
 * @param {string} offerId
 * @param {string} vendorId - safety check
 * @returns {Promise<void>}
 */
export async function withdrawOffer(offerId, vendorId) {
  const { error } = await supabase
    .from('rfq_offers')
    .update({ status: 'withdrawn' })
    .eq('id', offerId)
    .eq('vendor_id', vendorId)
    .eq('status', 'pending')

  if (error) {
    logger.error('[rfqService] withdrawOffer error:', error)
    throw error
  }
}

const rfqService = {
  createRFQ,
  getBuyerRFQs,
  getOffersForRFQ,
  acceptOffer,
  cancelRFQ,
  getOpenRFQs,
  getVendorOffers,
  submitOffer,
  withdrawOffer,
}

export default rfqService
