/**
 * Admin Payouts API — queries for admin payout management.
 *
 * Read queries extracted from src/pages/admin/Payouts.jsx in Phase 7.43.
 * Write flow extracted from src/pages/admin/Payouts.jsx in Phase 7.45.
 */

import { supabase } from '@/services/supabase'
import { formatPrice } from '@/utils/currency'
import { logger } from '@/utils/logger'

const DATE_RANGE_DAYS = {
  '7d': 7,
  '30d': 30,
  '3m': 90,
  '6m': 180,
}

export async function getAdminPayouts({ dateRange = '30d', statusFilter = 'all' } = {}) {
  let query = supabase
    .from('payouts')
    .select(`
      *,
      vendor:profiles!vendor_id(id, first_name, last_name, email, store_name, phone)
    `)
    .order('created_at', { ascending: false })

  if (dateRange !== 'all') {
    const days = DATE_RANGE_DAYS[dateRange] || 30
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('created_at', startDate)
  }

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  const { data, error } = await query

  return { data, error }
}

export async function getPayoutFinancialAuditLogs({ payoutId } = {}) {
  const { data, error } = await supabase
    .from('financial_audit_log')
    .select(`
      *,
      performed_by_profile:profiles!financial_audit_log_performed_by_fkey(first_name, last_name, role)
    `)
    .eq('entity_type', 'payout')
    .eq('entity_id', payoutId)
    .order('created_at', { ascending: true })

  return { data, error }
}

/**
 * Update payout status — transactional write flow (RPC → notification).
 *
 * Phase 8.6: R-002 fix — payout status update + financial audit are now atomic
 * via `update_payout_status_transactional` RPC. If audit fails, status rolls back.
 * Notification remains best-effort (outside the transaction).
 *
 * Behavior:
 *   - Calls `update_payout_status_transactional` RPC (atomic status + audit).
 *   - If RPC fails, returns { error } immediately (no notification attempted).
 *   - If RPC succeeds, attempts notification insert (best-effort).
 *   - If notification fails, logger.warn is called and 'notification' is added
 *     to side_effects_failed.
 *   - The caller is responsible for toast, processing state, and reload.
 *
 * @returns {{ error: Error|null, side_effects_failed: string[] }}
 */
export async function updateAdminPayoutStatus({ payoutId, newStatus, payout, currentUser } = {}) {
  const sideEffectsFailed = []

  const { data: rpcResult, error: rpcError } = await supabase.rpc('update_payout_status_transactional', {
    p_payout_id: payoutId,
    p_new_status: newStatus,
    p_reason: null,
    p_details: { updated_by: currentUser?.id, new_status: newStatus },
  })

  if (rpcError) {
    logger.warn('payout_rpc_failed', {
      payoutId,
      newStatus,
      adminId: currentUser?.id,
      error: rpcError,
    })
    return { error: rpcError }
  }

  if (!rpcResult?.success) {
    const rpcFailError = new Error(rpcResult?.message || 'RPC failed')
    logger.warn('payout_rpc_failed', {
      payoutId,
      newStatus,
      adminId: currentUser?.id,
      error_code: rpcResult?.error_code,
      message: rpcResult?.message,
    })
    return { error: rpcFailError }
  }

  const vendorId = rpcResult.vendor_id || payout?.vendor_id
  const amount = rpcResult.amount ?? payout?.amount

  if (vendorId) {
    const { error: notificationError } = await supabase.from('notifications').insert({
      user_id: vendorId,
      title: `Payout ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
      message: `Your payout of ${formatPrice(amount)} has been updated to ${newStatus}.`,
      type: 'payout',
      data: { payout_id: payoutId, amount, status: newStatus },
    })

    if (notificationError) {
      sideEffectsFailed.push('notification')
      logger.warn('payout_notification_failed', {
        payoutId,
        newStatus,
        userId: vendorId,
        error: notificationError,
      })
    }
  }

  return { error: null, side_effects_failed: sideEffectsFailed }
}

export default { getAdminPayouts, getPayoutFinancialAuditLogs, updateAdminPayoutStatus }
