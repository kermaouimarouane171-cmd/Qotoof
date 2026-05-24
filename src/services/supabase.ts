import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { logger } from '@/utils/logger.js'
import { supabaseAnonKeyLooksIssued, supabaseUrlLooksIssued } from '@/utils/envValidators'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isConfigured = supabaseUrl && supabaseAnonKey &&
  supabaseUrlLooksIssued(supabaseUrl) &&
  supabaseAnonKeyLooksIssued(supabaseAnonKey)

// ============================================
// HEALTH CHECK & RETRY LOGIC
// ============================================

class SupabaseHealthMonitor {
  isOnline: boolean
  lastHealthCheck: {
    success: boolean
    error?: string
    responseTime?: number
    timestamp: string
  } | null
  healthStatus: 'unknown' | 'healthy' | 'degraded' | 'unhealthy'
  consecutiveFailures: number
  maxRetries: number
  retryDelay: number
  healthCheckInterval: number
  _refreshSession?: () => Promise<unknown>

  constructor() {
    this.isOnline = navigator.onLine
    this.lastHealthCheck = null
    this.healthStatus = 'unknown' // 'healthy', 'degraded', 'unhealthy'
    this.consecutiveFailures = 0
    this.maxRetries = 3
    this.retryDelay = 1000 // 1 second
    this.healthCheckInterval = 30000 // 30 seconds
    
    // Listeners
    window.addEventListener('online', () => {
      this.isOnline = true
      this.healthStatus = 'unknown'
      this.performHealthCheck()
    })
    
    window.addEventListener('offline', () => {
      this.isOnline = false
      this.healthStatus = 'unhealthy'
    })
  }

  /**
   * Perform health check
   */
  async performHealthCheck() {
    if (!this.isOnline) {
      this.healthStatus = 'unhealthy'
      return false
    }

    try {
      const startTime = Date.now()
      
      // Simple query to check connectivity
      const { error } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)

      const responseTime = Date.now() - startTime

      if (error) {
        this.consecutiveFailures++
        this.healthStatus = this.consecutiveFailures > 2 ? 'unhealthy' : 'degraded'
        this.lastHealthCheck = { success: false, error: error.message, timestamp: new Date().toISOString() }
        return false
      }

      this.consecutiveFailures = 0
      this.healthStatus = responseTime > 2000 ? 'degraded' : 'healthy'
      this.lastHealthCheck = { success: true, responseTime, timestamp: new Date().toISOString() }
      return true
    } catch (error) {
      this.consecutiveFailures++
      this.healthStatus = 'unhealthy'
      this.lastHealthCheck = { success: false, error: error.message, timestamp: new Date().toISOString() }
      return false
    }
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks() {
    setInterval(() => {
      this.performHealthCheck()
    }, this.healthCheckInterval)
  }

  /**
   * Execute function with retry logic
   */
  async withRetry(fn, maxRetries = null) {
    const retries = maxRetries || this.maxRetries
    
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Check if online
        if (!this.isOnline) {
          throw new Error('No internet connection')
        }

        const result = await fn()

        // Reset consecutive failures on success
        this.consecutiveFailures = 0

        return result
      } catch (error) {
        this.consecutiveFailures++

        // Handle JWT expired: refresh session and retry ONCE
        if (error.message?.includes('JWT') || error.code === 'PGRST303') {
          if (attempt === 0 && this._refreshSession) {
            // First attempt — try to refresh session then retry
            try {
              await this._refreshSession()
              const result = await fn()
              this.consecutiveFailures = 0
              return result
            } catch (_refreshError) {
              // Refresh failed — throw original error
              throw error
            }
          }
          // Already retried once — throw
          throw error
        }

        // Don't retry rate limit or lock conflicts
        if (error.message?.includes('rate limit') ||
            error.message?.includes('Lock') ||
            error.message?.includes('was released')) {
          throw error
        }

        // Last attempt - throw error
        if (attempt === retries - 1) {
          throw error
        }

        // Wait before retry (exponential backoff)
        const delay = this.retryDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  /**
   * Get health status
   */
  getStatus() {
    return {
      isOnline: this.isOnline,
      healthStatus: this.healthStatus,
      lastHealthCheck: this.lastHealthCheck,
      consecutiveFailures: this.consecutiveFailures
    }
  }
}

// Create health monitor instance
const healthMonitor = new SupabaseHealthMonitor()

// ============================================
// CREATE SUPABASE CLIENT
// ============================================

if (!isConfigured) {
  const missingOrInvalidVars = []

  if (!supabaseUrlLooksIssued(supabaseUrl)) {
    missingOrInvalidVars.push('VITE_SUPABASE_URL')
  }
  if (!supabaseAnonKeyLooksIssued(supabaseAnonKey)) {
    missingOrInvalidVars.push('VITE_SUPABASE_ANON_KEY')
  }

  const configErrorMessage = `Supabase is not configured correctly. Missing/invalid env vars: ${missingOrInvalidVars.join(', ')}. Restart the dev server after updating .env.`
  logger.error(configErrorMessage)
  throw new Error(configErrorMessage)
}

export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'X-Client-Info': 'qotoof@1.0.0',
        'X-Client-Security': 'enhanced',
      },
    },
    db: {
      schema: 'public',
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
)

// ============================================
// ENHANCED SUPABASE METHODS WITH RETRY
// ============================================

// Set up JWT refresh callback on health monitor
healthMonitor._refreshSession = async () => {
  try {
    const { data, error } = await supabase.auth.refreshSession()
    if (error) {
      logger.warn('Session refresh failed:', error.message)
      throw error
    }
    if (!data.session) {
      logger.warn('Session refresh returned no session')
      throw new Error('bad_jwt: No session available after refresh')
    }
    return data.session
  } catch (error) {
    logger.error('refreshSession failed:', error)
    throw error
  }
}

/**
 * Enhanced query builder with retry logic
 */
export const supabaseWithRetry = {
  from: (table) => {
    const originalQuery = supabase.from(table)
    
    return {
      ...originalQuery,
      select: (...args) => {
        const originalSelect = originalQuery.select(...args)
        return {
          ...originalSelect,
          single: async () => {
            return healthMonitor.withRetry(() => originalSelect.single())
          },
          maybeSingle: async () => {
            return healthMonitor.withRetry(() => originalSelect.maybeSingle())
          },
          limit: (count) => {
            const originalLimit = originalSelect.limit(count)
            return {
              ...originalLimit,
              then: async (onfulfilled, onrejected) => {
                return healthMonitor.withRetry(() => originalLimit).then(onfulfilled, onrejected)
              }
            }
          }
        }
      },
      insert: (...args) => {
        const originalInsert = originalQuery.insert(...args)
        return {
          ...originalInsert,
          select: (...selectArgs) => {
            const originalSelect = originalInsert.select(...selectArgs)
            return {
              ...originalSelect,
              single: async () => {
                return healthMonitor.withRetry(() => originalSelect.single())
              }
            }
          }
        }
      },
      update: (...args) => {
        const originalUpdate = originalQuery.update(...args)
        return {
          ...originalUpdate,
          eq: (...eqArgs) => {
            const originalEq = originalUpdate.eq(...eqArgs)
            return {
              ...originalEq,
              select: (...selectArgs) => {
                const originalSelect = originalEq.select(...selectArgs)
                return {
                  ...originalSelect,
                  single: async () => {
                    return healthMonitor.withRetry(() => originalSelect.single())
                  }
                }
              }
            }
          }
        }
      },
      delete: () => {
        const originalDelete = originalQuery.delete()
        return {
          ...originalDelete,
          eq: (...eqArgs) => {
            const originalEq = originalDelete.eq(...eqArgs)
            return {
              ...originalEq,
              then: async (onfulfilled, onrejected) => {
                return healthMonitor.withRetry(() => originalEq).then(onfulfilled, onrejected)
              }
            }
          }
        }
      }
    }
  }
}

// ============================================
// HEALTH CHECK EXPORTS
// ============================================

export const getHealthStatus = () => healthMonitor.getStatus()
export const performHealthCheck = () => healthMonitor.performHealthCheck()
export const withRetry = (fn, maxRetries) => healthMonitor.withRetry(fn, maxRetries)

// ============================================
// DEFAULT EXPORT
// ============================================

export default supabase
