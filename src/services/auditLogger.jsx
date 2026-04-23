/**
 * 📝 Audit Logger Service
 * Provides immutable audit logging for all critical operations
 * Ensures non-repudiation and accountability
 */

import { supabase } from '@/services/supabase'
import { generateHash, createSignature, getDeviceInfo, generateDeviceFingerprint } from '@/utils/encryption'
import { logger } from '../utils/logger.js'

// ============================================
// 1. AUDIT LOGGER CLASS
// ============================================

class AuditLogger {
  constructor() {
    this.queue = []
    this.isFlushing = false
    this.maxQueueSize = 50
    this.flushInterval = 5000 // 5 seconds
    this.isOnline = navigator.onLine
    
    // Listen for online/offline events
    window.addEventListener('online', () => { this.isOnline = true; this.flush() })
    window.addEventListener('offline', () => { this.isOnline = false })
    
    // Auto flush
    setInterval(() => this.flush(), this.flushInterval)
  }

  normalizeLog(log) {
    if (!log) return log

    return {
      ...log,
      timestamp: log.timestamp || log.created_at || log.createdAt || null,
    }
  }

  /**
   * Log an action
   * @param {object} options - Log options
   */
  async log({
    action,
    entityType,
    entityId = null,
    oldValues = null,
    newValues = null,
    userId = null,
    _metadata = {}
  }) {
    try {
      // Get current user if not provided
      if (!userId) {
        const { data: { user } } = await supabase.auth.getUser()
        userId = user?.id
      }

      // Get device info
      getDeviceInfo()
      const deviceFingerprint = await generateDeviceFingerprint()
      
      // Get session
      const { data: { session } } = await supabase.auth.getSession()
      
      // Create signature for non-repudiation
      const signatureData = {
        userId,
        action,
        entityType,
        entityId,
        timestamp: new Date().toISOString()
      }
      const signature = await createSignature(signatureData, userId)

      // Create audit log entry
      const auditLog = {
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        old_values: oldValues,
        new_values: newValues,
        ip_address: null, // Will be set by database
        user_agent: navigator.userAgent,
        device_fingerprint: deviceFingerprint,
        session_id: session?.access_token?.substring(0, 50) || null,
        signature: signature.hash
        // metadata field removed temporarily until migration is run
      }

      // If online, send immediately
      if (this.isOnline) {
        await this.sendToServer(auditLog)
      } else {
        // Queue for later
        this.queue.push(auditLog)
        
        // Prevent queue overflow
        if (this.queue.length > this.maxQueueSize) {
          this.queue.shift() // Remove oldest entry
        }
      }

      return true
    } catch (error) {
      logger.error('Audit log error:', error)
      // Don't throw - audit logging should not break the app
      return false
    }
  }

  /**
   * Send audit log to server
   */
  async sendToServer(auditLog) {
    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert(auditLog)

      if (error) {
        // Silently fail - audit logging should not break the app
        // Queue for retry only if it's a network error
        if (error.code !== 'PGRST204') {
          this.queue.push(auditLog)
        }
      }
    } catch (_error) {
      // Silently fail - don't break the app
      this.queue.push(auditLog)
    }
  }

  /**
   * Flush queued audit logs
   */
  async flush() {
    if (this.isFlushing || this.queue.length === 0 || !this.isOnline) {
      return
    }

    this.isFlushing = true

    try {
      const logsToSend = [...this.queue]
      this.queue = []

      const { error } = await supabase
        .from('audit_logs')
        .insert(logsToSend)

      if (error) {
        // Silently fail - put back in queue
        if (error.code !== 'PGRST204') {
          this.queue.unshift(...logsToSend)
        }
        // Prevent queue overflow
        if (this.queue.length > this.maxQueueSize) {
          this.queue = this.queue.slice(0, this.maxQueueSize)
        }
      }
    } catch (_error) {
      // Silently fail
    } finally {
      this.isFlushing = false
    }
  }

  /**
   * Get audit logs for current user
   */
  async getUserLogs({
    entityType = null,
    action = null,
    limit = 50,
    offset = 0
  } = {}) {
    try {
      const buildBaseQuery = (orderColumn) => supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order(orderColumn, { ascending: false })
        .limit(limit)

      let query = buildBaseQuery('timestamp')

      if (entityType) {
        query = query.eq('entity_type', entityType)
      }

      if (action) {
        query = query.eq('action', action)
      }

      let { data, error, count } = await query

      if (error?.message?.includes('timestamp')) {
        query = buildBaseQuery('created_at')

        if (entityType) {
          query = query.eq('entity_type', entityType)
        }

        if (action) {
          query = query.eq('action', action)
        }

        const fallbackResult = await query
        data = fallbackResult.data
        error = fallbackResult.error
        count = fallbackResult.count
      }

      if (error) throw error

      return {
        logs: (data || []).map((log) => this.normalizeLog(log)),
        total: count,
        limit,
        offset
      }
    } catch (error) {
      logger.error('Get audit logs error:', error)
      return { logs: [], total: 0, limit, offset }
    }
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityLogs(entityType, entityId, limit = 50) {
    try {
      const baseSelect = `
          *,
          user:profiles(first_name, last_name, avatar_url, role)
        `

      let { data, error } = await supabase
        .from('audit_logs')
        .select(baseSelect)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('timestamp', { ascending: false })
        .limit(limit)

      if (error?.message?.includes('timestamp')) {
        const fallbackResult = await supabase
          .from('audit_logs')
          .select(baseSelect)
          .eq('entity_type', entityType)
          .eq('entity_id', entityId)
          .order('created_at', { ascending: false })
          .limit(limit)

        data = fallbackResult.data
        error = fallbackResult.error
      }

      if (error) throw error

      return (data || []).map((log) => this.normalizeLog(log))
    } catch (error) {
      logger.error('Get entity logs error:', error)
      return []
    }
  }

  /**
   * Verify audit log signature
   */
  async verifyLog(auditLog) {
    try {
      const signatureData = {
        userId: auditLog.user_id,
        action: auditLog.action,
        entityType: auditLog.entity_type,
        entityId: auditLog.entity_id,
        timestamp: auditLog.timestamp || auditLog.created_at
      }

      const expectedHash = await generateHash(
        `${signatureData.userId}:${JSON.stringify(signatureData)}:${signatureData.timestamp}`
      )

      return {
        isValid: auditLog.signature === expectedHash,
        expectedHash,
        actualHash: auditLog.signature
      }
    } catch (error) {
      logger.error('Verify log error:', error)
      return { isValid: false, error: error.message }
    }
  }

  // ============================================
  // CONVENIENCE METHODS (as class methods)
  // ============================================

  /**
   * Log product action
   */
  async logProductAction(action, productData, oldData = null) {
    return this.log({
      action,
      entityType: 'product',
      entityId: productData.id,
      oldValues: oldData,
      newValues: productData
    })
  }

  /**
   * Log order action
   */
  async logOrderAction(action, orderData, oldData = null) {
    return this.log({
      action,
      entityType: 'order',
      entityId: orderData.id,
      oldValues: oldData,
      newValues: orderData
    })
  }

  /**
   * Log profile action
   */
  async logProfileAction(action, profileData, oldData = null) {
    return this.log({
      action,
      entityType: 'profile',
      entityId: profileData.id,
      oldValues: oldData,
      newValues: profileData
    })
  }

  /**
   * Log authentication action
   */
  async logAuthAction(action, userId, metadata = {}) {
    return this.log({
      action,
      entityType: 'auth',
      userId,
      metadata
    })
  }

  /**
   * Log MFA action
   */
  async logMFAAction(action, userId, metadata = {}) {
    return this.log({
      action,
      entityType: 'mfa',
      userId,
      metadata
    })
  }

  /**
   * Log session action
   */
  async logSessionAction(action, userId, metadata = {}) {
    return this.log({
      action,
      entityType: 'session',
      userId,
      metadata
    })
  }

  /**
   * Log financial data action (bank account, payment info, etc.)
   * CRITICAL: Never log full account numbers - only last 4 digits
   */
  async logFinancialAction(action, userId, metadata = {}) {
    return this.log({
      action,
      entityType: 'financial',
      userId,
      metadata
    })
  }

  /**
   * Log security action
   */
  async logSecurityAction(action, userId, metadata = {}) {
    return this.log({
      action,
      entityType: 'security',
      userId,
      metadata
    })
  }
}

// Create singleton instance
export const auditLogger = new AuditLogger()

// ============================================
// 2. CONVENIENCE METHODS
// ============================================

/**
 * Log product action
 */
export const logProductAction = async (action, productData, oldData = null) => {
  return auditLogger.log({
    action,
    entityType: 'product',
    entityId: productData.id,
    oldValues: oldData,
    newValues: productData
  })
}

/**
 * Log order action
 */
export const logOrderAction = async (action, orderData, oldData = null) => {
  return auditLogger.log({
    action,
    entityType: 'order',
    entityId: orderData.id,
    oldValues: oldData,
    newValues: orderData
  })
}

/**
 * Log profile action
 */
export const logProfileAction = async (action, profileData, oldData = null) => {
  return auditLogger.log({
    action,
    entityType: 'profile',
    entityId: profileData.id,
    oldValues: oldData,
    newValues: profileData
  })
}

/**
 * Log authentication action
 */
export const logAuthAction = async (action, userId, metadata = {}) => {
  return auditLogger.log({
    action,
    entityType: 'auth',
    userId,
    metadata
  })
}

/**
 * Log MFA action
 */
export const logMFAAction = async (action, userId, metadata = {}) => {
  return auditLogger.log({
    action,
    entityType: 'mfa',
    userId,
    metadata
  })
}

/**
 * Log session action
 */
export const logSessionAction = async (action, userId, metadata = {}) => {
  return auditLogger.log({
    action,
    entityType: 'session',
    userId,
    metadata
  })
}

/**
 * Log financial data action (bank account, payment info, etc.)
 * CRITICAL: Never log full account numbers - only last 4 digits
 */
export const logFinancialAction = async (action, userId, metadata = {}) => {
  return auditLogger.log({
    action,
    entityType: 'financial',
    userId,
    metadata
  })
}

/**
 * Log security action
 */
export const logSecurityAction = async (action, userId, metadata = {}) => {
  return auditLogger.log({
    action,
    entityType: 'security',
    userId,
    metadata
  })
}

// ============================================
// 3. REACT HOOK FOR AUDIT LOGS
// ============================================

import { useState, useEffect, useCallback } from 'react'

/**
 * React hook to fetch and display audit logs
 */
export const useAuditLogs = (options = {}) => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const result = await auditLogger.getUserLogs(options)
      
      setLogs(result.logs)
      setTotal(result.total)
    } catch (err) {
      logger.error('Fetch audit logs error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [options])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return {
    logs,
    loading,
    error,
    total,
    refresh: fetchLogs
  }
}

/**
 * React hook for entity audit logs
 */
export const useEntityAuditLogs = (entityType, entityId, limit = 50) => {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!entityType || !entityId) return

    const fetchLogs = async () => {
      try {
        setLoading(true)
        const data = await auditLogger.getEntityLogs(entityType, entityId, limit)
        setLogs(data)
      } catch (error) {
        logger.error('Fetch entity logs error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [entityType, entityId, limit])

  return { logs, loading }
}

// ============================================
// 4. AUDIT LOG VIEWER COMPONENT
// ============================================

import React from 'react'

/**
 * Simple audit log viewer component
 */
export const AuditLogViewer = ({ logs, loading }) => {
  if (loading) {
    return <div className="text-center py-4">Loading audit logs...</div>
  }

  if (!logs || logs.length === 0) {
    return <div className="text-center py-4 text-gray-500">No audit logs found</div>
  }

  const getActionColor = (action) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800'
      case 'UPDATE': return 'bg-yellow-100 text-yellow-800'
      case 'DELETE': return 'bg-red-100 text-red-800'
      case 'LOGIN': return 'bg-blue-100 text-blue-800'
      case 'LOGOUT': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div key={log.id} className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.action)}`}>
              {log.action}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(log.timestamp).toLocaleString()}
            </span>
          </div>
          <div className="text-sm">
            <span className="font-medium">{log.entity_type}</span>
            {log.entity_id && <span className="text-gray-500 ml-2">({log.entity_id.substring(0, 8)})</span>}
          </div>
          {log.metadata && (
            <pre className="mt-2 p-2 bg-white rounded text-xs overflow-x-auto">
              {JSON.stringify(log.metadata, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  )
}

// ============================================
// Default export
// ============================================
export default {
  auditLogger,
  logProductAction,
  logOrderAction,
  logProfileAction,
  logAuthAction,
  logMFAAction,
  logSessionAction,
  logFinancialAction,
  logSecurityAction,
  useAuditLogs,
  useEntityAuditLogs,
  AuditLogViewer
}
