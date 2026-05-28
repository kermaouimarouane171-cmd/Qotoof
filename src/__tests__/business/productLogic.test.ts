import {
  buildApprovalPayload,
  buildRejectionPayload,
  buildRestorePayload,
  buildSoftDeletePayload,
  buildSuspensionPayload,
} from '@/business/productLogic'
import { describe, expect, it } from '@jest/globals'

describe('productLogic', () => {
  it('buildApprovalPayload sets publish state and admin id', () => {
    const payload = buildApprovalPayload('admin-1')
    expect(payload.approval_status).toBe('published')
    expect(payload.approved_by).toBe('admin-1')
    expect(payload.approved_at).toBeDefined()
    expect(payload.is_available).toBe(true)
  })

  it('buildSuspensionPayload sets suspended state', () => {
    const payload = buildSuspensionPayload()
    expect(payload).toEqual({
      approval_status: 'suspended',
      is_available: false,
    })
  })

  it('buildRejectionPayload sets rejected state with reason', () => {
    const payload = buildRejectionPayload('invalid docs')
    expect(payload).toEqual({
      approval_status: 'rejected',
      rejection_reason: 'invalid docs',
      is_available: false,
    })
  })

  it('buildSoftDeletePayload adds deleted_at timestamp', () => {
    const payload = buildSoftDeletePayload()
    expect(payload.deleted_at).toBeDefined()
  })

  it('buildRestorePayload clears deleted_at', () => {
    const payload = buildRestorePayload()
    expect(payload).toEqual({ deleted_at: null })
  })
})
