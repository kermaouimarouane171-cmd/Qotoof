import { profilesService } from '@/services/profilesService'
import { supabase } from '@/services/supabase'

jest.mock('@/services/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      update: jest.fn(function (payload) {
        return {
          eq: jest.fn(() => Promise.resolve({ error: null })),
          _payload: payload,
        }
      }),
    })),
  },
}))

const getLastUpdatePayload = () => {
  const fromMock = supabase.from as jest.Mock
  const lastFromResult = fromMock.mock.results[fromMock.mock.results.length - 1]?.value
  if (!lastFromResult) return undefined
  const updateMock = lastFromResult.update as jest.Mock
  return updateMock.mock.calls[0]?.[0]
}

describe('profilesService.updateProfile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('strips id, unknown fields, and undefined from the update payload', async () => {
    await profilesService.updateProfile('user-1', {
      id: 'user-1',
      store_name: 'Updated Store',
      unknown_field: 'should be removed',
      latitude: undefined,
      longitude: 33.57,
      store_address: null,
      payout_method: 'paypal',
    } as any)

    expect((supabase.from as jest.Mock).mock.calls.length).toBe(1)

    const payload = getLastUpdatePayload()

    expect(payload).toEqual({
      store_name: 'Updated Store',
      longitude: 33.57,
      store_address: null,
      payout_method: 'paypal',
    })
    expect(payload.id).toBeUndefined()
    expect(payload.unknown_field).toBeUndefined()
    expect(payload.latitude).toBeUndefined()
  })

  it('returns success without calling supabase when payload is empty', async () => {
    const result = await profilesService.updateProfile('user-1', {
      id: 'user-1',
      unknown_field: 'x',
    } as any)

    expect(result.error).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('does not use .select().single() in the update query', async () => {
    await profilesService.updateProfile('user-1', { store_name: 'Updated Store' } as any)

    const fromMock = supabase.from as jest.Mock
    const lastFromResult = fromMock.mock.results[fromMock.mock.results.length - 1]?.value
    const updateResult = (lastFromResult.update as jest.Mock).mock.results[0]?.value
    expect(updateResult).toBeDefined()
    expect(updateResult.select).toBeUndefined()
    expect(updateResult.single).toBeUndefined()
  })
})
