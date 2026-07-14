/**
 * Admin Commissions API — read-only queries for admin commission analytics.
 *
 * Extracted from src/pages/admin/Commissions.jsx in Phase 7.40.
 * No writes. No RPC. No Edge Functions. No notifications.
 */

import { supabase } from '@/services/supabase'

export async function getAdminCommissionsPayments({ period = '30d' } = {}) {
  const now = new Date()
  const periodDays = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
  }[period] || 30
  const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('payments')
    .select(`
      id, order_id, amount, payment_method, status, created_at
    `)
    .gte('created_at', startDate)
    .order('created_at', { ascending: false })
    .limit(100)

  return { data, error }
}

export default { getAdminCommissionsPayments }
