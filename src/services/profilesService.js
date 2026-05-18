/**
 * Profiles Service
 *
 * Centralises direct Supabase queries on the `profiles` table.
 * All non-admin reads / updates for user profiles should go through here.
 */

import { supabase } from '@/services/supabase'

/**
 * Fetch a single profile by user ID.
 *
 * @param {string} userId
 * @returns {Promise<Object|null>} Profile row, or null if not found
 */
export const fetchProfile = async (userId) => {
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
export const updateProfile = async (userId, payload) => {
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
