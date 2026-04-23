import { supabase } from '@/services/supabase'

const normalizeReason = (reason) => (reason || '').trim().slice(0, 500)

const getCurrentlyActiveProductIds = async (vendorId) => {
  const { data, error } = await supabase
    .from('products')
    .select('id')
    .eq('vendor_id', vendorId)
    .eq('is_available', true)

  if (error) {
    throw error
  }

  return (data || []).map((item) => item.id)
}

const setProductsAvailability = async (vendorId, isAvailable, productIds = null) => {
  let query = supabase
    .from('products')
    .update({ is_available: isAvailable })
    .eq('vendor_id', vendorId)

  if (Array.isArray(productIds) && productIds.length > 0) {
    query = query.in('id', productIds)
  }

  const { error } = await query
  if (error) {
    throw error
  }
}

export const storeEmergencyService = {
  pauseStore: async ({ vendorId, reason }) => {
    if (!vendorId) {
      throw new Error('Vendor ID is required')
    }

    const activeProductIds = await getCurrentlyActiveProductIds(vendorId)

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        store_paused: true,
        store_paused_at: new Date().toISOString(),
        store_paused_reason: normalizeReason(reason),
        paused_active_products: activeProductIds,
      })
      .eq('id', vendorId)

    if (profileError) {
      throw profileError
    }

    if (activeProductIds.length > 0) {
      await setProductsAvailability(vendorId, false, activeProductIds)
    }

    return {
      paused: true,
      pausedAt: new Date().toISOString(),
      reason: normalizeReason(reason),
      pausedProductsCount: activeProductIds.length,
    }
  },

  resumeStore: async ({ vendorId }) => {
    if (!vendorId) {
      throw new Error('Vendor ID is required')
    }

    const { data: profileData, error: profileReadError } = await supabase
      .from('profiles')
      .select('paused_active_products')
      .eq('id', vendorId)
      .single()

    if (profileReadError) {
      throw profileReadError
    }

    const pausedProductIds = Array.isArray(profileData?.paused_active_products)
      ? profileData.paused_active_products
      : []

    if (pausedProductIds.length > 0) {
      await setProductsAvailability(vendorId, true, pausedProductIds)
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        store_paused: false,
        store_paused_at: null,
        store_paused_reason: null,
        store_resume_at: new Date().toISOString(),
        paused_active_products: [],
      })
      .eq('id', vendorId)

    if (profileError) {
      throw profileError
    }

    return {
      paused: false,
      resumedAt: new Date().toISOString(),
      resumedProductsCount: pausedProductIds.length,
    }
  },
}

export default storeEmergencyService