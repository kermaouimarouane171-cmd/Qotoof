/**
 * Profiles Service
 *
 * Centralises direct Supabase queries on the `profiles` table.
 * All non-admin reads / updates for user profiles should go through here.
 */

import { supabase } from '@/services/supabase'
import type { Database } from '@/types/database'
import type { PostgrestError } from '@supabase/supabase-js'

type Profile = Database['public']['Tables']['profiles']['Row']
type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

type ProfileResult = {
  data: Profile | null
  error: PostgrestError | null
}

type ProfilesResult = {
  data: Profile[] | null
  error: PostgrestError | null
}

/**
 * Fetch a single profile by user ID.
 *
 * @param {string} userId
 * @returns {Promise<Object|null>} Profile row, or null if not found
 */
export const fetchProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows
  return data ?? null
}

/**
 * Update a profile and return the updated row.
 *
 * @param {string} userId
 * @param {Object} payload - Fields to update (must not include `id`)
 * @returns {Promise<Object>} Updated profile row
 */
export const updateProfile = async (
  userId: string,
  payload: ProfileUpdate,
): Promise<Profile> => {
  const { id: _ignored, ...safePayload } = payload // Never allow callers to change `id`

  const { data, error } = await supabase
    .from('profiles')
    .update(safePayload)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

const fetchProfileResult = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    return { data: null, error }
  }

  return { data: data ?? null, error: null }
}

const fetchProfileResultTyped = async (userId: string): Promise<ProfileResult> => {
  const result = await fetchProfileResult(userId)
  return result as ProfileResult
}

export const profilesService = {
  fetchActiveVerifiedVendors: async (): Promise<ProfilesResult> => {
    const { data, error } = await supabase
      .from('public_profiles')
      .select('id, first_name, last_name, store_name, avatar_url, city, rating, created_at, is_verified, role')
      .eq('role', 'vendor')
      .eq('is_verified', true)
      .order('created_at', { ascending: false })

    if (error) {
      return { data: null, error }
    }

    return { data: (data as unknown as Profile[]) || [], error: null }
  },

  fetchProfile: async (userId: string): Promise<ProfileResult> => {
    return fetchProfileResultTyped(userId)
  },

  updateProfile: async (userId: string, updates: ProfileUpdate): Promise<ProfileResult> => {
    const allowedFields = new Set([
      'store_name',
      'min_order_amount',
      'low_stock_threshold',
      'payment_policy_full',
      'payment_policy_split',
      'payment_policy_cod',
      'notify_order_updates',
      'notify_customer_messages',
      'notify_low_stock',
      'latitude',
      'longitude',
      'store_address',
      'paypal_email',
      'payout_method',
    ])

    const { id: _ignored, ...rest } = updates || {}
    const safeUpdates: Record<string, unknown> = {}

    Object.entries(rest).forEach(([key, value]) => {
      if (allowedFields.has(key) && value !== undefined) {
        safeUpdates[key] = value
      }
    })

    if (Object.keys(safeUpdates).length === 0) {
      return { data: null, error: null }
    }

    const { error } = await supabase
      .from('profiles')
      .update(safeUpdates)
      .eq('id', userId)

    if (error) {
      return { data: null, error }
    }

    return { data: null, error: null }
  },

  fetchVendorProfile: async (vendorId: string): Promise<ProfileResult> => {
    return fetchProfileResultTyped(vendorId)
  },

  fetchDriverProfile: async (driverId: string): Promise<ProfileResult> => {
    return fetchProfileResultTyped(driverId)
  },
}

export default profilesService
