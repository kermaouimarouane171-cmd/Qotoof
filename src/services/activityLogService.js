import { supabase } from '@/services/supabase'

export const activityLogService = {
  logActivity: async ({ userId, action, details = {}, ipAddress = null, userAgent = null }) => {
    if (!userId || !action) return

    await supabase.from('user_activity_log').insert({
      user_id: userId,
      action,
      details,
      ip_address: ipAddress,
      user_agent: userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : null),
    })
  },

  getUserActivity: async (userId, limit = 50) => {
    if (!userId) return []

    const { data, error } = await supabase
      .from('user_activity_log')
      .select('id, action, details, ip_address, user_agent, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return data || []
  },
}

export default activityLogService