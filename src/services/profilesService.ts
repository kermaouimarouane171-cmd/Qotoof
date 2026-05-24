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
      .from('profiles')
      .select('id, first_name, last_name, store_name, avatar_url, city, rating, created_at, is_verified, role')
      .eq('role', 'vendor')
      .eq('is_verified', true)
      .order('created_at', { ascending: false })

    if (error) {
      return { data: null, error }
    }

    return { data: data || [], error: null }
  },

  fetchProfile: async (userId: string): Promise<ProfileResult> => {
    return fetchProfileResultTyped(userId)
  },

  updateProfile: async (userId: string, updates: ProfileUpdate): Promise<ProfileResult> => {
    const { id: _ignored, ...safeUpdates } = updates || {}

    const { data, error } = await supabase
      .from('profiles')
      .update(safeUpdates)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      return { data: null, error }
    }

    return { data, error: null }
  },

  fetchVendorProfile: async (vendorId: string): Promise<ProfileResult> => {
    return fetchProfileResultTyped(vendorId)
  },

  fetchDriverProfile: async (driverId: string): Promise<ProfileResult> => {
    return fetchProfileResultTyped(driverId)
  },
}

export default profilesService
