/**
 * 🛠️ Platform Settings Service
 * إدارة إعدادات المنصة مع Cache Invalidation و Audit Logging
 */

import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'
import { APP_CONFIG } from '@/config/appConfig'

// ============================================
// Cache Management
// ============================================

const SETTINGS_CACHE_KEY = 'platform_settings'
const SETTINGS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
let settingsCache = { data: null, timestamp: 0 }

/**
 * Invalidate settings cache
 */
export const invalidateSettingsCache = () => {
  settingsCache = { data: null, timestamp: 0 }
  // Also clear localStorage cache
  try {
    localStorage.removeItem(SETTINGS_CACHE_KEY)
  } catch (_e) {
    // localStorage not available
  }
  logger.info('Settings cache invalidated')
}

/**
 * Get settings from cache or fetch from DB
 */
export const getSettings = async () => {
  // Check memory cache first
  const now = Date.now()
  if (settingsCache.data && (now - settingsCache.timestamp) < SETTINGS_CACHE_TTL) {
    return settingsCache.data
  }

  // Check localStorage cache
  try {
    const cached = localStorage.getItem(SETTINGS_CACHE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      if ((now - parsed.timestamp) < SETTINGS_CACHE_TTL) {
        settingsCache = parsed
        return parsed.data
      }
    }
  } catch (_e) {
    // localStorage not available
  }

  // Fetch from database (key-value store)
  try {
    const { data, error } = await supabase
      .from('platform_settings')
      .select('setting_key, setting_value')

    if (error) {
      // Table might not exist yet, return defaults
      logger.warn('Platform settings table not found, using defaults')
      return getDefaultSettings()
    }

    const settingsFromDb = {}
    ;(data || []).forEach((row) => {
      settingsFromDb[row.setting_key] = row.setting_value
    })

    // Merge with defaults so missing keys still work
    const merged = { ...getDefaultSettings(), ...settingsFromDb }

    // Update cache
    const cacheData = { data: merged, timestamp: now }
    settingsCache = cacheData
    try {
      localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(cacheData))
    } catch (_e) {
      // localStorage not available
    }

    return merged
  } catch (error) {
    logger.error('Get settings error:', error)
    return getDefaultSettings()
  }
}

/**
 * Default settings
 */
const getDefaultSettings = () => ({
  platform_name: APP_CONFIG.name,
  support_email: APP_CONFIG.supportEmail,
  support_phone: APP_CONFIG.supportPhoneDisplay,
  currency: 'MAD',
  language: 'ar',
  timezone: 'Africa/Casablanca',
  feature_vendor_registration: true,
  feature_buyer_orders: true,
  feature_driver_deliveries: true,
  feature_reviews: true,
  feature_returns: true,
  feature_chat: true,
  commission_rate: APP_CONFIG.commissionRate * 100,
  min_withdrawal_amount: 100,
  max_order_amount: 10000,
  order_auto_cancel_hours: 24,
  delivery_radius_km: 50,
  maintenance_mode: false,
  maintenance_message: '',
})

/**
 * Update settings and log the change
 */
export const updateSettings = async (updates, adminId, adminName) => {
  try {
    // Get current settings first (for audit log)
    const currentSettings = await getSettings()

    // Determine which fields to update
    const allowedFields = [
      'platform_name', 'support_email', 'support_phone',
      'currency', 'language', 'timezone',
      'feature_vendor_registration', 'feature_buyer_orders',
      'feature_driver_deliveries', 'feature_reviews',
      'feature_returns', 'feature_chat',
      'commission_rate', 'min_withdrawal_amount', 'max_order_amount',
      'order_auto_cancel_hours', 'delivery_radius_km',
      'maintenance_mode', 'maintenance_message',
    ]

    const filteredUpdates = {}
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = value
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return { success: false, error: 'No valid fields to update' }
    }

    // Upsert settings as key-value rows
    const upsertRows = Object.entries(filteredUpdates).map(([key, value]) => ({
      setting_key: key,
      setting_value: value,
      updated_at: new Date().toISOString(),
      updated_by: adminId,
    }))

    const { error } = await supabase
      .from('platform_settings')
      .upsert(upsertRows, { onConflict: 'setting_key' })

    if (error) throw error

    // Invalidate cache immediately
    invalidateSettingsCache()

    // Log the change in audit log
    await logSettingsChange(filteredUpdates, currentSettings, adminId)

    // If commission rate changed, notify all vendors
    if (filteredUpdates.commission_rate !== undefined && filteredUpdates.commission_rate !== currentSettings?.commission_rate) {
      await notifyVendorsCommissionChange(currentSettings?.commission_rate ?? 10, filteredUpdates.commission_rate, adminName)
    }

    logger.info(`Settings updated by ${adminName}:`, Object.keys(filteredUpdates))
    return { success: true }
  } catch (error) {
    logger.error('Update settings error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Notify all vendors when commission rate changes
 */
const notifyVendorsCommissionChange = async (oldRate, newRate, changedBy) => {
  try {
    // Fetch all vendor IDs
    const { data: vendors, error: vendorsError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, store_name')
      .eq('role', 'vendor')

    if (vendorsError) throw vendorsError
    if (!vendors || vendors.length === 0) return

    const direction = newRate > oldRate ? 'increased' : 'decreased'
    const emoji = newRate > oldRate ? '📈' : '📉'

    const notifications = vendors.map(vendor => ({
      user_id: vendor.id,
      title: `Commission Rate ${emoji} ${direction === 'increased' ? 'Increased' : 'Decreased'}`,
      message: `The platform commission rate has been ${direction} from ${oldRate}% to ${newRate}%. This affects only new orders placed from now on. Your existing orders remain unchanged.`,
      type: 'commission_change',
      data: jsonb_build_object_safe('old_rate', oldRate, 'new_rate', newRate, 'changed_by', changedBy),
    }))

    // Insert notifications in batches (max 100 at a time)
    const batchSize = 100
    for (let i = 0; i < notifications.length; i += batchSize) {
      const batch = notifications.slice(i, i + batchSize)
      const { error } = await supabase.from('notifications').insert(batch)
      if (error) {
        logger.error('Failed to send commission notifications batch:', error)
      }
    }

    logger.info(`Commission change notifications sent to ${vendors.length} vendors`)
  } catch (error) {
    logger.error('Error notifying vendors of commission change:', error)
  }
}

// Safe JSONB builder (avoids postgres-only function in JS)
const jsonb_build_object_safe = (...args) => {
  const obj = {}
  for (let i = 0; i < args.length; i += 2) {
    obj[args[i]] = args[i + 1]
  }
  return obj
}

/**
 * Log settings change in audit table
 */
const logSettingsChange = async (newValues, oldValues, adminId) => {
  try {
    // Find what actually changed and insert one audit row per changed key
    const changedAt = new Date().toISOString()
    const rows = []
    for (const [key, newValue] of Object.entries(newValues)) {
      const oldValue = oldValues?.[key]
      if (oldValue !== newValue) {
        rows.push({
          setting_key: key,
          old_value: oldValue ?? null,
          new_value: newValue ?? null,
          changed_by: adminId,
          created_at: changedAt,
        })
      }
    }

    if (rows.length === 0) return

    const { error } = await supabase
      .from('settings_audit_log')
      .insert(rows)

    if (error) {
      logger.error('Log settings change error:', error)
    } else {
      logger.info(`Settings audit log created for ${rows.length} changes`)
    }
  } catch (error) {
    logger.error('Log settings change error:', error)
  }
}

/**
 * Get client IP address
 */
const _getClientIP = async () => {
  try {
    const response = await fetch('https://api.ipify.org?format=json')
    const data = await response.json()
    return data.ip
  } catch {
    return 'unknown'
  }
}

/**
 * Get settings audit log
 */
export const getSettingsAuditLog = async (limit = 50, offset = 0) => {
  try {
    const { data, error, count } = await supabase
      .from('settings_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error
    return { data: data || [], count: count || 0 }
  } catch (error) {
    logger.error('Get audit log error:', error)
    return { data: [], count: 0 }
  }
}

/**
 * Subscribe to settings changes (real-time)
 */
export const subscribeToSettingsChanges = (callback) => {
  return supabase
    .channel('platform_settings_changes')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'platform_settings',
      },
      (payload) => {
        // Invalidate cache on remote change
        invalidateSettingsCache()
        callback(payload.new)
      }
    )
    .subscribe()
}

// ============================================
// Default export
// ============================================
export const platformSettings = {
  getSettings,
  updateSettings,
  invalidateSettingsCache,
  getSettingsAuditLog,
  subscribeToSettingsChanges,
}

export default platformSettings
