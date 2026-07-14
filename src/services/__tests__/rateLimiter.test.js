import {
  rateLimiter,
  checkLoginRate,
  enforceRateLimit,
  RateLimitError,
  withRateLimit,
} from '@/utils/rateLimiter'
import { signInWithServerRateLimit } from '@/services/authGateway'

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

const createMockJwt = ({ sub = 'user-1', email = 'buyer@greenmarket.test' } = {}) => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ sub, email, exp: 4102444800 })).toString('base64url')
  return `${header}.${payload}.signature`
}

describe('rateLimiter utility', () => {
  beforeEach(() => {
    rateLimiter.resetAll()
    jest.clearAllMocks()
  })

  it('allows first 5 login attempts and blocks on 6th', () => {
    let lastResult

    for (let i = 0; i < 5; i += 1) {
      lastResult = checkLoginRate('buyer@example.com')
      expect(lastResult.allowed).toBe(true)
    }

    const blocked = checkLoginRate('buyer@example.com')

    expect(lastResult.remaining).toBe(0)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })

  it('isolates counters per identifier', () => {
    for (let i = 0; i < 5; i += 1) {
      checkLoginRate('first@example.com')
    }

    const firstBlocked = checkLoginRate('first@example.com')
    const secondAllowed = checkLoginRate('second@example.com')

    expect(firstBlocked.allowed).toBe(false)
    expect(secondAllowed.allowed).toBe(true)
  })

  it('unblocks after lock window elapses', () => {
    jest.useFakeTimers()
    const now = Date.now()
    jest.setSystemTime(now)

    for (let i = 0; i < 6; i += 1) {
      checkLoginRate('locked@example.com')
    }

    jest.setSystemTime(now + (31 * 60 * 1000))
    const resultAfterWindow = checkLoginRate('locked@example.com')

    expect(resultAfterWindow.allowed).toBe(true)

    jest.useRealTimers()
  })

  it('keeps the block active even after the rolling window expires', () => {
    jest.useFakeTimers()
    const now = Date.now()
    jest.setSystemTime(now)

    for (let i = 0; i < 6; i += 1) {
      checkLoginRate('block-window@example.com')
    }

    // Window (15 minutes) has expired, but block duration is 30 minutes
    jest.setSystemTime(now + (16 * 60 * 1000))
    const stillBlocked = checkLoginRate('block-window@example.com')
    expect(stillBlocked.allowed).toBe(false)

    // After the full block duration, attempts are allowed again
    jest.setSystemTime(now + (31 * 60 * 1000))
    const unblocked = checkLoginRate('block-window@example.com')
    expect(unblocked.allowed).toBe(true)

    jest.useRealTimers()
  })

  it('enforceRateLimit throws RateLimitError when blocked', () => {
    const blockedCheck = () => ({
      allowed: false,
      retryAfter: 12_000,
    })

    expect(() => enforceRateLimit(blockedCheck, 'buyer@example.com')).toThrow(RateLimitError)
    expect(() => enforceRateLimit(blockedCheck, 'buyer@example.com')).toThrow(/Too many attempts/i)
  })

  it('withRateLimit wraps async function and blocks when limit exceeded', async () => {
    const fn = jest.fn(async (value) => `ok:${value}`)
    const limited = withRateLimit(
      fn,
      (identifier) => (identifier === 'blocked' ? { allowed: false, retryAfter: 5000 } : { allowed: true }),
      (identifier) => identifier,
    )

    await expect(limited('open')).resolves.toBe('ok:open')
    await expect(limited('blocked')).rejects.toThrow(RateLimitError)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe('authGateway signInWithServerRateLimit', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete globalThis.Cypress
    if (typeof window !== 'undefined') {
      delete window.Cypress
    }
  })

  it('calls secure-login function with normalized payload', async () => {
    const token = createMockJwt({ sub: 'auth-user-1', email: 'buyer@example.com' })

    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        session: { access_token: token, refresh_token: 'refresh-1' },
      },
      error: null,
    })

    mockSetSession.mockResolvedValue({
      data: {
        user: { id: 'auth-user-1', email: 'buyer@example.com' },
        session: { access_token: token, refresh_token: 'refresh-1' },
      },
      error: null,
    })

    const result = await signInWithServerRateLimit({
      email: '  BUYER@example.com ',
      password: 'Pass123!@#',
      captchaToken: 'captcha-token',
    })

    expect(mockInvoke).toHaveBeenCalledWith('secure-login', {
      body: {
        email: 'BUYER@example.com',
        password: 'Pass123!@#',
        captchaToken: 'captcha-token',
      },
    })
    expect(mockSetSession).toHaveBeenCalled()
    expect(result.user.id).toBe('auth-user-1')
  })

  it('uses cypress/fixture bypass for greenmarket.test email without setSession', async () => {
    const token = createMockJwt({ sub: 'fixture-user', email: 'buyer@greenmarket.test' })

    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        session: { access_token: token, refresh_token: 'fixture-refresh' },
      },
      error: null,
    })

    const result = await signInWithServerRateLimit({
      email: 'buyer@greenmarket.test',
      password: 'Pass123!@#',
    })

    expect(mockSetSession).not.toHaveBeenCalled()
    expect(result.user).toEqual(expect.objectContaining({ id: 'fixture-user', email: 'buyer@greenmarket.test' }))
  })

  it('throws when secure-login returns an error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('function failed') })

    await expect(signInWithServerRateLimit({ email: 'a@b.com', password: 'x' })).rejects.toThrow('function failed')
  })

  it('throws when setSession cannot establish session', async () => {
    const token = createMockJwt({ sub: 'auth-user-2', email: 'buyer@example.com' })

    mockInvoke.mockResolvedValue({
      data: {
        success: true,
        session: { access_token: token, refresh_token: 'refresh-2' },
      },
      error: null,
    })

    mockSetSession.mockResolvedValue({
      data: null,
      error: new Error('setSession failed'),
    })

    await expect(signInWithServerRateLimit({
      email: 'buyer@example.com',
      password: 'Pass123!@#',
    })).rejects.toThrow('setSession failed')
  })
})
