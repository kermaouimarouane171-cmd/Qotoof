/*
 * Public Configuration Loader
 * Fetches ONLY safe environment variables from Supabase Edge Function.
 * This replaces direct usage of import.meta.env.* for security.
 */

import { createClient } from '@supabase/supabase-js'

// Type definitions
export interface PublicConfig {
  supabase: {
    url: string
    anonKey: string
  }
  stripe: {
    publishableKey: string
  }
  recaptcha: {
    siteKey: string
  }
  email: {
    from: string
  }
  app: {
    name: string
    version: string
  }
}

// Default fallbacks (for SSR or offline)
const DEFAULT_CONFIG: PublicConfig = {
  supabase: {
    url: 'https://placeholder-project.supabase.co',
    anonKey: 'placeholder-anon-key',
  },
  stripe: {
    publishableKey: 'pk_live_placeholder',
  },
  recaptcha: {
    siteKey: 'recaptcha-site-key-placeholder',
  },
  email: {
    from: 'Qotoof273@gmail.com',
  },
  app: {
    name: 'Qotoof',
    version: '1.0.0',
  },
}

// Global config store (in-memory, no persistence needed)
let config: PublicConfig | null = null
let isFetching = false
let fetchPromise: Promise<PublicConfig> | null = null

/**
 * Fetch public config from Supabase Edge Function
 * @returns Promise<PublicConfig>
 */
export async function fetchPublicConfig(): Promise<PublicConfig> {
  if (config) return config

  if (fetchPromise) return fetchPromise

  if (isFetching) {
    // Prevent duplicate requests
    await new Promise((resolve) => {
      const check = () => {
        if (!isFetching) resolve(undefined)
        else setTimeout(check, 50)
      }
      check()
    })
    return config as PublicConfig
  }

  isFetching = true
  fetchPromise = (async () => {
    try {
      const response = await fetch('/functions/v1/get-public-config', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      config = data as PublicConfig
      return config
    } catch (error) {
      console.warn('[Config] Failed to fetch public config, using defaults:', error)
      // Fallback to defaults on failure (safe for frontend)
      config = DEFAULT_CONFIG
      return config
    } finally {
      isFetching = false
      fetchPromise = null
    }
  })()

  return fetchPromise
}

/**
 * Get current config synchronously (only after fetchPublicConfig() has resolved)
 * @returns PublicConfig or null if not loaded
 */
export function getConfig(): PublicConfig | null {
  return config
}

/**
 * Initialize config on app startup (call once in main.jsx or App.tsx)
 */
export async function initConfig(): Promise<void> {
  await fetchPublicConfig()
}

// Export individual values for convenience (type-safe)
export const getSupabaseUrl = () => getConfig()?.supabase.url || ''
export const getSupabaseAnonKey = () => getConfig()?.supabase.anonKey || ''
export const getStripePublishableKey = () => getConfig()?.stripe.publishableKey || ''
export const getRecaptchaSiteKey = () => getConfig()?.recaptcha.siteKey || ''
export const getAppName = () => getConfig()?.app.name || 'Qotoof'

// For debugging only
if (import.meta.env.DEV) {
  window.__QOTOOF_CONFIG__ = { getConfig, fetchPublicConfig }
}
