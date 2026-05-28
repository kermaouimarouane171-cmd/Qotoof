import { supabase } from '@/services/supabase'
import type { Database } from '@/types/database'

type ProfileUpdate = Database['public']['Tables']['profiles']['Update']
type CountMode = 'exact' | 'planned' | 'estimated'

const USER_LIST_SELECT = 'id, first_name, last_name, email, phone, role, is_approved, created_at, avatar_url, city, country'
const USER_DETAIL_SELECT = 'id, first_name, last_name, email, phone, store_name, store_description, avatar_url, city, country, latitude, longitude, rating, bio, created_at, is_verified, is_approved, operating_hours, role, delivery_option, store_type, accepted_cargo_sizes, vehicle_type, vehicle_plate, has_own_driver, preferred_driver_id, partnership_status'
const USER_BASIC_SELECT = 'email, first_name, last_name'
const DELETED_USERS_SELECT = 'id, first_name, last_name, email, phone, role, is_approved, is_suspended, created_at, deleted_at'

export const userSelects = {
  USER_LIST_SELECT,
  USER_DETAIL_SELECT,
  USER_BASIC_SELECT,
  DELETED_USERS_SELECT,
}

export const listUsers = async ({ filters, searchFilter, count = 'exact' as CountMode }) => {
  let query = supabase
    .from('profiles')
    .select(USER_LIST_SELECT, { count })

  if (filters.role && filters.role !== 'all') {
    query = query.eq('role', filters.role)
  }

  if (searchFilter) {
    query = query.or(searchFilter)
  }

  if (filters.sortBy === 'name') {
    query = query.order('first_name', { ascending: true })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  const limit = Math.min(filters.limit || 50, 200)
  const offset = filters.offset || 0

  return query.range(offset, offset + limit - 1)
}

export const getUserById = async (id) => {
  return supabase
    .from('profiles')
    .select(USER_DETAIL_SELECT)
    .eq('id', id)
    .single()
}

export const updateUserById = async (id, updates) => {
  return supabase
    .from('profiles')
    .update(updates as ProfileUpdate)
    .eq('id', id)
    .select()
    .single()
}

export const getUserBasicProfile = async (id) => {
  return supabase
    .from('profiles')
    .select(USER_BASIC_SELECT)
    .eq('id', id)
    .single()
}

export const listDeletedUsers = async () => {
  return supabase
    .from('profiles')
    .select(DELETED_USERS_SELECT)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
}
