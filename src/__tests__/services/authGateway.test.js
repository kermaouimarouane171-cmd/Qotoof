const mockInvoke = jest.fn()
const mockSetSession = jest.fn()

jest.mock('@/services/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args) => mockInvoke(...args),
    },
    auth: {
      setSession: (...args) => mockSetSession(...args),
    },
  },
}))

import { signInWithServerRateLimit } from '@/services/authGateway'

describe('authGateway', () => {
  beforeEach(() => {
    mockInvoke.mockReset()
    mockSetSession.mockReset()
  })

  it('establishes a browser session from the server login response', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        session: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
        },
      },
      error: null,
    })
    mockSetSession.mockResolvedValue({
      data: {
        user: { id: 'user-1' },
        session: { access_token: 'access-token' },
      },
      error: null,
    })

    const result = await signInWithServerRateLimit({
      email: 'buyer@test.com',
      password: 'password123',
    })

    expect(mockInvoke).toHaveBeenCalledWith('secure-login', {
      body: {
        email: 'buyer@test.com',
        password: 'password123',
        captchaToken: null,
      },
    })
    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    })
    expect(result.user.id).toBe('user-1')
  })

  it('throws when the edge function rejects the request', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new Error('Too many login attempts'),
    })

    await expect(signInWithServerRateLimit({
      email: 'buyer@test.com',
      password: 'password123',
    })).rejects.toThrow('Too many login attempts')
  })
})