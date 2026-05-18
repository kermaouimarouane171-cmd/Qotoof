import { isRecaptchaSiteKeyConfigured } from '@/components/ui/Recaptcha'

describe('Recaptcha helper', () => {
  const validSiteKey = '6LeAbCdEfGhIjKlMnOpQrStUvWxYz1234567890'

  test('disables recaptcha for localhost-style hosts', () => {
    expect(isRecaptchaSiteKeyConfigured(validSiteKey, 'localhost')).toBe(false)
    expect(isRecaptchaSiteKeyConfigured(validSiteKey, '127.0.0.1')).toBe(false)
  })

  test('keeps recaptcha enabled for issued keys on public hosts', () => {
    expect(isRecaptchaSiteKeyConfigured(validSiteKey, 'app.qotoof.ma')).toBe(true)
  })

  test('rejects placeholder site keys even on public hosts', () => {
    expect(isRecaptchaSiteKeyConfigured('recaptcha-site-key-placeholder', 'app.qotoof.ma')).toBe(false)
  })
})