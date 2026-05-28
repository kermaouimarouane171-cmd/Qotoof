export const buildApprovalPayload = (adminId: string | null = null) => ({
  approval_status: 'published',
  approved_by: adminId,
  approved_at: new Date().toISOString(),
  is_available: true,
})

export const buildSuspensionPayload = () => ({
  approval_status: 'suspended',
  is_available: false,
})

export const buildRejectionPayload = (reason = '') => ({
  approval_status: 'rejected',
  rejection_reason: reason,
  is_available: false,
})

export const buildSoftDeletePayload = () => ({
  deleted_at: new Date().toISOString(),
})

export const buildRestorePayload = () => ({
  deleted_at: null,
})
