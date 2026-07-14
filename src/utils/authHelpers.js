/**
 * Centralized auth helpers to avoid duplicating guest/unauthenticated checks
 * across services and actions.
 */

import { supabase } from '@/services/supabase'

export const UNAUTHENTICATED_ERROR = 'No user logged in'

/**
 * Throws if the provided user is missing. Returns the user otherwise.
 * Useful for store actions that already read user from the auth store.
 */
export const requireUser = (user, message = UNAUTHENTICATED_ERROR) => {
  if (!user) throw new Error(message)
  return user
}

/**
 * Returns the standard unauthenticated response object used by auth services.
 */
export const unauthenticatedResponse = (message = UNAUTHENTICATED_ERROR) => ({
  success: false,
  error: message,
})

/**
 * Helper for async service functions that fetch the current Supabase user.
 * Returns { user } or { error } if not authenticated.
 */
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) return { error: error.message }
  if (!user) return { error: UNAUTHENTICATED_ERROR }
  return { user }
}

/**
 * Verify that the current authenticated user has admin role.
 * Returns { isAdmin: true } if admin, { isAdmin: false, error } otherwise.
 * This is a defense-in-depth check complementing RLS policies.
 */
export const requireAdmin = async () => {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user?.id) {
    return { isAdmin: false, error: 'المستخدم غير مصادق عليه' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { isAdmin: false, error: 'تعذر التحقق من صلاحيات المستخدم' }
  }

  if (profile.role !== 'admin') {
    return { isAdmin: false, error: 'هذه العملية تتطلب صلاحيات مدير' }
  }

  return { isAdmin: true }
}

/**
 * Verify that the current authenticated user matches the given vendorId.
 * Returns { isVendor: true } if match, { isVendor: false, error } otherwise.
 * This is a defense-in-depth check complementing RLS policies.
 */
export const requireVendorMatch = async (vendorId) => {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user?.id) {
    return { isVendor: false, error: 'المستخدم غير مصادق عليه' }
  }

  if (user.id !== vendorId) {
    return { isVendor: false, error: 'غير مصرح بالوصول إلى بيانات هذا البائع' }
  }

  return { isVendor: true }
}
