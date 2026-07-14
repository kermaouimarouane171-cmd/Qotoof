import {
  DEFAULT_AUTH_REDIRECT,
  clearPendingAuthRedirect,
  consumePendingAuthRedirect,
  getPendingAuthRedirect,
  resolveSafeAuthRedirect,
  setPendingAuthRedirect,
} from '@/modules/auth'

describe('authRedirects', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  it('accepts same-origin relative redirects', () => {
    expect(resolveSafeAuthRedirect('/orders/123?tab=items#summary')).toBe('/orders/123?tab=items#summary')
  })

  it('rejects external redirects', () => {
    expect(resolveSafeAuthRedirect('https://evil.example/login', DEFAULT_AUTH_REDIRECT)).toBe(DEFAULT_AUTH_REDIRECT)
  })

  it('stores and retrieves only sanitized pending redirects', () => {
    setPendingAuthRedirect('/vendor/orders?filter=open')

    expect(getPendingAuthRedirect()).toBe('/vendor/orders?filter=open')
  })

  it('clears unsafe pending redirects instead of persisting them', () => {
    expect(setPendingAuthRedirect('javascript:alert(1)')).toBeNull()
    expect(getPendingAuthRedirect()).toBeNull()
  })

  it('consumes and clears the pending redirect', () => {
    setPendingAuthRedirect('/checkout')

    expect(consumePendingAuthRedirect()).toBe('/checkout')
    expect(getPendingAuthRedirect()).toBeNull()

    clearPendingAuthRedirect()
    expect(consumePendingAuthRedirect()).toBe(DEFAULT_AUTH_REDIRECT)
  })
})