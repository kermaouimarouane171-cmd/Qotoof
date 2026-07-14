/**
 * 🛡️ Vendor Security Service
 * Comprehensive security management for vendor role
 * Trust score, digital signatures, offline sync
 * 
 * NOTE: mfaService, sessionService, autoLogoutService
 * have been moved to authServices.js to fix circular dependency
 */

import { supabase } from '@/services/supabase'
import { createSignature } from '@/utils/encryption'
import { auditLogger } from '@/services/auditLogger'
import { logger } from '../utils/logger.js'

// Re-export from authServices.js for backward compatibility
export { mfaService, sessionService, autoLogoutService } from '@/modules/auth'

let isVendorTrustScoreRpcAvailable = false

const resolveVendorTrustLevel = (score) => {
  if (score >= 90) return 'platinum'
  if (score >= 75) return 'gold'
  if (score >= 60) return 'silver'
  if (score >= 40) return 'bronze'
  return 'new'
}

const getVendorTrustScoreFallback = async (vendorId) => {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('created_at, is_verified, is_approved')
    .eq('id', vendorId)
    .single()

  if (profileError || !profile) {
    if (profileError) {
      logger.error('Vendor trust score fallback profile error:', profileError)
    }
    return null
  }

  const [{ data: reviews, error: reviewsError }, { data: orders, error: ordersError }] = await Promise.all([
    supabase
      .from('reviews')
      .select('rating')
      .eq('vendor_id', vendorId)
      .is('deleted_at', null),
    supabase
      .from('orders')
      .select('status')
      .eq('vendor_id', vendorId)
  ])

  if (reviewsError) {
    logger.error('Vendor trust score fallback reviews error:', reviewsError)
    return null
  }

  if (ordersError) {
    logger.error('Vendor trust score fallback orders error:', ordersError)
    return null
  }

  const reviewRows = reviews || []
  const orderRows = orders || []
  const totalReviews = reviewRows.length
  const totalOrders = orderRows.length
  const completedOrders = orderRows.filter((order) => ['completed', 'delivered'].includes(order.status)).length
  const averageRating = totalReviews > 0
    ? Number((reviewRows.reduce((sum, review) => sum + Number(review.rating || 0), 0) / totalReviews).toFixed(2))
    : 0

  const memberDays = profile.created_at
    ? Math.max(0, Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  let score = 0
  score += (averageRating / 5) * 30
  score += Math.min(totalReviews / 10, 10)

  if (totalOrders > 0) {
    score += (completedOrders / totalOrders) * 25
  }

  if (profile.is_verified) {
    score += 20
  } else if (profile.is_approved) {
    score += 10
  }

  score += Math.min((memberDays / 365) * 15, 15)

  return {
    score: Number(score.toFixed(1)),
    level: resolveVendorTrustLevel(score),
    avg_rating: averageRating,
    total_reviews: totalReviews,
    total_orders: totalOrders,
    completed_orders: completedOrders,
    member_days: memberDays,
    is_verified: Boolean(profile.is_verified),
    is_approved: Boolean(profile.is_approved),
  }
}

// ============================================
// 1. TRUST SCORE SERVICE
// ============================================

export const trustScoreService = {
  /**
   * Get vendor trust score
   */
  async getTrustScore(vendorId = null) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const id = vendorId || user?.id
      if (!id) return null

      if (!isVendorTrustScoreRpcAvailable) {
        return getVendorTrustScoreFallback(id)
      }

      const { data, error } = await supabase.rpc('calculate_vendor_trust_score', {
        vendor_id: id
      })

      if (error) {
        if (error.code === 'PGRST202' || String(error.message || '').includes('calculate_vendor_trust_score')) {
          isVendorTrustScoreRpcAvailable = false
          return getVendorTrustScoreFallback(id)
        }

        logger.error('Get trust score error:', error)
        return null
      }

      return data
    } catch (error) {
      logger.error('Get trust score error:', error)
      return null
    }
  },

  /**
   * Get trust score badge info
   */
  getTrustBadge(trustScore) {
    if (!trustScore) return null

    const badges = {
      platinum: {
        label: 'Platinum Vendor',
        color: 'bg-purple-100 text-purple-800',
        icon: '💎',
        description: 'Top-tier verified vendor'
      },
      gold: {
        label: 'Gold Vendor',
        color: 'bg-yellow-100 text-yellow-800',
        icon: '🥇',
        description: 'Highly trusted vendor'
      },
      silver: {
        label: 'Silver Vendor',
        color: 'bg-gray-100 text-gray-800',
        icon: '🥈',
        description: 'Trusted vendor'
      },
      bronze: {
        label: 'Bronze Vendor',
        color: 'bg-orange-100 text-orange-800',
        icon: '🥉',
        description: 'Established vendor'
      },
      new: {
        label: 'New Vendor',
        color: 'bg-blue-100 text-blue-800',
        icon: '🆕',
        description: 'Recently joined'
      }
    }

    return badges[trustScore.level] || badges.new
  }
}

// ============================================
// 4. DIGITAL SIGNATURE SERVICE
// ============================================

export const signatureService = {
  /**
   * Sign an order
   */
  async signOrder(orderId, orderData) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user logged in')

      const signature = await createSignature(orderData, user.id)

      const { error } = await supabase
        .from('digital_signatures')
        .insert({
          entity_type: 'order',
          entity_id: orderId,
          signer_id: user.id,
          signature_hash: signature.hash,
          signature_metadata: {
            algorithm: signature.algorithm,
            timestamp: signature.timestamp,
            version: signature.version
          }
        })

      if (error) throw error

      // Log action
      await auditLogger.log({
        action: 'SIGN',
        entityType: 'order',
        entityId: orderId,
        metadata: { signature }
      })

      return { success: true, signature }
    } catch (error) {
      logger.error('Sign order error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Verify a signature
   */
  async verifySignature(entityType, entityId) {
    try {
      const { data, error } = await supabase
        .from('digital_signatures')
        .select(`
          *,
          signer:profiles(first_name, last_name, avatar_url)
        `)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)

      if (error) throw error

      return data || []
    } catch (error) {
      logger.error('Verify signature error:', error)
      return []
    }
  }
}

// ============================================
// 2. OFFLINE SYNC SERVICE
// ============================================

export const offlineSyncService = {
  /**
   * Queue an action for offline sync
   */
  async queueAction(action, entityType, entityId, payload) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user logged in')

      const { error } = await supabase
        .from('offline_sync_queue')
        .insert({
          user_id: user.id,
          action,
          entity_type: entityType,
          entity_id: entityId,
          payload
        })

      if (error) throw error

      return { success: true }
    } catch (error) {
      logger.error('Queue action error:', error)
      return { success: false, error: error.message }
    }
  },

  /**
   * Get pending sync actions
   */
  async getPendingActions() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await supabase
        .from('offline_sync_queue')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (error) throw error

      return data || []
    } catch (error) {
      logger.error('Get pending actions error:', error)
      return []
    }
  },

  /**
   * Sync pending actions
   */
  async syncActions() {
    try {
      const pendingActions = await this.getPendingActions()
      const results = []

      for (const action of pendingActions) {
        try {
          // Execute action based on type
          let result
          switch (action.action) {
            case 'create':
              result = await supabase
                .from(action.entity_type)
                .insert(action.payload)
              break
            case 'update':
              result = await supabase
                .from(action.entity_type)
                .update(action.payload)
                .eq('id', action.entity_id)
              break
            case 'delete':
              result = await supabase
                .from(action.entity_type)
                .delete()
                .eq('id', action.entity_id)
              break
          }

          if (result.error) throw result.error

          // Mark as synced
          await supabase
            .from('offline_sync_queue')
            .update({
              status: 'synced',
              synced_at: new Date().toISOString()
            })
            .eq('id', action.id)

          results.push({ id: action.id, success: true })
        } catch (error) {
          // Increment retry count
          await supabase
            .from('offline_sync_queue')
            .update({
              retry_count: action.retry_count + 1,
              error_message: error.message,
              status: action.retry_count + 1 >= action.max_retries ? 'failed' : 'pending'
            })
            .eq('id', action.id)

          results.push({ id: action.id, success: false, error: error.message })
        }
      }

      return results
    } catch (error) {
      logger.error('Sync actions error:', error)
      return []
    }
  }
}

// ============================================
// Default export
// ============================================
export default {
  trustScoreService,
  signatureService,
  offlineSyncService
}
