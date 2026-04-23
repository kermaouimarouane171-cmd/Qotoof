/**
 * 🛡️ Vendor Security Service
 * Comprehensive security management for vendor role
 * Trust score, digital signatures, offline sync
 * 
 * NOTE: mfaService, sessionService, autoLogoutService
 * have been moved to authServices.js to fix circular dependency
 */

import { supabase } from '@/services/supabase'
import { generateOTP, createSignature } from '@/utils/encryption'
import { auditLogger } from '@/services/auditLogger'
import { logger } from '../utils/logger.js'
import { withRetry } from '@/utils/withRetry'

// Re-export from authServices.js for backward compatibility
export { mfaService, sessionService, autoLogoutService } from '@/services/authServices'

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

      const { data, error } = await supabase.rpc('calculate_vendor_trust_score', {
        vendor_id: id
      })

      if (error) {
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
