import { buildRestoreUserPayload } from '@/business/userLogic'
import { describe, expect, it } from '@jest/globals'

describe('userLogic', () => {
  it('buildRestoreUserPayload clears deleted_at', () => {
    const payload = buildRestoreUserPayload()

    expect(payload).toEqual({ deleted_at: null })
  })
})
