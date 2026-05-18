import {
  recaptchaSiteKeyLooksIssued,
  sentryDsnLooksIssued,
  supabaseAnonKeyLooksIssued,
  supabaseUrlLooksIssued,
} from '@/utils/envValidators'

describe('envValidators', () => {
  test('accepts an issued-looking Sentry DSN', () => {
    expect(sentryDsnLooksIssued('https://1234567890abcdef1234567890abcdef@o123456.ingest.sentry.io/987654')).toBe(true)
  })

  test('rejects placeholder Sentry DSNs even when they match the old regex', () => {
    expect(sentryDsnLooksIssued('https://your-key@sentry.io/123456')).toBe(false)
    expect(sentryDsnLooksIssued('https://examplePublicKey@o0.ingest.sentry.io/0')).toBe(false)
  })

  test('accepts only secure Supabase project urls', () => {
    expect(supabaseUrlLooksIssued('https://demo-project.supabase.co')).toBe(true)
    expect(supabaseUrlLooksIssued('http://demo-project.supabase.co')).toBe(false)
    expect(supabaseUrlLooksIssued('https://example.com')).toBe(false)
  })

  test('accepts only long JWT-shaped Supabase anon keys', () => {
    const issuedLookingKey = `eyJ${'a'.repeat(120)}`
    expect(supabaseAnonKeyLooksIssued(issuedLookingKey)).toBe(true)
    expect(supabaseAnonKeyLooksIssued('short-key')).toBe(false)
  })

  test('accepts only issued-looking recaptcha site keys', () => {
    expect(recaptchaSiteKeyLooksIssued('6LeAbCdEfGhIjKlMnOpQrStUvWxYz1234567890')).toBe(true)
    expect(recaptchaSiteKeyLooksIssued('recaptcha-site-key-placeholder')).toBe(false)
  })
})