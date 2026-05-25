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

  it('uses session.user when setSession omits top-level user', async () => {
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
        user: null,
        session: {
          access_token: 'access-token',
          user: { id: 'user-from-session' },
        },
      },
      error: null,
    })

    const result = await signInWithServerRateLimit({
      email: 'buyer@test.com',
      password: 'password123',
    })

    expect(result.user.id).toBe('user-from-session')
  })

  it('derives user from JWT claims when setSession has no user payload', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ sub: 'jwt-user', email: 'jwt@test.com', exp: 4102444800 })).toString('base64url')
    const accessToken = `${header}.${payload}.signature`

    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        session: {
          access_token: accessToken,
          refresh_token: 'refresh-token',
        },
      },
      error: null,
    })
    mockSetSession.mockResolvedValue({
      data: {
        user: null,
        session: {
          access_token: accessToken,
        },
      },
      error: null,
    })

    const result = await signInWithServerRateLimit({
      email: 'buyer@test.com',
      password: 'password123',
    })

    expect(result.user).toEqual({ id: 'jwt-user', email: 'jwt@test.com' })
  })

  it('skips setSession in Cypress mode and returns a mocked user', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ sub: 'cypress-user', email: 'cypress@test.com', exp: 4102444800 })).toString('base64url')
    const accessToken = `${header}.${payload}.signature`

    const previousWindow = global.window
    const previousCypress = global.Cypress
    global.window = { Cypress: {} }
    global.Cypress = {}

    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        session: {
          access_token: accessToken,
          refresh_token: 'refresh-token',
        },
      },
      error: null,
    })

    const result = await signInWithServerRateLimit({
      email: 'buyer@test.com',
      password: 'password123',
    })

    expect(mockSetSession).not.toHaveBeenCalled()
    expect(result.user.id).toBe('cypress-user')

    global.window = previousWindow
    global.Cypress = previousCypress
  })

  it('skips setSession for @greenmarket.test fixture accounts', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
    const payload = Buffer.from(JSON.stringify({ sub: 'fixture-user', email: 'vendor@greenmarket.test', exp: 4102444800 })).toString('base64url')
    const accessToken = `${header}.${payload}.signature`

    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        session: {
          access_token: accessToken,
          refresh_token: 'refresh-token',
        },
      },
      error: null,
    })

    const result = await signInWithServerRateLimit({
      email: 'vendor@greenmarket.test',
      password: 'password123',
    })

    expect(mockSetSession).not.toHaveBeenCalled()
    expect(result.user.id).toBe('fixture-user')
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