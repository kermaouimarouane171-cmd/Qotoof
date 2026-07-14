/**
 * IP Blocking Middleware
 * Checks incoming requests against the blocked IPs list
 * and blocks access for blacklisted IPs
 */
import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

// In-memory cache for blocked IPs (avoids DB query on every request)
let blockedIPsCache = new Map()
let cacheExpiry = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get client IP address
 * In browser context, this is limited. For server-side, use request headers.
 */
export function getClientIP() {
  // Browser context: WebRTC or external service needed for real IP
  // For now, we use a placeholder that can be replaced server-side
  return null
}

/**
 * Load blocked IPs from database into cache
 */
async function loadBlockedIPs() {
  const now = Date.now()
  
  // Check cache validity
  if (now < cacheExpiry && blockedIPsCache.size > 0) {
    return blockedIPsCache
  }

  try {
    const { data, error } = await supabase
      .from('blocked_ips')
      .select('ip_address, reason, expires_at, block_type')
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())

    if (error) {
      logger.error('Failed to load blocked IPs:', JSON.stringify(error, null, 2))
      return blockedIPsCache
    }

    // Clear old cache
    blockedIPsCache.clear()

    // Populate new cache
    if (data && data.length > 0) {
      data.forEach(blocked => {
        blockedIPsCache.set(blocked.ip_address, {
          reason: blocked.reason,
          expires_at: blocked.expires_at,
          block_type: blocked.block_type,
        })
      })
    }

    // Update cache expiry
    cacheExpiry = now + CACHE_TTL

    return blockedIPsCache
  } catch (error) {
    logger.error('Error loading blocked IPs:', JSON.stringify(error, null, 2))
    return blockedIPsCache
  }
}

/**
 * Check if an IP is blocked
 * @param {string} ip - IP address to check
 * @returns {Object} { blocked: boolean, reason?: string, blockType?: string }
 */
export async function isIPBlocked(ip) {
  if (!ip) return { blocked: false }

  // Load cache if needed
  await loadBlockedIPs()

  // Check cache
  const blockedInfo = blockedIPsCache.get(ip)
  
  if (blockedInfo) {
    return {
      blocked: true,
      reason: blockedInfo.reason,
      blockType: blockedInfo.block_type,
      expiresAt: blockedInfo.expires_at,
    }
  }

  return { blocked: false }
}

/**
 * Middleware function to check IP blocking
 * This should be called at the app entry point
 * @param {string} ip - Client IP address
 * @returns {Object} { allowed: boolean, blockInfo?: object }
 */
export async function ipBlockingMiddleware(ip) {
  if (!ip) {
    // If we can't determine IP, allow access (browser limitation)
    return { allowed: true }
  }

  const blockInfo = await isIPBlocked(ip)

  if (blockInfo.blocked) {
    logger.warn(`Blocked IP attempted access: ${ip}`, {
      reason: blockInfo.reason,
      blockType: blockInfo.blockType,
    })

    return {
      allowed: false,
      blockInfo,
    }
  }

  return { allowed: true }
}

/**
 * Block an IP address
 * @param {Object} params
 * @param {string} params.ip - IP address to block
 * @param {string} params.reason - Reason for blocking
 * @param {string} params.blockType - Type of block (manual, auto_brute_force, auto_rate_limit, auto_suspicious)
 * @param {string} params.expiresAt - Optional expiry date
 * @param {string} params.blockedBy - User ID who blocked
 */
export async function blockIP({ ip, reason, blockType = 'manual', expiresAt, blockedBy }) {
  try {
    const { data, error } = await supabase
      .from('blocked_ips')
      .insert({
        ip_address: ip,
        reason,
        block_type: blockType,
        blocked_by: blockedBy,
        expires_at: expiresAt || null,
        is_active: true,
      })
      .select()
      .single()

    if (error) throw error

    // Clear cache to force reload
    blockedIPsCache.clear()
    cacheExpiry = 0

    // Log security alert
    await logIPBlockAlert(ip, reason, blockType, blockedBy)

    return { success: true, data }
  } catch (error) {
    logger.error('Error blocking IP:', JSON.stringify(error, null, 2))
    return { success: false, error: error.message }
  }
}

/**
 * Unblock an IP address
 * @param {string} ipBlockId - ID of the blocked IP record
 * @param {string} unblockedBy - User ID who unblocked
 */
export async function unblockIP(ipBlockId, unblockedBy) {
  try {
    const { data, error } = await supabase
      .from('blocked_ips')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', ipBlockId)
      .select()
      .single()

    if (error) throw error

    // Clear cache to force reload
    blockedIPsCache.clear()
    cacheExpiry = 0

    // Log security alert
    await logIPUnblockAlert(ipBlockId, unblockedBy)

    return { success: true, data }
  } catch (error) {
    logger.error('Error unblocking IP:', JSON.stringify(error, null, 2))
    return { success: false, error: error.message }
  }
}

/**
 * Log security alert for IP blocking
 */
async function logIPBlockAlert(ip, reason, blockType, blockedBy) {
  try {
    await supabase.rpc('create_security_alert', {
      p_alert_type: 'ip_blocked',
      p_severity: blockType === 'manual' ? 'high' : 'medium',
      p_title: `IP Blocked: ${ip}`,
      p_description: reason,
      p_source_ip: ip,
      p_user_id: blockedBy,
      p_metadata: JSON.stringify({ block_type: blockType }),
    })
  } catch (error) {
    logger.error('Failed to log IP block alert:', JSON.stringify(error, null, 2))
  }
}

/**
 * Log security alert for IP unblocking
 */
async function logIPUnblockAlert(ipBlockId, unblockedBy) {
  try {
    await supabase.rpc('create_security_alert', {
      p_alert_type: 'ip_unblocked',
      p_severity: 'medium',
      p_title: `IP Unblocked: ${ipBlockId}`,
      p_description: 'IP address has been unblocked by admin',
      p_user_id: unblockedBy,
      p_metadata: JSON.stringify({ ip_block_id: ipBlockId }),
    })
  } catch (error) {
    logger.error('Failed to log IP unblock alert:', JSON.stringify(error, null, 2))
  }
}

/**
 * Get all blocked IPs
 */
export async function getBlockedIPs() {
  try {
    const { data, error } = await supabase
      .from('blocked_ips')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error) {
    logger.error('Error fetching blocked IPs:', JSON.stringify(error, null, 2))
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * Get active security alerts
 */
export async function getSecurityAlerts(options = {}) {
  const { limit = 50, unresolvedOnly = false, severity = null } = options

  try {
    let query = supabase
      .from('security_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unresolvedOnly) {
      query = query.eq('is_resolved', false)
    }

    if (severity) {
      query = query.eq('severity', severity)
    }

    const { data, error } = await query

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (error) {
    logger.error('Error fetching security alerts:', JSON.stringify(error, null, 2))
    return { success: false, error: error.message, data: [] }
  }
}

/**
 * Resolve a security alert
 */
export async function resolveSecurityAlert(alertId, resolvedBy, notes = '') {
  try {
    const { data, error } = await supabase
      .from('security_alerts')
      .update({
        is_resolved: true,
        resolved_by: resolvedBy,
        resolved_at: new Date().toISOString(),
        resolution_notes: notes,
      })
      .eq('id', alertId)
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error) {
    logger.error('Error resolving alert:', JSON.stringify(error, null, 2))
    return { success: false, error: error.message }
  }
}

/**
 * Get security alerts stats - Optimized: parallel count queries
 */
export async function getSecurityAlertsStats() {
  try {
    // Parallel: all 5 independent count queries run simultaneously
    const [totalResult, unresolvedResult, criticalResult, highResult, blockedResult] = await Promise.all([
      supabase.from('security_alerts').select('*', { count: 'exact', head: true }),
      supabase.from('security_alerts').select('*', { count: 'exact', head: true }).eq('is_resolved', false),
      supabase.from('security_alerts').select('*', { count: 'exact', head: true }).eq('severity', 'critical').eq('is_resolved', false),
      supabase.from('security_alerts').select('*', { count: 'exact', head: true }).eq('severity', 'high').eq('is_resolved', false),
      supabase.from('blocked_ips').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ])

    return {
      success: true,
      data: {
        totalAlerts: totalResult.count || 0,
        unresolvedAlerts: unresolvedResult.count || 0,
        criticalAlerts: criticalResult.count || 0,
        highAlerts: highResult.count || 0,
        blockedIPsCount: blockedResult.count || 0,
      }
    }
  } catch (error) {
    logger.error('Error fetching security stats:', JSON.stringify(error, null, 2))
    return { success: false, error: error.message, data: null }
  }
}

/**
 * Setup real-time listener for security alerts
 * @param {Function} callback - Callback function for new alerts
 */
export function subscribeToSecurityAlerts(callback) {
  const channel = supabase
    .channel('security-alerts')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'security_alerts',
      },
      (payload) => {
        callback(payload.new)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * Setup real-time listener for blocked IPs changes
 * @param {Function} callback - Callback function for blocked IP changes
 */
export function subscribeToBlockedIPs(callback) {
  const channel = supabase
    .channel('blocked-ips')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'blocked_ips',
      },
      (payload) => {
        callback(payload)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// Auto-refresh cache every 5 minutes
setInterval(() => {
  loadBlockedIPs()
}, CACHE_TTL)

export default {
  isIPBlocked,
  ipBlockingMiddleware,
  blockIP,
  unblockIP,
  getBlockedIPs,
  getSecurityAlerts,
  resolveSecurityAlert,
  getSecurityAlertsStats,
  subscribeToSecurityAlerts,
  subscribeToBlockedIPs,
}
