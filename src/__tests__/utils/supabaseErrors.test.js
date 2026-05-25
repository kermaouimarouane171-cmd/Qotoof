import { isMissingDeletedAtColumnError } from '@/utils/supabaseErrors'

describe('isMissingDeletedAtColumnError', () => {
  it('returns true when postgres reports missing deleted_at column', () => {
    const error = {
      code: '42703',
      message: 'column products.deleted_at does not exist',
    }

    expect(isMissingDeletedAtColumnError(error)).toBe(true)
  })

  it('returns false for other postgres errors', () => {
    const error = {
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    }

    expect(isMissingDeletedAtColumnError(error)).toBe(false)
  })
})
