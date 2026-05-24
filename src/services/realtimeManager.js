import { supabase } from '@/services/supabase'
import { logger } from '@/utils/logger'

/**
 * @typedef {Object} SubscriptionConfig
 * @property {string} table
 * @property {string} [filter]
 * @property {'*'|'INSERT'|'UPDATE'|'DELETE'} [event]
 * @property {(payload: unknown) => void} callback
 */

/**
 * @typedef {Object} ChannelEntry
 * @property {import('@supabase/supabase-js').RealtimeChannel} channel
 * @property {number} refCount
 * @property {Set<(payload: unknown) => void>} callbacks
 */

class RealtimeManager {
  constructor() {
    /** @type {Map<string, ChannelEntry>} */
    this.channels = new Map()
  }

  /**
   * Subscribe to a realtime key ("table:filter:event").
   * Reuses an existing channel if the key already exists.
   *
   * @param {string} key
   * @param {SubscriptionConfig} config
   * @returns {() => void}
   */
  subscribe(key, config) {
    const existing = this.channels.get(key)

    if (existing) {
      existing.refCount += 1
      existing.callbacks.add(config.callback)
      logger.info(`[realtimeManager] Reused channel: ${key} (${existing.refCount})`)
      return () => this._decrement(key, config.callback)
    }

    const callbacks = new Set([config.callback])
    const channel = supabase
      .channel(key)
      .on(
        'postgres_changes',
        {
          event: config.event || '*',
          schema: 'public',
          table: config.table,
          ...(config.filter ? { filter: config.filter } : {}),
        },
        (payload) => {
          const entry = this.channels.get(key)
          if (!entry) return

          for (const cb of entry.callbacks) {
            try {
              cb(payload)
            } catch (error) {
              logger.error(`[realtimeManager] callback failed for ${key}:`, error)
            }
          }
        },
      )
      .subscribe()

    this.channels.set(key, {
      channel,
      refCount: 1,
      callbacks,
    })

    logger.info(`[realtimeManager] Opened new channel: ${key}`)
    return () => this._decrement(key, config.callback)
  }

  /**
   * Force-remove a channel and unsubscribe from Supabase.
   *
   * @param {string} key
   */
  unsubscribe(key) {
    const entry = this.channels.get(key)
    if (!entry) return

    try {
      if (typeof entry.channel?.unsubscribe === 'function') {
        entry.channel.unsubscribe()
      }
    } catch (error) {
      logger.error(`[realtimeManager] unsubscribe failed for ${key}:`, error)
    }

    try {
      supabase.removeChannel(entry.channel)
    } catch (error) {
      logger.error(`[realtimeManager] removeChannel failed for ${key}:`, error)
    }

    this.channels.delete(key)
    logger.info(`[realtimeManager] Closed channel: ${key}`)
  }

  unsubscribeAll() {
    for (const key of this.channels.keys()) {
      this.unsubscribe(key)
    }
  }

  getActiveChannelsCount() {
    return this.channels.size
  }

  _decrement(key, callback) {
    const entry = this.channels.get(key)
    if (!entry) return

    if (callback) {
      entry.callbacks.delete(callback)
    }

    entry.refCount = Math.max(0, entry.refCount - 1)
    if (entry.refCount === 0 || entry.callbacks.size === 0) {
      this.unsubscribe(key)
    }
  }
}

export const realtimeManager = new RealtimeManager()

const buildKey = (table, filter = '', event = '*') => `${table}__${filter}__${event}`

// Compatibility helpers used by existing services.
export function subscribe(table, filter, callback, eventType = '*') {
  return realtimeManager.subscribe(buildKey(table, filter, eventType), {
    table,
    filter,
    event: eventType,
    callback,
  })
}

export function unsubscribe(key) {
  realtimeManager.unsubscribe(key)
}

export function unsubscribeAll() {
  realtimeManager.unsubscribeAll()
}

export function getActiveChannelsCount() {
  return realtimeManager.getActiveChannelsCount()
}
